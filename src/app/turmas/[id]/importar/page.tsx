import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import ImportRoster from "@/components/ImportRoster";
import { requireUser } from "@/lib/auth";
import { canImportRoster } from "@/lib/access";
import { getClassroom } from "@/lib/data";

export default async function ImportPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const classroom = await getClassroom(id);
  if (!classroom) notFound();
  if (!canImportRoster(user, classroom)) redirect(`/turmas/${id}`);

  return (
    <AppShell user={user}>
      <header className="page-header">
        <div>
          <p className="eyebrow">{classroom.state_name} · {classroom.name}</p>
          <h1>Importar planilha</h1>
          <p className="muted">Compatível com o modelo de acompanhamento fornecido para 2026.</p>
        </div>
        <Link className="button button-secondary" href={`/turmas/${id}`}>Voltar</Link>
      </header>

      <ImportRoster classroomId={id} />
    </AppShell>
  );
}
