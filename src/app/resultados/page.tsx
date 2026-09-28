import Link from "next/link";
import AppShell from "@/components/AppShell";
import StateScopeSelector from "@/components/StateScopeSelector";
import { requireUser } from "@/lib/auth";
import { getDashboardModel, type DashboardQuery } from "@/lib/dashboard";

function percent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value * 100)}%`;
}

export default async function ResultsIndexPage({ searchParams }: { searchParams: Promise<DashboardQuery> }) {
  const user = await requireUser();
  const query = await searchParams;
  const model = await getDashboardModel(user, { estado: query.estado });

  return (
    <AppShell user={user}>
      <header className="page-header">
        <div>
          <p className="eyebrow">ENCERRAMENTO DO CURSO</p>
          <h1>Resultados finais</h1>
          <p className="muted">Acesse a consolidação de trabalho final, frequência geral e situação final de cada turma.</p>
        </div>
        {model ? <StateScopeSelector states={model.states} selectedCode={model.filters.stateCode} canSelectState={model.canSelectState} action="/resultados" /> : null}
      </header>

      {!model ? (
        <section className="empty-state"><h2>Nenhuma turma disponível</h2><p>Seu acesso ainda não possui turmas vinculadas.</p></section>
      ) : (
        <>
          <section className="metrics results-metrics">
            <article className="metric accent-blue"><span>Cursistas</span><strong>{model.data.overview.totalStudents}</strong><small>{model.filters.stateName}</small></article>
            <article className="metric accent-green"><span>Aptos à certificação</span><strong>{model.data.overview.aptStudents}</strong><small>Situação final efetiva</small></article>
            <article className="metric accent-green"><span>Trabalhos entregues</span><strong>{model.data.overview.finalWorkDelivered}</strong><small>Entrega registrada</small></article>
            <article className="metric accent-amber"><span>Trabalhos pendentes</span><strong>{model.data.overview.pendingFinalWork}</strong><small>Ainda não informado</small></article>
          </section>

          <section className="section-block">
            <div className="section-heading"><div><h2>Turmas</h2><p>Abra uma turma para revisar e confirmar os resultados finais.</p></div><span>{model.data.classrooms.length} turma(s)</span></div>
            <div className="table-wrap">
              <table className="summary-table">
                <thead><tr><th>Turma</th><th>Cursistas</th><th>Frequência média</th><th>Progresso</th><th>Trabalho pendente</th><th>Aptos</th><th>Ação</th></tr></thead>
                <tbody>
                  {model.data.classrooms.map((classroom) => (
                    <tr key={classroom.id}>
                      <td><strong>{classroom.name}</strong></td>
                      <td>{classroom.students}</td>
                      <td>{percent(classroom.averageFrequency)}</td>
                      <td>{percent(classroom.progress)}</td>
                      <td>{classroom.pendingFinalWork}</td>
                      <td><span className="status ok">{classroom.aptStudents}</span></td>
                      <td><Link className="button button-secondary button-compact" href={`/turmas/${classroom.id}/resultado`}>Abrir resultado</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
