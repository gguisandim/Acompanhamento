import AppShell from "@/components/AppShell";
import DashboardCharts from "@/components/DashboardCharts";
import DashboardFilters from "@/components/DashboardFilters";
import { requireUser } from "@/lib/auth";
import { getDashboardModel, type DashboardQuery } from "@/lib/dashboard";

function percent(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value * 100)}%`;
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<DashboardQuery> }) {
  const user = await requireUser();
  const query = await searchParams;
  const model = await getDashboardModel(user, query);

  return (
    <AppShell user={user}>
      <header className="page-header">
        <div>
          <p className="eyebrow">ANÁLISES</p>
          <h1>Indicadores do acompanhamento</h1>
          <p className="muted">Visualizações detalhadas de participação nas atividades, frequência, progresso e distribuição territorial.</p>
        </div>
      </header>

      {!model ? (
        <section className="empty-state"><h2>Nenhum dado disponível</h2><p>Seu acesso ainda não possui turmas vinculadas.</p></section>
      ) : (
        <>
          <DashboardFilters
            key={JSON.stringify(model.filters)}
            filters={model.filters}
            states={model.states}
            classrooms={model.classroomOptions}
            municipalities={model.municipalityOptions}
            canSelectState={model.canSelectState}
            basePath="/analises"
          />

          {model.filters.module ? <p className="scope-note">Com o Módulo {model.filters.module} selecionado, frequência e progresso usam as seis atividades desse módulo. A situação final continua baseada no curso completo.</p> : null}

          <section className="metrics analytics-metrics" aria-label="Indicadores do recorte">
            <article className="metric accent-blue"><span>Cursistas</span><strong>{model.data.overview.totalStudents}</strong><small>No recorte selecionado</small></article>
            <article className="metric accent-green"><span>Frequência média</span><strong>{percent(model.data.overview.averageFrequency)}</strong><small>P ÷ (P + F)</small></article>
            <article className="metric accent-blue"><span>Progresso</span><strong>{percent(model.data.overview.progress)}</strong><small>Atividades registradas</small></article>
            <article className="metric accent-amber"><span>Abaixo de 75%</span><strong>{model.data.overview.belowMinimum}</strong><small>Métrica de atenção</small></article>
            <article className="metric accent-green"><span>Trabalhos entregues</span><strong>{model.data.overview.finalWorkDelivered}</strong><small>Registro final</small></article>
            <article className="metric accent-amber"><span>Atenções</span><strong>{model.data.overview.attention}</strong><small>Pendências identificadas</small></article>
          </section>

          <DashboardCharts data={model.data} />
        </>
      )}
    </AppShell>
  );
}
