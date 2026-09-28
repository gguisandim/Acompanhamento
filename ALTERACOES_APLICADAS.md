# Alterações aplicadas — acompanhamento 2026

Esta versão continua com o modelo funcional definido para o projeto: os módulos servem para acompanhar presença, frequência e preenchimento. Não existe aprovação/reprovação por módulo; a situação final pertence ao encerramento do curso.

## Correções operacionais

- Trabalho final removido do editor de módulos e concentrado em **Resultado final**.
- Texto de certificação corrigido para deixar claro que frequência/trabalho final geram uma sugestão e que a situação final pode ser revisada por responsável autorizado.
- A ação em massa agora é **“vazios → P”** e preserva `F`, `N/A` e `P` já preenchidos.
- O editor de presença passou a usar *dirty tracking*: só envia ao backend as células realmente modificadas.
- A API de presença faz UPSERT/DELETE em lote e continua validando o escopo da turma no backend.
- Lógicas legadas de aprovação automática por módulo foram removidas da camada de dados/helpers e a documentação foi atualizada.

## Resultado final

- Trabalho final com `Entregou`, `Não entregou` e `Pendente`.
- Situação sugerida e situação confirmada continuam separadas.
- Nova justificativa de revisão: se a situação confirmada divergir da sugestão, a justificativa é obrigatória.
- Nova detecção de **revisão final desatualizada** quando presença ou trabalho final mudam depois da última confirmação.
- Auditoria simples exibe data e responsável pela última revisão.
- Anotações finais da turma continuam disponíveis.

## Dashboard e acompanhamento

- Dashboard reorganizado por finalidade: participação, progresso, território/encerramento e atenção.
- Composição `P / F / N/A` por módulo.
- Distribuição de frequência com a faixa **Sem dados**.
- Visualização **Frequência × Progresso** por cursista.
- Heatmaps de turma × módulo e módulo × encontro preservados.
- “Funil” substituído por **Marcos do curso**, sem pressupor que todas as etapas sejam subconjuntos matemáticos.
- Busca por cursista dentro do escopo de acesso do usuário.
- Nova visão individual do cursista, com os seis módulos, frequências, progresso, presença, trabalho final e situação final.
- Cursistas com revisão desatualizada podem aparecer na lista de atenção.

## Importação e exportação

- A estratégia conservadora de importação foi preservada: uma reimportação não apaga presenças existentes nem exclui automaticamente cursistas ausentes da nova planilha.
- A exportação continua baseada no template oficial e inclui a justificativa da revisão quando houver.

## Banco de dados

Foi adicionada a migration:

`db/migrations/003_final_review_justification.sql`

Ela adiciona de forma incremental:

```sql
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS final_review_justification TEXT;
```

Não há `DROP`, `TRUNCATE` ou limpeza de dados nesta alteração.

## Comandos após substituir o projeto

Com o `.env` já apontando para o Neon:

```bash
npm install
npm run db:migrate
npm run typecheck
npm run build
npm run dev
```

**Execute `npm run db:migrate` antes de abrir as telas novas**, pois o código passa a consultar `final_review_justification`.

## Validação neste ambiente

Foi feita validação sintática de todos os arquivos TypeScript/TSX alterados e não foram encontrados erros de sintaxe.

O `npm install` não conseguiu concluir neste ambiente de execução (falha do npm/registry e Node local 22.16, enquanto o projeto exige >=22.18), portanto o `npm run typecheck` e o `npm run build` completos devem ser executados no ambiente local onde o projeto já vinha compilando.

## Testes manuais recomendados

1. Alterar uma única presença e conferir no DevTools que a requisição envia somente essa célula.
2. Registrar `F` e `N/A`, usar `vazios → P` e confirmar que os valores existentes não foram sobrescritos.
3. Conferir que trabalho final não aparece em Módulo 1–6 e está disponível no Resultado final.
4. Confirmar situação igual à sugestão e salvar normalmente.
5. Confirmar situação diferente da sugestão e verificar que a justificativa se torna obrigatória.
6. Depois de confirmar uma situação final, alterar uma presença ou o trabalho final e verificar o alerta de revisão desatualizada.
7. Testar busca de cursista com professor, coordenador estadual, coordenador geral e admin para validar os escopos.
8. Abrir a visão individual a partir da busca e da lista “Cursistas que exigem atenção”.
9. Reimportar uma turma que já possui presenças e confirmar que os registros anteriores permanecem.
10. Exportar a turma e verificar compatibilidade visual/conceitual com o template.
