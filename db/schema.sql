CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(2) NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id UUID NOT NULL REFERENCES states(id) ON DELETE RESTRICT,
  number SMALLINT NOT NULL CHECK (number BETWEEN 1 AND 6),
  name TEXT NOT NULL,
  notes TEXT,
  final_notes TEXT,
  final_notes_updated_at TIMESTAMPTZ,
  final_notes_updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (state_id, number)
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('PROFESSOR','COORDENADOR_ESTADUAL','COORDENADOR_GERAL','ADMIN')),
  state_id UUID REFERENCES states(id) ON DELETE SET NULL,
  classroom_id UUID UNIQUE REFERENCES classrooms(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Uma turma pode manter professores antigos inativos no histórico, mas somente
-- um professor ativo pode estar atribuído a ela.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_classroom_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_active_professor_classroom
  ON users(classroom_id)
  WHERE active = TRUE AND role = 'PROFESSOR' AND classroom_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'classrooms_final_notes_updated_by_fkey'
  ) THEN
    ALTER TABLE classrooms
      ADD CONSTRAINT classrooms_final_notes_updated_by_fkey
      FOREIGN KEY (final_notes_updated_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 30),
  name TEXT NOT NULL,
  municipality TEXT,
  final_work_delivered BOOLEAN,
  final_work_updated_at TIMESTAMPTZ,
  final_work_updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  final_status TEXT CHECK (final_status IS NULL OR final_status IN (
    'IN_PROGRESS',
    'READY_FOR_CERTIFICATION',
    'INSUFFICIENT_ATTENDANCE',
    'FINAL_WORK_PENDING',
    'NOT_COMPLETED',
    'PENDING_REVIEW'
  )),
  final_observations TEXT,
  final_review_updated_at TIMESTAMPTZ,
  final_review_updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (classroom_id, position)
);

CREATE TABLE IF NOT EXISTS attendance (
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  module SMALLINT NOT NULL CHECK (module BETWEEN 1 AND 6),
  slot SMALLINT NOT NULL CHECK (slot BETWEEN 1 AND 6),
  status TEXT NOT NULL CHECK (status IN ('P','F','NA')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, module, slot)
);

CREATE INDEX IF NOT EXISTS idx_classrooms_state ON classrooms(state_id);
CREATE INDEX IF NOT EXISTS idx_students_classroom ON students(classroom_id);
CREATE INDEX IF NOT EXISTS idx_students_classroom_municipality ON students(classroom_id, municipality);
CREATE INDEX IF NOT EXISTS idx_students_final_status ON students(final_status);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_module_student ON attendance(module, student_id);
CREATE INDEX IF NOT EXISTS idx_users_state ON users(state_id);
