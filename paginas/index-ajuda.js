/* Página inicial — textos de ajuda (guia "Como usar" e "?" nos indicadores).
 * Só textos: o componente fica em assets/ajuda.js. */
Ajuda.iniciar({
  guia: {
    titulo: 'Como usar a plataforma',
    intro: 'A plataforma tem duas partes. Escolha pelo que você quer decidir.',
    passos: [
      { titulo: 'Simulador de Investimentos', texto: 'Para decidir **onde aplicar agora**: quanto LCA, RDC ou Operação Compromissada rendem no seu prazo, já com IR e IOF, e qual entrega mais.' },
      { titulo: 'Planejamento Financeiro', texto: 'Para o **longo prazo**: quanto patrimônio você precisa para viver de renda, quanto guardar por mês e o que ajustar.' },
      { titulo: 'Estratégia de Aquisição de Bens', texto: 'Para **comprar um bem**: financiamento, consórcio ou à vista, considerando que o capital que continua investido ajuda a pagar a parcela.' },
      { titulo: 'Planejamento Sucessório', texto: 'Para **proteger a família**: o caminho mais barato e seguro para o patrimônio chegar aos herdeiros (previdência, seguro, doação, holding).' }
    ],
    dicas: [
      'Em cada ferramenta, o botão **Como usar** no topo explica o passo a passo, e o **?** ao lado de cada campo explica o que preencher.',
      'Nenhum dado pessoal é pedido nem enviado: todo o cálculo é feito no seu navegador.',
      'O tema escuro fica no botão ao lado e é lembrado em todas as páginas.'
    ]
  },

  topicos: {
    'Indicadores de mercado': 'Os números de referência da economia hoje, consultados no Banco Central (e na B3, para o Ibovespa). Se a consulta falhar, aparece o valor de referência com a data ou um traço, nunca um número inventado.',
    'Meta Selic': 'A taxa básica de juros definida pelo Copom. Serve de base para o CDI e para os investimentos pós-fixados. Fonte: Banco Central, série 432.',
    'IPCA 12 meses': 'A inflação oficial acumulada nos últimos 12 meses, medida pelo IBGE. É divulgada uma vez por mês. Fonte: Banco Central, série 13522.',
    'Juro real': 'Quanto a Selic paga acima da inflação: (1 + Selic) ÷ (1 + IPCA 12 meses) − 1. É uma referência do ganho de poder de compra da renda fixa.',
    'Selic no fim do ano': 'A mediana do que os economistas do mercado esperam para a Selic no fim do ano (Boletim Focus). É uma expectativa, não uma previsão oficial.',
    'Dólar comercial': 'A cotação PTAX de venda do último fechamento, calculada pelo Banco Central. Não é em tempo real.',
    'Ibovespa': 'O principal índice da bolsa brasileira, em pontos, no último fechamento publicado pela B3. Não é em tempo real.'
  }
});
