# Inteligência Financeira

Plataforma estática (HTML/CSS/JS, sem build) com dois módulos:

| Página | O que faz |
|---|---|
| `index.html` | Página inicial com acesso aos dois módulos |
| `investimentos.html` | Simulador e comparador de LCA, RDC e Operação Compromissada |
| `planejamento.html` | Planejamento financeiro: patrimônio necessário, cenários, objetivos de vida e PDF |

## Estrutura

- `assets/tema.js` — tema claro (padrão) / escuro, lembrado entre as páginas.
- `engine/planejamento.js` — motor de cálculo do planejamento (funções puras, sem DOM).
- `tests/` — testes do motor. Rodar com `node --test tests/*.test.js` (Node 18+).

## Convenções de cálculo

- **Investimentos:** rendimento em dias úteis, base 252, com feriados nacionais; IR e IOF por dias corridos.
- **Planejamento:** base de 360 dias (12 meses de 30), capitalização mensal com taxa equivalente; valores antes de IR.

Simulador educativo: nenhum dado é coletado ou enviado; todo o processamento acontece no navegador.
