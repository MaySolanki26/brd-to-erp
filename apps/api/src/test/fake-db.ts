import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { NotFoundError } from '../errors/app-error.js';
import type { AuditEntry } from '../modules/audit/audit.repository.js';
import type { NewSession, SessionRecord } from '../modules/auth/auth.repository.js';

type OrgRole = 'ORG_ADMIN' | 'MEMBER';
type ProjectRole = 'OWNER' | 'ANALYST' | 'APPROVER' | 'VIEWER';
type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export interface FakeUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  organizationId: string;
  orgRole: OrgRole;
  failedLoginCount: number;
  lockedUntil: Date | null;
  mustChangePassword: boolean;
  deletedAt: Date | null;
}

export interface FakeProject {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FakeMember {
  id: string;
  userId: string;
  projectId: string;
  organizationId: string;
  role: ProjectRole;
  createdAt: Date;
}

export type SourceStatusValue = 'UPLOADED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';

export interface FakeDocument {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  status: SourceStatusValue;
  errorMessage: string | null;
  projectId: string;
  organizationId: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface FakeVersion {
  id: string;
  documentId: string;
  organizationId: string;
  createdById: string;
  versionNumber: number;
  fileKey: string;
  contentHash: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

export interface FakeNote {
  id: string;
  title: string;
  body: string;
  status: SourceStatusValue;
  errorMessage: string | null;
  projectId: string;
  organizationId: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FakeChunk {
  id: string;
  chunkIndex: number;
  headingPath: string[];
  content: string;
  documentVersionId: string | null;
  contextNoteId: string | null;
  projectId: string;
  organizationId: string;
  needsReview?: boolean;
  extractedAt?: Date | null;
}

export type FakeKnowledgeStatus =
  'CONFIRMED' | 'ASSUMED' | 'OPEN' | 'REJECTED' | 'NEEDS_REVALIDATION';

/** One shape for requirements, rules and modules; modules also use `name` and `code`. */
export interface FakeKnowledge {
  id: string;
  title: string;
  name: string;
  code: string;
  description: string;
  status: FakeKnowledgeStatus;
  priority: number | null;
  moduleId: string | null;
  sourceChunkId: string;
  /** Other chunks the item was merged from, oldest first. */
  extraChunkIds?: string[];
  projectId: string;
  organizationId: string;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeSession extends SessionRecord {
  tokenHash: string;
}

/** In-memory stand-in for the storage driver; tests put bytes here to simulate an upload. */
export const storageFiles = new Map<string, Buffer>();

export const db = {
  users: new Map<string, FakeUser>(),
  projects: new Map<string, FakeProject>(),
  members: new Map<string, FakeMember>(),
  sessions: new Map<string, FakeSession>(),
  documents: new Map<string, FakeDocument>(),
  versions: new Map<string, FakeVersion>(),
  notes: new Map<string, FakeNote>(),
  chunks: new Map<string, FakeChunk>(),
  requirements: new Map<string, FakeKnowledge>(),
  rules: new Map<string, FakeKnowledge>(),
  modules: new Map<string, FakeKnowledge>(),
  audit: [] as AuditEntry[],
  reset(): void {
    this.users.clear();
    this.projects.clear();
    this.members.clear();
    this.sessions.clear();
    this.documents.clear();
    this.versions.clear();
    this.notes.clear();
    this.chunks.clear();
    this.requirements.clear();
    this.rules.clear();
    this.modules.clear();
    storageFiles.clear();
    this.audit.length = 0;
  },
};

export function addUser(
  partial: Partial<FakeUser> & Pick<FakeUser, 'email' | 'passwordHash' | 'organizationId'>,
): FakeUser {
  const user: FakeUser = {
    id: randomUUID(),
    name: partial.email.split('@')[0] ?? 'user',
    orgRole: 'MEMBER',
    failedLoginCount: 0,
    lockedUntil: null,
    mustChangePassword: false,
    deletedAt: null,
    ...partial,
  };
  db.users.set(user.id, user);
  return user;
}

export function addProject(organizationId: string, name: string): FakeProject {
  const now = new Date();
  const project: FakeProject = {
    id: randomUUID(),
    name,
    description: null,
    status: 'ACTIVE',
    organizationId,
    createdAt: now,
    updatedAt: now,
  };
  db.projects.set(project.id, project);
  return project;
}

export function addMembership(project: FakeProject, user: FakeUser, role: ProjectRole): FakeMember {
  const member: FakeMember = {
    id: randomUUID(),
    userId: user.id,
    projectId: project.id,
    organizationId: project.organizationId,
    role,
    createdAt: new Date(),
  };
  db.members.set(member.id, member);
  return member;
}

function activeUsers(): FakeUser[] {
  return [...db.users.values()].filter((u) => u.deletedAt === null);
}

function orgUserRecord(u: FakeUser) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    orgRole: u.orgRole,
    mustChangePassword: u.mustChangePassword,
    deletedAt: u.deletedAt,
    createdAt: new Date(0),
  };
}

function memberWithUser(m: FakeMember) {
  const user = db.users.get(m.userId);
  return { ...m, user: { name: user?.name ?? '', email: user?.email ?? '' } };
}

export const transactionModule = {
  withTransaction: <T>(fn: (tx: object) => Promise<T>): Promise<T> => fn({}),
};

export const authRepositoryModule = {
  findUserByEmail: async (email: string) => activeUsers().find((u) => u.email === email) ?? null,
  findUserById: async (id: string) => activeUsers().find((u) => u.id === id) ?? null,
  incrementFailedLogins: async (userId: string): Promise<number> => {
    const user = db.users.get(userId);
    if (!user) throw new Error('user missing');
    user.failedLoginCount += 1;
    return user.failedLoginCount;
  },
  lockUser: async (userId: string, until: Date): Promise<void> => {
    const user = db.users.get(userId);
    if (user) {
      user.lockedUntil = until;
      user.failedLoginCount = 0;
    }
  },
  resetFailedLogins: async (userId: string): Promise<void> => {
    const user = db.users.get(userId);
    if (user) {
      user.failedLoginCount = 0;
      user.lockedUntil = null;
    }
  },
  createSession: async (data: NewSession): Promise<void> => {
    const id = randomUUID();
    db.sessions.set(id, {
      id,
      tokenHash: data.tokenHash,
      familyId: data.familyId,
      userId: data.userId,
      organizationId: data.organizationId,
      expiresAt: data.expiresAt,
      revokedAt: null,
    });
  },
  findSessionByTokenHash: async (tokenHash: string): Promise<SessionRecord | null> =>
    [...db.sessions.values()].find((s) => s.tokenHash === tokenHash) ?? null,
  revokeSessionIfActive: async (sessionId: string, now: Date): Promise<boolean> => {
    const session = db.sessions.get(sessionId);
    if (!session || session.revokedAt) return false;
    session.revokedAt = now;
    return true;
  },
  isFamilyActive: async (familyId: string, now: Date): Promise<boolean> =>
    [...db.sessions.values()].some(
      (s) => s.familyId === familyId && !s.revokedAt && s.expiresAt.getTime() > now.getTime(),
    ),
  revokeFamily: async (familyId: string, now: Date): Promise<void> => {
    for (const s of db.sessions.values()) {
      if (s.familyId === familyId && !s.revokedAt) s.revokedAt = now;
    }
  },
  updatePassword: async (
    userId: string,
    passwordHash: string,
    mustChangePassword: boolean,
  ): Promise<void> => {
    const user = db.users.get(userId);
    if (user) {
      user.passwordHash = passwordHash;
      user.mustChangePassword = mustChangePassword;
      user.failedLoginCount = 0;
      user.lockedUntil = null;
    }
  },
  revokeAllSessions: async (userId: string, now: Date): Promise<void> => {
    for (const s of db.sessions.values()) {
      if (s.userId === userId && !s.revokedAt) s.revokedAt = now;
    }
  },
};

export const accessRepositoryModule = {
  projectSelect: {},
  findProjectInOrg: async (organizationId: string, projectId: string) => {
    const project = db.projects.get(projectId);
    return project && project.organizationId === organizationId ? project : null;
  },
  findMembershipRole: async (organizationId: string, projectId: string, userId: string) =>
    [...db.members.values()].find(
      (m) =>
        m.organizationId === organizationId && m.projectId === projectId && m.userId === userId,
    )?.role ?? null,
};

export const projectsRepositoryModule = {
  listProjects: async (p: {
    organizationId: string;
    userId: string;
    allInOrg: boolean;
    includeArchived: boolean;
    search?: string;
    page: number;
    pageSize: number;
  }) => {
    const needle = p.search?.toLowerCase();
    const mine = [...db.projects.values()]
      .filter((x) => x.organizationId === p.organizationId)
      .filter((x) => !needle || x.name.toLowerCase().includes(needle))
      .filter((x) => p.includeArchived || x.status !== 'ARCHIVED')
      .map((x) => ({
        ...x,
        myRole:
          [...db.members.values()].find((m) => m.projectId === x.id && m.userId === p.userId)
            ?.role ?? null,
      }))
      .filter((x) => p.allInOrg || x.myRole !== null);
    const start = (p.page - 1) * p.pageSize;
    return { items: mine.slice(start, start + p.pageSize), total: mine.length };
  },
  createProject: async (data: { name: string; description?: string; organizationId: string }) => {
    const project = addProject(data.organizationId, data.name);
    project.description = data.description ?? null;
    return project;
  },
  addOwner: async (data: {
    projectId: string;
    userId: string;
    organizationId: string;
  }): Promise<void> => {
    const project = db.projects.get(data.projectId);
    const user = db.users.get(data.userId);
    if (project && user) addMembership(project, user, 'OWNER');
  },
  updateProject: async (
    organizationId: string,
    projectId: string,
    data: { name?: string; description?: string | null; status?: ProjectStatus },
  ) => {
    const project = db.projects.get(projectId);
    if (!project || project.organizationId !== organizationId) return null;
    Object.assign(
      project,
      Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
    );
    project.updatedAt = new Date();
    return project;
  },
};

export const membersRepositoryModule = {
  listMembers: async (organizationId: string, projectId: string) =>
    [...db.members.values()]
      .filter((m) => m.organizationId === organizationId && m.projectId === projectId)
      .map(memberWithUser),
  listCandidates: async (organizationId: string, projectId: string) =>
    activeUsers()
      .filter(
        (u) =>
          u.organizationId === organizationId &&
          ![...db.members.values()].some((m) => m.projectId === projectId && m.userId === u.id),
      )
      .map((u) => ({ id: u.id, name: u.name, email: u.email })),
  findMember: async (organizationId: string, projectId: string, userId: string) => {
    const m = [...db.members.values()].find(
      (x) =>
        x.organizationId === organizationId && x.projectId === projectId && x.userId === userId,
    );
    return m ? memberWithUser(m) : null;
  },
  userExistsInOrg: async (organizationId: string, userId: string): Promise<boolean> =>
    activeUsers().some((u) => u.id === userId && u.organizationId === organizationId),
  addMember: async (data: {
    organizationId: string;
    projectId: string;
    userId: string;
    role: ProjectRole;
  }) => {
    const member: FakeMember = { id: randomUUID(), createdAt: new Date(), ...data };
    db.members.set(member.id, member);
    return memberWithUser(member);
  },
  updateMemberRole: async (memberId: string, role: ProjectRole) => {
    const member = db.members.get(memberId);
    if (!member) throw new Error('member missing');
    member.role = role;
    return memberWithUser(member);
  },
  deleteMember: async (memberId: string): Promise<void> => {
    db.members.delete(memberId);
  },
  countOwners: async (organizationId: string, projectId: string): Promise<number> =>
    [...db.members.values()].filter(
      (m) => m.organizationId === organizationId && m.projectId === projectId && m.role === 'OWNER',
    ).length,
  lockProject: async (_organizationId: string, projectId: string) =>
    db.projects.get(projectId)?.status ?? null,
};

export const usersRepositoryModule = {
  lockOrganization: async (): Promise<void> => undefined,
  listUsers: async (organizationId: string) =>
    [...db.users.values()].filter((u) => u.organizationId === organizationId).map(orgUserRecord),
  findUser: async (organizationId: string, userId: string) => {
    const user = db.users.get(userId);
    return user && user.organizationId === organizationId ? orgUserRecord(user) : null;
  },
  emailTaken: async (email: string): Promise<boolean> =>
    [...db.users.values()].some((u) => u.email === email),
  createUser: async (data: {
    organizationId: string;
    email: string;
    name: string;
    orgRole: OrgRole;
    passwordHash: string;
  }) => orgUserRecord(addUser({ ...data, mustChangePassword: true })),
  updateUser: async (userId: string, data: { orgRole?: OrgRole; deletedAt?: Date | null }) => {
    const user = db.users.get(userId);
    if (!user) throw new Error('user missing');
    if (data.orgRole !== undefined) user.orgRole = data.orgRole;
    if (data.deletedAt !== undefined) user.deletedAt = data.deletedAt;
    return orgUserRecord(user);
  },
  countActiveAdmins: async (organizationId: string): Promise<number> =>
    activeUsers().filter((u) => u.organizationId === organizationId && u.orgRole === 'ORG_ADMIN')
      .length,
};

function person(userId: string): { id: string; name: string } {
  return { id: userId, name: db.users.get(userId)?.name ?? 'Unknown' };
}

function inProject(
  d: { organizationId: string; projectId: string; deletedAt?: Date | null },
  organizationId: string,
  projectId: string,
): boolean {
  return d.organizationId === organizationId && d.projectId === projectId && !d.deletedAt;
}

function versionsOf(documentId: string): FakeVersion[] {
  return [...db.versions.values()]
    .filter((v) => v.documentId === documentId)
    .sort((a, b) => b.versionNumber - a.versionNumber);
}

function versionRecord(v: FakeVersion) {
  return {
    id: v.id,
    versionNumber: v.versionNumber,
    mimeType: v.mimeType,
    sizeBytes: v.sizeBytes,
    contentHash: v.contentHash,
    createdAt: v.createdAt,
    createdBy: person(v.createdById),
  };
}

function documentRecord(d: FakeDocument) {
  const versions = versionsOf(d.id);
  return {
    id: d.id,
    title: d.title,
    fileName: d.fileName,
    status: d.status,
    errorMessage: d.errorMessage,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    createdBy: person(d.createdById),
    _count: { versions: versions.length },
    versions: versions.slice(0, 1).map(versionRecord),
  };
}

function noteRecord(n: FakeNote) {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    status: n.status,
    errorMessage: n.errorMessage,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    createdBy: person(n.createdById),
  };
}

export const storageModule = {
  storageService: {
    createUploadUrl: async (_contentType: string) => ({
      url: 'http://storage.test/upload',
      fileKey: randomUUID(),
      expiresAt: new Date(Date.now() + 300_000),
    }),
    confirmUpload: async (fileKey: string): Promise<void> => {
      if (!storageFiles.has(fileKey)) throw new NotFoundError(`File not found: ${fileKey}`);
    },
    getDownloadStream: async (fileKey: string): Promise<Readable> => {
      const file = storageFiles.get(fileKey);
      if (!file) throw new NotFoundError(`File not found: ${fileKey}`);
      return Readable.from([file]);
    },
    delete: async (fileKey: string): Promise<void> => {
      storageFiles.delete(fileKey);
    },
  },
};

export const documentsRepositoryModule = {
  listDocuments: async (p: {
    organizationId: string;
    projectId: string;
    page: number;
    pageSize: number;
  }) => {
    const all = [...db.documents.values()]
      .filter((d) => inProject(d, p.organizationId, p.projectId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = (p.page - 1) * p.pageSize;
    return { items: all.slice(start, start + p.pageSize).map(documentRecord), total: all.length };
  },
  findDocument: async (organizationId: string, projectId: string, documentId: string) => {
    const d = db.documents.get(documentId);
    return d && inProject(d, organizationId, projectId) ? documentRecord(d) : null;
  },
  listVersions: async (organizationId: string, projectId: string, documentId: string) => {
    const d = db.documents.get(documentId);
    return d && inProject(d, organizationId, projectId)
      ? versionsOf(documentId).map(versionRecord)
      : [];
  },
  findVersionForDownload: async (
    organizationId: string,
    projectId: string,
    documentId: string,
    versionId: string,
  ) => {
    const d = db.documents.get(documentId);
    const v = db.versions.get(versionId);
    if (!d || !v || v.documentId !== documentId || !inProject(d, organizationId, projectId)) {
      return null;
    }
    return {
      id: v.id,
      fileKey: v.fileKey,
      mimeType: v.mimeType,
      versionNumber: v.versionNumber,
      document: { fileName: d.fileName },
    };
  },
  countChunksByVersion: async (_org: string, _project: string, versionIds: string[]) => {
    const counts = new Map<string, number>();
    for (const c of db.chunks.values()) {
      if (c.documentVersionId && versionIds.includes(c.documentVersionId)) {
        counts.set(c.documentVersionId, (counts.get(c.documentVersionId) ?? 0) + 1);
      }
    }
    return counts;
  },
  listChunks: async (p: { versionId: string; page: number; pageSize: number }) => {
    const all = [...db.chunks.values()]
      .filter((c) => c.documentVersionId === p.versionId)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
    const start = (p.page - 1) * p.pageSize;
    return { items: all.slice(start, start + p.pageSize), total: all.length };
  },
  findDuplicate: async (organizationId: string, projectId: string, contentHash: string) => {
    for (const v of db.versions.values()) {
      const d = db.documents.get(v.documentId);
      if (d && v.contentHash === contentHash && inProject(d, organizationId, projectId)) {
        return { id: d.id, title: d.title };
      }
    }
    return null;
  },
  fileKeyUsed: async (fileKey: string): Promise<boolean> =>
    [...db.versions.values()].some((v) => v.fileKey === fileKey),
  createDocument: async (data: {
    title: string;
    fileName: string;
    mimeType: string;
    projectId: string;
    organizationId: string;
    createdById: string;
    version: { fileKey: string; contentHash: string; mimeType: string; sizeBytes: number };
  }) => {
    const now = new Date();
    const doc: FakeDocument = {
      id: randomUUID(),
      title: data.title,
      fileName: data.fileName,
      mimeType: data.mimeType,
      status: 'UPLOADED',
      errorMessage: null,
      projectId: data.projectId,
      organizationId: data.organizationId,
      createdById: data.createdById,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    db.documents.set(doc.id, doc);
    const version: FakeVersion = {
      id: randomUUID(),
      documentId: doc.id,
      organizationId: data.organizationId,
      createdById: data.createdById,
      versionNumber: 1,
      createdAt: now,
      ...data.version,
    };
    db.versions.set(version.id, version);
    return { id: doc.id, versionId: version.id };
  },
  lockProjectForUpload: async (): Promise<void> => undefined,
  findDocumentIdByFileName: async (
    organizationId: string,
    projectId: string,
    fileName: string,
  ): Promise<string | null> => {
    const match = [...db.documents.values()].find(
      (d) =>
        inProject(d, organizationId, projectId) &&
        d.fileName.toLowerCase() === fileName.toLowerCase(),
    );
    return match?.id ?? null;
  },
  lockDocument: async (organizationId: string, projectId: string, documentId: string) => {
    const d = db.documents.get(documentId);
    return d !== undefined && inProject(d, organizationId, projectId);
  },
  nextVersionNumber: async (documentId: string): Promise<number> =>
    (versionsOf(documentId)[0]?.versionNumber ?? 0) + 1,
  createVersion: async (data: Omit<FakeVersion, 'id' | 'createdAt'>) => {
    const version: FakeVersion = { id: randomUUID(), createdAt: new Date(), ...data };
    db.versions.set(version.id, version);
    return { id: version.id };
  },
  markUploaded: async (documentId: string, data: { fileName: string; mimeType: string }) => {
    const d = db.documents.get(documentId);
    if (d) Object.assign(d, data, { status: 'UPLOADED', errorMessage: null });
  },
  requeue: async (organizationId: string, projectId: string, documentId: string) => {
    const d = db.documents.get(documentId);
    if (!d || !inProject(d, organizationId, projectId)) return false;
    if (d.status !== 'FAILED' && d.status !== 'PROCESSED') return false;
    d.status = 'UPLOADED';
    d.errorMessage = null;
    return true;
  },
  failDocument: async (organizationId: string, documentId: string, reason: string) => {
    const d = db.documents.get(documentId);
    if (d && d.organizationId === organizationId && d.status === 'UPLOADED') {
      d.status = 'FAILED';
      d.errorMessage = reason;
    }
  },
};

export const notesRepositoryModule = {
  listNotes: async (p: {
    organizationId: string;
    projectId: string;
    page: number;
    pageSize: number;
  }) => {
    const all = [...db.notes.values()]
      .filter((n) => inProject(n, p.organizationId, p.projectId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = (p.page - 1) * p.pageSize;
    return { items: all.slice(start, start + p.pageSize).map(noteRecord), total: all.length };
  },
  findNote: async (organizationId: string, projectId: string, noteId: string) => {
    const n = db.notes.get(noteId);
    return n && inProject(n, organizationId, projectId) ? noteRecord(n) : null;
  },
  countChunksByNote: async (_org: string, _project: string, noteIds: string[]) => {
    const counts = new Map<string, number>();
    for (const c of db.chunks.values()) {
      if (c.contextNoteId && noteIds.includes(c.contextNoteId)) {
        counts.set(c.contextNoteId, (counts.get(c.contextNoteId) ?? 0) + 1);
      }
    }
    return counts;
  },
  createNote: async (data: {
    title: string;
    body: string;
    projectId: string;
    organizationId: string;
    createdById: string;
  }) => {
    const now = new Date();
    const note: FakeNote = {
      id: randomUUID(),
      status: 'UPLOADED',
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      ...data,
    };
    db.notes.set(note.id, note);
    return noteRecord(note);
  },
  updateNote: async (noteId: string, data: { title?: string; body?: string }) => {
    const n = db.notes.get(noteId);
    if (!n) throw new Error('note missing');
    Object.assign(n, data, { status: 'UPLOADED', errorMessage: null, updatedAt: new Date() });
    return noteRecord(n);
  },
  failNote: async (organizationId: string, noteId: string, reason: string) => {
    const n = db.notes.get(noteId);
    if (n && n.organizationId === organizationId && n.status === 'UPLOADED') {
      n.status = 'FAILED';
      n.errorMessage = reason;
    }
  },
};

export const sourcesRepositoryModule = {
  countDocumentsByStatus: async (organizationId: string, projectId: string) => {
    const counts = new Map<SourceStatusValue, number>();
    for (const d of db.documents.values()) {
      if (inProject(d, organizationId, projectId))
        counts.set(d.status, (counts.get(d.status) ?? 0) + 1);
    }
    return [...counts].map(([status, count]) => ({ status, count }));
  },
  countNotesByStatus: async (organizationId: string, projectId: string) => {
    const counts = new Map<SourceStatusValue, number>();
    for (const n of db.notes.values()) {
      if (inProject(n, organizationId, projectId))
        counts.set(n.status, (counts.get(n.status) ?? 0) + 1);
    }
    return [...counts].map(([status, count]) => ({ status, count }));
  },
  listActiveDocuments: async (organizationId: string, projectId: string) =>
    [...db.documents.values()]
      .filter((d) => inProject(d, organizationId, projectId))
      .filter((d) => d.status === 'UPLOADED' || d.status === 'PROCESSING')
      .map((d) => ({ id: d.id, title: d.title, status: d.status })),
  listActiveNotes: async (organizationId: string, projectId: string) =>
    [...db.notes.values()]
      .filter((n) => inProject(n, organizationId, projectId))
      .filter((n) => n.status === 'UPLOADED' || n.status === 'PROCESSING')
      .map((n) => ({ id: n.id, title: n.title, status: n.status })),
  chunkProgress: async (organizationId: string, projectId: string) => {
    const chunks = [...db.chunks.values()].filter((c) => inProject(c, organizationId, projectId));
    return {
      total: chunks.length,
      extracted: chunks.filter((c) => c.extractedAt !== undefined && c.extractedAt !== null).length,
      needingReview: chunks.filter((c) => c.needsReview === true).length,
    };
  },
  latestProcessedAt: async (organizationId: string, projectId: string): Promise<Date | null> => {
    const times = [...db.documents.values(), ...db.notes.values()]
      .filter((s) => inProject(s, organizationId, projectId) && s.status === 'PROCESSED')
      .map((s) => s.updatedAt.getTime());
    return times.length === 0 ? null : new Date(Math.max(...times));
  },
};

type KnowledgeKindKey = 'requirements' | 'rules' | 'modules';

let knowledgeClock = 0;

export function addKnowledge(
  kind: KnowledgeKindKey,
  partial: Pick<FakeKnowledge, 'organizationId' | 'projectId' | 'sourceChunkId'> &
    Partial<FakeKnowledge>,
): FakeKnowledge {
  knowledgeClock += 1;
  const item: FakeKnowledge = {
    id: randomUUID(),
    title: 'Item',
    name: partial.title ?? 'Module',
    code: `M${String(knowledgeClock)}`,
    description: '',
    status: 'OPEN',
    priority: null,
    moduleId: null,
    createdById: null,
    createdAt: new Date(Date.UTC(2026, 0, 1) + knowledgeClock * 1000),
    updatedAt: new Date(Date.UTC(2026, 0, 1) + knowledgeClock * 1000),
    ...partial,
  };
  db[kind].set(item.id, item);
  return item;
}

export function chunkRecord(chunk: FakeChunk) {
  const version = chunk.documentVersionId ? db.versions.get(chunk.documentVersionId) : undefined;
  const document = version ? db.documents.get(version.documentId) : undefined;
  const note = chunk.contextNoteId ? db.notes.get(chunk.contextNoteId) : undefined;
  return {
    id: chunk.id,
    headingPath: chunk.headingPath,
    needsReview: chunk.needsReview ?? false,
    documentVersion:
      version && document
        ? {
            versionNumber: version.versionNumber,
            document: { id: document.id, title: document.title },
          }
        : null,
    contextNote: note ? { id: note.id, title: note.title } : null,
  };
}

function fromSource(chunkId: string, sourceId: string): boolean {
  const chunk = db.chunks.get(chunkId);
  if (!chunk) return false;
  if (chunk.contextNoteId === sourceId) return true;
  const version = chunk.documentVersionId ? db.versions.get(chunk.documentVersionId) : undefined;
  return version?.documentId === sourceId;
}

interface KnowledgeListParams {
  organizationId: string;
  projectId: string;
  page: number;
  pageSize: number;
  status?: FakeKnowledgeStatus | undefined;
  moduleId?: string | undefined;
  sourceId?: string | undefined;
  search?: string | undefined;
  needsReview?: boolean | undefined;
}

function filterKnowledge(kind: KnowledgeKindKey, p: KnowledgeListParams): FakeKnowledge[] {
  const needle = p.search?.toLowerCase();
  return [...db[kind].values()]
    .filter((i) => i.organizationId === p.organizationId && i.projectId === p.projectId)
    .filter((i) => !p.status || i.status === p.status)
    .filter((i) => kind === 'modules' || !p.moduleId || i.moduleId === p.moduleId)
    .filter(
      (i) =>
        !p.needsReview ||
        [i.sourceChunkId, ...(i.extraChunkIds ?? [])].some((id) => db.chunks.get(id)?.needsReview),
    )
    .filter(
      (i) =>
        !p.sourceId ||
        [i.sourceChunkId, ...(i.extraChunkIds ?? [])].some((id) => fromSource(id, p.sourceId as string)),
    )
    .filter((i) => {
      if (!needle) return true;
      const fields =
        kind === 'modules' ? [i.name, i.code, i.description] : [i.title, i.description];
      return fields.some((f) => f.toLowerCase().includes(needle));
    });
}

function creatorOf(id: string | null): { id: string; name: string } | null {
  const user = id ? db.users.get(id) : undefined;
  return user ? { id: user.id, name: user.name } : null;
}

function moduleRef(id: string | null): { id: string; name: string } | null {
  const module = id ? db.modules.get(id) : undefined;
  return module ? { id: module.id, name: module.name } : null;
}

function page<T>(items: T[], p: KnowledgeListParams): { items: T[]; total: number } {
  const start = (p.page - 1) * p.pageSize;
  return { items: items.slice(start, start + p.pageSize), total: items.length };
}

function newestFirst(a: FakeKnowledge, b: FakeKnowledge): number {
  return b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id);
}

function countByStatus(items: FakeKnowledge[]) {
  const counts = new Map<FakeKnowledgeStatus, number>();
  for (const i of items) counts.set(i.status, (counts.get(i.status) ?? 0) + 1);
  return [...counts].map(([status, count]) => ({ status, count }));
}

const inScope = (organizationId: string, projectId: string) => (i: FakeKnowledge) =>
  i.organizationId === organizationId && i.projectId === projectId;

export const knowledgeRepositoryModule = {
  listRequirements: async (p: KnowledgeListParams) =>
    page(
      filterKnowledge('requirements', p)
        .sort(newestFirst)
        .map((i) => ({
          id: i.id,
          title: i.title,
          description: i.description,
          status: i.status,
          priority: i.priority,
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
          module: moduleRef(i.moduleId),
          createdBy: creatorOf(i.createdById),
          sourceChunk: chunkRecord(db.chunks.get(i.sourceChunkId) as FakeChunk),
          extraSources: (i.extraChunkIds ?? []).map((id) => ({
            chunk: chunkRecord(db.chunks.get(id) as FakeChunk),
          })),
        })),
      p,
    ),
  listRules: async (p: KnowledgeListParams) =>
    page(
      filterKnowledge('rules', p)
        .sort(newestFirst)
        .map((i) => ({
          id: i.id,
          title: i.title,
          description: i.description,
          status: i.status,
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
          module: moduleRef(i.moduleId),
          createdBy: creatorOf(i.createdById),
          sourceChunk: chunkRecord(db.chunks.get(i.sourceChunkId) as FakeChunk),
          extraSources: (i.extraChunkIds ?? []).map((id) => ({
            chunk: chunkRecord(db.chunks.get(id) as FakeChunk),
          })),
        })),
      p,
    ),
  listModules: async (p: KnowledgeListParams) =>
    page(
      filterKnowledge('modules', p)
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
        .map((i) => ({
          id: i.id,
          name: i.name,
          code: i.code,
          description: i.description,
          status: i.status,
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
          createdBy: creatorOf(i.createdById),
          sourceChunk: chunkRecord(db.chunks.get(i.sourceChunkId) as FakeChunk),
          extraSources: (i.extraChunkIds ?? []).map((id) => ({
            chunk: chunkRecord(db.chunks.get(id) as FakeChunk),
          })),
          _count: {
            requirements: [...db.requirements.values()].filter((r) => r.moduleId === i.id).length,
          },
        })),
      p,
    ),
  countRequirementsByStatus: async (organizationId: string, projectId: string) =>
    countByStatus([...db.requirements.values()].filter(inScope(organizationId, projectId))),
  countRulesByStatus: async (organizationId: string, projectId: string) =>
    countByStatus([...db.rules.values()].filter(inScope(organizationId, projectId))),
  countModulesByStatus: async (organizationId: string, projectId: string) =>
    countByStatus([...db.modules.values()].filter(inScope(organizationId, projectId))),
  countChunksNeedingReview: async (organizationId: string, projectId: string) =>
    [...db.chunks.values()].filter(
      (c) => c.organizationId === organizationId && c.projectId === projectId && c.needsReview,
    ).length,
  findChunk: async (organizationId: string, projectId: string, chunkId: string) => {
    const chunk = db.chunks.get(chunkId);
    if (!chunk || chunk.organizationId !== organizationId || chunk.projectId !== projectId) {
      return null;
    }
    return { ...chunkRecord(chunk), chunkIndex: chunk.chunkIndex, content: chunk.content };
  },
};

export const auditRepositoryModule = {
  createAuditLog: async (entry: AuditEntry): Promise<void> => {
    db.audit.push(entry);
  },
};
