import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysToDateString,
  buildNotifications,
  buildStatusTransitionConfirmation,
  canReleaseWarning,
  filterJobOrders,
  formatFriendlyDate,
  getAllowedNextStatuses,
  getDeadlineUrgency,
  getDefaultPermissionsForRole,
  sortJobOrdersByDeadline,
  validateJobOrderStep,
  validateNewJobOrder,
} from './jobOrderLogic';
import {
  Branch,
  DeadlineUrgency,
  JobOrder,
  JobStatus,
  PaymentStatus,
  UserAccount,
  UserRole,
} from '../types/jobOrder';

function makeOrder(overrides: Partial<JobOrder> = {}): JobOrder {
  return {
    id: 'jo-1',
    jobNumber: 'JO-2026-0101',
    customerName: 'Juan Dela Cruz',
    customerContact: '0917-555-0101',
    branch: Branch.BRANCH_1,
    itemType: 'Custom T-Shirt',
    quantity: 70,
    printDetails: 'Front & back sublimation',
    deadline: '2026-11-15',
    status: JobStatus.PENDING,
    paymentStatus: PaymentStatus.DOWN_PAYMENT,
    paymentNote: '50% down payment received',
    hasWarning: false,
    warningSummary: '',
    notes: [],
    createdById: 'u-ana',
    createdByName: 'Ana Santos',
    createdAt: '2026-11-10T09:00:00.000Z',
    updatedAt: '2026-11-10T09:00:00.000Z',
    ...overrides,
  };
}

function makeUser(role: UserRole): UserAccount {
  return {
    id: `u-${role}`,
    username: role,
    fullName: role.toUpperCase(),
    role,
    branch: Branch.BRANCH_1,
    permissions: getDefaultPermissionsForRole(role),
    active: true,
    createdAt: '2026-11-01T00:00:00.000Z',
  };
}

test('getDeadlineUrgency identifies overdue, today, 1-day-before tomorrow, and upcoming', () => {
  const ref = new Date(2026, 10, 14, 10, 0, 0); // 2026-11-14
  assert.equal(
    getDeadlineUrgency(makeOrder({ deadline: '2026-11-13' }), ref),
    DeadlineUrgency.OVERDUE,
  );
  assert.equal(
    getDeadlineUrgency(makeOrder({ deadline: '2026-11-14' }), ref),
    DeadlineUrgency.DUE_TODAY,
  );
  assert.equal(
    getDeadlineUrgency(makeOrder({ deadline: '2026-11-15' }), ref),
    DeadlineUrgency.DUE_TOMORROW,
  );
  assert.equal(
    getDeadlineUrgency(makeOrder({ deadline: '2026-11-18' }), ref),
    DeadlineUrgency.UPCOMING,
  );
  assert.equal(
    getDeadlineUrgency(makeOrder({ deadline: '2026-11-13', status: JobStatus.COMPLETED }), ref),
    DeadlineUrgency.COMPLETED,
  );
});

test('sortJobOrdersByDeadline orders nearest deadline first, prioritizing warnings on ties', () => {
  const orders = [
    makeOrder({ id: '3', deadline: '2026-11-20', hasWarning: false }),
    makeOrder({ id: '2', deadline: '2026-11-15', hasWarning: false }),
    makeOrder({ id: '1', deadline: '2026-11-15', hasWarning: true }),
    makeOrder({ id: '0', deadline: '2026-11-14', hasWarning: false }),
  ];
  const sorted = sortJobOrdersByDeadline(orders);
  assert.deepEqual(
    sorted.map((o) => o.id),
    ['0', '1', '2', '3'],
  );
});

test('buildNotifications triggers 1-day-before deadline alert and admin approval alerts', () => {
  const ref = new Date(2026, 10, 14, 10, 0, 0); // 2026-11-14
  const admin = makeUser(UserRole.ADMIN);
  const viewer = makeUser(UserRole.VIEWER);
  const orders = [
    makeOrder({
      id: '1',
      jobNumber: 'JO-2026-0101',
      deadline: addDaysToDateString('2026-11-14', 1),
      status: JobStatus.PENDING_APPROVAL,
      hasWarning: true,
      warningSummary: '2 shirts have tear near collar',
    }),
  ];

  const adminAlerts = buildNotifications(orders, admin, ref);
  assert.ok(adminAlerts.some((n) => n.type === 'due_tomorrow'));
  assert.ok(adminAlerts.some((n) => n.type === 'warning'));
  assert.ok(adminAlerts.some((n) => n.type === 'approval'));

  const viewerAlerts = buildNotifications(orders, viewer, ref);
  assert.ok(viewerAlerts.some((n) => n.type === 'due_tomorrow'));
  assert.equal(
    viewerAlerts.some((n) => n.type === 'approval'),
    false,
  );
});

