# Shared schemas, types and exports

> Every file below was compiled, linted and tested in a scratch copy of this repository (2026-10-17). Copy it, then rename. Paths are relative to the repository root.

### `packages/shared/src/constants/milestones.ts`

```ts
export const MILESTONE_STATUSES = ['PLANNED', 'DONE'] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];
```

### `packages/shared/src/schemas/milestone.ts`

```ts
import { z } from 'zod';
import { uuidSchema } from './project.js';

export const createMilestoneSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    dueDate: z.iso.date('Use the format YYYY-MM-DD').nullable().default(null),
  })
  .strict();
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;

/** The form edits the date as text; an empty box means no date. */
export const milestoneFormSchema = z.object({
  title: createMilestoneSchema.shape.title,
  dueDate: z.union([z.literal(''), z.iso.date('Use the format YYYY-MM-DD')]),
});
export type MilestoneFormValues = z.infer<typeof milestoneFormSchema>;

export const listMilestonesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListMilestonesQuery = z.infer<typeof listMilestonesQuerySchema>;

export const milestoneParamsSchema = z.object({ id: uuidSchema, milestoneId: uuidSchema });
export type MilestoneParams = z.infer<typeof milestoneParamsSchema>;
```

### `packages/shared/src/types/milestone.ts`

```ts
import type { MilestoneStatus } from '../constants/milestones.js';

export interface MilestoneDto {
  id: string;
  title: string;
  /** Calendar date as YYYY-MM-DD, or null when no date is set. */
  dueDate: string | null;
  status: MilestoneStatus;
  createdBy: { id: string; name: string };
  createdAt: string;
}
```

### `packages/shared/src/index.ts`

```ts
// packages/shared/src/index.ts — add next to the neighbouring blocks
export {
  createMilestoneSchema,
  milestoneFormSchema,
  type MilestoneFormValues,
  listMilestonesQuerySchema,
  milestoneParamsSchema,
  type CreateMilestoneInput,
  type ListMilestonesQuery,
  type MilestoneParams,
} from './schemas/milestone.js';
export { type MilestoneDto } from './types/milestone.js';
export { MILESTONE_STATUSES, type MilestoneStatus } from './constants/milestones.js';
```

Rebuild shared before the API or web sees the new types: `pnpm build:packages`.
