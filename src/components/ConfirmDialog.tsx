import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, X } from 'lucide-react';

export type ConfirmDialogTone = 'primary' | 'dark' | 'warning' | 'danger';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  emphasis?: string[];
  cautions?: string[];
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  emphasis = [],
  cautions = [],
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy = false,
  onCancel,
  onConfirm,
}) => {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const iconWrapperClass =
    tone === 'danger'
      ? 'bg-[#FFE4F2] text-[#C41D73]'
      : tone === 'warning'
      ? 'bg-[#FFF7E0] text-[#9A6700]'
      : 'bg-[#F2E4F7] text-[#6E3580]';

  const confirmButtonClass =
    tone === 'danger'
      ? 'bg-[#FE4FAE] text-[#1E162B] font-bold hover:bg-[#C41D73] hover:text-white'
      : tone === 'dark'
      ? 'bg-[#6E3580] text-white font-bold hover:bg-[#1E162B]'
      : 'bg-[#6E3580] text-white font-semibold hover:bg-[#1E162B]';

  const messageParts = emphasis
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .reduce<React.ReactNode[]>((parts, phrase) => {
      const nextParts: React.ReactNode[] = [];
      parts.forEach((part) => {
        if (typeof part !== 'string') {
          nextParts.push(part);
          return;
        }
        const sections = part.split(phrase);
        sections.forEach((section, index) => {
          nextParts.push(section);
          if (index < sections.length - 1) {
            nextParts.push(
              <strong key={`${phrase}-${index}`} className="font-bold text-[#1E162B]">
                {phrase}
              </strong>,
            );
          }
        });
      });
      return nextParts;
    }, [message]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#1E162B]/60 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          onCancel();
        }
      }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-[0_24px_60px_rgba(30,22,43,0.28)] border border-[#E8D6EF] space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5 min-w-0">
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${iconWrapperClass}`}
            >
              {tone === 'danger' ? (
                <ShieldAlert className="w-5 h-5" />
              ) : tone === 'warning' ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0 pt-0.5">
              <h3
                id="confirm-dialog-title"
                className="font-display text-lg font-bold text-[#1E162B] leading-snug"
              >
                {title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#635573] hover:bg-[#F2E4F7] hover:text-[#6E3580] cursor-pointer shrink-0 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p
          id="confirm-dialog-message"
          className="text-sm text-[#635573] leading-relaxed"
        >
          {messageParts}
        </p>

        {cautions.length > 0 && (
          <div
            className={`rounded-2xl border p-3.5 space-y-1.5 text-xs font-medium ${
              tone === 'danger'
                ? 'border-[#FE4FAE]/45 bg-[#FFF2F9] text-[#C41D73]'
                : 'border-[#FCBD30]/60 bg-[#FFF7E0] text-[#1E162B]'
            }`}
          >
            {cautions.map((item) => (
              <div key={item} className="flex items-start gap-2">
                <AlertTriangle
                  className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                    tone === 'danger' ? 'text-[#FE4FAE]' : 'text-[#9A6700]'
                  }`}
                />
                <span>{item}</span>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-[42px] px-5 py-2 rounded-full bg-[#F2E4F7] text-sm font-semibold text-[#6E3580] hover:bg-[#E8D6EF] transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`min-h-[42px] px-5 py-2 rounded-full text-sm shadow-[0_6px_16px_rgba(30,22,43,0.18)] transition-colors cursor-pointer disabled:opacity-60 ${confirmButtonClass}`}
          >
            {busy ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
