# Arquitetura

Como o código está organizado e por quê. Para as regras financeiras, veja [CALCULOS.md](CALCULOS.md); para o padrão de código e o fluxo de trabalho, [CONTRIBUTING.md](../CONTRIBUTING.md).

## Princípios

- **Site estático, sem build.** HTML, CSS e JavaScript puros, publicados pelo GitHub Pages a partir do `main`. Nenhuma biblioteca é instalada; a única carregada de fora é o pdf.js, sob demanda, para importar PDFs na Estratégia de Aquisição.
- **Cálculo separado da tela.** As regras financeiras ficam em `engine/`, em funções puras que rodam no navegador e no Node (para os testes). A página só lê os campos, chama o motor e desenha o resultado.
- **Nada de dados pessoais.** O app pede só idade e números. Nada é enviado nem guardado fora do navegador; a única coisa lembrada é o tema e se as dicas das etapas estão ocultas.
- **Dados com fonte e data.** Toda tabela ou referência de mercado registra de onde veio e quando foi conferida. Se uma consulta falha, a página mostra o valor de referência identificado como tal, ou um traço; nunca um número inventado.

## Camadas

| Camada | Pasta | Regra |
|---|---|---|
| Marcação | `<página>.html` | Só estrutura e textos fixos. Sem `<style>`, sem `style="..."` fixo (apenas variáveis CSS por item, como `--accent` ou `--c`) e sem lógica. |
| Estilo da página | `paginas/<página>.css` | O que é só daquela página. Usa os tokens de `assets/base.css`. |
| Lógica da página | `paginas/<página>.js` | Lê campos, valida, chama o motor, desenha resultados e o PDF. Textos mostrados ao usuário ficam aqui. |
| Ajuda da página | `paginas/<página>-ajuda.js` | Só os textos dos botões "?", das dicas das etapas e do guia "Como usar". |
| Componentes | `assets/` | Compartilhados entre páginas (tabela abaixo). |
| Motores | `engine/` | Funções puras de cálculo, sem acesso ao DOM, cobertas por testes. |
| Dados | `dados/` | Tabelas e referências, sem lógica de tela. |

## Componentes compartilhados (`assets/`)

| Arquivo | Global | O que faz |
|---|---|---|
| `tema.js` | `Tema` | Tema claro (padrão) ou escuro, lembrado entre as páginas. Carrega no `<head>`, antes do CSS, para não piscar. |
| `base.css` | — | Paleta da marca nos dois temas (tokens `--ink`, `--line`, `--red`…), barra de navegação e regras globais. |
| `componentes.css` | — | Etapas, painéis, campos, indicadores, gráfico e avisos das páginas da Consultoria. |
| `formato.js` | `Formato` | Moeda, porcentagem, prazos e máscara de valores no padrão brasileiro. |
| `grafico.js` | `Grafico` | Gráfico de linhas em canvas com tooltip, nas cores do tema. |
| `bcb.js` | `BCB` | Consultas ao Banco Central (Meta Selic, IPCA 12 meses, Focus, PTAX), com validação. |
| `ajuda.js` + `ajuda.css` | `Ajuda` | Botão "?", balão, dica no topo das etapas e guia "Como usar". |

## Motores e dados

| Arquivo | Global | Usado por |
|---|---|---|
| `engine/planejamento.js` | `PlanEngine` | Planejamento Financeiro |
| `engine/aquisicao.js` | `AquisicaoEngine` | Estratégia de Aquisição |
| `engine/propostas.js` | `PropostasSicoob` | Estratégia de Aquisição (leitura dos PDFs do Sicoob) |
| `engine/sucessao.js` | `SucessaoEngine` | Planejamento Sucessório |
| `dados/itcmd-uf.js` | `ItcmdUF` | Planejamento Sucessório: ITCMD dos 27 estados, com lei e data de revisão |
| `dados/tabuas-br-ems.js` | `TabuasBREMS` | Planejamento Sucessório: tábuas de mortalidade da SUSEP |
| `dados/referencias-mercado.js` | `ReferenciasMercado` | Página inicial: valores de referência enquanto o BCB não responde |
| `dados/ibovespa.json` | — | Página inicial: fechamento do Ibovespa, gravado pela automação diária |

Os motores e os arquivos de dados usam o mesmo padrão de módulo, que funciona no navegador (global) e no Node (`require`):

```js
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NomeDoModulo = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // ...
  return { funcaoA, funcaoB };
});
```

## Ordem de carregamento

Em toda página, nesta ordem:

1. `assets/tema.js` (no `<head>`, sem `defer`)
2. `assets/base.css` → `assets/componentes.css` (se usar) → `assets/ajuda.css` → `paginas/<página>.css`
3. No fim do `<body>`: `assets/formato.js`, `assets/grafico.js`, `assets/bcb.js` (os que a página usar) → `dados/*.js` → `engine/*.js` → `paginas/<página>.js`
4. Por último: `assets/ajuda.js` → `paginas/<página>-ajuda.js`

O teste `tests/paginas.test.js` confere que todo arquivo referenciado existe; `tests/ajuda.test.js` confere a ordem da ajuda.

## Automações (`.github/workflows/`)

| Workflow | Quando roda | O que faz |
|---|---|---|
| `testes.yml` | A cada envio e pull request | `npm test`. Um X vermelho no commit indica teste quebrado. |
| `ibovespa.yml` | Dias úteis, depois do pregão (ou à mão) | Roda `scripts/atualizar-ibovespa.js`, que lê o fechamento publicado pela B3 e grava `dados/ibovespa.json`. Se a B3 mudar o formato, falha sem gravar. |
| `revisao-dados.yml` | Dia 2 de jan, abr, jul e out (ou à mão) | Roda `scripts/verificar-dados.js` e abre uma issue com as tabelas do Sucessório a revisar. |

Os commits automáticos do Ibovespa ("Ibovespa: fechamento de AAAA-MM-DD") são esperados e não precisam de revisão.

## Pontos de atenção conhecidos

- **Simulador de Investimentos sem motor separado.** As regras de LCA, RDC e Compromissada (dias úteis, IR, IOF, feriados) ainda estão em `paginas/investimentos.js`, não em `engine/`, e por isso não têm testes unitários próprios. É o módulo mais antigo; a extração para `engine/investimentos.js`, com testes, é o próximo passo recomendado.
- **Ibovespa sem API documentada.** A B3 só oferece API oficial para empresas (com credenciais); a automação lê a página pública de estatísticas, que pode mudar de formato.
- **Tabelas de ITCMD de fontes secundárias** fora de MT, MS, RO e PA. Precisam de conferência por advogado ou contador de cada estado.
