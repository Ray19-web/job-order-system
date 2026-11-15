import type { JobOrder, NewJobOrderInput, UserAccount, UserPermissions, UserRole, Branch } from '../types/jobOrder';

const TOKEN_KEY = 'easyink_session_token';

export function getStoredToken(): string | null {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY) || window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      window.sessionStorage.setItem(TOKEN_KEY, token);
      window.localStorage.setItem(TOKEN_KEY, token);
    } else {
      window.sessionStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore storage restriction
  }
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('x-session-token', token);
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || `Request failed (${res.status})`);
  }
  return payload as T;
}

export async function loginRequest(username: string, password: string): Promise<{ token: string; user: UserAccount }> {
  const data = await apiFetch<{ token: string; user: UserAccount }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setStoredToken(data.token);
  return data;
}

export async function logoutRequest(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } finally {
    setStoredToken(null);
  }
}

export async function fetchMe(): Promise<UserAccount | null> {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const data = await apiFetch<{ user: UserAccount }>('/api/auth/me');
    return data.user;
  } catch {
    setStoredToken(null);
    return null;
  }
}

export async function fetchOrders(): Promise<JobOrder[]> {
  const data = await apiFetch<{ orders: JobOrder[] }>('/api/orders');
  return data.orders;
}

export async function createOrder(input: NewJobOrderInput): Promise<JobOrder> {
  const data = await apiFetch<{ order: JobOrder }>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.order;
}

export async function updateOrder(
  id: string,
  patch: Partial<JobOrder>,
): Promise<JobOrder> {
  const data = await apiFetch<{ order: JobOrder }>(`/api/orders/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return data.order;
}

export async function addOrderNote(
  id: string,
  text: string,
  isWarning: boolean,
): Promise<JobOrder> {
  const data = await apiFetch<{ order: JobOrder }>(`/api/orders/${encodeURIComponent(id)}/notes`, {
    method: 'POST',
    body: JSON.stringify({ text, isWarning }),
  });
  return data.order;
}

export async function fetchUsers(): Promise<UserAccount[]> {
  const data = await apiFetch<{ users: UserAccount[] }>('/api/users');
  return data.users;
}

export async function createUserAccount(input: {
  username: string;
  password: string;
  fullName: string;
  role: UserRole;
  branch: Branch;
}): Promise<UserAccount> {
  const data = await apiFetch<{ user: UserAccount }>('/api/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.user;
}

export async function updateUserAccount(
  id: string,
  patch: {
    role?: UserRole;
    branch?: Branch;
    active?: boolean;
    password?: string;
    permissions?: Partial<UserPermissions>;
  },
): Promise<UserAccount> {
  const data = await apiFetch<{ user: UserAccount }>(`/api/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return data.user;
}
