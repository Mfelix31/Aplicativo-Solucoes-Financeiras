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

Motor: `engine/investimentos.js` · testes: `tests/investimentos.test.js`.

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

Motor: `engine/planejamento.js` · testes: `tests/planejamento.test.js`.

- Aportes e retiradas no **fim** de cada mês (como VF/PGTO do Excel com tipo 0). Aporte mensal nominal fixo, sem reajuste (padrão). **Opcional:** reajustado pela inflação uma vez por ano, como a linha "Correção Monetária" da aba Cenários da planilha: aporte do mês t = aporte × (1 + inflação)^⌊(t − 1) ÷ 12⌋. Com o reajuste, o aporte necessário mostrado é o do 1º ano.
- Rentabilidade da acumulação **nominal e bruta** (antes de IR), em três cenários editáveis: 8%, 10% e 12% a.a. Inflação média fixa (padrão 4% a.a.).
- **Patrimônio necessário** (R$ de hoje) = (renda desejada − outras rendas) ÷ taxa real mensal equivalente de IPCA + 5,16% a.a. Exemplo: R$ 20 mil ÷ 0,4202% ≈ R$ 4,76 milhões. É uma perpetuidade real: paga a renda corrigida pela inflação sem consumir o principal.
- **Comparação com a meta** (metodologia da planilha do usuário): o patrimônio projetado, em valor futuro, é comparado diretamente com o patrimônio necessário (`baseComparacao: 'nominal'`). A opção `'real'` compara em R$ de hoje. Atenção (Stress Test MT, teste 4): no modo `'nominal'` a inflação não altera o veredito (14% nominal atinge a meta em 16,7 anos com IPCA de 10% ou de 0%); em R$ de hoje, 57,7 anos com aporte fixo e 32,9 com aporte reajustado. Decisão do usuário (nov/2026): manter a comparação nominal contra a meta em reais de hoje. Motivo: a meta já usa só a parte real (5,16%) e reinveste a correção pelo IPCA na fase de renda, e o juro real de mercado acima de 5,16% funciona como folga. A tela e o PDF informam que a renda desejada é atingida no valor nominal da data em que começa a renda.
- **Objetivos de vida:** valor em R$ de hoje corrigido pela inflação até a data; só sai do patrimônio se o patrimônio naquele mês cobrir o valor.
- **Entradas extraordinárias** (venda de terra ou imóvel, sobra da safra, herança, bônus): valor em R$ de hoje corrigido pela inflação até a data e somado ao patrimônio no mês. Podem se repetir (todo ano, a cada N anos) até o início da renda. No mesmo mês, entram antes dos objetivos. Stress Test MT, teste 10: R$ 2 mil/mês a 5,16% por 20 anos dá R$ 826 mil; com a venda de R$ 3 mi no ano 10, R$ 5,79 mi.
- **Aportar mais ou render mais?** (`compararAportes`): dois planos que partem do zero no mesmo prazo, com a inflação e o reajuste da etapa 1; mostra o final de cada um (nominal e em R$ de hoje), quantas vezes o maior supera o menor e a rentabilidade que o menor precisaria para empatar (bissecção até 200% a.a.). Stress Test MT, teste 6: R$ 500 a 8% → R$ 284.500; R$ 3.000 a 3% → R$ 980.563 (3,45×); empate a 18,3% a.a.
- **Renda por cenário:** perpétua (patrimônio × taxa real mensal) e consumindo o capital até uma idade (anuidade com a taxa real mensal).
- **Curvas de consumo:** P(k+1) = P(k) × (1 + rentabilidade − consumo); valor real = P ÷ (1 + inflação)^k.

## Estratégia de Aquisição

Motor: `engine/aquisicao.js` · testes: `tests/aquisicao.test.js`.

