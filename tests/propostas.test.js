// Testes da leitura das propostas do Sicoob em PDF. Rodar: node --test tests/*.test.js
// As fixtures são as linhas que o pdf.js extrai dos PDFs reais, sem nenhum dado pessoal
// (a data de nascimento do proponente foi apagada; a idade entra como opção).
const IDADE = {idadeAnos: 45};
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../engine/propostas.js');
const E = require('../engine/aquisicao.js');

const linhas = nome => fs.readFileSync(path.join(__dirname, 'fixtures', nome), 'utf8').split('\n');
const fin = linhas('proposta-financiamento-sicoob.txt');
const cons = linhas('simulacao-consorcio-sicoob.txt');

test('identifica o tipo de proposta', () => {
  assert.equal(P.identificar(fin), 'financiamento');
  assert.equal(P.identificar(cons), 'consorcio');
  assert.equal(P.identificar(['Extrato da conta corrente', 'Saldo R$ 10,00']), null);
  assert.equal(P.ler(['qualquer coisa']).tipo, null);
});

test('números no formato brasileiro', () => {
  assert.equal(P.brl('R$ 2.181.986,40'), 2181986.40);
  assert.equal(P.brl('R$ 0,00'), 0);
  assert.equal(P.dec('7,99'), 7.99);
  assert.equal(P.dec('1.4085'), 1.4085);
});

test('proposta de financiamento: campos principais', () => {
  const r = P.ler(fin, IDADE);
  assert.equal(r.tipo, 'financiamento');
  assert.deepEqual(r.avisos, []);
  assert.equal(r.valorFinanciado, 600000);
  assert.equal(r.valorImovel, 700000);
  assert.equal(r.sistema, 'SAC');
  assert.equal(r.jurosNominalAnual, 0.0799);
  assert.equal(r.cetAnual, 0.0934);
  assert.equal(r.prazoMeses, 420);
  assert.equal(r.parcelas, 420);
  assert.equal(r.tacMensal, 25);
  assert.equal(r.despesasIniciais, 2140);
  assert.equal(r.nascimento, undefined, 'a data de nascimento nunca é devolvida');
  assert.equal(r.idadeAnos, 45);
  assert.equal(r.dataProposta, '2026-10-23');
  assert.ok(Math.abs(r.trMensal - 0.001661) < 1e-9);
  assert.ok(Math.abs(r.dfiMensal - 0.0000608) < 1e-10);
  assert.equal(r.primeiraPrestacao, 5646.78);
});

test('proposta de financiamento: tabela do seguro MIP por faixa de idade', () => {
  const r = P.ler(fin, IDADE);
  assert.deepEqual(r.tabelaMIP.map(x => x.idadeAte), [45, 50, 55, 60, 65, 70, 75, 80]);
  assert.deepEqual(r.tabelaMIP.map(x => x.taxa), [0.000244, 0.000424, 0.000655, 0.000915, 0.001329, 0.00217, 0.003588, 0.005835]);
});

test('proposta lida → motor reproduz o 1º encargo do relatório', () => {
  const r = P.ler(fin, IDADE);
  const e = {
    capital: 650000, valorBem: r.valorImovel, horizonteMeses: 12, taxaMes: 0.01, avista: { ativo: false },
    financiamento: { ativo: true, modo: 'proposta', valorFinanciado: r.valorFinanciado, jurosNominalAnual: r.jurosNominalAnual,
      trMensal: r.trMensal, prazoMeses: r.prazoMeses, sistema: r.sistema, tabelaMIP: r.tabelaMIP, idadeMesesHoje: r.idadeAnos * 12 + r.idadeMesesExtra,
      dfiMensal: r.dfiMensal, tacMensal: r.tacMensal, despesasIniciais: r.despesasIniciais, mesInicio: 0 }
  };
  const f = E.analisar(e).cenarios.financiamento;
  assert.ok(Math.abs(f.parcelaInicial - r.primeiraPrestacao) < 0.01, f.parcelaInicial);
});

test('simulação de consórcio: campos principais', () => {
  const r = P.ler(cons);
  assert.equal(r.tipo, 'consorcio');
  assert.deepEqual(r.avisos, []);
  assert.equal(r.valorBem, 134897);
  assert.equal(r.carta, 134897);
  assert.equal(r.descricaoBem, 'STRADA VOLCANO 1.3 FLEX 8V CD');
  assert.equal(r.prazoRateio, 71);
  assert.equal(r.prazoGrupo, 75);
  assert.equal(r.ofertaMaximaParcelas, 70);
  assert.equal(r.mediaLanceParcelas, 43);
  assert.equal(r.taxaAdm, 0.07);
  assert.equal(r.fundoReserva, 0.02);
  assert.equal(r.seguroValor, 72.78);
  assert.equal(r.parcelaInicial, 2143.72);
  assert.equal(r.lanceReduz, 'parcela');
  assert.equal(r.lanceEm, 'parcelas');
  assert.equal(r.valorLance, 43);
  assert.equal(r.valorLanceEmbutido, 0);
  assert.equal(r.valorNominalLance, 89051.5);
  assert.equal(r.dataSimulacao, '2026-10-26');
});

test('simulação de consórcio lida → motor reproduz a parcela após o lance', () => {
  const r = P.ler(cons);
  const e = {
    capital: 300000, valorBem: r.valorBem, horizonteMeses: 72, taxaMes: 0.01, avista: { ativo: false },
    consorcio: { ativo: true, carta: r.carta, prazoMeses: r.prazoRateio, taxaAdm: r.taxaAdm, fundoReserva: r.fundoReserva,
      seguroValor: r.seguroValor, reajusteAnual: 0, lanceTotal: E.lanceDeParcelas(r.valorLance, r.prazoRateio, r.taxaAdm, r.fundoReserva),
      lanceEmbutido: r.lanceEmbutido, lanceReduz: r.lanceReduz, mesContemplacao: 1 }
  };
  const c = E.analisar(e).cenarios.consorcio;
  assert.ok(Math.abs(c.parcelaInicial - 845.50) < 0.15, c.parcelaInicial);
});

test('sem a idade, a tabela do MIP não é montada e o aviso explica', () => {
  const r = P.ler(fin);
  assert.equal(r.tabelaMIP, undefined);
  assert.ok(r.avisos.some(a => /idade/.test(a)));
});

test('nenhuma data de nascimento nas fixtures nem no código', () => {
  const textos = [fin.join('\n'), cons.join('\n'), fs.readFileSync(path.join(__dirname, '..', 'aquisicao.html'), 'utf8')];
  for (const t of textos) assert.ok(!/Proponente:\s+\d{2}\/\d{2}\/\d{4}/.test(t) && !/1981-\d{2}-\d{2}/.test(t));
});
