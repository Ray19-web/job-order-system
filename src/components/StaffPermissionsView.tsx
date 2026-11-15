import React, { useState } from 'react';
import { ArrowDownUp, ChevronLeft, ChevronRight, Eye, MoreVertical, Search, SlidersHorizontal, UserPlus, UserX, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  Branch,
  UserRole,
  type UserAccount,
  type UserPermissions,
} from '../types/jobOrder';
import { ConfirmDialog, type ConfirmDialogTone } from './ConfirmDialog';

interface StaffPermissionsViewProps {
  users: UserAccount[];
  currentUser: UserAccount;
  addStaffOpen: boolean;
  onCloseAddStaff: () => void;
  onCreateUser: (input: {
    username: string;
    password: string;
    fullName: string;
    role: UserRole;
    branch: Branch;
  }) => Promise<void>;
  onUpdateUser: (
    id: string,
    patch: {
      role?: UserRole;
      branch?: Branch;
      active?: boolean;
      password?: string;
      permissions?: Partial<UserPermissions>;
    },
  ) => Promise<void>;
}

const ATTENDANT_PERMISSION_LABELS: Array<{
  key: keyof UserPermissions;
  label: string;
}> = [
  { key: 'canCreateOrder', label: 'Add Walk-in Orders' },
  { key: 'canUpdateStatus', label: 'Update Status' },
  { key: 'canUpdatePayment', label: 'Update Payment' },
  { key: 'canAddNotes', label: 'Add Notes' },
  { key: 'canFlagWarning', label: 'Flag Warnings' },
  { key: 'canSubmitCompletion', label: 'Submit Done' },
];

type PendingStaffAction =
  | { type: 'create' }
  | { type: 'configuration'; user: UserAccount; role: UserRole; branch: Branch; permissions: UserPermissions }
  | { type: 'role'; user: UserAccount; nextRole: UserRole }
  | { type: 'branch'; user: UserAccount; nextBranch: Branch }
  | { type: 'active'; user: UserAccount; nextActive: boolean }
  | {
      type: 'permission';
      user: UserAccount;
      permKey: keyof UserPermissions;
      permLabel: string;
      nextValue: boolean;
    };

function formatRoleLabel(role: UserRole): string {
  switch (role) {
    case UserRole.ADMIN:
      return 'Admin';
    case UserRole.ATTENDANT:
      return 'Attendant';
    case UserRole.VIEWER:
      return 'OJT';
  }
}

