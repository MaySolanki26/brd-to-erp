import { useState } from 'react';
import { Plus, Users } from 'lucide-react';
import type { OrgUserDto } from '@brd/shared';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  InformativeBar,
  NoAccess,
  PageError,
  PageShell,
  TableSkeleton,
  toast,
} from '@brd/ui';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { errorMessage, isForbidden } from '@/lib/error-message';
import { CreateUserDrawer } from './components/CreateUserDrawer';
import { CredentialsDialog, type Credentials } from './components/CredentialsDialog';
import { ResetPasswordDrawer } from './components/ResetPasswordDrawer';
import { UsersTable } from './components/UsersTable';
import { useUpdateUser } from './hooks/use-user-mutations';
import { useUsers } from './hooks/use-users';

const SKELETON_COLUMNS = [
  { kind: 'text' },
  { kind: 'text' },
  { kind: 'select' },
  { kind: 'badge' },
  { kind: 'icon' },
] as const;

export function TeamPage() {
  const { user: me } = useAuth();
  const users = useUsers();
  const updateUser = useUpdateUser();

  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<OrgUserDto | null>(null);
  const [toggleTarget, setToggleTarget] = useState<OrgUserDto | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const showCredentials = (user: OrgUserDto, tempPassword: string) =>
    setCredentials({ name: user.name, email: user.email, tempPassword });

  const changeRole = (user: OrgUserDto, orgRole: OrgUserDto['orgRole']) =>
    updateUser.mutate(
      { userId: user.id, orgRole },
      {
        onSuccess: () =>
          toast.success(`${user.name} is now ${orgRole === 'ORG_ADMIN' ? 'an admin' : 'a member'}`),
      },
    );

  const confirmToggle = () => {
    if (!toggleTarget) return;
    const target = toggleTarget;
    updateUser.mutate(
      { userId: target.id, active: !target.active },
      {
        onSuccess: () => {
          toast.success(`${target.name} ${target.active ? 'deactivated' : 'reactivated'}`);
          setToggleTarget(null);
        },
        onError: () => setToggleTarget(null),
      },
    );
  };

  const busyUserId = updateUser.isPending ? (updateUser.variables?.userId ?? null) : null;

  return (
    <PageShell>
      <InformativeBar title="Team" info="Manage who can sign in to your organization">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add member
        </Button>
      </InformativeBar>
      <PageShell.Body padded>
        {users.isPending && <TableSkeleton columns={[...SKELETON_COLUMNS]} rows={5} />}
        {users.isError &&
          (isForbidden(users.error) ? (
            <NoAccess description="Only organization admins can manage the team." />
          ) : (
            <PageError
              message="Could not load the team"
              description={errorMessage(users.error)}
              onRetry={() => void users.refetch()}
            />
          ))}
        {users.isSuccess && users.data.length === 0 && (
          <EmptyState
            icon={Users}
            title="No team members yet"
            description="Add the first teammate to give them access."
            actionLabel="Add member"
            onAction={() => setCreateOpen(true)}
          />
        )}
        {users.isSuccess && users.data.length > 0 && me && (
          <UsersTable
            users={users.data}
            currentUserId={me.id}
            busyUserId={busyUserId}
            onChangeRole={changeRole}
            onResetPassword={setResetTarget}
            onToggleActive={setToggleTarget}
          />
        )}
      </PageShell.Body>

      <CreateUserDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={showCredentials}
      />
      <ResetPasswordDrawer
        user={resetTarget}
        onClose={() => setResetTarget(null)}
        onReset={showCredentials}
      />
      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />
      <ConfirmDialog
        open={toggleTarget !== null}
        onOpenChange={(open) => !open && setToggleTarget(null)}
        title={toggleTarget?.active ? 'Deactivate user?' : 'Reactivate user?'}
        description={
          toggleTarget?.active
            ? `${toggleTarget.name} will be signed out immediately and can no longer sign in. Their project memberships are kept.`
            : `${toggleTarget?.name ?? 'This user'} will be able to sign in again.`
        }
        variant={toggleTarget?.active ? 'destructive' : 'primary'}
        confirmLabel={toggleTarget?.active ? 'Deactivate' : 'Reactivate'}
        isPending={updateUser.isPending}
        onConfirm={confirmToggle}
      />
    </PageShell>
  );
}
