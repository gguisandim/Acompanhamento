import Link from "next/link";
import AppShell from "@/components/AppShell";
import DashboardCharts from "@/components/DashboardCharts";
import DashboardFilters from "@/components/DashboardFilters";
import { requireUser } from "@/lib/auth";
import { getDashboardModel, type DashboardQuery } from "@/lib/dashboard";
import { FINAL_STATUS_LABELS } from "@/lib/types";

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
            key={JSON.stringify(model.filters)}
            filters={model.filters}
            states={model.states}
            classrooms={model.classroomOptions}
            municipalities={model.municipalityOptions}
            canSelectState={model.canSelectState}
          />

          {model.filters.module ? (
            <p className="scope-note">Com o Módulo {model.filters.module} selecionado, frequência e progresso usam os seis registros desse módulo. A situação final continua baseada no curso completo.</p>
          ) : null}

          <section className="metrics dashboard-metrics" aria-label="Indicadores">
            <article className="metric accent-blue"><span>Total de cursistas</span><strong>{model.data.overview.totalStudents}</strong><small>No recorte selecionado</small></article>
            <article className="metric accent-green"><span>Frequência média</span><strong>{percent(model.data.overview.averageFrequency)}</strong><small>P ÷ (P + F)</small></article>
            <article className="metric accent-blue"><span>Progresso do acompanhamento</span><strong>{percent(model.data.overview.progress)}</strong><small>P, F e N/A preenchidos</small></article>
            <article className="metric accent-blue"><span>Acompanhamento iniciado</span><strong>{model.data.overview.started}</strong><small>Ao menos um registro</small></article>
            <article className="metric accent-green"><span>Acompanhamento completo</span><strong>{model.data.overview.complete}</strong><small>Todos os registros preenchidos</small></article>
            <article className="metric accent-amber"><span>Frequência abaixo de 75%</span><strong>{model.data.overview.belowMinimum}</strong><small>Métrica de atenção</small></article>
            <article className="metric accent-green"><span>Trabalhos entregues</span><strong>{model.data.overview.finalWorkDelivered}</strong><small>Registro explícito</small></article>
            <article className="metric accent-amber"><span>Trabalhos pendentes</span><strong>{model.data.overview.pendingFinalWork}</strong><small>Ainda não informado</small></article>
            <article className="metric accent-green"><span>Aptos à certificação</span><strong>{model.data.overview.aptStudents}</strong><small>Situação final efetiva</small></article>
            <article className="metric accent-amber"><span>Exigem atenção</span><strong>{model.data.overview.attention}</strong><small>Lista priorizada abaixo</small></article>
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
                    <th>Turma</th><th>Cursistas</th><th>Frequência média</th><th>Progresso</th><th>Completo</th><th>&lt; 75%</th><th>Trabalho pendente</th><th>Aptos</th><th><span className="sr-only">Acessar</span></th>
                  </tr>
                </thead>
                <tbody>
                  {model.data.classrooms.map((classroom) => (
                    <tr key={classroom.id}>
                      <td><Link className="table-primary-link" href={`/turmas/${classroom.id}`}>{classroom.name}</Link></td>
                      <td>{classroom.students}</td>
                      <td><strong>{percent(classroom.averageFrequency)}</strong></td>
                      <td><strong>{percent(classroom.progress)}</strong></td>
                      <td>{classroom.complete}</td>
                      <td>{classroom.belowMinimum}</td>
                      <td>{classroom.pendingFinalWork}</td>
                      <td><span className="status ok">{classroom.aptStudents}</span></td>
                      <td><Link className="row-arrow" href={`/turmas/${classroom.id}`} aria-label={`Abrir ${classroom.name}`}>→</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="section-block" id="atencao">
            <div className="section-heading"><div><h2>Cursistas que exigem atenção</h2><p>Pendências para acompanhamento; não é um ranking nem reprovação.</p></div><span>{model.data.attention.length} exibido(s)</span></div>
            {model.data.attention.length ? <div className="table-wrap"><table className="summary-table attention-table"><thead><tr><th>Cursista</th><th>Turma</th><th>Município</th><th>Frequência</th><th>Progresso</th><th>Trabalho final</th><th>Situação</th><th>Motivo</th></tr></thead><tbody>
              {model.data.attention.map((student) => <tr key={student.id}><td><Link className="table-primary-link" href={`/turmas/${student.classroomId}`}>{student.name}</Link></td><td>{student.classroom}</td><td>{student.municipality || "—"}</td><td>{percent(student.frequency)}</td><td>{percent(student.progress)}</td><td>{student.finalWork === null ? "Pendente" : student.finalWork ? "Entregou" : "Não entregou"}</td><td>{FINAL_STATUS_LABELS[student.status]}</td><td>{student.reason}</td></tr>)}
            </tbody></table></div> : <div className="empty-state"><h2>Nenhuma atenção sinalizada</h2><p>Não há pendências nos critérios do recorte selecionado.</p></div>}
          </section>
        </>
      )}
    </AppShell>
  );
}
