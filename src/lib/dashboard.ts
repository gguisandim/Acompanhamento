import { db } from "./db";
import type { CurrentUser, FinalStatus } from "./types";

export type DashboardQuery = {
  estado?: string; turma?: string; municipio?: string; modulo?: string;
  trabalho?: string; situacao?: string; frequencia?: string; progresso?: string;
};

export type DashboardFilters = {
  stateId: string; stateCode: string; stateName: string;
  classroomId: string | null; classroomName: string | null;
  municipality: string | null; module: number | null;
  finalWork: "entregou" | "nao-entregou" | "pendente" | null;
  situation: FinalStatus | null;
  frequencyRange: "0-49" | "50-74" | "75-89" | "90-100" | null;
  progressRange: "0" | "1-24" | "25-49" | "50-74" | "75-99" | "100" | null;
};

export type DashboardStateOption = { id: string; code: string; name: string };
export type DashboardClassroomOption = { id: string; name: string; number: number; stateId: string; stateCode: string };
export type ClassroomSummary = { id: string; name: string; number: number; students: number; averageFrequency: number | null; progress: number; complete: number; belowMinimum: number; pendingFinalWork: number; aptStudents: number };
export type ModuleSummary = { module: number; averageFrequency: number | null; progress: number };
export type HeatmapCell = { classroomId: string; classroom: string; module: number; frequency: number | null; progress: number };
export type DistributionItem = { key: string; label: string; count: number };
export type MunicipalitySummary = { municipality: string; students: number; averageFrequency: number | null; progress: number };
export type AttentionStudent = { id: string; name: string; classroomId: string; classroom: string; municipality: string | null; frequency: number | null; progress: number; finalWork: boolean | null; status: FinalStatus; reason: string };

export type DashboardData = {
  overview: { totalStudents: number; averageFrequency: number | null; progress: number; started: number; complete: number; belowMinimum: number; finalWorkDelivered: number; pendingFinalWork: number; aptStudents: number; attention: number; classrooms: number };
  classrooms: ClassroomSummary[];
  modules: ModuleSummary[];
  heatmap: HeatmapCell[];
  frequencyDistribution: DistributionItem[];
  progressDistribution: DistributionItem[];
  finalWork: { delivered: number; notDelivered: number; pending: number };
  finalStatuses: Array<{ status: FinalStatus; count: number }>;
  encounters: Array<{ module: number; slot: number; frequency: number | null }>;
  municipalities: MunicipalitySummary[];
  funnel: Array<{ label: string; count: number }>;
  attention: AttentionStudent[];
};

export type DashboardModel = { filters: DashboardFilters; states: DashboardStateOption[]; classroomOptions: DashboardClassroomOption[]; municipalityOptions: string[]; data: DashboardData; canSelectState: boolean };

type OptionRow = { id: string; name: string; number: number; state_id: string; state_code: string; state_name: string };
const finalStatuses: FinalStatus[] = ["IN_PROGRESS", "READY_FOR_CERTIFICATION", "INSUFFICIENT_ATTENDANCE", "FINAL_WORK_PENDING", "NOT_COMPLETED", "PENDING_REVIEW"];

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  return allowed.includes(value as T) ? value as T : null;
}
function asArray<T>(value: unknown): T[] { return Array.isArray(value) ? value as T[] : []; }
function numberOrNull(value: unknown) { return value == null ? null : Number(value); }

