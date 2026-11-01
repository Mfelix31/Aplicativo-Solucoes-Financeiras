# Regras de cálculo

Convenções financeiras de cada módulo. A implementação fica nos motores (`engine/`) e cada regra relevante tem teste em `tests/`, conferido contra uma fonte independente (planilha, proposta real ou conta feita à parte).

Arredondamento só na apresentação: os cálculos internos guardam a precisão total.

## Convenção de prazo por módulo

| Módulo | Base | Motivo |
|---|---|---|
| Simulador de Investimentos | Rendimento em **dias úteis, base 252**: fator = (1 + taxa)^(DU/252), sem fins de semana e feriados nacionais. **IR e IOF por dias corridos** até o resgate. | É como a renda fixa rende no mercado; a tributação segue dias corridos. |
| Planejamento Financeiro | **360 dias** (12 meses de 30), capitalização mensal com taxa equivalente: i_m = (1 + i_a)^(1/12) − 1. | Projeção de longo prazo, decisão do usuário. |
| Estratégia de Aquisição | **Mensal**, com taxa mensal equivalente. | Parcelas e renda são mensais. |
| Planejamento Sucessório | **Anual** (falecimento ao fim do ano). | Horizonte de décadas, impostos e custos anuais. |

Taxa real, em todos os módulos: (1 + nominal) ÷ (1 + inflação) − 1. Nunca a subtração simples.

## Simulador de Investimentos

- **LCA:** isenta de IR para pessoa física. Prazo mínimo de 6 meses (Resolução CMN 5.215/2025): o simulador trava o prazo e avisa.
- **RDC:** IR regressivo e IOF regressivo nos resgates antes de 30 dias.
- **Operação Compromissada:** lastreada em título de crédito privado, sem IOF, com IR regressivo.
- **IR regressivo:** 22,5% até 180 dias · 20% até 360 · 17,5% até 720 · 15% acima.
- **Prazos** em meses e anos são convertidos pelas datas do calendário (12 meses = 365 dias, portanto IR de 17,5%).
- **Garantia:** LCA e RDC com FGCoop até R$ 250 mil por CPF.
- **CDI:** constante durante o prazo por padrão; opcionalmente projetado por ano pelo Boletim Focus (mediana da Selic de fim de ano − 0,10 p.p.), editável e rotulado como expectativa de mercado.
- **Comparativo de mercado:** poupança (0,5% a.m. + TR enquanto a Selic passa de 8,5% a.a.; senão 70% da Selic + TR; só meses completos; isenta), CDB (% do CDI editável; IR, IOF; FGC até R$ 250 mil) e Tesouro Selic (Selic = CDI + 0,10 p.p.; IR, IOF e custódia B3 de 0,20% a.a. sobre o que passar de R$ 10 mil). A rentabilidade anual da tabela é a taxa interna de retorno, que considera o tempo de cada aporte.
- **Aporte mensal:** cada aporte paga IR e IOF pelo próprio prazo até o resgate.

## Planejamento Financeiro

- Aportes e retiradas no **fim** de cada mês (como VF/PGTO do Excel com tipo 0). Aporte mensal nominal fixo, sem reajuste.
- Rentabilidade da acumulação **nominal e bruta** (antes de IR), em três cenários editáveis: 8%, 10% e 12% a.a. Inflação média fixa (padrão 4% a.a.).
- **Patrimônio necessário** (R$ de hoje) = (renda desejada − outras rendas) ÷ taxa real mensal equivalente de IPCA + 5,16% a.a. Exemplo: R$ 20 mil ÷ 0,4202% ≈ R$ 4,76 milhões. É uma perpetuidade real: paga a renda corrigida pela inflação sem consumir o principal.
- **Comparação com a meta** (metodologia da planilha do usuário): o patrimônio projetado, em valor futuro, é comparado diretamente com o patrimônio necessário (`baseComparacao: 'nominal'`). A opção `'real'` compara em R$ de hoje.
- **Objetivos de vida:** valor em R$ de hoje corrigido pela inflação até a data; só sai do patrimônio se o patrimônio naquele mês cobrir o valor.
- **Renda por cenário:** perpétua (patrimônio × taxa real mensal) e consumindo o capital até uma idade (anuidade com a taxa real mensal).
- **Curvas de consumo:** P(k+1) = P(k) × (1 + rentabilidade − consumo); valor real = P ÷ (1 + inflação)^k.

## Estratégia de Aquisição

