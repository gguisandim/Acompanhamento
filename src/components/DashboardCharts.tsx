import type { DashboardData } from "@/lib/dashboard";

function percent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value * 100)}%`;
}

function BarList({ items, emptyMessage }: {
  items: Array<{ label: string; value: number | null }>;
  emptyMessage: string;
}) {
  if (!items.some((item) => item.value !== null)) return <div className="chart-empty">{emptyMessage}</div>;
  return (
    <div className="bar-chart">
      {items.map((item) => (
        <div className="bar-row" key={item.label}>
          <span>{item.label}</span>
          <div className="bar-track"><i style={{ width: `${Math.max(0, Math.min(100, (item.value ?? 0) * 100))}%` }} /></div>
          <strong>{percent(item.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function Donut({ primary, secondary, primaryLabel, secondaryLabel, color = "green" }: {
  primary: number;
  secondary: number;
  primaryLabel: string;
  secondaryLabel: string;
  color?: "green" | "blue";
}) {
  const total = primary + secondary;
  if (total === 0) return <div className="chart-empty">Ainda não há dados para este recorte.</div>;
  const share = primary / total;
  const primaryColor = color === "green" ? "#16a36a" : "#3ba7d8";
  return (
    <div className="donut-layout">
      <div className="donut" style={{ background: `conic-gradient(${primaryColor} 0 ${share * 100}%, #dfe9ed ${share * 100}% 100%)` }}>
        <span><strong>{percent(share)}</strong><small>{primaryLabel}</small></span>
      </div>
      <dl className="chart-legend">
        <div><dt><i style={{ background: primaryColor }} />{primaryLabel}</dt><dd>{primary}</dd></div>
        <div><dt><i />{secondaryLabel}</dt><dd>{secondary}</dd></div>
      </dl>
    </div>
  );
}

export default function DashboardCharts({ data }: { data: DashboardData }) {
  const notApt = Math.max(0, data.overview.totalStudents - data.overview.aptStudents);
  return (
    <section className="charts-grid" id="resultados">
      <article className="chart-card chart-wide">
        <div className="chart-heading"><div><h2>Frequência média por turma</h2><p>Comparativo das turmas no recorte atual</p></div></div>
        <BarList items={data.classrooms.map((item) => ({ label: item.name, value: item.averageFrequency }))} emptyMessage="As turmas selecionadas ainda não possuem presenças registradas." />
      </article>
      <article className="chart-card">
        <div className="chart-heading"><div><h2>Situação para certificação</h2><p>Frequência mínima + trabalho entregue</p></div></div>
        <Donut primary={data.overview.aptStudents} secondary={notApt} primaryLabel="Aptos" secondaryLabel="Não aptos" />
      </article>
      <article className="chart-card chart-wide">
        <div className="chart-heading"><div><h2>Presença por módulo</h2><p>Frequência consolidada em cada módulo</p></div></div>
        <BarList items={data.modules.map((item) => ({ label: `Módulo ${item.module}`, value: item.averageFrequency }))} emptyMessage="Não há presenças por módulo para exibir." />
      </article>
      <article className="chart-card">
        <div className="chart-heading"><div><h2>Trabalho final</h2><p>Entregas no recorte selecionado</p></div></div>
        <Donut primary={data.finalWork.delivered} secondary={data.finalWork.pending} primaryLabel="Entregou" secondaryLabel="Não entregou" color="blue" />
      </article>
    </section>
  );
}
