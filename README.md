# Inteligência Financeira

Plataforma web para simular investimentos e apoiar decisões financeiras de longo prazo, feita para o planejador usar junto com o cooperado.

**Site:** https://mfelix31.github.io/Aplicativo-Solucoes-Financeiras/

Site estático (HTML, CSS e JavaScript puros), sem framework, sem etapa de build e sem servidor. Todo o cálculo acontece no navegador: nenhum dado pessoal é pedido, guardado ou enviado.

## Módulos

| Divisão | Página | O que responde |
|---|---|---|
| — | `index.html` | Página inicial: as duas divisões e os indicadores de mercado do dia (Selic, IPCA, juro real, Focus, dólar e Ibovespa). |
| Simulador de Investimentos | `investimentos.html` | Quanto LCA, RDC e Operação Compromissada rendem no líquido, qual vence e como se comparam com poupança, CDB e Tesouro Selic. |
| Consultoria Financeira | `planejamento.html` | Quanto patrimônio é preciso para viver de renda, quanto guardar por mês e o que ajustar. |
| Consultoria Financeira | `aquisicao.html` | Financiamento, consórcio ou à vista para comprar um bem, com o capital investido ajudando a pagar a parcela. |
| Consultoria Financeira | `sucessao.html` | O caminho que protege a família e entrega mais na sucessão: previdência, whole life, doação, holding ou offshore, nos 27 estados. |

Todas as páginas têm o guia **Como usar**, o botão **?** em cada campo e o tema claro ou escuro.

## Rodar localmente

```bash
# na pasta do projeto
python3 -m http.server 8000      # ou: npx serve
# abra http://localhost:8000
```

Abrir o `index.html` direto do disco também funciona, mas o navegador pode bloquear as consultas ao Banco Central; nesse caso as páginas usam os valores de referência e avisam.

## Testes

```bash
npm test          # Node 18 ou mais novo; não há dependências para instalar
```

Os testes conferem os motores de cálculo (contra a planilha e as propostas reais do Sicoob), a leitura dos PDFs, a estrutura das páginas e os textos de ajuda. Rodam sozinhos no GitHub a cada envio (Actions → **Testes**).

## Estrutura

```
*.html            páginas (só marcação)
paginas/          estilo, lógica e textos de ajuda de cada página
assets/           o que é compartilhado: tema, formatação, gráfico, Banco Central, ajuda
engine/           motores de cálculo (funções puras, testadas, sem tela)
dados/            tabelas e referências (ITCMD, tábuas de mortalidade, Ibovespa)
tests/            testes automáticos (node --test)
scripts/          rotinas usadas pelas automações do GitHub
.github/          automações (testes, Ibovespa diário, revisão trimestral das tabelas)
docs/             documentação técnica
```

## Documentação

| Documento | Para quê |
|---|---|
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Como o código está organizado, ordem de carregamento, componentes compartilhados e automações. |
| [docs/CALCULOS.md](docs/CALCULOS.md) | Convenções e regras de cálculo de cada módulo e fontes de dados. |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Padrão de código, fluxo de trabalho no Git e checklist para mexer com segurança. |

## Aviso

Ferramenta educativa de simulação. Os resultados dependem das premissas informadas, não são garantia de rentabilidade e não constituem recomendação de investimento, consultoria jurídica, tributária ou de seguros.
