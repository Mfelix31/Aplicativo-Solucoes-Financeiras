/* Planejamento Financeiro — textos de ajuda (botões "?", dicas das etapas e guia "Como usar").
 * Só textos: o componente fica em assets/ajuda.js. Não altera nenhum cálculo. */
Ajuda.iniciar({
  guia: {
    titulo: 'Como usar o Planejamento Financeiro',
    intro: 'Mostra quanto patrimônio você precisa para viver da renda que deseja, se o que você guarda hoje chega lá e o que ajustar se não chegar.',
    passos: [
      { titulo: 'Dados e objetivos', texto: 'Informe idade, quanto já tem investido, quanto guarda por mês, a renda que quer receber (em reais de hoje) e daqui a quantos anos. Inclua as compras planejadas no caminho, como carro, imóvel ou viagem.' },
      { titulo: 'Capital necessário', texto: 'O app calcula o patrimônio que gera a renda desejada sem consumir o principal, sempre corrigida pela inflação. O gráfico mostra o que acontece se você consumir parte do patrimônio a cada ano.' },
      { titulo: 'Planejamento', texto: 'Três cenários de rentabilidade mostram o patrimônio projetado, quando você atinge a liberdade financeira e o aporte mensal necessário para chegar na data. Baixe o PDF para levar à conversa.' }
    ],
    dicas: [
      'Mude qualquer número e volte às etapas seguintes: os resultados são recalculados na hora, sem perder o que você preencheu.',
      'Os valores são **antes do IR**, com taxas médias fixas. Na prática, rentabilidade e inflação mudam ano a ano.',
      '**R$ de hoje** é poder de compra atual; valores sem essa marca são nominais, do ano em que acontecem.'
    ]
  },

  etapas: {
    'step-1': '**Etapa 1 de 3:** preencha a sua situação atual, a renda desejada e as premissas. Depois toque em "Ver capital necessário". Nada é enviado: tudo roda no seu navegador.',
    'step-2': '**Etapa 2 de 3:** este é o tamanho de carteira que paga a renda desejada para sempre, corrigida pela inflação. Abaixo, veja quanto tempo o dinheiro dura se você consumir parte dele.',
    'step-3': '**Etapa 3 de 3:** compare o que você vai acumular em cada cenário com o patrimônio necessário. Toque em "Alcançado" ou "Rever planejamento" nos objetivos para ver os detalhes.'
  },

  topicos: {
    'Você hoje': 'O ponto de partida: quanto você já tem e quanto consegue guardar por mês.',
    'Renda que você quer receber': 'A renda mensal que você quer ter no futuro, informada em reais de hoje. O app corrige pela inflação até a data, para manter o mesmo poder de compra.',
    'Premissas': 'As médias usadas em todo o período: inflação e rentabilidade. São estimativas, não promessas. Teste valores mais baixos para ver um cenário prudente.\n\nTodos os valores são **antes do IR**.',
    'Rentabilidade nominal anual na fase de acumulação — 3 cenários': 'Quanto a carteira rende ao ano, sem descontar a inflação, enquanto você acumula. Os três cenários não são probabilidades: são hipóteses para ver o efeito de render mais ou menos.\n\nAbaixo de cada um aparece a taxa real, já descontada a inflação: (1 + nominal) ÷ (1 + inflação) − 1.',
    'Objetivos de vida': 'Compras antes de começar a receber a renda. Informe o valor em reais de hoje e a data: o app corrige pela inflação e só tira o valor do patrimônio se ele cobrir a compra naquela data.\n\nSe não cobrir, o cartão mostra "Rever planejamento" e sugere avaliar consórcio ou financiamento.',
    '#step-2 .kpi:nth-of-type(1) .k': 'A renda que a carteira precisa gerar. Se você informou outras rendas (INSS, aluguel), ela gera só a diferença.',
    '#step-2 .kpi:nth-of-type(2) .k': 'O ganho real mínimo que a carteira precisa ter na fase de renda: IPCA + a taxa informada. Abaixo aparece a taxa nominal equivalente com a inflação prevista.',
    '#step-2 .kpi:nth-of-type(3) .k': 'O tamanho de carteira que paga a renda todo mês sem consumir o principal.\n\nConta: renda mensal ÷ taxa real mensal equivalente. Exemplo: R$ 20 mil ÷ 0,4202% ao mês (IPCA + 5,16% ao ano) ≈ R$ 4,76 milhões em reais de hoje.',
    'O que acontece com o patrimônio conforme o consumo': 'Cada curva parte do patrimônio necessário: a carteira rende a taxa informada e você consome um percentual por ano. Se o consumo passa do rendimento, o patrimônio encolhe; o gráfico mostra o poder de compra que sobra.',
    'Evolução do patrimônio por cenário': 'O patrimônio acumulado em cada cenário, comparado com a meta (linha tracejada). Quando a linha do cenário cruza a meta, você atinge a liberdade financeira nesse cenário. Passe o dedo ou o mouse para ver os valores de cada ano.'
  },

  campos: {
    idade: 'Sua idade hoje. Serve para mostrar em que idade cada coisa acontece. Só a idade: nenhuma data de nascimento.',
    patrimonio: 'O total que você já tem investido e pode usar no plano. Não inclua a casa onde mora nem bens que não geram renda.',
    aporte: 'Quanto você investe por mês. É um valor fixo, sem reajuste, somado no fim de cada mês.',
    renda: 'A renda mensal que você quer receber, em reais de hoje (o poder de compra atual). O app corrige pela inflação até a data.',
    outrasRendas: 'Opcional. INSS, aluguel, previdência ou outra renda que você já terá. É descontada da renda desejada: a carteira precisa gerar só o que falta.',
    anosRenda: 'Daqui a quantos anos você quer começar a receber a renda. É o prazo para acumular.',
    inflacao: 'A inflação média que você espera para o período todo. Corrige a renda desejada e os objetivos e traz os resultados para reais de hoje. Padrão: 4% ao ano.',
    spread: 'O ganho acima da inflação que a carteira precisa ter na fase de renda. Quanto menor, maior o patrimônio necessário.\n\nPadrão: IPCA + 5,16% ao ano, média histórica dos títulos do Tesouro atrelados ao IPCA.',
    tx0: 'Cenário prudente: a carteira rende menos. Padrão: 8% ao ano.',
    tx1: 'Cenário de referência. Padrão: 10% ao ano.',
    tx2: 'Cenário favorável: a carteira rende mais. Padrão: 12% ao ano.',
    rentUso: 'Quanto a carteira rende ao ano depois que você começa a receber a renda. Usada só nas curvas de consumo desta etapa.'
  }
});
