import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  Branch,
  JobStatus,
  PaymentStatus,
  UserRole,
  type JobNote,
  type JobOrder,
  type UserAccount,
  type UserPermissions,
} from './src/types/jobOrder.ts';
import {
  addDaysToDateString,
  getAllowedNextStatuses,
  getDefaultPermissionsForRole,
  getLocalDateString,
  validateNewJobOrder,
} from './src/utils/jobOrderLogic.ts';

interface StoredUser extends UserAccount {
  passwordHash: string;
}

interface DatabaseSchema {
  nextJobSeq: number;
  users: StoredUser[];
  orders: JobOrder[];
}

interface SessionRecord {
  userId: string;
  createdAt: number;
}

const PORT = Number(process.env.PORT) || 3000;
// This is a development-only adapter. It gives the API persistent test data
// without coupling the app to MongoDB while the production database is chosen.
const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR || 'data');
const DB_PATH = path.join(DATA_DIR, 'easyink-db.json');

function hashPassword(password: string, salt = 'easyink-shop-2026'): string {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

// Keep saved business text consistent regardless of how it was entered.
// Usernames and passwords are deliberately excluded: usernames stay lowercase
// for sign-in, while passwords must retain their exact characters.
function normalizeBusinessText(value: unknown): string {
  return String(value || '').trim().toUpperCase();
}

function createSeedDatabase(): DatabaseSchema {
  const today = getLocalDateString(new Date());
  const yesterday = addDaysToDateString(today, -1);
  const tomorrow = addDaysToDateString(today, 1);
  const in2Days = addDaysToDateString(today, 2);
  const in3Days = addDaysToDateString(today, 3);
  const in5Days = addDaysToDateString(today, 5);
  const daysAgo2 = addDaysToDateString(today, -2);
  const daysAgo5 = addDaysToDateString(today, -5);
  const nowIso = new Date().toISOString();

  const users: StoredUser[] = [
    {
      id: 'user-mark',
      username: 'mark',
      passwordHash: hashPassword('easyink123'),
      fullName: 'Mark Dela Cruz',
      role: UserRole.ADMIN,
      branch: Branch.BRANCH_1,
      permissions: getDefaultPermissionsForRole(UserRole.ADMIN),
      active: true,
      createdAt: nowIso,
    },
    {
      id: 'user-ana',
      username: 'ana',
      passwordHash: hashPassword('branch123'),
      fullName: 'Ana Santos',
      role: UserRole.ATTENDANT,
      branch: Branch.BRANCH_1,
      permissions: getDefaultPermissionsForRole(UserRole.ATTENDANT),
      active: true,
      createdAt: nowIso,
    },
    {
      id: 'user-rico',
      username: 'rico',
      passwordHash: hashPassword('branch223'),
      fullName: 'Rico Mendoza',
      role: UserRole.ATTENDANT,
      branch: Branch.BRANCH_2,
      permissions: getDefaultPermissionsForRole(UserRole.ATTENDANT),
      active: true,
      createdAt: nowIso,
    },
    {
      id: 'user-kevin',
      username: 'kevin',
      passwordHash: hashPassword('intern123'),
      fullName: 'Kevin Ramos',
      role: UserRole.VIEWER,
      branch: Branch.BRANCH_2,
      permissions: getDefaultPermissionsForRole(UserRole.VIEWER),
      active: true,
      createdAt: nowIso,
    },
  ];

  const orders: JobOrder[] = [
    {
      id: 'jo-seed-101',
      jobNumber: 'JO-2026-0101',
      customerName: 'Barangay Mabini Youth Council',
      customerContact: '0917-420-8812',
      branch: Branch.BRANCH_1,
      itemType: 'Custom T-Shirt (Cotton)',
      quantity: 70,
      printDetails: 'Front chest logo + back event print, Royal Blue DTF',
      deadline: tomorrow,
      status: JobStatus.PENDING,
      paymentStatus: PaymentStatus.DOWN_PAYMENT,
      paymentNote: '50% DP received via GCash; collect remaining balance on release',
      hasWarning: true,
      warningSummary: 'Customer supplied own shirts — 2 XL shirts have small tear near collar',
      notes: [
        {
          id: 'note-101-1',
          authorId: 'user-ana',
          authorName: 'Ana Santos',
          authorRole: UserRole.ATTENDANT,
          text: 'Customer supplied own shirts — 2 XL shirts have small tear near collar. Customer acknowledged on drop-off.',
          isWarning: true,
          createdAt: nowIso,
        },
      ],
      createdById: 'user-ana',
      createdByName: 'Ana Santos',
      approvedByName: 'Mark Dela Cruz',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'jo-seed-102',
      jobNumber: 'JO-2026-0102',
      customerName: 'Sitio Uno Ballers',
      customerContact: '0928-311-9045',
      branch: Branch.BRANCH_2,
      itemType: 'Full Sublimation Jersey',
      quantity: 24,
      printDetails: 'Black & gold reversible set, player names & numbers attached',
      deadline: today,
      status: JobStatus.READY_FOR_RELEASE,
      paymentStatus: PaymentStatus.DOWN_PAYMENT,
      paymentNote: 'Down payment only — remaining balance due before pickup',
      hasWarning: false,
      warningSummary: '',
      notes: [
        {
          id: 'note-102-1',
          authorId: 'user-rico',
          authorName: 'Rico Mendoza',
          authorRole: UserRole.ATTENDANT,
          text: 'All 24 sets packed and size-checked. Ready at Branch 2 counter.',
          isWarning: false,
          createdAt: nowIso,
        },
      ],
      createdById: 'user-rico',
      createdByName: 'Rico Mendoza',
      approvedByName: 'Mark Dela Cruz',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'jo-seed-103',
      jobNumber: 'JO-2026-0103',
      customerName: 'Kuya Ben Eatery',
      customerContact: '0918-776-2109',
      branch: Branch.BRANCH_1,
      itemType: 'Tarpaulin Banner (4x8 ft)',
      quantity: 3,
      printDetails: 'Grand opening menu tarp with eyelets on all corners',
      deadline: yesterday,
      status: JobStatus.IN_PRODUCTION,
      paymentStatus: PaymentStatus.UNPAID,
      paymentNote: 'Pay upon pickup — confirm payment before release',
      hasWarning: true,
      warningSummary: 'Overdue rush order — customer calling for afternoon pickup',
      notes: [
        {
          id: 'note-103-1',
          authorId: 'user-mark',
          authorName: 'Mark Dela Cruz',
          authorRole: UserRole.ADMIN,
          text: 'Prioritize on large-format printer first thing.',
          isWarning: true,
          createdAt: nowIso,
        },
      ],
      createdById: 'user-mark',
      createdByName: 'Mark Dela Cruz',
      approvedByName: 'Mark Dela Cruz',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'jo-seed-104',
      jobNumber: 'JO-2026-0104',
      customerName: 'St. Jude Choir Group',
      customerContact: '0939-601-4430',
      branch: Branch.BRANCH_2,
      itemType: 'Polo Shirt w/ Embroidery',
      quantity: 32,
      printDetails: 'White honeycomb polo, left chest choir crest',
      deadline: tomorrow,
      status: JobStatus.IN_PRODUCTION,
      paymentStatus: PaymentStatus.PAID,
      paymentNote: 'Paid in full via bank transfer',
      hasWarning: false,
      warningSummary: '',
      notes: [],
      createdById: 'user-rico',
      createdByName: 'Rico Mendoza',
      approvedByName: 'Mark Dela Cruz',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'jo-seed-105',
      jobNumber: 'JO-2026-0105',
      customerName: 'Cebu Cycling Club',
      customerContact: '0915-882-3391',
      branch: Branch.BRANCH_2,
      itemType: 'Dri-Fit Event Jersey',
      quantity: 45,
      printDetails: 'Walk-in order from Branch 2 — needs Mark approval for rush slot',
      deadline: in2Days,
      status: JobStatus.PENDING_APPROVAL,
      paymentStatus: PaymentStatus.DOWN_PAYMENT,
      paymentNote: 'Customer left initial down payment at Branch 2',
      hasWarning: false,
      warningSummary: '',
      notes: [
        {
          id: 'note-105-1',
          authorId: 'user-rico',
          authorName: 'Rico Mendoza',
          authorRole: UserRole.ATTENDANT,
          text: 'Walk-in inquiry converted to job order. Awaiting admin approval.',
          isWarning: false,
          createdAt: nowIso,
        },
      ],
      createdById: 'user-rico',
      createdByName: 'Rico Mendoza',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'jo-seed-106',
      jobNumber: 'JO-2026-0106',
      customerName: 'Reyes Family Reunion',
      customerContact: '0927-190-5564',
      branch: Branch.BRANCH_1,
      itemType: 'Family Reunion T-Shirts',
      quantity: 40,
      printDetails: 'Assorted kids & adult sizes, maroon print on cream shirts',
      deadline: in3Days,
      status: JobStatus.FOR_ADMIN_CONFIRMATION,
      paymentStatus: PaymentStatus.PAID,
      paymentNote: 'Full payment settled at Branch 1',
      hasWarning: false,
      warningSummary: '',
      notes: [
        {
          id: 'note-106-1',
          authorId: 'user-ana',
          authorName: 'Ana Santos',
          authorRole: UserRole.ATTENDANT,
          text: 'All 40 shirts printed, quality-checked, and claimed by customer. Ready for Mark confirmation.',
          isWarning: false,
          createdAt: nowIso,
        },
      ],
      createdById: 'user-ana',
      createdByName: 'Ana Santos',
      approvedByName: 'Mark Dela Cruz',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'jo-seed-107',
      jobNumber: 'JO-2026-0107',
      customerName: 'Southside Coffee Co.',
      customerContact: '0945-221-7780',
      branch: Branch.BRANCH_1,
      itemType: 'Canvas Tote Bags & Stickers',
      quantity: 100,
      printDetails: '1-color screen print tote bags + die-cut cup stickers',
      deadline: in5Days,
      status: JobStatus.PENDING,
      paymentStatus: PaymentStatus.DOWN_PAYMENT,
      paymentNote: 'Partial DP logged; balance upon completion',
      hasWarning: false,
      warningSummary: '',
      notes: [],
      createdById: 'user-mark',
      createdByName: 'Mark Dela Cruz',
      approvedByName: 'Mark Dela Cruz',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'jo-seed-098',
      jobNumber: 'JO-2026-0098',
      customerName: 'Metro Hardware Marketing',
      customerContact: '0917-908-1122',
      branch: Branch.BRANCH_1,
      itemType: 'Tarpaulin Streamers (2x5 ft)',
      quantity: 12,
      printDetails: 'Storefront promo banners',
      deadline: daysAgo2,
      status: JobStatus.COMPLETED,
      paymentStatus: PaymentStatus.PAID,
      paymentNote: 'Paid in full on release',
      hasWarning: false,
      warningSummary: '',
      notes: [],
      createdById: 'user-ana',
      createdByName: 'Ana Santos',
      approvedByName: 'Mark Dela Cruz',
      completedByName: 'Mark Dela Cruz',
      createdAt: nowIso,
      updatedAt: nowIso,
      completedAt: nowIso,
    },
    {
      id: 'jo-seed-097',
      jobNumber: 'JO-2026-0097',
      customerName: 'San Roque Volleyball Club',
      customerContact: '0920-445-6671',
      branch: Branch.BRANCH_2,
      itemType: 'Team Warmup Hoodies',
      quantity: 18,
      printDetails: 'Navy blue with vinyl numbers',
      deadline: daysAgo5,
      status: JobStatus.COMPLETED,
      paymentStatus: PaymentStatus.PAID,
      paymentNote: 'Settled via GCash',
      hasWarning: false,
      warningSummary: '',
      notes: [],
      createdById: 'user-rico',
      createdByName: 'Rico Mendoza',
      approvedByName: 'Mark Dela Cruz',
      completedByName: 'Mark Dela Cruz',
      createdAt: nowIso,
      updatedAt: nowIso,
      completedAt: nowIso,
    },
  ];

  return {
    nextJobSeq: 108,
    users,
    orders,
  };
}

function loadDatabase(): DatabaseSchema {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    const seed = createSeedDatabase();
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), 'utf8');
    return seed;
  }
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw) as DatabaseSchema;
}

