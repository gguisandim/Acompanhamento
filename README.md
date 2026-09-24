# Acompanhamento 2026

Aplicação inicial para centralizar as planilhas de acompanhamento de cursistas do curso 2026 na Região Norte.

## Regras implementadas

- 7 estados: AC, AP, AM, PA, RO, RR e TO.
- 6 turmas por estado (42 turmas).
- Cada turma comporta as 30 posições do modelo de planilha.
- 6 módulos, com 6 registros de presença em cada módulo.
- Presenças: `P`, `F`, `N/A` ou vazio.
- Frequência = `P / (P + F)`. `N/A` e vazio são ignorados.
- Progresso = registros `P`, `F` ou `N/A` preenchidos / registros esperados. Vazio não conta.
- Frequência mínima: 75%.
- Trabalho final: `Entregou`, `Não entregou` ou `Pendente`.
- A situação final sugerida considera progresso completo, frequência geral e trabalho final; a confirmação humana pode prevalecer.
- Cursistas são importados previamente; professor não cria/remover cursistas.

## Perfis

| Perfil | Escopo | Edita presença | Importa turma | Gerencia usuários |
| --- | --- | --- | --- | --- |
| Professor | Visualiza as 6 turmas do estado; edita 1 turma atribuída | Somente sua turma | Não | Não |
| Coordenador estadual | 6 turmas do seu estado | Sim | Sim | Não |
| Coordenador geral | Todas as 42 turmas | Sim | Sim | Não |
| Administrador | Toda a plataforma | Sim | Sim | Sim |

A autorização é conferida também no servidor/API. Não depende apenas de esconder botões na interface.

## Importação do Excel atual

O importador foi criado especificamente para o arquivo `Modelo_Planilhas_de_Acompanhamento_2026.xlsx`.

Ele lê a aba `1 - Acompanhamento`:

- linhas 8 a 37: 30 posições de cursistas;
- coluna B: cursista;
- coluna C: município;
- colunas D:AM: 36 registros de presença, 6 por módulo;
- coluna AN: trabalho final.

A importação é **conservadora**: concilia cursistas por nome e município, insere novos registros e atualiza apenas células explícitas. Cursistas ausentes e presenças em células vazias não são excluídos. Ambiguidades são bloqueadas para revisão.

## Exportação

Cada turma pode ser exportada para `.xlsx`, com:

1. `1 - Acompanhamento`: estrutura do modelo oficial, incluindo as 36 presenças.
2. `2 - Resultado Final`: frequência e progresso por módulo, frequência e progresso geral, trabalho final, situação e observações.

Não existe aprovação ou reprovação por módulo. Os módulos mostram apenas frequência, progresso e estado de preenchimento.

## Stack

- Next.js + React + TypeScript
- PostgreSQL (indicado para Neon ou PostgreSQL gerenciado)
- `postgres` para acesso SQL
- Sessão própria com cookie HTTP-only assinado com JWT
- `bcryptjs` para senhas
- `exceljs` para importação/exportação

## Rodar localmente

1. Copie `.env.example` para `.env` (ou `.env.local`).
2. Configure `DATABASE_URL`, `SESSION_SECRET`, `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD`. Os scripts `db:init` e `db:demo` carregam esses arquivos automaticamente no Windows, Linux e macOS.
3. Instale:

```bash
npm install
```

4. Crie tabelas, estados, turmas e o primeiro administrador:

```bash
npm run db:init
```

Em um banco já existente, aplique somente as migrações incrementais:

```bash
npm run db:migrate
```

As migrações são idempotentes e não recriam nem limpam as tabelas atuais.

Se aparecer `DATABASE_URL não definida`, confira se o arquivo `.env` ou `.env.local` está na raiz do projeto e se a linha `DATABASE_URL=...` foi preenchida.

5. Rode:

```bash
npm run dev
```

Validações disponíveis:

```bash
npm run typecheck
npm run build
npm run test:smoke
```

Acesse `http://localhost:3000`.

### Dados de demonstração

Se quiser criar usuários de demonstração e 10 cursistas fictícios no PA-01:

```bash
npm run db:demo
```

Usuários criados:

- `professor@demo.local`
- `coord.pa@demo.local`
- `coord.geral@demo.local`

A senha vem de `DEMO_PASSWORD`.

## Deploy no Render

O repositório já contém `render.yaml`.

No Render:

1. Crie/conecte o serviço web.
2. Configure `DATABASE_URL` apontando para o PostgreSQL/Neon.
3. Configure `SESSION_SECRET`.
4. Configure `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD`.
5. Antes do primeiro uso, execute `npm run db:init` no ambiente conectado ao banco.
6. Faça o deploy.

O armazenamento de dados fica no PostgreSQL, não no disco efêmero do Render.

## Próximas extensões previstas

A estrutura já permite adicionar, sem alterar a lógica principal:

- importação em lote de várias turmas;
- painel comparativo entre estados;
- trilha de auditoria detalhada de alterações;
- relatórios PDF;
- exportação geral de todas as turmas.