- **Critério:** patrimônio líquido = capital investido + valor do bem − saldo devedor, no horizonte escolhido (padrão 10 anos), nominal e em R$ de hoje.
- Todo mês o capital rende pela taxa líquida e a parcela sai dele; o que sobra fica investido, o que falta é descapitalização. Aporte mensal opcional entra igual em todos os caminhos.
- **Financiamento** no padrão da proposta Sicoob: saldo corrigido pela TR projetada; juros = saldo corrigido × taxa nominal ÷ 12; SAC ou Price; seguro MIP por faixa de idade e DFI sobre o imóvel; tarifa mensal; despesas não incorporadas saem do capital; 1ª parcela um mês após a contratação. Conferido contra a proposta de 23/10/2026 (diferença de centavos por parcela).
- **Consórcio** no padrão da simulação de lance Sicoob: parcela = (100% + administração + fundo de reserva) ÷ nº de parcelas × carta, paga no início do mês; na assembleia da contemplação o lance abate o saldo antes da parcela; lance em % da carta ou em parcelas; seguro proporcional à parcela; reajuste a cada 12 parcelas; modalidade com lance embutido (carta = bem ÷ (1 − embutido)). Conferido contra a simulação de 26/10/2026.
- **Custo efetivo do consórcio:** contemplado na 1ª assembleia, é a taxa interna de retorno do fluxo (crédito recebido, depois parcelas). Contemplado depois, o fluxo troca de sinal duas vezes e a taxa interna de retorno pode ter duas soluções ou nenhuma; então as parcelas pagas antes da contemplação são levadas até a data da contemplação pela taxa líquida do capital e descontadas do crédito, e o custo é a taxa do crédito que resta (única). Se essas parcelas corrigidas já passam do crédito, a tela mostra "sem crédito a custear" (o consórcio funcionou como poupança). Ex.: carta de R$ 300 mil, 120x, adm 15% + fundo 2%, capital a 10% a.a.: 3,31% a.a. na 1ª assembleia, 6,1% na 24ª, 10,0% na 36ª; na 100ª, sem crédito a custear.
- **Capital próprio:** compra quando o capital alcança o preço do bem já valorizado.
- **IR de produtos tributados:** cobrado só nos resgates, sobre a parte de ganho, pela alíquota do prazo médio informado. LCA e "renda líquida em R$" não pagam.
- **Valorização do bem:** IPCA por padrão; valor próprio opcional (negativo para veículos).

## Planejamento Sucessório

Motor: `engine/sucessao.js` · testes: `tests/sucessao.test.js`.