- **Critério:** patrimônio líquido = capital investido + valor do bem − saldo devedor, no horizonte escolhido (padrão 10 anos), nominal e em R$ de hoje.
- Todo mês o capital rende pela taxa líquida e a parcela sai dele; o que sobra fica investido, o que falta é descapitalização. Aporte mensal opcional entra igual em todos os caminhos.
- **Financiamento** no padrão da proposta Sicoob: saldo corrigido pela TR projetada; juros = saldo corrigido × taxa nominal ÷ 12; SAC ou Price; seguro MIP por faixa de idade e DFI sobre o imóvel; tarifa mensal; despesas não incorporadas saem do capital; 1ª parcela um mês após a contratação. Conferido contra a proposta de 23/10/2026 (diferença de centavos por parcela).
- **Consórcio** no padrão da simulação de lance Sicoob: parcela = (100% + administração + fundo de reserva) ÷ nº de parcelas × carta, paga no início do mês; na assembleia da contemplação o lance abate o saldo antes da parcela; lance em % da carta ou em parcelas; seguro proporcional à parcela; reajuste a cada 12 parcelas; modalidade com lance embutido (carta = bem ÷ (1 − embutido)). Conferido contra a simulação de 26/10/2026.
- **Capital próprio:** compra quando o capital alcança o preço do bem já valorizado.
- **IR de produtos tributados:** cobrado só nos resgates, sobre a parte de ganho, pela alíquota do prazo médio informado. LCA e "renda líquida em R$" não pagam.
- **Valorização do bem:** IPCA por padrão; valor próprio opcional (negativo para veículos).

## Planejamento Sucessório

- **Custo esperado do inventário:** 18% do que vai a inventário (média observada em clientes de MT e MS). É o custo usado na comparação dos caminhos, inclusive no 2º inventário (do cônjuge, sobre a meação). A conta item por item (ITCMD por quinhão, honorários, escritura ou custas, registro, certidões, multa) aparece como conferência.
- **Meta de liquidez:** 18% + despesas da família durante o inventário (meses padrão: 3 em cartório, 24 judicial, 36 com conflito), corrigidas pelo IPCA.
- **Partilha:** meação pelo regime de bens; cônjuge herdeiro pelo art. 1.829 do Código Civil (na comunhão parcial, só sobre os bens particulares), com mínimo de 1/4 se for ascendente de todos (art. 1.832); ITCMD por quinhão; legítima e parte disponível.
- **ITCMD por estado:** imóveis no estado onde ficam; móveis, cotas, veículos e bens no exterior no domicílio (CF, art. 155, § 1º). Regimes: lei vigente (padrão), adequação à LC 227/2026 e estresse de 16%. Doações feitas hoje sempre pagam pela lei vigente.
- **Previdência:** fora do inventário e sem ITCMD; IR regressivo sobre o rendimento (VGBL) ou sobre o saldo (PGBL). Cobertura medida pelo valor líquido de IR.
- **Whole life:** modelo da planilha Sicoob (capital IPCA + 2,5% a.a., parcela por 10 anos corrigida pelo IPCA), com a parcela ajustada por idade e sexo pela tábua BR-EMSmt da SUSEP (v.2026 padrão; v.2021 opcional).
- **Combinações testadas:** estrutura (nada, doação com usufruto, holding gradual, holding total) × liquidez (nada, previdência, whole life, ambos), mais offshore quando há bens no exterior acima do limite.
- **Quem paga cada custo, nesta ordem:** sobra mensal → rendimentos das aplicações → principal das aplicações → valor à parte (que cresce pela rentabilidade e é descontado do valor à família).
- **Recomendação em níveis** (sempre há uma solução): 1) protege e cabe no orçamento; 2) protege com pagamento à parte até o limite da renda (padrão 30%); 3) protege pedindo o menor valor de fora; 4) maior cobertura. Empate abaixo de 3% favorece o mais simples. A ferramenta diz claramente quando a holding não é necessária.
- **Expectativa de vida:** Tábua Completa de Mortalidade do IBGE (2024). Três momentos: próximo ano, 10 anos e expectativa de vida.

## Fontes de dados

| Dado | Fonte | Série ou documento | Atualização |
|---|---|---|---|
| Meta Selic | Banco Central (Copom) | SGS 432 | Ao vivo, a cada decisão do Copom |
| CDI estimado | Calculado | Meta Selic − 0,10 p.p. | Junto com a Selic |
| IPCA 12 meses | IBGE via Banco Central | SGS 13522 | Mensal |
| Expectativa da Selic | Banco Central | Boletim Focus (API Olinda) | Semanal; é expectativa de mercado, não previsão oficial |
| Dólar | Banco Central | PTAX de venda, SGS 1 | Diária |
| Ibovespa | B3 | Estatísticas históricas do índice | Diária, pela automação `ibovespa.yml` |
| Valores de referência | `dados/referencias-mercado.js` | Selic, CDI e IPCA com data | Manual, quando o simulador muda os padrões |
| ITCMD | Leis estaduais (MT, MS, RO, PA) e itcmd.com.br (demais) | `dados/itcmd-uf.js`, com `revisadoEm` por estado | Revisão trimestral (issue automática) |
| Tábuas de mortalidade | SUSEP | BR-EMSmt v.2021 e v.2026 | Quando a SUSEP publicar nova versão |
| Expectativa de vida | IBGE | Tábua Completa de Mortalidade 2024 | Anual |

Se uma consulta falha, a página mostra o valor de referência identificado com a data, ou um traço, e avisa. Nunca inventa um valor substituto.
