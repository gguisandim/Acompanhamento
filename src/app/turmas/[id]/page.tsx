import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AttendanceEditor from "@/components/AttendanceEditor";
import { requireUser } from "@/lib/auth";
import { canAccessClass, canEditClass, canImportRoster } from "@/lib/access";
import { getClassroom, getClassroomOverview, getClassroomStudents } from "@/lib/data";

function percent(value: number | null) {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value * 100)}%`;
}

export default async function ClassroomPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const classroom = await getClassroom(id);
  if (!classroom) notFound();
  if (!canAccessClass(user, classroom)) redirect("/dashboard");

  const [students, overview] = await Promise.all([
    getClassroomStudents(id),
    getClassroomOverview(id)
  ]);

  return (
    <AppShell user={user}>
      <header className="page-header">
        <div>
          <p className="eyebrow">{classroom.state_name}</p>
          <h1>Turma {classroom.name}</h1>
          <p className="muted">Professor responsável: <strong>{overview.professorName ?? "Não atribuído"}</strong></p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href={`/turmas/${id}/resultado`}>Resultado final</Link>
          {canImportRoster(user, classroom) ? (
            <Link className="button button-secondary" href={`/turmas/${id}/importar`}>Importar planilha</Link>
          ) : null}
          <a className="button button-secondary" href={`/api/turmas/${id}/exportar`}>Exportar Excel</a>
        </div>
      </header>

      <section className="classroom-overview" aria-label="Indicadores da turma">
        <article><span>Cursistas</span><strong>{overview.studentCount}</strong></article>
        <article><span>Frequência média</span><strong>{percent(overview.averageFrequency)}</strong></article>
        <article><span>Progresso</span><strong>{percent(overview.averageProgress)}</strong></article>
        <article><span>Abaixo de 75%</span><strong>{overview.belowMinimum}</strong></article>
        <article><span>Trabalhos pendentes</span><strong>{overview.pendingFinalWork}</strong></article>
        <article><span>Aptos à certificação</span><strong>{overview.aptCount}</strong></article>
      </section>

      <AttendanceEditor
        classroomId={id}
        students={students}
        canEdit={canEditClass(user, classroom)}
      />
    </AppShell>
  );
}
