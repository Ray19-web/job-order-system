import React, { useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Pencil,
  Phone,
  Printer,
  Send,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import {
  Branch,
  DeadlineUrgency,
  JobStatus,
  PaymentStatus,
  UserRole,
  type JobOrder,
  type UserAccount,
} from '../types/jobOrder';
import {
  buildStatusTransitionConfirmation,
  formatDeadlineRelative,
  formatFriendlyDate,
  getAllowedNextStatuses,
  getDeadlineUrgency,
} from '../utils/jobOrderLogic';
import { ConfirmDialog, type ConfirmDialogTone } from './ConfirmDialog';

interface JobOrderDrawerProps {
  order: JobOrder;
  user: UserAccount;
  onClose: () => void;
  onUpdateOrder: (id: string, patch: Partial<JobOrder>) => Promise<void>;
  onAddNote: (id: string, text: string, isWarning: boolean) => Promise<void>;
}

const PIPELINE_STAGES: Array<{ status: JobStatus; shortLabel: string }> = [
  { status: JobStatus.PENDING, shortLabel: 'Queued' },
  { status: JobStatus.IN_PRODUCTION, shortLabel: 'Printing' },
  { status: JobStatus.READY_FOR_RELEASE, shortLabel: 'Ready' },
  { status: JobStatus.COMPLETED, shortLabel: 'Done' },
];

function getStatusBadgeStyle(status: JobStatus): string {
  switch (status) {
    case JobStatus.PENDING_APPROVAL:
      return 'bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/45';
    case JobStatus.PENDING:
      return 'bg-[#F3F4F6] text-[#4B5563] border border-[#D1D5DB]';
    case JobStatus.IN_PRODUCTION:
      return 'bg-[#DBEAFE] text-[#1D4ED8] border border-[#60A5FA]';
    case JobStatus.READY_FOR_RELEASE:
      return 'bg-[#DCFCE7] text-[#166534] border border-[#4ADE80]';
    case JobStatus.FOR_ADMIN_CONFIRMATION:
      return 'bg-[#FFEDD5] text-[#9A3412] border border-[#FB923C]';
    case JobStatus.COMPLETED:
      return 'bg-[#ECFDF5] text-[#047857] border border-[#34D399]';
    case JobStatus.ARCHIVED:
      return 'bg-[#F1F5F9] text-[#475569] border border-[#94A3B8]';
  }
}

function getPaymentBadgeStyle(payment: PaymentStatus): string {
  switch (payment) {
    case PaymentStatus.PAID:
      return 'bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]';
    case PaymentStatus.DOWN_PAYMENT:
      return 'bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]';
    case PaymentStatus.UNPAID:
      return 'bg-[#FEE2E2] text-[#B91C1C] border border-[#FCA5A5]';
  }
}

function getStageGuidance(status: JobStatus, user: UserAccount): string {
  if (user.role === UserRole.VIEWER && !user.permissions.canUpdateStatus) {
    return 'OJT permissions are managed by your Admin.';
  }
  switch (status) {
    case JobStatus.PENDING_APPROVAL:
      return user.role === UserRole.ADMIN
        ? 'Submitted by branch staff. Approve to move it into the active production queue.'
        : 'Waiting for Admin approval before printing can begin.';
    case JobStatus.PENDING:
      return 'Order is queued. Click Start Printing once layout and materials are ready.';
    case JobStatus.IN_PRODUCTION:
      return 'Currently in production. Mark Ready for Pickup when finished and packed.';
    case JobStatus.READY_FOR_RELEASE:
      return user.role === UserRole.ADMIN
        ? 'Packed and waiting for pickup. Confirm & Archive once handed to the customer.'
        : 'Ready for customer pickup. Verify payment, then click Submit as Released.';
    case JobStatus.FOR_ADMIN_CONFIRMATION:
      return user.role === UserRole.ADMIN
        ? 'Marked released by branch staff. Confirm below to move this order to Completed Archive.'
        : 'Submitted for Admin sign-off. Admin will finalize and archive this order.';
    case JobStatus.COMPLETED:
      return 'Completed and archived. Reopen only if follow-up work is needed.';
    case JobStatus.ARCHIVED:
      return 'Archived without completion. This order is retained for reference only.';
  }
}

function getPrimaryNextStatus(status: JobStatus, user: UserAccount): JobStatus | null {
  const allowed = getAllowedNextStatuses(status, user);
  if (allowed.length === 0) return null;

  const preferredOrder: Record<JobStatus, JobStatus[]> = {
    [JobStatus.PENDING_APPROVAL]: [JobStatus.PENDING],
    [JobStatus.PENDING]: [JobStatus.IN_PRODUCTION],
    [JobStatus.IN_PRODUCTION]: [JobStatus.READY_FOR_RELEASE],
    [JobStatus.READY_FOR_RELEASE]:
      user.role === UserRole.ADMIN
        ? [JobStatus.COMPLETED]
        : [JobStatus.FOR_ADMIN_CONFIRMATION],
    [JobStatus.FOR_ADMIN_CONFIRMATION]: [JobStatus.COMPLETED],
    [JobStatus.COMPLETED]: [],
    [JobStatus.ARCHIVED]: [],
  };

  for (const candidate of preferredOrder[status]) {
    if (allowed.includes(candidate)) return candidate;
  }
  return null;
}

function getActionLabel(currentStatus: JobStatus, nextStatus: JobStatus): string {
  if (currentStatus === JobStatus.PENDING_APPROVAL && nextStatus === JobStatus.PENDING) {
    return 'Approve & Queue Order';
  }
  if (nextStatus === JobStatus.IN_PRODUCTION && currentStatus === JobStatus.PENDING) {
    return 'Start Printing';
  }
  if (nextStatus === JobStatus.READY_FOR_RELEASE && currentStatus === JobStatus.IN_PRODUCTION) {
    return 'Mark Ready for Pickup';
  }
  if (nextStatus === JobStatus.FOR_ADMIN_CONFIRMATION) {
    return 'Submit as Released';
  }
  if (nextStatus === JobStatus.COMPLETED) {
    return 'Confirm & Archive';
  }
  if (nextStatus === JobStatus.PENDING) {
    return 'Move Back to Queued';
  }
  if (nextStatus === JobStatus.IN_PRODUCTION) {
    return 'Return to Printing';
  }
  if (nextStatus === JobStatus.READY_FOR_RELEASE) {
    return 'Return to Ready';
  }
  return nextStatus;
}

function getPipelineIndex(status: JobStatus): number {
  switch (status) {
    case JobStatus.PENDING_APPROVAL:
      return -1;
    case JobStatus.PENDING:
      return 0;
    case JobStatus.IN_PRODUCTION:
      return 1;
    case JobStatus.READY_FOR_RELEASE:
    case JobStatus.FOR_ADMIN_CONFIRMATION:
      return 2;
    case JobStatus.COMPLETED:
    case JobStatus.ARCHIVED:
      return 3;
  }
}

type PendingDrawerConfirm =
  | { type: 'status'; nextStatus: JobStatus }
  | { type: 'resolve_warning' }
  | { type: 'save_payment' }
  | { type: 'save_details' }
  | { type: 'warning_note'; text: string }
  | { type: 'archive_order' };

export const JobOrderDrawer: React.FC<JobOrderDrawerProps> = ({
  order,
  user,
  onClose,
  onUpdateOrder,
  onAddNote,
}) => {
  const [noteText, setNoteText] = useState('');
  const [noteIsWarning, setNoteIsWarning] = useState(false);
  const [paymentNoteDraft, setPaymentNoteDraft] = useState(order.paymentNote);
  const [paymentStatusDraft, setPaymentStatusDraft] = useState<PaymentStatus>(order.paymentStatus);
  const [editingDetails, setEditingDetails] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'payment' | 'notes'>('overview');
  const [editDraft, setEditDraft] = useState({
    customerName: order.customerName,
    customerContact: order.customerContact,
    branch: order.branch,
    itemType: order.itemType,
    quantity: String(order.quantity),
    printDetails: order.printDetails,
    deadline: order.deadline,
  });
  const [pendingConfirm, setPendingConfirm] = useState<PendingDrawerConfirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowedStatuses = getAllowedNextStatuses(order.status, user);
  const primaryNextStatus = getPrimaryNextStatus(order.status, user);
  const secondaryStatuses = allowedStatuses.filter((s) => s !== primaryNextStatus);
  const urgency = getDeadlineUrgency(order);
  const pipelineIndex = getPipelineIndex(order.status);

  const hasPaymentChanges =
    paymentStatusDraft !== order.paymentStatus ||
    paymentNoteDraft.trim() !== order.paymentNote.trim();

  const runAction = async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = noteText.trim();
    if (!trimmed) return;
    if (noteIsWarning) {
      setPendingConfirm({ type: 'warning_note', text: trimmed });
      return;
    }
    await runAction(async () => {
      await onAddNote(order.id, trimmed, false);
      setNoteText('');
      setNoteIsWarning(false);
    });
  };

  const handleSavePaymentClick = () => {
    if (!hasPaymentChanges) return;
    setPendingConfirm({ type: 'save_payment' });
  };

  const handleSaveDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDraft.customerName.trim() || !editDraft.itemType.trim()) {
      setError('Customer name and item type are required.');
      return;
    }
    setError(null);
    setPendingConfirm({ type: 'save_details' });
  };

  const getDialogProps = (): {
    title: string;
    message: string;
    emphasis?: string[];
    cautions?: string[];
    confirmLabel: string;
    tone: ConfirmDialogTone;
  } | null => {
    if (!pendingConfirm) return null;

    switch (pendingConfirm.type) {
      case 'status':
        return {
          ...buildStatusTransitionConfirmation(order, pendingConfirm.nextStatus),
          emphasis: [order.jobNumber, order.customerName],
        };
      case 'resolve_warning':
        return {
          title: `Resolve warning on ${order.jobNumber}?`,
          message:
            'This clears the warning banner and removes the warning highlight from this order card across both branches.',
          emphasis: [order.jobNumber],
          confirmLabel: 'Resolve Warning',
          tone: 'primary',
        };
      case 'save_payment':
        return {
          title: `Save payment update for ${order.jobNumber}?`,
          message: `Update payment status to "${paymentStatusDraft}"${
            paymentNoteDraft.trim() ? ` with note "${paymentNoteDraft.trim()}"` : ''
          }.`,
          emphasis: [order.jobNumber, paymentStatusDraft, paymentNoteDraft.trim()],
          confirmLabel: 'Save Payment',
          tone: 'primary',
        };
      case 'save_details':
        return {
          title: `Save updated details for ${order.jobNumber}?`,
          message: `Apply changes for ${editDraft.customerName.trim()} (${
            Math.max(1, Number(editDraft.quantity) || 1)
          } pcs · ${editDraft.itemType.trim()} · ${editDraft.branch}, due ${formatFriendlyDate(
            editDraft.deadline,
          )}).`,
          emphasis: [editDraft.customerName.trim(), editDraft.itemType.trim(), editDraft.branch],
          confirmLabel: 'Save Details',
          tone: 'primary',
        };
      case 'warning_note':
        return {
          title: `Flag warning on ${order.jobNumber}?`,
          message: `This posts your note ("${pendingConfirm.text}") and highlights ${order.customerName}'s card as a warning for all staff.`,
          emphasis: [order.jobNumber, order.customerName, pendingConfirm.text],
          cautions: ['Warning highlights remain visible until manually resolved.'],
          confirmLabel: 'Post & Flag Warning',
          tone: 'warning',
        };
      case 'archive_order':
        return {
          title: `Archive ${order.jobNumber}?`,
          message: `Move ${order.customerName}'s order out of the active workflow without marking it as completed. The order will remain available in Archive.`,
          emphasis: [order.jobNumber, order.customerName],
          cautions: ['Archived orders are retained and cannot be deleted.'],
          confirmLabel: 'Archive Order',
          tone: 'warning',
        };
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingConfirm) return;
    const action = pendingConfirm;

    await runAction(async () => {
      switch (action.type) {
        case 'status':
          await onUpdateOrder(order.id, { status: action.nextStatus });
          break;
        case 'resolve_warning':
          await onUpdateOrder(order.id, { hasWarning: false, warningSummary: '' });
          break;
        case 'save_payment':
          await onUpdateOrder(order.id, {
            paymentStatus: paymentStatusDraft,
            paymentNote: paymentNoteDraft.trim(),
          });
          break;
        case 'save_details':
          await onUpdateOrder(order.id, {
            customerName: editDraft.customerName.trim(),
            customerContact: editDraft.customerContact.trim(),
            branch: editDraft.branch,
            itemType: editDraft.itemType.trim(),
            quantity: Math.max(1, Number(editDraft.quantity) || 1),
            printDetails: editDraft.printDetails.trim(),
            deadline: editDraft.deadline,
          });
          setEditingDetails(false);
          break;
        case 'warning_note':
          await onAddNote(order.id, action.text, true);
          setNoteText('');
          setNoteIsWarning(false);
          break;
        case 'archive_order':
          await onUpdateOrder(order.id, { status: JobStatus.ARCHIVED });
          setPendingConfirm(null);
          onClose();
          return;
      }
      setPendingConfirm(null);
    });
  };

  const dialogProps = getDialogProps();

  const customerInitial = order.customerName.trim().charAt(0).toUpperCase() || 'J';

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#1E162B]/55"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-jo-title"
    >
      <div className="w-full max-w-xl bg-[#F6F1F9] h-full overflow-hidden flex flex-col shadow-[0_24px_60px_rgba(30,22,43,0.26)]">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Sticky White Header */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#E8D6EF] flex items-center justify-between gap-2.5 sticky top-0 bg-white z-20">
            <div className="flex items-center gap-3 min-w-0">
              <div className="hidden sm:flex w-11 h-11 rounded-full bg-[#F2E4F7] text-[#6E3580] font-display text-base font-bold items-center justify-center shrink-0">
                {customerInitial}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#6E3580] tabular-nums whitespace-nowrap">
                    {order.jobNumber}
                  </span>
                  <span className="text-xs text-[#635573] whitespace-nowrap">· {order.branch}</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${getStatusBadgeStyle(
                      order.status,
                    )}`}
                  >
                    {order.status}
                  </span>
                </div>
                <h2
                  id="drawer-jo-title"
                  className="font-display text-base sm:text-xl font-bold text-[#1E162B] mt-0.5 truncate"
                >
                  {order.customerName}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close job order details"
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full text-[#635573] hover:bg-[#F2E4F7] hover:text-[#6E3580] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Floating Card Workspace */}
          <div className="p-4 sm:p-5 space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-2xl border border-[#FE4FAE]/45 bg-[#FFF2F9] px-4 py-3 text-sm font-medium text-[#C41D73]"
              >
                {error}
              </div>
            )}

            {order.hasWarning && (
              <div className="rounded-2xl border border-[#FE4FAE]/45 bg-[#FFF2F9] p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#FFE4F2] text-[#C41D73] flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#1E162B]">Warning Flagged</div>
                    <p className="text-sm text-[#C41D73] mt-0.5">
                      {order.warningSummary || 'Special concern noted on this job order.'}
                    </p>
                  </div>
                </div>
                {(user.role === UserRole.ADMIN || user.permissions.canFlagWarning) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setPendingConfirm({ type: 'resolve_warning' })}
                    className="min-h-[34px] px-3.5 py-1 rounded-full bg-white border border-[#FE4FAE]/45 text-xs font-semibold text-[#C41D73] hover:bg-[#FFE4F2] shrink-0 cursor-pointer"
                  >
                    Resolve Warning
                  </button>
                )}
              </div>
            )}

            {order.status === JobStatus.READY_FOR_RELEASE &&
              order.paymentStatus !== PaymentStatus.PAID && (
                <div className="rounded-2xl border border-[#FCBD30]/60 bg-[#FFF7E0] p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-[#9A6700] shrink-0 mt-0.5" />
                  <div className="text-sm text-[#1E162B]">
                    <span className="font-bold">Balance due before release:</span> Current
                    payment status is <strong>{order.paymentStatus}</strong>. Collect the
                    remaining balance before handing over items.
                  </div>
                </div>
              )}

            <nav
              aria-label="Job order detail sections"
              className="grid grid-cols-3 gap-1 rounded-2xl bg-[#EDE3F2] p-1.5"
            >
              {[
                { id: 'overview' as const, label: 'Overview' },
                { id: 'payment' as const, label: 'Payment' },
                { id: 'notes' as const, label: `Notes${order.notes.length ? ` (${order.notes.length})` : ''}` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveDetailTab(tab.id);
                    if (tab.id !== 'overview') setEditingDetails(false);
                  }}
                  aria-current={activeDetailTab === tab.id ? 'page' : undefined}
                  className={`min-h-[42px] rounded-xl px-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                    activeDetailTab === tab.id
                      ? 'bg-white text-[#6E3580] shadow-[0_2px_8px_rgba(30,22,43,0.10)]'
                      : 'text-[#635573] hover:bg-white/60 hover:text-[#6E3580]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {activeDetailTab === 'overview' && (
              <>
            <section className="bg-[#1E162B] rounded-2xl px-4 py-3.5 text-white shadow-[0_8px_24px_rgba(30,22,43,0.14)]">
              <div className="grid grid-cols-3 divide-x divide-white/15">
                <div className="pr-3 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#CF93D9]">Due</div>
                  <div className="mt-1 text-xs sm:text-sm font-bold truncate">{formatDeadlineRelative(order.deadline, order.status)}</div>
                </div>
                <div className="px-3 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#CF93D9]">Order</div>
                  <div className="mt-1 text-xs sm:text-sm font-bold truncate">{order.quantity} pcs</div>
                </div>
                <div className="pl-3 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#CF93D9]">Payment</div>
                  <div className="mt-1 text-xs sm:text-sm font-bold truncate">{order.paymentStatus}</div>
                </div>
              </div>
            </section>

            {/* Production workflow and basic job information are grouped together. */}
            <section className="bg-white rounded-2xl p-5 shadow-[0_8px_24px_rgba(30,22,43,0.05)] space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-bold text-[#1E162B]">
                    Production Stage
                  </h3>
                  <p className="text-xs text-[#635573] mt-0.5 leading-relaxed">
                    {getStageGuidance(order.status, user)}
                  </p>
                </div>
              </div>

              {/* Visual 4-Stage Pipeline Indicator */}
              <div className="grid grid-cols-4 gap-2 pt-1" aria-label="Order workflow stages">
                {PIPELINE_STAGES.map((stage, idx) => {
                  const isDone = pipelineIndex > idx;
                  const isActive = pipelineIndex === idx;
                  return (
                    <div key={stage.status} className="space-y-1.5">
                      <div
                        className={`h-2 rounded-full ${
                          isDone || isActive ? 'bg-[#6E3580]' : 'bg-[#F2E4F7]'
                        }`}
                      />
                      <div
                        className={`text-[11px] font-semibold flex items-center gap-1 ${
                          isActive
                            ? 'text-[#6E3580] font-bold'
                            : isDone
                            ? 'text-[#1E162B]'
                            : 'text-[#635573]'
                        }`}
                      >
                        {isDone && <Check className="w-3 h-3 text-[#6E3580] shrink-0" />}
                        <span className="truncate">{stage.shortLabel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Clear Primary Action + Optional Step-Back Actions */}
              {allowedStatuses.length > 0 && (
                <div className="pt-2 border-t border-[#E8D6EF] space-y-2.5">
                  {primaryNextStatus && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setPendingConfirm({ type: 'status', nextStatus: primaryNextStatus })}
                      className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#6E3580] text-white text-sm font-bold shadow-[0_6px_16px_rgba(30,22,43,0.18)] hover:bg-[#1E162B] transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {primaryNextStatus === JobStatus.COMPLETED ? (
                        <ShieldCheck className="w-4 h-4" />
                      ) : primaryNextStatus === JobStatus.PENDING &&
                        order.status === JobStatus.PENDING_APPROVAL ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                          <ArrowRight className="w-4 h-4 text-white" />
                      )}
                      <span>{getActionLabel(order.status, primaryNextStatus)}</span>
                    </button>
                  )}

                  {secondaryStatuses.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-[#635573]">Or move to:</span>
                      {secondaryStatuses.map((nextStatus) => (
                        <button
                          key={nextStatus}
                          type="button"
                          disabled={busy}
                          onClick={() => setPendingConfirm({ type: 'status', nextStatus })}
                          className="min-h-[34px] px-3.5 py-1 rounded-full bg-[#F2E4F7] text-xs font-semibold text-[#6E3580] hover:bg-[#E8D6EF] transition-colors cursor-pointer disabled:opacity-60"
                        >
                          {getActionLabel(order.status, nextStatus)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Section 2: Order Details (View or Inline Edit) */}
            <section className="bg-white rounded-2xl p-5 shadow-[0_8px_24px_rgba(30,22,43,0.05)]">
              {editingDetails ? (
                <form onSubmit={handleSaveDetailsSubmit} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base font-bold text-[#1E162B]">
                      Edit Order Details
                    </h3>
                    <span className="text-xs font-medium text-[#635573]">
                      Update fields and click Save
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-[#1E162B] mb-1">
                        Customer *
                      </label>
                      <input
                        type="text"
                        value={editDraft.customerName}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, customerName: e.target.value }))
                        }
                        required
                        className="w-full min-h-[42px] rounded-xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 py-2 text-sm text-[#1E162B] focus:bg-white focus:border-[#6E3580] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#1E162B] mb-1">
                        Contact
                      </label>
                      <input
                        type="text"
                        value={editDraft.customerContact}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, customerContact: e.target.value }))
                        }
                        className="w-full min-h-[42px] rounded-xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 py-2 text-sm text-[#1E162B] focus:bg-white focus:border-[#6E3580] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#1E162B] mb-1">
                        Item *
                      </label>
                      <input
                        type="text"
                        value={editDraft.itemType}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, itemType: e.target.value }))
                        }
                        required
                        className="w-full min-h-[42px] rounded-xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 py-2 text-sm text-[#1E162B] focus:bg-white focus:border-[#6E3580] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#1E162B] mb-1">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={editDraft.quantity}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, quantity: e.target.value }))
                        }
                        required
                        className="w-full min-h-[42px] rounded-xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 py-2 text-sm tabular-nums text-[#1E162B] focus:bg-white focus:border-[#6E3580] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#1E162B] mb-1">
                        Branch
                      </label>
                      <select
                        value={editDraft.branch}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, branch: e.target.value as Branch }))
                        }
                        className="w-full min-h-[42px] rounded-xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 py-2 text-sm text-[#1E162B] focus:bg-white focus:border-[#6E3580] focus:outline-none"
                      >
                        <option value={Branch.BRANCH_1}>Branch 1</option>
                        <option value={Branch.BRANCH_2}>Branch 2</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#1E162B] mb-1">
                        Deadline *
                      </label>
                      <input
                        type="date"
                        value={editDraft.deadline}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, deadline: e.target.value }))
                        }
                        required
                        className="w-full min-h-[42px] rounded-xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 py-2 text-sm tabular-nums text-[#1E162B] focus:bg-white focus:border-[#6E3580] focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1E162B] mb-1">
                      Print Specifications
                    </label>
                    <input
                      type="text"
                      value={editDraft.printDetails}
                      onChange={(e) =>
                        setEditDraft((d) => ({ ...d, printDetails: e.target.value }))
                      }
                      className="w-full min-h-[42px] rounded-xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 py-2 text-sm text-[#1E162B] focus:bg-white focus:border-[#6E3580] focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingDetails(false)}
                      className="min-h-[40px] px-4 py-2 rounded-full bg-[#F2E4F7] text-sm font-semibold text-[#6E3580] hover:bg-[#E8D6EF] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="min-h-[40px] px-5 py-2 rounded-full bg-[#6E3580] text-white text-sm font-semibold hover:bg-[#1E162B] cursor-pointer"
                    >
                      Save Details
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-3.5">
                  <h3 className="font-display text-base font-bold text-[#1E162B]">
                    Job Information
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-[#FBF8FD] p-3.5 flex items-start gap-3">
                      <Printer className="w-4 h-4 text-[#1E162B] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#635573]">
                          Item &amp; Quantity
                        </div>
                        <div className="text-sm font-bold text-[#1E162B] mt-0.5">
                          <span className="tabular-nums">{order.quantity} pcs</span> ·{' '}
                          {order.itemType}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#FBF8FD] p-3.5 flex items-start gap-3">
                      <CalendarClock
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          urgency === DeadlineUrgency.OVERDUE ||
                          urgency === DeadlineUrgency.DUE_TODAY
                            ? 'text-[#C41D73]'
                            : urgency === DeadlineUrgency.DUE_TOMORROW
                            ? 'text-[#9A6700]'
                            : 'text-[#6E3580]'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#635573]">
                          Deadline
                        </div>
                        <div
                          className={`text-sm font-bold mt-0.5 tabular-nums ${
                            urgency === DeadlineUrgency.OVERDUE ||
                            urgency === DeadlineUrgency.DUE_TODAY
                              ? 'text-[#C41D73]'
                              : urgency === DeadlineUrgency.DUE_TOMORROW
                              ? 'text-[#9A6700]'
                              : 'text-[#1E162B]'
                          }`}
                        >
                          {formatFriendlyDate(order.deadline)}{' '}
                          <span className="font-medium text-xs text-[#635573]">
                            ({formatDeadlineRelative(order.deadline, order.status)})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#FBF8FD] p-3.5 flex items-start gap-3">
                      <Phone className="w-4 h-4 text-[#6E3580] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#635573]">
                          Contact
                        </div>
                        <div className="text-sm font-semibold text-[#1E162B] mt-0.5 truncate">
                          {order.customerContact || 'Not provided'}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#FBF8FD] p-3.5 flex items-start gap-3">
                      <User className="w-4 h-4 text-[#6E3580] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#635573]">
                          Logged By
                        </div>
                        <div className="text-sm font-semibold text-[#1E162B] mt-0.5 truncate">
                          {order.createdByName}
                        </div>
                      </div>
                    </div>
                  </div>

                  {order.printDetails && (
                    <div className="rounded-xl bg-[#FBF8FD] p-3.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#635573]">
                        Print Specifications
                      </div>
                      <p className="text-sm text-[#1E162B] mt-1 leading-relaxed">
                        {order.printDetails}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>
              </>
            )}

            {activeDetailTab === 'payment' && (
            <section className="bg-white rounded-2xl p-5 shadow-[0_8px_24px_rgba(30,22,43,0.05)] space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-bold text-[#1E162B]">
                    Payment &amp; Balance
                  </h3>
                  <p className="text-xs text-[#635573] mt-0.5">
                    {user.permissions.canUpdatePayment
                      ? 'Choose a payment status or add a balance note, then click Save Payment.'
                      : 'Recorded payment status and balance note.'}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
                    hasPaymentChanges
                      ? 'bg-[#FFF7E0] text-[#9A6700] border border-[#FCBD30]/60'
                      : getPaymentBadgeStyle(order.paymentStatus)
                  }`}
                >
                  {hasPaymentChanges ? 'Unsaved changes' : order.paymentStatus}
                </span>
              </div>

              {user.permissions.canUpdatePayment ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-1 p-1 bg-[#F2E4F7] rounded-full">
                    {[PaymentStatus.UNPAID, PaymentStatus.DOWN_PAYMENT, PaymentStatus.PAID].map(
                      (ps) => (
                        <button
                          key={ps}
                          type="button"
                          onClick={() => setPaymentStatusDraft(ps)}
                          className={`min-h-[40px] py-2 px-2 sm:px-3 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap cursor-pointer ${
                            paymentStatusDraft === ps
                              ? 'bg-[#6E3580] text-white'
                              : 'text-[#1E162B] hover:text-[#6E3580]'
                          }`}
                        >
                          {ps}
                        </button>
                      ),
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      id="drawer-payment-note"
                      type="text"
                      value={paymentNoteDraft}
                      onChange={(e) => setPaymentNoteDraft(e.target.value)}
                      placeholder="Balance note (e.g. 50% GCash)..."
                      aria-label="Payment note"
                      className="flex-1 min-w-0 min-h-[44px] rounded-full border border-[#D8BBE4] bg-[#FBF8FD] px-4 py-2 text-sm text-[#1E162B] focus:bg-white focus:border-[#6E3580] focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={busy || !hasPaymentChanges}
                      onClick={handleSavePaymentClick}
                      className={`min-h-[44px] px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap shrink-0 ${
                        hasPaymentChanges
                          ? 'bg-[#6E3580] text-white hover:bg-[#1E162B] shadow-[0_6px_14px_rgba(30,22,43,0.18)] cursor-pointer'
                          : 'bg-[#F2E4F7] text-[#635573] cursor-default'
                      }`}
                    >
                      {hasPaymentChanges ? 'Save Payment' : 'Saved'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-[#FBF8FD] px-4 py-3 text-sm text-[#1E162B]">
                  <span className="font-bold">{order.paymentStatus}</span>
                  {order.paymentNote && (
                    <span className="text-[#635573]"> · {order.paymentNote}</span>
                  )}
                </div>
              )}
            </section>
            )}

            {activeDetailTab === 'notes' && (
            <section className="bg-white rounded-2xl p-5 shadow-[0_8px_24px_rgba(30,22,43,0.05)] space-y-3.5">
              <div>
                <h3 className="font-display text-base font-bold text-[#1E162B]">
                  Notes &amp; Concerns ({order.notes.length})
                </h3>
                <p className="text-xs text-[#635573] mt-0.5">
                  Leave shop reminders or flag urgent concerns so both branches see them.
                </p>
              </div>

              {user.permissions.canAddNotes && (
                <form onSubmit={handleNoteSubmit} className="space-y-2.5">
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Write a note or concern..."
                      aria-label="Add order note"
                      className="flex-1 min-w-0 min-h-[44px] rounded-full border border-[#D8BBE4] bg-[#FBF8FD] px-4 py-2 text-sm text-[#1E162B] focus:bg-white focus:border-[#6E3580] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={busy || !noteText.trim()}
                      className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-full bg-[#6E3580] text-white text-sm font-semibold hover:bg-[#1E162B] disabled:opacity-45 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Send className="w-4 h-4 text-[#CF93D9]" />
                      <span>Add Note</span>
                    </button>
                  </div>
                  {user.permissions.canFlagWarning && (
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FBF8FD] text-xs font-semibold text-[#C41D73] cursor-pointer hover:bg-[#FFF2F9]">
                      <input
                        type="checkbox"
                        checked={noteIsWarning}
                        onChange={(e) => setNoteIsWarning(e.target.checked)}
                        className="w-4 h-4 rounded border-[#FE4FAE] accent-[#FE4FAE] focus:ring-[#FE4FAE]"
                      />
                      <AlertTriangle className="w-3.5 h-3.5 text-[#FE4FAE]" />
                      <span>Flag as Warning (highlights order card)</span>
                    </label>
                  )}
                </form>
              )}

              {order.notes.length === 0 ? (
                <div className="rounded-xl bg-[#FBF8FD] px-4 py-3 text-xs text-[#635573]">
                  No notes yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {order.notes.map((n) => (
                    <div
                      key={n.id}
                      className={`rounded-xl border px-4 py-3 text-sm ${
                        n.isWarning
                          ? 'border-[#FE4FAE]/45 bg-[#FFF2F9]'
                          : 'border-[#E8D6EF] bg-[#FBF8FD]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#1E162B] text-xs">
                          {n.authorName}
                        </span>
                        {n.isWarning && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#C41D73]">
                            <AlertTriangle className="w-3 h-3 text-[#FE4FAE]" />
                            Warning
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[#1E162B] mt-1">{n.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
            )}
          </div>
        </div>

        {user.role === UserRole.ADMIN && !editingDetails && (
          <div className="px-6 py-4 border-t border-[#E8D6EF] bg-white flex items-center justify-between gap-3">
            {order.status !== JobStatus.COMPLETED && order.status !== JobStatus.ARCHIVED ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setPendingConfirm({ type: 'archive_order' })}
                className="min-h-[40px] inline-flex items-center gap-2 text-sm font-semibold text-[#635573] hover:text-[#1E162B] cursor-pointer disabled:opacity-60"
              >
                <Archive className="w-4 h-4" />
                <span>Archive Order</span>
              </button>
            ) : (
              <span className="text-xs font-medium text-[#635573]">Orders are retained in Archive and cannot be deleted.</span>
            )}
            <button
              type="button"
              onClick={() => {
                setActiveDetailTab('overview');
                setEditingDetails(true);
              }}
              className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F2E4F7] text-sm font-semibold text-[#6E3580] hover:bg-[#E8D6EF] cursor-pointer"
            >
              <Pencil className="w-4 h-4" />
              <span>Edit</span>
            </button>
          </div>
        )}
      </div>

      {dialogProps && (
        <ConfirmDialog
          open={Boolean(pendingConfirm)}
          title={dialogProps.title}
          message={dialogProps.message}
          emphasis={dialogProps.emphasis}
          cautions={dialogProps.cautions}
          confirmLabel={dialogProps.confirmLabel}
          tone={dialogProps.tone}
          busy={busy}
          onCancel={() => setPendingConfirm(null)}
          onConfirm={handleConfirmAction}
        />
      )}
    </div>
  );
};
