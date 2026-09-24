"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  DashboardClassroomOption,
  DashboardFilters as FilterValues,
  DashboardStateOption
} from "@/lib/dashboard";

export default function DashboardFilters({
  filters,
  states,
  classrooms,
  canSelectState
}: {
  filters: FilterValues;
  states: DashboardStateOption[];
  classrooms: DashboardClassroomOption[];
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
      <div className="filter-grid">
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
          Situação
          <select name="situacao" defaultValue={filters.situation ?? ""}>
            <option value="">Todos</option>
            <option value="apto">Apto para certificação</option>
            <option value="nao-apto">Não apto</option>
            <option value="abaixo-75">Abaixo de 75% de frequência</option>
          </select>
        </label>
        <label>
          Trabalho final
          <select name="trabalho" defaultValue={filters.finalWork ?? ""}>
            <option value="">Todos</option>
            <option value="entregou">Entregou</option>
            <option value="nao-entregou">Não entregou</option>
          </select>
        </label>
      </div>
    </form>
  );
}
