import { db } from "./db";
import type { CurrentUser } from "./types";

export type DashboardQuery = {
  estado?: string;
  turma?: string;
  modulo?: string;
  situacao?: string;
  trabalho?: string;
};

export type DashboardFilters = {
  stateId: string;
  stateCode: string;
  stateName: string;
  classroomId: string | null;
  classroomName: string | null;
  module: number | null;
  situation: "apto" | "nao-apto" | "abaixo-75" | null;
  finalWork: "entregou" | "nao-entregou" | null;
};

export type DashboardStateOption = { id: string; code: string; name: string };
export type DashboardClassroomOption = {
  id: string;
  name: string;
  number: number;
  stateId: string;
  stateCode: string;
};

export type DashboardOverview = {
  totalStudents: number;
  averageFrequency: number | null;
  aptStudents: number;
  belowMinimum: number;
  pendingFinalWork: number;
  classrooms: number;
};

export type ClassroomSummary = {
  id: string;
  name: string;
  number: number;
  students: number;
  averageFrequency: number | null;
  aptStudents: number;
  belowMinimum: number;
  pendingFinalWork: number;
};

export type ModuleSummary = { module: number; averageFrequency: number | null };

export type DashboardData = {
  overview: DashboardOverview;
  classrooms: ClassroomSummary[];
  modules: ModuleSummary[];
  finalWork: { delivered: number; pending: number };
};

export type DashboardModel = {
  filters: DashboardFilters;
  states: DashboardStateOption[];
  classroomOptions: DashboardClassroomOption[];
  data: DashboardData;
  canSelectState: boolean;
};

type OptionRow = {
  id: string;
  name: string;
  number: number;
  state_id: string;
  state_code: string;
  state_name: string;
};

function cleanCode(value: string | undefined) {
  return value?.trim().toUpperCase() ?? "";
}

function parseModule(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 6 ? parsed : null;
}

function parseSituation(value: string | undefined): DashboardFilters["situation"] {
  return value === "apto" || value === "nao-apto" || value === "abaixo-75" ? value : null;
}

function parseFinalWork(value: string | undefined): DashboardFilters["finalWork"] {
  return value === "entregou" || value === "nao-entregou" ? value : null;
}

