# Arquitetura — Acompanhamento 2026

## Escopo territorial

A aplicação atende os sete estados da Região Norte (AC, AP, AM, PA, RO, RR e TO), com seis turmas por estado. O Pará é usado como primeiro recorte de validação, mas o código e o banco continuam genéricos por estado e turma.

## Matriz de acesso

| Papel | Visualização | Edição de acompanhamento | Importação | Usuários |
| --- | --- | --- | --- | --- |
| PROFESSOR | turmas do próprio estado | somente a turma atribuída | não | não |
| COORDENADOR_ESTADUAL | 6 turmas do próprio estado | todas as 6 | sim | não |
| COORDENADOR_GERAL | todos os estados | todas as turmas | sim | não |
| ADMIN | todos os estados | todas as turmas | sim | sim |

A autorização é validada no backend. `state_id` define o escopo estadual e `classroom_id` define a turma editável pelo professor.

## Modelo principal

```text
states
  └── classrooms
       ├── students
       │    └── attendance (6 módulos × 6 encontros)
       └── users PROFESSOR

students
  ├── final_work_delivered
  ├── final_status
  ├── final_observations
  ├── final_review_justification
  ├── final_work_updated_at / updated_by
  └── final_review_updated_at / updated_by
```

## Regras de acompanhamento

- `P`: presente.
- `F`: falta.
- `N/A`: não se aplica.
- vazio: ainda não preenchido.
- Frequência = `P / (P + F)`.
- `N/A` e vazio não entram no denominador da frequência.
- Progresso = quantidade de registros `P`, `F` ou `N/A` / quantidade esperada.
- `N/A` conta como campo preenchido para progresso.
- Não existe aprovação ou reprovação por módulo.
- Os módulos servem exclusivamente para acompanhar presença, frequência e preenchimento.

## Trabalho final e situação final

O trabalho final pertence ao encerramento do curso e aceita três estados: entregue (`true`), não entregue (`false`) e pendente (`null`). Ele não é editado nas telas de módulo.

A aplicação calcula uma situação final sugerida com base no conjunto do curso. A situação manual, quando confirmada por um responsável autorizado, prevalece sobre a sugestão. Se a decisão manual divergir da sugestão, deve existir uma justificativa.

Uma revisão final confirmada é marcada como desatualizada quando uma presença ou o trabalho final do cursista é alterado depois de `final_review_updated_at`. A decisão manual não é apagada automaticamente; a interface apenas sinaliza que precisa ser revista.

## Salvamento de presença

O editor mantém dirty tracking no cliente. Apenas células realmente alteradas são enviadas à API. O backend faz UPSERT em lote para registros preenchidos e DELETE em lote para células que foram explicitamente limpas. Isso reduz tráfego, queries e risco de sobrescrever alterações concorrentes que o usuário não tocou.

A ação em massa padrão é `Preencher vazios com P`: ela nunca sobrescreve `F` ou `N/A` existentes.

## Dashboard

O painel separa três eixos conceituais:

1. Participação: frequência, composição `P/F/N/A` e encontros.
2. Progresso: preenchimento por turma/módulo, heatmaps e relação frequência × progresso.
3. Território e encerramento: município, trabalho final e situação final.

A distribuição de frequência possui a categoria `Sem dados`, em vez de transformar ausência de `P/F` em 0%.

A seção `Marcos do curso` apresenta indicadores de andamento, sem assumir que todos formam um funil matemático obrigatório.

## Importação

A importação é conservadora: cursistas existentes são conciliados e atualizados sem apagar acompanhamento. Cursistas ausentes no novo arquivo não são excluídos automaticamente e células vazias no Excel não removem presenças já registradas.

## Exportação

A exportação usa o template oficial em `assets/` e mantém as duas abas. Como não existe aprovação por módulo, o consolidado por módulo usa frequência e progresso, preservando a compatibilidade conceitual com o acompanhamento atual.
