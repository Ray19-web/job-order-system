export enum UserRole {
  ADMIN = 'admin',
  ATTENDANT = 'attendant',
  VIEWER = 'viewer',
}

export enum Branch {
  BRANCH_1 = 'Branch 1',
  BRANCH_2 = 'Branch 2',
}

export enum JobStatus {
  PENDING_APPROVAL = 'Pending Approval',
  PENDING = 'Pending',
  IN_PRODUCTION = 'In Production',
  READY_FOR_RELEASE = 'Ready for Release',
  FOR_ADMIN_CONFIRMATION = 'For Admin Confirmation',
  COMPLETED = 'Completed',
  ARCHIVED = 'Archived',
}

export enum PaymentStatus {
  UNPAID = 'Unpaid',
  DOWN_PAYMENT = 'Down Payment',
  PAID = 'Paid',
}

export enum DeadlineUrgency {
  OVERDUE = 'overdue',
  DUE_TODAY = 'due_today',
  DUE_TOMORROW = 'due_tomorrow',
  UPCOMING = 'upcoming',
  COMPLETED = 'completed',
}

export interface UserPermissions {
  canCreateOrder: boolean;
  canUpdateStatus: boolean;
  canUpdatePayment: boolean;
  canAddNotes: boolean;
  canFlagWarning: boolean;
  canSubmitCompletion: boolean;
  canApproveOrders: boolean;
  canFinalizeOrders: boolean;
  canManageUsers: boolean;
}

export interface UserAccount {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  branch: Branch;
  permissions: UserPermissions;
  active: boolean;
  createdAt: string;
}

export interface JobNote {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  text: string;
  isWarning: boolean;
  createdAt: string;
}

export interface JobOrder {
  id: string;
  jobNumber: string;
  customerName: string;
  customerContact: string;
  branch: Branch;
  itemType: string;
  quantity: number;
  printDetails: string;
  deadline: string; // YYYY-MM-DD
  status: JobStatus;
  paymentStatus: PaymentStatus;
  paymentNote: string;
  hasWarning: boolean;
  warningSummary: string;
  notes: JobNote[];
  createdById: string;
  createdByName: string;
  approvedByName?: string;
  completedByName?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface JobOrderFilters {
  search: string;
  branch: 'all' | Branch;
  status: 'all' | JobStatus;
  payment: 'all' | PaymentStatus;
  warningsOnly: boolean;
  urgency?: 'all' | 'urgent_today' | 'due_tomorrow';
}

export interface NotificationItem {
  id: string;
  jobId: string;
  jobNumber: string;
  customerName: string;
  type: 'overdue' | 'due_today' | 'due_tomorrow' | 'warning' | 'approval' | 'confirmation';
  title: string;
  detail: string;
  deadline: string;
  createdAt: string;
}

export interface NewJobOrderInput {
  customerName: string;
  customerContact: string;
  branch: Branch;
  itemType: string;
  quantity: number;
  printDetails: string;
  deadline: string;
  paymentStatus: PaymentStatus;
  paymentNote: string;
  initialNote?: string;
  isWarning?: boolean;
}
