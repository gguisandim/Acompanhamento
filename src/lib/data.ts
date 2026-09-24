import { db } from "./db";
import type { AttendanceStatus, ClassroomScope, CurrentUser } from "./types";

export type ClassroomCard = {
  id: string;
  name: string;
  number: number;
  state_id: string;
  state_code: string;
  state_name: string;
  student_count: number;
  apt_count: number;
  certified_count: number;
};

type ClassroomListRow = {
  id: string;
  name: string;
  number: number;
  state_id: string;
  state_code: string;
  state_name: string;
};

export async function getAccessibleClassrooms(user: CurrentUser): Promise<ClassroomCard[]> {
  const sql = db();
  let classrooms: ClassroomListRow[] = [];

  if (user.role === "ADMIN" || user.role === "COORDENADOR_GERAL") {
    const rows = await sql`
      SELECT c.id, c.name, c.number, c.state_id, s.code AS state_code, s.name AS state_name
      FROM classrooms c
      JOIN states s ON s.id = c.state_id
      ORDER BY s.name, c.number
    `;
    classrooms = rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      number: Number(row.number),
      state_id: String(row.state_id),
      state_code: String(row.state_code),
      state_name: String(row.state_name)
    }));
  } else if (user.role === "COORDENADOR_ESTADUAL" && user.stateId) {
    const rows = await sql`
      SELECT c.id, c.name, c.number, c.state_id, s.code AS state_code, s.name AS state_name
      FROM classrooms c
      JOIN states s ON s.id = c.state_id
      WHERE c.state_id = ${user.stateId}
      ORDER BY c.number
    `;
    classrooms = rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      number: Number(row.number),
      state_id: String(row.state_id),
      state_code: String(row.state_code),
      state_name: String(row.state_name)
    }));
  } else if (user.role === "PROFESSOR" && user.stateId) {
    const rows = await sql`
      SELECT c.id, c.name, c.number, c.state_id, s.code AS state_code, s.name AS state_name
      FROM classrooms c
      JOIN states s ON s.id = c.state_id
      WHERE c.state_id = ${user.stateId}
      ORDER BY c.number
    `;
    classrooms = rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      number: Number(row.number),
      state_id: String(row.state_id),
      state_code: String(row.state_code),
      state_name: String(row.state_name)
    }));
  }

  if (classrooms.length === 0) return [];

  const ids = classrooms.map((row) => row.id);
  const stats = await sql`
    WITH student_frequency AS (
      SELECT
        st.id AS student_id,
        st.classroom_id,
        st.final_work_delivered,
        COUNT(*) FILTER (WHERE a.status = 'P')::float AS presences,
        COUNT(*) FILTER (WHERE a.status IN ('P','F'))::float AS considered
      FROM students st
      LEFT JOIN attendance a ON a.student_id = st.id
      WHERE st.classroom_id IN ${sql(ids)}
      GROUP BY st.id, st.classroom_id, st.final_work_delivered
    )
    SELECT
      c.id AS classroom_id,
      COUNT(sf.student_id)::int AS student_count,
      COUNT(sf.student_id) FILTER (
        WHERE sf.considered > 0 AND sf.presences / sf.considered >= 0.75
      )::int AS apt_count,
      COUNT(sf.student_id) FILTER (
        WHERE sf.considered > 0
          AND sf.presences / sf.considered >= 0.75
          AND sf.final_work_delivered = TRUE
      )::int AS certified_count
    FROM classrooms c
    LEFT JOIN student_frequency sf ON sf.classroom_id = c.id
    WHERE c.id IN ${sql(ids)}
    GROUP BY c.id
  `;

  const byId = new Map(stats.map((row) => [row.classroom_id, row]));
  return classrooms.map((row) => {
    const stat = byId.get(row.id);
    return {
      id: row.id,
      name: row.name,
      number: Number(row.number),
      state_id: row.state_id,
      state_code: row.state_code,
      state_name: row.state_name,
      student_count: Number(stat?.student_count ?? 0),
      apt_count: Number(stat?.apt_count ?? 0),
      certified_count: Number(stat?.certified_count ?? 0)
    };
  });
}

export type ClassroomDetail = ClassroomScope & {
  name: string;
  number: number;
  notes: string | null;
  state_code: string;
  state_name: string;
};

export async function getClassroom(id: string): Promise<ClassroomDetail | null> {
  const sql = db();
  const [row] = await sql`
    SELECT c.id, c.name, c.number, c.state_id, c.notes,
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
    state_code: String(row.state_code),
    state_name: String(row.state_name)
  };
}

export type ClassroomOverview = {
  studentCount: number;
  averageFrequency: number | null;
  aptCount: number;
  belowMinimum: number;
  professorName: string | null;
};

export async function getClassroomOverview(classroomId: string): Promise<ClassroomOverview> {
  const sql = db();
  const [row] = await sql`
    WITH student_frequency AS (
      SELECT st.id, st.final_work_delivered,
             COUNT(a.student_id) FILTER (WHERE a.status = 'P')::float AS presences,
             COUNT(a.student_id) FILTER (WHERE a.status IN ('P', 'F'))::float AS considered
      FROM students st
      LEFT JOIN attendance a ON a.student_id = st.id
      WHERE st.classroom_id = ${classroomId}
      GROUP BY st.id, st.final_work_delivered
    )
    SELECT
      COUNT(sf.id)::int AS student_count,
      AVG(CASE WHEN sf.considered > 0 THEN sf.presences / sf.considered END)::float AS average_frequency,
      COUNT(sf.id) FILTER (
        WHERE sf.considered > 0
          AND sf.presences / sf.considered >= 0.75
          AND sf.final_work_delivered = TRUE
      )::int AS apt_count,
      COUNT(sf.id) FILTER (
        WHERE sf.considered > 0 AND sf.presences / sf.considered < 0.75
      )::int AS below_minimum,
      (
        SELECT u.name FROM users u
        WHERE u.classroom_id = ${classroomId}
          AND u.role = 'PROFESSOR'
          AND u.active = TRUE
        LIMIT 1
      ) AS professor_name
    FROM student_frequency sf
  `;

  return {
    studentCount: Number(row?.student_count ?? 0),
    averageFrequency: row?.average_frequency == null ? null : Number(row.average_frequency),
    aptCount: Number(row?.apt_count ?? 0),
    belowMinimum: Number(row?.below_minimum ?? 0),
    professorName: row?.professor_name == null ? null : String(row.professor_name)
  };
}

export type StudentDetail = {
  id: string;
  position: number;
  name: string;
  municipality: string | null;
  finalWorkDelivered: boolean | null;
  attendance: Record<string, AttendanceStatus>;
};

export async function getClassroomStudents(classroomId: string): Promise<StudentDetail[]> {
  const sql = db();
  const students = await sql`
    SELECT id, position, name, municipality, final_work_delivered
    FROM students
    WHERE classroom_id = ${classroomId}
    ORDER BY position
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
    attendance: byStudent.get(student.id) ?? {}
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