function normalizeDatabaseText(database: DatabaseSchema): boolean {
  let changed = false;
  const apply = (value: string): string => normalizeBusinessText(value);
  const update = <T extends object>(record: T, key: keyof T) => {
    const current = record[key];
    if (typeof current !== 'string') return;
    const normalized = apply(current);
    if (normalized !== current) {
      record[key] = normalized as T[keyof T];
      changed = true;
    }
  };

  database.users.forEach((user) => update(user, 'fullName'));
  database.orders.forEach((order) => {
    update(order, 'customerName');
    update(order, 'itemType');
    update(order, 'printDetails');
    update(order, 'paymentNote');
    update(order, 'warningSummary');
    order.notes.forEach((note) => update(note, 'text'));
  });
  return changed;
}

// Development-only sample volume so the list, search, filters, and scrolling can be tested.
function addUiTestOrders(database: DatabaseSchema): boolean {
  const testOwner = database.users[0];
  if (!testOwner) return false;

  const groups: Array<{ name: string; statuses: JobStatus[]; target: number }> = [
    {
      name: 'active',
      statuses: [JobStatus.PENDING, JobStatus.IN_PRODUCTION, JobStatus.READY_FOR_RELEASE],
      target: 20,
    },
    {
      name: 'approval',
      statuses: [JobStatus.PENDING_APPROVAL, JobStatus.FOR_ADMIN_CONFIRMATION],
      target: 20,
    },
    { name: 'completed', statuses: [JobStatus.COMPLETED], target: 20 },
  ];

  let changed = false;
  const now = new Date().toISOString();
  const today = getLocalDateString(new Date());

  groups.forEach((group) => {
    const existing = database.orders.filter((order) => group.statuses.includes(order.status)).length;
    for (let index = existing; index < group.target; index += 1) {
      const status = group.statuses[index % group.statuses.length];
      const jobNumber = `JO-2026-${String(database.nextJobSeq).padStart(4, '0')}`;
      database.nextJobSeq += 1;
      database.orders.unshift({
        id: `jo-ui-test-${group.name}-${index + 1}`,
        jobNumber,
        customerName: `TEST ${group.name.toUpperCase()} CUSTOMER ${index + 1}`,
        customerContact: '0917-000-0000',
        branch: index % 2 === 0 ? Branch.BRANCH_1 : Branch.BRANCH_2,
        itemType: index % 2 === 0 ? 'TEST SHIRT PRINTING' : 'TEST TARPAULIN',
        quantity: 10 + index,
        printDetails: 'TEST DATA FOR LIST LAYOUT AND FILTERING',
        deadline: addDaysToDateString(today, (index % 8) + 1),
        status,
        paymentStatus: index % 3 === 0 ? PaymentStatus.UNPAID : PaymentStatus.DOWN_PAYMENT,
        paymentNote: 'TEST PAYMENT RECORD',
        hasWarning: false,
        warningSummary: '',
        notes: [],
        createdById: testOwner.id,
        createdByName: testOwner.fullName,
        approvedByName: status === JobStatus.PENDING ? testOwner.fullName : undefined,
        completedByName: status === JobStatus.COMPLETED ? testOwner.fullName : undefined,
        completedAt: status === JobStatus.COMPLETED ? now : undefined,
        createdAt: now,
        updatedAt: now,
      });
      changed = true;
    }
  });
  return changed;
}

