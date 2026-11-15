import {
  Branch,
  DeadlineUrgency,
  JobOrder,
  JobOrderFilters,
  JobStatus,
  NewJobOrderInput,
  NotificationItem,
  PaymentStatus,
  UserAccount,
  UserPermissions,
  UserRole,
} from '../types/jobOrder';

export function getDefaultPermissionsForRole(role: UserRole): UserPermissions {
  if (role === UserRole.ADMIN) {
    return {
      canCreateOrder: true,
      canUpdateStatus: true,
      canUpdatePayment: true,
      canAddNotes: true,
      canFlagWarning: true,
      canSubmitCompletion: true,
      canApproveOrders: true,
      canFinalizeOrders: true,
      canManageUsers: true,
    };
  }

  if (role === UserRole.ATTENDANT) {
    return {
      canCreateOrder: true,
      canUpdateStatus: true,
      canUpdatePayment: true,
      canAddNotes: true,
      canFlagWarning: true,
      canSubmitCompletion: true,
      canApproveOrders: false,
      canFinalizeOrders: false,
      canManageUsers: false,
    };
  }

  return {
    canCreateOrder: false,
    canUpdateStatus: false,
    canUpdatePayment: false,
    canAddNotes: false,
    canFlagWarning: false,
    canSubmitCompletion: false,
    canApproveOrders: false,
    canFinalizeOrders: false,
    canManageUsers: false,
  };
}

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysToDateString(baseDateStr: string, days: number): string {
  const [y, m, d] = baseDateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return getLocalDateString(dt);
}

export function diffDaysFromToday(deadline: string, referenceDate: Date = new Date()): number {
  const todayStr = getLocalDateString(referenceDate);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const [dy, dm, dd] = deadline.split('-').map(Number);
  const todayMs = Date.UTC(ty, tm - 1, td);
  const deadlineMs = Date.UTC(dy, dm - 1, dd);
  return Math.round((deadlineMs - todayMs) / 86_400_000);
}

export function getDeadlineUrgency(
  job: Pick<JobOrder, 'deadline' | 'status'>,
  referenceDate: Date = new Date(),
): DeadlineUrgency {
  if (job.status === JobStatus.COMPLETED || job.status === JobStatus.ARCHIVED) {
    return DeadlineUrgency.COMPLETED;
  }
  const diff = diffDaysFromToday(job.deadline, referenceDate);
  if (diff < 0) return DeadlineUrgency.OVERDUE;
  if (diff === 0) return DeadlineUrgency.DUE_TODAY;
  if (diff === 1) return DeadlineUrgency.DUE_TOMORROW;
  return DeadlineUrgency.UPCOMING;
}

export function formatDeadlineRelative(
  deadline: string,
  status: JobStatus,
  referenceDate: Date = new Date(),
): string {
  if (status === JobStatus.COMPLETED || status === JobStatus.ARCHIVED) {
    return formatFriendlyDate(deadline);
  }
  const diff = diffDaysFromToday(deadline, referenceDate);
  if (diff < -1) return `${Math.abs(diff)} days overdue`;
  if (diff === -1) return '1 day overdue';
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  return `In ${diff} days`;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatFriendlyDate(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return dateStr;
  }
  const [, month, day] = parts;
  const monthLabel = MONTH_NAMES[month - 1];
  if (!monthLabel) return dateStr;
  return `${monthLabel} ${day}`;
}

