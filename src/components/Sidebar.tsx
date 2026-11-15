import React, { useState } from 'react';
import {
  Archive,
  ClipboardList,
  ClockAlert,
  LogOut,
  Menu,
  Users,
} from 'lucide-react';
import { UserRole, type UserAccount } from '../types/jobOrder';
import { ConfirmDialog } from './ConfirmDialog';

export type ActiveTab = 'active' | 'approvals' | 'archive' | 'staff';

interface SidebarProps {
  user: UserAccount;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onLogout: () => void;
  counts: {
    active: number;
    approvals: number;
    archive: number;
  };
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeTab,
  onSelectTab,
  onLogout,
  counts,
  mobileOpen,
  onCloseMobile,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const roleName =
    user.role === UserRole.ADMIN
      ? 'Owner / Admin'
      : user.role === UserRole.ATTENDANT
      ? 'Branch Attendant'
      : 'OJT';

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    count?: number;
    icon: React.FC<{ className?: string }>;
    visible: boolean;
  }> = [
    {
      id: 'active',
      label: 'Active Orders',
      count: counts.active,
      icon: ClipboardList,
      visible: true,
    },
    {
      id: 'approvals',
      label: 'Approvals',
      count: counts.approvals,
      icon: ClockAlert,
      visible: user.role === UserRole.ADMIN,
    },
    {
      id: 'archive',
      label: 'Archive',
      count: counts.archive,
      icon: Archive,
      visible: true,
    },
    {
      id: 'staff',
      label: 'Staff Access',
      icon: Users,
      visible: user.permissions.canManageUsers,
    },
  ];

  const initials = user.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  const renderAside = (isMobileDrawer: boolean) => {
    const isRail = !isMobileDrawer && collapsed;

    return (
      <aside
        className={`relative z-40 bg-white rounded-3xl flex flex-col h-full justify-between shadow-[0_12px_32px_rgba(30,22,43,0.07)] transition-all duration-200 overflow-visible ${
          isRail ? 'w-20' : 'w-64'
        }`}
      >
        <div>
          {/* Top Brand + Hamburger Toggle */}
          <div
            className={`pt-5 pb-4 flex items-center ${
              isRail ? 'justify-center px-3' : 'justify-between px-5'
            }`}
          >
            {!isRail && (
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-[#E8D6EF] bg-white shrink-0">
                  <img
                    src="/assets/aistudio/_0F9C15D7-CDDB-4FAE-8B34-4D6431FF4EF0__26f590ff.png"
                    alt="Easy-Ink Creations"
                    className="w-full h-full object-cover scale-[1.06]"
                  />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-lg font-bold text-[#1E162B] tracking-tight leading-tight truncate">
                    Easy-Ink
                  </div>
                </div>
              </div>
            )}

            {!isMobileDrawer && (
              <button
                type="button"
                onClick={() => setCollapsed((prev) => !prev)}
                aria-label={isRail ? 'Expand sidebar' : 'Collapse sidebar'}
                data-tooltip={isRail ? 'Expand sidebar' : 'Collapse sidebar'}
                className="w-10 h-10 rounded-full flex items-center justify-center text-[#6E3580] hover:bg-[#F2E4F7] transition-colors cursor-pointer shrink-0"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
          </div>

          <nav aria-label="Workspace Navigation" className="py-3 space-y-2">
            {navItems
              .filter((item) => item.visible)
              .map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-tooltip={isRail ? item.label : undefined}
                    data-tooltip-position={isRail ? 'right' : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => {
                      onSelectTab(item.id);
                      onCloseMobile();
                    }}
                    className={`relative mx-2 w-[calc(100%-1rem)] min-h-[50px] rounded-xl flex items-center transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap ${
                      isRail ? 'justify-center px-3' : 'justify-between px-6'
                    } ${
                      isActive
                        ? 'bg-[#F2E4F7] text-[#6E3580] shadow-[0_4px_12px_rgba(110,53,128,0.10)]'
                        : 'text-[#635573] hover:text-[#6E3580] hover:bg-[#FBF8FD]'
                    }`}
                  >
                    <span className="flex items-center gap-3.5 min-w-0">
                      <Icon
                        className={`w-5 h-5 shrink-0 ${
                          isActive ? 'text-[#6E3580]' : 'text-[#9A8BA8]'
                        }`}
                      />
                      {!isRail && (
                        <span
                          className={`text-[15px] truncate ${
                            isActive ? 'font-bold text-[#6E3580]' : 'font-medium'
                          }`}
                        >
                          {item.label}
                        </span>
                      )}
                    </span>

                    {!isRail && item.count !== undefined && (
                      <span
                        className={`text-xs tabular-nums px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-white text-[#6E3580] font-bold shadow-sm'
                            : 'text-[#635573] font-semibold'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
          </nav>
        </div>

        <div className={`p-4 border-t border-[#E8D6EF] space-y-3 ${isRail ? 'items-center flex flex-col' : ''}`}>
          <div className={isRail ? 'relative' : 'relative w-full'}>
          {!isRail ? (
            <button
              type="button"
              onClick={() => setProfileMenuOpen((open) => !open)}
              aria-expanded={profileMenuOpen}
              aria-label="Open account menu"
              className="w-full flex items-center gap-3 px-1 py-1 text-left hover:opacity-75 transition-opacity cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-[#1E162B] text-[#CF93D9] text-xs font-bold flex items-center justify-center shrink-0">
                {initials || 'EI'}
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[#1E162B] truncate">
                  {user.fullName}
                </span>
                <div className="text-xs text-[#635573] truncate">
                  {roleName} · {user.branch}
                </div>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setProfileMenuOpen((open) => !open)}
              aria-expanded={profileMenuOpen}
              aria-label="Open account menu"
              data-tooltip={`${user.fullName} (${roleName})`}
              data-tooltip-position="right"
              className="w-10 h-10 rounded-full bg-[#1E162B] text-[#CF93D9] text-xs font-bold flex items-center justify-center cursor-pointer"
            >
              {initials || 'EI'}
            </button>
          )}

          {profileMenuOpen && (
            <div className={`absolute z-50 rounded-2xl border border-[#E8D6EF] bg-white p-2 shadow-[0_12px_28px_rgba(30,22,43,0.16)] ${
              isRail ? 'bottom-0 left-full ml-3 w-36' : 'bottom-full left-0 right-0 mb-2'
            }`}>
              <button
                type="button"
                onClick={() => setConfirmSignOut(true)}
                className="w-full min-h-[40px] flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#6E3580] hover:bg-[#F2E4F7] transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
          </div>
        </div>
      </aside>
    );
  };

  return (
    <>
      <div className="hidden lg:block relative z-40 shrink-0 h-screen sticky top-0 p-4 pr-0">
        {renderAside(false)}
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex p-3">
          <div
            className="fixed inset-0 bg-[#1E162B]/45"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-50 h-full">{renderAside(true)}</div>
        </div>
      )}

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out of Easy-Ink?"
        message={`You are currently signed in as ${user.fullName} (${roleName}). Signing out will return you to the login screen.`}
        emphasis={[user.fullName, roleName]}
        confirmLabel="Sign Out"
        tone="primary"
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={() => {
          setConfirmSignOut(false);
          onLogout();
        }}
      />
    </>
  );
};
