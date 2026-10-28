#!/usr/bin/env node
/*
 * Atualiza dados/ibovespa.json com o fechamento do Ibovespa publicado pela B3.
 * Roda no GitHub Actions (.github/workflows/ibovespa.yml) depois do pregão; não roda no navegador.
 *
 * Fonte: estatísticas históricas do índice no site da B3
 *   (página "Índice Ibovespa – Historic statistics"), que lê
 *   https://sistemaswebb3-listados.b3.com.br/indexStatisticsProxy/IndexCall/GetPortfolioDay/<base64 {"language","index","year"}>
 *   e devolve, por ano, uma linha por dia com uma coluna por mês (rateValue1..rateValue12), em pontos.
 * Não é uma API documentada pela B3: se o formato mudar, o script falha, NÃO grava nada,
 * e o painel continua mostrando o último fechamento válido com a data dele.
 *
 * Uso: node scripts/atualizar-ibovespa.js   (código 0 = ok ou sem mudança; 1 = falha)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ARQUIVO = path.join(__dirname, '..', 'dados', 'ibovespa.json');
const BASE = 'https://sistemaswebb3-listados.b3.com.br/indexStatisticsProxy/IndexCall/GetPortfolioDay/';
const PAGINA = 'https://b3.com.br/en_us/market-data-and-indices/indices/broad-indices/indice-ibovespa-ibovespa-historic-statistics.htm';
const FAIXA = [10000, 1000000]; // pontos plausíveis para o Ibovespa

const urlDoAno = ano => BASE + Buffer.from(JSON.stringify({ language: 'en-us', index: 'IBOV', year: ano })).toString('base64');

/** "112,143.51" (padrão en-us) → 112143.51; null/vazio → null */
function numero(txt) {
  if (txt === null || txt === undefined || txt === '') return null;
  const n = parseFloat(String(txt).replace(/,/g, ''));
  return isFinite(n) ? n : NaN;
}

/** resposta de um ano → [{data:'aaaa-mm-dd', valor}] em ordem de data; lança erro se o formato não for o esperado */
function lerAno(json, ano) {
  if (!json || !Array.isArray(json.results)) throw new Error('formato inesperado: sem "results"');
  const pontos = [];
  for (const linha of json.results) {
    const dia = linha.day;
    if (!(dia >= 1 && dia <= 31)) throw new Error('formato inesperado: dia ' + dia);
    for (let m = 1; m <= 12; m++) {
      const v = numero(linha['rateValue' + m]);
      if (v === null) continue;
      if (!(v >= FAIXA[0] && v <= FAIXA[1])) throw new Error('valor fora da faixa: ' + linha['rateValue' + m]);
      const d = new Date(Date.UTC(ano, m - 1, dia));
      if (d.getUTCMonth() !== m - 1) throw new Error('data inválida: ' + dia + '/' + m);
      pontos.push({ data: d.toISOString().slice(0, 10), valor: v });
    }
  }
  return pontos.sort((a, b) => (a.data < b.data ? -1 : 1));
}

/** monta o conteúdo do arquivo a partir dos pontos (pelo menos 2) */
function montar(pontos, agoraISO) {
  const hoje = agoraISO.slice(0, 10);
  const validos = pontos.filter(p => p.data <= hoje);
  if (validos.length < 2) throw new Error('menos de dois fechamentos disponíveis');
  const ult = validos[validos.length - 1], ant = validos[validos.length - 2];
  return {
    indice: 'Ibovespa',
    unidade: 'pontos',
    fonte: 'B3 — Índice Bovespa, estatísticas históricas (fechamento diário)',
    link: PAGINA,
    fechamento: { data: ult.data, valor: ult.valor },
    anterior: { data: ant.data, valor: ant.valor },
    variacao: ult.valor / ant.valor - 1,
    ultimos: validos.slice(-22),
    consultadoEm: agoraISO
  };
}

async function baixar(ano) {
  const resp = await fetch(urlDoAno(ano), { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error('B3 respondeu ' + resp.status + ' para ' + ano);
  return lerAno(await resp.json(), ano);
}

async function main() {
  const agora = new Date();
  const ano = agora.getUTCFullYear();
  let pontos = await baixar(ano);
  if (pontos.length < 2) pontos = (await baixar(ano - 1)).concat(pontos); // começo de janeiro
  const novo = montar(pontos, agora.toISOString());

  let atual = null;
  try { atual = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8')); } catch (e) { /* primeiro uso */ }
  if (atual && atual.fechamento && atual.fechamento.data === novo.fechamento.data && atual.fechamento.valor === novo.fechamento.valor) {
    console.log('Sem fechamento novo (' + novo.fechamento.data + ').');
    return;
  }
  if (atual && atual.fechamento && novo.fechamento.data < atual.fechamento.data) throw new Error('a B3 devolveu um fechamento mais antigo que o gravado');
  fs.writeFileSync(ARQUIVO, JSON.stringify(novo, null, 2) + '\n');
  console.log('Ibovespa ' + novo.fechamento.valor + ' em ' + novo.fechamento.data + ' (' + (novo.variacao * 100).toFixed(2) + '%).');
}

if (require.main === module) {
  main().catch(err => { console.error('Falha ao atualizar o Ibovespa: ' + err.message); process.exit(1); });
}
module.exports = { lerAno, montar, numero, urlDoAno };
