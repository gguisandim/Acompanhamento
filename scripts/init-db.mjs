import fs from "node:fs/promises";
import postgres from "postgres";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, ssl: "require", prepare: false });

const schema = await fs.readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
await sql.unsafe(schema);

const states = [
  ["AC", "Acre"],
  ["AP", "Amapá"],
  ["AM", "Amazonas"],
  ["PA", "Pará"],
  ["RO", "Rondônia"],
  ["RR", "Roraima"],
  ["TO", "Tocantins"]
];

for (const [code, name] of states) {
  await sql`
    INSERT INTO states (code, name)
    VALUES (${code}, ${name})
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  `;
}

for (const [code] of states) {
  const [state] = await sql`SELECT id FROM states WHERE code = ${code}`;
  for (let n = 1; n <= 6; n++) {
    await sql`
      INSERT INTO classrooms (state_id, number, name)
      VALUES (${state.id}, ${n}, ${`${code}-${String(n).padStart(2, "0")}`})
      ON CONFLICT (state_id, number) DO UPDATE SET name = EXCLUDED.name
    `;
  }
}

const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
const adminName = process.env.INITIAL_ADMIN_NAME?.trim() || "Administrador";

if (adminEmail && adminPassword) {
  const hash = await bcrypt.hash(adminPassword, 12);
  await sql`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (${adminName}, ${adminEmail}, ${hash}, 'ADMIN')
    ON CONFLICT (email) DO UPDATE
      SET name = EXCLUDED.name,
          password_hash = EXCLUDED.password_hash,
          role = 'ADMIN',
          state_id = NULL,
          classroom_id = NULL,
          active = TRUE
  `;
  console.log(`Administrador inicial configurado: ${adminEmail}`);
} else {
  console.log("Banco inicializado sem administrador. Defina INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD e rode novamente.");
}

if (process.env.SEED_DEMO === "true" || process.argv.includes("--demo")) {
  const demoPassword = process.env.DEMO_PASSWORD || "Demo2026!";
  const hash = await bcrypt.hash(demoPassword, 12);
  const [pa] = await sql`SELECT id FROM states WHERE code = 'PA'`;
  const [pa01] = await sql`SELECT id FROM classrooms WHERE state_id = ${pa.id} AND number = 1`;

  const demoUsers = [
    ["Professor Demo", "professor@demo.local", "PROFESSOR", pa.id, pa01.id],
    ["Coordenação PA", "coord.pa@demo.local", "COORDENADOR_ESTADUAL", pa.id, null],
    ["Coordenação Geral", "coord.geral@demo.local", "COORDENADOR_GERAL", null, null]
  ];

  for (const [name, email, role, stateId, classroomId] of demoUsers) {
    await sql`
      INSERT INTO users (name, email, password_hash, role, state_id, classroom_id)
      VALUES (${name}, ${email}, ${hash}, ${role}, ${stateId}, ${classroomId})
      ON CONFLICT (email) DO UPDATE
        SET name = EXCLUDED.name,
            password_hash = EXCLUDED.password_hash,
            role = EXCLUDED.role,
            state_id = EXCLUDED.state_id,
            classroom_id = EXCLUDED.classroom_id,
            active = TRUE
    `;
  }

  const names = [
    ["Ana Souza", "Belém"],
    ["Bruno Lima", "Ananindeua"],
    ["Carla Santos", "Santarém"],
    ["Daniel Costa", "Marabá"],
    ["Eduarda Alves", "Castanhal"],
    ["Felipe Rocha", "Abaetetuba"],
    ["Gabriela Silva", "Bragança"],
    ["Henrique Oliveira", "Altamira"],
    ["Isabela Martins", "Barcarena"],
    ["João Pereira", "Tucuruí"]
  ];

  for (let i = 0; i < names.length; i++) {
    const [name, municipality] = names[i];
    const [student] = await sql`
      INSERT INTO students (classroom_id, position, name, municipality, final_work_delivered)
      VALUES (${pa01.id}, ${i + 1}, ${name}, ${municipality}, ${i % 3 !== 0})
      ON CONFLICT (classroom_id, position) DO UPDATE
        SET name = EXCLUDED.name,
            municipality = EXCLUDED.municipality,
            final_work_delivered = EXCLUDED.final_work_delivered
      RETURNING id
    `;
    for (let module = 1; module <= 6; module++) {
      for (let slot = 1; slot <= 6; slot++) {
        const status = (i + module + slot) % 7 === 0 ? "F" : "P";
        await sql`
          INSERT INTO attendance (student_id, module, slot, status)
          VALUES (${student.id}, ${module}, ${slot}, ${status})
          ON CONFLICT (student_id, module, slot)
          DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
        `;
      }
    }
  }

  console.log("Dados de demonstração criados.");
  console.log(`Senha dos usuários demo: ${demoPassword}`);
}

await sql.end();
console.log("Banco pronto: 7 estados e 42 turmas.");
