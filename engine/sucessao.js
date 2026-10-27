/*
 * Motor de cálculo — Planejamento Sucessório
 * --------------------------------------------------------------
 * Funções puras, sem acesso ao DOM. Funcionam no navegador
 * (window.SucessaoEngine) e no Node (require), para testes.
 * Modelagem validada com o usuário em 27/10/2026 (documento
 * "Planejamento Sucessório — Modelagem do Módulo 4").
 *
 * PERGUNTA: qual caminho entrega mais à família e a protege
 * desde já, pelo menor custo — inventário, previdência, whole life,
 * doação direta, holding, offshore ou combinação.
 *
 * CONVENÇÕES
 * - Base anual. Patrimônio: imóveis e participações por IPCA; aplicações,
 *   previdência e bens no exterior pelo cenário de rentabilidade (8/10/12%,
 *   já líquidos da taxa de administração da previdência).
 * - Falecimento ao fim do ano T, em três hipóteses: próximo ano, 10 anos e
 *   expectativa de vida (Tábua Completa de Mortalidade IBGE 2024).
 * - Valor que chega à família (VCF): tudo o que a família recebe menos
 *   inventário, custos do caminho (pagos das aplicações e, por isso,
 *   com custo de oportunidade), IR da previdência no pagamento e IR
 *   latente das aplicações; em R$ de hoje (deflacionado pelo IPCA).
 * - Meta de liquidez (decisão do usuário): 18% do patrimônio que vai a
 *   inventário (cartório, advogado, contador, ITCMD e trâmites), mais as
 *   despesas da família durante o inventário (meses × despesa mensal). Cobertura = (previdência líquida de IR + capital de seguro)
 *   ÷ meta. Previdência e seguro não entram no inventário nem pagam ITCMD
 *   (LC 227/2026, art. 150, III); indenização de seguro é isenta de IR.
 * - Regra de recomendação: só concorre quem cobre 100% já no 1º ano; vence
 *   o maior VCF na expectativa de vida; diferença menor que a margem
 *   (padrão 3%) favorece o mais simples.
 * - Whole life: reproduz a planilha "Sicoob - Seguro Whole Life.xlsx"
 *   (parcela por R$ 100 mil da proposta aos 48 anos, corrigida por IPCA
 *   por 10 anos; capital × (1+IPCA)(1+2,5%) ao ano; reserva pela curva atuarial).
 *   Em outras idades, parcela e cobertura básica são escaladas por um fator
 *   atuarial (ver fatorIdadeWholeLife).
 * - Arredondamento só na apresentação.
 */
