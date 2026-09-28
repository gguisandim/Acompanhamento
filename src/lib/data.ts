import { db } from "./db";
import type { AttendanceStatus, ClassroomScope, CurrentUser, FinalStatus } from "./types";

export type ClassroomDetail = ClassroomScope & {
  name: string;
  number: number;
  notes: string | null;
  finalNotes: string | null;
  state_code: string;
  state_name: string;
};

export async function getClassroom(id: string): Promise<ClassroomDetail | null> {
  const sql = db();
  const [row] = await sql`
    SELECT c.id, c.name, c.number, c.state_id, c.notes, c.final_notes,
           s.code AS state_code, s.name AS state_name
    FROM classrooms c
    JOIN states s ON s.id = c.state_id
    WHERE c.id = ${id}
    LIMIT 1
  `;
  if (!row) return null;

  return {
    id: String(row.id),
    name: String(row.name),
    number: Number(row.number),
    state_id: String(row.state_id),
    notes: row.notes == null ? null : String(row.notes),
    finalNotes: row.final_notes == null ? null : String(row.final_notes),
    state_code: String(row.state_code),
    state_name: String(row.state_name)
  };
}

export type ClassroomOverview = {
  studentCount: number;
  averageFrequency: number | null;
  averageProgress: number;
  aptCount: number;
  belowMinimum: number;
  pendingFinalWork: number;
  professorName: string | null;
};

export async function getClassroomOverview(classroomId: string): Promise<ClassroomOverview> {
  const sql = db();
  const [row] = await sql`
    WITH student_frequency AS (
      SELECT st.id, st.final_work_delivered, st.final_status,
             COUNT(a.student_id) FILTER (WHERE a.status = 'P')::float AS presences,
             COUNT(a.student_id) FILTER (WHERE a.status IN ('P', 'F'))::float AS considered,
             COUNT(a.student_id)::float AS filled
      FROM students st
      LEFT JOIN attendance a ON a.student_id = st.id
      WHERE st.classroom_id = ${classroomId}
      GROUP BY st.id, st.final_work_delivered, st.final_status
    ), student_status AS (
      SELECT *,
        CASE
          WHEN final_status IS NOT NULL THEN final_status
          WHEN filled < 36 THEN 'IN_PROGRESS'
          WHEN considered = 0 THEN 'PENDING_REVIEW'
          WHEN presences / considered < 0.75 THEN 'INSUFFICIENT_ATTENDANCE'
          WHEN final_work_delivered IS NULL THEN 'FINAL_WORK_PENDING'
          WHEN final_work_delivered = FALSE THEN 'NOT_COMPLETED'
          ELSE 'READY_FOR_CERTIFICATION'
        END AS effective_status
      FROM student_frequency
    )
    SELECT
      COUNT(sf.id)::int AS student_count,
      AVG(CASE WHEN sf.considered > 0 THEN sf.presences / sf.considered END)::float AS average_frequency,
      COALESCE(AVG(sf.filled / 36.0), 0)::float AS average_progress,
      COUNT(sf.id) FILTER (
        WHERE sf.effective_status = 'READY_FOR_CERTIFICATION'
      )::int AS apt_count,
      COUNT(sf.id) FILTER (
        WHERE sf.considered > 0 AND sf.presences / sf.considered < 0.75
      )::int AS below_minimum,
      COUNT(sf.id) FILTER (WHERE sf.final_work_delivered IS NULL)::int AS pending_final_work,
      (
        SELECT u.name FROM users u
        WHERE u.classroom_id = ${classroomId}
          AND u.role = 'PROFESSOR'
          AND u.active = TRUE
        LIMIT 1
      ) AS professor_name
    FROM student_status sf
  `;

  return {
    studentCount: Number(row?.student_count ?? 0),
    averageFrequency: row?.average_frequency == null ? null : Number(row.average_frequency),
    averageProgress: Number(row?.average_progress ?? 0),
    aptCount: Number(row?.apt_count ?? 0),
    belowMinimum: Number(row?.below_minimum ?? 0),
    pendingFinalWork: Number(row?.pending_final_work ?? 0),
    professorName: row?.professor_name == null ? null : String(row.professor_name)
  };
}

export type StudentDetail = {
  id: string;
  position: number;
  name: string;
  municipality: string | null;
  finalWorkDelivered: boolean | null;
  finalStatus: FinalStatus | null;
  finalObservations: string | null;
  finalReviewJustification: string | null;
  finalWorkUpdatedAt: string | null;
  finalReviewUpdatedAt: string | null;
  finalReviewUpdatedByName: string | null;
  lastAttendanceUpdatedAt: string | null;
  attendance: Record<string, AttendanceStatus>;
};

