/* Simulador de Investimentos — textos de ajuda (botões "?", dicas das abas e guia "Como usar").
 * Só textos: o componente fica em assets/ajuda.js. Não altera nenhum cálculo. */
Ajuda.iniciar({
  guia: {
    titulo: 'Como usar o Simulador de Investimentos',
    intro: 'Descubra quanto uma aplicação rende de verdade, já com IR e IOF descontados, e qual das opções entrega mais para o seu valor e o seu prazo.',
    passos: [
      { titulo: 'Escolha a aba', texto: '**Simulação** calcula um investimento por vez (LCA, RDC ou Operação Compromissada). **Comparação** coloca dois lado a lado e aponta qual entrega mais no líquido.' },
      { titulo: 'Escolha o produto', texto: 'Na Simulação, toque no cartão do produto. Cada um tem uma regra de imposto diferente; o "?" do título explica.' },
      { titulo: 'Preencha valor, prazo e taxa', texto: 'Informe quanto vai aplicar, por quanto tempo e quanto a aplicação paga: em % do CDI (pós-fixado) ou uma taxa fixa ao ano (pré-fixado). O aporte mensal é opcional.' },
      { titulo: 'Toque em Calcular', texto: 'O quadro mostra o rendimento bruto, os impostos, o valor líquido e a rentabilidade real (descontada a inflação). Abaixo, o comparativo com poupança, CDB e Tesouro Selic e o gráfico da evolução.' },
      { titulo: 'Salve e compare cenários', texto: 'Dê um nome e salve o cenário. Com dois cenários marcados, compare os gráficos e baixe o PDF comparativo.' }
    ],
    dicas: [
      '**Buscar CDI atual** e **Buscar IPCA atual** trazem os números do Banco Central. Se a consulta falhar, o valor de referência continua e você pode digitar outro.',
      'Para comparar LCA com RDC de forma justa, olhe a **taxa equivalente**: quanto o outro produto precisaria pagar para empatar.',
      'O rendimento é contado em dias úteis (base 252); IR e IOF seguem os dias corridos até o resgate.'
    ]
  },

  etapas: {
    'tab-sim': '**Simulação:** escolha um produto, preencha os dados e toque em Calcular. Os resultados aparecem logo abaixo e podem ser salvos como cenário.',
    'tab-cmp': '**Comparação:** os dois produtos usam o mesmo valor, prazo e CDI. Ajuste a taxa de cada lado e veja qual entrega mais no valor final líquido.'
  },

  topicos: {
    'Escolha o investimento': '**LCA:** isenta de IR para pessoa física; prazo mínimo de 6 meses (Resolução CMN 5.215/2025).\n\n**RDC:** depósito em cooperativa, com IR regressivo (22,5% a 15%) e IOF nos resgates antes de 30 dias.\n\n**Operação Compromissada:** lastreada em título de crédito privado, sem IOF e com IR regressivo; por isso costuma ser usada em prazos curtos.\n\nLCA e RDC contam com o FGCoop até R$ 250 mil por CPF.',
    'Dados do investimento': 'Os dados da aplicação: quanto, por quanto tempo e quanto ela paga. Todos podem ser alterados a qualquer momento; toque em Calcular de novo para atualizar.',
    '.cdi-hero .label': 'O CDI é a taxa que os bancos usam entre si e a base dos investimentos pós-fixados. "Buscar CDI atual" estima o CDI pela Meta Selic do Copom (Banco Central, série 432) menos 0,10 ponto, e leva o valor para as duas abas.',
    '#s_cardTitle': '**Rendimento bruto:** quanto o dinheiro rendeu antes dos impostos.\n\n**IOF:** só nos resgates antes de 30 dias (não incide na Compromissada).\n\n**Imposto de Renda:** tabela regressiva pelo prazo — 22,5% até 180 dias, 20% até 360, 17,5% até 720 e 15% acima. A LCA é isenta.\n\n**Rendimento líquido e valor final:** o que fica no seu bolso no resgate.',
    '#s_equivLabel': 'A taxa que o outro produto precisaria pagar para entregar o mesmo valor líquido no mesmo prazo.\n\nExemplo: se uma LCA isenta de 95% do CDI equivale a um RDC de cerca de 119% do CDI (com 20% de IR), qualquer RDC abaixo disso rende menos que essa LCA.',
    'Rentabilidade Real': 'Quanto o investimento ganhou acima da inflação, ou seja, o ganho de poder de compra.\n\nConta: (1 + rentabilidade líquida) ÷ (1 + IPCA) − 1. Acima de zero, a aplicação venceu a inflação.\n\nO "valor final em poder de compra de hoje" mostra o resultado em reais de hoje.',
    'Comparativo com referências de mercado': 'O mesmo valor, prazo e aportes aplicados em opções conhecidas, todos líquidos de impostos:\n\n**Poupança:** 0,5% ao mês + TR enquanto a Selic está acima de 8,5% ao ano; isenta de IR.\n\n**CDB:** % do CDI que você informar, com IR e IOF; FGC até R$ 250 mil.\n\n**Tesouro Selic:** Selic com IR, IOF e a taxa de custódia da B3.',
    'Evolução do valor líquido': 'Mostra quanto você teria se resgatasse em cada momento do prazo, já descontados os impostos daquele momento. Passe o dedo ou o mouse para ver os valores.',
    'Cenários Salvos': 'Guarde simulações para comparar depois: dê um nome e toque em "Salvar cenário atual". Marque dois cenários para ver os gráficos juntos e baixar o PDF comparativo.\n\nOs cenários ficam só nesta tela e somem ao fechar a página.',
    '#c_lca_cardTitle': 'O produto comparado com o RDC (LCA ou Operação Compromissada). O selo **MELHOR OPÇÃO** vai para o que entrega o maior valor final líquido.',
    '#c_lca_blockTitle': 'Escolha se o produto paga um percentual do CDI (pós-fixado) ou uma taxa fixa ao ano (pré-fixado) e informe a taxa oferecida.'
  },

  campos: {
    s_valor: 'Quanto você vai aplicar no início.',
    s_prazo: 'Por quanto tempo o dinheiro fica aplicado até o resgate. Meses e anos são convertidos pelas datas do calendário (12 meses = 365 dias).\n\nNa LCA, o prazo mínimo é de 6 meses.',
    s_aporte: 'Opcional. Valor que você acrescenta todo mês. Cada aporte paga IR e IOF pelo seu próprio prazo até o resgate.',
    s_ipca: 'A inflação dos últimos 12 meses. Serve só para calcular a rentabilidade real (o ganho acima da inflação); não muda o rendimento.',
    s_cdi: 'A taxa CDI ao ano usada no cálculo pós-fixado. Na prática o CDI muda; aqui fica constante durante todo o prazo, salvo se você marcar o CDI projetado.',
    s_cdiProj: 'Opcional. Usa a expectativa do mercado para o CDI de cada ano (Boletim Focus do Banco Central). É uma expectativa, não uma previsão oficial nem garantia. Os anos podem ser editados.',
    s_perc: 'O percentual do CDI que a aplicação paga. Exemplo: 95% do CDI com CDI de 13,65% ao ano = 12,97% ao ano.',
    s_taxaPre: 'A taxa fixa ao ano contratada na aplicação pré-fixada. Ela não muda com o CDI.',
    s_refCdb: 'Percentual do CDI do CDB usado no comparativo. Padrão: 100% do CDI.',
    s_refTr: 'A TR mensal usada no rendimento da poupança. O valor de referência vem do Banco Central e pode ser editado.',
    c_valor: 'Quanto vai aplicar. O mesmo valor entra nos dois produtos.',
    c_prazo: 'O prazo até o resgate, igual para os dois. Prazos curtos pesam mais IR e, abaixo de 30 dias, IOF.',
    c_cdi: 'A taxa CDI ao ano. Vale só para os lados configurados como pós-fixado.',
    c_cdiProj: 'Opcional. Usa a expectativa do mercado para o CDI de cada ano (Boletim Focus). É uma expectativa, não garantia.',
    c_ipca: 'A inflação dos últimos 12 meses, usada só na rentabilidade real.',
    c_percLCA: 'O percentual do CDI que o produto paga.',
    c_lca_taxaPre: 'A taxa fixa ao ano contratada.',
    c_percRDC: 'O percentual do CDI que o RDC paga, antes do IR.',
    c_rdc_taxaPre: 'A taxa fixa ao ano contratada no RDC, antes do IR.'
  }
});
