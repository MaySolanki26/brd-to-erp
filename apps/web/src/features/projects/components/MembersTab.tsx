import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import type { MemberDto, ProjectRole } from '@brd/shared';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  NoAccess,
  PageError,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
  toast,
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

  if (!canManage) {
    return (
      <NoAccess description="Only project owners and organization admins can manage members." />
    );
  }

  const changeRole = (member: MemberDto, role: ProjectRole) =>
    updateRole.mutate(
      { userId: member.userId, role },
      {
        onSuccess: () => toast.success(`${member.name} is now ${ROLE_LABELS[role]}`),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );

  const confirmRemove = () => {
    if (!removeTarget) return;
    const target = removeTarget;
    removeMember.mutate(target.userId, {
      onSuccess: () => toast.success(`${target.name} removed from the project`),
      onError: (err) => toast.error(errorMessage(err)),
      onSettled: () => setRemoveTarget(null),
    });
  };

  const busyUserId = updateRole.isPending ? (updateRole.variables?.userId ?? null) : null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <UserPlus className="mr-1 h-4 w-4" />
          Add member
        </Button>
      </div>

      {members.isPending && <TableSkeleton columns={[...SKELETON_COLUMNS]} rows={4} />}
      {members.isError &&
        (isForbidden(members.error) ? (
          <NoAccess description="You cannot manage members of this project." />
        ) : (
          <PageError
            message="Could not load members"
            description={errorMessage(members.error)}
            onRetry={() => void members.refetch()}
          />
        ))}
      {members.isSuccess && members.data.length === 0 && (
        <EmptyState
          icon={UserPlus}
          title="No members yet"
          description="Add teammates so they can work on this project."
          actionLabel="Add member"
          onAction={() => setAddOpen(true)}
        />
      )}
      {members.isSuccess && members.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.data.map((member) => (
              <TableRow key={member.userId}>
                <TableCell className="font-medium">
                  {member.name}
                  {member.userId === currentUserId && (
                    <span className="ml-2 text-muted-foreground">(you)</span>
                  )}
                </TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>
                  <Select
                    value={member.role}
                    onValueChange={(value) => changeRole(member, value as ProjectRole)}
                    disabled={busyUserId === member.userId}
                  >
                    <SelectTrigger className="w-36" aria-label={`Role for ${member.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => setRemoveTarget(member)}>
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
    </div>
  );
}
