import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import FinalResultEditor from "@/components/FinalResultEditor";
import { requireUser } from "@/lib/auth";
import { canAccessClass, canEditClass } from "@/lib/access";
import { getClassroom, getClassroomStudents } from "@/lib/data";

export default async function ResultPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const classroom = await getClassroom(id);
  if (!classroom) notFound();
  if (!canAccessClass(user, classroom)) redirect("/dashboard");

  const students = await getClassroomStudents(id);

  return (
    <AppShell user={user}>
      <header className="page-header">
        <div>
          <p className="eyebrow">{classroom.state_name} · {classroom.name}</p>
          <h1>Resultado final</h1>
          <p className="muted">Consolidação do curso com sugestão automática e confirmação humana.</p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href={`/turmas/${id}`}>Voltar ao acompanhamento</Link>
          <a className="button button-primary" href={`/api/turmas/${id}/exportar`}>Exportar Excel</a>
        </div>
      </header>

      <FinalResultEditor
        classroomId={id}
        students={students}
        initialClassNotes={classroom.finalNotes}
        canEdit={canEditClass(user, classroom)}
      />
    </AppShell>
  );
}
