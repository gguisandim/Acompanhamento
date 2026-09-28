import Link from "next/link";
import type { StudentSearchResult } from "@/lib/data";

export default function StudentSearch({ term, results }: { term: string; results: StudentSearchResult[] }) {
  return (
    <section className="student-search-card">
      <div className="student-search-heading">
        <div>
          <strong>Buscar cursista</strong>
          <span>Pesquisa por nome, município ou turma dentro do seu escopo de acesso.</span>
        </div>
        <form action="/dashboard" method="get" className="student-search-form">
          <input name="busca" defaultValue={term} placeholder="Ex.: Maria Silva, Belém ou PA-03" minLength={2} />
          <button className="button button-secondary" type="submit">Buscar</button>
        </form>
      </div>
      {term.length >= 2 ? (
        results.length ? (
          <div className="student-search-results">
            {results.map((student) => (
              <Link key={student.id} href={`/turmas/${student.classroomId}/cursistas/${student.id}`}>
                <strong>{student.name}</strong>
                <span>{student.stateCode} · {student.classroomName} · {student.municipality || "Município não informado"} · Freq. {student.frequency === null ? "—" : `${(student.frequency * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`} · Progresso {(student.progress * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>
                <i>→</i>
              </Link>
            ))}
          </div>
        ) : <p className="student-search-empty">Nenhum cursista encontrado no seu escopo.</p>
      ) : null}
    </section>
  );
}
