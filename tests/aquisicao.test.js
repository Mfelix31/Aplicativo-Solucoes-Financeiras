// Testes do motor de Estratégia de Aquisição. Rodar: node --test tests/
// As referências do "caso do cooperado" foram conferidas com uma simulação
// independente em Python (mesmas premissas, código separado).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine/aquisicao.js');

const perto = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, (msg || '') + ` esperado ${b}, obtido ${a}`);

const r7k = 7000 / 650000; // R$ 7 mil líquidos por mês sobre R$ 650 mil (LCA)

function caso(over) {
  const base = {
    capital: 650000, aporteMensal: 0, valorBem: 700000, valorizacaoAnual: 0, ipcaAnual: 0.04,
    horizonteMeses: 120, taxaMes: r7k, custoEsperaMensal: 0, reservaMinima: 0,
    financiamento: { ativo: true, valorFinanciado: 600000, cetAnual: 0.0934, prazoMeses: 420, sistema: 'SAC' },
    consorcio: { ativo: true, carta: 1000000, prazoMeses: 240, taxaAdm: 0.15, fundoReserva: 0, seguroMensal: 0,
      reajusteAnual: 0, lanceTotal: 0.8, lanceEmbutido: 0.25, lanceReduz: 'parcela', mesContemplacao: 1 },
    avista: { ativo: true }
  };
  const e = Object.assign({}, base, over || {});
  if (over && over.financiamento) e.financiamento = Object.assign({}, base.financiamento, over.financiamento);
  if (over && over.consorcio) e.consorcio = Object.assign({}, base.consorcio, over.consorcio);
  return e;
}

/* ---------- utilitários ---------- */
test('taxa mensal equivalente e volta', () => {
  perto(E.taxaMensal(0.0934), 0.007469, 1e-6);
  perto(E.taxaAnualDeMensal(E.taxaMensal(0.1234)), 0.1234, 1e-12);
});

test('Price: R$ 100 mil, 1% a.m., 12 meses = R$ 8.884,88', () => {
  perto(E.pmt(100000, 0.01, 12), 8884.878867, 1e-5);
  perto(E.pmt(1200, 0, 12), 100, 1e-12);
});

test('IR regressivo e taxa líquida', () => {
  assert.equal(E.aliquotaIR(180), 0.225);
  assert.equal(E.aliquotaIR(181), 0.20);
  assert.equal(E.aliquotaIR(721), 0.15);
  perto(E.taxaMensalLiquida({ modo: 'renda', rendaMensal: 7000, capital: 650000 }), r7k, 1e-15);
  const bruta = E.taxaMensal(0.1365);
  perto(E.taxaMensalLiquida({ modo: 'produto', taxaBrutaAnual: 0.1365, isentoIR: true }), bruta, 1e-15);
  perto(E.taxaMensalLiquida({ modo: 'produto', taxaBrutaAnual: 0.1365, isentoIR: false, prazoMedioDias: 1000 }), bruta * 0.85, 1e-15);
});

/* ---------- financiamento ---------- */
test('Financiamento SAC do cooperado: 1ª parcela ≈ renda do capital restante', () => {
  const f = E.analisar(caso()).cenarios.financiamento;
  assert.equal(f.desembolsoCompra, 100000);
  assert.equal(f.capitalAposCompra, 550000);
  perto(f.parcelaInicial, 600000 / 420 + 600000 * E.taxaMensal(0.0934), 1e-6);
  perto(f.parcelaInicial, 5909.83, 0.01);
  perto(f.rendaInicial, 5923.08, 0.01);
  assert.equal(f.mesEsgota, null);
});

test('Financiamento SAC: patrimônio em 10 anos = referência independente (R$ 946.434,79)', () => {
  const f = E.analisar(caso()).cenarios.financiamento;
  perto(f.horizonte.patrimonio, 946434.79, 0.05);
  perto(f.horizonte.saldoDevedor, 600000 - 120 * 600000 / 420, 1e-6);
});

