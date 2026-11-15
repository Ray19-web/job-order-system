import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  X,
} from 'lucide-react';
import {
  Branch,
  PaymentStatus,
  UserRole,
  type NewJobOrderInput,
  type UserAccount,
} from '../types/jobOrder';
import {
  addDaysToDateString,
  formatFriendlyDate,
  getLocalDateString,
  validateJobOrderStep,
  validateNewJobOrder,
} from '../utils/jobOrderLogic';

interface JobOrderModalProps {
  user: UserAccount;
  onClose: () => void;
  onSubmit: (input: NewJobOrderInput) => Promise<void>;
}

type StepNumber = 1 | 2 | 3 | 4;

const STEPS: Array<{
  number: StepNumber;
  label: string;
  description: string;
}> = [
  { number: 1, label: 'Customer', description: 'Name, contact & branch' },
  { number: 2, label: 'Print Job', description: 'Item, qty & deadline' },
  { number: 3, label: 'Payment', description: 'Status, balance & notes' },
  { number: 4, label: 'Review', description: 'Confirm & submit order' },
];

export const JobOrderModal: React.FC<JobOrderModalProps> = ({
  user,
  onClose,
  onSubmit,
}) => {
  const defaultDeadline = addDaysToDateString(getLocalDateString(new Date()), 2);

  const [step, setStep] = useState<StepNumber>(1);
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [branch, setBranch] = useState<Branch>(user.branch);
  const [itemType, setItemType] = useState('');
  const [quantity, setQuantity] = useState<string>('1');
  const [printDetails, setPrintDetails] = useState('');
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(PaymentStatus.DOWN_PAYMENT);
  const [paymentNote, setPaymentNote] = useState('');
  const [initialNote, setInitialNote] = useState('');
  const [isWarning, setIsWarning] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const buildPayload = (): NewJobOrderInput => ({
    customerName: customerName.trim(),
    customerContact: customerContact.trim(),
    branch,
    itemType: itemType.trim(),
    quantity: Number(quantity),
    printDetails: printDetails.trim(),
    deadline,
    paymentStatus,
    paymentNote: paymentNote.trim(),
    initialNote: initialNote.trim(),
    isWarning,
  });

  const handleGoToStep = (targetStep: StepNumber) => {
    if (targetStep === step) return;
    if (targetStep < step) {
      setErrors([]);
      setStep(targetStep);
      return;
    }

    const payload = buildPayload();
    for (let s = step; s < targetStep; s += 1) {
      const stepErrors = validateJobOrderStep(s as StepNumber, payload);
      if (stepErrors.length > 0) {
        setStep(s as StepNumber);
        setErrors(stepErrors);
        return;
      }
    }

    setErrors([]);
    setStep(targetStep);
  };

  const handleNext = () => {
    const payload = buildPayload();
    const stepErrors = validateJobOrderStep(step, payload);
    if (stepErrors.length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors([]);
    setStep((prev) => (prev < 4 ? ((prev + 1) as StepNumber) : prev));
  };

  const handleBack = () => {
    setErrors([]);
    setStep((prev) => (prev > 1 ? ((prev - 1) as StepNumber) : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 4) {
      handleNext();
      return;
    }

    const payload = buildPayload();
    const validationErrors = validateNewJobOrder(payload);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    setSubmitting(true);
    try {
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Failed to create job order.']);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E162B]/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-jo-title"
    >
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-[0_24px_60px_rgba(30,22,43,0.24)]">
        {/* Header */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-[#E8D6EF] flex items-center justify-between sticky top-0 bg-white z-20">
          <div>
            <h2 id="new-jo-title" className="font-display text-lg sm:text-xl font-bold text-[#1E162B]">
              New Job Order
            </h2>
            <p className="text-xs font-medium text-[#635573] mt-0.5">
              Step {step} of {STEPS.length} — {STEPS[step - 1].label}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close new job order form"
            className="w-10 h-10 flex items-center justify-center rounded-full text-[#635573] hover:bg-[#F2E4F7] hover:text-[#6E3580] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[265px_1fr]">
          {/* Vertical Timeline Stepper */}
          <nav
            aria-label="Job order progress"
            className="px-3.5 py-3 md:p-5 bg-white border-b md:border-b-0 md:border-r border-[#E8D6EF]"
          >
            <ol className="flex flex-col">
              {STEPS.map((item, idx) => {
                const isCompleted = item.number < step;
                const isCurrent = item.number === step;
                const topConnected = idx > 0 && item.number <= step;
                const bottomConnected = idx < STEPS.length - 1 && item.number < step;

                return (
                  <li key={item.number} className="relative">
                    {idx > 0 && (
                      <span
                        aria-hidden="true"
                        className={`absolute left-[29px] top-0 h-[24px] md:h-[26px] w-[2px] ${
                          topConnected ? 'bg-[#6E3580]' : 'bg-[#E8D6EF]'
                        }`}
                      />
                    )}
                    {idx < STEPS.length - 1 && (
                      <span
                        aria-hidden="true"
                        className={`absolute left-[29px] top-[24px] md:top-[26px] bottom-0 w-[2px] ${
                          bottomConnected ? 'bg-[#6E3580]' : 'bg-[#E8D6EF]'
                        }`}
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => handleGoToStep(item.number)}
                      aria-current={isCurrent ? 'step' : undefined}
                      className={`relative z-10 w-full flex items-center gap-3.5 px-3.5 py-2 md:py-2.5 rounded-2xl text-left cursor-pointer ${
                        isCurrent
                          ? 'bg-[#FBF8FD] border border-[#CF93D9]'
                          : 'border border-transparent hover:bg-[#FBF8FD]'
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          isCompleted
                            ? 'bg-[#6E3580]'
                            : isCurrent
                            ? 'bg-white border-2 border-[#6E3580] ring-4 ring-[#CF93D9]/35'
                            : 'bg-white border-2 border-[#D8BBE4]'
                        }`}
                      >
                        <span
                          className={`rounded-full ${
                            isCompleted
                              ? 'w-2.5 h-2.5 bg-[#CF93D9]'
                              : isCurrent
                              ? 'w-2.5 h-2.5 bg-[#6E3580]'
                              : 'w-2 h-2 bg-[#9A8BA8]'
                          }`}
                        />
                      </span>

                      <span className="min-w-0">
                        <span
                          className={`block text-[14.5px] leading-snug ${
                            isCurrent
                              ? 'font-bold text-[#1E162B]'
                              : isCompleted
                              ? 'font-semibold text-[#1E162B]'
                              : 'font-semibold text-[#635573]'
                          }`}
                        >
                          {item.label}
                        </span>
                        <span
                          className={`block text-xs mt-0.5 truncate ${
                            isCurrent || isCompleted ? 'text-[#635573]' : 'text-[#9A8BA8]'
                          }`}
                        >
                          {item.description}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <form onSubmit={handleSubmit} noValidate className="p-5 sm:p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-5">
              {errors.length > 0 && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#FE4FAE]/45 bg-[#FFF2F9] px-4 py-3 text-sm text-[#C41D73] space-y-1"
                >
                  {errors.map((err) => (
                    <div key={err}>{err}</div>
                  ))}
                </div>
              )}

              {/* Step 1: Customer & Branch */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="jo-customer" className="block text-sm font-semibold text-[#1E162B] mb-1.5">
                      Customer Name *
                    </label>
                    <input
                      id="jo-customer"
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Barangay Mabini Youth Council"
                      autoFocus
                      className="w-full min-h-[46px] rounded-2xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 py-2.5 text-[15px] text-[#1E162B] focus:bg-white focus:border-[#6E3580] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="jo-contact" className="block text-sm font-semibold text-[#1E162B] mb-1.5">
                      Contact Number or Facebook
                    </label>
                    <input
                      id="jo-contact"
                      type="text"
                      value={customerContact}
                      onChange={(e) => setCustomerContact(e.target.value)}
                      placeholder="Optional phone or Messenger name"
                      className="w-full min-h-[46px] rounded-2xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 py-2.5 text-[15px] text-[#1E162B] focus:bg-white focus:border-[#6E3580] focus:outline-none"
                    />
                  </div>

                  <div>
                    <span className="block text-sm font-semibold text-[#1E162B] mb-1.5">
                      Branch *
                    </span>
                    <div className="grid grid-cols-2 gap-3" role="group" aria-label="Branch">
                      {([Branch.BRANCH_1, Branch.BRANCH_2] as const).map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setBranch(b)}
                          aria-pressed={branch === b}
                          className={`min-h-[46px] rounded-2xl border text-[15px] font-semibold transition-colors cursor-pointer ${
                            branch === b
                              ? 'border-[#6E3580] bg-[#F2E4F7] text-[#1E162B]'
                              : 'border-[#D8BBE4] bg-white text-[#1E162B] hover:bg-[#FBF8FD]'
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Print Job & Deadline */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label htmlFor="jo-item" className="block text-sm font-semibold text-[#1E162B] mb-1.5">
                        Item *
                      </label>
                      <input
                        id="jo-item"
                        type="text"
                        value={itemType}
                        onChange={(e) => setItemType(e.target.value)}
                        placeholder="T-Shirt, Jersey, Tarpaulin"
                        autoFocus
                        className="w-full min-h-[46px] rounded-2xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 py-2.5 text-[15px] text-[#1E162B] focus:bg-white focus:border-[#6E3580] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label htmlFor="jo-qty" className="block text-sm font-semibold text-[#1E162B] mb-1.5">
                        Quantity *
                      </label>
                      <input
                        id="jo-qty"
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-full min-h-[46px] rounded-2xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 py-2.5 text-[15px] tabular-nums text-[#1E162B] focus:bg-white focus:border-[#6E3580] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="jo-details" className="block text-sm font-semibold text-[#1E162B] mb-1.5">
                      Print Details
                    </label>
                    <input
                      id="jo-details"
                      type="text"
                      value={printDetails}
                      onChange={(e) => setPrintDetails(e.target.value)}
                      placeholder="Sizes, colors, front/back placement"
                      className="w-full min-h-[46px] rounded-2xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 py-2.5 text-[15px] text-[#1E162B] focus:bg-white focus:border-[#6E3580] focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="jo-deadline" className="block text-sm font-semibold text-[#1E162B]">
                        Deadline *
                      </label>
                      {deadline && /^\d{4}-\d{2}-\d{2}$/.test(deadline) && (
                        <span className="text-xs font-semibold text-[#6E3580]">
                          Due {formatFriendlyDate(deadline)}
                        </span>
                      )}
                    </div>
                    <input
                      id="jo-deadline"
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full min-h-[46px] rounded-2xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 py-2.5 text-[15px] tabular-nums text-[#1E162B] focus:bg-white focus:border-[#6E3580] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Payment & Notes */}
              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <span className="block text-sm font-semibold text-[#1E162B] mb-1.5">
                      Payment Status
                    </span>
                    <div className="grid grid-cols-3 gap-2.5" role="group" aria-label="Payment Status">
                      {([
                        PaymentStatus.UNPAID,
                        PaymentStatus.DOWN_PAYMENT,
                        PaymentStatus.PAID,
                      ] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setPaymentStatus(status)}
                          aria-pressed={paymentStatus === status}
                          className={`min-h-[46px] px-2.5 py-2 rounded-2xl border text-sm font-semibold transition-colors cursor-pointer ${
                            paymentStatus === status
                              ? 'border-[#6E3580] bg-[#F2E4F7] text-[#1E162B]'
                              : 'border-[#D8BBE4] bg-white text-[#1E162B] hover:bg-[#FBF8FD]'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="jo-payment-note" className="block text-sm font-semibold text-[#1E162B] mb-1.5">
                      Balance Note
                    </label>
                    <input
                      id="jo-payment-note"
                      type="text"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      placeholder="e.g. 50% DP via GCash, pay balance on pickup"
                      className="w-full min-h-[46px] rounded-2xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 py-2.5 text-[15px] text-[#1E162B] focus:bg-white focus:border-[#6E3580] focus:outline-none"
                    />
                  </div>

                  {user.permissions.canAddNotes && (
                    <div className="space-y-2.5 pt-1">
                      <label htmlFor="jo-initial-note" className="block text-sm font-semibold text-[#1E162B]">
                        Note / Special Concern
                      </label>
                      <input
                        id="jo-initial-note"
                        type="text"
                        value={initialNote}
                        onChange={(e) => setInitialNote(e.target.value)}
                        placeholder="Optional note or customer shirt damage concern"
                        className="w-full min-h-[46px] rounded-2xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 py-2.5 text-[15px] text-[#1E162B] focus:bg-white focus:border-[#6E3580] focus:outline-none"
                      />
                      {user.permissions.canFlagWarning && (
                        <label className="min-h-[44px] inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border border-[#FE4FAE]/45 bg-[#FFF2F9] text-sm font-semibold text-[#C41D73] cursor-pointer hover:bg-[#FFE4F2]">
                          <input
                            type="checkbox"
                            checked={isWarning}
                            onChange={(e) => setIsWarning(e.target.checked)}
                            className="w-4 h-4 rounded border-[#FE4FAE] accent-[#FE4FAE] focus:ring-[#FE4FAE]"
                          />
                          <AlertTriangle className="w-4 h-4 text-[#FE4FAE]" />
                          <span>Flag as Warning</span>
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Review & Confirm */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[#D8BBE4] bg-[#FBF8FD] divide-y divide-[#E8D6EF]">
                    <div className="p-4 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-[#635573]">
                          Customer &amp; Branch
                        </div>
                        <div className="text-base font-bold text-[#1E162B] mt-1">
                          {customerName.trim()}
                        </div>
                        <div className="text-sm text-[#635573] mt-0.5">
                          {branch}
                          {customerContact.trim() ? ` · ${customerContact.trim()}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleGoToStep(1)}
                        className="text-sm font-semibold text-[#6E3580] hover:underline cursor-pointer shrink-0"
                      >
                        Edit
                      </button>
                    </div>

                    <div className="p-4 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-[#635573]">
                          Print Job &amp; Deadline
                        </div>
                        <div className="text-base font-bold text-[#1E162B] mt-1">
                          {quantity} pcs · {itemType.trim()}
                        </div>
                        {printDetails.trim() && (
                          <div className="text-sm text-[#635573] mt-0.5">
                            {printDetails.trim()}
                          </div>
                        )}
                        <div className="text-sm font-semibold text-[#1E162B] mt-1">
                          Due {formatFriendlyDate(deadline)}{' '}
                          <span className="font-normal text-[#635573]">({deadline})</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleGoToStep(2)}
                        className="text-sm font-semibold text-[#6E3580] hover:underline cursor-pointer shrink-0"
                      >
                        Edit
                      </button>
                    </div>

                    <div className="p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-wide text-[#635573]">
                          Payment &amp; Notes
                        </div>
                        <div className="text-base font-bold text-[#1E162B] mt-1">
                          {paymentStatus}
                        </div>
                        {paymentNote.trim() && (
                          <div className="text-sm text-[#635573] mt-0.5">
                            {paymentNote.trim()}
                          </div>
                        )}
                        {(isWarning || initialNote.trim()) && (
                          <div
                            className={`mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold ${
                              isWarning ? 'text-[#C41D73]' : 'text-[#1E162B]'
                            }`}
                          >
                            {isWarning && <AlertTriangle className="w-4 h-4 shrink-0 text-[#FE4FAE]" />}
                            <span>
                              {initialNote.trim() || 'Warning flagged'}
                            </span>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleGoToStep(3)}
                        className="text-sm font-semibold text-[#6E3580] hover:underline cursor-pointer shrink-0"
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-[#635573]">
                    {user.role === UserRole.ADMIN
                      ? 'This job order will be added directly to Active Orders (Pending).'
                      : 'This job order will be submitted to Admin for approval before production.'}
                  </p>
                </div>
              )}
            </div>

            {/* Footer Navigation */}
            <div className="pt-4 border-t border-[#E8D6EF] flex items-center justify-between gap-3">
              {step === 1 ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-6 py-2.5 rounded-full bg-[#F2E4F7] text-[15px] font-semibold text-[#6E3580] hover:bg-[#E8D6EF] cursor-pointer"
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleBack}
                  className="min-h-[44px] inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#F2E4F7] text-[15px] font-semibold text-[#6E3580] hover:bg-[#E8D6EF] cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
              )}

              {step < 4 ? (
                <button
                  key="step-next-btn"
                  type="button"
                  onClick={handleNext}
                  className="min-h-[44px] inline-flex items-center gap-2 px-7 py-2.5 rounded-full bg-[#6E3580] text-white text-[15px] font-semibold hover:bg-[#1E162B] shadow-[0_6px_16px_rgba(30,22,43,0.18)] transition-colors cursor-pointer"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4 text-[#CF93D9]" />
                </button>
              ) : (
                <button
                  key="step-submit-btn"
                  type="submit"
                  disabled={submitting}
                  className="min-h-[44px] px-7 py-2.5 rounded-full bg-[#6E3580] text-white text-[15px] font-semibold hover:bg-[#1E162B] shadow-[0_6px_16px_rgba(30,22,43,0.18)] disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {submitting
                    ? 'Saving...'
                    : user.role === UserRole.ADMIN
                    ? 'Create Job Order'
                    : 'Submit for Approval'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
