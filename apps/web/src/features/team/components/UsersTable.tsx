import type { OrgUserDto } from '@brd/shared';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@brd/ui';

type OrgRoleValue = OrgUserDto['orgRole'];

interface UsersTableProps {
  users: OrgUserDto[];
  currentUserId: string;
  busyUserId: string | null;
  onChangeRole: (user: OrgUserDto, orgRole: OrgRoleValue) => void;
  onResetPassword: (user: OrgUserDto) => void;
  onToggleActive: (user: OrgUserDto) => void;
}

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
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          const busy = busyUserId === user.id;
          const status = statusOf(user);
          return (
            <TableRow key={user.id}>
              <TableCell className="font-medium">
                {user.name}
                {isSelf && <span className="ml-2 text-muted-foreground">(you)</span>}
              </TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <Select
                  value={user.orgRole}
                  onValueChange={(value) => onChangeRole(user, value as OrgRoleValue)}
                  disabled={isSelf || busy}
                >
                  <SelectTrigger className="w-32" aria-label={`Role for ${user.name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="ORG_ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <StatusBadge label={status.label} tone={status.tone} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {!isSelf && user.active && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => onResetPassword(user)}
                    >
                      Reset password
                    </Button>
                  )}
                  {!isSelf && (
                    <Button
                      variant={user.active ? 'outline' : 'secondary'}
                      size="sm"
                      disabled={busy}
                      onClick={() => onToggleActive(user)}
                    >
                      {user.active ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