export const StaffPermissionsView: React.FC<StaffPermissionsViewProps> = ({
  users,
  currentUser,
  addStaffOpen,
  onCloseAddStaff,
  onCreateUser,
  onUpdateUser,
}) => {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.ATTENDANT);
  const [branch, setBranch] = useState<Branch>(Branch.BRANCH_1);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingStaffAction | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [viewStaffId, setViewStaffId] = useState<string | null>(null);
  const [staffDraft, setStaffDraft] = useState<{
    role: UserRole;
    branch: Branch;
    permissions: UserPermissions;
  } | null>(null);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [staffFilterOpen, setStaffFilterOpen] = useState(false);
  const [staffSort, setStaffSort] = useState<'name' | 'role' | 'branch'>('name');
  const [staffPage, setStaffPage] = useState(1);
  const viewedAccount = users.find((account) => account.id === viewStaffId) ?? null;
  const visibleUsers = users.filter((account) => {
    const query = staffSearch.trim().toLowerCase();
    const matchesSearch = !query || [account.fullName, account.username, account.branch, formatRoleLabel(account.role)]
      .some((value) => value.toLowerCase().includes(query));
    const matchesStatus = staffStatusFilter === 'all'
      || (staffStatusFilter === 'active' && account.active)
      || (staffStatusFilter === 'inactive' && !account.active);
    return matchesSearch && matchesStatus;
  });
  const sortedUsers = [...visibleUsers].sort((first, second) => {
    if (staffSort === 'role') return formatRoleLabel(first.role).localeCompare(formatRoleLabel(second.role));
    if (staffSort === 'branch') return first.branch.localeCompare(second.branch);
    return first.fullName.localeCompare(second.fullName);
  });
  const staffPageSize = 9;
  const staffPageCount = Math.max(1, Math.ceil(sortedUsers.length / staffPageSize));
  const currentStaffPage = Math.min(staffPage, staffPageCount);
  const paginatedUsers = sortedUsers.slice(
    (currentStaffPage - 1) * staffPageSize,
    currentStaffPage * staffPageSize,
  );
  const visibleStart = sortedUsers.length === 0 ? 0 : (currentStaffPage - 1) * staffPageSize + 1;
  const visibleEnd = Math.min(currentStaffPage * staffPageSize, sortedUsers.length);

  const openStaffView = (account: UserAccount) => {
    setViewStaffId(account.id);
    setStaffDraft({ role: account.role, branch: account.branch, permissions: { ...account.permissions } });
    setResetPasswordOpen(false);
    setNewPassword('');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!fullName.trim() || !username.trim() || password.trim().length < 4) {
      setFormError('Full name, username, and a password of at least 4 characters are required.');
      return;
    }
    setPendingAction({ type: 'create' });
  };

  const getDialogProps = (): {
    title: string;
    message: string;
    emphasis?: string[];
    cautions?: string[];
    confirmLabel: string;
    tone: ConfirmDialogTone;
  } | null => {
    if (!pendingAction) return null;

    switch (pendingAction.type) {
      case 'create':
        return {
          title: `Create account for ${fullName.trim()}?`,
          message: `Add @${username.trim().toLowerCase()} as ${formatRoleLabel(role)} at ${branch}.`,
          emphasis: [`@${username.trim().toLowerCase()}`, formatRoleLabel(role), branch],
          cautions:
            role === UserRole.ADMIN
              ? ['Admin accounts have full owner access, including staff management and order deletion.']
              : undefined,
          confirmLabel: 'Create Account',
          tone: role === UserRole.ADMIN ? 'warning' : 'primary',
        };
      case 'configuration':
        return {
          title: `Save changes for ${pendingAction.user.fullName}?`,
          message: `Apply the updated role, branch, and permissions for @${pendingAction.user.username}.`,
          emphasis: [pendingAction.user.fullName, `@${pendingAction.user.username}`],
          confirmLabel: 'Save Changes',
          tone: 'primary',
        };
      case 'role':
        return {
          title: `Change ${pendingAction.user.fullName}'s role to ${formatRoleLabel(pendingAction.nextRole)}?`,
          message: `Update @${pendingAction.user.username} from ${formatRoleLabel(
            pendingAction.user.role,
          )} to ${formatRoleLabel(pendingAction.nextRole)}.`,
          emphasis: [
            `@${pendingAction.user.username}`,
            formatRoleLabel(pendingAction.user.role),
            formatRoleLabel(pendingAction.nextRole),
          ],
          cautions:
            pendingAction.nextRole === UserRole.ADMIN
              ? ['Promoting to Admin grants full access to approve, archive, delete orders, and manage staff.']
              : undefined,
          confirmLabel: 'Change Role',
          tone: pendingAction.nextRole === UserRole.ADMIN ? 'warning' : 'primary',
        };
      case 'branch':
        return {
          title: `Move ${pendingAction.user.fullName} to ${pendingAction.nextBranch}?`,
          message: `Reassign @${pendingAction.user.username} from ${pendingAction.user.branch} to ${pendingAction.nextBranch}.`,
          emphasis: [`@${pendingAction.user.username}`, pendingAction.user.branch, pendingAction.nextBranch],
          confirmLabel: 'Change Branch',
          tone: 'primary',
        };
      case 'active':
        return {
          title: `${pendingAction.nextActive ? 'Reactivate' : 'Disable'} ${pendingAction.user.fullName}'s account?`,
          message: pendingAction.nextActive
            ? `Allow @${pendingAction.user.username} to sign in again.`
            : `Prevent @${pendingAction.user.username} from signing in until reactivated.`,
          emphasis: [`@${pendingAction.user.username}`],
          confirmLabel: pendingAction.nextActive ? 'Reactivate Account' : 'Disable Account',
          tone: pendingAction.nextActive ? 'primary' : 'warning',
        };
      case 'permission':
        return {
          title: `${pendingAction.nextValue ? 'Grant' : 'Remove'} "${pendingAction.permLabel}" permission?`,
          message: `${
            pendingAction.nextValue ? 'Allow' : 'Disallow'
          } ${pendingAction.user.fullName} (@${pendingAction.user.username}) to ${pendingAction.permLabel.toLowerCase()}.`,
          emphasis: [pendingAction.user.fullName, `@${pendingAction.user.username}`, pendingAction.permLabel.toLowerCase()],
          confirmLabel: pendingAction.nextValue ? 'Grant Permission' : 'Remove Permission',
          tone: 'primary',
        };
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    const action = pendingAction;
    setSaving(true);
    setFormError(null);
    try {
      switch (action.type) {
        case 'create':
          await onCreateUser({
            fullName: fullName.trim(),
            username: username.trim().toLowerCase(),
            password: password.trim(),
            role,
            branch,
          });
          setFullName('');
          setUsername('');
          setPassword('');
          onCloseAddStaff();
          break;
        case 'configuration':
          await onUpdateUser(action.user.id, {
            role: action.role,
            branch: action.branch,
            permissions: action.permissions,
          });
          break;
        case 'role':
          await onUpdateUser(action.user.id, { role: action.nextRole });
          break;
        case 'branch':
          await onUpdateUser(action.user.id, { branch: action.nextBranch });
          break;
        case 'active':
          await onUpdateUser(action.user.id, { active: action.nextActive });
          break;
        case 'permission':
          await onUpdateUser(action.user.id, {
            permissions: { [action.permKey]: action.nextValue },
          });
          break;
      }
      setPendingAction(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update staff account.');
      setPendingAction(null);
    } finally {
      setSaving(false);
    }
  };

  const dialogProps = getDialogProps();

  return (
    <div className="space-y-6">
      {addStaffOpen && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E162B]/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-staff-title"
          onClick={(event) => {
            if (event.target === event.currentTarget && !saving) onCloseAddStaff();
          }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-[0_24px_60px_rgba(30,22,43,0.28)]">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2.5">
                <UserPlus className="w-5 h-5 text-[#6E3580]" />
                <h2 id="add-staff-title" className="font-display text-lg font-bold text-[#1E162B]">
                  Add Staff Account
                </h2>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={onCloseAddStaff}
                aria-label="Close add staff form"
                className="w-9 h-9 rounded-full flex items-center justify-center text-[#635573] hover:bg-[#F2E4F7] hover:text-[#6E3580] cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

        {formError && (
          <div role="alert" className="mb-4 rounded-2xl border border-[#FE4FAE]/45 bg-[#FFF2F9] px-4 py-3 text-sm text-[#C41D73]">
            {formError}
          </div>
        )}

        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label htmlFor="staff-fullname" className="block text-sm font-semibold text-[#1E162B] mb-1">
              Full Name
            </label>
            <input
              id="staff-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Carlo Cruz"
              required
              className="w-full min-h-[44px] rounded-xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 py-2 text-[15px] text-[#1E162B] focus:bg-white focus:border-[#6E3580] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="staff-username" className="block text-sm font-semibold text-[#1E162B] mb-1">
              Username
            </label>
            <input
              id="staff-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="carlo"
              required
              className="w-full min-h-[44px] rounded-xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 py-2 text-[15px] text-[#1E162B] focus:bg-white focus:border-[#6E3580] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="staff-password" className="block text-sm font-semibold text-[#1E162B] mb-1">
              Password
            </label>
            <input
              id="staff-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 4 chars"
              required
              className="w-full min-h-[44px] rounded-xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 py-2 text-[15px] text-[#1E162B] focus:bg-white focus:border-[#6E3580] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="staff-role" className="block text-sm font-semibold text-[#1E162B] mb-1">
              Role
            </label>
            <select
              id="staff-role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full min-h-[44px] rounded-xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 py-2 text-[15px] text-[#1E162B] focus:bg-white focus:border-[#6E3580] focus:outline-none"
            >
              <option value={UserRole.ATTENDANT}>Attendant</option>
              <option value={UserRole.VIEWER}>OJT</option>
              <option value={UserRole.ADMIN}>Admin</option>
            </select>
          </div>

          <div>
            <label htmlFor="staff-branch" className="block text-sm font-semibold text-[#1E162B] mb-1">
              Branch
            </label>
            <select
              id="staff-branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value as Branch)}
              className="w-full min-h-[44px] rounded-xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 py-2 text-[15px] text-[#1E162B] focus:bg-white focus:border-[#6E3580] focus:outline-none"
            >
              <option value={Branch.BRANCH_1}>Branch 1</option>
              <option value={Branch.BRANCH_2}>Branch 2</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-full bg-[#6E3580] text-white text-[15px] font-semibold hover:bg-[#1E162B] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
          >
            {saving ? 'Adding...' : 'Add Staff'}
          </button>
            </form>
          </div>
        </div>,
        document.body,
      )}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 px-1">
          <h2 className="font-display text-lg font-bold text-[#1E162B]">
            Staff accounts
          </h2>
          <span className="text-sm text-[#635573]">{visibleUsers.length} staff member{visibleUsers.length === 1 ? '' : 's'}</span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#6E3580]" />
            <input
              type="search"
              value={staffSearch}
              onChange={(event) => {
                setStaffSearch(event.target.value);
                setStaffPage(1);
              }}
              placeholder="Search staff name or username..."
              className="min-h-[44px] w-full rounded-full border border-transparent bg-white py-2 pl-11 pr-4 text-sm text-[#1E162B] shadow-[0_6px_18px_rgba(30,22,43,0.05)] placeholder:text-[#635573] focus:border-[#D8BBE4] focus:outline-none"
            />
          </div>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setStaffFilterOpen((open) => !open)}
              aria-label="Filter staff accounts"
              aria-expanded={staffFilterOpen}
              data-tooltip="Filter staff accounts"
              className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold shadow-[0_6px_18px_rgba(30,22,43,0.05)] cursor-pointer ${
                staffFilterOpen || staffStatusFilter !== 'active'
                  ? 'bg-[#6E3580] text-white'
                  : 'bg-white text-[#6E3580] hover:bg-[#F2E4F7]'
              }`}
            >
              <SlidersHorizontal className="h-4.5 w-4.5" />
              <span>Filter</span>
            </button>
            {staffFilterOpen && (
              <div className="absolute right-0 z-30 mt-2 w-44 rounded-2xl border border-[#E8D6EF] bg-white p-2 shadow-[0_12px_30px_rgba(30,22,43,0.16)]">
                {([
                  ['active', 'Active'],
                  ['inactive', 'Inactive'],
                  ['all', 'All staff'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setStaffStatusFilter(value);
                      setStaffPage(1);
                      setStaffFilterOpen(false);
                    }}
                    className={`min-h-[38px] w-full rounded-xl px-3 text-left text-sm font-semibold cursor-pointer ${
                      staffStatusFilter === value
                        ? 'bg-[#F2E4F7] text-[#6E3580]'
                        : 'text-[#1E162B] hover:bg-[#FBF8FD]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            data-tooltip={`Sort staff: ${staffSort === 'name' ? 'Name' : staffSort === 'role' ? 'Role' : 'Branch'}`}
            aria-label="Change staff sorting"
            onClick={() => {
              setStaffSort((sort) => (sort === 'name' ? 'role' : sort === 'role' ? 'branch' : 'name'));
              setStaffPage(1);
            }}
            className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-full border border-[#D8BBE4] bg-white text-[#6E3580] hover:bg-[#F2E4F7] cursor-pointer"
          >
            <ArrowDownUp className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="rounded-3xl bg-white border border-[#E8D6EF] shadow-[0_8px_22px_rgba(30,22,43,0.05)] overflow-visible">
          <div className="rounded-t-3xl bg-[#FBF8FD] px-6 py-4">
            <div className="grid w-full grid-cols-[2fr_1fr_1fr_1.5fr_72px] items-center gap-x-4 text-xs font-semibold uppercase tracking-wide text-[#635573]">
              <span>Staff member</span>
              <span>Role</span>
              <span>Branch</span>
              <span>Permissions</span>
              <span className="text-center">Actions</span>
            </div>
          </div>
          <div className="divide-y divide-[#E8D6EF]">
            {paginatedUsers.map((acct) => {
              const isSelf = acct.id === currentUser.id;
              const enabledPermissionCount = ATTENDANT_PERMISSION_LABELS.filter(
                (permission) => acct.permissions[permission.key],
              ).length;
              return (
                <div
                  key={acct.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`View ${acct.fullName}`}
                  onClick={() => openStaffView(acct)}
                  onKeyDown={(event) => {
                    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      openStaffView(acct);
                    }
                  }}
                  className="cursor-pointer px-6 py-5 hover:bg-[#FBF8FD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#6E3580] transition-colors"
                >
                  <div className="grid w-full grid-cols-[2fr_1fr_1fr_1.5fr_72px] items-center gap-x-4">
                    <div className="min-w-0">
                      <div className="font-bold text-[#1E162B]">{acct.fullName}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-sm text-[#635573]">
                        <span>@{acct.username}</span>
                        <span className={`h-1.5 w-1.5 rounded-full ${acct.active ? 'bg-[#16A34A]' : 'bg-[#9A8BA8]'}`} />
                        <span>{acct.active ? 'Active' : 'Disabled'}</span>
                      </div>
                  </div>
                  <span className="min-w-0 text-sm font-semibold text-[#1E162B]">{formatRoleLabel(acct.role)}</span>
                  <span className="min-w-0 text-sm text-[#1E162B]">{acct.branch}</span>
                  <span className="min-w-0 text-sm text-[#635573]">
                    {acct.role === UserRole.ADMIN
                      ? 'Full access'
                      : `${enabledPermissionCount} of ${ATTENDANT_PERMISSION_LABELS.length} enabled`}
                  </span>
                    <div className="relative flex justify-center">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenActionMenuId((current) => (current === acct.id ? null : acct.id));
                          }}
                          aria-label={`Actions for ${acct.fullName}`}
                          aria-expanded={openActionMenuId === acct.id}
                          data-tooltip={`Actions for ${acct.fullName}`}
                          className="h-9 w-9 inline-flex items-center justify-center rounded-full text-[#635573] hover:bg-[#F2E4F7] hover:text-[#6E3580] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </button>
                        {openActionMenuId === acct.id && (
                          <div
                            className="absolute right-0 top-10 z-30 w-44 rounded-xl border border-[#E8D6EF] bg-white p-1.5 text-left shadow-[0_12px_30px_rgba(30,22,43,0.16)]"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenActionMenuId(null);
                                openStaffView(acct);
                              }}
                              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#1E162B] hover:bg-[#FBF8FD] cursor-pointer"
                            >
                              <Eye className="h-4 w-4 text-[#6E3580]" />
                              View
                            </button>
                            {!isSelf && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenActionMenuId(null);
                                  setPendingAction({ type: 'active', user: acct, nextActive: !acct.active });
                                }}
                                className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold cursor-pointer disabled:opacity-60 ${
                                  acct.active ? 'text-[#C41D73] hover:bg-[#FFF2F9]' : 'text-[#15803D] hover:bg-[#ECFDF3]'
                                }`}
                              >
                                <UserX className="h-4 w-4" />
                                {acct.active ? 'Deactivate account' : 'Reactivate account'}
                              </button>
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              );
            })}
            {visibleUsers.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-[#635573]">
                No staff accounts match this search or filter.
              </div>
            )}
          </div>
        </div>

        {visibleUsers.length > 0 && (
          <div className="flex flex-col gap-3 px-1 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#635573]">
              Showing {visibleStart}–{visibleEnd} of {visibleUsers.length} staff accounts
            </p>
            <nav aria-label="Staff account pages" className="inline-flex items-center self-start rounded-2xl bg-white p-1.5 shadow-[0_6px_18px_rgba(30,22,43,0.05)] sm:self-auto">
              <button
                type="button"
                disabled={currentStaffPage === 1}
                onClick={() => setStaffPage((page) => Math.max(1, page - 1))}
                className="h-9 px-2.5 inline-flex items-center gap-1 rounded-xl text-sm font-semibold text-[#635573] hover:bg-[#FBF8FD] disabled:opacity-40 disabled:cursor-default cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
              </button>
              {Array.from({ length: staffPageCount }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setStaffPage(page)}
                  aria-current={page === currentStaffPage ? 'page' : undefined}
                  className={`h-9 min-w-9 rounded-xl px-2 text-sm font-semibold cursor-pointer ${
                    page === currentStaffPage
                      ? 'bg-[#6E3580] text-white'
                      : 'text-[#1E162B] hover:bg-[#F2E4F7]'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                disabled={currentStaffPage === staffPageCount}
                onClick={() => setStaffPage((page) => Math.min(staffPageCount, page + 1))}
                className="h-9 px-2.5 inline-flex items-center gap-1 rounded-xl text-sm font-semibold text-[#635573] hover:bg-[#FBF8FD] disabled:opacity-40 disabled:cursor-default cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          </div>
        )}
      </section>

      {viewedAccount && staffDraft && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1E162B]/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-details-title"
          onClick={(event) => {
            if (event.target === event.currentTarget && !saving) setViewStaffId(null);
          }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-[0_24px_60px_rgba(30,22,43,0.28)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="staff-details-title" className="font-display text-lg font-bold text-[#1E162B]">
                  {viewedAccount.fullName}
                </h2>
                <p className="mt-0.5 text-sm text-[#635573]">
                  @{viewedAccount.username} · {viewedAccount.active ? 'Active account' : 'Disabled account'}
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => setViewStaffId(null)}
                aria-label="Close staff details"
                className="h-9 w-9 rounded-full flex items-center justify-center text-[#635573] hover:bg-[#F2E4F7] hover:text-[#6E3580] cursor-pointer disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <label className="text-sm font-semibold text-[#635573]">
                Role
                <select
                  aria-label={`Role for ${viewedAccount.fullName}`}
                  disabled={saving || viewedAccount.id === currentUser.id}
                  value={staffDraft.role}
                  onChange={(event) => {
                    const nextRole = event.target.value as UserRole;
                    setStaffDraft((draft) => {
                      if (!draft) return draft;
                      if (nextRole === UserRole.ADMIN) return { ...draft, role: nextRole };
                      const permissions = { ...draft.permissions };
                      ATTENDANT_PERMISSION_LABELS.forEach((permission) => {
                        permissions[permission.key] = nextRole === UserRole.ATTENDANT;
                      });
                      return { ...draft, role: nextRole, permissions };
                    });
                  }}
                  className="mt-2 min-h-[46px] w-full rounded-xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 text-[15px] font-medium text-[#1E162B] focus:border-[#6E3580] focus:outline-none disabled:opacity-60"
                >
                  <option value={UserRole.ADMIN}>Admin</option>
                  <option value={UserRole.ATTENDANT}>Attendant</option>
                  <option value={UserRole.VIEWER}>OJT</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-[#635573]">
                Branch
                <select
                  aria-label={`Branch for ${viewedAccount.fullName}`}
                  disabled={saving}
                  value={staffDraft.branch}
                  onChange={(event) => {
                    const nextBranch = event.target.value as Branch;
                    setStaffDraft((draft) => draft ? { ...draft, branch: nextBranch } : draft);
                  }}
                  className="mt-2 min-h-[46px] w-full rounded-xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 text-[15px] font-medium text-[#1E162B] focus:border-[#6E3580] focus:outline-none disabled:opacity-60"
                >
                  <option value={Branch.BRANCH_1}>Branch 1</option>
                  <option value={Branch.BRANCH_2}>Branch 2</option>
                </select>
              </label>
            </div>

            <div className="mt-5 border-t border-[#E8D6EF] pt-4">
              <h3 className="text-sm font-semibold text-[#635573]">Permissions</h3>
              {staffDraft.role !== UserRole.ADMIN ? (
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                  {ATTENDANT_PERMISSION_LABELS.map((permission) => (
                    <label key={permission.key} className="flex items-center gap-2 text-sm text-[#1E162B] cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={saving}
                        checked={Boolean(staffDraft.permissions[permission.key])}
                        onChange={(event) =>
                          setStaffDraft((draft) =>
                            draft
                              ? {
                                  ...draft,
                                  permissions: { ...draft.permissions, [permission.key]: event.target.checked },
                                }
                              : draft,
                          )
                        }
                        className="h-4 w-4 rounded border-[#9A8BA8] accent-[#6E3580]"
                      />
                      <span>{permission.label}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-[#635573]">Full access</p>
              )}
            </div>

            {resetPasswordOpen && (
              <div className="mt-5 border-t border-[#E8D6EF] pt-4">
                <label className="block text-sm font-semibold text-[#635573]">
                  New password
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="At least 4 characters"
                    className="mt-2 min-h-[44px] w-full rounded-xl border border-[#D8BBE4] bg-[#FBF8FD] px-3.5 text-sm text-[#1E162B] focus:border-[#6E3580] focus:outline-none"
                  />
                </label>
                <button
                  type="button"
                  disabled={saving || newPassword.trim().length < 4}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await onUpdateUser(viewedAccount.id, { password: newPassword.trim() });
                      setNewPassword('');
                      setResetPasswordOpen(false);
                    } catch (error) {
                      setFormError(error instanceof Error ? error.message : 'Unable to reset password.');
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="mt-3 min-h-[40px] rounded-full bg-[#F2E4F7] px-4 text-sm font-semibold text-[#6E3580] hover:bg-[#E8D6EF] disabled:opacity-50 cursor-pointer"
                >
                  Set new password
                </button>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#E8D6EF] pt-4">
              <button
                type="button"
                disabled={saving || viewedAccount.id === currentUser.id}
                onClick={() => setResetPasswordOpen((open) => !open)}
                className="min-h-[40px] rounded-full px-4 text-sm font-semibold text-[#6E3580] hover:bg-[#F2E4F7] disabled:opacity-50 cursor-pointer"
              >
                Reset password
              </button>
              <div className="flex items-center gap-2">
                {viewedAccount.id !== currentUser.id && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setPendingAction({ type: 'active', user: viewedAccount, nextActive: !viewedAccount.active })}
                    className={`min-h-[40px] rounded-full px-4 text-sm font-semibold disabled:opacity-50 cursor-pointer ${
                      viewedAccount.active ? 'text-[#C41D73] hover:bg-[#FFF2F9]' : 'text-[#15803D] hover:bg-[#ECFDF3]'
                    }`}
                  >
                    {viewedAccount.active ? 'Deactivate' : 'Reactivate'}
                  </button>
                )}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    setPendingAction({
                      type: 'configuration',
                      user: viewedAccount,
                      role: staffDraft.role,
                      branch: staffDraft.branch,
                      permissions: staffDraft.permissions,
                    })
                  }
                  className="min-h-[40px] rounded-full bg-[#6E3580] px-5 text-sm font-semibold text-white hover:bg-[#1E162B] disabled:opacity-50 cursor-pointer"
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {dialogProps && (
        <ConfirmDialog
          open={Boolean(pendingAction)}
          title={dialogProps.title}
          message={dialogProps.message}
          emphasis={dialogProps.emphasis}
          cautions={dialogProps.cautions}
          confirmLabel={dialogProps.confirmLabel}
          tone={dialogProps.tone}
          busy={saving}
          onCancel={() => setPendingAction(null)}
          onConfirm={handleConfirmAction}
        />
      )}
    </div>
  );
};
