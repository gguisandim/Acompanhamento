import Link from "next/link";
import AppShell from "@/components/AppShell";
import StateScopeSelector from "@/components/StateScopeSelector";
import StudentSearch from "@/components/StudentSearch";
import { requireUser } from "@/lib/auth";
import { getDashboardModel, type DashboardQuery } from "@/lib/dashboard";
import { searchAccessibleStudents } from "@/lib/data";
import { FINAL_STATUS_LABELS } from "@/lib/types";

function percent(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value * 100)}%`;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<DashboardQuery> }) {
  const user = await requireUser();
  const query = await searchParams;
  const [model, searchResults] = await Promise.all([
    getDashboardModel(user, { estado: query.estado }),
    searchAccessibleStudents(user, query.busca ?? "")
  ]);

  return (
    <AppShell user={user}>
      <header className="page-header dashboard-header">
        <div>
          <p className="eyebrow">VISÃO GERAL</p>
          <h1>Acompanhamento 2026</h1>
          <p className="muted">
            {model ? `${model.filters.stateName} · resumo operacional do curso EAD.` : "Seu acesso ainda não possui turmas vinculadas."}
          </p>
        </div>
        {model ? (
          <StateScopeSelector
            states={model.states}
            selectedCode={model.filters.stateCode}
            canSelectState={model.canSelectState}
            action="/dashboard"
          />
        ) : null}
      </header>

      {!model ? (
        <section className="empty-state">
          <h2>Nenhuma turma vinculada</h2>
          <p>Solicite à administração a definição do seu estado ou turma.</p>
        </section>
      ) : (
        <>
          <StudentSearch term={(query.busca ?? "").trim()} results={searchResults} />

          <section className="metrics dashboard-metrics dashboard-metrics-compact" aria-label="Indicadores principais">
            <article className="metric accent-blue"><span>Total de cursistas</span><strong>{model.data.overview.totalStudents}</strong><small>{model.data.overview.classrooms} turma(s) no estado</small></article>
            <article className="metric accent-green"><span>Frequência média</span><strong>{percent(model.data.overview.averageFrequency)}</strong><small>Participação registrada nas atividades</small></article>
            <article className="metric accent-blue"><span>Progresso do acompanhamento</span><strong>{percent(model.data.overview.progress)}</strong><small>Atividades com P, F ou N/A</small></article>
            <article className="metric accent-green"><span>Acompanhamento completo</span><strong>{model.data.overview.complete}</strong><small>Cursistas com 36 registros preenchidos</small></article>
            <article className="metric accent-amber"><span>Frequência abaixo de 75%</span><strong>{model.data.overview.belowMinimum}</strong><small>Sinal de atenção, não reprovação</small></article>
            <article className="metric accent-amber"><span>Exigem atenção</span><strong>{model.data.overview.attention}</strong><small>Pendências de acompanhamento</small></article>
          </section>

          <section className="dashboard-shortcuts" aria-label="Acessos rápidos">
            <Link href={`/turmas?estado=${model.filters.stateCode}`} className="shortcut-card shortcut-primary">
              <span className="shortcut-icon">01</span>
              <div><strong>Preencher turmas</strong><p>Acesse rapidamente cada turma e abra diretamente o módulo que precisa ser atualizado.</p></div>
              <i>→</i>
            </Link>
            <Link href={`/analises?estado=${model.filters.stateCode}`} className="shortcut-card">
              <span className="shortcut-icon">02</span>
              <div><strong>Análises</strong><p>Gráficos de frequência, progresso, atividades, municípios e comparação entre turmas.</p></div>
              <i>→</i>
            </Link>
            <Link href={`/resultados?estado=${model.filters.stateCode}`} className="shortcut-card">
              <span className="shortcut-icon">03</span>
              <div><strong>Resultados finais</strong><p>Acompanhe trabalho final, situação do curso e revisões de cada turma.</p></div>
              <i>→</i>
            </Link>
          </section>

          <section className="dashboard-preview-grid">
            <article className="section-card">
              <div className="section-heading">
                <div><h2>Turmas</h2><p>Resumo rápido do estado selecionado.</p></div>
                <Link className="text-link" href={`/turmas?estado=${model.filters.stateCode}`}>Ver todas →</Link>
              </div>
              <div className="compact-class-list">
                {model.data.classrooms.map((classroom) => (
                  <Link key={classroom.id} href={`/turmas/${classroom.id}`}>
                    <div><strong>{classroom.name}</strong><span>{classroom.students} cursistas</span></div>
                    <div className="compact-class-metrics"><span>Freq. {percent(classroom.averageFrequency)}</span><span>Progresso {percent(classroom.progress)}</span></div>
                    <i>→</i>
                  </Link>
                ))}
              </div>
            </article>

            <article className="section-card">
              <div className="section-heading">
                <div><h2>Atenções prioritárias</h2><p>Alguns cursistas com pendências no acompanhamento.</p></div>
                <span>{model.data.attention.length} sinalizado(s)</span>
              </div>
              {model.data.attention.length ? (
                <div className="attention-compact-list">
                  {model.data.attention.slice(0, 6).map((student) => (
                    <Link key={student.id} href={`/turmas/${student.classroomId}/cursistas/${student.id}`}>
                      <div><strong>{student.name}</strong><span>{student.classroom} · {student.municipality || "Município não informado"}</span></div>
                      <div><span>{student.reason}</span><small>{FINAL_STATUS_LABELS[student.status]}</small></div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact-empty"><h2>Nenhuma atenção sinalizada</h2><p>Não há pendências nos critérios atuais.</p></div>
              )}
            </article>
          </section>
        </>
      )}
    </AppShell>
  );
}