test('O custo efetivo calculado pelo motor devolve o CET informado (SAC e Price)', () => {
  for (const sistema of ['SAC', 'PRICE']) {
    const f = E.analisar(caso({ financiamento: { sistema } })).cenarios.financiamento;
    perto(f.custoEfetivoAnual, 0.0934, 1e-6, sistema);
    perto(f.horizonte.mes, 120, 0);
  }
});

test('Price: saldo zera no fim do prazo', () => {
  const r = E.analisar(caso({ horizonteMeses: 420, financiamento: { sistema: 'PRICE' } }));
  const f = r.cenarios.financiamento;
  perto(f.serie[420].saldoDevedor, 0, 1e-6);
  perto(f.serie[1].parcela, E.pmt(600000, E.taxaMensal(0.0934), 420), 1e-6);
});

/* ---------- consórcio ---------- */
test('Consórcio: reajuste anual da carta aumenta a parcela no 13º mês', () => {
  const c = E.analisar(caso({ consorcio: { lanceTotal: 0, lanceEmbutido: 0, mesContemplacao: 240, reajusteAnual: 0.05 } })).cenarios.consorcio;
  perto(c.serie[12].parcela / c.serie[11].parcela, 1.05, 1e-9); // 13ª parcela / 12ª
  perto(c.serie[11].parcela, 1150000 / 240, 1e-6);
});

test('Consórcio: fundo de reserva entra no percentual devido', () => {
  const c = E.analisar(caso({ consorcio: { fundoReserva: 0.02, lanceTotal: 0, lanceEmbutido: 0, mesContemplacao: 240 } })).cenarios.consorcio;
  perto(c.parcelaOriginal, 1170000 / 240, 1e-6);
});

test('Consórcio contemplado depois: compra o bem já valorizado e paga a diferença com o capital', () => {
  const c = E.analisar(caso({ valorizacaoAnual: 0.04, consorcio: { carta: 700000, lanceTotal: 0, lanceEmbutido: 0, mesContemplacao: 60 } })).cenarios.consorcio;
  assert.equal(c.mesCompra, 59); // 60ª assembleia
  perto(c.complemento, 700000 * Math.pow(1.04, 59 / 12) - 700000, 1e-6);
  assert.equal(c.serie[58].temBem, false);
  assert.equal(c.serie[59].temBem, true);
});

test('Consórcio: lance maior que o saldo é limitado ao saldo', () => {
  const c = E.analisar(caso({ consorcio: { lanceTotal: 1, lanceEmbutido: 0, mesContemplacao: 239 } })).cenarios.consorcio;
  assert.ok(c.serie[237].saldoDevedor > 0);
  perto(c.serie[238].saldoDevedor, 0, 1e-6);
});

/* ---------- capital próprio ---------- */
test('Capital próprio: chega aos R$ 700 mil em 7 meses e compra', () => {
  const a = E.analisar(caso()).cenarios.avista;
  assert.equal(a.mesCompra, 7);
  perto(a.capitalAposCompra, 650000 * Math.pow(1 + r7k, 7) - 700000, 1e-6);
});

test('Capital próprio com valorização do bem: espera mais', () => {
  const a = E.analisar(caso({ valorizacaoAnual: 0.0444 })).cenarios.avista;
  assert.ok(a.mesCompra > 7);
  perto(a.desembolsoCompra, 700000 * Math.pow(1.0444, a.mesCompra / 12), 1e-6);
});

test('Capital próprio com taxa zero e capital insuficiente: não compra', () => {
  const r = E.analisar(caso({ taxaMes: 0 }));
  assert.equal(r.cenarios.avista.mesCompra, null);
  assert.notEqual(r.melhor, 'avista');
});

test('Aporte mensal entra em todos os caminhos', () => {
  const s = E.analisar(caso({ taxaMes: 0, aporteMensal: 1000, horizonteMeses: 12 }));
  perto(s.cenarios.avista.serie[12].capital, 650000 + 12000, 1e-6);
  assert.equal(s.cenarios.avista.mesCompra, 50); // só junta os R$ 700 mil no mês 50, fora do horizonte
  assert.notEqual(s.melhor, 'avista');
  const f = s.cenarios.financiamento;
  perto(f.serie[1].capital, 550000 + 1000 - f.serie[1].parcela, 1e-6);
});