function addUiTestUsers(database: DatabaseSchema): boolean {
  const target = 20;
  let changed = false;
  let sequence = 1;

  while (database.users.length < target) {
    const username = `teststaff${String(sequence).padStart(2, '0')}`;
    sequence += 1;
    if (database.users.some((user) => user.username === username)) continue;

    const role = database.users.length % 3 === 0 ? UserRole.VIEWER : UserRole.ATTENDANT;
    database.users.push({
      id: `user-ui-test-${username}`,
      username,
      passwordHash: hashPassword('test1234'),
      fullName: `TEST STAFF ${String(sequence - 1).padStart(2, '0')}`,
      role,
      branch: database.users.length % 2 === 0 ? Branch.BRANCH_1 : Branch.BRANCH_2,
      permissions: getDefaultPermissionsForRole(role),
      active: true,
      createdAt: new Date().toISOString(),
    });
    changed = true;
  }
  return changed;
}

let db: DatabaseSchema = loadDatabase();
const sessions = new Map<string, SessionRecord>();
const sseClients = new Set<Response>();

function saveDatabase(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpPath, DB_PATH);
}

if (normalizeDatabaseText(db)) {
  saveDatabase();
}

if (process.env.NODE_ENV !== 'production') {
  const addedTestUsers = addUiTestUsers(db);
  const addedTestOrders = addUiTestOrders(db);
  if (addedTestUsers || addedTestOrders) saveDatabase();
}