(function (root, factory) {
  const dados = (typeof module === 'object' && module.exports) ? require('../dados/itcmd-uf.js') : root.ItcmdUF;
  const api = factory(dados);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SucessaoEngine = api;
})(typeof self !== 'undefined' ? self : this, function (ITCMD) {
  'use strict';

  /* ---------- tábua IBGE 2024, ambos os sexos: expectativa de sobrevida e(x), x = 0..90 ---------- */
  const TABUA_IBGE_2024 = [76.6, 76.6, 75.6, 74.7, 73.7, 72.7, 71.7, 70.8, 69.8, 68.8, 67.8, 66.8, 65.8, 64.8, 63.9, 62.9,
    61.9, 61.0, 60.0, 59.1, 58.2, 57.2, 56.3, 55.4, 54.5, 53.6, 52.6, 51.7, 50.8, 49.9, 49.0, 48.0, 47.1, 46.2, 45.3, 44.4,
    43.4, 42.5, 41.6, 40.7, 39.8, 38.9, 38.0, 37.1, 36.2, 35.3, 34.4, 33.5, 32.6, 31.8, 30.9, 30.0, 29.2, 28.3, 27.5, 26.6,
    25.8, 25.0, 24.2, 23.4, 22.6, 21.8, 21.0, 20.3, 19.5, 18.8, 18.0, 17.3, 16.6, 15.9, 15.2, 14.6, 13.9, 13.2, 12.5, 11.9,
    11.3, 10.7, 10.1, 9.5, 9.0, 8.5, 8.0, 7.5, 7.1, 6.6, 6.3, 5.9, 5.6, 5.3, 5.1];
  function expectativaSobrevida(idade) {
    const i = Math.max(0, Math.min(90, Math.floor(idade)));
    return TABUA_IBGE_2024[i];
  }

  /* ---------- ITCMD ---------- */
  /** Imposto sobre um valor (quinhão ou doação) por uma regra { metodo, faixas | aliquota, isencao }. */
  function itcmdValor(valor, regra) {
    if (!(valor > 0)) return 0;
    if (regra.isencao && regra.isencao.tipo === 'tudoOuNada' && valor <= regra.isencao.ate) return 0;
    if (regra.metodo === 'unica') return valor * regra.aliquota;
    if (regra.metodo === 'total') {
      const faixa = regra.faixas.find(fx => valor <= fx.ate) || regra.faixas[regra.faixas.length - 1];
      return valor * faixa.aliq;
    }
    let imposto = 0, piso = 0;
    for (const fx of regra.faixas) {
      if (valor <= piso) break;
      imposto += (Math.min(valor, fx.ate) - piso) * fx.aliq;
      piso = fx.ate;
    }
    return imposto;
  }
  /** ITCMD de um total dividido igualmente entre `pessoas` (um fato gerador por quinhão/donatário). */
  function itcmdDividido(total, pessoas, uf, regime, tipo) {
    const n = Math.max(1, Math.round(pessoas));
    if (!(total > 0)) return 0;
    return n * itcmdValor(total / n, ITCMD.tabela(uf, regime)[tipo]);
  }

  /* ---------- custo do inventário por componentes ---------- */
  const CUSTOS_PADRAO = {
    escrituraPct: 0.005, escrituraMin: 1500, escrituraMax: 20000,
    custasPct: 0.015, registroPct: 0.004, certidoes: 1000, honorarioMin: 5000, multaPctImposto: 0
  };
  function honorariosPadrao(uf) { return ITCMD.HONORARIOS[uf] || ITCMD.HONORARIOS.padrao; }

  /**
   * @param a { monte, imoveis, meacaoPct, herdeiros, quinhoes?, uf, regime, tipo ('cartorio'|'judicial'|'litigio'), custos }
   * monte = bens que vão a inventário (sem previdência e seguro), a valor de mercado.
   * quinhoes = fração da herança de cada herdeiro (soma 1); sem ela, divisão igual entre `herdeiros`.
   */
  function custoInventario(a) {
    const c = Object.assign({}, CUSTOS_PADRAO, a.custos || {});
    const hon = Object.assign({}, honorariosPadrao(a.uf), (a.custos && a.custos.honorarios) || {});
    const monte = Math.max(0, a.monte || 0);
    if (monte === 0) return { itcmd: 0, honorarios: 0, cartorio: 0, registro: 0, certidoes: 0, multa: 0, total: 0, pct: 0, heranca: 0 };
    const heranca = monte * (1 - (a.meacaoPct || 0));
    const itcmd = a.quinhoes && a.quinhoes.length
      ? a.quinhoes.reduce((t, f) => t + itcmdValor(heranca * f, ITCMD.tabela(a.uf, a.regime || 'vigente').heranca), 0)
      : itcmdDividido(heranca, a.herdeiros, a.uf, a.regime || 'vigente', 'heranca');
    const tipo = a.tipo || 'cartorio';
    const honorarios = Math.max(c.honorarioMin, heranca * hon[tipo]);
    const cartorio = tipo === 'cartorio'
      ? Math.min(c.escrituraMax, Math.max(c.escrituraMin, monte * c.escrituraPct))
      : monte * c.custasPct;
    const registro = Math.max(0, a.imoveis || 0) * c.registroPct;
    const certidoes = c.certidoes;
    const multa = itcmd * c.multaPctImposto;
    const total = itcmd + honorarios + cartorio + registro + certidoes + multa;
    return { itcmd, honorarios, cartorio, registro, certidoes, multa, total, pct: total / monte, heranca };
  }

  /* ---------- previdência: IR regressivo no pagamento ao beneficiário ---------- */
  function aliquotaIRPrevidencia(anos) {
    if (anos <= 2) return 0.35;
    if (anos <= 4) return 0.30;
    if (anos <= 6) return 0.25;
    if (anos <= 8) return 0.20;
    if (anos <= 10) return 0.15;
    return 0.10;
  }

  /* ---------- whole life (planilha Sicoob) ---------- */
  const CURVA_ATUARIAL = [0, 0, 0.241097163867, 0.487973751113, 0.682744002462, 1.001336705758, 1.014145585988, 1.027306247834,
    1.04085723385, 1.054856846523, 1.02244568626, 1.02244568626, 1.022440048223, 1.022398399723, 1.022316561544, 1.022194693113,
    1.022121030853, 1.022031459585, 1.021941151929, 1.021823901696, 1.021690064923, 1.021499945952, 1.021352455044, 1.021083408406,
    1.020813432548, 1.020519769021, 1.020235867542, 1.020074269857, 1.01980874584, 1.019603375745, 1.019340089244, 1.019191640508,
    1.018863606852, 1.018599568002, 1.018316467333, 1.018160805804, 1.017920936357, 1.017639150299, 1.017435737958, 1.017238899724,
    1.017139602869, 1.01687573205, 1.016711855743, 1.016395192576, 1.015994409204, 1.015452466109, 1.014870437983, 1.014400763324,
    1.014320511891, 1.013963819712, 1.013567268708, 1.013004853853, 1.012822942129, 1.012205822004, 1.011710720651, 1.011103646683,
    1.010766580123, 1.010426738494, 1.009729782685, 1.009254456637, 1.008486202062, 1.008182773547, 1.007363765654, 1.007230075812,
    1.00719156258, 1.006885611642, 1.006585607506, 1.006291984413, 1.006004892678, 1.00572476209, 1.005451909824, 1.005186611438,
    1.004928930089];
  const WL_PADRAO = { parcelaPor100k: 637.15, basicaPor100k: 397.23, ganhoReal: 0.025, anosPagamento: 10,
    idadeReferencia: 48, ajustarIdade: true };

  /*
   * Parcela por idade. A planilha Sicoob traz a parcela de uma proposta aos 48 anos
   * (aba Premissas). Para outras idades, a parcela é escalada pelo fator atuarial
   *   f(x) = P(x) / P(idade de referência)
   * em que P(x) é o prêmio nivelado (real) de um seguro vitalício pago em 10 anos, com
   * capital crescendo 2,5% real ao ano:
   *   P(x) = Σ_t  tp_x · q_(x+t) · v^(t+1) · 1,025^t   ÷   Σ_(t<10) tp_x · v^t
   * Mortalidade: Gompertz (q_x = e^(a + b·x)) ajustada à Tábua IBGE 2024 (idades 35–85),
   * com q_x obtido de e(x) por e_x = p_x (1 + e_(x+1)) + q_x / 2.
   * Juros técnicos: a taxa real implícita que faz P(48) bater com a parcela da proposta
   * (≈ 3,9% a.a. com R$ 637,15 por R$ 100 mil). Assim o fator só usa o formato da tábua;
   * o nível de preço continua sendo o da proposta Sicoob. Simplificações: tábua da
   * população (não a de segurados BR-EMS), ambos os sexos, sem carregamentos.
   */
  const GOMPERTZ_IBGE = (function () {
    const e = TABUA_IBGE_2024;
    let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let x = 35; x <= 85; x++) {
      const q = (1 + e[x + 1] - e[x]) / (0.5 + e[x + 1]);
      if (!(q > 0)) continue;
      const y = Math.log(q);
      n++; sx += x; sy += y; sxx += x * x; sxy += x * y;
    }
    const b = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    return { a: (sy - b * sx) / n, b };
  })();
  const qGompertz = x => Math.min(1, Math.exp(GOMPERTZ_IBGE.a + GOMPERTZ_IBGE.b * x));
  /** Prêmio nivelado anual por unidade de capital (real), idade x, juros reais i. */
  function premioNivelado(x, i, ganhoReal, anosPagamento) {
    const v = 1 / (1 + i);
    let A = 0, ann = 0, tp = 1;
    for (let t = 0; x + t < 121 && tp > 1e-12; t++) {
      const q = qGompertz(x + t);
      A += tp * q * Math.pow(v, t + 1) * Math.pow(1 + ganhoReal, t);
      if (t < anosPagamento) ann += tp * Math.pow(v, t);
      tp *= 1 - q;
    }
    return A / ann;
  }
  /** { fator, taxaTecnica } para a idade, calibrado na parcela da idade de referência. */
  function fatorIdadeWholeLife(idade, o) {
    const p = Object.assign({}, WL_PADRAO, o);
    const alvo = p.parcelaPor100k * 12 / 100000;
    let lo = -0.02, hi = 0.20;
    for (let k = 0; k < 80; k++) {
      const m = (lo + hi) / 2;
      if (premioNivelado(p.idadeReferencia, m, p.ganhoReal, p.anosPagamento) > alvo) lo = m; else hi = m;
    }
    const i = (lo + hi) / 2;
    const fator = premioNivelado(idade, i, p.ganhoReal, p.anosPagamento) / premioNivelado(p.idadeReferencia, i, p.ganhoReal, p.anosPagamento);
    return { fator, taxaTecnica: i };
  }

  /**
   * Projeção ano a ano, igual às abas "Base Projeção"/"Projeção" da planilha.
   * Ano a (1..anos): parcela mensal = p0·(1+IPCA)^(a−1) até o fim do pagamento;
   * capital = C·(1+g)^(a−1), g = (1+IPCA)(1+ganho real) − 1;
   * base da reserva: F1 = E, Fa = (Fa−1 + E)(1+g) até o pagamento + 1 (E = básica × 12, fixa);
   * resgatável = F × curva(a) até o fim do pagamento; depois, anterior × curva(a).
   */
  function projetarWholeLife(o) {
    const p = Object.assign({}, WL_PADRAO, o);
    const esc = p.capital / 100000;
    const g = (1 + p.ipca) * (1 + p.ganhoReal) - 1;
    const E = p.basicaPor100k * esc * 12;
    const anos = Math.max(1, Math.round(p.anos));
    const linhas = [];
    let F = 0, R = 0, desembolso = 0;
    for (let a = 1; a <= anos; a++) {
      const paga = a <= p.anosPagamento;
      const parcelaMensal = paga ? p.parcelaPor100k * esc * Math.pow(1 + p.ipca, a - 1) : 0;
      desembolso += parcelaMensal * 12;
      if (a === 1) F = E;
      else if (a <= p.anosPagamento + 1) F = (F + E) * (1 + g);
      const curva = CURVA_ATUARIAL[Math.min(a, CURVA_ATUARIAL.length) - 1];
      R = a <= p.anosPagamento ? F * curva : R * curva;
      linhas.push({ ano: a, idade: (p.idade || 0) + a, parcelaMensal, desembolsoAcumulado: desembolso,
        capital: p.capital * Math.pow(1 + g, a - 1), resgatavel: R, baseReserva: F });
    }
    return { g, linhas };
  }
  /** Capital do seguro no ano a (1 = primeiro ano). */
  function capitalSeguro(C, a, ipca, ganhoReal) {
    if (!(C > 0)) return 0;
    const g = (1 + ipca) * (1 + (ganhoReal === undefined ? WL_PADRAO.ganhoReal : ganhoReal)) - 1;
    return C * Math.pow(1 + g, Math.max(0, a - 1));
  }
  /**
   * "O prêmio é bom?": primeiro ano em que as mesmas parcelas, aplicadas à taxa anual `taxa`
   * (capitalização mensal, parcela no início do mês), alcançam o capital segurado.
   */
  function anoEquilibrioSeguro(o, taxa, maxAnos) {
    const p = Object.assign({}, WL_PADRAO, o);
    const esc = p.capital / 100000, rm = Math.pow(1 + taxa, 1 / 12) - 1;
    let F = 0;
    for (let m = 1; m <= (maxAnos || 80) * 12; m++) {
      const a = Math.floor((m - 1) / 12);
      if (a < p.anosPagamento) F += p.parcelaPor100k * esc * Math.pow(1 + p.ipca, a);
      F *= 1 + rm;
      if (m % 12 === 0 && F >= capitalSeguro(p.capital, m / 12, p.ipca, p.ganhoReal)) return m / 12;
    }
    return null;
  }

  /* ---------- tributação do aluguel: pessoa física × holding (lucro presumido) ---------- */
  /** IRPF mensal pela tabela de 2026, com o redutor da Lei 15.270/2025. `bruto` = rendimento tributável do mês; `base` = após deduções. */
  function irpfMensal(base, bruto) {
    const b = Math.max(0, base);
    let ir;
    if (b <= 2428.80) ir = 0;
    else if (b <= 2826.65) ir = b * 0.075 - 182.16;
    else if (b <= 3751.05) ir = b * 0.15 - 394.16;
    else if (b <= 4664.68) ir = b * 0.225 - 675.49;
    else ir = b * 0.275 - 908.73;
    const g = bruto === undefined ? b : bruto;
    let redutor = 0;
    if (g <= 5000) redutor = 312.89;
    else if (g <= 7350) redutor = Math.max(0, 978.62 - 0.133145 * g);
    const devido = ir - redutor;
    return devido < 0.005 ? 0 : devido;   // abaixo de meio centavo = zero (resíduo de ponto flutuante)
  }
  /** IRPFM anual (Lei 15.270/2025): até 10% para renda total acima de R$ 600 mil, descontado o IR já pago. */
  function irpfm(rendaAnual, irPago, cargaEmpresaSobreLucro) {
    if (!(rendaAnual > 600000)) return 0;
    let aliq = Math.min(0.10, rendaAnual / 60000 / 100 - 0.10);
    if (cargaEmpresaSobreLucro !== undefined && cargaEmpresaSobreLucro + aliq > 0.34) aliq = Math.max(0, 0.34 - cargaEmpresaSobreLucro);
    return Math.max(0, aliq * rendaAnual - irPago);
  }
  function faseIBS(ano) {
    if (ano < 2029) return 0;
    if (ano >= 2033) return 1;
    return (ano - 2028) * 0.1;
  }
  const DESCONTO_SIMPLIFICADO = 607.20;
  const ALUGUEL_PADRAO = { aliqRefIVA: 0.28, fracaoCBS: 1 / 3, reducaoLocacao: 0.70, redutorSocial: 600, lc224: true, opcao487: false, contabilMensal: 1000 };

  /**
   * Carga anual sobre os aluguéis nos dois caminhos.
   * @param a { aluguelMensal, deducoesMensais, outrasRendasMensais, nImoveisAlugados, nResidenciais, ano, contabilMensal, ... }
   */
  function tributacaoAluguel(a) {
    const p = Object.assign({}, ALUGUEL_PADRAO, a);
    const R = Math.max(0, p.aluguelMensal || 0) * 12;
    const outras = Math.max(0, p.outrasRendasMensais || 0);
    const ded = Math.max(0, p.deducoesMensais || 0);
    const ano = p.ano || 2026;
    const ivaLocacao = (fr) => p.aliqRefIVA * (1 - p.reducaoLocacao) * fr;
    const fatorIVA = ano < 2027 ? 0 : (p.fracaoCBS + (1 - p.fracaoCBS) * faseIBS(ano));

    // pessoa física: IR incremental (aluguel somado às outras rendas) + IBS/CBS de grande locador + IRPFM incremental
    // base mensal = rendimento − maior entre as deduções e o desconto simplificado mensal (R$ 607,20)
    const irComAluguel = 12 * irpfMensal(outras + R / 12 - Math.max(ded, DESCONTO_SIMPLIFICADO), outras + R / 12);
    const irSemAluguel = 12 * irpfMensal(outras - DESCONTO_SIMPLIFICADO, outras);
    const grandeLocador = R > 240000 && (p.nImoveisAlugados || 0) > 3;
    const basePF = Math.max(0, R - p.redutorSocial * 12 * (p.nResidenciais || 0));
    const ivaPF = grandeLocador ? basePF * ivaLocacao(fatorIVA) : 0;
    const irpfmPF = Math.max(0, irpfm(outras * 12 + R, irComAluguel) - irpfm(outras * 12, irSemAluguel));
    const pf = { ir: irComAluguel - irSemAluguel, iva: ivaPF, irpfm: irpfmPF, grandeLocador };
    pf.total = pf.ir + pf.iva + pf.irpfm;

    // holding no lucro presumido
    const lp = 0.32 * Math.min(R, 5e6) + (p.lc224 ? 0.352 : 0.32) * Math.max(0, R - 5e6);
    const irpj = 0.15 * lp + 0.10 * Math.max(0, lp - 240000);
    const csll = 0.09 * lp;
    let consumo, cbs = 0, ibs = 0, pisCofins = 0;
    if (ano < 2027 || p.opcao487) { pisCofins = 0.0365 * R; consumo = pisCofins; }
    else { cbs = R * ivaLocacao(p.fracaoCBS); ibs = R * ivaLocacao((1 - p.fracaoCBS) * faseIBS(ano)); consumo = cbs + ibs; }
    const contab = (p.contabilMensal || 0) * 12;
    const lucro = Math.max(0, R - irpj - csll - consumo - contab);
    const cargaEmpresa = lucro > 0 ? (irpj + csll) / (lucro + irpj + csll) : 0;
    const irpfmDiv = Math.max(0, irpfm(outras * 12 + lucro, irSemAluguel, cargaEmpresa) - irpfm(outras * 12, irSemAluguel));
    const holding = { irpj, csll, pisCofins, cbs, ibs, contabilidade: contab, dividendos: irpfmDiv };
    holding.total = irpj + csll + consumo + contab + irpfmDiv;

    return { ano, receita: R, pf, holding,
      cargaPF: R > 0 ? pf.total / R : 0, cargaHolding: R > 0 ? holding.total / R : 0, diferenca: holding.total - pf.total };
  }

  /* ---------- simulação de um caminho ---------- */
  const PREMISSAS_PADRAO = { ipca: 0.04, rentabilidade: 0.10, metaLiquidez: 0.18, irAplicacoes: 0.15, margemEmpate: 0.03,
    taxaAdmPrevidencia: 0.00275, rentabilidadeBruta: false, anoInicial: 2026 };
  const HOLDING_PADRAO = { juridicoPct: 0.015, juridicoMin: 5000, cartorioPct: 0.005, itbiPct: null, laudo: 5000,
    contabilMensal: 1000, anosDoacaoGradual: 10, incluirEmpresa: true };
  const OFFSHORE_PADRAO = { limiar: 2000000, abertura: 20000, manutencaoAnual: 25000, custoSucessaoExteriorPct: 0.05, impostoExteriorPct: 0 };

  /*
   * Partilha pelo regime de bens (Código Civil). `herdeiros` = descendentes.
   *  - comunhão universal: meação de 50% de tudo; cônjuge não herda (art. 1.829, I);
   *  - comunhão parcial (e união estável, STF RE 878.694): meação de 50% dos bens comuns;
   *    o cônjuge herda só sobre os bens particulares (STJ, REsp 1.368.123);
   *  - separação convencional: sem meação; o cônjuge herda sobre tudo (STJ, REsp 1.382.170);
   *  - separação obrigatória: sem meação nem herança (art. 1.829, I; Súmula 377 do STF não modelada).
   * Quota do cônjuge herdeiro igual à de cada descendente, nunca menor que 1/4 se for
   * ascendente de todos eles (art. 1.832). Legítima = 50% da herança (art. 1.846).
   */
  const REGIMES_BENS = ['sem', 'parcial', 'universal', 'separacao', 'obrigatoria'];
  function partilha(o) {
    const n = Math.max(1, Math.round(o.herdeiros || 1));
    const reg = o.regime || 'sem';
    const pc = Math.max(0, Math.min(1, o.pctComuns === undefined ? 1 : o.pctComuns));
    if (reg === 'sem') return { regime: reg, meacaoPct: Math.max(0, o.meacaoPct || 0), conjugeHerdeiro: false, quinhoes: null, fracConjuge: 0, n };
    let meacao = 0, comumHerdado = 0, particular = 1, herda = false;
    if (reg === 'universal') { meacao = 0.5; comumHerdado = 0.5; particular = 0; }
    else if (reg === 'parcial') { meacao = 0.5 * pc; comumHerdado = 0.5 * pc; particular = 1 - pc; herda = particular > 0; }
    else if (reg === 'separacao') { herda = true; }
    const H = comumHerdado + particular;
    if (!herda) return { regime: reg, meacaoPct: meacao, conjugeHerdeiro: false, quinhoes: null, fracConjuge: 0, n };
    const qc = o.ascendenteComum === false ? 1 / (n + 1) : Math.max(1 / (n + 1), 0.25);
    const desc = (comumHerdado / n + particular * (1 - qc) / n) / H;
    const conj = particular * qc / H;
    return { regime: reg, meacaoPct: meacao, conjugeHerdeiro: true, fracConjuge: conj, n,
      quinhoes: Array.from({ length: n }, () => desc).concat([conj]) };
  }
  /** Meses de despesas da família cobertos pela liquidez enquanto o inventário corre (padrão por tipo). */
  const MESES_SUSTENTO = { cartorio: 3, judicial: 24, litigio: 36 };

  /** Parcela e cobertura básica ajustadas à idade (a proposta de referência fica em parcelaReferencia/basicaReferencia). */
  function wholeLifeDaIdade(idade, o) {
    const wl = Object.assign({}, WL_PADRAO, o || {});
    wl.parcelaReferencia = wl.parcelaPor100k; wl.basicaReferencia = wl.basicaPor100k;
    wl.fatorIdade = 1; wl.taxaTecnica = null;
    if (wl.ajustarIdade && isFinite(idade) && idade !== wl.idadeReferencia && wl.parcelaPor100k > 0) {
      const f = fatorIdadeWholeLife(idade, wl);
      wl.fatorIdade = f.fator; wl.taxaTecnica = f.taxaTecnica;
      wl.parcelaPor100k *= f.fator; wl.basicaPor100k *= f.fator;
    }
    return wl;
  }

  function normalizar(e) {
    const pr = Object.assign({}, PREMISSAS_PADRAO, e.premissas || {});
    if (pr.rentabilidadeBruta) pr.rentabilidade = pr.rentabilidade - pr.taxaAdmPrevidencia;
    const h = Object.assign({}, HOLDING_PADRAO, e.holding || {});
    if (h.itbiPct === null || h.itbiPct === undefined) h.itbiPct = (e.aluguelMensal || 0) > 0 ? 0.02 : 0;
    const tipo = e.tipoInventario || 'cartorio';
    const cj = Object.assign({ regime: 'sem', pctComuns: 1, ascendenteComum: true }, e.conjuge || {});
    const part = partilha({ herdeiros: e.herdeiros === undefined ? 2 : e.herdeiros, meacaoPct: e.meacaoPct, regime: cj.regime,
      pctComuns: cj.pctComuns, ascendenteComum: cj.ascendenteComum });
    const sus = Object.assign({ despesaMensal: 0, meses: null }, e.sustento || {});
    if (typeof sus.meses !== 'number' || !(sus.meses >= 0)) sus.meses = MESES_SUSTENTO[tipo] || 0;   // null >= 0 é true em JS
    return Object.assign({
      idade: 55, uf: 'MT', herdeiros: 2, meacaoPct: 0, tipoInventario: 'cartorio', regime: 'vigente',
      imoveis: 0, nImoveis: 0, aplicacoes: 0, previdencia: 0, previdenciaAportado: null, previdenciaAnos: 10,
      seguroExistente: 0, empresa: 0, exterior: 0, rendaMensal: 0,
      aluguelMensal: 0, deducoesAluguelMensal: 0, nImoveisAlugados: 0, nResidenciais: 0, outrasRendasMensais: 0,
      doacaoCustoPct: 0.01
    }, e, {
      premissas: pr, holding: h, conjuge: cj, partilha: part, meacaoPct: part.meacaoPct, sustento: sus,
      custos: Object.assign({}, CUSTOS_PADRAO, e.custos || {}),
      wholeLife: wholeLifeDaIdade(e.idade === undefined ? 55 : e.idade, e.wholeLife),
      offshore: Object.assign({}, OFFSHORE_PADRAO, e.offshore || {}),
      aluguelOpcoes: Object.assign({}, e.aluguelOpcoes || {})   // lc224, opcao487, aliqRefIVA (opcionais)
    });
  }

  /**
   * Simula um caminho ano a ano e devolve o resultado em cada ano de falecimento 1..H.
   * cfg = { X (transferência das aplicações para a previdência), C (capital de whole life novo),
   *         doaImoveis, holding: null|'total'|'gradual', offshore }
   */
  function simular(e, cfg, H) {
    const pr = e.premissas, r = pr.rentabilidade, ipca = pr.ipca, s = pr.metaLiquidez;
    const hp = e.holding, wl = e.wholeLife, of = e.offshore;
    const X = Math.max(0, cfg.X || 0), C = Math.max(0, cfg.C || 0);
    let imov = e.imoveis, emp = e.empresa, ext = e.exterior;
    let aplic = e.aplicacoes, aplicBase = e.aplicacoes;
    let prevV = e.previdencia, prevVBase = e.previdenciaAportado === null ? e.previdencia : e.previdenciaAportado;
    let prevN = 0, prevNBase = 0;
    let custosCaminho = 0;        // nominal pago no ano 0 (estruturação) — para relatório
    const custosAno = [];
    const pagar = v => {
      if (!(v > 0)) return;
      if (aplic > 0) aplicBase -= v * Math.min(1, aplicBase / aplic);
      aplic -= v;
    };
    const integ = () => imov + (hp.incluirEmpresa ? emp : 0);
    // ano 0: estruturação
    let custo0 = 0;
    if (X > 0) { const x = Math.min(X, Math.max(0, aplic)); aplic -= x; aplicBase -= x; prevN += x; prevNBase += x; }
    if (cfg.doaImoveis && imov > 0) {
      custo0 += itcmdDividido(imov, e.herdeiros, e.uf, e.regime, 'doacao') + imov * e.doacaoCustoPct;
    }
    let doado = 0; // fração das cotas da holding já doadas
    if (cfg.holding) {
      const v = integ();
      custo0 += Math.max(hp.juridicoMin, v * hp.juridicoPct) + imov * hp.cartorioPct + imov * hp.itbiPct;
      if (cfg.holding === 'total') { custo0 += itcmdDividido(v, e.herdeiros, e.uf, e.regime, 'doacao') + hp.laudo; doado = 1; }
    }
    if (cfg.offshore) custo0 += of.abertura;
    pagar(custo0); custosCaminho = custo0;

    const anos = [];
    let custoRealAcum = custo0;
    for (let t = 1; t <= H; t++) {
      imov *= 1 + ipca; emp *= 1 + ipca; ext *= 1 + r; aplic *= 1 + r; prevV *= 1 + r; prevN *= 1 + r;
      let custo = 0;
      if (C > 0 && t <= wl.anosPagamento) custo += wl.parcelaPor100k * (C / 100000) * Math.pow(1 + ipca, t - 1) * 12;
      if (cfg.holding) {
        custo += hp.contabilMensal * 12;
        if ((e.aluguelMensal || 0) > 0) {
          const ta = tributacaoAluguel(Object.assign({}, e.aluguelOpcoes, { aluguelMensal: e.aluguelMensal * Math.pow(1 + ipca, t - 1), deducoesMensais: e.deducoesAluguelMensal * Math.pow(1 + ipca, t - 1),
            outrasRendasMensais: e.outrasRendasMensais, nImoveisAlugados: e.nImoveisAlugados, nResidenciais: e.nResidenciais,
            ano: pr.anoInicial + t, contabilMensal: 0 }));
          custo += ta.diferenca;
        }
        if (cfg.holding === 'gradual' && doado < 1) {
          const novo = Math.min(1, t / Math.max(1, hp.anosDoacaoGradual));
          custo += itcmdDividido(integ() * (novo - doado), e.herdeiros, e.uf, e.regime, 'doacao') + hp.laudo;
          doado = novo;
        }
      }
      if (cfg.offshore) custo += of.manutencaoAnual;
      custosAno.push(custo);
      custoRealAcum += custo / Math.pow(1 + ipca, t);
      if (custo >= 0) pagar(custo); else { aplic -= custo; aplicBase -= custo; }

      // falecimento ao fim do ano t
      const fora = cfg.holding ? integ() : (cfg.doaImoveis ? imov : 0);      // bens já fora do inventário (doados/holding)
      const doadoValor = cfg.holding ? integ() * doado : fora;
      const cotasInv = cfg.holding ? integ() * (1 - doado) : 0;
      const imovInv = (cfg.holding || cfg.doaImoveis) ? 0 : imov;
      const empInv = (cfg.holding && hp.incluirEmpresa) ? 0 : emp;
      const monte = imovInv + empInv + cotasInv + aplic + ext;
      const inv = custoInventario({ monte, imoveis: imovInv, meacaoPct: e.meacaoPct, herdeiros: e.herdeiros, quinhoes: e.partilha.quinhoes,
        uf: e.uf, regime: e.regime, tipo: e.tipoInventario, custos: e.custos });
      const custoExterior = cfg.offshore ? 0 : ext * (of.custoSucessaoExteriorPct + of.impostoExteriorPct);
      const irPrevV = aliquotaIRPrevidencia(e.previdenciaAnos + t) * Math.max(0, prevV - prevVBase);
      const irPrevN = aliquotaIRPrevidencia(t) * Math.max(0, prevN - prevNBase);
      const previdenciaLiquida = prevV + prevN - irPrevV - irPrevN;
      const seguro = (e.seguroExistente || 0) + capitalSeguro(C, t, ipca, wl.ganhoReal);
      const irLatente = pr.irAplicacoes * Math.max(0, aplic - Math.max(0, aplicBase));
      const sustento = e.sustento.despesaMensal * e.sustento.meses * Math.pow(1 + ipca, t);
      const meta = s * Math.max(0, monte) + sustento;
      const liquidez = previdenciaLiquida + seguro;
      const familia = monte - inv.total - custoExterior - irLatente + doadoValor + previdenciaLiquida + seguro;
      const brutoFamilia = Math.max(1, monte + doadoValor + prevV + prevN + seguro);
      anos.push({
        ano: t, monte, inventario: inv, sustento, custoExterior, previdenciaLiquida, seguro, liquidez, meta,
        cobertura: meta > 0 ? liquidez / meta : Infinity, aplicacoes: aplic, familia,
        familiaReal: familia / Math.pow(1 + ipca, t), travado: Math.max(0, monte) / brutoFamilia,
        custosReais: custoRealAcum, faltaRecurso: aplic < 0
      });
    }
    return { cfg, anos, custoEstruturacao: custosCaminho, custosAno };
  }

  const coberturaMinima = (sim, ate) => Math.min(...sim.anos.slice(0, ate || sim.anos.length).map(a => a.cobertura));

  /** Menor valor (bissecção) de cfg[campo] que cobre 100% em todos os anos até `ateAno`. */
  function menorQueCobre(e, cfg, campo, max, H, ateAno) {
    const cobre = v => coberturaMinima(simular(e, Object.assign({}, cfg, { [campo]: v }), H), ateAno) >= 1;
    if (cobre(0)) return 0;
    if (!cobre(max)) return null;
    let lo = 0, hi = max;
    for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (cobre(m)) hi = m; else lo = m; }
    return hi;
  }

  /** Liquidez pela combinação: previdência até onde as aplicações permitem; seguro cobre o que faltar. */
  function liquidezCombinada(e, base, H, ateAno) {
    const disponivel = Math.max(0, e.aplicacoes - estimarCusto0(e, base));
    const X = menorQueCobre(e, base, 'X', disponivel, H, ateAno);
    if (X !== null) return { X, C: 0 };
    const cfg = Object.assign({}, base, { X: disponivel });
    const tetoC = Math.max(1e5, (e.imoveis + e.aplicacoes + e.empresa + e.exterior) * 2);
    const C = menorQueCobre(e, cfg, 'C', tetoC, H, ateAno);
    return { X: disponivel, C: C === null ? tetoC : C };
  }
  function estimarCusto0(e, cfg) { return simular(e, Object.assign({}, cfg, { X: 0, C: 0 }), 1).custoEstruturacao; }

  /* ---------- comparação dos caminhos ---------- */
  const COMPLEXIDADE = { inventario: 0, previdencia: 1, seguro: 2, combinado: 2.5, doacao: 3, holdingTotal: 4, holdingGradual: 4.5, offshore: 5 };

  function analisar(entrada, opcoes) {
    const e = normalizar(entrada);
    const erros = validar(e);
    if (erros.length) return { ok: false, erros };
    const Texp = Math.max(1, Math.round(expectativaSobrevida(e.idade)));
    const H = Math.max(10, Texp);
    const hipoteses = [{ id: 'proximo', ano: 1 }, { id: 'dez', ano: 10 }, { id: 'expectativa', ano: Texp }];
    const ate = H;   // cobertura exigida em todo o horizonte para dimensionar; o filtro olha o 1º ano

    const defs = [];
    const add = (id, cfg) => defs.push({ id, cfg });
    add('inventario', {});
    const disp = Math.max(0, e.aplicacoes);
    const Xp = menorQueCobre(e, {}, 'X', disp, H, ate);
    add('previdencia', { X: Xp === null ? disp : Xp });
    const tetoC = Math.max(1e5, (e.imoveis + e.aplicacoes + e.empresa + e.exterior) * 2);
    const Cs = menorQueCobre(e, {}, 'C', tetoC, H, ate);
    add('seguro', { C: Cs === null ? tetoC : Cs });
    if (Xp === null) add('combinado', liquidezCombinada(e, {}, H, ate));
    if (e.imoveis > 0) add('doacao', Object.assign({ doaImoveis: true }, liquidezCombinada(e, { doaImoveis: true }, H, ate)));
    if (e.imoveis + (e.holding.incluirEmpresa ? e.empresa : 0) > 0) {
      add('holdingTotal', Object.assign({ holding: 'total' }, liquidezCombinada(e, { holding: 'total' }, H, ate)));
      add('holdingGradual', Object.assign({ holding: 'gradual' }, liquidezCombinada(e, { holding: 'gradual' }, H, ate)));
    }

    const montar = d => {
      const sim = simular(e, d.cfg, H);
      const em = hipoteses.reduce((o, h) => { o[h.id] = sim.anos[h.ano - 1]; return o; }, {});
      return { id: d.id, cfg: d.cfg, sim, em, coberturaAno1: sim.anos[0].cobertura,
        coberturaMin: coberturaMinima(sim), protegeJa: sim.anos[0].cobertura >= 1 - 1e-9, complexidade: COMPLEXIDADE[d.id],
        faltaRecurso: sim.anos.some(a => a.faltaRecurso) };
    };
    let caminhos = defs.map(montar);

    // offshore: só com bens no exterior acima do limite — variante do melhor caminho sem offshore
    const temOffshore = e.exterior >= e.offshore.limiar;
    let rec = recomendar(caminhos, e.premissas.margemEmpate);
    if (temOffshore && rec.vencedor) {
      const base = caminhos.find(c => c.id === rec.vencedor);
      caminhos.push(montar({ id: 'offshore', cfg: Object.assign({}, base.cfg, { offshore: true }) }));
      rec = recomendar(caminhos, e.premissas.margemEmpate);
    }

    // estabilidade: o vencedor continua à frente nas outras hipóteses e no regime de estresse?
    const estabilidade = {};
    if (rec.vencedor) {
      for (const h of ['proximo', 'dez']) {
        const r2 = recomendar(caminhos, e.premissas.margemEmpate, h);
        estabilidade[h] = r2.vencedor === rec.vencedor ? null : r2.vencedor;
      }
      if (!(opcoes && opcoes.semEstresse) && e.regime !== 'estresse') {
        const est = analisar(Object.assign({}, entrada, { regime: 'estresse' }), { semEstresse: true });
        estabilidade.estresse = est.ok && est.recomendacao.vencedor !== rec.vencedor ? est.recomendacao.vencedor : null;
      }
    }

    const sem = caminhos.find(c => c.id === 'inventario');
    const hoje = sem.sim.anos[0];
    const custoHoje = custoInventario({ monte: e.imoveis + e.aplicacoes + e.empresa + e.exterior, imoveis: e.imoveis,
      meacaoPct: e.meacaoPct, herdeiros: e.herdeiros, quinhoes: e.partilha.quinhoes, uf: e.uf, regime: e.regime, tipo: e.tipoInventario, custos: e.custos });
    const regimes = ['vigente', 'reforma', 'estresse'].reduce((o, rg) => {
      o[rg] = custoInventario({ monte: e.imoveis + e.aplicacoes + e.empresa + e.exterior, imoveis: e.imoveis, meacaoPct: e.meacaoPct,
        herdeiros: e.herdeiros, quinhoes: e.partilha.quinhoes, uf: e.uf, regime: rg, tipo: e.tipoInventario, custos: e.custos });
      return o;
    }, {});

    return {
      ok: true, entrada: e, Texp, H, hipoteses, caminhos, recomendacao: rec, estabilidade,
      base: { custoHoje, metaInventarioHoje: e.premissas.metaLiquidez * (e.imoveis + e.aplicacoes + e.empresa + e.exterior),
        sustentoHoje: e.sustento.despesaMensal * e.sustento.meses,
        metaHoje: e.premissas.metaLiquidez * (e.imoveis + e.aplicacoes + e.empresa + e.exterior) + e.sustento.despesaMensal * e.sustento.meses,
        regimes, anoHoje: hoje,
        heranca: custoHoje.heranca, legitima: custoHoje.heranca / 2, disponivel: custoHoje.heranca / 2,
        meacao: (e.imoveis + e.aplicacoes + e.empresa + e.exterior) * e.meacaoPct },
      holding: avaliarHolding(e, caminhos, rec, Texp),
      seguroDesnecessario: Xp !== null,
      previdencia: { X: Xp, disponivel: disp, metaFormula: e.premissas.metaLiquidez / (1 + e.premissas.metaLiquidez) },
      aluguel: (e.aluguelMensal || 0) > 0 ? Array.from({ length: 10 }, (_, i) => tributacaoAluguel(Object.assign({}, e.aluguelOpcoes, {
        aluguelMensal: e.aluguelMensal * Math.pow(1 + e.premissas.ipca, i), deducoesMensais: e.deducoesAluguelMensal * Math.pow(1 + e.premissas.ipca, i),
        outrasRendasMensais: e.outrasRendasMensais, nImoveisAlugados: e.nImoveisAlugados, nResidenciais: e.nResidenciais,
        ano: e.premissas.anoInicial + i + 1, contabilMensal: e.holding.contabilMensal }))) : null,
      seguro: detalheSeguro(e, caminhos)
    };
  }

  /** Regra validada: filtro de proteção → maior VCF na hipótese → empate abaixo da margem favorece o mais simples. */
  function recomendar(caminhos, margem, hipotese) {
    const h = hipotese || 'expectativa';
    const aptos = caminhos.filter(c => c.protegeJa && !c.faltaRecurso);
    if (!aptos.length) return { vencedor: null, aptos: [], melhorValor: null };
    const melhor = Math.max(...aptos.map(c => c.em[h].familiaReal));
    const empatados = aptos.filter(c => c.em[h].familiaReal >= melhor * (1 - margem));
    empatados.sort((a, b) => a.complexidade - b.complexidade || b.em[h].familiaReal - a.em[h].familiaReal);
    const ordem = aptos.slice().sort((a, b) => b.em[h].familiaReal - a.em[h].familiaReal).map(c => c.id);
    return { vencedor: empatados[0].id, maiorValor: ordem[0], porSimplicidade: empatados[0].id !== ordem[0], ordem, melhorValor: melhor, hipotese: h };
  }

  function avaliarHolding(e, caminhos, rec, Texp) {
    const hs = caminhos.filter(c => c.id === 'holdingTotal' || c.id === 'holdingGradual');
    if (!hs.length) return { aplicavel: false };
    const venc = caminhos.find(c => c.id === rec.vencedor);
    const recomendada = !!venc && (venc.id === 'holdingTotal' || venc.id === 'holdingGradual');
    const melhorH = hs.slice().sort((a, b) => b.em.expectativa.familiaReal - a.em.expectativa.familiaReal)[0];
    const motivos = [];
    if (!recomendada) {
      if (venc) motivos.push({ id: 'numeros', diferenca: venc.em.expectativa.familiaReal - melhorH.em.expectativa.familiaReal, vencedor: venc.id });
      const total = e.imoveis + e.aplicacoes + e.previdencia + e.empresa + e.exterior;
      if (total > 0 && (e.aplicacoes + e.previdencia + e.exterior) / total >= 0.6) motivos.push({ id: 'financeiro' });
      if (e.nImoveis > 0 && e.nImoveis <= 2 && e.empresa === 0) motivos.push({ id: 'poucosImoveis', n: e.nImoveis });
      if ((e.aluguelMensal || 0) > 0) {
        const ta = tributacaoAluguel(Object.assign({}, e.aluguelOpcoes, { aluguelMensal: e.aluguelMensal, deducoesMensais: e.deducoesAluguelMensal, outrasRendasMensais: e.outrasRendasMensais,
          nImoveisAlugados: e.nImoveisAlugados, nResidenciais: e.nResidenciais, ano: e.premissas.anoInicial + 1, contabilMensal: e.holding.contabilMensal }));
        if (ta.diferenca >= 0) motivos.push({ id: 'aluguel', diferencaAno: ta.diferenca });
      }
    }
    // custo evitado: estruturação + manutenção da holding até a expectativa, em R$ de hoje (sem ITCMD, que existe em qualquer caminho)
    const hp = e.holding, ipca = e.premissas.ipca;
    const v = e.imoveis + (hp.incluirEmpresa ? e.empresa : 0);
    let custoEvitado = Math.max(hp.juridicoMin, v * hp.juridicoPct) + e.imoveis * hp.cartorioPct + e.imoveis * hp.itbiPct + hp.laudo;
    for (let t = 1; t <= Texp; t++) custoEvitado += hp.contabilMensal * 12 / Math.pow(1 + ipca, t);
    return { aplicavel: true, recomendada, motivos, custoEvitado, melhor: melhorH.id };
  }

  function detalheSeguro(e, caminhos) {
    const c = caminhos.find(x => x.id === 'combinado' && x.cfg.C > 0) || caminhos.find(x => x.id === 'seguro');
    if (!c || !(c.cfg.C > 0)) return null;
    const o = Object.assign({}, e.wholeLife, { capital: c.cfg.C, ipca: e.premissas.ipca, idade: e.idade });
    const proj = projetarWholeLife(Object.assign({}, o, { anos: Math.max(10, Math.round(expectativaSobrevida(e.idade))) }));
    const p1 = proj.linhas[0].parcelaMensal, p10 = proj.linhas[Math.min(9, proj.linhas.length - 1)].parcelaMensal;
    const desembolso = proj.linhas[Math.min(e.wholeLife.anosPagamento, proj.linhas.length) - 1].desembolsoAcumulado;
    const equilibrio = [0.08, 0.10, 0.12].map(t => ({ taxa: t, ano: anoEquilibrioSeguro(o, t, 80) }));
    const anoResgateSuperaPago = (proj.linhas.find(l => l.resgatavel >= l.desembolsoAcumulado && l.ano > 1) || {}).ano || null;
    return { caminho: c.id, capital: c.cfg.C, parcelaInicial: p1, parcela10: p10, desembolso,
      pctRenda: e.rendaMensal > 0 ? p1 / e.rendaMensal : null, pctRenda10: e.rendaMensal > 0 ? p10 / e.rendaMensal : null,
      alavancagem: c.cfg.C / desembolso, equilibrio, anoResgateSuperaPago, projecao: proj.linhas };
  }

  function validar(e) {
    const erros = [];
    if (!ITCMD.ESTADOS[e.uf]) erros.push('Escolha um dos estados disponíveis: MT, MS, RO ou PA.');
    if (!(e.idade >= 18 && e.idade <= 100)) erros.push('A idade precisa estar entre 18 e 100 anos.');
    if (!(e.herdeiros >= 1)) erros.push('Informe ao menos um herdeiro.');
    const tot = e.imoveis + e.aplicacoes + e.previdencia + e.empresa + e.exterior;
    if (!(tot > 0)) erros.push('Informe o patrimônio.');
    ['imoveis', 'aplicacoes', 'previdencia', 'empresa', 'exterior', 'seguroExistente', 'aluguelMensal'].forEach(k => {
      if (!(e[k] >= 0)) erros.push('Valores não podem ser negativos.');
    });
    if (!(e.meacaoPct >= 0 && e.meacaoPct < 1)) erros.push('A meação precisa estar entre 0% e 99%.');
    if (REGIMES_BENS.indexOf(e.conjuge.regime) < 0) erros.push('Regime de bens desconhecido.');
    if (!(e.conjuge.pctComuns >= 0 && e.conjuge.pctComuns <= 1)) erros.push('Os bens comuns precisam estar entre 0% e 100% do patrimônio.');
    if (!(e.sustento.despesaMensal >= 0) || !(e.sustento.meses >= 0 && e.sustento.meses <= 120)) erros.push('Despesas da família: valor não negativo e até 120 meses.');
    const pr = e.premissas;
    if (!(pr.rentabilidade > -0.5 && pr.rentabilidade < 1)) erros.push('Rentabilidade fora do intervalo aceito.');
    if (!(pr.metaLiquidez > 0 && pr.metaLiquidez < 1)) erros.push('A meta de liquidez precisa estar entre 0% e 100%.');
    return [...new Set(erros)];
  }

  return {
    TABUA_IBGE_2024, CURVA_ATUARIAL, PREMISSAS_PADRAO, CUSTOS_PADRAO, HOLDING_PADRAO, OFFSHORE_PADRAO, WL_PADRAO,
    expectativaSobrevida, itcmdValor, itcmdDividido, custoInventario, partilha, MESES_SUSTENTO, REGIMES_BENS, honorariosPadrao, aliquotaIRPrevidencia,
    projetarWholeLife, fatorIdadeWholeLife, wholeLifeDaIdade, capitalSeguro, anoEquilibrioSeguro, irpfMensal, irpfm, faseIBS, tributacaoAluguel,
    normalizar, simular, analisar, recomendar, validar
  };
});
