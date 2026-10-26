/*
 * Motor de cálculo — Estratégia de Aquisição
 * (consórcio × financiamento × capital próprio)
 * --------------------------------------------------------------
 * Funções puras, sem acesso ao DOM. Funcionam no navegador
 * (window.AquisicaoEngine) e no Node (require), para testes.
 *
 * PERGUNTA QUE O MOTOR RESPONDE
 *   "Qual forma de comprar o bem preserva melhor o patrimônio do cliente,
 *    considerando que o capital que continua investido gera renda para
 *    pagar a parcela?"
 *
 * CONVENÇÕES (validadas com o usuário em 26/10/2026)
 * - Base mensal, igual ao Planejamento: taxa mensal equivalente
 *   i_m = (1 + i_a)^(1/12) − 1. Pagamentos no FIM de cada mês.
 * - Rendimento do capital: taxa mensal LÍQUIDA (informada pelo chamador).
 *   Para produtos tributados, a renda mensal bruta é reduzida pela alíquota
 *   de IR do prazo médio da aplicação informado (ver taxaMensalLiquida).
 * - Todo mês: capital ← capital × (1 + r) + aporte − parcela − seguro − custo de espera.
 *   O que sobra da renda fica reinvestido; o que falta sai do capital
 *   (descapitalização). Se o capital ficar NEGATIVO, o valor representa
 *   dinheiro que precisaria vir de fora, corrigido pela mesma taxa
 *   (custo de oportunidade) — a interface mostra o mês em que isso acontece.
 * - Valor do bem: corrigido mês a mês pela valorização anual informada
 *   (padrão = IPCA, decisão do usuário). Quem compra depois paga mais caro.
 * - Patrimônio líquido = capital + valor do bem (se já comprado) − saldo devedor.
 *   Em R$ de hoje: dividido por (1 + IPCA)^(meses/12).
 * - Financiamento: parcela pela taxa do CET informado (o CET já inclui
 *   seguros e tarifas), SAC ou Price. Entrada = valor do bem − valor financiado.
 * - Consórcio (modelo em percentual da carta, como nas administradoras):
 *     percentual total devido  P = 100% + taxa de administração + fundo de reserva
 *     parcela antes da contemplação = P / prazo × valor atual da carta
 *     valor da carta reajustado a cada 12 meses pelo índice informado
 *     (o saldo devedor acompanha o reajuste)
 *     seguro = % ao mês sobre o saldo devedor
 *     no mês da contemplação: lance total abate o percentual devido;
 *     a parte embutida sai do crédito; a parte livre sai do capital do cliente.
 *     Crédito maior que o preço do bem → excedente abate o saldo devedor.
 *     Crédito menor que o preço → a diferença sai do capital.
 *     Depois do lance: "reduz parcela" divide o saldo pelos meses restantes;
 *     "reduz prazo" mantém a parcela e encurta o plano.
 * - Capital próprio: compra no primeiro mês em que o capital cobre o preço
 *   do bem (já valorizado). Até lá, o capital continua rendendo.
 * - Custo de espera (aluguel, por exemplo): opcional, pago todo mês enquanto
 *   o cliente ainda não tem o bem, em qualquer caminho.
 * - Arredondamento só na apresentação.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AquisicaoEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_MESES = 600;

  /* ---------- taxas ---------- */
  function taxaMensal(taxaAnual) { return Math.pow(1 + taxaAnual, 1 / 12) - 1; }
  function taxaAnualDeMensal(taxaMes) { return Math.pow(1 + taxaMes, 12) - 1; }

  /** IR regressivo de renda fixa por dias corridos (mesma tabela do Módulo 1). */
  function aliquotaIR(dias) {
    if (dias <= 180) return 0.225;
    if (dias <= 360) return 0.20;
    if (dias <= 720) return 0.175;
    return 0.15;
  }

  /**
   * Taxa mensal líquida do capital investido.
   *  { modo: 'renda', rendaMensal, capital }            → renda líquida informada ÷ capital
   *  { modo: 'produto', taxaBrutaAnual, isentoIR, prazoMedioDias }
   *       → taxa bruta mensal equivalente × (1 − alíquota de IR do prazo médio)
   */
  /** Lance oferecido em número de parcelas → fração da carta (cada parcela = P ÷ n). */
  function lanceDeParcelas(nParcelas, prazoMeses, taxaAdm, fundoReserva) {
    return nParcelas * (1 + taxaAdm + fundoReserva) / prazoMeses;
  }

  function taxaMensalLiquida(cfg) {
    if (cfg.modo === 'renda') return cfg.capital > 0 ? cfg.rendaMensal / cfg.capital : 0;
    const bruta = taxaMensal(cfg.taxaBrutaAnual);
    return cfg.isentoIR ? bruta : bruta * (1 - aliquotaIR(cfg.prazoMedioDias));
  }

  /** Parcela da Tabela Price. */
  function pmt(pv, i, n) {
    if (n <= 0) return pv;
    if (i === 0) return pv / n;
    return pv * i / (1 - Math.pow(1 + i, -n));
  }

  /** Taxa interna de retorno mensal de um fluxo (bissecção). null se não houver raiz. */
  function tir(fluxos) {
    const vpl = r => fluxos.reduce((s, f, k) => s + f / Math.pow(1 + r, k), 0);
    let lo = -0.5, hi = 1;
    let vlo = vpl(lo);
    const vhi = vpl(hi);
    if (!isFinite(vlo) || !isFinite(vhi) || vlo * vhi > 0) return null;
    for (let k = 0; k < 300; k++) {
      const mid = (lo + hi) / 2, vm = vpl(mid);
      if (vm === 0) return mid;
      if (vlo * vm < 0) hi = mid; else { lo = mid; vlo = vm; }
    }
    return (lo + hi) / 2;
  }

  /* ---------- validação ---------- */
  function validar(e) {
    const erros = [];
    const pos = (v) => typeof v === 'number' && isFinite(v);
    if (!(pos(e.capital) && e.capital >= 0)) erros.push('Capital investido inválido.');
    if (!(pos(e.valorBem) && e.valorBem > 0)) erros.push('Informe o valor do bem.');
    if (!(pos(e.horizonteMeses) && e.horizonteMeses >= 1)) erros.push('Horizonte inválido.');
    const f = e.financiamento;
    if (f && f.ativo) {
      if (!(pos(f.valorFinanciado) && f.valorFinanciado > 0)) erros.push('Financiamento: informe o valor financiado.');
      if (f.modo === 'proposta') {
        if (!(pos(f.jurosNominalAnual) && f.jurosNominalAnual >= 0)) erros.push('Financiamento: taxa nominal de juros inválida.');
        if (!(pos(f.trMensal) && f.trMensal >= 0)) erros.push('Financiamento: TR projetada inválida.');
        if (!(pos(f.dfiMensal) && f.dfiMensal >= 0)) erros.push('Financiamento: seguro DFI inválido.');
        if (!(pos(f.tacMensal) && f.tacMensal >= 0)) erros.push('Financiamento: tarifa mensal inválida.');
        if (!(pos(f.despesasIniciais) && f.despesasIniciais >= 0)) erros.push('Financiamento: despesas iniciais inválidas.');
      } else if (!(pos(f.cetAnual) && f.cetAnual >= 0)) erros.push('Financiamento: CET inválido.');
      if (f.mesInicio !== undefined && !(pos(f.mesInicio) && f.mesInicio >= 0)) erros.push('Financiamento: a data da contratação não pode ser no passado.');
      if (!(pos(f.prazoMeses) && f.prazoMeses >= 1 && f.prazoMeses <= MAX_MESES)) erros.push('Financiamento: prazo inválido.');
    }
    const c = e.consorcio;
    if (c && c.ativo) {
      if (!(pos(c.carta) && c.carta > 0)) erros.push('Consórcio: informe o valor da carta.');
      if (!(pos(c.prazoMeses) && c.prazoMeses >= 1 && c.prazoMeses <= MAX_MESES)) erros.push('Consórcio: prazo inválido.');
      ['taxaAdm', 'fundoReserva', 'seguroValor', 'reajusteAnual'].forEach(k => {
        if (!(pos(c[k] || 0) && (c[k] || 0) >= 0)) erros.push('Consórcio: ' + ({ taxaAdm: 'taxa de administração', fundoReserva: 'fundo de reserva', seguroValor: 'seguro', reajusteAnual: 'reajuste' })[k] + ' inválido.');
      });
      if (!(pos(c.lanceTotal) && c.lanceTotal >= 0 && c.lanceTotal <= 1)) erros.push('Consórcio: lance total deve ficar entre 0% e 100%.');
      if (!(pos(c.lanceEmbutido) && c.lanceEmbutido >= 0)) erros.push('Consórcio: lance embutido inválido.');
      else if (c.lanceEmbutido > c.lanceTotal + 1e-12) erros.push('Consórcio: o lance embutido não pode ser maior que o lance total.');
      if (!(pos(c.mesContemplacao) && c.mesContemplacao >= 1 && c.mesContemplacao <= c.prazoMeses)) erros.push('Consórcio: o mês de contemplação deve estar dentro do prazo.');
    }
    return erros;
  }

  /* ---------- núcleo da simulação ---------- */
  function contexto(e, override) {
    const ctx = Object.assign({
      capital: e.capital,
      aporteMensal: e.aporteMensal || 0,
      valorBem: e.valorBem,
      valorizacaoAnual: e.valorizacaoAnual || 0,
      ipcaAnual: e.ipcaAnual || 0,
      custoEsperaMensal: e.custoEsperaMensal || 0,
      reservaMinima: e.reservaMinima || 0,
      mesCompraAlvo: Math.max(0, Math.round(e.mesCompra || 0)),
      aliquotaIR: e.aliquotaIRResgate || 0,
      horizonteMeses: Math.round(e.horizonteMeses)
    }, override || {});
    // taxa do mês m (1..): função, lista ou número
    const t = override && override.taxaMes !== undefined ? override.taxaMes : e.taxaMes;
    ctx.taxa = typeof t === 'function' ? t : (Array.isArray(t) ? (m => t[Math.min(m - 1, t.length - 1)]) : (() => t || 0));
    ctx.precoBem = m => ctx.valorBem * Math.pow(1 + ctx.valorizacaoAnual, m / 12);
    ctx.deflator = m => Math.pow(1 + ctx.ipcaAnual, m / 12);
    return ctx;
  }

  /*
   * Conta do capital investido.
   * - Isento (LCA) ou renda já líquida: alíquota 0, a conta é só um saldo que rende.
   * - Tributado (RDC, CDB, compromissada): a conta guarda o saldo BRUTO e o custo
   *   (quanto foi aplicado). O IR só é cobrado no resgate, sobre a parte de ganho do
   *   valor resgatado: ganho = resgate × (saldo − custo) ÷ saldo. Enquanto não há
   *   resgate, o imposto continua rendendo. Capital exibido = saldo líquido de IR.
   *   Premissa: o capital de hoje entra com custo = saldo (sem ganho anterior a tributar).
   * - Saldo negativo = dinheiro que precisaria vir de fora, corrigido pela mesma taxa.
   */
  function novaConta(ctx) {
    const a = ctx.aliquotaIR || 0;
    return {
      B: ctx.capital, K: ctx.capital, irPago: 0,
      liquido() { return this.B > 0 ? this.B - a * Math.max(0, this.B - this.K) : this.B; },
      /** rende o mês t; devolve a renda líquida do mês (ganho bruto menos o IR que ele vai gerar) */
      render(t) {
        const ganho = this.B * ctx.taxa(t);
        this.B += ganho;
        return this.B - ganho > 0 ? ganho * (1 - a) : ganho;
      },
      rendaPrevista(t) { const g = this.B * ctx.taxa(t); return this.B > 0 ? g * (1 - a) : g; },
      depositar(v) {
        if (!(v > 0)) { if (v < 0) this.sacar(-v); return; }
        if (this.B < 0) { this.B += v; if (this.B > 0) this.K = this.B; }
        else { this.B += v; this.K += v; }
      },
      /** retira v líquidos (já descontado o IR do resgate) */
      sacar(v) {
        if (!(v > 0)) { if (v < 0) this.depositar(-v); return; }
        if (this.B <= 0) { this.B -= v; return; }
        const f = Math.max(0, (this.B - this.K) / this.B);
        const bruto = v / (1 - a * f);
        if (bruto <= this.B + 1e-9) {
          this.irPago += bruto - v;
          this.K -= bruto * this.K / this.B;
          this.B -= bruto;
          if (this.B < 1e-9) { this.B = 0; this.K = 0; }
        } else {
          const disp = this.liquido();
          this.irPago += this.B - disp;
          this.B = -(v - disp); this.K = 0;
        }
      }
    };
  }

  function novoRegistro(ctx, m, C, saldo, temBem, extra) {
    const bem = temBem ? ctx.precoBem(m) : 0;
    const pl = C + bem - saldo;
    return Object.assign({ mes: m, capital: C, saldoDevedor: saldo, valorBem: bem, temBem, patrimonio: pl, patrimonioReal: pl / ctx.deflator(m) }, extra);
  }

  /** Métricas comuns, a partir da série mensal. */
  function metricas(ctx, serie, base) {
    const H = Math.min(ctx.horizonteMeses, serie.length - 1);
    const pos = serie.filter(s => s.mes >= (base.mesCompra === null ? 0 : base.mesCompra));
    let capMin = null;
    pos.forEach(s => { if (capMin === null || s.capital < capMin.capital) capMin = s; });
    const esgota = serie.find(s => s.capital < -0.005);
    const furaReserva = ctx.reservaMinima > 0 && base.mesCompra !== null
      ? serie.find(s => s.mes >= base.mesCompra && s.capital < ctx.reservaMinima - 0.005) : null;
    const h = serie[H];
    // A pergunta central: quanto das parcelas a renda do capital pagou até o horizonte?
    let somaParcelas = 0, rendaUsada = 0, retirado = 0, mesesCobertos = 0, mesesComParcela = 0;
    // Conta todas as parcelas até o horizonte (no consórcio, também as pagas antes da contemplação).
    // Parcela paga no início do mês (consórcio) é comparada com a renda daquele mês, que entra no fim dele.
    serie.forEach(s => {
      if (s.mes > H || !(s.parcela > 0)) return;
      const ref = base.pagamentoAntecipado ? serie[s.mes + 1] : s;
      const r = Math.max(0, ref ? ref.renda : 0);
      somaParcelas += s.parcela; rendaUsada += Math.min(r, s.parcela);
      retirado += Math.max(0, s.parcela - r);
      mesesComParcela++; if (r >= s.parcela - 1e-6) mesesCobertos++;
    });
    return Object.assign(base, {
      periodo: { somaParcelas, rendaUsada, retiradoDoCapital: retirado, mesesComParcela, mesesCobertos,
        cobertura: somaParcelas > 0 ? rendaUsada / somaParcelas : null },
      capitalMinimo: capMin ? capMin.capital : null,
      mesCapitalMinimo: capMin ? capMin.mes : null,
      mesEsgota: esgota ? esgota.mes : null,
      mesAbaixoReserva: furaReserva ? furaReserva.mes : null,
      cobertura: base.parcelaInicial > 0 ? base.rendaInicial / base.parcelaInicial : null,
      horizonte: { mes: H, patrimonio: h.patrimonio, patrimonioReal: h.patrimonioReal, capital: h.capital, saldoDevedor: h.saldoDevedor },
      serie
    });
  }

  /* ---------- financiamento ---------- */
  /*
   * Dois modos:
   *  - 'proposta' (padrão do crédito imobiliário do Sicoob, conferido com a proposta
   *    de 23/10/2026): todo mês o saldo é corrigido pela TR projetada; juros = saldo
   *    corrigido × taxa nominal anual ÷ 12; amortização SAC = saldo corrigido ÷ meses
   *    restantes (Price: parcela recalculada sobre o saldo corrigido); seguro MIP =
   *    % do saldo corrigido pela faixa de idade do proponente; seguro DFI = % do valor
   *    do imóvel, corrigido pela TR; tarifa mensal (TAC) fixa; despesas não
   *    incorporadas saem do capital na contratação.
   *  - 'cet': só o CET informado como taxa de juros, sem TR, seguros ou tarifas à parte.
   * A contratação acontece no mês f.mesInicio (0 = hoje); até lá o capital rende.
   * A 1ª parcela vence um mês depois da contratação.
   */
  function faixaMIP(tabela, idadeAnos) {
    for (let k = 0; k < tabela.length; k++) if (idadeAnos <= tabela[k].idadeAte) return tabela[k].taxa;
    return tabela.length ? tabela[tabela.length - 1].taxa : 0;
  }

  function simularFinanciamento(f, ctx, Hsim) {
    const proposta = f.modo === 'proposta';
    const i = proposta ? f.jurosNominalAnual / 12 : taxaMensal(f.cetAnual);
    const tr = proposta ? (f.trMensal || 0) : 0;
    const n = Math.round(f.prazoMeses);
    const D = Math.max(0, Math.round(f.mesInicio || 0));
    const tac = proposta ? (f.tacMensal || 0) : 0;
    const dfi = proposta ? (f.dfiMensal || 0) : 0;
    const despesas = proposta ? (f.despesasIniciais || 0) : 0;
    const tabMIP = proposta ? (f.tabelaMIP || []) : [];
    const idade0 = proposta && f.idadeMesesHoje >= 0 ? f.idadeMesesHoje : null;

    const conta = novaConta(ctx);
    let saldo = 0, temBem = false, p = 0;
    let rendaMes = 0, entrada = 0, valorImovel = 0;
    const info = { mesCompra: null, desembolsoCompra: 0, capitalAposCompra: null, rendaInicial: 0, parcelaInicial: 0 };
    const fluxos = [];
    let totalParcelas = 0, juros = 0, seguros = 0, tarifas = 0, correcao = 0, parcelaFinal = 0;
    const serie = [];
    for (let t = 0; t <= Hsim; t++) {
      let pago = 0, det = null;
      if (t >= 1) {
        rendaMes = conta.render(t);
        conta.depositar(ctx.aporteMensal);
        if (!temBem) conta.sacar(ctx.custoEsperaMensal);
      }
      if (t > D && p < n && saldo > 1e-9) {
        p += 1;
        // no modo proposta, cada componente é arredondado a centavos, como no contrato
        const cent = v => proposta ? Math.round(v * 100) / 100 : v;
        const cm = cent(saldo * tr);
        const corr = saldo + cm;
        const j = cent(corr * i);
        const rest = n - p + 1;
        let amort = cent(f.sistema === 'PRICE' ? pmt(corr, i, rest) - j : corr / rest);
        if (p === n || amort > corr) amort = corr;
        const mip = idade0 === null ? 0 : cent(corr * faixaMIP(tabMIP, Math.floor((idade0 + t) / 12)));
        const dfiV = cent(valorImovel * dfi * Math.pow(1 + tr, p - 1));
        saldo = corr - amort;
        if (saldo < 1e-6) saldo = 0;
        pago = amort + j + mip + dfiV + tac;
        det = { correcao: cm, amortizacao: amort, juros: j, mip, dfi: dfiV, tac };
        juros += j; seguros += mip + dfiV; tarifas += tac; correcao += cm;
        totalParcelas += pago; parcelaFinal = pago;
        conta.sacar(pago);
        fluxos[t] = (fluxos[t] || 0) - pago;
        if (p === 1) info.parcelaInicial = pago;
      }
      if (t === D) {
        valorImovel = ctx.precoBem(t);
        entrada = valorImovel - f.valorFinanciado; // negativo = sobra de crédito volta ao capital
        saldo = f.valorFinanciado;
        conta.sacar(entrada + despesas);
        temBem = true;
        fluxos[t] = (fluxos[t] || 0) + f.valorFinanciado - despesas;
        info.mesCompra = t;
        info.desembolsoCompra = Math.max(0, entrada) + despesas;
        info.capitalAposCompra = conta.liquido();
        info.rendaInicial = conta.rendaPrevista(t + 1);
      }
      serie.push(novoRegistro(ctx, t, conta.liquido(), saldo, temBem, { renda: t >= 1 ? rendaMes : 0, parcela: pago, detalhe: det }));
    }
    for (let t = 0; t < fluxos.length; t++) if (fluxos[t] === undefined) fluxos[t] = 0;
    const ti = fluxos.length > 1 ? tir(fluxos) : null;
    // se a simulação não alcançou o fim do contrato, o custo efetivo usa o fluxo parcial (aproximação)
    return metricas(ctx, serie, Object.assign(info, {
      id: 'financiamento',
      modo: proposta ? 'proposta' : 'cet',
      irPagoNoPeriodo: conta.irPago,
      parcelaFinal,
      totalPago: totalParcelas + info.desembolsoCompra,
      totalParcelas,
      custoCredito: juros + seguros + tarifas + correcao + despesas,
      juros, seguros, tarifas, correcao, despesas,
      creditoUtil: f.valorFinanciado,
      custoEfetivoAnual: ti === null ? null : taxaAnualDeMensal(ti),
      fimContrato: D + n
    }));
  }

  /* ---------- consórcio ---------- */
  /*
   * Padrão da simulação de lance do Sicoob (Sisbr, 26/10/2026):
   *   - n = número de parcelas que o cooperado paga (prazo de rateio);
   *   - percentual devido P = 100% (fundo comum) + taxa de administração + fundo de reserva,
   *     dividido igualmente pelas n parcelas;
   *   - a parcela nº p vence no início do mês, em t = p − 1 (a 1ª na adesão);
   *   - na assembleia da contemplação (parcela nº k), o lance abate o saldo ANTES da
   *     parcela daquele mês: "reduzir parcela" divide o saldo pelas parcelas k..n;
   *     "reduzir prazo" mantém a parcela e encurta o plano;
   *   - lance embutido sai do crédito; o restante do lance sai do capital;
   *   - seguro: valor da 1ª parcela informado em R$, proporcional ao valor da parcela
   *     (cai junto com ela depois do lance) e reajustado com a carta;
   *   - carta, parcelas e saldo reajustados a cada 12 parcelas pelo índice informado;
   *   - crédito acima do preço do bem abate o saldo devedor; abaixo, a diferença sai do capital.
   */
  function simularConsorcio(c, ctx, Hsim) {
    const n = Math.round(c.prazoMeses);
    const k = Math.round(c.mesContemplacao);
    const P = 1 + c.taxaAdm + c.fundoReserva;
    const fator = p => Math.pow(1 + c.reajusteAnual, Math.floor((Math.max(p, 1) - 1) / 12));
    const carta = p => c.carta * fator(p);
    const pctOrig = P / n;
    const seguroBase = c.seguroValor || 0;
    let pct = P, pctMes = pctOrig;
    const conta = novaConta(ctx);
    let temBem = false, p = 0, rendaMes = 0;
    const info = { mesCompra: null, desembolsoCompra: 0, capitalAposCompra: null, rendaInicial: 0, parcelaInicial: 0 };
    let totalPago = 0, totalSeguro = 0, mesFim = null, credito = 0, lanceProprio = 0, lanceValor = 0, complemento = 0, excedente = 0;
    const fluxos = [], serie = [];
    for (let t = 0; t <= Hsim; t++) {
      if (t >= 1) {
        rendaMes = conta.render(t);
        conta.depositar(ctx.aporteMensal);
        if (!temBem) conta.sacar(ctx.custoEsperaMensal);
      }
      let pago = 0, fluxo = 0, compraAgora = false;
      if (t + 1 === k) {
        // contemplação: o lance abate o saldo antes da parcela desta assembleia
        const cartaP = carta(k);
        const lanceT = Math.min(c.lanceTotal, pct);
        const emb = Math.min(c.lanceEmbutido, lanceT);
        lanceValor = lanceT * cartaP;
        lanceProprio = (lanceT - emb) * cartaP;
        credito = cartaP * (1 - emb);
        pct -= lanceT;
        const preco = ctx.precoBem(t);
        const dif = credito - preco;
        if (dif >= 0) {
          const abate = Math.min(dif / cartaP, pct);
          excedente = abate * cartaP;
          pct -= abate;
          conta.depositar(dif - excedente);
        } else {
          complemento = -dif; conta.sacar(complemento);
        }
        conta.sacar(lanceProprio);
        totalPago += lanceProprio;
        fluxo += credito - lanceProprio;
        if (pct <= 1e-12) { pct = 0; mesFim = t; }
        if (pct > 0) pctMes = c.lanceReduz === 'prazo' ? pctOrig : pct / (n - k + 1);
        temBem = true; compraAgora = true;
      }
      if (pct > 1e-12) {
        p = t + 1;
        const cartaP = carta(p);
        const amort = Math.min(pctMes, pct);
        const seguro = seguroBase * (amort / pctOrig) * fator(p);
        pct -= amort;
        pago = amort * cartaP + seguro;
        totalSeguro += seguro;
        if (pct <= 1e-12) { pct = 0; mesFim = t; }
        conta.sacar(pago); totalPago += pago; fluxo -= pago;
      }
      if (compraAgora) {
        info.mesCompra = t;
        info.desembolsoCompra = lanceProprio + complemento;
        info.parcelaInicial = pago;
        info.capitalAposCompra = conta.liquido();
        info.rendaInicial = conta.rendaPrevista(t + 1);
      }
      if (pago > 0 || compraAgora) fluxos[t] = fluxo;
      serie.push(novoRegistro(ctx, t, conta.liquido(), pct * carta(Math.max(p, 1)), temBem, { renda: t >= 1 ? rendaMes : 0, parcela: pago }));
    }
    for (let t = 0; t < fluxos.length; t++) if (fluxos[t] === undefined) fluxos[t] = 0;
    const ti = fluxos.some(f => f > 0) && fluxos.some(f => f < 0) ? tir(fluxos) : null;
    return metricas(ctx, serie, Object.assign(info, {
      id: 'consorcio',
      pagamentoAntecipado: true,
      parcelaOriginal: pctOrig * c.carta + seguroBase,
      creditoRecebido: credito,
      lanceValor, lanceProprio, complemento, excedenteAbatido: excedente,
      totalPago, totalSeguro,
      custoCredito: totalPago - credito,
      creditoUtil: credito,
      irPagoNoPeriodo: conta.irPago,
      custoEfetivoAnual: ti === null ? null : taxaAnualDeMensal(ti),
      fimContrato: mesFim === null ? n - 1 : mesFim
    }));
  }

  /* ---------- capital próprio ---------- */
  function simularAVista(ctx, Hsim) {
    const conta = novaConta(ctx);
    let temBem = false, rendaMes = 0;
    const info = { mesCompra: null, desembolsoCompra: 0, capitalAposCompra: null, rendaInicial: 0, parcelaInicial: 0, rendaAntesCompra: 0 };
    const comprar = m => {
      const preco = ctx.precoBem(m);
      if (!temBem && m >= ctx.mesCompraAlvo && conta.liquido() >= preco - 1e-6) {
        info.rendaAntesCompra = conta.rendaPrevista(m + 1);
        conta.sacar(preco); temBem = true;
        info.mesCompra = m; info.desembolsoCompra = preco; info.capitalAposCompra = conta.liquido();
        info.rendaInicial = conta.rendaPrevista(m + 1);
      }
    };
    comprar(0);
    const serie = [novoRegistro(ctx, 0, conta.liquido(), 0, temBem, { renda: 0, parcela: 0 })];
    for (let m = 1; m <= Hsim; m++) {
      rendaMes = conta.render(m);
      conta.depositar(ctx.aporteMensal);
      if (!temBem) conta.sacar(ctx.custoEsperaMensal);
      comprar(m);
      serie.push(novoRegistro(ctx, m, conta.liquido(), 0, temBem, { renda: rendaMes, parcela: 0 }));
    }
    return metricas(ctx, serie, Object.assign(info, {
      id: 'avista',
      totalPago: info.desembolsoCompra,
      custoCredito: 0,
      custoEfetivoAnual: null,
      irPagoNoPeriodo: conta.irPago,
      fimContrato: info.mesCompra || 0,
      precoNaCompra: info.desembolsoCompra
    }));
  }

  /* ---------- análise completa ---------- */
  function horizonteSimulacao(e) {
    let H = Math.round(e.horizonteMeses);
    if (e.financiamento && e.financiamento.ativo) H = Math.max(H, Math.round(e.financiamento.prazoMeses) + Math.round(e.financiamento.mesInicio || 0));
    if (e.consorcio && e.consorcio.ativo) H = Math.max(H, Math.round(e.consorcio.prazoMeses));
    return Math.min(MAX_MESES, Math.max(1, H));
  }

  function analisar(e, override) {
    const erros = validar(e);
    if (erros.length) return { ok: false, erros };
    const ctx = contexto(e, override);
    const Hsim = horizonteSimulacao(e);
    const cenarios = {};
    if (e.financiamento && e.financiamento.ativo) cenarios.financiamento = simularFinanciamento(e.financiamento, ctx, Hsim);
    if (e.consorcio && e.consorcio.ativo) cenarios.consorcio = simularConsorcio(e.consorcio, ctx, Hsim);
    if (!e.avista || e.avista.ativo !== false) cenarios.avista = simularAVista(ctx, Hsim);
    // maior patrimônio líquido no horizonte entre os caminhos que compram o bem dentro do horizonte
    let melhor = null;
    Object.keys(cenarios).forEach(id => {
      const c = cenarios[id];
      if (c.mesCompra === null || c.mesCompra > ctx.horizonteMeses) return;
      if (!melhor || c.horizonte.patrimonio > cenarios[melhor].horizonte.patrimonio) melhor = id;
    });
    return { ok: true, erros: [], horizonteMeses: ctx.horizonteMeses, mesesSimulados: Hsim, cenarios, melhor };
  }

  /** Patrimônio líquido no horizonte com uma taxa anual líquida constante. */
  function patrimonioComTaxa(e, taxaAnualLiquida, id, H) {
    const r = analisar(Object.assign({}, e, { horizonteMeses: H || e.horizonteMeses }), { taxaMes: taxaMensal(taxaAnualLiquida), aliquotaIR: 0 });
    if (!r.ok || !r.cenarios[id]) return null;
    return r.cenarios[id].horizonte.patrimonio;
  }

  /**
   * Taxa anual líquida do capital em que os caminhos A e B empatam em patrimônio
   * no horizonte. Acima dela, o caminho que mantém mais capital investido vence.
   * Retorna null se não houver empate entre 0% e 40% a.a.
   */
  function taxaEquilibrio(e, idA, idB, H) {
    const dif = t => patrimonioComTaxa(e, t, idA, H) - patrimonioComTaxa(e, t, idB, H);
    let lo = 0, hi = 0.40;
    let dlo = dif(lo), dhi = dif(hi);
    if (!isFinite(dlo) || !isFinite(dhi) || dlo * dhi > 0) return null;
    for (let k = 0; k < 80; k++) {
      const mid = (lo + hi) / 2, dm = dif(mid);
      if (dlo * dm <= 0) { hi = mid; dhi = dm; } else { lo = mid; dlo = dm; }
    }
    return (lo + hi) / 2;
  }

  /** Patrimônio líquido no horizonte para uma lista de taxas anuais líquidas constantes. */
  function sensibilidade(e, taxasAnuais, H) {
    return taxasAnuais.map(t => {
      const r = analisar(Object.assign({}, e, { horizonteMeses: H || e.horizonteMeses }), { taxaMes: taxaMensal(t), aliquotaIR: 0 });
      const linha = { taxa: t };
      if (r.ok) Object.keys(r.cenarios).forEach(id => {
        const c = r.cenarios[id];
        linha[id] = { patrimonio: c.horizonte.patrimonio, mesEsgota: c.mesEsgota, comprou: c.mesCompra !== null && c.mesCompra <= r.horizonteMeses };
      });
      return linha;
    });
  }

  return {
    MAX_MESES, lanceDeParcelas, novaConta,
    taxaMensal, taxaAnualDeMensal, aliquotaIR, taxaMensalLiquida, pmt, tir,
    validar, analisar, taxaEquilibrio, sensibilidade, patrimonioComTaxa
  };
});
