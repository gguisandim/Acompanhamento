# Alterações — navegação por páginas e terminologia EAD

## Objetivo

Reduzir a concentração de funções no dashboard e tornar o preenchimento das turmas mais direto, deixando explícito que o curso é totalmente EAD.

## Novas páginas

- `/dashboard`: visão geral executiva, busca, indicadores principais, atalhos e atenções prioritárias.
- `/turmas`: página operacional com cards das turmas, progresso dos seis módulos e atalhos diretos para preenchimento.
- `/analises`: concentra filtros e visualizações analíticas detalhadas.
- `/resultados`: concentra acesso aos resultados finais das turmas.

## Página de turmas

Cada turma exibe:

- total de cursistas;
- frequência média;
- progresso do acompanhamento;
- progresso de M1 a M6;
- indicação de permissão de edição;
- atalho para o próximo módulo ainda incompleto;
- acesso direto a cada módulo.

Professores continuam podendo visualizar as turmas do próprio estado, mas somente editar a turma atribuída a eles, conforme as regras já existentes no backend.

## Curso EAD

A interface agora evita sugerir encontros presenciais. Os seis registros de cada módulo são apresentados como **atividades**.

- `P`: participação/presença registrada na atividade EAD;
- `F`: ausência/não participação;
- `N/A`: atividade não aplicável;
- vazio: ainda não preenchido.

Os nomes internos do banco (`attendance`) não foram alterados para evitar migração desnecessária e risco aos dados existentes.

## Preenchimento direto

A rota da turma aceita `?modulo=N`. Assim, links como `/turmas/<id>?modulo=3` já abrem o Módulo 3, sem exigir que o usuário passe primeiro pela visão geral.

## Banco

Nenhuma alteração de schema foi necessária nesta rodada.
