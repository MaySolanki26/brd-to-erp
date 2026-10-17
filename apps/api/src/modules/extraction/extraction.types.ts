import type { KnowledgeStatus } from '@brd/shared';

export type ExtractedKind = 'module' | 'requirement' | 'rule';

export interface DraftModule {
  name: string;
  description: string;
}

export interface DraftItem {
  title: string;
  description: string;
  /** Matched to a project module by name when applied; null when the text names none. */
  moduleName: string | null;
}

/** The model's answer after trimming, capping and removing repeats. */
export interface Drafts {
  modules: DraftModule[];
  requirements: DraftItem[];
  rules: DraftItem[];
}

/** An item already stored in the project that this chunk's drafts may match, or that this chunk owns. */
export interface ExistingItem {
  kind: ExtractedKind;
  id: string;
  /** The title, or the name for a module. */
  title: string;
  description: string | null;
  status: KnowledgeStatus;
  /** Null when the extraction pipeline made it; set when a person added or edited it. */
  createdById: string | null;
  moduleId: string | null;
  /** This chunk is the item's first source. */
  ownedHere: boolean;
  /** This chunk is one of the item's extra sources. */
  linkedHere: boolean;
  /** Chunks that are extra sources of the item besides this one, oldest first. */
  otherSourceChunkIds: string[];
}

export interface PlannedCreate {
  kind: ExtractedKind;
  title: string;
  description: string;
  moduleName: string | null;
}

export interface PlannedUpdate {
  kind: ExtractedKind;
  id: string;
  /** Set when the extracted wording replaces an unconfirmed item's description. */
  description?: string;
  /** Set when an item that had no module now names one. */
  moduleName?: string;
}

export interface PlannedRemoval {
  kind: ExtractedKind;
  id: string;
  /** Another chunk that already states the item; it becomes the first source instead of deleting. */
  repointTo: string | null;
}

export interface ExtractionPlan {
  create: PlannedCreate[];
  /** Matched items found elsewhere; this chunk is added as another source. */
  link: { kind: ExtractedKind; id: string }[];
  update: PlannedUpdate[];
  /** Unconfirmed items this chunk used to state and no longer does. */
  remove: PlannedRemoval[];
  /** Extra-source links from this chunk to items it no longer states. */
  unlink: { kind: ExtractedKind; id: string }[];
  /** Items flagged NEEDS_REVALIDATION that this chunk states again; they go back to OPEN for a normal review. */
  revalidate: { kind: ExtractedKind; id: string }[];
}

/** Items a person has not confirmed, rejected or flagged; only these may be replaced by a re-run. */
export const REPLACEABLE_STATUSES: readonly KnowledgeStatus[] = ['OPEN', 'ASSUMED'];