export async function getDashboardModel(user: CurrentUser, query: DashboardQuery): Promise<DashboardModel | null> {
  const sql = db();
  const canSelectState = user.role === "ADMIN" || user.role === "COORDENADOR_GERAL";
  const optionRows = await sql`
    SELECT c.id, c.name, c.number, c.state_id, s.code AS state_code, s.name AS state_name
    FROM classrooms c JOIN states s ON s.id = c.state_id
    WHERE ${canSelectState} OR c.state_id = ${user.stateId}
    ORDER BY s.name, c.number
  `;
  const options: OptionRow[] = optionRows.map((row) => ({ id: String(row.id), name: String(row.name), number: Number(row.number), state_id: String(row.state_id), state_code: String(row.state_code), state_name: String(row.state_name) }));
  if (!options.length) return null;
  const states = Array.from(new Map(options.map((item) => [item.state_id, { id: item.state_id, code: item.state_code, name: item.state_name }])).values());
  const requestedState = query.estado?.trim().toUpperCase();
  const selectedState = canSelectState ? states.find((state) => state.code === requestedState) ?? states.find((state) => state.code === "PA") ?? states[0] : states[0];
  const classroomOptions = options.filter((item) => item.state_id === selectedState.id).map((item) => ({ id: item.id, name: item.name, number: item.number, stateId: item.state_id, stateCode: item.state_code }));
  const requestedClassroom = query.turma?.trim() ?? "";
  const selectedClassroom = classroomOptions.find((item) => item.id === requestedClassroom || item.name === requestedClassroom.toUpperCase()) ?? null;
  const moduleValue = Number(query.modulo);
  const filters: DashboardFilters = {
    stateId: selectedState.id, stateCode: selectedState.code, stateName: selectedState.name,
    classroomId: selectedClassroom?.id ?? null, classroomName: selectedClassroom?.name ?? null,
    municipality: query.municipio?.trim() || null,
    module: Number.isInteger(moduleValue) && moduleValue >= 1 && moduleValue <= 6 ? moduleValue : null,
    finalWork: oneOf(query.trabalho, ["entregou", "nao-entregou", "pendente"] as const),
    situation: oneOf(query.situacao, finalStatuses),
    frequencyRange: oneOf(query.frequencia, ["0-49", "50-74", "75-89", "90-100"] as const),
    progressRange: oneOf(query.progresso, ["0", "1-24", "25-49", "50-74", "75-99", "100"] as const)
  };

  const [row] = await sql`
    WITH selected_classrooms AS (
      SELECT c.id, c.name, c.number FROM classrooms c
      WHERE c.state_id = ${filters.stateId}
        AND (${filters.classroomId}::uuid IS NULL OR c.id = ${filters.classroomId}::uuid)
    ), base_students AS (
      SELECT st.id, st.name, st.municipality, st.classroom_id, st.final_work_delivered, st.final_status,
             sc.name AS classroom_name, sc.number AS classroom_number
      FROM students st JOIN selected_classrooms sc ON sc.id = st.classroom_id
    ), counts AS (
      SELECT bs.*,
        COUNT(a.student_id) FILTER (WHERE a.status = 'P')::float AS overall_p,
        COUNT(a.student_id) FILTER (WHERE a.status IN ('P','F'))::float AS overall_pf,
        COUNT(a.student_id)::float AS overall_filled,
        COUNT(a.student_id) FILTER (WHERE (${filters.module}::int IS NULL OR a.module = ${filters.module}) AND a.status = 'P')::float AS scoped_p,
        COUNT(a.student_id) FILTER (WHERE (${filters.module}::int IS NULL OR a.module = ${filters.module}) AND a.status IN ('P','F'))::float AS scoped_pf,
        COUNT(a.student_id) FILTER (WHERE ${filters.module}::int IS NULL OR a.module = ${filters.module})::float AS scoped_filled
      FROM base_students bs LEFT JOIN attendance a ON a.student_id = bs.id
      GROUP BY bs.id, bs.name, bs.municipality, bs.classroom_id, bs.final_work_delivered, bs.final_status, bs.classroom_name, bs.classroom_number
    ), stats_base AS (
      SELECT *,
        CASE WHEN scoped_pf > 0 THEN scoped_p / scoped_pf END AS frequency,
        scoped_filled / (CASE WHEN ${filters.module}::int IS NULL THEN 36.0 ELSE 6.0 END) AS progress,
        CASE WHEN overall_pf > 0 THEN overall_p / overall_pf END AS overall_frequency,
        overall_filled / 36.0 AS overall_progress,
        CASE
          WHEN overall_filled < 36 THEN 'IN_PROGRESS'
          WHEN overall_pf = 0 THEN 'PENDING_REVIEW'
          WHEN overall_p / overall_pf < 0.75 THEN 'INSUFFICIENT_ATTENDANCE'
          WHEN final_work_delivered IS NULL THEN 'FINAL_WORK_PENDING'
          WHEN final_work_delivered = FALSE THEN 'NOT_COMPLETED'
          ELSE 'READY_FOR_CERTIFICATION'
        END AS suggested_status
      FROM counts
    ), stats AS (
      SELECT *, COALESCE(final_status, suggested_status) AS effective_status FROM stats_base
    ), filtered AS (
      SELECT * FROM stats WHERE
        (${filters.municipality}::text IS NULL OR municipality = ${filters.municipality})
        AND (${filters.finalWork}::text IS NULL
          OR (${filters.finalWork} = 'entregou' AND final_work_delivered = TRUE)
          OR (${filters.finalWork} = 'nao-entregou' AND final_work_delivered = FALSE)
          OR (${filters.finalWork} = 'pendente' AND final_work_delivered IS NULL))
        AND (${filters.situation}::text IS NULL OR effective_status = ${filters.situation})
        AND (${filters.frequencyRange}::text IS NULL
          OR (${filters.frequencyRange} = '0-49' AND frequency >= 0 AND frequency < 0.50)
          OR (${filters.frequencyRange} = '50-74' AND frequency >= 0.50 AND frequency < 0.75)
          OR (${filters.frequencyRange} = '75-89' AND frequency >= 0.75 AND frequency < 0.90)
          OR (${filters.frequencyRange} = '90-100' AND frequency >= 0.90))
        AND (${filters.progressRange}::text IS NULL
          OR (${filters.progressRange} = '0' AND progress = 0)
          OR (${filters.progressRange} = '1-24' AND progress > 0 AND progress < 0.25)
          OR (${filters.progressRange} = '25-49' AND progress >= 0.25 AND progress < 0.50)
          OR (${filters.progressRange} = '50-74' AND progress >= 0.50 AND progress < 0.75)
          OR (${filters.progressRange} = '75-99' AND progress >= 0.75 AND progress < 1)
          OR (${filters.progressRange} = '100' AND progress = 1))
    ), module_student AS (
      SELECT f.id AS student_id, f.classroom_id, f.classroom_name, m.module,
        COUNT(a.student_id) FILTER (WHERE a.status = 'P')::float AS p,
        COUNT(a.student_id) FILTER (WHERE a.status IN ('P','F'))::float AS pf,
        COUNT(a.student_id)::float AS filled
      FROM filtered f CROSS JOIN generate_series(1,6) m(module)
      LEFT JOIN attendance a ON a.student_id = f.id AND a.module = m.module
      GROUP BY f.id, f.classroom_id, f.classroom_name, m.module
    ), attention AS (
      SELECT *, concat_ws('; ',
        CASE WHEN frequency IS NOT NULL AND frequency < 0.75 THEN 'Frequência abaixo de 75%' END,
        CASE WHEN progress = 0 THEN 'Acompanhamento não iniciado' WHEN progress < 0.75 THEN 'Muitos registros ainda não preenchidos' WHEN progress < 1 THEN 'Acompanhamento incompleto' END,
        CASE WHEN final_work_delivered IS NULL THEN 'Trabalho final pendente' WHEN final_work_delivered = FALSE THEN 'Trabalho final não entregue' END,
        CASE WHEN effective_status = 'PENDING_REVIEW' THEN 'Situação final pendente de avaliação' END
      ) AS reason FROM filtered
    )
    SELECT
      (SELECT json_build_object(
        'totalStudents', COUNT(*), 'averageFrequency', AVG(frequency),
        'progress', COALESCE(SUM(scoped_filled) / NULLIF(COUNT(*) * (CASE WHEN ${filters.module}::int IS NULL THEN 36.0 ELSE 6.0 END), 0), 0),
        'started', COUNT(*) FILTER (WHERE scoped_filled > 0), 'complete', COUNT(*) FILTER (WHERE progress = 1),
        'belowMinimum', COUNT(*) FILTER (WHERE frequency < 0.75),
        'finalWorkDelivered', COUNT(*) FILTER (WHERE final_work_delivered = TRUE),
        'pendingFinalWork', COUNT(*) FILTER (WHERE final_work_delivered IS NULL),
        'aptStudents', COUNT(*) FILTER (WHERE effective_status = 'READY_FOR_CERTIFICATION'),
        'attention', COUNT(*) FILTER (WHERE reason <> ''),
        'classrooms', (SELECT COUNT(*) FROM selected_classrooms)
      ) FROM attention) AS overview,
      (SELECT COALESCE(json_agg(x ORDER BY x.number), '[]') FROM (
        SELECT sc.id, sc.name, sc.number, COUNT(f.id) AS students, AVG(f.frequency) AS "averageFrequency",
          COALESCE(SUM(f.scoped_filled) / NULLIF(COUNT(f.id) * (CASE WHEN ${filters.module}::int IS NULL THEN 36.0 ELSE 6.0 END), 0), 0) AS progress,
          COUNT(f.id) FILTER (WHERE f.progress = 1) AS complete,
          COUNT(f.id) FILTER (WHERE f.frequency < 0.75) AS "belowMinimum",
          COUNT(f.id) FILTER (WHERE f.final_work_delivered IS NULL) AS "pendingFinalWork",
          COUNT(f.id) FILTER (WHERE f.effective_status = 'READY_FOR_CERTIFICATION') AS "aptStudents"
        FROM selected_classrooms sc LEFT JOIN filtered f ON f.classroom_id = sc.id
        GROUP BY sc.id, sc.name, sc.number
      ) x) AS classrooms,
      (SELECT COALESCE(json_agg(x ORDER BY x.module), '[]') FROM (
        SELECT module, AVG(CASE WHEN pf > 0 THEN p/pf END) AS "averageFrequency", COALESCE(SUM(filled)/NULLIF(COUNT(*)*6.0,0),0) AS progress
        FROM module_student WHERE ${filters.module}::int IS NULL OR module = ${filters.module} GROUP BY module
      ) x) AS modules,
      (SELECT COALESCE(json_agg(x ORDER BY x.classroom, x.module), '[]') FROM (
        SELECT classroom_id AS "classroomId", classroom_name AS classroom, module,
          AVG(CASE WHEN pf > 0 THEN p/pf END) AS frequency, COALESCE(SUM(filled)/NULLIF(COUNT(*)*6.0,0),0) AS progress
        FROM module_student WHERE ${filters.module}::int IS NULL OR module = ${filters.module}
        GROUP BY classroom_id, classroom_name, module
      ) x) AS heatmap,
      (SELECT json_agg(x ORDER BY x.ord) FROM (VALUES
        (1,'0-49','0–49%',(SELECT COUNT(*) FROM filtered WHERE frequency < .50)),
        (2,'50-74','50–74%',(SELECT COUNT(*) FROM filtered WHERE frequency >= .50 AND frequency < .75)),
        (3,'75-89','75–89%',(SELECT COUNT(*) FROM filtered WHERE frequency >= .75 AND frequency < .90)),
        (4,'90-100','90–100%',(SELECT COUNT(*) FROM filtered WHERE frequency >= .90))
      ) x(ord,key,label,count)) AS frequency_distribution,
      (SELECT json_agg(x ORDER BY x.ord) FROM (VALUES
        (1,'0','Não iniciado',(SELECT COUNT(*) FROM filtered WHERE progress = 0)),
        (2,'1-24','1–24%',(SELECT COUNT(*) FROM filtered WHERE progress > 0 AND progress < .25)),
        (3,'25-49','25–49%',(SELECT COUNT(*) FROM filtered WHERE progress >= .25 AND progress < .50)),
        (4,'50-74','50–74%',(SELECT COUNT(*) FROM filtered WHERE progress >= .50 AND progress < .75)),
        (5,'75-99','75–99%',(SELECT COUNT(*) FROM filtered WHERE progress >= .75 AND progress < 1)),
        (6,'100','Completo',(SELECT COUNT(*) FROM filtered WHERE progress = 1))
      ) x(ord,key,label,count)) AS progress_distribution,
      (SELECT json_build_object('delivered',COUNT(*) FILTER (WHERE final_work_delivered=TRUE),'notDelivered',COUNT(*) FILTER (WHERE final_work_delivered=FALSE),'pending',COUNT(*) FILTER (WHERE final_work_delivered IS NULL)) FROM filtered) AS final_work,
      (SELECT COALESCE(json_agg(x ORDER BY x.status), '[]') FROM (SELECT effective_status AS status, COUNT(*) AS count FROM filtered GROUP BY effective_status) x) AS final_statuses,
      (SELECT COALESCE(json_agg(x ORDER BY x.module,x.slot), '[]') FROM (
        SELECT m.module, s.slot, CASE WHEN COUNT(a.student_id) FILTER (WHERE a.status IN ('P','F')) > 0 THEN COUNT(a.student_id) FILTER (WHERE a.status='P')::float / COUNT(a.student_id) FILTER (WHERE a.status IN ('P','F')) END AS frequency
        FROM generate_series(1,6) m(module) CROSS JOIN generate_series(1,6) s(slot) CROSS JOIN filtered f
        LEFT JOIN attendance a ON a.student_id=f.id AND a.module=m.module AND a.slot=s.slot
        WHERE ${filters.module}::int IS NULL OR m.module=${filters.module}
        GROUP BY m.module,s.slot
      ) x) AS encounters,
      (SELECT COALESCE(json_agg(x ORDER BY x.students DESC,x.municipality), '[]') FROM (
        SELECT COALESCE(municipality,'Não informado') AS municipality, COUNT(*) AS students, AVG(frequency) AS "averageFrequency", AVG(progress) AS progress
        FROM filtered GROUP BY COALESCE(municipality,'Não informado')
      ) x) AS municipalities,
      (SELECT json_agg(x ORDER BY x.ord) FROM (VALUES
        (1,'Cursistas cadastrados',(SELECT COUNT(*) FROM filtered)),
        (2,'Acompanhamento iniciado',(SELECT COUNT(*) FROM filtered WHERE scoped_filled>0)),
        (3,'Preenchimento a partir de 75%',(SELECT COUNT(*) FROM filtered WHERE progress>=.75)),
        (4,'Acompanhamento completo',(SELECT COUNT(*) FROM filtered WHERE progress=1)),
        (5,'Trabalho final entregue',(SELECT COUNT(*) FROM filtered WHERE final_work_delivered=TRUE)),
        (6,'Aptos à certificação',(SELECT COUNT(*) FROM filtered WHERE effective_status='READY_FOR_CERTIFICATION'))
      ) x(ord,label,count)) AS funnel,
      (SELECT COALESCE(json_agg(x ORDER BY x.progress, x.frequency NULLS FIRST, x.name), '[]') FROM (
        SELECT id,name,classroom_id AS "classroomId",classroom_name AS classroom,municipality,frequency,progress,final_work_delivered AS "finalWork",effective_status AS status,reason
        FROM attention WHERE reason<>'' LIMIT 100
      ) x) AS attention,
      (SELECT COALESCE(json_agg(DISTINCT municipality ORDER BY municipality) FILTER (WHERE municipality IS NOT NULL AND municipality<>''), '[]') FROM base_students) AS municipality_options
  `;

  const overview = (row?.overview ?? {}) as Record<string, unknown>;
  const finalWork = (row?.final_work ?? {}) as Record<string, unknown>;
  const mapDistribution = (items: unknown) => asArray<Record<string, unknown>>(items).map((item) => ({ key: String(item.key), label: String(item.label), count: Number(item.count) }));
  const data: DashboardData = {
    overview: { totalStudents: Number(overview.totalStudents ?? 0), averageFrequency: numberOrNull(overview.averageFrequency), progress: Number(overview.progress ?? 0), started: Number(overview.started ?? 0), complete: Number(overview.complete ?? 0), belowMinimum: Number(overview.belowMinimum ?? 0), finalWorkDelivered: Number(overview.finalWorkDelivered ?? 0), pendingFinalWork: Number(overview.pendingFinalWork ?? 0), aptStudents: Number(overview.aptStudents ?? 0), attention: Number(overview.attention ?? 0), classrooms: Number(overview.classrooms ?? 0) },
    classrooms: asArray<Record<string, unknown>>(row?.classrooms).map((item) => ({ id:String(item.id),name:String(item.name),number:Number(item.number),students:Number(item.students),averageFrequency:numberOrNull(item.averageFrequency),progress:Number(item.progress),complete:Number(item.complete),belowMinimum:Number(item.belowMinimum),pendingFinalWork:Number(item.pendingFinalWork),aptStudents:Number(item.aptStudents) })),
    modules: asArray<Record<string, unknown>>(row?.modules).map((item) => ({ module:Number(item.module),averageFrequency:numberOrNull(item.averageFrequency),progress:Number(item.progress) })),
    heatmap: asArray<Record<string, unknown>>(row?.heatmap).map((item) => ({ classroomId:String(item.classroomId),classroom:String(item.classroom),module:Number(item.module),frequency:numberOrNull(item.frequency),progress:Number(item.progress) })),
    frequencyDistribution: mapDistribution(row?.frequency_distribution), progressDistribution: mapDistribution(row?.progress_distribution),
    finalWork: { delivered:Number(finalWork.delivered??0),notDelivered:Number(finalWork.notDelivered??0),pending:Number(finalWork.pending??0) },
    finalStatuses: asArray<Record<string, unknown>>(row?.final_statuses).map((item) => ({ status:item.status as FinalStatus,count:Number(item.count) })),
    encounters: asArray<Record<string, unknown>>(row?.encounters).map((item) => ({ module:Number(item.module),slot:Number(item.slot),frequency:numberOrNull(item.frequency) })),
    municipalities: asArray<Record<string, unknown>>(row?.municipalities).map((item) => ({ municipality:String(item.municipality),students:Number(item.students),averageFrequency:numberOrNull(item.averageFrequency),progress:Number(item.progress) })),
    funnel: asArray<Record<string, unknown>>(row?.funnel).map((item) => ({ label:String(item.label),count:Number(item.count) })),
    attention: asArray<Record<string, unknown>>(row?.attention).map((item) => ({ id:String(item.id),name:String(item.name),classroomId:String(item.classroomId),classroom:String(item.classroom),municipality:item.municipality==null?null:String(item.municipality),frequency:numberOrNull(item.frequency),progress:Number(item.progress),finalWork:item.finalWork==null?null:Boolean(item.finalWork),status:item.status as FinalStatus,reason:String(item.reason) }))
  };
  return { filters, states, classroomOptions, municipalityOptions: asArray<string>(row?.municipality_options), data, canSelectState };
}
