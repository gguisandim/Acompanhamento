import type { DashboardStateOption } from "@/lib/dashboard";

export default function StateScopeSelector({
  states,
  selectedCode,
  canSelectState,
  action
}: {
  states: DashboardStateOption[];
  selectedCode: string;
  canSelectState: boolean;
  action: string;
}) {
  if (!states.length) return null;

  if (!canSelectState) {
    const state = states.find((item) => item.code === selectedCode) ?? states[0];
    return <span className="scope-pill">{state.code} · {state.name}</span>;
  }

  return (
    <form className="state-scope-form" action={action} method="get">
      <label>
        Estado
        <select name="estado" defaultValue={selectedCode}>
          {states.map((state) => (
            <option key={state.id} value={state.code}>{state.code} — {state.name}</option>
          ))}
        </select>
      </label>
      <button className="button button-secondary" type="submit">Aplicar</button>
    </form>
  );
}
