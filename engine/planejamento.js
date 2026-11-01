/*
 * Motor de cálculo — Planejamento Financeiro
 * --------------------------------------------------------------
 * Funções puras, sem acesso ao DOM. Funcionam no navegador
 * (window.PlanEngine) e no Node (require), para testes.
 *
 * CONVENÇÕES (documentadas e validadas com o usuário em 16/10/2026)
 * - Base de projeção: ano de 360 dias = 12 meses de 30 dias (decisão do usuário).
 *   Capitalização mensal com taxa equivalente: i_m = (1 + i_a)^(1/12) − 1.
 *   (O módulo de comparação de ativos usa dias úteis/252 — ver investimentos.)
 * - Aportes e retiradas no FIM de cada mês (igual ao FV/PMT do Excel com tipo 0).
 * - Rentabilidade da acumulação: taxa NOMINAL anual, bruta (antes de IR).
 * - Aporte mensal: valor NOMINAL fixo, sem reajuste (padrão). Opcional
 *   (reajusteAporte): reajustado pela inflação uma vez por ano, como a linha
 *   "Correção Monetária" da aba Cenários da planilha:
 *       aporte do mês t = aporte × (1 + inflação)^⌊(t − 1) / 12⌋
 * - Entradas extraordinárias (venda de terra, sobra da safra, herança…):
 *   valor informado em R$ de hoje, corrigido pela inflação até a data e somado
 *   ao patrimônio no mês; podem se repetir (a cada N anos) até o início da renda.
 *   No mesmo mês, as entradas chegam antes dos objetivos.
 * - Inflação: média anual fixa durante todo o período (premissa ajustável).
 * - Meta (patrimônio necessário) em R$ de hoje:
 *       renda mensal desejada ÷ taxa real mensal equivalente
 *   onde a taxa real é IPCA + spread (padrão 5,16% a.a., bruto).
 *   Equivale a uma perpetuidade real: o patrimônio paga a renda
 *   corrigida pela inflação sem perder poder de compra.
 * - Comparação patrimônio × meta (metodologia do usuário, padrão 'nominal'):
 *   o patrimônio projetado (valor futuro nominal) é comparado diretamente
 *   com o patrimônio necessário (renda ÷ taxa real mensal), como na planilha
 *   (colunas H, I, J, K da aba Planejamento). A opção baseComparacao: 'real'
 *   compara em R$ de hoje: real_t = nominal_t ÷ (1 + inflação)^(t/12).
 * - Objetivos (carro, imóvel...): valor informado em R$ de hoje, corrigido
 *   pela inflação até a data. Só é retirado do patrimônio se o patrimônio
 *   naquele mês cobrir o valor; caso contrário fica marcado como "não atingido"
 *   e nada é retirado. Recorrências (a cada N anos) se repetem até o início
 *   da renda.
 * - Arredondamento só na apresentação.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlanEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- taxas ---------- */
  function taxaMensal(taxaAnual) {
    return Math.pow(1 + taxaAnual, 1 / 12) - 1;
  }
  function taxaRealDeNominal(nominalAnual, inflacaoAnual) {
    return (1 + nominalAnual) / (1 + inflacaoAnual) - 1;
  }
  function nominalDeReal(realAnual, inflacaoAnual) {
    return (1 + realAnual) * (1 + inflacaoAnual) - 1;
  }
  /** fator de inflação acumulada após `meses` */
  function fatorInflacao(inflacaoAnual, meses) {
    return Math.pow(1 + inflacaoAnual, meses / 12);
  }

  /* ---------- meta patrimonial ---------- */
  /**
   * Patrimônio necessário (R$ de hoje) para pagar `rendaMensal` (R$ de hoje)
   * para sempre, corrigida pela inflação, com taxa real `taxaRealAnual`.
   * Retorna Infinity se a taxa real for ≤ 0 (perpetuidade impossível).
   */
  function patrimonioNecessario(rendaMensal, taxaRealAnual) {
    const r = taxaMensal(taxaRealAnual);
    if (!(r > 0)) return Infinity;
    return rendaMensal / r;
  }

  /* ---------- objetivos ---------- */
  /**
   * Expande os objetivos em ocorrências mensais.
   * objetivo: { id, nome, tipo, valorHoje, mes (1 = próximo mês), recorrenciaAnos (0 = única) }
   * Ocorrências após `limiteMes` são descartadas.
   */
  function ocorrenciasObjetivos(objetivos, limiteMes) {
    const lista = [];
    (objetivos || []).forEach(function (o) {
      if (!(o && o.valorHoje > 0 && o.mes >= 1)) return;
      const passo = o.recorrenciaAnos > 0 ? Math.round(o.recorrenciaAnos * 12) : 0;
      let m = Math.round(o.mes);
      let n = 1;
      while (m <= limiteMes) {
        lista.push({ id: o.id, nome: o.nome, tipo: o.tipo, ocorrencia: n, mes: m, valorHoje: o.valorHoje });
        if (!passo) break;
        m += passo;
        n++;
      }
    });
    lista.sort(function (a, b) { return a.mes - b.mes; });
    return lista;
  }

  /* ---------- aporte do mês ---------- */
  /** aporte do mês t (1 = primeiro): fixo, ou reajustado pela inflação uma vez por ano */
  function aporteDoMes(aporteMensal, t, inflacaoAnual, reajusteAporte) {
    if (!reajusteAporte) return aporteMensal;
    return aporteMensal * Math.pow(1 + inflacaoAnual, Math.floor((t - 1) / 12));
  }

  /* ---------- simulação mês a mês ---------- */
  /**
   * p = { patrimonioInicial, aporteMensal, rentabNominalAnual, inflacaoAnual,
   *       meses, objetivos, entradas, reajusteAporte,
   *       mesesObjetivos (limite das ocorrências de objetivos e entradas; padrão = meses) }
   * Retorna { serie: [{mes, nominal, real}], eventos: [...], entradas: [...], final: {nominal, real} }
   * serie[0] é o mês 0 (hoje).
   */
  function simular(p) {
    const rm = taxaMensal(p.rentabNominalAnual);
    const meses = Math.max(0, Math.round(p.meses));
    const limiteObj = p.mesesObjetivos == null ? meses : Math.min(meses, p.mesesObjetivos);
    const ocorr = ocorrenciasObjetivos(p.objetivos, limiteObj);
    const ocorrEnt = ocorrenciasObjetivos(p.entradas, limiteObj);
    let idx = 0, idxEnt = 0;
    let P = p.patrimonioInicial;
    const serie = [{ mes: 0, nominal: P, real: P }];
    const eventos = [];
    const entradas = [];
    for (let t = 1; t <= meses; t++) {
      P = P * (1 + rm) + aporteDoMes(p.aporteMensal, t, p.inflacaoAnual, p.reajusteAporte);
      while (idxEnt < ocorrEnt.length && ocorrEnt[idxEnt].mes === t) {
        const en = ocorrEnt[idxEnt++];
        const valorNominal = en.valorHoje * fatorInflacao(p.inflacaoAnual, t);
        P += valorNominal;
        entradas.push({ id: en.id, nome: en.nome, tipo: en.tipo, ocorrencia: en.ocorrencia, mes: t,
          valorHoje: en.valorHoje, valorNominal: valorNominal });
      }
      while (idx < ocorr.length && ocorr[idx].mes === t) {
        const oc = ocorr[idx++];
        const fator = fatorInflacao(p.inflacaoAnual, t);
        const valorNominal = oc.valorHoje * fator;
        const atingido = P >= valorNominal;
        eventos.push({
          id: oc.id, nome: oc.nome, tipo: oc.tipo, ocorrencia: oc.ocorrencia, mes: t,
          valorHoje: oc.valorHoje, valorNominal: valorNominal,
          patrimonioNominalAntes: P, patrimonioRealAntes: P / fator, atingido: atingido
        });
        if (atingido) P -= valorNominal;
      }
      serie.push({ mes: t, nominal: P, real: P / fatorInflacao(p.inflacaoAnual, t) });
    }
    const last = serie[serie.length - 1];
    return { serie: serie, eventos: eventos, entradas: entradas, final: { nominal: last.nominal, real: last.real } };
  }

  /* ---------- planejamento de um cenário ---------- */
  /**
   * p = { patrimonioInicial, aporteMensal, rentabNominalAnual, inflacaoAnual,
   *       objetivos, anosParaRenda, metaHoje, mesesMaximo }
   * - mesesMaximo: até quando procurar a liberdade (ex.: até 100 anos de idade).
   * Retorna projeção na data da renda, lacuna, mês em que atinge a meta
   * (ou null) e aporte necessário (ou null se impossível).
   */
  function planejarCenario(p) {
    const base = p.baseComparacao === 'real' ? 'real' : 'nominal';
    const N = Math.max(1, Math.round(p.anosParaRenda * 12));
    const mesesMax = Math.max(N, Math.round(p.mesesMaximo || N));
    const params = {
      patrimonioInicial: p.patrimonioInicial,
      aporteMensal: p.aporteMensal,
      rentabNominalAnual: p.rentabNominalAnual,
      inflacaoAnual: p.inflacaoAnual,
      objetivos: p.objetivos,
      entradas: p.entradas,
      reajusteAporte: !!p.reajusteAporte,
      mesesObjetivos: N
    };
    // simulação longa: mesmos aportes depois de N, sem novos objetivos após o início da renda
    const longa = simular(Object.assign({}, params, { meses: mesesMax }));
    const naData = longa.serie[N];
    let mesLiberdade = null;
    if (isFinite(p.metaHoje)) {
      for (let t = 0; t < longa.serie.length; t++) {
        if (longa.serie[t][base] >= p.metaHoje) { mesLiberdade = t; break; }
      }
    }
    const valorComparado = naData[base];
    const atinge = isFinite(p.metaHoje) && valorComparado >= p.metaHoje;
    return {
      mesesAteRenda: N,
      projetadoNominal: naData.nominal,
      projetadoReal: naData.real,
      metaHoje: p.metaHoje,
      metaNominal: p.metaHoje * fatorInflacao(p.inflacaoAnual, N),
      baseComparacao: base,
      lacuna: Math.max(0, p.metaHoje - valorComparado),
      excedente: Math.max(0, valorComparado - p.metaHoje),
      atinge: atinge,
      mesLiberdade: mesLiberdade,
      aporteNecessario: aporteNecessario(Object.assign({}, params, { meses: N }), p.metaHoje, base),
      serie: longa.serie,
      eventos: longa.eventos.filter(function (e) { return e.mes <= N; }),
      entradas: longa.entradas.filter(function (e) { return e.mes <= N; })
    };
  }

  /**
   * Menor aporte mensal (o do 1º ano, se reajusteAporte) que leva o patrimônio no mês `meses`
   * a ≥ meta (base 'nominal' = valor futuro, padrão; 'real' = R$ de hoje),
   * respeitando as regras dos objetivos.
   * Retorna 0 se a meta já é atingida sem aporte; null se for impossível
   * (meta infinita ou exigiria mais de R$ 100 milhões/mês).
   */
  function aporteNecessario(p, metaHoje, baseComparacao) {
    if (!isFinite(metaHoje)) return null;
    const base = baseComparacao === 'real' ? 'real' : 'nominal';
    const ok = function (a) {
      return simular(Object.assign({}, p, { aporteMensal: a })).final[base] >= metaHoje;
    };
    if (ok(0)) return 0;
    let hi = 1000;
    while (!ok(hi)) {
      hi *= 2;
      if (hi > 1e8) return null;
    }
    let lo = 0;
    for (let k = 0; k < 60; k++) {
      const mid = (lo + hi) / 2;
      if (ok(mid)) hi = mid; else lo = mid;
    }
    return hi;
  }

  /* ---------- fase de utilização: curvas de consumo (modelo da planilha) ---------- */
  /**
   * Modelo definido pelo usuário (aba "Renda Desejada"): a cada ano a carteira
   * rende `rentabNominalAnual` e a pessoa consome `taxaConsumo` do patrimônio
   * do início do ano. Base anual (ano de 360 dias / 12 meses de 30).
   *     P(k+1) = P(k) × (1 + rentabilidade − consumo)
   *     real(k) = P(k) ÷ (1 + inflação)^k
   * Variação real anual = (1 + rentabilidade − consumo) ÷ (1 + inflação) − 1
   *   > 0  acúmulo (consome menos que o ganho real)
   *   = 0  perpetuidade (consome exatamente o ganho real)
   *   < 0  deterioração (consome também a parte que repõe a inflação)
   * p = { patrimonioInicial, rentabNominalAnual, inflacaoAnual, taxasConsumo: [..], anos }
   */
  function curvasConsumo(p) {
    const anos = Math.max(1, Math.round(p.anos));
    return (p.taxasConsumo || []).map(function (c) {
      const fatorAno = 1 + p.rentabNominalAnual - c;
      const variacaoReal = fatorAno / (1 + p.inflacaoAnual) - 1;
      const serie = [];
      let P = p.patrimonioInicial;
      for (let k = 0; k <= anos; k++) {
        const infl = Math.pow(1 + p.inflacaoAnual, k);
        const retiradaAno = Math.max(0, P) * c;
        serie.push({
          ano: k, nominal: P, real: P / infl,
          retiradaMensalNominal: retiradaAno / 12, retiradaMensalReal: retiradaAno / 12 / infl
        });
        P = Math.max(0, P * fatorAno);
      }
      const tol = 1e-9;
      return {
        taxaConsumo: c,
        variacaoNominal: fatorAno - 1,
        variacaoReal: variacaoReal,
        tipo: variacaoReal > tol ? 'acumulo' : (variacaoReal < -tol ? 'deterioracao' : 'perpetuidade'),
        serie: serie
      };
    });
  }

  /* ---------- renda que um patrimônio gera (fase de usufruto) ----------
   * Taxa real mensal equivalente: i = (1 + real anual)^(1/12) − 1 (mesma da meta).
   * A) Perpétua: saca só o ganho real → renda = P × i (o principal é preservado
   *    em poder de compra). É o inverso exato do patrimônio necessário.
   * B) Com consumo do capital por n meses (anuidade, saque no fim do mês):
   *    renda = P × i × (1+i)^n / ((1+i)^n − 1)  — equivale ao PMT do Excel.
   *    Com i = 0: renda = P / n. A renda é em poder de compra constante. */
  function rendaPerpetua(patrimonio, taxaRealAnual) {
    const i = taxaMensal(taxaRealAnual);
    return patrimonio > 0 && i > 0 ? patrimonio * i : 0;
  }
  function rendaComConsumo(patrimonio, taxaRealAnual, meses) {
    const n = Math.round(meses);
    if (!(patrimonio > 0) || !(n > 0)) return 0;
    const i = taxaMensal(taxaRealAnual);
    if (Math.abs(i) < 1e-12) return patrimonio / n;
    const f = Math.pow(1 + i, n);
    return patrimonio * i * f / (f - 1);
  }

  /* ---------- aportar mais ou render mais? ---------- */
  /**
   * Compara dois planos de aporte que partem do zero, no mesmo prazo e com a
   * mesma inflação: a = { aporteMensal, rentabNominalAnual }, b = idem;
   * comum = { meses, inflacaoAnual, reajusteAporte }.
   * Retorna o final de cada um (nominal e em R$ de hoje), quantas vezes o maior
   * supera o menor e a rentabilidade anual que o plano menor precisaria para
   * empatar com o maior (null se passar de 200% a.a.).
   */
  function compararAportes(a, b, comum) {
    const rodar = function (x, taxa) {
      return simular({ patrimonioInicial: 0, aporteMensal: x.aporteMensal, rentabNominalAnual: taxa,
        inflacaoAnual: comum.inflacaoAnual, reajusteAporte: comum.reajusteAporte, meses: comum.meses }).final;
    };
    const fa = rodar(a, a.rentabNominalAnual), fb = rodar(b, b.rentabNominalAnual);
    const maior = fa.nominal >= fb.nominal ? 'a' : 'b';
    const menor = maior === 'a' ? b : a;
    const alvo = maior === 'a' ? fa.nominal : fb.nominal;
    let taxaEmpate = null;
    if (menor.aporteMensal > 0 && rodar(menor, 2).nominal >= alvo) {
      let lo = -0.5, hi = 2;
      for (let k = 0; k < 80; k++) {
        const mid = (lo + hi) / 2;
        if (rodar(menor, mid).nominal >= alvo) hi = mid; else lo = mid;
      }
      taxaEmpate = hi;
    }
    const menorFinal = maior === 'a' ? fb.nominal : fa.nominal;
    return {
      a: fa, b: fb, maior: maior,
      vezes: menorFinal > 0 ? alvo / menorFinal : null,
      taxaEmpate: taxaEmpate
    };
  }

  /* ---------- utilidades de data ---------- */
  /** meses entre (anoRef, mesRef) e "AAAA-MM"; 1 = mês seguinte */
  function mesesAteData(aaaaMm, hoje) {
    const m = /^(\d{4})-(\d{2})$/.exec(aaaaMm || '');
    if (!m) return null;
    const ref = hoje || new Date();
    return (parseInt(m[1], 10) - ref.getFullYear()) * 12 + (parseInt(m[2], 10) - (ref.getMonth() + 1));
  }

  return {
    taxaMensal: taxaMensal,
    taxaRealDeNominal: taxaRealDeNominal,
    nominalDeReal: nominalDeReal,
    fatorInflacao: fatorInflacao,
    patrimonioNecessario: patrimonioNecessario,
    ocorrenciasObjetivos: ocorrenciasObjetivos,
    simular: simular,
    planejarCenario: planejarCenario,
    aporteNecessario: aporteNecessario,
    curvasConsumo: curvasConsumo,
    rendaPerpetua: rendaPerpetua,
    aporteDoMes: aporteDoMes,
    compararAportes: compararAportes,
    rendaComConsumo: rendaComConsumo,
    mesesAteData: mesesAteData
  };
});