function sanitizeUser(user: StoredUser): UserAccount {
  const { passwordHash: _ignored, ...safe } = user;
  return safe;
}

function broadcastEvent(eventName: string, payload: unknown): void {
  const data = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    client.write(data);
  }
}

function parseCookieToken(req: Request): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((c) => c.trim());
  for (const part of parts) {
    if (part.startsWith('easyink_session=')) {
      return decodeURIComponent(part.slice('easyink_session='.length));
    }
  }
  return null;
}

function getRequestUser(req: Request): StoredUser | null {
  const headerToken = req.header('x-session-token');
  const token = headerToken || parseCookieToken(req);
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  const user = db.users.find((u) => u.id === session.userId && u.active);
  return user || null;
}

interface AuthedRequest extends Request {
  authUser?: StoredUser;
  sessionToken?: string;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const user = getRequestUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  req.authUser = user;
  req.sessionToken = req.header('x-session-token') || parseCookieToken(req) || undefined;
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/auth/login', (req, res) => {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const user = db.users.find(
      (u) => u.username.toLowerCase() === username && u.active,
    );
    if (!user || user.passwordHash !== hashPassword(password)) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, { userId: user.id, createdAt: Date.now() });
    res.setHeader(
      'Set-Cookie',
      `easyink_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`,
    );
    res.json({ token, user: sanitizeUser(user) });
  });

  app.post('/api/auth/logout', (req: AuthedRequest, res) => {
    const token = req.header('x-session-token') || parseCookieToken(req);
    if (token) {
      sessions.delete(token);
    }
    res.setHeader('Set-Cookie', 'easyink_session=; Path=/; Max-Age=0; SameSite=Lax');
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: sanitizeUser(req.authUser!) });
  });

  app.get('/api/events', (req, res) => {
    const token =
      (req.query.token as string | undefined) ||
      req.header('x-session-token') ||
      parseCookieToken(req);
    if (!token || !sessions.has(token)) {
      res.status(401).json({ error: 'Unauthorized stream' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    sseClients.add(res);

    const keepAlive = setInterval(() => {
      res.write(': ping\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  app.get('/api/orders', requireAuth, (_req, res) => {
    res.json({ orders: db.orders });
  });

  app.post('/api/orders', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (!user.permissions.canCreateOrder) {
      res.status(403).json({ error: 'Your account does not have permission to create job orders.' });
      return;
    }

    const input = {
      customerName: normalizeBusinessText(req.body?.customerName),
      customerContact: String(req.body?.customerContact || '').trim(),
      branch: req.body?.branch as Branch,
      itemType: normalizeBusinessText(req.body?.itemType),
      quantity: Number(req.body?.quantity),
      printDetails: normalizeBusinessText(req.body?.printDetails),
      deadline: String(req.body?.deadline || '').trim(),
      paymentStatus: req.body?.paymentStatus as PaymentStatus,
      paymentNote: normalizeBusinessText(req.body?.paymentNote),
      initialNote: normalizeBusinessText(req.body?.initialNote),
      isWarning: Boolean(req.body?.isWarning),
    };

    const validationErrors = validateNewJobOrder(input);
    if (validationErrors.length > 0) {
      res.status(400).json({ error: validationErrors[0], errors: validationErrors });
      return;
    }

    const nowIso = new Date().toISOString();
    const jobNumber = `JO-2026-${String(db.nextJobSeq).padStart(4, '0')}`;
    db.nextJobSeq += 1;

    const initialWarning = Boolean(input.isWarning && input.initialNote && user.permissions.canFlagWarning);
    const notes: JobNote[] = [];
    if (input.initialNote && user.permissions.canAddNotes) {
      notes.push({
        id: `note-${crypto.randomUUID().slice(0, 8)}`,
        authorId: user.id,
        authorName: user.fullName,
        authorRole: user.role,
        text: input.initialNote,
        isWarning: initialWarning,
        createdAt: nowIso,
      });
    }

    const isAdmin = user.role === UserRole.ADMIN;
    const newOrder: JobOrder = {
      id: `jo-${crypto.randomUUID().slice(0, 8)}`,
      jobNumber,
      customerName: input.customerName,
      customerContact: input.customerContact,
      branch: input.branch,
      itemType: input.itemType,
      quantity: input.quantity,
      printDetails: input.printDetails,
      deadline: input.deadline,
      status: isAdmin ? JobStatus.PENDING : JobStatus.PENDING_APPROVAL,
      paymentStatus: input.paymentStatus,
      paymentNote: input.paymentNote,
      hasWarning: initialWarning,
      warningSummary: initialWarning ? input.initialNote : '',
      notes,
      createdById: user.id,
      createdByName: user.fullName,
      approvedByName: isAdmin ? user.fullName : undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.orders.unshift(newOrder);
    saveDatabase();
    broadcastEvent('orders_updated', { orderId: newOrder.id });
    res.status(201).json({ order: newOrder });
  });

  app.patch('/api/orders/:id', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const orderIndex = db.orders.findIndex((o) => o.id === req.params.id);
    if (orderIndex === -1) {
      res.status(404).json({ error: 'Job order not found.' });
      return;
    }

    const existing = db.orders[orderIndex];
    const body = req.body || {};
    const updated: JobOrder = { ...existing };

    // Core field edits (Admin only)
    const coreFields = ['customerName', 'customerContact', 'branch', 'itemType', 'quantity', 'printDetails', 'deadline'];
    const editingCore = coreFields.some((f) => body[f] !== undefined && body[f] !== existing[f as keyof JobOrder]);
    if (editingCore) {
      if (user.role !== UserRole.ADMIN) {
        res.status(403).json({ error: 'Only Admin can modify core order details after submission.' });
        return;
      }
      if (body.customerName !== undefined) updated.customerName = normalizeBusinessText(body.customerName);
      if (body.customerContact !== undefined) updated.customerContact = String(body.customerContact).trim();
      if (body.branch !== undefined && Object.values(Branch).includes(body.branch)) updated.branch = body.branch;
      if (body.itemType !== undefined) updated.itemType = normalizeBusinessText(body.itemType);
      if (body.quantity !== undefined) updated.quantity = Math.max(1, Number(body.quantity));
      if (body.printDetails !== undefined) updated.printDetails = normalizeBusinessText(body.printDetails);
      if (body.deadline !== undefined) updated.deadline = String(body.deadline).trim();
    }

    // Status change validation
    if (body.status !== undefined && body.status !== existing.status) {
      const nextStatus = body.status as JobStatus;
      if (!Object.values(JobStatus).includes(nextStatus)) {
        res.status(400).json({ error: 'Invalid job status.' });
        return;
      }
      const allowed = getAllowedNextStatuses(existing.status, user);
      const isManualArchive =
        nextStatus === JobStatus.ARCHIVED &&
        user.role === UserRole.ADMIN &&
        existing.status !== JobStatus.COMPLETED &&
        existing.status !== JobStatus.ARCHIVED;
      if (!allowed.includes(nextStatus) && !isManualArchive) {
        res.status(403).json({ error: `Not permitted to move order from "${existing.status}" to "${nextStatus}".` });
        return;
      }
      updated.status = nextStatus;
      if (existing.status === JobStatus.PENDING_APPROVAL && nextStatus === JobStatus.PENDING) {
        updated.approvedByName = user.fullName;
      }
      if (nextStatus === JobStatus.COMPLETED) {
        updated.completedByName = user.fullName;
        updated.completedAt = new Date().toISOString();
      } else if (existing.status === JobStatus.COMPLETED) {
        updated.completedAt = undefined;
      }
    }

    // Payment status & note
    if (body.paymentStatus !== undefined || body.paymentNote !== undefined) {
      if (!user.permissions.canUpdatePayment) {
        res.status(403).json({ error: 'You do not have permission to update payment status.' });
        return;
      }
      if (body.paymentStatus !== undefined) {
        if (!Object.values(PaymentStatus).includes(body.paymentStatus)) {
          res.status(400).json({ error: 'Invalid payment status.' });
          return;
        }
        updated.paymentStatus = body.paymentStatus;
      }
      if (body.paymentNote !== undefined) {
        updated.paymentNote = normalizeBusinessText(body.paymentNote);
      }
    }

    // Warning flag resolution/edit
    if (body.hasWarning !== undefined || body.warningSummary !== undefined) {
      if (!user.permissions.canFlagWarning && user.role !== UserRole.ADMIN) {
        res.status(403).json({ error: 'You do not have permission to modify warning flags.' });
        return;
      }
      if (body.hasWarning !== undefined) updated.hasWarning = Boolean(body.hasWarning);
      if (body.warningSummary !== undefined) updated.warningSummary = normalizeBusinessText(body.warningSummary);
      if (!updated.hasWarning) {
        updated.warningSummary = '';
      }
    }

    updated.updatedAt = new Date().toISOString();
    db.orders[orderIndex] = updated;
    saveDatabase();
    broadcastEvent('orders_updated', { orderId: updated.id });
    res.json({ order: updated });
  });

  app.post('/api/orders/:id/notes', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (!user.permissions.canAddNotes) {
      res.status(403).json({ error: 'Your account does not have permission to add notes.' });
      return;
    }

    const orderIndex = db.orders.findIndex((o) => o.id === req.params.id);
    if (orderIndex === -1) {
      res.status(404).json({ error: 'Job order not found.' });
      return;
    }

    const text = normalizeBusinessText(req.body?.text);
    const isWarning = Boolean(req.body?.isWarning);

    if (!text) {
      res.status(400).json({ error: 'Note text cannot be empty.' });
      return;
    }
    if (isWarning && !user.permissions.canFlagWarning) {
      res.status(403).json({ error: 'Your account does not have permission to flag warning notes.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const note: JobNote = {
      id: `note-${crypto.randomUUID().slice(0, 8)}`,
      authorId: user.id,
      authorName: user.fullName,
      authorRole: user.role,
      text,
      isWarning,
      createdAt: nowIso,
    };

    const existing = db.orders[orderIndex];
    const updated: JobOrder = {
      ...existing,
      notes: [note, ...existing.notes],
      hasWarning: existing.hasWarning || isWarning,
      warningSummary: isWarning ? text : existing.warningSummary,
      updatedAt: nowIso,
    };

    db.orders[orderIndex] = updated;
    saveDatabase();
    broadcastEvent('orders_updated', { orderId: updated.id });
    res.status(201).json({ order: updated });
  });

  app.get('/api/users', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (!user.permissions.canManageUsers || user.role !== UserRole.ADMIN) {
      res.status(403).json({ error: 'Admin access required to view staff permissions.' });
      return;
    }
    res.json({ users: db.users.map(sanitizeUser) });
  });

  app.post('/api/users', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (!user.permissions.canManageUsers || user.role !== UserRole.ADMIN) {
      res.status(403).json({ error: 'Admin access required to create staff accounts.' });
      return;
    }

    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '').trim();
    const fullName = normalizeBusinessText(req.body?.fullName);
    const role = req.body?.role as UserRole;
    const branch = req.body?.branch as Branch;

    if (!username || username.length < 3) {
      res.status(400).json({ error: 'Username must be at least 3 characters.' });
      return;
    }
    if (!password || password.length < 4) {
      res.status(400).json({ error: 'Password must be at least 4 characters.' });
      return;
    }
    if (!fullName || fullName.length < 2) {
      res.status(400).json({ error: 'Full name is required.' });
      return;
    }
    if (!Object.values(UserRole).includes(role)) {
      res.status(400).json({ error: 'Invalid role.' });
      return;
    }
    if (!Object.values(Branch).includes(branch)) {
      res.status(400).json({ error: 'Invalid branch.' });
      return;
    }
    if (db.users.some((u) => u.username.toLowerCase() === username)) {
      res.status(409).json({ error: `Username "${username}" already exists.` });
      return;
    }

    const newUser: StoredUser = {
      id: `user-${crypto.randomUUID().slice(0, 8)}`,
      username,
      passwordHash: hashPassword(password),
      fullName,
      role,
      branch,
      permissions: getDefaultPermissionsForRole(role),
      active: true,
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    saveDatabase();
    broadcastEvent('users_updated', { userId: newUser.id });
    res.status(201).json({ user: sanitizeUser(newUser) });
  });

  app.patch('/api/users/:id', requireAuth, (req: AuthedRequest, res) => {
    const authUser = req.authUser!;
    if (!authUser.permissions.canManageUsers || authUser.role !== UserRole.ADMIN) {
      res.status(403).json({ error: 'Admin access required to change permissions.' });
      return;
    }

    const idx = db.users.findIndex((u) => u.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Staff account not found.' });
      return;
    }

    const target = db.users[idx];
    const body = req.body || {};

    if (body.password !== undefined && String(body.password).trim().length < 4) {
      res.status(400).json({ error: 'Password must be at least 4 characters.' });
      return;
    }

    if (target.id === authUser.id && body.active === false) {
      res.status(400).json({ error: 'You cannot deactivate your own admin account.' });
      return;
    }

    let nextRole = target.role;
    let nextPerms: UserPermissions = { ...target.permissions };

    if (body.role !== undefined && Object.values(UserRole).includes(body.role)) {
      nextRole = body.role;
      nextPerms = getDefaultPermissionsForRole(nextRole);
    }

    if (body.permissions && typeof body.permissions === 'object') {
      nextPerms = {
        ...nextPerms,
        ...body.permissions,
        // Only admins can manage users, approve, or finalize.
        canManageUsers: nextRole === UserRole.ADMIN,
        canApproveOrders: nextRole === UserRole.ADMIN,
        canFinalizeOrders: nextRole === UserRole.ADMIN,
      };
    }

    const updated: StoredUser = {
      ...target,
      role: nextRole,
      branch: body.branch && Object.values(Branch).includes(body.branch) ? body.branch : target.branch,
      active: body.active !== undefined ? Boolean(body.active) : target.active,
      passwordHash: body.password !== undefined ? hashPassword(String(body.password).trim()) : target.passwordHash,
      permissions: nextPerms,
    };

    db.users[idx] = updated;
    saveDatabase();
    broadcastEvent('users_updated', { userId: updated.id });
    res.json({ user: sanitizeUser(updated) });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Easy-Ink Job Order System running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
