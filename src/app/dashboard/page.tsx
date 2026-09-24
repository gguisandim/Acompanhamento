import Link from "next/link";
import AppShell from "@/components/AppShell";
import DashboardCharts from "@/components/DashboardCharts";
import DashboardFilters from "@/components/DashboardFilters";
import { requireUser } from "@/lib/auth";
import { getDashboardModel, type DashboardQuery } from "@/lib/dashboard";

function percent(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value * 100)}%`;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<DashboardQuery> }) {
  const user = await requireUser();
  const model = await getDashboardModel(user, await searchParams);

  return (
    <AppShell user={user}>
      <header className="page-header dashboard-header">
        <div>
          <p className="eyebrow">VISÃO GERENCIAL</p>
          <h1>Acompanhamento 2026</h1>
          <p className="muted">
            {model ? `${model.filters.stateName} · indicadores atualizados a partir dos registros das turmas.` : "Seu acesso ainda não possui turmas vinculadas."}
          </p>
        </div>
        {model ? <span className="data-badge">Dados reais do acompanhamento</span> : null}
      </header>

      {!model ? (
        <section className="empty-state">
          <h2>Nenhuma turma vinculada</h2>
          <p>Solicite à administração a definição do seu estado ou turma.</p>
        </section>
      ) : (
        <>
          <DashboardFilters
            key={`${model.filters.stateCode}:${model.filters.classroomName ?? "all"}:${model.filters.module ?? "all"}:${model.filters.situation ?? "all"}:${model.filters.finalWork ?? "all"}`}
            filters={model.filters}
            states={model.states}
            classrooms={model.classroomOptions}
            canSelectState={model.canSelectState}
          />

          {model.filters.module ? (
            <p className="scope-note">Com o Módulo {model.filters.module} selecionado, frequência e aptidão consideram apenas as presenças desse módulo.</p>
          ) : null}

          <section className="metrics dashboard-metrics" aria-label="Indicadores">
            <article className="metric accent-blue"><span>Total de cursistas</span><strong>{model.data.overview.totalStudents}</strong><small>No recorte selecionado</small></article>
            <article className="metric accent-green"><span>Frequência média</span><strong>{percent(model.data.overview.averageFrequency)}</strong><small>P ÷ (P + F)</small></article>
            <article className="metric accent-green"><span>Aptos para certificação</span><strong>{model.data.overview.aptStudents}</strong><small>{percent(model.data.overview.totalStudents ? model.data.overview.aptStudents / model.data.overview.totalStudents : null)} do total</small></article>
            <article className="metric accent-amber"><span>Abaixo de 75%</span><strong>{model.data.overview.belowMinimum}</strong><small>Frequência insuficiente</small></article>
            <article className="metric accent-blue"><span>Trabalho final pendente</span><strong>{model.data.overview.pendingFinalWork}</strong><small>Não entregue ou sem registro</small></article>
            <article className="metric"><span>Turmas</span><strong>{model.data.overview.classrooms}</strong><small>{model.filters.classroomName ?? model.filters.stateCode}</small></article>
          </section>

          <DashboardCharts data={model.data} />

          <section className="section-block" id="turmas">
            <div className="section-heading">
              <div><h2>Resumo das turmas</h2><p>Os mesmos critérios dos indicadores e gráficos.</p></div>
              <span>{model.data.classrooms.length} turma(s)</span>
            </div>
            <div className="table-wrap">
              <table className="summary-table">
                <thead>
                  <tr>
                    <th>Turma</th><th>Cursistas</th><th>Frequência</th><th>Aptos</th><th>&lt; 75%</th><th>Trabalho pendente</th><th><span className="sr-only">Acessar</span></th>
                  </tr>
                </thead>
                <tbody>
                  {model.data.classrooms.map((classroom) => (
                    <tr key={classroom.id}>
                      <td><Link className="table-primary-link" href={`/turmas/${classroom.id}`}>{classroom.name}</Link></td>
                      <td>{classroom.students}</td>
                      <td><strong>{percent(classroom.averageFrequency)}</strong></td>
                      <td><span className="status ok">{classroom.aptStudents}</span></td>
                      <td>{classroom.belowMinimum}</td>
                      <td>{classroom.pendingFinalWork}</td>
                      <td><Link className="row-arrow" href={`/turmas/${classroom.id}`} aria-label={`Abrir ${classroom.name}`}>→</Link></td>
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
