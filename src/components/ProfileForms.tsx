"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  changePasswordAction,
  updateProfileAction,
  type ProfileActionResult
} from "@/app/perfil/actions";

function Feedback({ result }: { result: ProfileActionResult | null }) {
  if (!result) return null;
  return <p className={result.ok ? "form-feedback success" : "form-feedback error"}>{result.message}</p>;
}

export default function ProfileForms({ name }: { name: string }) {
  const router = useRouter();
  const [profileResult, setProfileResult] = useState<ProfileActionResult | null>(null);
  const [passwordResult, setPasswordResult] = useState<ProfileActionResult | null>(null);
  const [profilePending, setProfilePending] = useState(false);
  const [passwordPending, setPasswordPending] = useState(false);

  async function saveProfile(formData: FormData) {
    setProfilePending(true);
    const result = await updateProfileAction(String(formData.get("name") ?? ""));
    setProfileResult(result);
    setProfilePending(false);
    if (result.ok) router.refresh();
  }

  async function savePassword(formData: FormData) {
    setPasswordPending(true);
    const result = await changePasswordAction({
      currentPassword: String(formData.get("currentPassword") ?? ""),
      newPassword: String(formData.get("newPassword") ?? ""),
      confirmation: String(formData.get("confirmation") ?? "")
    });
    setPasswordResult(result);
    setPasswordPending(false);
    if (result.ok) {
      const form = document.getElementById("password-form") as HTMLFormElement | null;
      form?.reset();
    }
  }

  return (
    <div className="profile-form-grid">
      <form action={saveProfile} className="panel-form">
        <div>
          <h2>Informações pessoais</h2>
          <p className="muted">Este é o nome exibido no sistema.</p>
        </div>
        <label>
          Nome completo
          <input name="name" defaultValue={name} minLength={2} maxLength={120} required />
        </label>
        <Feedback result={profileResult} />
        <button className="button button-primary" type="submit" disabled={profilePending}>
          {profilePending ? "Salvando..." : "Salvar nome"}
        </button>
      </form>

      <form id="password-form" action={savePassword} className="panel-form" aria-labelledby="senha">
        <div>
          <h2 id="senha">Alterar senha</h2>
          <p className="muted">Use no mínimo 8 caracteres.</p>
        </div>
        <label>
          Senha atual
          <input name="currentPassword" type="password" autoComplete="current-password" required />
        </label>
        <label>
          Nova senha
          <input name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <label>
          Confirmar nova senha
          <input name="confirmation" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <Feedback result={passwordResult} />
        <button className="button button-primary" type="submit" disabled={passwordPending}>
          {passwordPending ? "Alterando..." : "Alterar senha"}
        </button>
      </form>
    </div>
  );
}
