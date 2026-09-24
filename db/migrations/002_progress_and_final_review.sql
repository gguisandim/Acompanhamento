ALTER TABLE classrooms
  ADD COLUMN IF NOT EXISTS final_notes TEXT,
  ADD COLUMN IF NOT EXISTS final_notes_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS final_notes_updated_by UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS final_work_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS final_work_updated_by UUID,
  ADD COLUMN IF NOT EXISTS final_status TEXT,
  ADD COLUMN IF NOT EXISTS final_observations TEXT,
  ADD COLUMN IF NOT EXISTS final_review_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS final_review_updated_by UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'classrooms_final_notes_updated_by_fkey'
  ) THEN
    ALTER TABLE classrooms
      ADD CONSTRAINT classrooms_final_notes_updated_by_fkey
      FOREIGN KEY (final_notes_updated_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_final_work_updated_by_fkey'
  ) THEN
    ALTER TABLE students
      ADD CONSTRAINT students_final_work_updated_by_fkey
      FOREIGN KEY (final_work_updated_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_final_review_updated_by_fkey'
  ) THEN
    ALTER TABLE students
      ADD CONSTRAINT students_final_review_updated_by_fkey
      FOREIGN KEY (final_review_updated_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_final_status_check'
  ) THEN
    ALTER TABLE students
      ADD CONSTRAINT students_final_status_check
      CHECK (final_status IS NULL OR final_status IN (
        'IN_PROGRESS',
        'READY_FOR_CERTIFICATION',
        'INSUFFICIENT_ATTENDANCE',
        'FINAL_WORK_PENDING',
        'NOT_COMPLETED',
        'PENDING_REVIEW'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_classroom_municipality
  ON students(classroom_id, municipality);

CREATE INDEX IF NOT EXISTS idx_students_final_status
  ON students(final_status);
