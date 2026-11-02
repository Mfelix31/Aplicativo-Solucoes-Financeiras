/* Estratégia de Aquisição de Bens — textos de ajuda (botões "?", dicas das etapas e guia "Como usar").
 * Só textos: o componente fica em assets/ajuda.js. Não altera nenhum cálculo. */
Ajuda.iniciar({
  guia: {
    titulo: 'Como usar a Estratégia de Aquisição',
    intro: 'Compara três jeitos de comprar o mesmo bem (financiamento, consórcio e capital próprio) e mostra qual preserva mais patrimônio, considerando que o dinheiro que continua investido rende e ajuda a pagar a parcela.',
    passos: [
      { titulo: 'Cliente e bem', texto: 'Informe o valor do bem, quanto o cliente tem investido, quanto esse capital rende e a data prevista da compra.' },
      { titulo: 'Caminhos de compra', texto: 'Preencha as condições do financiamento e do consórcio com a simulação do Sicoob (digitando ou importando o PDF). Desmarque "incluir" para tirar um caminho da comparação.' },
      { titulo: 'Análise', texto: 'Veja se a renda do investimento paga a parcela, o patrimônio de cada caminho no horizonte escolhido, até onde a vantagem aguenta se a taxa cair e o custo efetivo de cada um. Baixe o PDF.' }
    ],
    dicas: [
      'A comparação usa o **patrimônio líquido**: capital investido + valor do bem − saldo devedor. É o que torna justo comparar caminhos diferentes.',
      'Financiamento e consórcio só compensam enquanto o capital investido rende mais do que custa a dívida. Confira o teste de estresse.',
      'Para o seguro do financiamento, o app pede só a idade, nunca a data de nascimento.'
    ]
  },

  etapas: {
    'step-1': '**Etapa 1 de 3:** dados do bem e do cliente. O mais importante é quanto o capital rende por mês: é essa renda que vai ajudar a pagar a parcela.',
    'step-2': '**Etapa 2 de 3:** as condições de cada caminho. Use os números da simulação do Sicoob para o caso; o botão de importar PDF preenche os campos para você conferir.',
    'step-3': '**Etapa 3 de 3:** comece pela conclusão e pela pergunta "a renda do investimento paga a parcela?". Os blocos abaixo mostram o porquê.'
  },

  topicos: {
    'O bem': 'O que o cliente quer comprar e quanto vale hoje. Quem compra mais tarde paga o bem já valorizado.',
    'O cliente': 'O capital que o cliente tem investido hoje, o que ele ainda vai aportar e o mínimo que não pode sair da aplicação.',
    'Como informar o rendimento do capital': '**Renda mensal líquida:** quando você já sabe quanto o capital rende por mês, já sem IR (ex.: R$ 7 mil em LCA).\n\n**Produto e taxa:** o app calcula pelo produto, % do CDI e prazo médio, cobrando o IR nos resgates.',
    'Premissas da análise': 'A inflação que valoriza o bem e traz os resultados para reais de hoje, a data da compra e o horizonte em que os caminhos são comparados.',
    'Financiamento': 'Compra na data prevista: a entrada sai do capital e o restante vira dívida, paga em parcelas mensais a partir do mês seguinte. O capital que sobra continua rendendo.',
    'Como informar as condições': '**Dados da proposta:** reproduz a simulação do Sicoob (TR, juros, seguros MIP e DFI, tarifa). Mais preciso.\n\n**Só o CET:** usa só o custo efetivo total; mais simples, quando você não tem a proposta completa.',
    'Sistema de amortização': '**SAC:** a parcela começa maior e cai todo mês, porque a amortização é fixa.\n\n**Price:** a parcela fica fixa; no começo, ela é quase toda juros.',
    'Consórcio': 'O cliente entra no grupo hoje e paga parcelas desde a adesão. Na contemplação (com lance), recebe a carta e compra o bem. Até lá, o capital segue rendendo.',
    'Modalidade': '**Carta no valor do bem:** o crédito é igual ao preço.\n\n**Carta maior, com lance embutido:** parte do lance sai do próprio crédito; o cliente desembolsa menos no lance, mas paga as taxas sobre a carta cheia. O app sugere a carta = bem ÷ (1 − embutido).',
    'Lance informado em': 'Escolha como a simulação do Sicoob mostra o lance: em % da carta ou em número de parcelas.',
    'Depois do lance, o saldo restante…': '**Reduz a parcela:** o saldo é dividido pelas parcelas que faltam.\n\n**Reduz o prazo:** a parcela continua igual e o consórcio termina antes.',
    'Capital próprio': 'Compra à vista no primeiro mês em que o capital (com rendimentos e aportes) alcança o preço do bem já valorizado. Não há juros, mas o capital sai de uma vez e para de render.',
    'A renda do investimento paga a parcela?': 'A pergunta central. Para cada caminho mostra quanto das parcelas a renda do capital pagou até o horizonte, quanto precisou sair do próprio capital e por quantos meses a renda cobriu a parcela.',
    'Evolução ao longo do tempo': 'O patrimônio líquido (ou só o capital investido) de cada caminho, mês a mês. Troque entre "Horizonte" e "Contrato completo" para ver até o fim das parcelas.',
    'Teste de estresse: até onde a vantagem aguenta': 'Refaz a conta com rendimentos de 8% a 14% ao ano. Mostra a partir de que taxa um caminho deixa de compensar: se o CDI cair abaixo disso, a vantagem some.',
    'Quanto custa cada caminho': 'O placar em reais até o horizonte. **Juros, taxas e encargos:** tudo o que se paga ao credor além do preço do bem. **Aluguel:** o que o cliente paga enquanto espera o bem. **Bem mais caro:** quanto o bem encareceu enquanto ele esperava. **Rendimento perdido:** o que o dinheiro tirado do investimento (entrada, lance, parcelas, compra à vista) teria rendido.\n\nComprar à vista zera os juros, mas costuma ter o maior rendimento perdido. O menor custo total é sempre o maior patrimônio.',
    'Detalhes do crédito': 'O custo efetivo ao ano de cada caminho, pela taxa interna de retorno do que o cliente recebe e paga. No financiamento, com a TR projetada (o CET da proposta não inclui a TR). No consórcio já entram as taxas sobre a carta cheia e o lance embutido.\n\nConsórcio contemplado depois da 1ª assembleia: as parcelas pagas antes entram corrigidas pela taxa do capital (o que esse dinheiro teria rendido), e o custo é medido a partir da contemplação. Se essas parcelas já passam do crédito, aparece "sem crédito a custear": o consórcio funcionou como poupança.',
    'Como o cálculo funciona': 'As regras do cálculo e as limitações da simulação. Vale ler antes de apresentar o resultado.'
  },

  campos: {
    tipoBem: 'Imóvel, carro, terreno ou outro bem. Ao escolher carro, o app desmarca a valorização pelo IPCA, porque veículos costumam perder valor; informe a desvalorização ao ano.',
    valorBem: 'O preço do bem hoje, à vista.',
    custoEspera: 'Opcional. O que o cliente gasta por mês enquanto não tem o bem (ex.: aluguel enquanto não tem o imóvel). Para quando ele recebe o bem, em qualquer caminho. No consórcio, soma-se às parcelas até a contemplação; o total aparece no card e no placar de custos.',
    valIpca: 'Marcado, o bem sobe de preço com a inflação. Desmarque para informar outra valorização.',
    valOutra: 'Quanto o bem valoriza ao ano. Use valor negativo para bens que perdem valor, como veículos.',
    capital: 'O total investido hoje que pode ser usado na compra (entrada, lance ou compra à vista).',
    aporte: 'Opcional. Quanto o cliente ainda investe por mês. Entra igual em todos os caminhos, para a comparação ser justa.',
    reserva: 'O mínimo que o cliente não pode deixar de ter investido. Se algum caminho ficar abaixo disso, aparece o selo "Abaixo da reserva".',
    rendaMensal: 'Quanto o capital rende por mês, já sem IR. Ex.: R$ 650 mil rendendo R$ 7 mil por mês em LCA.',
    produto: 'Onde o capital está aplicado. Define se há IR: LCA é isenta; os demais pagam IR regressivo nos resgates.',
    percCdi: 'O percentual do CDI que a aplicação paga.',
    prazoMedio: 'Há quanto tempo, em média, o dinheiro fica aplicado. Define a alíquota de IR (22,5% até 180 dias, 20% até 360, 17,5% até 720 e 15% acima).',
    cdi: 'A taxa CDI ao ano. "Buscar CDI atual" estima o CDI pela Meta Selic do Copom menos 0,10 ponto.',
    usarFocus: 'Opcional. Usa a expectativa do mercado para o CDI de cada ano (Boletim Focus). É uma expectativa, não garantia.',
    ipca: 'A inflação prevista ao ano. Valoriza o bem e traz os resultados para reais de hoje. Padrão: 4% ao ano, a mesma do Planejamento.',
    dataCompra: 'Mês e ano em que o cliente pretende comprar pelo financiamento ou à vista. Até lá, o capital continua rendendo.',
    horizonte: 'Em quantos anos o patrimônio dos caminhos é comparado. Sugestão: 10 anos, para não depender de taxas por décadas.',
    finValor: 'Quanto será financiado. A entrada (preço do bem − financiado) sai do capital na contratação.',
    finPrazo: 'O número de parcelas mensais do financiamento.',
    finCet: 'O custo efetivo total da proposta. Pela regra do Banco Central, ele não inclui a TR futura; por isso o app mostra também o custo com a TR projetada.',
    finJuros: 'A taxa nominal de juros ao ano da proposta. Juros do mês = saldo corrigido × taxa ÷ 12.',
    finTr: 'A TR mensal que corrige o saldo devedor, como está na proposta. A TR real muda todo mês.',
    finIdade: 'Só para a faixa do seguro MIP, que fica mais caro com a idade. O app não pede data de nascimento.',
    finDfi: 'Seguro de danos físicos do imóvel, em % ao mês do valor do imóvel.',
    finTac: 'Tarifa mensal cobrada junto com a parcela.',
    finDesp: 'Tarifas pagas na contratação e não incluídas no financiamento. Saem do capital.',
    finData: 'A data da proposta, para alinhar as parcelas com a simulação do Sicoob.',
    consCarta: 'O crédito que o cliente recebe na contemplação. Na modalidade com lance embutido, use a carta sugerida.',
    consPrazo: 'Quantas parcelas o cliente vai pagar. Na simulação do Sicoob, é o "prazo rateio".',
    consAdm: 'A taxa de administração do grupo, total do contrato, em % da carta.',
    consFr: 'O fundo de reserva do grupo, total do contrato, em % da carta.',
    consSeg: 'O valor do seguro na primeira parcela, como está na simulação. Cai na mesma proporção da parcela depois do lance.',
    consReaj: 'Quanto a carta, a parcela e o saldo sobem a cada 12 meses (INCC para imóveis, IPCA para veículos). Com 0%, a simulação trata a parcela como fixa, o que não acontece na prática. Com o índice IPCA, o botão "usar IPCA" preenche o valor das premissas.',
    consLance: 'O lance total oferecido, em % da carta ou em número de parcelas, conforme a escolha acima.',
    consEmb: 'A parte do lance que sai do próprio crédito: o cliente desembolsa menos, mas recebe um crédito menor.',
    consMedia: 'Opcional. A média de lance vencedor do grupo. Lance abaixo da média tem menos chance de ser contemplado: o app avisa.',
    consMes: 'Mês e ano previstos para a contemplação. A adesão é neste mês. Sem lance, a data é incerta.'
  }
});
