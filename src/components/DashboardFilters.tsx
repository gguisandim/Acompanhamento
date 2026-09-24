"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  DashboardClassroomOption,
  DashboardFilters as FilterValues,
  DashboardStateOption
} from "@/lib/dashboard";
import { FINAL_STATUS_LABELS, type FinalStatus } from "@/lib/types";

export default function DashboardFilters({
  filters,
  states,
  classrooms,
  municipalities,
  canSelectState
}: {
  filters: FilterValues;
  states: DashboardStateOption[];
  classrooms: DashboardClassroomOption[];
  municipalities: string[];
  canSelectState: boolean;
}) {
  const router = useRouter();

  function apply(formData: FormData) {
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value) params.set(key, value);
    }
    router.replace(`/dashboard?${params.toString()}`, { scroll: false });
  }

  return (
    <form className="filter-panel" action={apply} onChange={(event) => event.currentTarget.requestSubmit()}>
      <div className="filter-heading">
        <div>
          <strong>Filtros do painel</strong>
          <span>Os indicadores abaixo usam este mesmo recorte.</span>
        </div>
        <Link href={`/dashboard?estado=${filters.stateCode}`} className="filter-clear">Limpar filtros</Link>
      </div>
      <div className="filter-grid dashboard-filter-grid">
        <label>
          Município
          <select name="municipio" defaultValue={filters.municipality ?? ""}>
            <option value="">Todos</option>
            {municipalities.map((municipality) => <option key={municipality} value={municipality}>{municipality}</option>)}
          </select>
        </label>
        <label>
          Estado
          <select name="estado" defaultValue={filters.stateCode} disabled={!canSelectState}>
            {states.map((state) => (
              <option key={state.id} value={state.code}>{state.code} — {state.name}</option>
            ))}
          </select>
          {!canSelectState ? <input type="hidden" name="estado" value={filters.stateCode} /> : null}
        </label>
        <label>
          Turma
          <select name="turma" defaultValue={filters.classroomName ?? ""}>
            <option value="">Todas</option>
            {classrooms.map((classroom) => (
              <option key={classroom.id} value={classroom.name}>{classroom.name}</option>
            ))}
          </select>
        </label>
        <label>
          Módulo
          <select name="modulo" defaultValue={filters.module ?? ""}>
            <option value="">Todos</option>
            {[1, 2, 3, 4, 5, 6].map((module) => (
              <option key={module} value={module}>Módulo {module}</option>
            ))}
          </select>
        </label>
        <label>
          Situação final
          <select name="situacao" defaultValue={filters.situation ?? ""}>
            <option value="">Todos</option>
            {(Object.entries(FINAL_STATUS_LABELS) as Array<[FinalStatus, string]>).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Trabalho final
          <select name="trabalho" defaultValue={filters.finalWork ?? ""}>
            <option value="">Todos</option>
            <option value="entregou">Entregou</option>
            <option value="nao-entregou">Não entregou</option>
            <option value="pendente">Pendente</option>
          </select>
        </label>
        <label>
          Faixa de frequência
          <select name="frequencia" defaultValue={filters.frequencyRange ?? ""}>
            <option value="">Todas</option><option value="0-49">0–49%</option><option value="50-74">50–74%</option><option value="75-89">75–89%</option><option value="90-100">90–100%</option>
          </select>
        </label>
        <label>
          Faixa de progresso
          <select name="progresso" defaultValue={filters.progressRange ?? ""}>
            <option value="">Todas</option><option value="0">0%</option><option value="1-24">1–24%</option><option value="25-49">25–49%</option><option value="50-74">50–74%</option><option value="75-99">75–99%</option><option value="100">100%</option>
          </select>
        </label>
      </div>
    </form>
  );
}