- **Custo esperado do inventário (padrão: pela lei + margem):** conta pela lei (ITCMD por quinhão no estado, honorários, escritura ou custas, registro, certidões, multa) + **margem de mercado de 5%** do que vai a inventário (avaliações, contador, atrasos, imprevistos). Calibração (usuário, 01/11/2026): os 18% observados valem para patrimônios a partir de R$ 10 mi; no caso de referência (R$ 10 mi em MT, R$ 6 mi em fazendas e R$ 4 mi em aplicações, 2 herdeiros) a conta pela lei dá 11,34% em cartório e 14,64% judicial, e a média + 5% ≈ 18%. Com o ITCMD progressivo, o percentual acompanha o patrimônio, o estado e o tipo de inventário (MT: R$ 1,5 mi em cartório ≈ 12,8%; R$ 50 mi ≈ 18,7%; R$ 30 mi com litígio > 20%). Modo alternativo: **percentual fixo** (padrão 18%). É o custo usado na comparação dos caminhos, inclusive no 2º inventário (do cônjuge, sobre a meação), e é recalculado a cada ano da simulação.
- **Meta de liquidez:** custo esperado + despesas da família e custos dos bens durante o inventário (meses padrão: 3 em cartório, 24 judicial, 36 com conflito), corrigidos pelo IPCA.
- **Dívidas do espólio:** dívidas comprovadas (R$ de hoje, corrigidas pelo IPCA) saem do monte antes do ITCMD e dos custos, na proporção de cada estado, e do valor que chega à família. Dívida maior que os bens zera o monte, e o que vem dos bens à família fica em zero, nunca negativo: o excedente não passa aos herdeiros (CC, art. 1.792) e não alcança previdência e seguro, que vão direto aos beneficiários (stress test de nov/2026, cenário S7; antes o excedente era descontado do valor à família).
- **Ganho de capital (alerta):** com o custo de aquisição dos imóveis informado, IR estimado sobre (valor de mercado − custo) pelas faixas da Lei 13.259/2016 (15% até R$ 5 mi, 17,5% até R$ 10 mi, 20% até R$ 30 mi, 22,5% acima, cada faixa sobre a sua parte do ganho). Vale se os herdeiros venderem ou se o inventário atualizar o valor (Lei 9.532/1997, art. 23). Sem fatores de redução nem regras do imóvel rural; não entra na escolha do caminho.
- **Rebanho (semoventes):** bem móvel; paga ITCMD no domicílio, acompanha o IPCA e fica fora da holding e da doação simuladas.
- **Partilha:** meação pelo regime de bens; cônjuge herdeiro pelo art. 1.829 do Código Civil (na comunhão parcial, só sobre os bens particulares), com mínimo de 1/4 se for ascendente de todos (art. 1.832); ITCMD por quinhão; legítima e parte disponível.
- **ITCMD por estado:** imóveis no estado onde ficam; móveis, cotas, veículos e bens no exterior no domicílio (CF, art. 155, § 1º). Regimes: **adequação à LC 227/2026 (padrão desde nov/2026, decisão do usuário: cenário base a partir de 2027)**, lei vigente (a tabela de hoje, sem a reforma) e estresse de 16%. Onde o estado já cumpre a LC 227/2026 (ex.: MT), a reforma é igual à lei vigente; onde ainda não aprovou tabela progressiva, é uma hipótese (faixas de MT em reais), indicada na tela. A base do ITCMD é sempre o **valor de mercado** de hoje informado para cada bem (LC 227/2026), nunca o de compra; o custo de aquisição só entra na estimativa do IR sobre ganho de capital. Simulações salvas antes da mudança reabrem com o regime que tinham. **Estresse** = em cada quinhão (ou doação), o maior entre a lei vigente e a hipótese da reforma com as alíquotas dobradas, limitadas a 16%: nos estados de alíquota fixa (SP, PR, MS…), a hipótese parte das faixas de MT com isenção e sozinha cobraria menos que a lei atual (stress test de nov/2026, cenário S15). Doações feitas hoje sempre pagam pela lei vigente.
- **Tabela própria de ITCMD (opcional):** até 5 faixas informadas pelo planejador, por quinhão e faixa a faixa, no lugar da tabela de todos os estados do caso na herança (doações continuam pela tabela do estado).
- **Previdência:** fora do inventário e sem ITCMD; IR regressivo sobre o rendimento (VGBL) ou sobre o saldo (PGBL). Cobertura medida pelo valor líquido de IR.
- **Whole life:** modelo da planilha Sicoob (capital IPCA + 2,5% a.a., parcela por 10 anos corrigida pelo IPCA), com a parcela ajustada por idade e sexo pela tábua BR-EMSmt da SUSEP (v.2026 padrão; v.2021 opcional).
- **Cotação do cooperado (opcional):** com capital e parcela cotados, a parcela por R$ 100 mil = parcela ÷ capital × 100 mil substitui a estimativa por idade e sexo; a cobertura básica mantém a proporção da cotação base.
- **Combinações testadas:** estrutura (nada, doação com usufruto, holding gradual, holding total) × liquidez (nada, previdência, whole life, ambos), mais offshore quando há bens no exterior acima do limite.
- **Ponto de equilíbrio da holding:** primeiro ano a partir do qual a holding da solução (ou a melhor holding) entrega à família pelo menos o mesmo que a melhor opção sem holding que protege desde o 1º ano, sem voltar a perder até a expectativa de vida.
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