test('Custo de espera só é pago enquanto o cliente não tem o bem', () => {
  const s = E.analisar(caso({ custoEsperaMensal: 3000 }));
  const a = s.cenarios.avista;
  const sem = E.analisar(caso()).cenarios.avista;
  assert.ok(a.mesCompra >= sem.mesCompra);
  const f = s.cenarios.financiamento, f0 = E.analisar(caso()).cenarios.financiamento;
  perto(f.horizonte.patrimonio, f0.horizonte.patrimonio, 1e-6); // financiamento já tem o bem
});

/* ---------- análise de risco ---------- */
test('Taxa de equilíbrio financiamento × capital próprio em 10 anos ≈ 11,13% a.a. (referência independente)', () => {
  const t = E.taxaEquilibrio(caso(), 'financiamento', 'avista', 120);
  perto(t, 0.1113, 0.0005);
  // conferência: na taxa de equilíbrio os patrimônios se igualam
  perto(E.patrimonioComTaxa(caso(), t, 'financiamento', 120), E.patrimonioComTaxa(caso(), t, 'avista', 120), 1);
});

test('Sensibilidade: com rendimento menor o financiamento perde a vantagem', () => {
  const [baixa, alta] = E.sensibilidade(caso(), [0.09, 0.14], 120);
  assert.ok(baixa.financiamento.patrimonio < baixa.avista.patrimonio);
  assert.ok(alta.financiamento.patrimonio > alta.avista.patrimonio);
});

test('Melhor caminho do cooperado em 10 anos: financiamento', () => {
  assert.equal(E.analisar(caso()).melhor, 'financiamento');
});

/* ---------- validação ---------- */
test('Validação: entradas inválidas não simulam', () => {
  assert.equal(E.analisar(caso({ valorBem: 0 })).ok, false);
  assert.equal(E.analisar(caso({ consorcio: { lanceEmbutido: 0.9 } })).ok, false);
  assert.equal(E.analisar(caso({ consorcio: { mesContemplacao: 300 } })).ok, false);
  assert.equal(E.analisar(caso({ financiamento: { prazoMeses: 0 } })).ok, false);
  assert.equal(E.analisar(caso({ capital: NaN })).ok, false);
});

test('Caminhos desligados não aparecem', () => {
  const r = E.analisar(caso({ consorcio: { ativo: false } }));
  assert.equal(r.cenarios.consorcio, undefined);
  assert.ok(r.cenarios.financiamento && r.cenarios.avista);
});

test('Consórcio com lance embutido e carta dimensionada (bem ÷ (1 − embutido)): sem sobra nem complemento', () => {
  const c = E.analisar(caso({ consorcio: { carta: 700000 / 0.75 } })).cenarios.consorcio;
  perto(c.creditoRecebido, 700000, 1e-6);
  perto(c.excedenteAbatido, 0, 1e-6);
  perto(c.complemento, 0, 1e-6);
});

test('Consórcio com carta no valor do bem (sem embutido): lance livre sai todo do capital', () => {
  const c = E.analisar(caso({ consorcio: { carta: 700000, lanceTotal: 0.30, lanceEmbutido: 0 } })).cenarios.consorcio;
  perto(c.creditoRecebido, 700000, 1e-6);
  perto(c.lanceProprio, 210000, 1e-6);
  perto(c.desembolsoCompra, 210000, 1e-6);
});

