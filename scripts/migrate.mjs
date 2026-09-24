import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, ssl: "require", prepare: false });
const directory = path.resolve("db", "migrations");
const files = (await fs.readdir(directory))
  .filter((file) => file.endsWith(".sql"))
  .sort();

try {
  for (const file of files) {
    const migration = await fs.readFile(path.join(directory, file), "utf8");
    await sql.unsafe(migration);
    console.log(`Migração aplicada: ${file}`);
  }
} finally {
  await sql.end();
}