export async function getClassroomStudents(classroomId: string): Promise<StudentDetail[]> {
  const sql = db();
  const students = await sql`
    SELECT st.id, st.position, st.name, st.municipality, st.final_work_delivered,
           st.final_status, st.final_observations, st.final_review_justification,
           st.final_work_updated_at, st.final_review_updated_at,
           reviewer.name AS final_review_updated_by_name,
           MAX(a.updated_at) AS last_attendance_updated_at
    FROM students st
    LEFT JOIN users reviewer ON reviewer.id = st.final_review_updated_by
    LEFT JOIN attendance a ON a.student_id = st.id
    WHERE st.classroom_id = ${classroomId}
    GROUP BY st.id, reviewer.name
    ORDER BY st.position
  `;
  if (students.length === 0) return [];

  const ids = students.map((student) => student.id);
  const attendance = await sql`
    SELECT student_id, module, slot, status
    FROM attendance
    WHERE student_id IN ${sql(ids)}
    ORDER BY module, slot
  `;

  const byStudent = new Map<string, Record<string, AttendanceStatus>>();
  for (const item of attendance) {
    const current = byStudent.get(item.student_id) ?? {};
    current[`${item.module}-${item.slot}`] = item.status as AttendanceStatus;
    byStudent.set(item.student_id, current);
  }

  return students.map((student) => ({
    id: student.id,
    position: Number(student.position),
    name: student.name,
    municipality: student.municipality,
    finalWorkDelivered: student.final_work_delivered,
    finalStatus: student.final_status as FinalStatus | null,
    finalObservations: student.final_observations == null ? null : String(student.final_observations),
    finalReviewJustification: student.final_review_justification == null ? null : String(student.final_review_justification),
    finalWorkUpdatedAt: student.final_work_updated_at == null ? null : new Date(student.final_work_updated_at).toISOString(),
    finalReviewUpdatedAt: student.final_review_updated_at == null ? null : new Date(student.final_review_updated_at).toISOString(),
    finalReviewUpdatedByName: student.final_review_updated_by_name == null ? null : String(student.final_review_updated_by_name),
    lastAttendanceUpdatedAt: student.last_attendance_updated_at == null ? null : new Date(student.last_attendance_updated_at).toISOString(),
    attendance: byStudent.get(student.id) ?? {}
  }));
}

export type StudentSearchResult = {
  id: string;
  name: string;
  municipality: string | null;
  classroomId: string;
  classroomName: string;
  stateCode: string;
  frequency: number | null;
  progress: number;
};

export async function searchAccessibleStudents(user: CurrentUser, term: string): Promise<StudentSearchResult[]> {
  const query = term.trim();
  if (query.length < 2) return [];

  const sql = db();
  const unrestricted = user.role === "ADMIN" || user.role === "COORDENADOR_GERAL";
  const rows = await sql`
    SELECT st.id, st.name, st.municipality, c.id AS classroom_id, c.name AS classroom_name, s.code AS state_code,
           CASE WHEN COUNT(a.student_id) FILTER (WHERE a.status IN ('P','F')) > 0
             THEN COUNT(a.student_id) FILTER (WHERE a.status='P')::float
                  / COUNT(a.student_id) FILTER (WHERE a.status IN ('P','F'))
           END AS frequency,
           COUNT(a.student_id)::float / 36.0 AS progress
    FROM students st
    JOIN classrooms c ON c.id = st.classroom_id
    JOIN states s ON s.id = c.state_id
    LEFT JOIN attendance a ON a.student_id = st.id
    WHERE (${unrestricted} OR c.state_id = ${user.stateId})
      AND (
        st.name ILIKE ${`%${query}%`}
        OR COALESCE(st.municipality, '') ILIKE ${`%${query}%`}
        OR c.name ILIKE ${`%${query}%`}
      )
    GROUP BY st.id, c.id, c.name, s.code
    ORDER BY st.name, c.name
    LIMIT 30
  `;

  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    municipality: row.municipality == null ? null : String(row.municipality),
    classroomId: String(row.classroom_id),
    classroomName: String(row.classroom_name),
    stateCode: String(row.state_code),
    frequency: row.frequency == null ? null : Number(row.frequency),
    progress: Number(row.progress ?? 0)
  }));
}

export async function getStatesAndClassrooms() {
  const sql = db();
  const states = await sql`
    SELECT id, code, name FROM states ORDER BY name
  `;
  const classrooms = await sql`
    SELECT c.id, c.name, c.number, c.state_id, s.code AS state_code
    FROM classrooms c
    JOIN states s ON s.id = c.state_id
    ORDER BY s.name, c.number
  `;
  return { states, classrooms };
}

export async function getUsers() {
  const sql = db();
  return sql`
    SELECT u.id, u.name, u.email, u.role, u.active, u.state_id, u.classroom_id,
           u.last_login_at, u.updated_at,
           s.code AS state_code, s.name AS state_name,
           c.name AS classroom_name
    FROM users u
    LEFT JOIN states s ON s.id = u.state_id
    LEFT JOIN classrooms c ON c.id = u.classroom_id
    ORDER BY u.name
  `;
}
