import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { canAccessClass } from "@/lib/access";
import { getClassroom, getClassroomStudents } from "@/lib/data";
import { FINAL_STATUS_LABELS } from "@/lib/types";
import { MODULES, SLOTS, attendanceMetrics, effectiveFinalStatus, percentLabel, suggestFinalStatus } from "@/lib/progress";

function isAfter(value: string | null, reference: string | null) {
  if (!value || !reference) return false;
  return new Date(value).getTime() > new Date(reference).getTime();
}

export default async function StudentPage({
  params
}: {
  params: Promise<{ id: string; studentId: string }>;
}) {
  const user = await requireUser();
  const { id, studentId } = await params;
  const classroom = await getClassroom(id);
  if (!classroom) notFound();
  if (!canAccessClass(user, classroom)) redirect("/dashboard");

  const students = await getClassroomStudents(id);
  const student = students.find((item) => item.id === studentId);
  if (!student) notFound();

  const overallValues = MODULES.flatMap((module) => SLOTS.map((slot) => student.attendance[`${module}-${slot}`] ?? null));
  const overall = attendanceMetrics(overallValues, 36);
  const suggested = suggestFinalStatus(overallValues, student.finalWorkDelivered);
  const effective = effectiveFinalStatus(student.finalStatus, suggested);
  const stale = Boolean(student.finalStatus && student.finalReviewUpdatedAt && (
    isAfter(student.lastAttendanceUpdatedAt, student.finalReviewUpdatedAt)
    || isAfter(student.finalWorkUpdatedAt, student.finalReviewUpdatedAt)
  ));

  return (
    <AppShell user={user}>
      <header className="page-header">
        <div>
          <p className="eyebrow">{classroom.state_name} · {classroom.name}</p>
          <h1>{student.name}</h1>
          <p className="muted">{student.municipality || "Município não informado"} · visão individual de acompanhamento.</p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href={`/turmas/${id}`}>Voltar à turma</Link>
          <Link className="button button-primary" href={`/turmas/${id}/resultado`}>Resultado final</Link>
        </div>
      </header>

      <section className="classroom-overview student-overview" aria-label="Indicadores do cursista">
        <article><span>Frequência geral</span><strong>{percentLabel(overall.frequency)}</strong></article>
        <article><span>Progresso geral</span><strong>{percentLabel(overall.progress)}</strong></article>
        <article><span>Trabalho final</span><strong className="metric-text">{student.finalWorkDelivered === null ? "Pendente" : student.finalWorkDelivered ? "Entregou" : "Não entregou"}</strong></article>
        <article><span>Situação</span><strong className="metric-text">{FINAL_STATUS_LABELS[effective]}</strong></article>
      </section>

      {stale ? <div className="alert alert-warning student-review-alert"><strong>Revisão final desatualizada.</strong> Há atividade registrada ou trabalho final alterado depois da última confirmação.</div> : null}

      <section className="section-block">
        <div className="section-heading"><div><h2>Acompanhamento por módulo</h2><p>Frequência, progresso e registros das atividades EAD.</p></div></div>
        <div className="student-modules-grid">
          {MODULES.map((module) => {
            const values = SLOTS.map((slot) => student.attendance[`${module}-${slot}`] ?? null);
            const metrics = attendanceMetrics(values, 6);
            return (
              <article className="student-module-card" key={module}>
                <div><span>Módulo {module}</span><strong>{percentLabel(metrics.frequency)}</strong><small>frequência</small></div>
                <div className="module-progress"><span style={{ width: `${metrics.progress}%` }} /></div>
                <p>{metrics.filled}/6 preenchidos · {percentLabel(metrics.progress)} de progresso</p>
                <div className="presence-chips">
                  {values.map((value, index) => <span key={index} className={`presence-chip ${value ? value.toLowerCase() : "empty"}`}>{value === "NA" ? "N/A" : value || "—"}</span>)}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section-block student-final-summary">
        <div className="section-heading"><div><h2>Encerramento do curso</h2><p>Situação sugerida e revisão humana.</p></div></div>
        <dl>
          <div><dt>Sugestão</dt><dd>{FINAL_STATUS_LABELS[suggested]}</dd></div>
          <div><dt>Situação confirmada</dt><dd>{student.finalStatus ? FINAL_STATUS_LABELS[student.finalStatus] : "Usando sugestão"}</dd></div>
          <div><dt>Justificativa da revisão</dt><dd>{student.finalReviewJustification || "—"}</dd></div>
          <div><dt>Observações</dt><dd>{student.finalObservations || "—"}</dd></div>
        </dl>
      </section>
    </AppShell>
  );
}
