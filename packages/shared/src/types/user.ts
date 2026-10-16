import type { OrgRole } from '../constants/roles.js';

export interface UserDto {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  orgRole: OrgRole;
  /** Kept for web compatibility: `name` always equals `orgRole`. */
  role: {
    id: OrgRole;
    name: OrgRole;
  };
}
