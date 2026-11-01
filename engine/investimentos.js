/*
 * Motor de cálculo — Simulador e Comparador de Investimentos
 * (LCA, RDC, Operação Compromissada e referências de mercado)
 * --------------------------------------------------------------
 * Funções puras, sem acesso ao DOM. Funcionam no navegador
 * (window.InvestEngine) e no Node (require), para testes.
 *
 * CONVENÇÕES (validadas com o usuário; ver docs/CALCULOS.md)
 * - Rendimento em dias úteis, base 252: fator = (1 + taxa)^(DU/252),
 *   DU = dias úteis de [aplicação, resgate), sem fins de semana e feriados
 *   nacionais (calendário ANBIMA: fixos + móveis pela Páscoa).
 * - IR e IOF por dias corridos entre a aplicação e o resgate.
 * - Prazos em meses e anos convertidos pelas datas do calendário
 *   (12 meses a partir de hoje = 365 ou 366 dias corridos).
 * - LCA: isenta de IR (pessoa física); prazo mínimo de 6 meses (Res. CMN 5.215/2025).
 * - RDC: IR regressivo e IOF regressivo antes de 30 dias.
 * - Operação Compromissada: lastro em crédito privado, sem IOF, IR regressivo.
 * - Taxa: número (% a.a., constante) ou curva por ano
 *   {curva: {ano: CDI % a.a.}, mult: % do CDI / 100, add: p.p. somados}.
 * - Aportes mensais no mesmo dia do mês da aplicação; cada aporte paga IR e
 *   IOF pelo seu próprio prazo até o resgate.
 * - Arredondamento só na apresentação.
 *
 * O calendário depende do dia da aplicação, por isso as contas ficam numa
 * calculadora criada para uma data: InvestEngine.calculadora(new Date()).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InvestEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- parâmetros ---------- */
  const SPREAD_CDI_SELIC = 0.10;          // CDI ≈ Meta Selic − 0,10 p.p.
  const LCA_PRAZO_MINIMO_MESES = 6;       // Resolução CMN nº 5.215/2025
  /** IOF regressivo sobre o rendimento, % por dia corrido (1 a 29); a partir de 30 dias, zero */
  const IOF_TABELA = [96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3];
  const POUPANCA = { selicLimite: 8.5, rendaMensalFixa: 0.005, fatorSelic: 0.7 };
  const TESOURO_CUSTODIA = { taxaAnual: 0.002, isencao: 10000 };   // B3: 0,20% a.a. sobre o que passar de R$ 10 mil

  /** regras de tributação de cada produto do simulador */
  const PRODUTOS = {
    lca: { nome: 'LCA', isentoIR: true, isentoIOF: false },
    rdc: { nome: 'RDC', isentoIR: false, isentoIOF: false },
    compromissada: { nome: 'Operação Compromissada', isentoIR: false, isentoIOF: true }
  };

  /* ---------- tributação ---------- */
  function iofAliquota(dias) {
    if (dias >= 30) return 0;
    const idx = Math.max(1, Math.floor(dias)) - 1;
    return IOF_TABELA[Math.min(idx, IOF_TABELA.length - 1)];
  }
  function irAliquota(dias) {
    if (dias <= 180) return 22.5;
    if (dias <= 360) return 20;
    if (dias <= 720) return 17.5;
    return 15;
  }
  /**
   * Taxa equivalente entre produto isento e tributado no mesmo prazo:
   * isento → quanto um tributado precisa pagar (taxa ÷ (1 − IR));
   * tributado → quanto um isento precisa pagar (taxa × (1 − IR)).
   */
  function taxaEquivalenteIR(taxaAnual, dias, isentoIR) {
    const ir = irAliquota(dias) / 100;
    return isentoIR ? taxaAnual / (1 - ir) : taxaAnual * (1 - ir);
  }

  /* ---------- taxas ---------- */
  /** rentabilidade real: (1 + nominal) ÷ (1 + inflação) − 1, em % */
  function taxaReal(nominalPct, inflacaoPct) {
    return ((1 + nominalPct / 100) / (1 + inflacaoPct / 100) - 1) * 100;
  }
  /** taxa mensal equivalente de uma taxa anual, em % */
  function taxaMensal(anualPct) {
    return (Math.pow(1 + anualPct / 100, 1 / 12) - 1) * 100;
  }
  /** taxa da curva no ano (o último ano informado vale para os seguintes) */
  function taxaNoAno(taxa, ano) {
    if (typeof taxa === 'number') return taxa;
    const anos = Object.keys(taxa.curva).map(Number).sort((a, b) => a - b);
    let v = taxa.curva[anos[0]];
    for (const a of anos) { if (a <= ano) v = taxa.curva[a]; }
    return v * (taxa.mult == null ? 1 : taxa.mult) + (taxa.add || 0);
  }

  /* ---------- calendário ---------- */
  /** domingo de Páscoa (algoritmo de Meeus/Jones/Butcher) */
  function pascoa(ano) {
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(ano, mes - 1, dia);
  }
  const cacheFeriados = {};
  /** feriados nacionais do ano, como conjunto de 'mês-dia' (ex.: '12-25') */
  function feriadosNacionais(ano) {
    if (cacheFeriados[ano]) return cacheFeriados[ano];
    const set = new Set(['1-1', '4-21', '5-1', '9-7', '10-12', '11-2', '11-15', '12-25']);
    if (ano >= 2024) set.add('11-20');   // Dia Nacional de Zumbi e da Consciência Negra (Lei 14.759/2023)
    const p = pascoa(ano);
    [-48, -47, -2, 60].forEach(off => {  // Carnaval (segunda e terça), Sexta-feira Santa, Corpus Christi
      const d = new Date(p.getFullYear(), p.getMonth(), p.getDate() + off);
      set.add((d.getMonth() + 1) + '-' + d.getDate());
    });
    return (cacheFeriados[ano] = set);
  }
  function ehDiaUtil(d) {
    const w = d.getDay();
    if (w === 0 || w === 6) return false;
    return !feriadosNacionais(d.getFullYear()).has((d.getMonth() + 1) + '-' + d.getDate());
  }

  /**
   * Calculadora para uma data de aplicação. Todos os prazos são em dias corridos
   * contados a partir dessa data ("deslocamento" = dias corridos depois de hoje).
   */
  function calculadora(dataReferencia) {
    const ref = dataReferencia || new Date();
    const hoje = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    const acumDU = [0];   // acumDU[n] = dias úteis em [hoje, hoje + n)

    function dataEm(off) { return new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + off); }
    function diasUteisAte(n) {
      n = Math.max(0, Math.round(n));
      while (acumDU.length <= n) {
        const i = acumDU.length - 1;
        acumDU.push(acumDU[i] + (ehDiaUtil(dataEm(i)) ? 1 : 0));
      }
      return acumDU[n];
    }
    function diasUteisEntre(ini, fim) { return diasUteisAte(fim) - diasUteisAte(ini); }
    /** dias corridos até a mesma data n meses depois (dia 31 vira o último dia do mês) */
    function diasAteMesesDepois(n) {
      const dia = hoje.getDate();
      const alvo = new Date(hoje.getFullYear(), hoje.getMonth() + n, 1);
      const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
      alvo.setDate(Math.min(dia, ultimo));
      return Math.round((alvo - hoje) / 864e5);
    }
    function prazoEmDias(valor, unidade) {
      if (unidade === 'dias') return Math.round(valor);
      if (unidade === 'meses') return diasAteMesesDepois(Math.round(valor));
      return diasAteMesesDepois(Math.round(valor * 12));
    }
    /** meses completos (aniversários) dentro do prazo */
    function mesesCompletos(dias) {
      let k = 0;
      while (diasAteMesesDepois(k + 1) <= dias) k++;
      return k;
    }
    /** deslocamentos (dias corridos) dos aportes mensais dentro do prazo */
    function datasAportes(diasTotal) {
      const datas = [];
      for (let k = 1; ; k++) {
        const off = diasAteMesesDepois(k);
        if (off > diasTotal) break;
        datas.push(off);
      }
      return datas;
    }
    /** ano civil em que termina um prazo de n dias corridos */
    function anoDoDia(off) { return dataEm(off).getFullYear(); }

    /** fator de rendimento entre dois deslocamentos: Π (1 + taxa_ano)^(DU_ano/252) */
    function fatorRend(taxa, ini, fim) {
      if (typeof taxa === 'number') return Math.pow(1 + taxa / 100, diasUteisEntre(ini, fim) / 252);
      let f = 1, c = ini;
      while (c < fim) {
        const ano = dataEm(c).getFullYear();
        const inicioProxAno = Math.round((new Date(ano + 1, 0, 1) - hoje) / 864e5);
        const seg = Math.min(fim, inicioProxAno);
        f *= Math.pow(1 + taxaNoAno(taxa, ano) / 100, diasUteisEntre(c, seg) / 252);
        c = seg;
      }
      return f;
    }
    /** taxa anual equivalente (base 252) de uma taxa constante ou curva, num intervalo */
    function taxaEquivalente(taxa, dias, ini) {
      if (typeof taxa === 'number') return taxa;
      const i = Math.round(ini || 0), du = diasUteisEntre(i, i + Math.round(dias));
      return du > 0 ? (Math.pow(fatorRend(taxa, i, i + Math.round(dias)), 252 / du) - 1) * 100 : taxaNoAno(taxa, hoje.getFullYear());
    }

    /**
     * Uma aplicação: pv aplicado no deslocamento ini e resgatado dias corridos depois.
     * IOF sobre o rendimento; IR sobre o rendimento depois do IOF.
     */
    function simular(pv, taxa, dias, isentoIR, isentoIOF, inicioOffset) {
      const ini = Math.round(inicioOffset || 0);
      const du = diasUteisEntre(ini, ini + Math.round(dias));
      const fv = pv * fatorRend(taxa, ini, ini + Math.round(dias));
      const bruto = fv - pv;

      const aliqIOF = isentoIOF ? 0 : iofAliquota(dias);
      const iofValor = bruto * (aliqIOF / 100);
      const aposIOF = bruto - iofValor;

      const aliqIR = isentoIR ? 0 : irAliquota(dias);
      const irValor = aposIOF * (aliqIR / 100);
      const liquido = aposIOF - irValor;

      const valorFinal = pv + liquido;
      const pPeriodo = (liquido / pv) * 100;
      const taxaAnualLiquida = du > 0 ? (Math.pow(valorFinal / pv, 252 / du) - 1) * 100 : 0;

      return {
        bruto, pBrutoAnual: taxaEquivalente(taxa, dias, ini), iofValor, aliqIOF, isentoIOF: !!isentoIOF,
        irValor, aliqIR, liquido, valorFinal, pPeriodo, panual: taxaAnualLiquida, pmensal: taxaMensal(taxaAnualLiquida),
        du, dc: Math.round(dias)
      };
    }

    /**
     * Aplicação inicial + aportes mensais, resgate único no fim do prazo.
     * Cada aporte é tributado pelo próprio prazo. Aporte no dia do resgate entra sem render.
     */
    function simularComAportes(pv, aporte, taxa, dias, isentoIR, isentoIOF) {
      const inicial = simular(pv, taxa, dias, isentoIR, isentoIOF);
      let bruto = inicial.bruto, iof = inicial.iofValor, ir = inicial.irValor, liquido = inicial.liquido;
      let capital = pv, nAportes = 0;
      if (aporte > 0) {
        const datas = datasAportes(dias);
        nAportes = datas.length;
        for (const off of datas) {
          capital += aporte;
          if (dias - off <= 0) continue;
          const r = simular(aporte, taxa, dias - off, isentoIR, isentoIOF, off);
          bruto += r.bruto; iof += r.iofValor; ir += r.irValor; liquido += r.liquido;
        }
      }
      const valorFinal = capital + liquido;
      const du = inicial.du;
      const panual = du > 0 && capital > 0 ? (Math.pow(valorFinal / capital, 252 / du) - 1) * 100 : 0;
      return {
        inicial, nAportes, capital, bruto, iofValor: iof, irValor: ir, liquido, valorFinal,
        pPeriodo: capital > 0 ? (liquido / capital) * 100 : 0, panual, pmensal: taxaMensal(panual), du
      };
    }

    /** valor líquido se resgatado em cada momento do prazo (para o gráfico) */
    function evolucao(pv, aporte, taxa, diasTotal, isentoIR, isentoIOF) {
      const datas = aporte > 0 ? datasAportes(diasTotal) : [];
      const nPontos = Math.min(24, Math.max(6, Math.round(diasTotal / 15)));
      const pontos = [];
      for (let i = 0; i <= nPontos; i++) {
        const dia = Math.round((diasTotal * i) / nPontos);
        let liquido = 0, capital = pv;
        if (dia > 0) liquido += simular(pv, taxa, dia, isentoIR, isentoIOF).liquido;
        for (const off of datas) {
          if (off > dia) break;
          capital += aporte;
          if (dia - off > 0) liquido += simular(aporte, taxa, dia - off, isentoIR, isentoIOF, off).liquido;
        }
        pontos.push({ dia, valor: capital + liquido });
      }
      return pontos;
    }

    /* ---------- referências de mercado ---------- */
    function lotesAplicacao(pv, aporte, dias) {
      const lotes = [{ off: 0, v: pv }];
      if (aporte > 0) datasAportes(dias).forEach(o => lotes.push({ off: o, v: aporte }));
      return lotes;
    }
    function liquidoLotes(lotes, taxa, dias, isentoIR, isentoIOF) {
      let liq = 0;
      lotes.forEach(l => { if (dias - l.off > 0) liq += simular(l.v, taxa, dias - l.off, isentoIR, isentoIOF, l.off).liquido; });
      return liq;
    }
    /**
     * Taxa interna de retorno anual (base 252) dos lotes até o valor final vf:
     * considera quanto tempo cada aporte ficou aplicado. Bissecção entre −99% e 500% a.a.
     */
    function tirAnual(lotes, dias, vf) {
      const capital = lotes.reduce((a, l) => a + l.v, 0);
      if (!(capital > 0) || !(diasUteisEntre(0, dias) > 0)) return 0;
      const fluxos = lotes.map(l => ({ v: l.v, du: diasUteisEntre(l.off, dias) }));
      const total = r => fluxos.reduce((a, f) => a + f.v * Math.pow(1 + r, f.du / 252), 0);
      let lo = -0.99, hi = 5;
      for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (total(m) > vf) hi = m; else lo = m; }
      return ((lo + hi) / 2) * 100;
    }
    /**
     * Mesmo valor, prazo e aportes em poupança, CDB e Tesouro Selic.
     * p = {pv, aporte, dias, cdi (% a.a.), trMensal (% a.m.), percCdb (% do CDI), taxaCdb (número ou curva)}
     */
    function referencias(p) {
      const lotes = lotesAplicacao(p.pv, p.aporte, p.dias);
      const capital = lotes.reduce((a, l) => a + l.v, 0);
      const selic = p.cdi + SPREAD_CDI_SELIC;

      // Poupança: rende só a cada mês completo (aniversário); isenta de IR
      const tr = (p.trMensal || 0) / 100;
      const rBase = selic > POUPANCA.selicLimite ? POUPANCA.rendaMensalFixa : Math.pow(1 + POUPANCA.fatorSelic * selic / 100, 1 / 12) - 1;
      const rMes = (1 + rBase) * (1 + tr) - 1;
      const meses = mesesCompletos(p.dias);
      let vfPoupanca = 0;
      lotes.forEach((l, i) => { vfPoupanca += l.v * Math.pow(1 + rMes, Math.max(0, meses - i)); });

      // CDB: % do CDI, com IR e IOF
      const taxaCdb = p.taxaCdb != null ? p.taxaCdb : p.cdi * (p.percCdb || 0) / 100;
      const vfCdb = capital + liquidoLotes(lotes, taxaCdb, p.dias, false, false);

      // Tesouro Selic: Selic = CDI + 0,10 p.p.; IR, IOF e custódia estimada mês a mês
      const taxaSelic = typeof taxaCdb === 'number' ? selic : { curva: taxaCdb.curva, mult: 1, add: SPREAD_CDI_SELIC };
      let custodia = 0, ant = 0;
      for (let k = 1; ant < p.dias; k++) {
        const o = Math.min(p.dias, diasAteMesesDepois(k));
        let saldo = 0;
        lotes.forEach(l => { if (l.off < o) saldo += l.v * fatorRend(taxaSelic, l.off, o); });
        custodia += TESOURO_CUSTODIA.taxaAnual * Math.max(0, saldo - TESOURO_CUSTODIA.isencao) * ((o - ant) / 365);
        ant = o;
      }
      const vfTesouro = capital + liquidoLotes(lotes, taxaSelic, p.dias, false, false) - custodia;

      return {
        lotes, capital, meses,
        poupanca: { taxaMensal: rMes * 100, vf: vfPoupanca },
        cdb: { taxa: taxaCdb, vf: vfCdb },
        tesouroSelic: { taxa: taxaSelic, taxaEquivalente: taxaEquivalente(taxaSelic, p.dias), custodia, vf: vfTesouro },
        tir: vf => tirAnual(lotes, p.dias, vf)
      };
    }

    return {
      hoje, dataEm, anoDoDia,
      diasUteisAte, diasUteisEntre, diasAteMesesDepois, prazoEmDias, mesesCompletos, datasAportes,
      fatorRend, taxaEquivalente, simular, simularComAportes, evolucao,
      lotesAplicacao, liquidoLotes, tirAnual, referencias
    };
  }

  return {
    SPREAD_CDI_SELIC, LCA_PRAZO_MINIMO_MESES, IOF_TABELA, POUPANCA, TESOURO_CUSTODIA, PRODUTOS,
    iofAliquota, irAliquota, taxaEquivalenteIR, taxaReal, taxaMensal, taxaNoAno,
    pascoa, feriadosNacionais, ehDiaUtil, calculadora
  };
});
