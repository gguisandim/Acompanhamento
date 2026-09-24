"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ImportRoster({ classroomId }: { classroomId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;

    if (!window.confirm("Importar os dados válidos da planilha e preservar os registros que ela não altera?")) {
      return;
    }

    setLoading(true);
    setMessage("");

    const formData = new FormData();
    formData.set("file", file);

    const response = await fetch(`/api/turmas/${classroomId}/importar`, {
      method: "POST",
      body: formData
    });

    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      const details = Array.isArray(data.conflicts) ? ` ${data.conflicts.join(" ")}` : "";
      setMessage(`${data.error ?? "Falha na importação."}${details}`);
      return;
    }

    setMessage(`${data.students} cursista(s) processado(s): ${data.inserted} novo(s), ${data.updated} atualizado(s). Registros ausentes e células vazias foram preservados.`);
    router.refresh();
  }

  return (
    <form className="import-card" onSubmit={submit}>
      <label className="file-drop">
        <span>Selecione a planilha .xlsx</span>
        <small>
          O importador lê a aba “1 - Acompanhamento”, linhas 8 a 37, incluindo nome,
          município, 36 presenças e trabalho final.
        </small>
        <input
          type="file"
          accept=".xlsx"
          required
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>

      <div className="alert">
        Importação conservadora: cursistas são conciliados por nome e município. Células
        válidas atualizam o acompanhamento; vazios não apagam presenças, e cursistas ausentes
        no arquivo permanecem cadastrados. Conflitos são bloqueados para revisão.
      </div>

      {message ? <div className="alert">{message}</div> : null}

      <button className="button button-primary" disabled={!file || loading} type="submit">
        {loading ? "Importando..." : "Importar com segurança"}
      </button>
    </form>
  );
}
