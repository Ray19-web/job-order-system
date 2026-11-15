import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownUp,
  BellRing,
  CalendarClock,
  ClockAlert,
  Printer,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  Branch,
  DeadlineUrgency,
  JobStatus,
  PaymentStatus,
  UserRole,
  type JobOrder,
  type JobOrderFilters,
  type NewJobOrderInput,
  type UserAccount,
  type UserPermissions,
} from './types/jobOrder';
import {
  buildNotifications,
  filterJobOrders,
  getDeadlineUrgency,
  isActiveOrder,
  sortJobOrdersByDeadline,
} from './utils/jobOrderLogic';
import {
  addOrderNote,
  createOrder,
  createUserAccount,
  fetchMe,
  fetchOrders,
  fetchUsers,
  getStoredToken,
  loginRequest,
  logoutRequest,
  updateOrder,
  updateUserAccount,
} from './utils/api';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar, type ActiveTab } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { JobOrderTable } from './components/JobOrderTable';
import { JobOrderModal } from './components/JobOrderModal';
import { JobOrderDrawer } from './components/JobOrderDrawer';
import { StaffPermissionsView } from './components/StaffPermissionsView';

export default function App() {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [orders, setOrders] = useState<JobOrder[]>([]);
  const [usersList, setUsersList] = useState<UserAccount[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('active');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const knownNotificationIdsRef = useRef<Set<string> | null>(null);

  const [filterOpen, setFilterOpen] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  const [filters, setFilters] = useState<JobOrderFilters>({
    search: '',
    branch: 'all',
    status: 'all',
    payment: 'all',
    warningsOnly: false,
    urgency: 'all',
  });
  const [orderSort, setOrderSort] = useState<'newest' | 'deadline' | 'customer'>('newest');

  useEffect(() => {
    if (!filterOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterPopoverRef.current &&
        !filterPopoverRef.current.contains(event.target as Node)
      ) {
        setFilterOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [filterOpen]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.branch !== 'all') count += 1;
    if ((activeTab === 'active' || activeTab === 'archive') && filters.status !== 'all') count += 1;
    if (filters.payment !== 'all') count += 1;
    if (filters.warningsOnly) count += 1;
    if (activeTab === 'active' && filters.urgency && filters.urgency !== 'all') count += 1;
    return count;
  }, [activeTab, filters]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => {
      setToast((prev) => (prev === message ? null : prev));
    }, 3500);
  }, []);

  const refreshData = useCallback(async (currentUser: UserAccount) => {
    setLoadingData(true);
    setDataError(null);
    try {
      const fetchedOrders = await fetchOrders();
      setOrders(fetchedOrders);
      if (currentUser.permissions.canManageUsers) {
        const fetchedUsers = await fetchUsers();
        setUsersList(fetchedUsers);
      } else {
        setUsersList([]);
      }
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Unable to load job orders.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchMe()
      .then((me) => {
        if (!mounted) return;
        if (me) {
          setUser(me);
          void refreshData(me);
        }
      })
      .finally(() => {
        if (mounted) setAuthChecking(false);
      });
    return () => {
      mounted = false;
    };
  }, [refreshData]);

  useEffect(() => {
    if (!user) {
      setReadNotificationIds([]);
      knownNotificationIdsRef.current = null;
      return;
    }
    knownNotificationIdsRef.current = null;
    try {
      const stored = window.localStorage.getItem(`easyink_read_alerts_${user.id}`);
      const parsed = stored ? JSON.parse(stored) : [];
      setReadNotificationIds(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
    } catch {
      setReadNotificationIds([]);
    }
  }, [user?.id]);

  // Live SSE sync across Branch 1 & Branch 2
  useEffect(() => {
    if (!user) return;
    const token = getStoredToken();
    if (!token) return;

    const es = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
    const onOrdersUpdated = () => {
      void fetchOrders().then(setOrders).catch(() => {});
    };
    const onUsersUpdated = () => {
      if (user.permissions.canManageUsers) {
        void fetchUsers().then(setUsersList).catch(() => {});
      }
      void fetchMe().then((me) => {
        if (me) setUser(me);
      });
    };

    es.addEventListener('orders_updated', onOrdersUpdated);
    es.addEventListener('users_updated', onUsersUpdated);

    return () => {
      es.removeEventListener('orders_updated', onOrdersUpdated);
      es.removeEventListener('users_updated', onUsersUpdated);
      es.close();
    };
  }, [user]);

  const handleLogin = async (username: string, password: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const result = await loginRequest(username, password);
      setUser(result.user);
      setActiveTab('active');
      await refreshData(result.user);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutRequest();
    setUser(null);
    setOrders([]);
    setUsersList([]);
    setSelectedOrderId(null);
  };

  const handleCreateOrder = async (input: NewJobOrderInput) => {
    const created = await createOrder(input);
    setOrders((prev) => [created, ...prev.filter((o) => o.id !== created.id)]);
    showToast(
      created.status === JobStatus.PENDING_APPROVAL
        ? `${created.jobNumber} submitted for admin approval.`
        : `${created.jobNumber} added to Pending queue.`,
    );
  };

  const handleUpdateOrder = async (id: string, patch: Partial<JobOrder>) => {
    const updated = await updateOrder(id, patch);
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));

    if (patch.hasWarning === false) {
      showToast(`Warning resolved on ${updated.jobNumber}.`);
    } else if (patch.paymentStatus !== undefined && !patch.status) {
      showToast(`${updated.jobNumber} payment saved (${updated.paymentStatus}).`);
    } else if (patch.customerName !== undefined && !patch.status) {
      showToast(`${updated.jobNumber} details saved.`);
    } else if (updated.status === JobStatus.COMPLETED) {
      showToast(`${updated.jobNumber} completed and moved to Archive.`);
    } else if (updated.status === JobStatus.ARCHIVED) {
      showToast(`${updated.jobNumber} moved to Archive.`);
    } else {
      showToast(`${updated.jobNumber} updated (${updated.status}).`);
    }
  };

  const handleAddNote = async (id: string, text: string, isWarning: boolean) => {
    const updated = await addOrderNote(id, text, isWarning);
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    showToast(isWarning ? `Warning note flagged on ${updated.jobNumber}.` : `Note added to ${updated.jobNumber}.`);
  };

  const handleCreateUser = async (input: {
    username: string;
    password: string;
    fullName: string;
    role: UserRole;
    branch: Branch;
  }) => {
    const created = await createUserAccount(input);
    setUsersList((prev) => [...prev, created]);
    showToast(`Account @${created.username} created.`);
  };

  const handleUpdateUser = async (
    id: string,
    patch: {
      role?: UserRole;
      branch?: Branch;
      active?: boolean;
      password?: string;
      permissions?: Partial<UserPermissions>;
    },
  ) => {
    const updated = await updateUserAccount(id, patch);
    setUsersList((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));

    if (patch.password !== undefined) {
      showToast(`Password reset for ${updated.fullName}.`);
    } else if (patch.active !== undefined) {
      showToast(`${updated.fullName} account ${updated.active ? 'activated' : 'disabled'}.`);
    } else if (patch.role !== undefined) {
      showToast(`${updated.fullName}'s role changed to ${updated.role}.`);
    } else if (patch.branch !== undefined) {
      showToast(`${updated.fullName} reassigned to ${updated.branch}.`);
    } else {
      showToast(`Updated permissions for ${updated.fullName}.`);
    }
  };

  const activeOrders = useMemo(
    () =>
      [...orders.filter(isActiveOrder)].sort((first, second) => {
        const newestFirst = Date.parse(second.createdAt) - Date.parse(first.createdAt);
        if (newestFirst !== 0) return newestFirst;
        return first.deadline.localeCompare(second.deadline);
      }),
    [orders],
  );

  const approvalOrders = useMemo(
    () =>
      sortJobOrdersByDeadline(
        orders.filter(
          (o) =>
            o.status === JobStatus.PENDING_APPROVAL ||
            o.status === JobStatus.FOR_ADMIN_CONFIRMATION,
        ),
        'asc',
      ),
    [orders],
  );

  const archivedOrders = useMemo(
    () =>
      sortJobOrdersByDeadline(
        orders.filter(
          (o) => o.status === JobStatus.COMPLETED || o.status === JobStatus.ARCHIVED,
        ),
        'desc',
      ),
    [orders],
  );

  const dueTomorrowOrders = useMemo(
    () => activeOrders.filter((order) => getDeadlineUrgency(order) === DeadlineUrgency.DUE_TOMORROW),
    [activeOrders],
  );

  const sortOrdersForDisplay = (items: JobOrder[]) =>
    [...items].sort((first, second) => {
      if (orderSort === 'deadline') return first.deadline.localeCompare(second.deadline);
      if (orderSort === 'customer') return first.customerName.localeCompare(second.customerName);
      return Date.parse(second.createdAt) - Date.parse(first.createdAt);
    });

  const filteredActiveOrders = useMemo(
    () => sortOrdersForDisplay(filterJobOrders(activeOrders, filters)),
    [activeOrders, filters, orderSort],
  );

  const filteredArchiveOrders = useMemo(
    () => sortOrdersForDisplay(filterJobOrders(archivedOrders, filters)),
    [archivedOrders, filters, orderSort],
  );

  const filteredApprovalOrders = useMemo(
    () => sortOrdersForDisplay(filterJobOrders(approvalOrders, { ...filters, status: 'all' })),
    [approvalOrders, filters, orderSort],
  );

  const notifications = useMemo(
    () => buildNotifications(orders, user),
    [orders, user],
  );

  useEffect(() => {
    // The current list is the starting state, not a new alert for the user.
    if (loadingData) return;
    if (knownNotificationIdsRef.current === null) {
      knownNotificationIdsRef.current = new Set(notifications.map((notification) => notification.id));
      return;
    }

    const previousIds = knownNotificationIdsRef.current;
    const newNotifications = notifications.filter((notification) => !previousIds.has(notification.id));
    knownNotificationIdsRef.current = new Set(notifications.map((notification) => notification.id));

    if (newNotifications.length === 1) {
      showToast(`New alert: ${newNotifications[0].title}`);
    } else if (newNotifications.length > 1) {
      showToast(`${newNotifications.length} new alerts need attention.`);
    }
  }, [loadingData, notifications, showToast]);

  const unreadNotificationCount = useMemo(
    () => notifications.filter((notification) => !readNotificationIds.includes(notification.id)).length,
    [notifications, readNotificationIds],
  );

  const markNotificationRead = useCallback((notificationId: string) => {
    if (!user) return;
    setReadNotificationIds((previous) => {
      if (previous.includes(notificationId)) return previous;
      const next = [...previous, notificationId];
      try {
        window.localStorage.setItem(`easyink_read_alerts_${user.id}`, JSON.stringify(next));
      } catch {
        // Reading alerts still works when browser storage is unavailable.
      }
      return next;
    });
  }, [user]);

  const markAllNotificationsRead = useCallback(() => {
    if (!user) return;
    const next = notifications.map((notification) => notification.id);
    setReadNotificationIds(next);
    try {
      window.localStorage.setItem(`easyink_read_alerts_${user.id}`, JSON.stringify(next));
    } catch {
      // Reading alerts still works when browser storage is unavailable.
    }
  }, [notifications, user]);

  useEffect(() => {
    if (!user || dueTomorrowOrders.length === 0) return;
    const reminder = () => {
      showToast(
        `${dueTomorrowOrders.length} order${dueTomorrowOrders.length === 1 ? '' : 's'} due tomorrow.`,
      );
    };
    const intervalId = window.setInterval(reminder, 60 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [dueTomorrowOrders.length, showToast, user]);

  const metrics = useMemo(() => {
    let urgentToday = 0;
    let dueTomorrow = 0;
    let inProduction = 0;
    let readyOrConfirm = 0;
    let warnings = 0;

    for (const order of activeOrders) {
      const u = getDeadlineUrgency(order);
      if (u === DeadlineUrgency.OVERDUE || u === DeadlineUrgency.DUE_TODAY) urgentToday += 1;
      if (u === DeadlineUrgency.DUE_TOMORROW) dueTomorrow += 1;
      if (order.status === JobStatus.IN_PRODUCTION || order.status === JobStatus.PENDING) {
        inProduction += 1;
      }
      if (
        order.status === JobStatus.READY_FOR_RELEASE ||
        order.status === JobStatus.FOR_ADMIN_CONFIRMATION
      ) {
        readyOrConfirm += 1;
      }
      if (order.hasWarning) warnings += 1;
    }

    return { urgentToday, dueTomorrow, inProduction, readyOrConfirm, warnings };
  }, [activeOrders]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || null,
    [orders, selectedOrderId],
  );

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#F6F1F9] flex items-center justify-center text-sm text-[#635573]">
        Loading Easy-Ink Job Order System...
      </div>
    );
  }

  if (!user) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        loading={authLoading}
        error={authError}
      />
    );
  }

  const pageTitle =
    activeTab === 'active'
      ? 'Active Job Orders'
      : activeTab === 'approvals'
      ? 'Approvals'
      : activeTab === 'archive'
      ? 'Archive'
      : 'Staff Access';

  return (
    <div className="min-h-screen bg-[#F6F1F9] flex">
      <Sidebar
        user={user}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setFilterOpen(false);
          setFilters((prev) => ({ ...prev, status: 'all' }));
        }}
        onLogout={handleLogout}
        counts={{
          active: activeOrders.length,
          approvals: approvalOrders.length,
          archive: archivedOrders.length,
        }}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopHeader
          title={pageTitle}
          user={user}
          notifications={notifications}
          readNotificationIds={readNotificationIds}
          unreadNotificationCount={unreadNotificationCount}
          primaryActionLabel={activeTab === 'staff' ? 'Add Staff' : 'New Job Order'}
          showPrimaryAction={
            activeTab === 'staff' ? user.permissions.canManageUsers : user.permissions.canCreateOrder
          }
          onOpenPrimaryAction={() => {
            if (activeTab === 'staff') {
              setShowAddStaffModal(true);
            } else {
              setShowNewModal(true);
            }
          }}
          onSelectOrderFromNotification={(jobId) => setSelectedOrderId(jobId)}
          onMarkNotificationRead={markNotificationRead}
          onMarkAllNotificationsRead={markAllNotificationsRead}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />

        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-5 flex-1 overflow-x-hidden">
          {dataError && (
            <div role="alert" className="rounded-2xl bg-[#FFF2F9] border border-[#FE4FAE]/45 px-5 py-3.5 text-sm text-[#C41D73]">
              {dataError}
            </div>
          )}

          {activeTab === 'active' && (
            <>
              {/* Clean 4-Card Summary Strip (active card highlights in #6E3580) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                <button
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      urgency: prev.urgency === 'urgent_today' ? 'all' : 'urgent_today',
                    }))
                  }
                  className={`flex items-center gap-3.5 rounded-3xl p-4 sm:px-5 sm:py-4 text-left shadow-[0_10px_28px_rgba(30,22,43,0.06)] transition-colors cursor-pointer ${
                    filters.urgency === 'urgent_today'
                      ? 'bg-[#6E3580] text-white'
                      : 'bg-white hover:bg-[#FBF8FD] text-[#1E162B]'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      filters.urgency === 'urgent_today'
                        ? 'bg-[#1E162B] text-[#FE4FAE]'
                        : 'bg-[#FFE4F2] text-[#C41D73]'
                    }`}
                  >
                    <ClockAlert className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`text-xs sm:text-[13px] font-semibold truncate ${
                        filters.urgency === 'urgent_today' ? 'text-[#F2E4F7]' : 'text-[#635573]'
                      }`}
                    >
                      Overdue / Today
                    </div>
                    <div className="font-display text-2xl font-bold tabular-nums leading-tight mt-0.5">
                      {metrics.urgentToday}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      urgency: prev.urgency === 'due_tomorrow' ? 'all' : 'due_tomorrow',
                    }))
                  }
                  className={`flex items-center gap-3.5 rounded-3xl p-4 sm:px-5 sm:py-4 text-left shadow-[0_10px_28px_rgba(30,22,43,0.06)] transition-colors cursor-pointer ${
                    filters.urgency === 'due_tomorrow'
                      ? 'bg-[#6E3580] text-white'
                      : 'bg-white hover:bg-[#FBF8FD] text-[#1E162B]'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      filters.urgency === 'due_tomorrow'
                        ? 'bg-[#1E162B] text-[#FCBD30]'
                        : 'bg-[#FFF7E0] text-[#9A6700]'
                    }`}
                  >
                    <CalendarClock className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`text-xs sm:text-[13px] font-semibold truncate ${
                        filters.urgency === 'due_tomorrow' ? 'text-[#F2E4F7]' : 'text-[#635573]'
                      }`}
                    >
                      Due Tomorrow
                    </div>
                    <div className="font-display text-2xl font-bold tabular-nums leading-tight mt-0.5">
                      {metrics.dueTomorrow}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      status:
                        prev.status === JobStatus.IN_PRODUCTION
                          ? 'all'
                          : JobStatus.IN_PRODUCTION,
                    }))
                  }
                  className={`flex items-center gap-3.5 rounded-3xl p-4 sm:px-5 sm:py-4 text-left shadow-[0_10px_28px_rgba(30,22,43,0.06)] transition-colors cursor-pointer ${
                    filters.status === JobStatus.IN_PRODUCTION
                      ? 'bg-[#6E3580] text-white'
                      : 'bg-white hover:bg-[#FBF8FD] text-[#1E162B]'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      filters.status === JobStatus.IN_PRODUCTION
                        ? 'bg-[#1E162B] text-[#31CAF6]'
                        : 'bg-[#E2F7FE] text-[#0284A8]'
                    }`}
                  >
                    <Printer className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`text-xs sm:text-[13px] font-semibold truncate ${
                        filters.status === JobStatus.IN_PRODUCTION ? 'text-[#F2E4F7]' : 'text-[#635573]'
                      }`}
                    >
                      In Production
                    </div>
                    <div className="font-display text-2xl font-bold tabular-nums leading-tight mt-0.5">
                      {metrics.inProduction}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      warningsOnly: !prev.warningsOnly,
                    }))
                  }
                  className={`flex items-center gap-3.5 rounded-3xl p-4 sm:px-5 sm:py-4 text-left shadow-[0_10px_28px_rgba(30,22,43,0.06)] transition-colors cursor-pointer ${
                    filters.warningsOnly
                      ? 'bg-[#6E3580] text-white'
                      : 'bg-white hover:bg-[#FBF8FD] text-[#1E162B]'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      filters.warningsOnly
                        ? 'bg-[#1E162B] text-[#FE4FAE]'
                        : 'bg-[#FFE4F2] text-[#C41D73]'
                    }`}
                  >
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`text-xs sm:text-[13px] font-semibold truncate ${
                        filters.warningsOnly ? 'text-[#F2E4F7]' : 'text-[#635573]'
                      }`}
                    >
                      Warnings
                    </div>
                    <div className="font-display text-2xl font-bold tabular-nums leading-tight mt-0.5">
                      {metrics.warnings}
                    </div>
                  </div>
                </button>
              </div>

            </>
          )}

          {/* Pill Search & Circular Filter Icon Bar */}
          {(activeTab === 'active' || activeTab === 'approvals' || activeTab === 'archive') && (
            <div className="flex items-center gap-3">
              <div className="relative flex-1 min-w-0">
                <Search className="w-5 h-5 text-[#6E3580] absolute right-4 top-3 pointer-events-none" />
                <label htmlFor="jo-search" className="sr-only">
                  Search by customer name or job order number
                </label>
                <input
                  id="jo-search"
                  type="search"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  placeholder="Search customer or JO#..."
                  className="w-full min-h-[46px] rounded-full bg-white pl-5 pr-12 py-2.5 text-[15px] text-[#1E162B] placeholder:text-[#635573] shadow-[0_8px_24px_rgba(30,22,43,0.06)] focus:outline-none focus:ring-2 focus:ring-[#CF93D9] transition-shadow"
                />
              </div>

              <div className="relative shrink-0" ref={filterPopoverRef}>
                <button
                  type="button"
                  onClick={() => setFilterOpen((prev) => !prev)}
                  aria-label="Filter job orders"
                  aria-expanded={filterOpen}
                  aria-haspopup="dialog"
                  data-tooltip="Filter job orders"
                  className={`relative min-h-[46px] inline-flex items-center justify-center gap-1.5 rounded-full px-4 shadow-[0_8px_24px_rgba(30,22,43,0.08)] transition-colors cursor-pointer ${
                    filterOpen || activeFilterCount > 0
                      ? 'bg-[#6E3580] text-white'
                      : 'bg-white text-[#6E3580] hover:bg-[#F2E4F7]'
                  }`}
                >
                  <SlidersHorizontal className="w-5 h-5" />
                  <span className="text-sm font-semibold">Filter</span>
                  {activeFilterCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#FE4FAE] text-[#1E162B] text-xs font-bold tabular-nums">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {filterOpen && (
                  <div
                    role="dialog"
                    aria-label="Filter job orders"
                    className="absolute right-0 mt-2.5 w-[min(22rem,calc(100vw-3rem))] bg-white rounded-3xl shadow-[0_18px_44px_rgba(30,22,43,0.18)] p-5 z-30 space-y-4 border border-[#E8D6EF]"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-base font-bold text-[#1E162B]">
                        Filters
                      </h3>
                      <button
                        type="button"
                        onClick={() => setFilterOpen(false)}
                        aria-label="Close filters"
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[#635573] hover:text-[#6E3580] hover:bg-[#F2E4F7] cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-[#635573]">
                        Branch
                      </span>
                      <div className="grid grid-cols-3 p-1 bg-[#F2E4F7] rounded-full gap-1">
                        {(['all', Branch.BRANCH_1, Branch.BRANCH_2] as const).map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setFilters((prev) => ({ ...prev, branch: b }))}
                            className={`min-h-[38px] px-2 py-1.5 text-sm font-semibold rounded-full transition-colors cursor-pointer whitespace-nowrap ${
                              filters.branch === b
                                ? 'bg-[#6E3580] text-white'
                                : 'text-[#1E162B] hover:text-[#6E3580]'
                            }`}
                          >
                            {b === 'all' ? 'All' : b}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(activeTab === 'active' || activeTab === 'archive') && (
                      <div className="space-y-1.5">
                        <label
                          htmlFor="filter-status"
                          className="block text-xs font-semibold uppercase tracking-wide text-[#635573]"
                        >
                          {activeTab === 'archive' ? 'Archive Status' : 'Status'}
                        </label>
                        <select
                          id="filter-status"
                          value={filters.status}
                          onChange={(e) =>
                            setFilters((prev) => ({
                              ...prev,
                              status: e.target.value as 'all' | JobStatus,
                            }))
                          }
                          className="w-full min-h-[44px] rounded-full border border-[#D8BBE4] bg-[#FBF8FD] px-4 py-2 text-[15px] font-medium text-[#1E162B] focus:border-[#6E3580] focus:outline-none"
                        >
                          {activeTab === 'archive' ? (
                            <>
                              <option value="all">All Archive Orders</option>
                              <option value={JobStatus.COMPLETED}>Completed</option>
                              <option value={JobStatus.ARCHIVED}>Archived</option>
                            </>
                          ) : (
                            <>
                              <option value="all">All Statuses</option>
                              <option value={JobStatus.PENDING_APPROVAL}>Pending Approval</option>
                              <option value={JobStatus.PENDING}>Pending</option>
                              <option value={JobStatus.IN_PRODUCTION}>In Production</option>
                              <option value={JobStatus.READY_FOR_RELEASE}>Ready for Release</option>
                              <option value={JobStatus.FOR_ADMIN_CONFIRMATION}>For Admin Confirmation</option>
                            </>
                          )}
                        </select>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label
                        htmlFor="filter-payment"
                        className="block text-xs font-semibold uppercase tracking-wide text-[#635573]"
                      >
                        Payment Status
                      </label>
                      <select
                        id="filter-payment"
                        value={filters.payment}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            payment: e.target.value as 'all' | PaymentStatus,
                          }))
                        }
                        className="w-full min-h-[44px] rounded-full border border-[#D8BBE4] bg-[#FBF8FD] px-4 py-2 text-[15px] font-medium text-[#1E162B] focus:border-[#6E3580] focus:outline-none"
                      >
                        <option value="all">All Payments</option>
                        <option value={PaymentStatus.UNPAID}>Unpaid</option>
                        <option value={PaymentStatus.DOWN_PAYMENT}>Down Payment</option>
                        <option value={PaymentStatus.PAID}>Paid</option>
                      </select>
                    </div>

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setFilters((prev) => ({
                            ...prev,
                            warningsOnly: !prev.warningsOnly,
                          }))
                        }
                        aria-pressed={filters.warningsOnly}
                        className={`w-full min-h-[44px] flex items-center justify-between px-4 py-2.5 rounded-full border text-[15px] font-semibold transition-colors cursor-pointer ${
                          filters.warningsOnly
                            ? 'border-[#FE4FAE]/60 bg-[#FFF2F9] text-[#C41D73]'
                            : 'border-[#D8BBE4] bg-[#FBF8FD] text-[#1E162B] hover:bg-[#F2E4F7]'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Warnings Only</span>
                        </span>
                        <span className="text-xs font-bold uppercase">
                          {filters.warningsOnly ? 'On' : 'Off'}
                        </span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-[#E8D6EF] flex items-center justify-between gap-2.5">
                      <button
                        type="button"
                        onClick={() =>
                          setFilters((prev) => ({
                            ...prev,
                            branch: 'all',
                            status: 'all',
                            payment: 'all',
                            warningsOnly: false,
                            urgency: 'all',
                          }))
                        }
                        className="min-h-[40px] px-4 py-2 rounded-full text-sm font-semibold text-[#635573] hover:text-[#6E3580] hover:bg-[#FBF8FD] cursor-pointer"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterOpen(false)}
                        className="min-h-[40px] px-6 py-2 rounded-full bg-[#6E3580] hover:bg-[#1E162B] text-white text-sm font-semibold cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                data-tooltip={`Sort orders: ${orderSort === 'newest' ? 'Newest' : orderSort === 'deadline' ? 'Deadline' : 'Customer'}`}
                aria-label="Change job order sorting"
                onClick={() => setOrderSort((sort) => (sort === 'newest' ? 'deadline' : sort === 'deadline' ? 'customer' : 'newest'))}
                className="h-[46px] w-[46px] shrink-0 inline-flex items-center justify-center rounded-full bg-white text-[#6E3580] hover:bg-[#F2E4F7] shadow-[0_8px_24px_rgba(30,22,43,0.08)] cursor-pointer"
              >
                <ArrowDownUp className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Main Content View */}
          {loadingData && orders.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center text-sm text-[#635573] shadow-[0_10px_28px_rgba(30,22,43,0.06)]">
              Loading live job orders...
            </div>
          ) : activeTab === 'active' ? (
            <JobOrderTable
              orders={filteredActiveOrders}
              user={user}
              onSelectOrder={(o) => setSelectedOrderId(o.id)}
              onQuickApprove={(o) =>
                void handleUpdateOrder(o.id, { status: JobStatus.PENDING })
              }
              onQuickConfirm={(o) =>
                void handleUpdateOrder(o.id, { status: JobStatus.COMPLETED })
              }
              emptyTitle="No active job orders match your filters"
              emptyDescription="Try clearing the search or branch filter, or log a new walk-in job order."
              onCreateClick={() => setShowNewModal(true)}
              resetKey={`active-${JSON.stringify(filters)}`}
            />
          ) : activeTab === 'approvals' ? (
            <JobOrderTable
              orders={filteredApprovalOrders}
              user={user}
              onSelectOrder={(o) => setSelectedOrderId(o.id)}
              onQuickApprove={(o) =>
                void handleUpdateOrder(o.id, { status: JobStatus.PENDING })
              }
              onQuickConfirm={(o) =>
                void handleUpdateOrder(o.id, { status: JobStatus.COMPLETED })
              }
              emptyTitle="No pending approvals or completion sign-offs"
              emptyDescription="Walk-in orders submitted by attendants and jobs awaiting final confirmation will appear here."
              resetKey="approvals"
            />
          ) : activeTab === 'archive' ? (
            <JobOrderTable
              orders={filteredArchiveOrders}
              user={user}
              onSelectOrder={(o) => setSelectedOrderId(o.id)}
              emptyTitle="No completed orders in archive yet"
              emptyDescription="Orders confirmed as finished by Admin move here for reference."
              resetKey={`archive-${JSON.stringify(filters)}`}
            />
          ) : (
            <StaffPermissionsView
              users={usersList}
              currentUser={user}
              addStaffOpen={showAddStaffModal}
              onCloseAddStaff={() => setShowAddStaffModal(false)}
              onCreateUser={handleCreateUser}
              onUpdateUser={handleUpdateUser}
            />
          )}
        </main>
      </div>

      {showNewModal && (
        <JobOrderModal
          user={user}
          onClose={() => setShowNewModal(false)}
          onSubmit={handleCreateOrder}
        />
      )}

      {selectedOrder && (
        <JobOrderDrawer
          key={selectedOrder.id}
          order={selectedOrder}
          user={user}
          onClose={() => setSelectedOrderId(null)}
          onUpdateOrder={handleUpdateOrder}
          onAddNote={handleAddNote}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2.5 rounded-full bg-[#1E162B] text-white px-4 py-2.5 text-xs font-semibold shadow-[0_10px_28px_rgba(30,22,43,0.28)]"
        >
          <BellRing className="w-4 h-4 text-[#CF93D9]" />
          {toast}
        </div>
      )}
    </div>
  );
}
