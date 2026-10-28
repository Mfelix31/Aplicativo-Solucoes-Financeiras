/*
 * Leitura das propostas do Sicoob em PDF — Estratégia de Aquisição de Bens
 * --------------------------------------------------------------
 * Funções puras: recebem as linhas de texto da proposta e devolvem os campos.
 * A extração do texto do PDF (pdf.js, no navegador) fica na página; aqui só
 * há a montagem das linhas a partir dos itens de texto e a interpretação.
 *
 * Formatos reconhecidos (conferidos em 26/10/2026):
 *  - "Relatório da Simulação de Financiamento" (Banco Sicoob, crédito imobiliário)
 *  - "Simulação de lance" (Sisbr 3.0 — Plataforma Sicoob Consórcio)
 * Preencher a partir do PDF é opcional: todos os campos continuam editáveis.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PropostasSicoob = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Monta linhas a partir dos itens de texto do pdf.js ({str, transform, width}), página a página. */
  function linhasDeItens(itensPorPagina) {
    const linhas = [];
    itensPorPagina.forEach(itens => {
      const lista = itens.filter(i => i.str && i.str.trim())
        .map(i => ({ s: i.str.trim(), x: i.transform[4], y: i.transform[5], w: i.width || 0 }))
        .sort((a, b) => b.y - a.y || a.x - b.x);
      const grupos = [];
      lista.forEach(it => {
        const g = grupos.find(g => Math.abs(g.y - it.y) <= 2.5);
        if (g) g.itens.push(it); else grupos.push({ y: it.y, itens: [it] });
      });
      grupos.sort((a, b) => b.y - a.y).forEach(g => {
        g.itens.sort((a, b) => a.x - b.x);
        let txt = '', fim = null;
        g.itens.forEach(it => { if (fim !== null) txt += (it.x - fim > 6 ? '   ' : ' '); txt += it.s; fim = it.x + it.w; });
        linhas.push(txt);
      });
    });
    return linhas;
  }

  /* ---------- números ---------- */
  /** "R$ 1.234,56" → 1234.56 (formato brasileiro) */
  function brl(s) {
    if (s == null) return NaN;
    const m = String(s).replace(/R\$\s*/, '').trim().match(/-?[\d.]*\d(?:,\d+)?/);
    return m ? parseFloat(m[0].replace(/\./g, '').replace(',', '.')) : NaN;
  }
  /** "7,99" ou "1.4085" → número (vírgula ou ponto como decimal, sem milhar) */
  function dec(s) { return s == null ? NaN : parseFloat(String(s).replace(',', '.')); }
  function dataISO(s) { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s || ''); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; }

  /** procura um valor perto de um rótulo: na mesma linha, depois nas seguintes e nas anteriores */
  function perto(linhas, rotulo, valor, janela) {
    janela = janela || 3;
    for (let i = 0; i < linhas.length; i++) {
      const r = rotulo.exec(linhas[i]);
      if (!r) continue;
      const resto = linhas[i].slice(r.index + r[0].length);
      let m = valor.exec(resto);
      if (m) return m;
      for (let d = 1; d <= janela; d++) {
        if (linhas[i + d] && (m = valor.exec(linhas[i + d]))) return m;
        if (linhas[i - d] && (m = valor.exec(linhas[i - d]))) return m;
      }
    }
    return null;
  }

  function identificar(linhas) {
    const t = linhas.join('\n');
    if (/Simula[çc][ãa]o de Financiamento/i.test(t) && /Evolu[çc][ãa]o do Saldo Devedor/i.test(t)) return 'financiamento';
    if (/Sicoob Cons[óo]rcio/i.test(t) || (/Simula[çc][ãa]o de lance/i.test(t) && /Fundo comum/i.test(t))) return 'consorcio';
    return null;
  }

  /* ---------- financiamento ---------- */
  /**
   * opcoes.idadeAnos: idade do 1º proponente na data da proposta, usada quando o PDF
   * não traz a data de nascimento. A data de nascimento, se houver no PDF, só serve
   * para calcular a idade e NÃO é devolvida (o app não guarda dados pessoais).
   */
  function lerFinanciamento(linhas, opcoes) {
    opcoes = opcoes || {};
    const t = linhas.join('\n');
    const out = { tipo: 'financiamento', avisos: [] };
    const m1 = /Valor Financiamento Solicitado:\s+R\$\s*([\d.,]+)/.exec(t);
    out.valorFinanciado = m1 ? brl(m1[1]) : NaN;
    const m2 = /Valor Estimado do Im[óo]vel:\s+R\$\s*([\d.,]+)/.exec(t);
    out.valorImovel = m2 ? brl(m2[1]) : NaN;
    const ms = /Sistema de Amortiza[çc][ãa]o:\s+(.+?)(?:\s{2,}|$)/m.exec(t);
    out.sistema = ms ? (/constante|SAC/i.test(ms[1]) ? 'SAC' : (/price|franc/i.test(ms[1]) ? 'PRICE' : null)) : null;
    const jn = perto(linhas, /Taxa Nominal de Juros/, /([\d]+,\d+)\s*%\s*aa/);
    out.jurosNominalAnual = jn ? dec(jn[1]) / 100 : NaN;
    const cet = perto(linhas, /Custo Efetivo Total/, /([\d]+,\d+)\s*%\s*aa/);
    out.cetAnual = cet ? dec(cet[1]) / 100 : NaN;
    const pz = perto(linhas, /Prazo meses/, /^\s*(\d{1,3})\s*$/);
    const nasc = /Data de Nascimento do 1[ºo°] Proponente:\s+(\d{2}\/\d{2}\/\d{4})/.exec(t);
    const nascimento = nasc ? dataISO(nasc[1]) : '';
    const emissao = /(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}/.exec(t);
    out.dataProposta = emissao ? dataISO(emissao[1]) : '';
    const tac = /TAC\s*:\s+R\$\s*([\d.,]+)/.exec(t.slice(t.search(/1[ºo°] Encargo/) >= 0 ? t.search(/1[ºo°] Encargo/) : 0));
    out.tacMensal = tac ? brl(tac[1]) : NaN;
    // despesas não incorporadas ao financiamento (saem do capital)
    let desp = 0;
    linhas.forEach(l => { const m = /^(.+?)\s+R\$\s*([\d.,]+)\s+(Sim|N[ãa]o)\s*$/i.exec(l); if (m && !/Total/i.test(m[1]) && /n/i.test(m[3][0])) desp += brl(m[2]); });
    out.despesasIniciais = desp;

    // tabela de evolução do saldo devedor
    const rows = [];
    linhas.forEach(l => {
      const m = /^(\d{1,3})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s*$/.exec(l.trim());
      if (m) rows.push({ n: +m[1], correcao: brl(m[2]), amortizacao: brl(m[3]), juros: brl(m[4]), mip: brl(m[5]), dfi: brl(m[6]), tac: brl(m[7]), prestacao: brl(m[8]), saldo: brl(m[9]) });
    });
    rows.sort((a, b) => a.n - b.n);
    out.prazoMeses = pz ? +pz[1] : (rows.length ? rows[rows.length - 1].n : NaN);
    out.parcelas = rows.length;
    if (rows.length && out.valorFinanciado > 0) {
      out.trMensal = rows[0].correcao / out.valorFinanciado;
      if (out.valorImovel > 0) out.dfiMensal = rows[0].dfi / out.valorImovel;
      if (!(out.tacMensal >= 0)) out.tacMensal = rows[0].tac;
      out.primeiraPrestacao = rows[0].prestacao;
      // seguro MIP: taxa sobre o saldo corrigido, por faixa de idade
      const taxas = [];
      let ant = out.valorFinanciado;
      rows.forEach(r => {
        const corr = ant + r.correcao;
        if (corr > 10000) taxas.push({ n: r.n, taxa: Math.round(r.mip / corr * 1e6) / 1e6 });
        ant = r.saldo;
      });
      const segs = [];
      taxas.forEach(x => {
        const ult = segs[segs.length - 1];
        if (!ult || Math.abs(x.taxa - ult.taxa) / Math.max(ult.taxa, 1e-9) > 0.01) segs.push({ inicio: x.n, taxa: x.taxa });
      });
      let idade0 = null;
      if (nascimento && out.dataProposta) {
        const [ya, ma, da] = nascimento.split('-').map(Number);
        const [yp, mp, dp] = out.dataProposta.split('-').map(Number);
        idade0 = (yp - ya) * 12 + (mp - ma); if (dp < da) idade0 -= 1;
      } else if (opcoes.idadeAnos > 0) idade0 = Math.round(opcoes.idadeAnos * 12);
      if (idade0 !== null) {
        out.idadeAnos = Math.floor(idade0 / 12);        // idade em anos completos na data da proposta
        out.idadeMesesExtra = idade0 % 12;              // meses desde o último aniversário (para as faixas do MIP)
        const idade = n => Math.floor((idade0 + n) / 12);
        out.tabelaMIP = segs.map((sg, i) => ({
          idadeAte: i < segs.length - 1 ? idade(segs[i + 1].inicio) - 1 : Math.max(80, idade(rows[rows.length - 1].n)),
          taxa: sg.taxa
        }));
      } else out.avisos.push('O PDF não traz a idade do proponente: a tabela do seguro MIP não foi montada. Informe a idade e importe de novo, ou ajuste a tabela.');
    } else out.avisos.push('Não encontrei a tabela de evolução do saldo devedor.');
    return out;
  }

  /* ---------- consórcio ---------- */
  function lerConsorcio(linhas) {
    const t = linhas.join('\n');
    const out = { tipo: 'consorcio', avisos: [] };
    const vb = perto(linhas, /Valor do Bem/, /R\$\s*([\d.]+,\d{2})/);
    out.valorBem = vb ? brl(vb[1]) : NaN;
    const bem = perto(linhas, /^Bem:/, /^([A-Z0-9][^:]{3,}?)$/, 1);
    out.descricaoBem = bem ? bem[1].trim() : '';
    const g = /(\d+)\s*meses\s+(\d+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+(\d+)\s*meses\s+(SIM|N[ÃA]O)\s+([\d.,]+)/i.exec(t);
    if (g) {
      out.prazoGrupo = +g[1]; out.ofertaMaximaParcelas = +g[2]; out.vencimento = dataISO(g[3]);
      out.participantes = +g[4]; out.prazoRateio = +g[5]; out.taxaAntecipada = /SIM/i.test(g[6]); out.mediaLanceParcelas = dec(g[7]);
    } else out.avisos.push('Não encontrei os detalhes do grupo (prazo de rateio, média de lance).');
    // primeira linha de totais: fundo comum, taxa de administração e fundo de reserva (em % da carta)
    const tot = linhas.map(l => /^Total\s+([\d.,]+)%\s+R\$\s*[\d.,]+\s+([\d.,]+)%\s+R\$\s*[\d.,]+\s+([\d.,]+)%/.exec(l.trim())).find(Boolean);
    if (tot) { out.taxaAdm = dec(tot[2]) / 100; out.fundoReserva = dec(tot[3]) / 100; }
    // seguro: penúltimo valor da primeira linha de parcelas ("1-70 ... R$ 72,78 R$ 2.143,72")
    const p1 = linhas.map(l => /^1-\d+\s+.*R\$\s*([\d.]+,\d{2})\s+R\$\s*([\d.]+,\d{2})\s*$/.exec(l.trim())).find(Boolean);
    if (p1) { out.seguroValor = brl(p1[1]); out.parcelaInicial = brl(p1[2]); }
    const res = /(Reduzir parcela|Reduzir prazo)\s+(\S+)\s+([\d.,]+)\s+(\S+)\s+R\$\s*([\d.,]+)\s+R\$\s*([\d.,]+)/i.exec(t);
    if (res) {
      out.lanceReduz = /prazo/i.test(res[1]) ? 'prazo' : 'parcela';
      out.tipoOferta = res[2];
      out.valorLance = /parcela/i.test(res[2]) ? dec(res[3]) : brl(res[3]);
      out.lanceEm = /parcela/i.test(res[2]) ? 'parcelas' : (/percent|%/i.test(res[2]) ? 'pct' : 'valor');
      out.valorLanceEmbutido = brl(res[5]);
      out.valorCredito = brl(res[6]);
    }
    const ln = perto(linhas, /Valor nominal do lance/, /R\$\s*([\d.]+,\d{2})/);
    out.valorNominalLance = ln ? brl(ln[1]) : NaN;
    const em = perto(linhas, /Data de Emiss[ãa]o/, /(\d{2}\/\d{2}\/\d{4})/);
    out.dataSimulacao = em ? dataISO(em[1]) : '';
    out.carta = out.valorBem;
    if (out.carta > 0) {
      out.lanceEmbutido = (out.valorLanceEmbutido || 0) / out.carta;
      out.lanceTotal = out.valorNominalLance > 0 ? out.valorNominalLance / out.carta : NaN;
    }
    return out;
  }

  function ler(linhas, opcoes) {
    const tipo = identificar(linhas);
    if (tipo === 'financiamento') return lerFinanciamento(linhas, opcoes);
    if (tipo === 'consorcio') return lerConsorcio(linhas);
    return { tipo: null, avisos: ['Este PDF não parece uma simulação de financiamento ou de consórcio do Sicoob.'] };
  }

  return { linhasDeItens, identificar, lerFinanciamento, lerConsorcio, ler, brl, dec };
});