export async function getDashboardModel(
  user: CurrentUser,
  query: DashboardQuery
): Promise<DashboardModel | null> {
  const sql = db();
  const canSelectState = user.role === "ADMIN" || user.role === "COORDENADOR_GERAL";

  const optionRows = await sql`
    SELECT c.id, c.name, c.number, c.state_id,
           s.code AS state_code, s.name AS state_name
    FROM classrooms c
    JOIN states s ON s.id = c.state_id
    WHERE ${canSelectState} OR c.state_id = ${user.stateId}
    ORDER BY s.name, c.number
  `;

  const options: OptionRow[] = optionRows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    number: Number(row.number),
    state_id: String(row.state_id),
    state_code: String(row.state_code),
    state_name: String(row.state_name)
  }));
  if (options.length === 0) return null;

  const states = Array.from(
    new Map(
      options.map((item) => [
        item.state_id,
        { id: item.state_id, code: item.state_code, name: item.state_name }
      ])
    ).values()
  );

  const requestedState = cleanCode(query.estado);
  const selectedState = canSelectState
    ? states.find((state) => state.code === requestedState)
      ?? states.find((state) => state.code === "PA")
      ?? states[0]
    : states[0];

  const classroomOptions = options
    .filter((item) => item.state_id === selectedState.id)
    .map((item) => ({
      id: item.id,
      name: item.name,
      number: item.number,
      stateId: item.state_id,
      stateCode: item.state_code
    }));
  const requestedClassroom = query.turma?.trim() ?? "";
  const selectedClassroom = classroomOptions.find(
    (classroom) => classroom.id === requestedClassroom || classroom.name === requestedClassroom.toUpperCase()
  ) ?? null;

  const filters: DashboardFilters = {
    stateId: selectedState.id,
    stateCode: selectedState.code,
    stateName: selectedState.name,
    classroomId: selectedClassroom?.id ?? null,
    classroomName: selectedClassroom?.name ?? null,
    module: parseModule(query.modulo),
    situation: parseSituation(query.situacao),
    finalWork: parseFinalWork(query.trabalho)
  };

  const moduleFilter = filters.module;
  const classroomFilter = filters.classroomId;
  const situationFilter = filters.situation;
  const workFilter = filters.finalWork;

  const [overviewRow, classroomRows, moduleRows, finalWorkRow] = await Promise.all([
    sql`
      WITH selected_classrooms AS (
        SELECT c.id
        FROM classrooms c
        WHERE c.state_id = ${filters.stateId}
          AND (${classroomFilter}::uuid IS NULL OR c.id = ${classroomFilter}::uuid)
      ), student_counts AS (
        SELECT st.id AS student_id, st.classroom_id, st.final_work_delivered,
               COUNT(a.student_id) FILTER (WHERE a.status = 'P')::float AS presences,
               COUNT(a.student_id) FILTER (WHERE a.status IN ('P', 'F'))::float AS considered
        FROM students st
        JOIN selected_classrooms sc ON sc.id = st.classroom_id
        LEFT JOIN attendance a ON a.student_id = st.id
          AND (${moduleFilter}::int IS NULL OR a.module = ${moduleFilter}::int)
        GROUP BY st.id, st.classroom_id, st.final_work_delivered
      ), student_stats AS (
        SELECT *,
          CASE WHEN considered > 0 THEN presences / considered ELSE NULL END AS frequency,
          COALESCE(considered > 0 AND presences / considered >= 0.75 AND final_work_delivered = TRUE, FALSE) AS is_apt
        FROM student_counts
      ), filtered_students AS (
        SELECT * FROM student_stats
        WHERE (
          ${situationFilter}::text IS NULL
          OR (${situationFilter} = 'apto' AND is_apt)
          OR (${situationFilter} = 'nao-apto' AND NOT is_apt)
          OR (${situationFilter} = 'abaixo-75' AND frequency < 0.75)
        )
        AND (
          ${workFilter}::text IS NULL
          OR (${workFilter} = 'entregou' AND final_work_delivered = TRUE)
          OR (${workFilter} = 'nao-entregou' AND final_work_delivered IS NOT TRUE)
        )
      )
      SELECT
        COUNT(fs.student_id)::int AS total_students,
        AVG(fs.frequency)::float AS average_frequency,
        COUNT(fs.student_id) FILTER (WHERE fs.is_apt)::int AS apt_students,
        COUNT(fs.student_id) FILTER (WHERE fs.frequency < 0.75)::int AS below_minimum,
        COUNT(fs.student_id) FILTER (WHERE fs.final_work_delivered IS NOT TRUE)::int AS pending_final_work,
        (SELECT COUNT(*)::int FROM selected_classrooms) AS classrooms
      FROM filtered_students fs
    `,
    sql`
      WITH selected_classrooms AS (
        SELECT c.id, c.name, c.number
        FROM classrooms c
        WHERE c.state_id = ${filters.stateId}
          AND (${classroomFilter}::uuid IS NULL OR c.id = ${classroomFilter}::uuid)
      ), student_counts AS (
        SELECT st.id AS student_id, st.classroom_id, st.final_work_delivered,
               COUNT(a.student_id) FILTER (WHERE a.status = 'P')::float AS presences,
               COUNT(a.student_id) FILTER (WHERE a.status IN ('P', 'F'))::float AS considered
        FROM students st
        JOIN selected_classrooms sc ON sc.id = st.classroom_id
        LEFT JOIN attendance a ON a.student_id = st.id
          AND (${moduleFilter}::int IS NULL OR a.module = ${moduleFilter}::int)
        GROUP BY st.id, st.classroom_id, st.final_work_delivered
      ), student_stats AS (
        SELECT *,
          CASE WHEN considered > 0 THEN presences / considered ELSE NULL END AS frequency,
          COALESCE(considered > 0 AND presences / considered >= 0.75 AND final_work_delivered = TRUE, FALSE) AS is_apt
        FROM student_counts
      ), filtered_students AS (
        SELECT * FROM student_stats
        WHERE (
          ${situationFilter}::text IS NULL
          OR (${situationFilter} = 'apto' AND is_apt)
          OR (${situationFilter} = 'nao-apto' AND NOT is_apt)
          OR (${situationFilter} = 'abaixo-75' AND frequency < 0.75)
        )
        AND (
          ${workFilter}::text IS NULL
          OR (${workFilter} = 'entregou' AND final_work_delivered = TRUE)
          OR (${workFilter} = 'nao-entregou' AND final_work_delivered IS NOT TRUE)
        )
      )
      SELECT sc.id, sc.name, sc.number,
             COUNT(fs.student_id)::int AS students,
             AVG(fs.frequency)::float AS average_frequency,
             COUNT(fs.student_id) FILTER (WHERE fs.is_apt)::int AS apt_students,
             COUNT(fs.student_id) FILTER (WHERE fs.frequency < 0.75)::int AS below_minimum,
             COUNT(fs.student_id) FILTER (WHERE fs.final_work_delivered IS NOT TRUE)::int AS pending_final_work
      FROM selected_classrooms sc
      LEFT JOIN filtered_students fs ON fs.classroom_id = sc.id
      GROUP BY sc.id, sc.name, sc.number
      ORDER BY sc.number
    `,
    sql`
      WITH selected_classrooms AS (
        SELECT c.id
        FROM classrooms c
        WHERE c.state_id = ${filters.stateId}
          AND (${classroomFilter}::uuid IS NULL OR c.id = ${classroomFilter}::uuid)
      ), student_counts AS (
        SELECT st.id AS student_id, st.final_work_delivered,
               COUNT(a.student_id) FILTER (WHERE a.status = 'P')::float AS presences,
               COUNT(a.student_id) FILTER (WHERE a.status IN ('P', 'F'))::float AS considered
        FROM students st
        JOIN selected_classrooms sc ON sc.id = st.classroom_id
        LEFT JOIN attendance a ON a.student_id = st.id
          AND (${moduleFilter}::int IS NULL OR a.module = ${moduleFilter}::int)
        GROUP BY st.id, st.final_work_delivered
      ), student_stats AS (
        SELECT *,
          CASE WHEN considered > 0 THEN presences / considered ELSE NULL END AS frequency,
          COALESCE(considered > 0 AND presences / considered >= 0.75 AND final_work_delivered = TRUE, FALSE) AS is_apt
        FROM student_counts
      ), filtered_students AS (
        SELECT * FROM student_stats
        WHERE (
          ${situationFilter}::text IS NULL
          OR (${situationFilter} = 'apto' AND is_apt)
          OR (${situationFilter} = 'nao-apto' AND NOT is_apt)
          OR (${situationFilter} = 'abaixo-75' AND frequency < 0.75)
        )
        AND (
          ${workFilter}::text IS NULL
          OR (${workFilter} = 'entregou' AND final_work_delivered = TRUE)
          OR (${workFilter} = 'nao-entregou' AND final_work_delivered IS NOT TRUE)
        )
      )
      , module_student_counts AS (
        SELECT a.module, fs.student_id,
               COUNT(*) FILTER (WHERE a.status = 'P')::float AS presences,
               COUNT(*) FILTER (WHERE a.status IN ('P', 'F'))::float AS considered
        FROM filtered_students fs
        JOIN attendance a ON a.student_id = fs.student_id
        WHERE ${moduleFilter}::int IS NULL OR a.module = ${moduleFilter}::int
        GROUP BY a.module, fs.student_id
      )
      SELECT module,
             AVG(CASE WHEN considered > 0 THEN presences / considered END)::float AS average_frequency
      FROM module_student_counts
      GROUP BY module
      ORDER BY module
    `,
    sql`
      WITH selected_classrooms AS (
        SELECT c.id
        FROM classrooms c
        WHERE c.state_id = ${filters.stateId}
          AND (${classroomFilter}::uuid IS NULL OR c.id = ${classroomFilter}::uuid)
      ), student_counts AS (
        SELECT st.id AS student_id, st.final_work_delivered,
               COUNT(a.student_id) FILTER (WHERE a.status = 'P')::float AS presences,
               COUNT(a.student_id) FILTER (WHERE a.status IN ('P', 'F'))::float AS considered
        FROM students st
        JOIN selected_classrooms sc ON sc.id = st.classroom_id
        LEFT JOIN attendance a ON a.student_id = st.id
          AND (${moduleFilter}::int IS NULL OR a.module = ${moduleFilter}::int)
        GROUP BY st.id, st.final_work_delivered
      ), student_stats AS (
        SELECT *,
          CASE WHEN considered > 0 THEN presences / considered ELSE NULL END AS frequency,
          COALESCE(considered > 0 AND presences / considered >= 0.75 AND final_work_delivered = TRUE, FALSE) AS is_apt
        FROM student_counts
      ), filtered_students AS (
        SELECT * FROM student_stats
        WHERE (
          ${situationFilter}::text IS NULL
          OR (${situationFilter} = 'apto' AND is_apt)
          OR (${situationFilter} = 'nao-apto' AND NOT is_apt)
          OR (${situationFilter} = 'abaixo-75' AND frequency < 0.75)
        )
        AND (
          ${workFilter}::text IS NULL
          OR (${workFilter} = 'entregou' AND final_work_delivered = TRUE)
          OR (${workFilter} = 'nao-entregou' AND final_work_delivered IS NOT TRUE)
        )
      )
      SELECT
        COUNT(*) FILTER (WHERE final_work_delivered = TRUE)::int AS delivered,
        COUNT(*) FILTER (WHERE final_work_delivered IS NOT TRUE)::int AS pending
      FROM filtered_students
    `
  ]);

  const overview = overviewRow[0];
  const finalWork = finalWorkRow[0];

  return {
    filters,
    states,
    classroomOptions,
    canSelectState,
    data: {
      overview: {
        totalStudents: Number(overview?.total_students ?? 0),
        averageFrequency: overview?.average_frequency == null ? null : Number(overview.average_frequency),
        aptStudents: Number(overview?.apt_students ?? 0),
        belowMinimum: Number(overview?.below_minimum ?? 0),
        pendingFinalWork: Number(overview?.pending_final_work ?? 0),
        classrooms: Number(overview?.classrooms ?? 0)
      },
      classrooms: classroomRows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        number: Number(row.number),
        students: Number(row.students),
        averageFrequency: row.average_frequency == null ? null : Number(row.average_frequency),
        aptStudents: Number(row.apt_students),
        belowMinimum: Number(row.below_minimum),
        pendingFinalWork: Number(row.pending_final_work)
      })),
      modules: moduleRows.map((row) => ({
        module: Number(row.module),
        averageFrequency: row.average_frequency == null ? null : Number(row.average_frequency)
      })),
      finalWork: {
        delivered: Number(finalWork?.delivered ?? 0),
        pending: Number(finalWork?.pending ?? 0)
      }
    }
  };
}
