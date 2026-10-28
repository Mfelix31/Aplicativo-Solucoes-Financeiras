// Testes da leitura do Ibovespa publicado pela B3 (scripts/atualizar-ibovespa.js). Rodar: node --test tests/
// Os números abaixo são sintéticos, só no formato da resposta da B3 (uma linha por dia, uma coluna por mês, padrão en-us).
const test = require('node:test');
const assert = require('node:assert/strict');
const { lerAno, montar, numero, urlDoAno } = require('../scripts/atualizar-ibovespa.js');

const linha = (day, valores) => { const l = { day }; for (let m = 1; m <= 12; m++) l['rateValue' + m] = valores[m] ?? null; return l; };
const resposta = { min: {}, max: {}, results: [
  linha(1, { 2: '120,000.00', 10: '130,100.50' }),
  linha(2, { 2: '121,000.00' }),
  linha(27, { 10: '131,250.40' }),
  linha(31, { 1: '119,500.00' })
] };

test('número no padrão en-us', () => {
  assert.equal(numero('112,143.51'), 112143.51);
  assert.equal(numero(null), null);
  assert.ok(Number.isNaN(numero('abc')));
});

test('lê a tabela do ano em ordem de data', () => {
  const p = lerAno(resposta, 2026);
  assert.deepEqual(p.map(x => x.data), ['2026-01-31', '2026-02-01', '2026-02-02', '2026-10-01', '2026-10-27']);
  assert.equal(p[p.length - 1].valor, 131250.4);
});

test('monta o fechamento e a variação sobre o anterior, ignorando datas futuras', () => {
  const r = montar(lerAno(resposta, 2026), '2026-10-28T12:00:00.000Z');
  assert.equal(r.fechamento.data, '2026-10-27');
  assert.equal(r.anterior.data, '2026-10-01');
  assert.ok(Math.abs(r.variacao - (131250.4 / 130100.5 - 1)) < 1e-12);
  const antes = montar(lerAno(resposta, 2026), '2026-10-20T12:00:00.000Z');
  assert.equal(antes.fechamento.data, '2026-10-01');
});

test('recusa formato inesperado, valor fora da faixa e data inválida', () => {
  assert.throws(() => lerAno({}, 2026), /results/);
  assert.throws(() => lerAno({ results: [linha(3, { 5: '1,234.00' })] }, 2026), /faixa/);
  assert.throws(() => lerAno({ results: [linha(31, { 2: '120,000.00' })] }, 2026), /data inválida/);
  assert.throws(() => montar([{ data: '2026-01-02', valor: 120000 }], '2026-01-05T00:00:00Z'), /dois/);
});

test('endereço da consulta usa o índice IBOV e o ano em base64', () => {
  const u = urlDoAno(2026);
  const p = JSON.parse(Buffer.from(u.split('/').pop(), 'base64').toString());
  assert.deepEqual(p, { language: 'en-us', index: 'IBOV', year: 2026 });
});
