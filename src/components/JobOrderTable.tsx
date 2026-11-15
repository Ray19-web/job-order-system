import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Printer,
} from 'lucide-react';
import {
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
  getDeadlineUrgency,
} from '../utils/jobOrderLogic';
import { ConfirmDialog } from './ConfirmDialog';

interface JobOrderTableProps {
  orders: JobOrder[];
  user: UserAccount;
  onSelectOrder: (order: JobOrder) => void;
  onQuickApprove?: (order: JobOrder) => void;
  onQuickConfirm?: (order: JobOrder) => void;
  emptyTitle: string;
  emptyDescription: string;
  onCreateClick?: () => void;
  resetKey?: string;
}

const PAGE_SIZE = 9;

function getRibbonMeta(status: JobStatus): {
  label: string;
  bg: string;
  text: string;
  fold: string;
} {
  switch (status) {
    case JobStatus.PENDING_APPROVAL:
      return {
        label: 'Approval',
        bg: 'bg-[#F59E0B]',
        text: 'text-white',
        fold: 'border-t-[#B45309]',
      };
    case JobStatus.PENDING:
      return {
        label: 'Pending',
        bg: 'bg-[#6B7280]',
        text: 'text-white',
        fold: 'border-t-[#4B5563]',
      };
    case JobStatus.IN_PRODUCTION:
      return {
        label: 'Printing',
        bg: 'bg-[#2563EB]',
        text: 'text-white',
        fold: 'border-t-[#1D4ED8]',
      };
    case JobStatus.READY_FOR_RELEASE:
      return {
        label: 'Ready',
        bg: 'bg-[#16A34A]',
        text: 'text-white',
        fold: 'border-t-[#15803D]',
      };
    case JobStatus.FOR_ADMIN_CONFIRMATION:
      return {
        label: 'Confirm',
        bg: 'bg-[#F97316]',
        text: 'text-white',
        fold: 'border-t-[#C2410C]',
      };
    case JobStatus.COMPLETED:
      return {
        label: 'Done',
        bg: 'bg-[#059669]',
        text: 'text-white',
        fold: 'border-t-[#047857]',
      };
    case JobStatus.ARCHIVED:
      return {
        label: 'Archived',
        bg: 'bg-[#64748B]',
        text: 'text-white',
        fold: 'border-t-[#475569]',
      };
  }
}

function getPaymentStyle(payment: PaymentStatus): string {
  switch (payment) {
    case PaymentStatus.PAID:
      return 'text-[#15803D] font-semibold';
    case PaymentStatus.DOWN_PAYMENT:
      return 'text-[#B45309] font-semibold';
    case PaymentStatus.UNPAID:
      return 'text-[#DC2626] font-semibold';
  }
}

function getInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : 'J';
}

