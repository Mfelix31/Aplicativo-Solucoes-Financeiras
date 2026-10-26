# Inteligência Financeira

Plataforma estática (HTML/CSS/JS, sem build) com três módulos:

| Página | O que faz |
|---|---|
| `index.html` | Página inicial com acesso aos três módulos |
| `investimentos.html` | Simulador e comparador de LCA, RDC e Operação Compromissada |
| `planejamento.html` | Planejamento financeiro: patrimônio necessário, cenários, objetivos de vida e PDF |
| `aquisicao.html` | Estratégia de Aquisição: consórcio × financiamento × capital próprio, com a renda do capital pagando a parcela |

## Estrutura

- `assets/tema.js` — tema claro (padrão) / escuro, lembrado entre as páginas.
- `engine/planejamento.js` — motor de cálculo do planejamento (funções puras, sem DOM).
- `engine/aquisicao.js` — motor da Estratégia de Aquisição (funções puras, sem DOM).
- `tests/` — testes do motor. Rodar com `node --test tests/*.test.js` (Node 18+).

## Convenções de cálculo

- **Investimentos:** rendimento em dias úteis, base 252, com feriados nacionais; IR e IOF por dias corridos. LCA com prazo mínimo de 6 meses (Res. CMN 5.215/2025). CDI constante ou projetado por ano (Boletim Focus, API do BCB, editável). Comparativo com poupança (0,5% a.m. + TR), CDB e Tesouro Selic (custódia B3 0,20% a.a. acima de R$ 10 mil).
- **Aquisição:** base mensal; capital rende pela taxa líquida e paga a parcela; patrimônio líquido = capital + bem − saldo devedor; bem valoriza pelo IPCA; financiamento pelo CET (SAC/Price, fim do mês); consórcio em % da carta (adm, fundo de reserva, seguro sobre o saldo, reajuste anual, lance livre/embutido, parcela no início do mês); taxa de equilíbrio e sensibilidade.
- **Planejamento:** base de 360 dias (12 meses de 30), capitalização mensal com taxa equivalente; valores antes de IR. Outras rendas (INSS, aluguel, previdência) são descontadas da renda desejada antes de calcular o patrimônio necessário.

Simulador educativo: nenhum dado é coletado ou enviado; todo o processamento acontece no navegador.
