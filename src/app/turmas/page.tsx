import Link from "next/link";
import AppShell from "@/components/AppShell";
import StateScopeSelector from "@/components/StateScopeSelector";
import { canEditClass } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { getDashboardModel, type DashboardQuery } from "@/lib/dashboard";

function percent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value * 100)}%`;
}

export default async function ClassroomsPage({ searchParams }: { searchParams: Promise<DashboardQuery> }) {
  const user = await requireUser();
  const query = await searchParams;
  const model = await getDashboardModel(user, { estado: query.estado });

  return (
    <AppShell user={user}>
      <header className="page-header">
        <div>
          <p className="eyebrow">ACOMPANHAMENTO</p>
          <h1>Turmas</h1>
          <p className="muted">Escolha uma turma e abra diretamente o módulo que deseja preencher ou consultar.</p>
        </div>
        {model ? <StateScopeSelector states={model.states} selectedCode={model.filters.stateCode} canSelectState={model.canSelectState} action="/turmas" /> : null}
      </header>

      {!model ? (
        <section className="empty-state"><h2>Nenhuma turma vinculada</h2><p>Solicite à administração a configuração do seu escopo.</p></section>
      ) : (
        <>
          <div className="classrooms-page-note">
            <strong>Curso EAD:</strong> os seis registros de cada módulo representam atividades/participações do curso. Eles não significam encontros presenciais.
          </div>
          <section className="classroom-card-grid">
            {model.data.classrooms.map((classroom) => {
              const editable = canEditClass(user, { id: classroom.id, state_id: model.filters.stateId });
              const modules = [1, 2, 3, 4, 5, 6].map((module) => {
                const cell = model.data.heatmap.find((item) => item.classroomId === classroom.id && item.module === module);
                return { module, progress: cell?.progress ?? 0 };
              });
              const nextModule = modules.find((item) => item.progress < 1)?.module ?? null;
              const primaryHref = nextModule ? `/turmas/${classroom.id}?modulo=${nextModule}` : `/turmas/${classroom.id}`;
              const isOwnClass = user.role === "PROFESSOR" && user.classroomId === classroom.id;

              return (
                <article className={`classroom-card ${isOwnClass ? "own-classroom" : ""}`} key={classroom.id}>
                  <div className="classroom-card-heading">
                    <div><span className="classroom-code">{model.filters.stateCode}</span><h2>{classroom.name}</h2></div>
                    {isOwnClass ? <span className="status ok">Sua turma</span> : editable ? <span className="status info">Edição liberada</span> : <span className="status muted-status">Visualização</span>}
                  </div>

                  <div className="classroom-card-metrics">
                    <div><span>Cursistas</span><strong>{classroom.students}</strong></div>
                    <div><span>Frequência</span><strong>{percent(classroom.averageFrequency)}</strong></div>
                    <div><span>Progresso</span><strong>{percent(classroom.progress)}</strong></div>
                  </div>

                  <div className="module-quick-grid" aria-label={`Módulos da turma ${classroom.name}`}>
                    {modules.map((item) => (
                      <Link key={item.module} href={`/turmas/${classroom.id}?modulo=${item.module}`} className={item.progress >= 1 ? "module-quick complete" : item.progress > 0 ? "module-quick started" : "module-quick"}>
                        <span>M{item.module}</span><strong>{percent(item.progress)}</strong>
                      </Link>
                    ))}
                  </div>

                  <div className="classroom-card-actions">
                    <Link className="button button-secondary" href={`/turmas/${classroom.id}`}>Visão da turma</Link>
                    <Link className={`button ${editable ? "button-primary" : "button-secondary"}`} href={primaryHref}>{editable ? (nextModule ? `Preencher Módulo ${nextModule}` : "Revisar acompanhamento") : "Visualizar atividades"}</Link>
                  </div>
                </article>
              );
            })}
          </section>
        </>
      )}
    </AppShell>
  );
}
