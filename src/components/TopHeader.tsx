import React, { useState, useRef, useEffect } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  Menu,
  Plus,
} from 'lucide-react';
import type { NotificationItem, UserAccount } from '../types/jobOrder';
import { formatFriendlyDate } from '../utils/jobOrderLogic';

interface TopHeaderProps {
  title: string;
  user: UserAccount;
  notifications: NotificationItem[];
  readNotificationIds: string[];
  unreadNotificationCount: number;
  primaryActionLabel: string;
  showPrimaryAction: boolean;
  onOpenPrimaryAction: () => void;
  onSelectOrderFromNotification: (jobId: string) => void;
  onMarkNotificationRead: (notificationId: string) => void;
  onMarkAllNotificationsRead: () => void;
  onOpenMobileNav: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  title,
  user,
  notifications,
  readNotificationIds,
  unreadNotificationCount,
  primaryActionLabel,
  showPrimaryAction,
  onOpenPrimaryAction,
  onSelectOrderFromNotification,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onOpenMobileNav,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const sortedNotifications = [...notifications].sort((first, second) => {
    const firstUnread = !readNotificationIds.includes(first.id);
    const secondUnread = !readNotificationIds.includes(second.id);
    if (firstUnread !== secondUnread) return firstUnread ? -1 : 1;

    const newestFirst = Date.parse(second.createdAt) - Date.parse(first.createdAt);
    if (newestFirst !== 0) return newestFirst;
    return second.deadline.localeCompare(first.deadline);
  });

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [notifOpen]);

  return (
    <header className="sticky top-0 z-30 px-4 sm:px-6 pt-3 pb-2 bg-[#F6F1F9]/95 backdrop-blur-sm">
      <div className="bg-white rounded-3xl px-5 sm:px-6 h-18 flex items-center justify-between gap-4 shadow-[0_10px_28px_rgba(30,22,43,0.06)]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileNav}
            aria-label="Open navigation menu"
            className="lg:hidden w-11 h-11 flex items-center justify-center rounded-full text-[#6E3580] hover:bg-[#F2E4F7] cursor-pointer shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-[#1E162B] tracking-tight truncate">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="relative" ref={popoverRef}>
            <button
              type="button"
              onClick={() => setNotifOpen((prev) => !prev)}
              aria-expanded={notifOpen}
              aria-label={`Notifications (${unreadNotificationCount} unread)`}
              data-tooltip="Notifications"
              className={`relative w-11 h-11 inline-flex items-center justify-center rounded-full transition-colors cursor-pointer ${
                notifOpen
                  ? 'bg-[#6E3580] text-white'
                  : 'bg-[#FBF8FD] text-[#6E3580] hover:bg-[#F2E4F7]'
              }`}
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationCount > 0 && (
                <span
                  className="absolute -right-1 -top-1 min-w-5 h-5 px-1 inline-flex items-center justify-center rounded-full bg-[#FE4FAE] text-[#1E162B] text-[11px] font-bold tabular-nums ring-2 ring-white"
                >
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-white rounded-3xl shadow-[0_16px_40px_rgba(30,22,43,0.16)] z-30 overflow-hidden border border-[#E8D6EF]">
                <div className="px-5 py-4 border-b border-[#E8D6EF] flex items-center justify-between gap-3">
                  <div>
                    <span className="font-display text-base font-bold text-[#1E162B]">Notifications</span>
                    <span className="ml-2 text-xs font-semibold text-[#635573]">{unreadNotificationCount} unread</span>
                  </div>
                  <button
                    type="button"
                    disabled={unreadNotificationCount === 0}
                    onClick={onMarkAllNotificationsRead}
                    className="text-xs font-semibold text-[#6E3580] hover:text-[#1E162B] disabled:text-[#9A8BA8] disabled:cursor-default cursor-pointer"
                  >
                    Mark all read
                  </button>
                </div>

                <div className="max-h-96 overflow-y-auto divide-y divide-[#F6F1F9]">
                  {sortedNotifications.length === 0 ? (
                    <div className="p-6 text-center text-sm text-[#635573]">
                      No urgent deadlines or warnings.
                    </div>
                  ) : (
                    sortedNotifications.map((item) => {
                      const isUnread = !readNotificationIds.includes(item.id);
                      const isCritical = item.type === 'overdue' || item.type === 'warning';
                      const isTomorrow = item.type === 'due_tomorrow' || item.type === 'due_today';
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            onMarkNotificationRead(item.id);
                            onSelectOrderFromNotification(item.jobId);
                            setNotifOpen(false);
                          }}
                          className={`w-full text-left px-5 py-3.5 transition-colors flex items-start gap-3 cursor-pointer ${
                            isUnread ? 'bg-[#FBF8FD] hover:bg-[#F2E4F7]' : 'hover:bg-[#FBF8FD]'
                          }`}
                        >
                          <div
                            className={`mt-0.5 shrink-0 ${
                              isCritical
                                ? 'text-[#C41D73]'
                                : isTomorrow
                                ? 'text-[#B37400]'
                                : 'text-[#0284A8]'
                            }`}
                          >
                            {item.type === 'warning' || item.type === 'overdue' ? (
                              <AlertTriangle className="w-5 h-5" />
                            ) : item.type === 'approval' || item.type === 'confirmation' ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : (
                              <CalendarClock className="w-5 h-5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className={`text-sm text-[#1E162B] ${isUnread ? 'font-bold' : 'font-medium'}`}>
                              {item.title}
                            </div>
                            <div className="text-sm text-[#635573] mt-0.5 truncate">
                              {item.customerName} · {formatFriendlyDate(item.deadline)}
                            </div>
                          </div>
                          {isUnread && <span className="mt-1.5 w-2 h-2 rounded-full bg-[#6E3580] shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {showPrimaryAction && (
            <button
              type="button"
              onClick={onOpenPrimaryAction}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full bg-[#6E3580] text-white text-sm sm:text-[15px] font-semibold hover:bg-[#1E162B] shadow-[0_6px_16px_rgba(30,22,43,0.18)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 text-[#CF93D9]" />
              <span className="sm:hidden">Add</span>
              <span className="hidden sm:inline">{primaryActionLabel}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