/* ---------- financiamento no padrão da proposta Sicoob ---------- */
// Proposta "Relatório da Simulação de Financiamento" do Banco Sicoob, 23/10/2026:
// R$ 600 mil, imóvel R$ 700 mil, Funding FGTS Pró-Cotista, SAC, 420 meses, juros 7,99% a.a. nominais,
// TR projetada 0,1661% a.m., MIP Tokio Marine por faixa de idade (nascimento ),
// DFI 0,00608% a.m. do imóvel, TAC R$ 25/mês, tarifa Pró-Cotista R$ 2.140 não incorporada.
const MIP_PROPOSTA = [
  { idadeAte: 45, taxa: 0.000244 }, { idadeAte: 50, taxa: 0.000424 }, { idadeAte: 55, taxa: 0.000655 },
  { idadeAte: 60, taxa: 0.000915 }, { idadeAte: 65, taxa: 0.001329 }, { idadeAte: 70, taxa: 0.00217 },
  { idadeAte: 75, taxa: 0.003588 }, { idadeAte: 80, taxa: 0.005835 }
];
const PROPOSTA = { modo: 'proposta', valorFinanciado: 600000, jurosNominalAnual: 0.0799, trMensal: 0.001661,
  prazoMeses: 420, sistema: 'SAC', tabelaMIP: MIP_PROPOSTA, idadeMesesHoje: 45 * 12, dfiMensal: 0.0000608,
  tacMensal: 25, despesasIniciais: 2140, mesInicio: 0 };
const REF = {"1": {"prest": 5646.78, "saldo": 599565.66, "mip": 146.64, "dfi": 42.56}, "2": {"prest": 5646.23, "saldo": 599128.22, "mip": 146.54, "dfi": 42.63}, "11": {"prest": 5640.43, "saldo": 595050.35, "mip": 145.55, "dfi": 43.27}, "12": {"prest": 5746.98, "saldo": 594581.43, "mip": 252.72, "dfi": 43.34}, "13": {"prest": 5746.16, "saldo": 594109.31, "mip": 252.52, "dfi": 43.42}, "60": {"prest": 5684.97, "saldo": 568134.11, "mip": 241.56, "dfi": 46.94}, "71": {"prest": 5664.04, "saldo": 560921.76, "mip": 238.51, "dfi": 47.8}, "72": {"prest": 5791.79, "saldo": 560243.56, "mip": 368.01, "dfi": 47.88}, "132": {"prest": 5748.86, "saldo": 512195.83, "mip": 470.29, "dfi": 52.9}, "192": {"prest": 5641.67, "saldo": 447946.08, "mip": 597.93, "dfi": 58.44}, "252": {"prest": 5498.1, "saldo": 364627.59, "mip": 795.95, "dfi": 64.55}, "312": {"prest": 5171.76, "saldo": 258950.66, "mip": 937.72, "dfi": 71.31}, "372": {"prest": 4373.97, "saldo": 127145.69, "mip": 757.35, "dfi": 78.78}, "419": {"prest": 3045.38, "saldo": 2875.39, "mip": 33.49, "dfi": 85.17}, "420": {"prest": 3026.47, "saldo": 0.0, "mip": 16.81, "dfi": 85.31}};

test('Financiamento reproduz a proposta do Sicoob (prestação, saldo, MIP e DFI, mês a mês)', () => {
  const f = E.analisar(caso({ horizonteMeses: 420, financiamento: PROPOSTA })).cenarios.financiamento;
  for (const [n, r] of Object.entries(REF)) {
    const s = f.serie[Number(n)];
    // o banco arredonda internamente de forma um pouco diferente: diferença de centavos por mês,
    // que se acumula no saldo (máx. ~R$ 12 em R$ 600 mil) e é absorvida pela última parcela
    if (Number(n) < 420) perto(s.parcela, r.prest, 0.15, `prestação ${n}`);
    perto(s.saldoDevedor, r.saldo, 12, `saldo ${n}`);
    perto(s.detalhe.mip, r.mip, 0.1, `MIP ${n}`);
    perto(s.detalhe.dfi, r.dfi, 0.02, `DFI ${n}`);
  }
  perto(f.parcelaInicial, 5646.78, 0.01, '1º encargo');
});

