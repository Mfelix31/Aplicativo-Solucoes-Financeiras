# Inteligência Financeira

Plataforma estática (HTML/CSS/JS, sem build) com três módulos:

| Página | O que faz |
|---|---|
| `index.html` | Página inicial com acesso aos três módulos |
| `investimentos.html` | Simulador e comparador de LCA, RDC e Operação Compromissada |
| `planejamento.html` | Planejamento financeiro: patrimônio necessário, cenários, objetivos de vida e PDF |
| `aquisicao.html` | Estratégia de Aquisição: consórcio × financiamento × capital próprio, com a renda do capital pagando a parcela |

## Estrutura

- `assets/base.css` — paleta da marca (tema claro e escuro) e regras globais; carregado por todas as páginas.
- `assets/componentes.css` — etapas, painéis, campos, indicadores, gráfico e avisos do Planejamento e da Aquisição.
- `assets/tema.js` — tema claro (padrão) / escuro, lembrado entre as páginas, e o botão de troca.
- `assets/formato.js` — moeda, porcentagem, prazos e máscara de valores.
- `assets/grafico.js` — gráfico de linhas em canvas com tooltip (Planejamento e Aquisição).
- `assets/bcb.js` — consultas ao Banco Central: Meta Selic (SGS 432), IPCA 12 meses (SGS 13522) e Boletim Focus.
- `engine/planejamento.js` — motor do planejamento (funções puras, sem DOM).
- `engine/aquisicao.js` — motor da Estratégia de Aquisição (financiamento no padrão Sicoob, consórcio, IR no resgate).
- `engine/propostas.js` — leitura das simulações do Sicoob em PDF (financiamento e consórcio).
- `tests/` — testes dos motores. Rodar com `node --test tests/*.test.js` (Node 18+).

Cada página carrega os arquivos compartilhados e mantém no próprio `<style>`/`<script>` só o que é dela.

## Convenções de cálculo

- **Investimentos:** rendimento em dias úteis, base 252, com feriados nacionais; IR e IOF por dias corridos. LCA com prazo mínimo de 6 meses (Res. CMN 5.215/2025). CDI constante ou projetado por ano (Boletim Focus, API do BCB, editável). Comparativo com poupança (0,5% a.m. + TR), CDB e Tesouro Selic (custódia B3 0,20% a.a. acima de R$ 10 mil).
- **Aquisição:** base mensal; o capital rende e paga a parcela; patrimônio líquido = capital + bem − saldo devedor; bem valoriza pelo IPCA. Financiamento no padrão da proposta Sicoob (TR projetada, juros nominais ÷ 12, MIP por idade, DFI, TAC). Consórcio no padrão da simulação de lance Sicoob (nº de parcelas, lance em % ou parcelas abatendo antes da parcela da assembleia, seguro proporcional à parcela). IR de produtos tributados cobrado no resgate, sobre o ganho. Simulações do Sicoob em PDF podem preencher os campos (opcional).
- **Planejamento:** base de 360 dias (12 meses de 30), capitalização mensal com taxa equivalente; valores antes de IR. Outras rendas (INSS, aluguel, previdência) são descontadas da renda desejada antes de calcular o patrimônio necessário.

Simulador educativo: nenhum dado é coletado ou enviado; todo o processamento acontece no navegador.
