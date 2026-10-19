import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import type { MemberDto, ProjectRole } from '@brd/shared';
import {
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  InlineAlert,
  NoAccess,
  PageError,
  SelectMenu,
  TableSkeleton,
  toast,
  type DataTableColumnDef,
} from '@brd/ui';
import { errorMessage, isForbidden } from '@/lib/error-message';
import { useMembers } from '../hooks/use-members';
import { useRemoveMember, useUpdateMemberRole } from '../hooks/use-member-mutations';
import { ROLE_LABELS, ROLE_OPTIONS } from '../project-labels';
import { AddMemberDrawer } from './AddMemberDrawer';

interface MembersTabProps {
  projectId: string;
  canManage: boolean;
  currentUserId: string;
}

const SKELETON_COLUMNS = [
  { kind: 'text' },
  { kind: 'text' },
  { kind: 'select' },
  { kind: 'icon' },
] as const;

export function MembersTab({ projectId, canManage, currentUserId }: MembersTabProps) {
  const members = useMembers(projectId, canManage);
  const updateRole = useUpdateMemberRole(projectId);
  const removeMember = useRemoveMember(projectId);
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<MemberDto | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!canManage) {
    return (
      <NoAccess description="Only project owners and organization admins can manage members." />
    );
  }

  const ownerCount = members.data?.filter((m) => m.role === 'OWNER').length ?? 0;
  const isSoleOwner = (member: MemberDto) => member.role === 'OWNER' && ownerCount <= 1;

  const changeRole = (member: MemberDto, role: ProjectRole) => {
    setActionError(null);
    updateRole.mutate(
      { userId: member.userId, role },
      {
        onSuccess: () => toast.success(`${member.name} is now ${ROLE_LABELS[role]}`),
        onError: (err) => setActionError(errorMessage(err)),
      },
    );
  };

  const confirmRemove = () => {
    if (!removeTarget) return;
    const target = removeTarget;
    setActionError(null);
    removeMember.mutate(target.userId, {
      onSuccess: () => toast.success(`${target.name} removed from the project`),
      onError: (err) => setActionError(errorMessage(err)),
      onSettled: () => setRemoveTarget(null),
    });
  };

  const busyUserId = updateRole.isPending ? (updateRole.variables?.userId ?? null) : null;

  const addButton = (
    <Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>
      Add member
    </Button>
  );

  const columns: DataTableColumnDef<MemberDto>[] = [
    {
      id: 'name',
      header: 'Name',
      width: 220,
      canHide: false,
      cell: (member) => (
        <>
          {member.name}
          {member.userId === currentUserId && <span className="uab-muted"> (you)</span>}
        </>
      ),
    },
    { id: 'email', header: 'Email', width: 260 },
    {
      id: 'role',
      header: 'Role',
      width: 180,
      cell: (member) => (
        <SelectMenu
          label={`Role for ${member.name}`}
          value={member.role}
          options={ROLE_OPTIONS.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
          onChange={(value) => changeRole(member, value as ProjectRole)}
          disabled={busyUserId === member.userId || isSoleOwner(member)}
        />
      ),
    },
  ];

  return (
    <>
      {actionError && <InlineAlert tone="danger">{actionError}</InlineAlert>}

      {members.isPending && (
        <div className="uab-content-surface">
          <TableSkeleton columns={[...SKELETON_COLUMNS]} rows={4} />
        </div>
      )}
      {members.isError && (
        <div className="uab-content-surface">
          {isForbidden(members.error) ? (
            <NoAccess description="You cannot manage members of this project." />
          ) : (
            <PageError
              message="Could not load members"
              description={errorMessage(members.error)}
              onRetry={() => void members.refetch()}
            />
          )}
        </div>
      )}
      {members.isSuccess && members.data.length === 0 && (
        <div className="uab-content-surface">
          <EmptyState
            icon={UserPlus}
            title="No members yet"
            description="Add teammates so they can work on this project."
            action={addButton}
          />
        </div>
      )}
      {members.isSuccess && members.data.length > 0 && (
        <DataTable<MemberDto>
          ariaLabel="Members table"
          noun={{ one: 'member', other: 'members' }}
          columns={columns}
          data={members.data}
          getRowId={(member) => member.userId}
          toolbarActions={addButton}
          pagination={{
            page: 1,
            pageSize: Math.max(members.data.length, 1),
            total: members.data.length,
          }}
          rowActions={[
            {
              key: 'remove',
              label: (member) => (isSoleOwner(member) ? 'Only owner' : `Remove ${member.name}`),
              icon: 'trash',
              quick: true,
              disabledReason: (member) =>
                isSoleOwner(member) ? 'The only owner cannot be removed' : undefined,
              onClick: setRemoveTarget,
            },
          ]}
        />
      )}

      <AddMemberDrawer projectId={projectId} open={addOpen} onOpenChange={setAddOpen} />
      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove member?"
        description={`${removeTarget?.name ?? 'This user'} will lose access to this project.`}
        variant="destructive"
        confirmLabel="Remove"
        isPending={removeMember.isPending}
        onConfirm={confirmRemove}
      />
    </>
  );
}