test('filterJobOrders searches by JO number, customer name, branch, and warning flag', () => {
  const orders = [
    makeOrder({
      id: '1',
      jobNumber: 'JO-2026-0101',
      customerName: 'Maria Clara',
      branch: Branch.BRANCH_1,
      hasWarning: true,
    }),
    makeOrder({
      id: '2',
      jobNumber: 'JO-2026-0102',
      customerName: 'Crisostomo Ibarra',
      branch: Branch.BRANCH_2,
      hasWarning: false,
    }),
  ];

  assert.equal(
    filterJobOrders(orders, {
      search: '0102',
      branch: 'all',
      status: 'all',
      payment: 'all',
      warningsOnly: false,
    }).length,
    1,
  );
  assert.equal(
    filterJobOrders(orders, {
      search: 'maria',
      branch: Branch.BRANCH_1,
      status: 'all',
      payment: 'all',
      warningsOnly: true,
    }).length,
    1,
  );
});

test('RBAC status transitions enforce attendant & viewer restrictions', () => {
  const admin = makeUser(UserRole.ADMIN);
  const attendant = makeUser(UserRole.ATTENDANT);
  const viewer = makeUser(UserRole.VIEWER);

  assert.equal(getAllowedNextStatuses(JobStatus.PENDING, viewer).length, 0);
  assert.equal(
    getAllowedNextStatuses(JobStatus.PENDING_APPROVAL, attendant).length,
    0,
  );
  assert.ok(
    getAllowedNextStatuses(JobStatus.READY_FOR_RELEASE, attendant).includes(
      JobStatus.FOR_ADMIN_CONFIRMATION,
    ),
  );
  assert.equal(
    getAllowedNextStatuses(JobStatus.READY_FOR_RELEASE, attendant).includes(
      JobStatus.COMPLETED,
    ),
    false,
  );
  assert.ok(
    getAllowedNextStatuses(JobStatus.FOR_ADMIN_CONFIRMATION, admin).includes(
      JobStatus.COMPLETED,
    ),
  );
});

test('canReleaseWarning warns attendants before releasing unpaid or unready orders', () => {
  const check = canReleaseWarning(
    makeOrder({
      status: JobStatus.READY_FOR_RELEASE,
      paymentStatus: PaymentStatus.DOWN_PAYMENT,
      hasWarning: true,
      warningSummary: 'Missing XS jersey',
    }),
  );
  assert.equal(check.ok, false);
  assert.equal(check.reasons.length, 2);
});

test('validateNewJobOrder rejects missing required fields', () => {
  const errs = validateNewJobOrder({
    customerName: '',
    customerContact: '',
    branch: Branch.BRANCH_1,
    itemType: '',
    quantity: 0,
    printDetails: '',
    deadline: 'invalid',
    paymentStatus: PaymentStatus.UNPAID,
    paymentNote: '',
  });
  assert.equal(errs.length, 4);
});

test('formatFriendlyDate formats ISO dates into human-readable Month Day', () => {
  assert.equal(formatFriendlyDate('2026-11-15'), 'Nov 15');
  assert.equal(formatFriendlyDate('2026-01-05'), 'Jan 5');
});

test('validateJobOrderStep validates customer, print job, payment, and final review per step', () => {
  const base = {
    customerName: '',
    customerContact: '',
    branch: Branch.BRANCH_1,
    itemType: '',
    quantity: 0,
    printDetails: '',
    deadline: 'invalid',
    paymentStatus: PaymentStatus.DOWN_PAYMENT,
    paymentNote: '',
  };

  assert.equal(validateJobOrderStep(1, base).length, 1);
  assert.equal(validateJobOrderStep(1, { ...base, customerName: 'Kuya Ben' }).length, 0);

  assert.equal(validateJobOrderStep(2, base).length, 3);
  assert.equal(
    validateJobOrderStep(2, {
      ...base,
      itemType: 'Polo Shirt',
      quantity: 12,
      deadline: '2026-11-18',
    }).length,
    0,
  );

  assert.equal(validateJobOrderStep(3, base).length, 0);
  assert.equal(validateJobOrderStep(4, base).length, 4);
});

test('buildStatusTransitionConfirmation builds tailored titles, tones, and cautions', () => {
  const approval = buildStatusTransitionConfirmation(
    makeOrder({ status: JobStatus.PENDING_APPROVAL }),
    JobStatus.PENDING,
  );
  assert.equal(approval.title, 'Approve JO-2026-0101?');
  assert.equal(approval.confirmLabel, 'Approve & Queue');
  assert.equal(approval.tone, 'primary');
  assert.equal(approval.cautions.length, 0);

  const archiveWithRisks = buildStatusTransitionConfirmation(
    makeOrder({
      status: JobStatus.READY_FOR_RELEASE,
      paymentStatus: PaymentStatus.DOWN_PAYMENT,
      hasWarning: true,
      warningSummary: 'Missing XS jersey',
    }),
    JobStatus.COMPLETED,
  );
  assert.equal(archiveWithRisks.title, 'Confirm & archive JO-2026-0101?');
  assert.equal(archiveWithRisks.confirmLabel, 'Confirm & Archive');
  assert.equal(archiveWithRisks.tone, 'warning');
  assert.equal(archiveWithRisks.cautions.length, 2);

  const reopen = buildStatusTransitionConfirmation(
    makeOrder({ status: JobStatus.COMPLETED }),
    JobStatus.READY_FOR_RELEASE,
  );
  assert.equal(reopen.title, 'Reopen JO-2026-0101?');
  assert.equal(reopen.confirmLabel, 'Reopen Order');
});


