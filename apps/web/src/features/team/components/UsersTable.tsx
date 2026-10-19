import { useMemo, useState } from 'react';
import { DataTable, SelectMenu, StatusBadge, type DataTableColumnDef } from '@brd/ui';
import type { OrgUserDto } from '@brd/shared';

type OrgRoleValue = OrgUserDto['orgRole'];

interface UsersTableProps {
  users: OrgUserDto[];
  currentUserId: string;
  busyUserId: string | null;
  onChangeRole: (user: OrgUserDto, orgRole: OrgRoleValue) => void;
  onResetPassword: (user: OrgUserDto) => void;
  onToggleActive: (user: OrgUserDto) => void;
}

const ROLE_OPTIONS = [
  { value: 'MEMBER', label: 'Member' },
  { value: 'ORG_ADMIN', label: 'Admin' },
];

const NOUN = { one: 'user', other: 'users' };

function statusOf(user: OrgUserDto): { label: string; tone: 'success' | 'warning' | 'neutral' } {
  if (!user.active) return { label: 'Deactivated', tone: 'neutral' };
  if (user.mustChangePassword) return { label: 'Pending password change', tone: 'warning' };
  return { label: 'Active', tone: 'success' };
}

export function UsersTable({
  users,
  currentUserId,
  busyUserId,
  onChangeRole,
  onResetPassword,
  onToggleActive,
}: UsersTableProps) {
  const [search, setSearch] = useState('');
  const isSelf = (user: OrgUserDto) => user.id === currentUserId;

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle
      ? users.filter(
          (user) =>
            user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle),
        )
      : users;
  }, [users, search]);

  const columns: DataTableColumnDef<OrgUserDto>[] = [
    {
      id: 'name',
      header: 'Name',
      width: 220,
      canHide: false,
      cell: (user) => (
        <>
          {user.name}
          {isSelf(user) && <span className="uab-muted"> (you)</span>}
        </>
      ),
    },
    { id: 'email', header: 'Email', width: 260 },
    {
      id: 'orgRole',
      header: 'Role',
      width: 160,
      cell: (user) => (
        <SelectMenu
          label={`Role for ${user.name}`}
          value={user.orgRole}
          options={ROLE_OPTIONS}
          disabled={isSelf(user) || busyUserId === user.id}
          onChange={(value) => onChangeRole(user, value as OrgRoleValue)}
        />
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: 200,
      cell: (user) => {
        const status = statusOf(user);
        return <StatusBadge label={status.label} tone={status.tone} />;
      },
    },
  ];

  return (
    <DataTable<OrgUserDto>
      ariaLabel="Users table"
      noun={NOUN}
      columns={columns}
      data={shown}
      getRowId={(user) => user.id}
      search={{
        value: search,
        onChange: setSearch,
        placeholder: 'Search',
        ariaLabel: 'Search users',
      }}
      onClearFilters={() => setSearch('')}
      emptyTitle="No matching users"
      emptyDescription="Try a different name or email."
      pagination={{ page: 1, pageSize: Math.max(shown.length, 1), total: shown.length }}
      rowActions={[
        {
          key: 'reset',
          label: 'Reset password',
          hidden: (user) => isSelf(user) || !user.active,
          disabledReason: (user) => (busyUserId === user.id ? 'Working…' : undefined),
          onClick: onResetPassword,
        },
        {
          key: 'toggle',
          label: (user) => (user.active ? 'Deactivate' : 'Reactivate'),
          hidden: isSelf,
          disabledReason: (user) => (busyUserId === user.id ? 'Working…' : undefined),
          onClick: onToggleActive,
        },
      ]}
    />
  );
}