test('Financiamento da proposta: totais batem com o relatório (valor final R$ 2.181.986,40)', () => {
  const f = E.analisar(caso({ horizonteMeses: 420, financiamento: PROPOSTA })).cenarios.financiamento;
  perto(f.totalParcelas, 2181986.40, 25, 'valor final'); // diferença < 0,002%
  perto(f.juros, 1076985.07, 25, 'juros');
  perto(f.seguros, 200456.81 + 25823.40, 10, 'MIP + DFI');
  perto(f.tarifas, 10500, 1e-6, 'TAC');
  perto(f.desembolsoCompra, 100000 + 2140, 1e-6, 'entrada + tarifa');
});

test('Financiamento com contratação futura: capital rende até a data e a 1ª parcela vem um mês depois', () => {
  const f = E.analisar(caso({ financiamento: Object.assign({}, PROPOSTA, { mesInicio: 6 }) })).cenarios.financiamento;
  assert.equal(f.mesCompra, 6);
  perto(f.serie[5].capital, 650000 * Math.pow(1 + r7k, 5), 1e-6);
  assert.equal(f.serie[6].parcela, 0);
  assert.ok(f.serie[7].parcela > 0);
});

test('Capital próprio respeita a data prevista da compra', () => {
  const a = E.analisar(caso({ capital: 800000, mesCompra: 12 })).cenarios.avista;
  assert.equal(a.mesCompra, 12);
});

test('Cobertura no período: quanto das parcelas a renda pagou e quanto saiu do capital', () => {
  const r = E.analisar(caso());
  const p = r.cenarios.financiamento.periodo;
  assert.ok(p.cobertura > 0.99 && p.cobertura <= 1);
  const c = r.cenarios.consorcio.periodo;
  assert.ok(c.cobertura < 1 && c.retiradoDoCapital > 0);
  perto(c.rendaUsada + c.retiradoDoCapital, c.somaParcelas, 1e-6);
});

/* ---------- consórcio no padrão da simulação de lance do Sicoob ---------- */
test('Consórcio do cooperado: lance de 80% (25% embutido) abate o saldo antes da 1ª parcela', () => {
  const c = E.analisar(caso()).cenarios.consorcio;
  assert.equal(c.mesCompra, 0); // 1ª assembleia = compra hoje
  perto(c.lanceProprio, 550000, 1e-6);
  perto(c.creditoRecebido, 750000, 1e-6);
  perto(c.excedenteAbatido, 50000, 1e-6);   // crédito 750 mil − bem 700 mil abate o saldo
  // 115% − 80% − 5% = 30% da carta, dividido pelas 240 parcelas (inclusive a 1ª)
  perto(c.parcelaInicial, 0.30 * 1e6 / 240, 1e-6);
  assert.ok(c.cobertura < 1, 'a renda não paga a parcela');
  assert.ok(c.mesEsgota !== null, 'o capital acaba');
});

test('Consórcio: "reduzir prazo" mantém a parcela e termina antes; "reduzir parcela" esgota o capital mais tarde', () => {
  const p = E.analisar(caso({ valorBem: 750000 })).cenarios.consorcio;
  const q = E.analisar(caso({ valorBem: 750000, consorcio: { lanceReduz: 'prazo' } })).cenarios.consorcio;
  perto(p.parcelaInicial, 0.35 * 1e6 / 240, 1e-6);
  perto(q.parcelaInicial, 1150000 / 240, 1e-6);
  perto(q.fimContrato, Math.ceil(0.35 / (1.15 / 240)) - 1, 0); // última parcela em t = nº de parcelas − 1
  assert.ok(q.mesEsgota < p.mesEsgota);
});

test('Consórcio: seguro informado em R$ acompanha o valor da parcela', () => {
  const sem = E.analisar(caso({ consorcio: { lanceTotal: 0, lanceEmbutido: 0, mesContemplacao: 240, seguroValor: 100 } })).cenarios.consorcio;
  perto(sem.serie[0].parcela, 1150000 / 240 + 100, 1e-6);
  const com = E.analisar(caso({ valorBem: 750000, consorcio: { seguroValor: 100 } })).cenarios.consorcio;
  perto(com.parcelaInicial, 0.35 * 1e6 / 240 + 100 * (0.35 / 1.15), 1e-6);
});

