# Arquitetura — Acompanhamento 2026

## Escopo territorial

A aplicação nasce com 7 estados da Região Norte:

- Acre (AC)
- Amapá (AP)
- Amazonas (AM)
- Pará (PA)
- Rondônia (RO)
- Roraima (RR)
- Tocantins (TO)

Cada estado possui 6 turmas, totalizando 42.

## Matriz de acesso

| Papel | Visualização | Edição de acompanhamento | Importação | Usuários |
| --- | --- | --- | --- | --- |
| PROFESSOR | 6 turmas do próprio estado | somente a turma atribuída | não | não |
| COORDENADOR_ESTADUAL | 6 turmas do próprio estado | todas as 6 | sim | não |
| COORDENADOR_GERAL | todos os estados | todas as turmas | sim | não |
| ADMIN | todos os estados | todas as turmas | sim | sim |

O escopo é persistido separadamente do papel:

- `state_id`: limita Professor/Coordenador Estadual ao estado.
- `classroom_id`: identifica qual turma o Professor pode editar.
- Coordenador Geral e Admin não precisam de escopo estadual.

## Modelo de dados

```text
states
  └── classrooms (6 por estado)
       └── students (até 30 posições importadas por turma)
            └── attendance (6 módulos x 6 presenças)
       └── users PROFESSOR (uma turma atribuída)

users
  ├── role
  ├── state_id
  └── classroom_id
```

O trabalho final é armazenado no cursista (`final_work_delivered`), pois existe um resultado final por cursista no curso 2026.

## Regras pedagógicas implementadas

- `P`: presença.
- `F`: falta.
- `N/A`: não se aplica.
- vazio: ainda não preenchido.
- frequência: `P / (P + F)`.
- `N/A` e vazio não entram no denominador.
- mínimo de frequência: 75%.
- certificação: frequência geral >= 75% **e** trabalho final entregue.
- resultado de módulo mostrado no consolidado: frequência do módulo >= 75%.

## Migração da planilha

A aba `1 - Acompanhamento` é mapeada assim:

```text
B8:B37   -> cursista
C8:C37   -> município
D8:AM37  -> presença (36 campos = 6 módulos x 6)
AN8:AN37 -> trabalho final
```

A frequência e a situação são recalculadas pelo sistema; não são confiadas cegamente ao valor calculado no arquivo.

## Escolha de interface

A tela de preenchimento mostra um módulo por vez:

```text
Cursista | Município | Presença 1 | ... | Presença 6 | Freq. módulo | Freq. geral | Trabalho final
```

Isso evita reproduzir 42 colunas simultâneas do Excel e mantém o preenchimento utilizável em notebook.

## Evoluções previstas sem mudança de banco principal

- auditoria de quem alterou cada presença;
- redefinição de senha;
- ativar/desativar usuários;
- importação em lote;
- gráficos estaduais;
- exportação geral;
- PDF consolidado;
- observações por turma;
- bloqueio de edição após fechamento do curso.
