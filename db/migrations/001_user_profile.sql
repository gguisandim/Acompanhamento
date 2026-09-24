ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_classroom_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_active_professor_classroom
  ON users(classroom_id)
  WHERE active = TRUE AND role = 'PROFESSOR' AND classroom_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_module_student
  ON attendance(module, student_id);
