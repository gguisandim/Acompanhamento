import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loginAction } from "./actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const current = await getCurrentUser();
  if (current) redirect("/dashboard");

  const { erro } = await searchParams;

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">A26</div>
        <p className="eyebrow">CURSO 2026 · REGIÃO NORTE</p>
        <h1>Acompanhamento de cursistas</h1>
        <p className="muted">
          Presenças, trabalho final, resultados e consolidação das 42 turmas em um único ambiente.
        </p>

        {erro ? <div className="alert alert-error">{erro}</div> : null}

        <form action={loginAction} className="form-stack">
          <label>
            E-mail
            <input name="email" type="email" autoComplete="email" required placeholder="nome@instituicao.br" />
          </label>
          <label>
            Senha
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="button button-primary" type="submit">Entrar</button>
        </form>
      </section>
    </main>
  );
}
