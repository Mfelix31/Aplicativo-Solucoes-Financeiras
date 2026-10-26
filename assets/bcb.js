/*
 * Consultas ao Banco Central do Brasil — compartilhado pelas páginas.
 * Só busca e valida os dados; o texto mostrado ao usuário fica em cada página.
 *  - Meta Selic definida pelo Copom: SGS 432 (o CDI é estimado em Selic − 0,10 p.p.)
 *  - IPCA acumulado em 12 meses: SGS 13522
 *  - Expectativa de Selic de fim de ano: Boletim Focus (API Olinda), mediana mais recente
 * Cada função lança erro se a rede falhar ou o formato vier inesperado.
 */
(function () {
  'use strict';
  const SPREAD_CDI_SELIC = 0.10; // p.p. entre o CDI e a Meta Selic
  async function sgsUltimo(serie) {
    const resp = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.' + serie + '/dados/ultimos/1?formato=json');
    if (!resp.ok) throw new Error('resposta não OK');
    const data = await resp.json();
    if (!data || !data[0] || !data[0].valor) throw new Error('formato inesperado');
    const valor = parseFloat(String(data[0].valor).replace(',', '.'));
    if (!isFinite(valor)) throw new Error('valor inválido');
    return { valor, data: data[0].data };
  }
  /** {metaSelic, cdi, data} em % a.a. */
  async function metaSelic() {
    const r = await sgsUltimo(432);
    if (!(r.valor > 0)) throw new Error('valor inválido');
    return { metaSelic: r.valor, cdi: r.valor - SPREAD_CDI_SELIC, data: r.data };
  }
  /** {valor, data, mesRef} — IPCA acumulado em 12 meses, em % */
  async function ipca12m() {
    const r = await sgsUltimo(13522);
    const p = String(r.data).split('/');
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return { valor: r.valor, data: r.data, mesRef: p.length === 3 ? meses[parseInt(p[1], 10) - 1] + '/' + p[2] : r.data };
  }
  /** {data, porAno: {ano: Selic esperada %}} — anos a partir de `anoMinimo` (inclusive) */
  async function focusSelic(anoMinimo) {
    const url = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais" +
      "?$top=60&$filter=Indicador%20eq%20'Selic'&$orderby=Data%20desc&$format=json&$select=Indicador,Data,DataReferencia,Mediana,baseCalculo";
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('resposta não OK');
    const json = await resp.json();
    const linhas = ((json && json.value) || []).filter(l => l.baseCalculo == null || l.baseCalculo === 0);
    if (!linhas.length) throw new Error('sem dados');
    const data = linhas[0].Data, porAno = {};
    linhas.filter(l => l.Data === data).forEach(l => {
      const a = parseInt(l.DataReferencia, 10), v = parseFloat(l.Mediana);
      if (a >= anoMinimo && v > 0 && v < 60) porAno[a] = v;
    });
    if (!Object.keys(porAno).length) throw new Error('sem anos futuros');
    return { data, porAno };
  }
  window.BCB = { SPREAD_CDI_SELIC, metaSelic, ipca12m, focusSelic };
})();