export function sortJobOrdersByDeadline(
  orders: JobOrder[],
  direction: 'asc' | 'desc' = 'asc',
): JobOrder[] {
  return [...orders].sort((a, b) => {
    if (a.deadline !== b.deadline) {
      return direction === 'asc'
        ? a.deadline.localeCompare(b.deadline)
        : b.deadline.localeCompare(a.deadline);
    }
    if (a.hasWarning !== b.hasWarning) {
      return a.hasWarning ? -1 : 1;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function isActiveOrder(order: JobOrder): boolean {
  return order.status !== JobStatus.COMPLETED && order.status !== JobStatus.ARCHIVED;
}

export function filterJobOrders(
  orders: JobOrder[],
  filters: JobOrderFilters,
): JobOrder[] {
  const query = filters.search.trim().toLowerCase();

  return orders.filter((order) => {
    if (filters.branch !== 'all' && order.branch !== filters.branch) {
      return false;
    }
    if (filters.status !== 'all' && order.status !== filters.status) {
      return false;
    }
    if (filters.payment !== 'all' && order.paymentStatus !== filters.payment) {
      return false;
    }
    if (filters.warningsOnly && !order.hasWarning) {
      return false;
    }
    if (filters.urgency && filters.urgency !== 'all') {
      const urgency = getDeadlineUrgency(order);
      if (
        filters.urgency === 'urgent_today' &&
        urgency !== DeadlineUrgency.OVERDUE &&
        urgency !== DeadlineUrgency.DUE_TODAY
      ) {
        return false;
      }
      if (
        filters.urgency === 'due_tomorrow' &&
        urgency !== DeadlineUrgency.DUE_TOMORROW
      ) {
        return false;
      }
    }
    if (query) {
      const haystack = [
        order.jobNumber,
        order.customerName,
        order.customerContact,
        order.itemType,
        order.printDetails,
        order.warningSummary,
        order.paymentNote,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });
}

export function buildNotifications(
  orders: JobOrder[],
  user: UserAccount | null,
  referenceDate: Date = new Date(),
): NotificationItem[] {
  const items: NotificationItem[] = [];
  const activeOrders = sortJobOrdersByDeadline(orders.filter(isActiveOrder));

  for (const order of activeOrders) {
    const urgency = getDeadlineUrgency(order, referenceDate);

    if (urgency === DeadlineUrgency.OVERDUE) {
      items.push({
        id: `notif-overdue-${order.id}`,
        jobId: order.id,
        jobNumber: order.jobNumber,
        customerName: order.customerName,
        type: 'overdue',
        title: `${order.jobNumber} is overdue`,
        detail: `${order.customerName} · ${order.quantity} ${order.itemType} (${formatDeadlineRelative(order.deadline, order.status, referenceDate)})`,
        deadline: order.deadline,
        createdAt: order.updatedAt,
      });
    } else if (urgency === DeadlineUrgency.DUE_TODAY) {
      items.push({
        id: `notif-today-${order.id}`,
        jobId: order.id,
        jobNumber: order.jobNumber,
        customerName: order.customerName,
        type: 'due_today',
        title: `${order.jobNumber} is due today`,
        detail: `${order.customerName} · ${order.quantity} ${order.itemType} (${order.branch})`,
        deadline: order.deadline,
        createdAt: order.updatedAt,
      });
    } else if (urgency === DeadlineUrgency.DUE_TOMORROW) {
      items.push({
        id: `notif-tomorrow-${order.id}`,
        jobId: order.id,
        jobNumber: order.jobNumber,
        customerName: order.customerName,
        type: 'due_tomorrow',
        title: `1-Day Deadline Alert: ${order.jobNumber}`,
        detail: `Due tomorrow (${order.deadline}) · ${order.customerName} — ${order.quantity} ${order.itemType}`,
        deadline: order.deadline,
        createdAt: order.updatedAt,
      });
    }

    if (order.hasWarning) {
      items.push({
        id: `notif-warn-${order.id}`,
        jobId: order.id,
        jobNumber: order.jobNumber,
        customerName: order.customerName,
        type: 'warning',
        title: `Warning Flag: ${order.jobNumber}`,
        detail: order.warningSummary || 'Special concern noted by staff',
        deadline: order.deadline,
        createdAt: order.updatedAt,
      });
    }

    if (user?.permissions.canApproveOrders && order.status === JobStatus.PENDING_APPROVAL) {
      items.push({
        id: `notif-approval-${order.id}`,
        jobId: order.id,
        jobNumber: order.jobNumber,
        customerName: order.customerName,
        type: 'approval',
        title: `Approval needed: ${order.jobNumber}`,
        detail: `Submitted by ${order.createdByName} (${order.branch}) for ${order.customerName}`,
        deadline: order.deadline,
        createdAt: order.updatedAt,
      });
    }

    if (user?.permissions.canFinalizeOrders && order.status === JobStatus.FOR_ADMIN_CONFIRMATION) {
      items.push({
        id: `notif-confirm-${order.id}`,
        jobId: order.id,
        jobNumber: order.jobNumber,
        customerName: order.customerName,
        type: 'confirmation',
        title: `Confirm completion: ${order.jobNumber}`,
        detail: `${order.customerName} marked done — ready for admin sign-off`,
        deadline: order.deadline,
        createdAt: order.updatedAt,
      });
    }
  }

  return items;
}

export function validateNewJobOrder(input: NewJobOrderInput): string[] {
  const errors: string[] = [];
  if (!input.customerName || input.customerName.trim().length < 2) {
    errors.push('Customer name is required (at least 2 characters).');
  }
  if (!input.itemType || input.itemType.trim().length < 2) {
    errors.push('Item type is required (e.g., T-Shirt, Jersey, Tarpaulin).');
  }
  if (!Number.isFinite(input.quantity) || input.quantity < 1) {
    errors.push('Quantity must be at least 1.');
  }
  if (!input.deadline || !/^\d{4}-\d{2}-\d{2}$/.test(input.deadline)) {
    errors.push('Valid deadline date (YYYY-MM-DD) is required.');
  }
  if (!Object.values(Branch).includes(input.branch)) {
    errors.push('Please select Branch 1 or Branch 2.');
  }
  if (!Object.values(PaymentStatus).includes(input.paymentStatus)) {
    errors.push('Please select a valid payment status.');
  }
  return errors;
}

export function validateJobOrderStep(step: 1 | 2 | 3 | 4, input: NewJobOrderInput): string[] {
  const errors: string[] = [];
  if (step === 1) {
    if (!input.customerName || input.customerName.trim().length < 2) {
      errors.push('Customer name is required (at least 2 characters).');
    }
    if (!Object.values(Branch).includes(input.branch)) {
      errors.push('Please select Branch 1 or Branch 2.');
    }
    return errors;
  }
  if (step === 2) {
    if (!input.itemType || input.itemType.trim().length < 2) {
      errors.push('Item type is required (e.g., T-Shirt, Jersey, Tarpaulin).');
    }
    if (!Number.isFinite(input.quantity) || input.quantity < 1) {
      errors.push('Quantity must be at least 1.');
    }
    if (!input.deadline || !/^\d{4}-\d{2}-\d{2}$/.test(input.deadline)) {
      errors.push('Valid deadline date (YYYY-MM-DD) is required.');
    }
    return errors;
  }
  if (step === 3) {
    if (!Object.values(PaymentStatus).includes(input.paymentStatus)) {
      errors.push('Please select a valid payment status.');
    }
    return errors;
  }
  return validateNewJobOrder(input);
}

export function getAllowedNextStatuses(
  currentStatus: JobStatus,
  user: UserAccount,
): JobStatus[] {
  if (user.role === UserRole.ADMIN) {
    if (currentStatus === JobStatus.PENDING_APPROVAL) {
      return [JobStatus.PENDING, JobStatus.IN_PRODUCTION];
    }
    if (currentStatus === JobStatus.COMPLETED) {
      return [JobStatus.READY_FOR_RELEASE];
    }
    return [
      JobStatus.PENDING,
      JobStatus.IN_PRODUCTION,
      JobStatus.READY_FOR_RELEASE,
      JobStatus.COMPLETED,
    ].filter((s) => s !== currentStatus);
  }

  // Attendant workflow: cannot self-approve from Pending Approval, cannot self-finalize to Completed
  if (!user.permissions.canUpdateStatus) {
    return [];
  }

  switch (currentStatus) {
    case JobStatus.PENDING_APPROVAL:
      return [];
    case JobStatus.PENDING:
      return [JobStatus.IN_PRODUCTION, JobStatus.READY_FOR_RELEASE];
    case JobStatus.IN_PRODUCTION:
      return [JobStatus.PENDING, JobStatus.READY_FOR_RELEASE];
    case JobStatus.READY_FOR_RELEASE:
      return user.permissions.canSubmitCompletion
        ? [JobStatus.IN_PRODUCTION, JobStatus.FOR_ADMIN_CONFIRMATION]
        : [JobStatus.IN_PRODUCTION];
    case JobStatus.FOR_ADMIN_CONFIRMATION:
      return [JobStatus.READY_FOR_RELEASE];
    case JobStatus.COMPLETED:
    case JobStatus.ARCHIVED:
      return [];
    default:
      return [];
  }
}

export function canReleaseWarning(order: JobOrder): {
  ok: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (order.paymentStatus !== PaymentStatus.PAID) {
    reasons.push(
      order.paymentStatus === PaymentStatus.UNPAID
        ? 'Customer has an unpaid balance.'
        : 'Customer only paid a down payment — verify remaining balance before releasing.',
    );
  }
  if (order.status === JobStatus.PENDING_APPROVAL || order.status === JobStatus.PENDING || order.status === JobStatus.IN_PRODUCTION) {
    reasons.push(`Order is still "${order.status}" and not yet ready for release.`);
  }
  if (order.hasWarning) {
    reasons.push(`Special warning note flagged: ${order.warningSummary}`);
  }
  return {
    ok: reasons.length === 0,
    reasons,
  };
}

export interface StatusTransitionConfirmation {
  title: string;
  message: string;
  cautions: string[];
  confirmLabel: string;
  tone: 'primary' | 'dark' | 'warning';
}

export function buildStatusTransitionConfirmation(
  order: Pick<
    JobOrder,
    'jobNumber' | 'customerName' | 'quantity' | 'itemType' | 'status' | 'paymentStatus' | 'paymentNote' | 'hasWarning' | 'warningSummary'
  >,
  nextStatus: JobStatus,
): StatusTransitionConfirmation {
  const summary = `${order.customerName} (${order.quantity} pcs · ${order.itemType})`;
  const cautions: string[] = [];

  const isReleaseOrCompletion =
    nextStatus === JobStatus.READY_FOR_RELEASE ||
    nextStatus === JobStatus.FOR_ADMIN_CONFIRMATION ||
    nextStatus === JobStatus.COMPLETED;

  if (isReleaseOrCompletion) {
    if (order.paymentStatus !== PaymentStatus.PAID) {
      const noteText = order.paymentNote ? ` (${order.paymentNote})` : '';
      cautions.push(
        `Payment status is "${order.paymentStatus}"${noteText}. Verify remaining balance before handover.`,
      );
    }
    if (order.hasWarning) {
      cautions.push(
        `Active warning: ${order.warningSummary || 'Special concern noted on this order.'}`,
      );
    }
  }

  let title = `Change ${order.jobNumber} to ${nextStatus}?`;
  let message = `Update ${summary} from "${order.status}" to "${nextStatus}".`;
  let confirmLabel = 'Confirm Change';

  if (order.status === JobStatus.PENDING_APPROVAL && nextStatus === JobStatus.PENDING) {
    title = `Approve ${order.jobNumber}?`;
    message = `Move ${summary} into the active Pending production queue for printing.`;
    confirmLabel = 'Approve & Queue';
  } else if (nextStatus === JobStatus.IN_PRODUCTION && order.status === JobStatus.PENDING) {
    title = `Start printing ${order.jobNumber}?`;
    message = `Move ${summary} to In Production so branch staff know it is being printed.`;
    confirmLabel = 'Start Printing';
  } else if (nextStatus === JobStatus.READY_FOR_RELEASE && order.status === JobStatus.IN_PRODUCTION) {
    title = `Mark ${order.jobNumber} ready for pickup?`;
    message = `Confirm that ${summary} is finished, packed, and ready for customer release.`;
    confirmLabel = 'Mark Ready';
  } else if (nextStatus === JobStatus.FOR_ADMIN_CONFIRMATION) {
    title = `Submit ${order.jobNumber} as released?`;
    message = `Mark ${summary} as released to the customer and send it for Admin completion sign-off.`;
    confirmLabel = 'Submit as Released';
  } else if (nextStatus === JobStatus.COMPLETED) {
    title = `Confirm & archive ${order.jobNumber}?`;
    message = `Mark ${summary} as fully completed and move it to the Completed Archive.`;
    confirmLabel = 'Confirm & Archive';
  } else if (order.status === JobStatus.COMPLETED && nextStatus === JobStatus.READY_FOR_RELEASE) {
    title = `Reopen ${order.jobNumber}?`;
    message = `Return ${summary} from Completed Archive back to Active Orders (Ready for Release).`;
    confirmLabel = 'Reopen Order';
  } else {
    title = `Move ${order.jobNumber} to ${nextStatus}?`;
    message = `Change ${summary} from "${order.status}" to "${nextStatus}".`;
    confirmLabel = `Move to ${nextStatus}`;
  }

  const tone: StatusTransitionConfirmation['tone'] =
    cautions.length > 0
      ? 'warning'
      : nextStatus === JobStatus.COMPLETED || nextStatus === JobStatus.FOR_ADMIN_CONFIRMATION
      ? 'dark'
      : 'primary';

  return {
    title,
    message,
    cautions,
    confirmLabel,
    tone,
  };
}

