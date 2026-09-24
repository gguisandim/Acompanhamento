"use client";

import { useState } from "react";
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
    <div className="heatmap"><div /><>{modules.map((module) => <strong key={module}>M{module}</strong>)}</>
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
  if (!data.encounters.length) return <div className="chart-empty">Sem presenças válidas para comparar encontros.</div>;
  const modules = Array.from(new Set(data.encounters.map((item) => item.module))).sort();
  return <div className="heatmap encounter-heatmap"><div />{[1,2,3,4,5,6].map((slot) => <strong key={slot}>Encontro {slot}</strong>)}
    {modules.flatMap((module) => [<span className="heatmap-label" key={`${module}-label`}>Módulo {module}</span>, ...[1,2,3,4,5,6].map((slot) => {
      const value = data.encounters.find((item) => item.module === module && item.slot === slot)?.frequency ?? null;
      return <span className="heatmap-cell" key={`${module}-${slot}`} title={`Módulo ${module}, encontro ${slot}: ${percent(value)}`} style={{ backgroundColor: value === null ? "#f3f6f7" : `rgba(59,167,216,${Math.max(.08,value)*.72})` }}>{percent(value)}</span>;
    })])}
  </div>;
}

export default function DashboardCharts({ data }: { data: DashboardData }) {
  return <section className="charts-grid dashboard-charts" id="resultados">
    <article className="chart-card"><div className="chart-heading"><h2>Frequência média por turma</h2><p>P ÷ (P + F), sem transformar módulo em aprovação</p></div><BarList items={data.classrooms.map((item) => ({ label:item.name,value:item.averageFrequency }))} /></article>
    <article className="chart-card"><div className="chart-heading"><h2>Progresso por turma</h2><p>Registros P, F ou N/A preenchidos</p></div><BarList tone="blue" items={data.classrooms.map((item) => ({ label:item.name,value:item.progress }))} /></article>
    <article className="chart-card"><div className="chart-heading"><h2>Frequência por módulo</h2><p>“—” significa ausência de P/F válidos</p></div><BarList items={data.modules.map((item) => ({ label:`Módulo ${item.module}`,value:item.averageFrequency }))} /></article>
    <article className="chart-card"><div className="chart-heading"><h2>Progresso por módulo</h2><p>Preenchimento dos seis encontros esperados</p></div><BarList tone="blue" items={data.modules.map((item) => ({ label:`Módulo ${item.module}`,value:item.progress }))} /></article>
    <article className="chart-card chart-full"><div className="chart-heading"><h2>Turma × módulo</h2><p>Alterne entre participação e preenchimento</p></div><Heatmap data={data} /></article>
    <article className="chart-card"><div className="chart-heading"><h2>Distribuição de frequência</h2><p>Cursistas por faixa</p></div><BarList mode="count" items={data.frequencyDistribution.map((item) => ({ label:item.label,value:item.count }))} /></article>
    <article className="chart-card"><div className="chart-heading"><h2>Distribuição de progresso</h2><p>Nível de preenchimento</p></div><BarList mode="count" tone="blue" items={data.progressDistribution.map((item) => ({ label:item.label,value:item.count }))} /></article>
    <article className="chart-card"><div className="chart-heading"><h2>Trabalho final</h2><p>Pendente é diferente de “não entregou”</p></div><BarList mode="count" tone="blue" items={[{label:"Entregou",value:data.finalWork.delivered},{label:"Não entregou",value:data.finalWork.notDelivered},{label:"Pendente",value:data.finalWork.pending}]} /></article>
    <article className="chart-card"><div className="chart-heading"><h2>Situação final</h2><p>Situação manual, quando definida, prevalece</p></div><BarList mode="count" items={data.finalStatuses.map((item) => ({ label:FINAL_STATUS_LABELS[item.status],value:item.count }))} /></article>
    <article className="chart-card chart-full"><div className="chart-heading"><h2>Encontros / presenças</h2><p>Ajuda a localizar encontros com participação atipicamente baixa</p></div><EncounterHeatmap data={data} /></article>
    <article className="chart-card"><div className="chart-heading"><h2>Cursistas por município</h2><p>Distribuição territorial do recorte</p></div><BarList mode="count" tone="blue" items={data.municipalities.map((item) => ({ label:item.municipality,value:item.students }))} /></article>
    <article className="chart-card"><div className="chart-heading"><h2>Frequência por município</h2><p>Média individual em cada município</p></div><BarList items={data.municipalities.map((item) => ({ label:item.municipality,value:item.averageFrequency }))} /></article>
    <article className="chart-card"><div className="chart-heading"><h2>Progresso por município</h2><p>Preenchimento médio</p></div><BarList tone="blue" items={data.municipalities.map((item) => ({ label:item.municipality,value:item.progress }))} /></article>
    <article className="chart-card"><div className="chart-heading"><h2>Andamento do curso</h2><p>Etapas acumuladas do acompanhamento</p></div><div className="funnel-list">{data.funnel.map((item,index) => <div key={item.label}><span>{item.label}</span><strong>{item.count}</strong>{index < data.funnel.length-1 ? <i>↓</i> : null}</div>)}</div></article>
  </section>;
}
