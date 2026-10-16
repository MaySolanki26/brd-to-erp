import { randomUUID } from 'node:crypto';
import { hashPassword } from '../lib/password.js';
import {
  addMembership,
  addProject,
  addUser,
  db,
  type FakeProject,
  type FakeUser,
} from './fake-db.js';

export const PASSWORD = 'Correct-Horse-9';

let sharedHash: Promise<string> | undefined;

export interface World {
  orgA: string;
  orgB: string;
  adminA: FakeUser;
  ownerA: FakeUser;
  analystA: FakeUser;
  approverA: FakeUser;
  viewerA: FakeUser;
  outsiderA: FakeUser;
  adminB: FakeUser;
  userB: FakeUser;
  /** Project in org A with one member of every role. */
  p1: FakeProject;
  /** Project in org A where only ownerA is a member. */
  p2: FakeProject;
  /** Project in org B. */
  pB: FakeProject;
}

/** Builds a fresh two-org world. All users share one password hash to keep hashing cost low. */
export async function buildWorld(): Promise<World> {
  db.reset();
  sharedHash ??= hashPassword(PASSWORD);
  const passwordHash = await sharedHash;
  const orgA = randomUUID();
  const orgB = randomUUID();
  const user = (
    email: string,
    organizationId: string,
    orgRole: 'ORG_ADMIN' | 'MEMBER' = 'MEMBER',
  ) => addUser({ email, organizationId, passwordHash, orgRole });

  const world: World = {
    orgA,
    orgB,
    adminA: user('admin-a@test.dev', orgA, 'ORG_ADMIN'),
    ownerA: user('owner-a@test.dev', orgA),
    analystA: user('analyst-a@test.dev', orgA),
    approverA: user('approver-a@test.dev', orgA),
    viewerA: user('viewer-a@test.dev', orgA),
    outsiderA: user('outsider-a@test.dev', orgA),
    adminB: user('admin-b@test.dev', orgB, 'ORG_ADMIN'),
    userB: user('user-b@test.dev', orgB),
    p1: addProject(orgA, 'P1'),
    p2: addProject(orgA, 'P2'),
    pB: addProject(orgB, 'PB'),
  };

  addMembership(world.p1, world.ownerA, 'OWNER');
  addMembership(world.p1, world.analystA, 'ANALYST');
  addMembership(world.p1, world.approverA, 'APPROVER');
  addMembership(world.p1, world.viewerA, 'VIEWER');
  addMembership(world.p2, world.ownerA, 'OWNER');
  addMembership(world.pB, world.userB, 'OWNER');
  return world;
}
