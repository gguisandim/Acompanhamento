import postgres from "postgres";
import { writeFile } from "node:fs/promises";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });
const users = await sql`SELECT email, role, state_id, classroom_id FROM users WHERE active = TRUE ORDER BY role`;
const classrooms = await sql`SELECT id, name, state_id FROM classrooms ORDER BY name`;
const loginHtml = await (await fetch(`${baseUrl}/login`)).text();
const actionId = loginHtml.match(/type="hidden" name="([^"]+)"/)?.[1];
if (!actionId) throw new Error("Ação de login não encontrada.");

async function login(email, password) {
  const form = new FormData();
  form.set(actionId, "");
  form.set("email", email);
  form.set("password", password);
  const response = await fetch(`${baseUrl}/login`, { method: "POST", body: form, redirect: "manual" });
  return { response, cookie: (response.headers.get("set-cookie") ?? "").split(";")[0] };
}

const credentials = {
  PROFESSOR: ["professor@demo.local", process.env.DEMO_PASSWORD],
  COORDENADOR_ESTADUAL: ["coord.pa@demo.local", process.env.DEMO_PASSWORD],
  COORDENADOR_GERAL: ["coord.geral@demo.local", process.env.DEMO_PASSWORD],
  ADMIN: [process.env.INITIAL_ADMIN_EMAIL, process.env.INITIAL_ADMIN_PASSWORD]
};

let failures = 0;
for (const [role, [email, password]] of Object.entries(credentials)) {
  if (!email || !password) {
    console.log(`${role}: credenciais não configuradas; teste ignorado.`);
    continue;
  }
  const user = users.find((item) => item.role === role && item.email === email);
  if (!user) {
    console.log(`${role}: usuário de teste não encontrado; teste ignorado.`);
    continue;
  }
  const { response, cookie } = await login(email, password);
  const dashboard = await fetch(`${baseUrl}/dashboard?estado=PA`, { headers: { cookie }, redirect: "manual" });
  const html = await dashboard.text();

  const ownStateClass = classrooms.find((item) => item.state_id === user.state_id && item.id !== user.classroom_id);
  const otherStateClass = classrooms.find((item) => item.state_id !== user.state_id);
  const target = role === "PROFESSOR" ? ownStateClass : role === "COORDENADOR_ESTADUAL" ? otherStateClass : classrooms[0];
  const permission = await fetch(`${baseUrl}/api/turmas/${target.id}/resultado`, {
    method: "POST", headers: { cookie, "content-type": "application/json" }, body: "{}"
  });
  const expectedPermission = role === "PROFESSOR" || role === "COORDENADOR_ESTADUAL" ? 403 : 400;
  const ok = response.status === 303 && dashboard.status === 200 && html.includes("Progresso do acompanhamento") && permission.status === expectedPermission;
  if (!ok) failures += 1;
  console.log(`${role}: login=${response.status}, dashboard=${dashboard.status}, escopo=${permission.status} (${ok ? "OK" : "FALHOU"})`);

  if (role === "ADMIN" && dashboard.status === 200) {
    const pa01 = classrooms.find((item) => item.name === "PA-01");
    const exported = await fetch(`${baseUrl}/api/turmas/${pa01.id}/exportar`, { headers: { cookie } });
    const bytes = new Uint8Array(await exported.arrayBuffer());
    const exportOk = exported.status === 200 && bytes[0] === 0x50 && bytes[1] === 0x4b;
    if (!exportOk) failures += 1;
    console.log(`EXPORTAÇÃO: status=${exported.status}, xlsx=${exportOk ? "OK" : "FALHOU"}`);
    if (exportOk && process.env.SMOKE_EXPORT_PATH) await writeFile(process.env.SMOKE_EXPORT_PATH, bytes);

    if (exportOk && process.env.SMOKE_IMPORT === "1") {
      const [before] = await sql`
        SELECT COUNT(DISTINCT st.id)::int AS students, COUNT(a.student_id)::int AS attendance,
               MD5(COALESCE(STRING_AGG(a.student_id::text || ':' || a.module || ':' || a.slot || ':' || a.status, ',' ORDER BY a.student_id,a.module,a.slot), '')) AS signature
        FROM students st LEFT JOIN attendance a ON a.student_id=st.id WHERE st.classroom_id=${pa01.id}
      `;
      const form = new FormData();
      form.set("file", new File([bytes], "PA-01-reimportacao.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const imported = await fetch(`${baseUrl}/api/turmas/${pa01.id}/importar`, { method: "POST", headers: { cookie }, body: form });
      const [after] = await sql`
        SELECT COUNT(DISTINCT st.id)::int AS students, COUNT(a.student_id)::int AS attendance,
               MD5(COALESCE(STRING_AGG(a.student_id::text || ':' || a.module || ':' || a.slot || ':' || a.status, ',' ORDER BY a.student_id,a.module,a.slot), '')) AS signature
        FROM students st LEFT JOIN attendance a ON a.student_id=st.id WHERE st.classroom_id=${pa01.id}
      `;
      const importOk = imported.status === 200 && before.students === after.students && before.attendance === after.attendance && before.signature === after.signature;
      if (!importOk) failures += 1;
      console.log(`REIMPORTAÇÃO: status=${imported.status}, alunos=${before.students}->${after.students}, presenças=${before.attendance}->${after.attendance} (${importOk ? "PRESERVADAS" : "FALHOU"})`);
    }
  }
}

await sql.end();
if (failures) process.exitCode = 1;
