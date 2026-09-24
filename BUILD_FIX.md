# Correção do build — 23/09/2026

Correções aplicadas aos erros vistos no `next build`:

1. `getClassroom()` agora retorna um `ClassroomDetail` tipado que contém `id` e `state_id`, compatível com as funções de autorização.
2. As linhas das turmas acessíveis são normalizadas para um tipo explícito, removendo os `implicit any[]` de `data.ts`.
3. O estado `finalWork` do `AttendanceEditor` é construído com o union type `"" | "true" | "false"`, evitando o alargamento para `string` do `Object.fromEntries`.
4. A importação Excel passa o `ArrayBuffer` diretamente para `workbook.xlsx.load()`, evitando o conflito entre o `Buffer` do Node atual e o tipo `Buffer` declarado pelo ExcelJS 4.4.0.
5. `db:init` e `db:demo` carregam `.env` e `.env.local` automaticamente no Windows/Linux/macOS.
6. `db:demo` deixou de depender da sintaxe `SEED_DEMO=true ...`, que não funciona no CMD do Windows.

## Depois de aplicar

Na raiz do projeto:

```cmd
npm run build
```

Depois configure o banco em `.env` ou `.env.local` e rode:

```cmd
npm run db:init
npm run dev
```