export const JobOrderTable: React.FC<JobOrderTableProps> = ({
  orders,
  user,
  onSelectOrder,
  onQuickApprove,
  onQuickConfirm,
  emptyTitle,
  emptyDescription,
  onCreateClick,
  resetKey,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingQuickAction, setPendingQuickAction] = useState<{
    order: JobOrder;
    nextStatus: JobStatus.PENDING | JobStatus.COMPLETED;
  } | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [resetKey]);

  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedOrders = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return orders.slice(start, start + PAGE_SIZE);
  }, [orders, safePage]);

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center shadow-[0_10px_28px_rgba(30,22,43,0.06)]">
        <h3 className="font-display text-lg font-bold text-[#1E162B]">{emptyTitle}</h3>
        <p className="text-[15px] text-[#635573] mt-1.5">{emptyDescription}</p>
        {onCreateClick && user.permissions.canCreateOrder && (
          <button
            type="button"
            onClick={onCreateClick}
            className="mt-5 min-h-[44px] inline-flex items-center px-6 py-2.5 rounded-full bg-[#6E3580] text-white text-[15px] font-semibold hover:bg-[#1E162B] shadow-[0_6px_16px_rgba(30,22,43,0.18)] transition-colors cursor-pointer"
          >
            New Job Order
          </button>
        )}
      </div>
    );
  }

  const rangeStart = (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, orders.length);

  return (
    <div className="space-y-5">
      {/* Multi-Column Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 pr-1.5">
        {paginatedOrders.map((order) => {
          const urgency = getDeadlineUrgency(order);
          const relativeDeadline = formatDeadlineRelative(order.deadline, order.status);
          const ribbon = getRibbonMeta(order.status);
          const isCriticalCard =
            order.hasWarning || urgency === DeadlineUrgency.OVERDUE;
          const canQuickApprove =
            user.role === UserRole.ADMIN &&
            order.status === JobStatus.PENDING_APPROVAL &&
            Boolean(onQuickApprove);
          const canQuickConfirm =
            user.role === UserRole.ADMIN &&
            order.status === JobStatus.FOR_ADMIN_CONFIRMATION &&
            Boolean(onQuickConfirm);

          return (
            <article
              key={order.id}
              data-testid={`job-card-${order.jobNumber}`}
              role="button"
              tabIndex={0}
              aria-label={`Open ${order.jobNumber} for ${order.customerName}`}
              onClick={() => onSelectOrder(order)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectOrder(order);
                }
              }}
              className={`relative bg-white rounded-2xl p-6 min-h-[275px] flex flex-col justify-between cursor-pointer shadow-[0_10px_28px_rgba(30,22,43,0.06)] hover:shadow-[0_14px_34px_rgba(110,53,128,0.18)] hover:ring-2 hover:ring-[#6E3580]/45 focus:ring-2 focus:ring-[#6E3580] focus:outline-none active:ring-2 active:ring-[#6E3580] transition-all ${
                isCriticalCard ? 'ring-1 ring-[#FE4FAE]/45 bg-[#FFF2F9]' : ''
              }`}
            >
              <div className="absolute top-4 -right-1.5 z-10 pointer-events-none">
                <span
                  className={`block px-2.5 py-0.5 text-[11px] font-bold tracking-wide rounded-l-md rounded-tr-[2px] shadow-sm ${ribbon.text} ${ribbon.bg}`}
                >
                  {ribbon.label}
                </span>
                <span
                  aria-hidden="true"
                  className={`absolute -bottom-[5px] right-0 w-0 h-0 border-t-[5px] border-r-[6px] border-r-transparent ${ribbon.fold}`}
                />
              </div>

              <div className="w-full text-left flex-1 flex flex-col group">
                {/* Header: Circular Monogram + Customer Name + JO# */}
                <div className="flex items-center gap-3.5 pr-16">
                  <span className={`w-12 h-12 rounded-full flex items-center justify-center font-display text-base font-bold shrink-0 transition-colors ${
                    isCriticalCard ? 'bg-[#FFE4F2] text-[#C41D73]' : 'bg-[#F2E4F7] text-[#6E3580]'
                  }`}>
                    {getInitial(order.customerName)}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-[16.5px] font-bold text-[#1E162B] leading-snug truncate group-hover:text-[#6E3580] transition-colors">
                      {order.customerName}
                    </h3>
                  </div>
                </div>

                {/* Spacious Icon Metadata */}
                <div className="mt-5 space-y-2.5 text-[14px]">
                  <div className="flex items-center gap-2.5 text-[#635573] min-w-0">
                    <Printer className="w-4 h-4 text-[#1E162B] shrink-0" />
                    <span className="truncate"><span className="font-semibold text-[#1E162B] tabular-nums">{order.quantity} pcs</span> · {order.itemType}</span>
                  </div>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CalendarClock className={`w-4 h-4 shrink-0 ${urgency === DeadlineUrgency.OVERDUE || urgency === DeadlineUrgency.DUE_TODAY ? 'text-[#C41D73]' : urgency === DeadlineUrgency.DUE_TOMORROW ? 'text-[#B37400]' : 'text-[#6E3580]'}`} />
                    <span className="truncate"><span className={`font-semibold ${urgency === DeadlineUrgency.OVERDUE || urgency === DeadlineUrgency.DUE_TODAY ? 'text-[#C41D73]' : urgency === DeadlineUrgency.DUE_TOMORROW ? 'text-[#9A6700]' : 'text-[#1E162B]'}`}>{relativeDeadline}</span> <span className="text-[#635573] tabular-nums">({formatFriendlyDate(order.deadline)})</span></span>
                  </div>
                </div>

                {order.hasWarning && (
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#C41D73]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#FE4FAE]" />
                    <span>Warning flagged</span>
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3.5 border-t border-[#E8D6EF] flex items-center justify-between gap-2">
                <span className={`text-xs ${getPaymentStyle(order.paymentStatus)}`}>
                  {order.paymentStatus}
                </span>
                <div className="flex items-center gap-2">
                  {canQuickApprove && onQuickApprove && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setPendingQuickAction({
                          order,
                          nextStatus: JobStatus.PENDING,
                        });
                      }}
                      aria-label={`Approve ${order.jobNumber}`}
                      className="min-h-[34px] px-3.5 py-1 rounded-full bg-[#6E3580] text-white text-xs font-semibold hover:bg-[#1E162B] transition-colors cursor-pointer"
                    >
                      Approve
                    </button>
                  )}
                  {canQuickConfirm && onQuickConfirm && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setPendingQuickAction({
                          order,
                          nextStatus: JobStatus.COMPLETED,
                        });
                      }}
                      aria-label={`Confirm completion for ${order.jobNumber}`}
                      className="min-h-[34px] px-3.5 py-1 rounded-full bg-[#6E3580] text-white text-xs font-semibold hover:bg-[#1E162B] transition-colors cursor-pointer"
                    >
                      Confirm Done
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Bottom Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 flex-wrap pt-1">
          <div className="text-xs font-medium text-[#635573] tabular-nums">
            Showing {rangeStart}–{rangeEnd} of {orders.length} orders
          </div>

          <nav
            aria-label="Job orders pagination"
            className="inline-flex items-center gap-1 bg-white rounded-xl p-1 shadow-[0_6px_18px_rgba(30,22,43,0.06)]"
          >
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-[#635573] hover:text-[#6E3580] hover:bg-[#F2E4F7] disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>previous</span>
            </button>

            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => setCurrentPage(pageNum)}
                aria-current={safePage === pageNum ? 'page' : undefined}
                className={`min-w-[32px] min-h-[32px] px-2 rounded-lg text-xs font-bold tabular-nums transition-colors cursor-pointer ${
                  safePage === pageNum
                    ? 'bg-[#6E3580] text-white'
                    : 'text-[#1E162B] hover:bg-[#F2E4F7] hover:text-[#6E3580]'
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-[#1E162B] hover:text-[#6E3580] hover:bg-[#F2E4F7] disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
            >
              <span>next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </nav>
        </div>
      )}

      {pendingQuickAction && (() => {
        const meta = buildStatusTransitionConfirmation(
          pendingQuickAction.order,
          pendingQuickAction.nextStatus,
        );
        return (
          <ConfirmDialog
            open
            title={meta.title}
            message={meta.message}
            emphasis={[pendingQuickAction.order.jobNumber, pendingQuickAction.order.customerName]}
            cautions={meta.cautions}
            confirmLabel={meta.confirmLabel}
            tone={meta.tone}
            onCancel={() => setPendingQuickAction(null)}
            onConfirm={() => {
              const { order, nextStatus } = pendingQuickAction;
              setPendingQuickAction(null);
              if (nextStatus === JobStatus.PENDING) {
                onQuickApprove?.(order);
              } else {
                onQuickConfirm?.(order);
              }
            }}
          />
        );
      })()}
    </div>
  );
};