// Simulação de lance Sisbr 3.0 — Sicoob Primavera, 26/10/2026: Strada R$ 134.897, prazo de rateio 71,
// taxa adm 7%, fundo de reserva 2%, seguro R$ 72,78, lance de 43 parcelas, reduzir parcela, sem embutido.
const SICOOB_CONS = { carta: 134897, prazoMeses: 71, taxaAdm: 0.07, fundoReserva: 0.02, seguroValor: 72.78, reajusteAnual: 0,
  lanceTotal: E.lanceDeParcelas(43, 71, 0.07, 0.02), lanceEmbutido: 0, lanceReduz: 'parcela', mesContemplacao: 1 };

test('Consórcio reproduz a simulação de lance do Sicoob (lance, parcela e total)', () => {
  const r = E.analisar(caso({ valorBem: 134897, capital: 300000, horizonteMeses: 72, consorcio: SICOOB_CONS }));
  const c = r.cenarios.consorcio;
  perto(c.lanceValor, 89051.50, 1, 'valor nominal do lance');
  perto(c.parcelaInicial, 845.50, 0.15, 'parcela após o lance');
  perto(c.totalSeguro, 2038.14, 1, 'seguro após o lance');
  const totalParcelas = c.serie.slice(0, 71).reduce((a, s) => a + s.parcela, 0);
  perto(totalParcelas, 60030.51, 10, 'total com seguro após o lance');
  perto(c.fimContrato, 70, 0);
});

test('Consórcio do Sicoob antes do lance: parcela de R$ 2.143,72', () => {
  const c = E.analisar(caso({ valorBem: 134897, capital: 300000, consorcio: Object.assign({}, SICOOB_CONS, { mesContemplacao: 2 }) })).cenarios.consorcio;
  perto(c.serie[0].parcela, 2143.72, 0.05);
});

/* ---------- IR no resgate ---------- */
test('IR no resgate: sem resgates, o imposto só incide sobre o ganho no fim', () => {
  const ctx = { capital: 100000, aliquotaIR: 0.15, taxa: () => 0.01 };
  const conta = E.novaConta(ctx);
  for (let t = 1; t <= 12; t++) conta.render(t);
  const bruto = 100000 * Math.pow(1.01, 12);
  perto(conta.liquido(), bruto - 0.15 * (bruto - 100000), 1e-6);
});

test('IR no resgate: o resgate paga IR só sobre a parte de ganho', () => {
  const conta = E.novaConta({ capital: 100000, aliquotaIR: 0.15, taxa: () => 0.10 });
  conta.render(1);                 // saldo 110.000, custo 100.000 → ganho = 1/11 do saldo
  conta.sacar(10000);              // líquido de R$ 10 mil
  const f = 10000 / 110000;
  const bruto = 10000 / (1 - 0.15 * f);
  perto(conta.B, 110000 - bruto, 1e-6);
  perto(conta.irPago, bruto - 10000, 1e-6);
  perto(conta.liquido(), (110000 - bruto) - 0.15 * ((110000 - bruto) - conta.K), 1e-9);
});

test('IR no resgate rende mais que o IR mês a mês (diferimento)', () => {
  const g = E.taxaMensal(0.1365);
  const base = caso({ consorcio: { ativo: false }, financiamento: { ativo: false }, valorBem: 1e9, horizonteMeses: 120, capital: 100000 });
  const resgate = E.analisar(Object.assign({}, base, { taxaMes: g, aliquotaIRResgate: 0.15 })).cenarios.avista.horizonte.capital;
  const mensal = E.analisar(Object.assign({}, base, { taxaMes: g * 0.85 })).cenarios.avista.horizonte.capital;
  assert.ok(resgate > mensal * 1.05, `${resgate} > ${mensal}`);
  perto(resgate, 100000 + (100000 * Math.pow(1 + g, 120) - 100000) * 0.85, 1e-3);
});

test('Lance em parcelas: 43 parcelas de 1,5352% = 66% da carta', () => {
  perto(E.lanceDeParcelas(43, 71, 0.07, 0.02), 43 * 1.09 / 71, 1e-12);
});
