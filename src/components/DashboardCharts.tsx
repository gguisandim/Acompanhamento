"use client";

import { useState } from "react";
import Link from "next/link";
import type { DashboardData } from "@/lib/dashboard";
import { FINAL_STATUS_LABELS } from "@/lib/types";

function percent(value: number | null) {
  return value === null || !Number.isFinite(value) ? "—" : `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function BarList({ items, mode = "percent", tone = "green", emptyMessage = "Sem dados para este recorte." }: {
  items: Array<{ label: string; value: number | null; detail?: string }>;
  mode?: "percent" | "count"; tone?: "green" | "blue"; emptyMessage?: string;
}) {
  const max = mode === "count" ? Math.max(1, ...items.map((item) => item.value ?? 0)) : 1;
  if (!items.length || !items.some((item) => item.value !== null)) return <div className="chart-empty">{emptyMessage}</div>;
  return <div className={`bar-chart tone-${tone}`}>{items.map((item) => (
    <div className="bar-row" key={item.label} title={item.detail}>
      <span>{item.label}</span><div className="bar-track"><i style={{ width: `${Math.max(0, Math.min(100, ((item.value ?? 0) / max) * 100))}%` }} /></div>
      <strong>{mode === "percent" ? percent(item.value) : item.value ?? 0}</strong>
    </div>
  ))}</div>;
}

function Heatmap({ data }: { data: DashboardData }) {
  const [mode, setMode] = useState<"frequency" | "progress">("frequency");
  const classes = Array.from(new Map(data.classrooms.map((item) => [item.id, item.name])).entries());
  const modules = Array.from(new Set(data.heatmap.map((item) => item.module))).sort();
  if (!data.heatmap.length) return <div className="chart-empty">Ainda não há acompanhamento para compor a matriz.</div>;
  return <>
    <div className="chart-toggle"><button className={mode === "frequency" ? "active" : ""} onClick={() => setMode("frequency")}>Frequência</button><button className={mode === "progress" ? "active" : ""} onClick={() => setMode("progress")}>Progresso</button></div>
    <div className="heatmap"><div />{modules.map((module) => <strong key={module}>M{module}</strong>)}
      {classes.flatMap(([id, name]) => {
        const label = <span className="heatmap-label" key={`${id}-label`}>{name}</span>;
        const cells = modules.map((module) => {
          const item = data.heatmap.find((cell) => cell.classroomId === id && cell.module === module);
          const value = item ? item[mode] : null;
          const intensity = value === null ? 0 : Math.max(.08, value);
          return <span key={`${id}-${module}`} className="heatmap-cell" title={`${name} · Módulo ${module} · ${mode === "frequency" ? "Frequência" : "Progresso"}: ${percent(value)}`} style={{ backgroundColor: value === null ? "#f3f6f7" : mode === "frequency" ? `rgba(22,163,106,${intensity * .72})` : `rgba(59,167,216,${intensity * .72})` }}>{percent(value)}</span>;
        });
        return [label, ...cells];
      })}
    </div>
  </>;
}

function EncounterHeatmap({ data }: { data: DashboardData }) {
  if (!data.encounters.length) return <div className="chart-empty">Sem registros válidos para comparar as atividades.</div>;
  const modules = Array.from(new Set(data.encounters.map((item) => item.module))).sort();
  return <div className="heatmap encounter-heatmap"><div />{[1,2,3,4,5,6].map((slot) => <strong key={slot}>Atividade {slot}</strong>)}
    {modules.flatMap((module) => [<span className="heatmap-label" key={`${module}-label`}>Módulo {module}</span>, ...[1,2,3,4,5,6].map((slot) => {
      const value = data.encounters.find((item) => item.module === module && item.slot === slot)?.frequency ?? null;
      return <span className="heatmap-cell" key={`${module}-${slot}`} title={`Módulo ${module}, atividade ${slot}: ${percent(value)}`} style={{ backgroundColor: value === null ? "#f3f6f7" : `rgba(59,167,216,${Math.max(.08,value)*.72})` }}>{percent(value)}</span>;
    })])}
  </div>;
}

function ParticipationChart({ data }: { data: DashboardData }) {
  if (!data.participation.length) return <div className="chart-empty">Sem registros de atividade neste recorte.</div>;
  return <div className="stacked-list">
    <div className="stacked-legend"><span><i className="legend-p" />P</span><span><i className="legend-f" />F</span><span><i className="legend-na" />N/A</span></div>
    {data.participation.map((item) => {
      const total = item.present + item.absent + item.notApplicable;
      const p = total ? item.present / total * 100 : 0;
      const f = total ? item.absent / total * 100 : 0;
      const na = total ? item.notApplicable / total * 100 : 0;
      return <div className="stacked-row" key={item.module}>
        <span>Módulo {item.module}</span>
        <div className="stacked-track" title={`P: ${item.present} · F: ${item.absent} · N/A: ${item.notApplicable}`}>
          <i className="segment-p" style={{ width: `${p}%` }} /><i className="segment-f" style={{ width: `${f}%` }} /><i className="segment-na" style={{ width: `${na}%` }} />
        </div>
        <strong>{total}</strong>
      </div>;
    })}
  </div>;
}

function FrequencyProgressScatter({ data }: { data: DashboardData }) {
  const points = data.scatter.filter((item) => item.frequency !== null);
  if (!points.length) return <div className="chart-empty">Ainda não há cursistas com frequência calculável neste recorte.</div>;
  return <div className="scatter-wrap">
    <div className="scatter-y-label">Frequência</div>
    <div className="scatter-plot" aria-label="Relação entre progresso e frequência">
      <span className="scatter-threshold" style={{ bottom: "75%" }}><em>75%</em></span>
      {points.map((item) => (
        <Link
          key={item.id}
          href={`/turmas/${item.classroomId}/cursistas/${item.id}`}
          className="scatter-point"
          style={{ left: `${Math.max(1, Math.min(99, item.progress * 100))}%`, bottom: `${Math.max(1, Math.min(99, (item.frequency ?? 0) * 100))}%` }}
          title={`${item.name} · ${item.classroom}\nFrequência: ${percent(item.frequency)}\nProgresso: ${percent(item.progress)}\n${item.municipality || "Município não informado"}`}
          aria-label={`${item.name}: frequência ${percent(item.frequency)}, progresso ${percent(item.progress)}`}
        />
      ))}
    </div>
    <div className="scatter-x-label">Progresso →</div>
  </div>;
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <div className="analytics-section-title"><span>{eyebrow}</span><h2>{title}</h2><p>{text}</p></div>;
}

export default function DashboardCharts({ data }: { data: DashboardData }) {
  return <div className="dashboard-analytics" id="resultados">
    <SectionTitle eyebrow="Participação" title="Atividades e frequência" text="Como os cursistas estão participando das atividades dos módulos do curso EAD." />
    <section className="charts-grid dashboard-charts">
      <article className="chart-card"><div className="chart-heading"><h2>Frequência média por turma</h2><p>P ÷ (P + F), sem transformar módulo em aprovação</p></div><BarList items={data.classrooms.map((item) => ({ label:item.name,value:item.averageFrequency }))} /></article>
      <article className="chart-card"><div className="chart-heading"><h2>Frequência por módulo</h2><p>“—” significa ausência de P/F válidos</p></div><BarList items={data.modules.map((item) => ({ label:`Módulo ${item.module}`,value:item.averageFrequency }))} /></article>
      <article className="chart-card chart-full"><div className="chart-heading"><h2>Composição P / F / N/A por módulo</h2><p>Mostra a composição dos registros preenchidos, sem confundir N/A com falta.</p></div><ParticipationChart data={data} /></article>
      <article className="chart-card"><div className="chart-heading"><h2>Distribuição de frequência</h2><p>Inclui cursistas sem P/F válido como “Sem dados”.</p></div><BarList mode="count" items={data.frequencyDistribution.map((item) => ({ label:item.label,value:item.count }))} /></article>
      <article className="chart-card chart-full"><div className="chart-heading"><h2>Atividades do módulo</h2><p>Ajuda a localizar atividades com participação atipicamente baixa</p></div><EncounterHeatmap data={data} /></article>
    </section>

    <SectionTitle eyebrow="Progresso" title="Preenchimento e andamento" text="Quanto do acompanhamento já foi registrado e onde existem lacunas." />
    <section className="charts-grid dashboard-charts">
      <article className="chart-card"><div className="chart-heading"><h2>Progresso por turma</h2><p>Registros P, F ou N/A preenchidos</p></div><BarList tone="blue" items={data.classrooms.map((item) => ({ label:item.name,value:item.progress }))} /></article>
      <article className="chart-card"><div className="chart-heading"><h2>Progresso por módulo</h2><p>Preenchimento das seis atividades previstas</p></div><BarList tone="blue" items={data.modules.map((item) => ({ label:`Módulo ${item.module}`,value:item.progress }))} /></article>
      <article className="chart-card chart-full"><div className="chart-heading"><h2>Turma × módulo</h2><p>Alterne entre participação e preenchimento</p></div><Heatmap data={data} /></article>
      <article className="chart-card"><div className="chart-heading"><h2>Distribuição de progresso</h2><p>Nível de preenchimento</p></div><BarList mode="count" tone="blue" items={data.progressDistribution.map((item) => ({ label:item.label,value:item.count }))} /></article>
      <article className="chart-card"><div className="chart-heading"><h2>Marcos do curso</h2><p>Indicadores de andamento; não representam um funil obrigatório.</p></div><div className="milestones-list">{data.milestones.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.count}</strong></div>)}</div></article>
      <article className="chart-card chart-full"><div className="chart-heading"><h2>Frequência × progresso</h2><p>Cada ponto é um cursista. Clique para abrir a visão individual.</p></div><FrequencyProgressScatter data={data} /></article>
    </section>

    <SectionTitle eyebrow="Território e encerramento" title="Municípios e situação final" text="Distribuição territorial e pendências do encerramento do curso." />
    <section className="charts-grid dashboard-charts">
      <article className="chart-card"><div className="chart-heading"><h2>Cursistas por município</h2><p>Distribuição territorial do recorte</p></div><BarList mode="count" tone="blue" items={data.municipalities.map((item) => ({ label:item.municipality,value:item.students }))} /></article>
      <article className="chart-card"><div className="chart-heading"><h2>Frequência por município</h2><p>Média individual em cada município</p></div><BarList items={data.municipalities.map((item) => ({ label:item.municipality,value:item.averageFrequency }))} /></article>
      <article className="chart-card"><div className="chart-heading"><h2>Progresso por município</h2><p>Preenchimento médio</p></div><BarList tone="blue" items={data.municipalities.map((item) => ({ label:item.municipality,value:item.progress }))} /></article>
      <article className="chart-card"><div className="chart-heading"><h2>Trabalho final</h2><p>Pendente é diferente de “não entregou”</p></div><BarList mode="count" tone="blue" items={[{label:"Entregou",value:data.finalWork.delivered},{label:"Não entregou",value:data.finalWork.notDelivered},{label:"Pendente",value:data.finalWork.pending}]} /></article>
      <article className="chart-card chart-full"><div className="chart-heading"><h2>Situação final</h2><p>Situação manual, quando definida, prevalece; revisões desatualizadas aparecem na lista de atenção.</p></div><BarList mode="count" items={data.finalStatuses.map((item) => ({ label:FINAL_STATUS_LABELS[item.status],value:item.count }))} /></article>
    </section>
  </div>;
}
