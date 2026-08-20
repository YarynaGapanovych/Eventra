-- Data-preserving split: Google/scheduled Task rows become Event rows, then Task is slimmed.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventSource') THEN
    CREATE TYPE "EventSource" AS ENUM ('eventra', 'google');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Event" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "start" TIMESTAMP(3) NOT NULL,
  "end" TIMESTAMP(3) NOT NULL,
  "source" "EventSource" NOT NULL DEFAULT 'eventra',
  "googleEventId" TEXT,
  "taskId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UserSettings"
  ADD COLUMN IF NOT EXISTS "showPastDoneTaskEvents" BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Task' AND column_name = 'source'
  ) THEN
    INSERT INTO "Event" (
      "id",
      "userId",
      "title",
      "start",
      "end",
      "source",
      "googleEventId",
      "taskId",
      "createdAt",
      "updatedAt"
    )
    SELECT
      "id",
      "userId",
      "name",
      "startDate",
      "endDate",
      'google'::"EventSource",
      "googleEventId",
      NULL,
      "createdAt",
      "updatedAt"
    FROM "Task"
    WHERE "source" = 'google'
      AND NOT EXISTS (SELECT 1 FROM "Event" e WHERE e."id" = "Task"."id");

    DELETE FROM "Task" WHERE "source" = 'google';

    INSERT INTO "Event" (
      "id",
      "userId",
      "title",
      "start",
      "end",
      "source",
      "googleEventId",
      "taskId",
      "createdAt",
      "updatedAt"
    )
    SELECT
      'evt_' || "id",
      "userId",
      "name",
      "startDate",
      "endDate",
      'eventra'::"EventSource",
      NULL,
      "id",
      "createdAt",
      "updatedAt"
    FROM "Task"
    WHERE "source" = 'eventra'
      AND "scheduled" = true
      AND NOT EXISTS (
        SELECT 1 FROM "Event" e WHERE e."taskId" = "Task"."id"
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Event_userId_googleEventId_key'
  ) THEN
    ALTER TABLE "Event"
      ADD CONSTRAINT "Event_userId_googleEventId_key" UNIQUE ("userId", "googleEventId");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Event_userId_start_idx" ON "Event" ("userId", "start");
CREATE INDEX IF NOT EXISTS "Event_taskId_idx" ON "Event" ("taskId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Event_userId_fkey'
  ) THEN
    ALTER TABLE "Event"
      ADD CONSTRAINT "Event_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Event_taskId_fkey'
  ) THEN
    ALTER TABLE "Event"
      ADD CONSTRAINT "Event_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Task" DROP COLUMN IF EXISTS "startDate";
ALTER TABLE "Task" DROP COLUMN IF EXISTS "endDate";
ALTER TABLE "Task" DROP COLUMN IF EXISTS "scheduled";
ALTER TABLE "Task" DROP COLUMN IF EXISTS "googleEventId";
ALTER TABLE "Task" DROP COLUMN IF EXISTS "source";

DROP TYPE IF EXISTS "TaskSource";
