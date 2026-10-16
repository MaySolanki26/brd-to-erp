import type { OrgRole } from '../constants/roles.js';

export interface UserDto {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  orgRole: OrgRole;
  /** True while the user is still on an admin-issued temporary password. */
  mustChangePassword: boolean;
  /** Kept for web compatibility: `name` always equals `orgRole`. */
  role: {
    id: OrgRole;
    name: OrgRole;
  };
}

/** A user as listed to organization admins. */
export interface OrgUserDto {
  id: string;
  email: string;
  name: string;
  orgRole: OrgRole;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}
