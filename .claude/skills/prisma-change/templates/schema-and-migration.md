# Schema, migration and seed

> Every file below was compiled, linted and tested in a scratch copy of this repository (2026-10-17). Copy it, then rename. Paths are relative to the repository root.

### `apps/api/prisma/schema.prisma`: the new enum and model

```prisma
enum MilestoneStatus {
  PLANNED
  DONE
}

model Milestone {
  id             String          @id @default(uuid()) @db.Uuid
  title          String
  dueDate        DateTime?       @db.Date
  status         MilestoneStatus @default(PLANNED)
  projectId      String          @db.Uuid
  organizationId String          @db.Uuid
  createdById    String          @db.Uuid
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  project   Project @relation(fields: [projectId], references: [id])
  createdBy User    @relation(fields: [createdById], references: [id])

  @@index([projectId, dueDate])
  @@index([organizationId])
  @@index([status])
  @@index([createdById])
  @@map("milestones")
}
```

### Back-relations on the parent models

```prisma
model Project {
  // ...
  milestones    Milestone[]
}

model User {
  // ...
  createdMilestones    Milestone[]
}
```

### `apps/api/prisma/migrations/<timestamp>_milestones/migration.sql` (output of `prisma migrate diff --script`)

```sql
-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PLANNED', 'DONE');

-- CreateTable
CREATE TABLE "milestones" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" DATE,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PLANNED',
    "projectId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "milestones_projectId_dueDate_idx" ON "milestones"("projectId", "dueDate");

-- CreateIndex
CREATE INDEX "milestones_organizationId_idx" ON "milestones"("organizationId");

-- CreateIndex
CREATE INDEX "milestones_status_idx" ON "milestones"("status");

-- CreateIndex
CREATE INDEX "milestones_createdById_idx" ON "milestones"("createdById");

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

The folder name is `<UTC timestamp>_<description>`, for example `20261018090000_milestones`. Prisma creates it for you.

## Safe changes to tables that already have rows

### Nullable, backfill, tighten

```sql
-- Illustration: the Milestone model above has no priority column; this is how one would be added later.
-- Decision: milestones created before priorities existed count as priority 0; new rows must set one.
ALTER TABLE "milestones" ADD COLUMN "priority" INTEGER;
UPDATE "milestones" SET "priority" = 0 WHERE "priority" IS NULL;
ALTER TABLE "milestones" ALTER COLUMN "priority" SET NOT NULL;
```

### Guard: refuse to guess (the start of the real `20261017090000_knowledge_items` migration)

```sql
-- Business rules and modules now require a source chunk and modules belong to a project.
-- Rows written before this migration cannot be given one, so refuse to guess.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "business_rules") OR EXISTS (SELECT 1 FROM "modules") THEN
    RAISE EXCEPTION 'business_rules and modules must be empty before this migration: existing rows have no source chunk or project. Export or delete them first.';
  END IF;
END $$;
```

### Enum value change with a USING cast

```sql
-- From the same migration: changing an enum column needs an explicit cast.
ALTER TABLE "requirements" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "requirements" ALTER COLUMN "status" TYPE "KnowledgeStatus"
  USING (CASE "status"::text WHEN 'RECOMMENDED' THEN 'OPEN' ELSE "status"::text END)::"KnowledgeStatus";
ALTER TABLE "requirements" ALTER COLUMN "status" SET DEFAULT 'OPEN';
```

### `apps/api/prisma/seed.ts`: an idempotent seed row

```ts
/** Re-running the seed must not duplicate rows, so look the row up by its natural key first. */
async function ensureMilestone(
  scope: { organizationId: string; projectId: string; createdById: string },
  title: string,
  dueDate: string | null,
): Promise<void> {
  const existing = await prisma.milestone.findFirst({
    where: { projectId: scope.projectId, title },
    select: { id: true },
  });
  if (existing) return;
  await prisma.milestone.create({
    data: { ...scope, title, dueDate: dueDate ? new Date(`${dueDate}T00:00:00.000Z`) : null },
  });
}

// In main(), after the projects and members exist:
//   const alphaScope = { organizationId: org.id, projectId: projectA.id, createdById: alice.id };
//   await ensureMilestone(alphaScope, 'Requirements signed off', '2026-03-31');
//   await ensureMilestone(alphaScope, 'Go live', null);
```
