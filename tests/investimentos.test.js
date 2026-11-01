// Testes do motor do Simulador de Investimentos (engine/investimentos.js).
// Valores de conferência calculados à parte em Python, com a lista de feriados nacionais
// escrita à mão (calendário ANBIMA), sem usar o algoritmo do app. Data de aplicação fixa:
// sexta-feira, 30/10/2026; CDI 13,65% a.a. Rodar: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine/investimentos.js');

const HOJE = new Date(2026, 9, 30);
const C = E.calculadora(HOJE);
const CDI = 13.65;
const perto = (a, b, tol = 0.005, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} ≠ ${b}`);

/* ---------- calendário ---------- */
test('Páscoa: datas conhecidas', () => {
  assert.equal(E.pascoa(2024).toDateString(), new Date(2024, 2, 31).toDateString());
  assert.equal(E.pascoa(2025).toDateString(), new Date(2025, 3, 20).toDateString());
  assert.equal(E.pascoa(2026).toDateString(), new Date(2026, 3, 5).toDateString());
});

test('feriados nacionais de 2026: fixos, móveis e Consciência Negra', () => {
  const f = E.feriadosNacionais(2026);
  for (const d of ['1-1', '2-16', '2-17', '4-3', '4-21', '5-1', '6-4', '9-7', '10-12', '11-2', '11-15', '11-20', '12-25']) {
    assert.ok(f.has(d), `faltou ${d}`);
  }
  assert.equal(f.size, 13);
  assert.ok(!E.feriadosNacionais(2023).has('11-20'), 'Consciência Negra só a partir de 2024 (Lei 14.759/2023)');
});

test('dias úteis por ano (ANBIMA): 249 em 2026 e 251 em 2027', () => {
  const k = E.calculadora(new Date(2026, 0, 1));
  assert.equal(k.diasUteisEntre(0, 365), 249);
  assert.equal(k.diasUteisEntre(365, 730), 251);
});

test('prazos em meses e anos seguem o calendário', () => {
  assert.equal(C.prazoEmDias(12, 'meses'), 365);
  assert.equal(C.prazoEmDias(1, 'anos'), 365);
  assert.equal(C.prazoEmDias(45, 'dias'), 45);
  assert.equal(E.calculadora(new Date(2027, 9, 30)).prazoEmDias(1, 'anos'), 366, 'atravessa 29/02/2028');
  assert.equal(E.calculadora(new Date(2026, 0, 31)).diasAteMesesDepois(1), 28, '31/01 + 1 mês = 28/02');
  assert.deepEqual(C.datasAportes(92), [31, 61, 92]);
  assert.equal(C.mesesCompletos(91), 2);
  assert.equal(C.mesesCompletos(92), 3);
});

/* ---------- tributação ---------- */
test('IOF regressivo: 96% no 1º dia, 50% no 15º, 3% no 29º e zero a partir de 30', () => {
  assert.equal(E.iofAliquota(1), 96);
  assert.equal(E.iofAliquota(15), 50);
  assert.equal(E.iofAliquota(29), 3);
  assert.equal(E.iofAliquota(30), 0);
  assert.equal(E.iofAliquota(400), 0);
});

test('IR regressivo nas mudanças de faixa', () => {
  assert.equal(E.irAliquota(180), 22.5);
  assert.equal(E.irAliquota(181), 20);
  assert.equal(E.irAliquota(360), 20);
  assert.equal(E.irAliquota(361), 17.5);
  assert.equal(E.irAliquota(720), 17.5);
  assert.equal(E.irAliquota(721), 15);
});

test('regras de cada produto', () => {
  assert.deepEqual([E.PRODUTOS.lca.isentoIR, E.PRODUTOS.lca.isentoIOF], [true, false]);
  assert.deepEqual([E.PRODUTOS.rdc.isentoIR, E.PRODUTOS.rdc.isentoIOF], [false, false]);
  assert.deepEqual([E.PRODUTOS.compromissada.isentoIR, E.PRODUTOS.compromissada.isentoIOF], [false, true]);
  assert.equal(E.LCA_PRAZO_MINIMO_MESES, 6);
});

/* ---------- simulação ---------- */
test('LCA 95% do CDI, R$ 10 mil, 12 meses: 250 dias úteis, sem IR (conferido em Python)', () => {
  const r = C.simular(10000, CDI * 0.95, 365, true, false);
  assert.equal(r.du, 250);
  assert.equal(r.irValor, 0);
  assert.equal(r.iofValor, 0);
  perto(r.valorFinal, 11285.823442341503, 1e-6);
  perto(r.panual, CDI * 0.95, 1e-9, 'sem imposto, a líquida é a própria taxa');
});

test('RDC 110% do CDI, 12 meses: IR de 17,5% (365 dias corridos)', () => {
  const r = C.simular(10000, CDI * 1.10, 365, false, false);
  assert.equal(r.aliqIR, 17.5);
  perto(r.valorFinal, 11228.20840985371, 1e-6);
});

test('15 dias: RDC paga IOF de 50% e IR de 22,5%; Compromissada só o IR', () => {
  const rdc = C.simular(10000, CDI, 15, false, false);
  const comp = C.simular(10000, CDI, 15, false, true);
  assert.equal(rdc.du, 10);
  assert.equal(rdc.aliqIOF, 50);
  assert.equal(comp.iofValor, 0);
  perto(rdc.valorFinal, 10019.72540415372, 1e-6);
  perto(comp.valorFinal, 10039.450808307438, 1e-6);
  perto(rdc.iofValor, rdc.bruto * 0.5, 1e-9, 'IOF incide sobre o rendimento');
  perto(rdc.irValor, (rdc.bruto - rdc.iofValor) * 0.225, 1e-9, 'IR incide depois do IOF');
});

test('aportes mensais: cada aporte pelo seu prazo; o do dia do resgate entra sem render (conferido em Python)', () => {
  const r = C.simularComAportes(10000, 1000, CDI, 92, false, false);
  assert.equal(r.nAportes, 3);
  assert.equal(r.capital, 13000);
  perto(r.valorFinal, 13273.668000665568, 1e-6);
});

test('casos-limite: taxa zero, sem dia útil e sem aporte', () => {
  const zero = C.simular(10000, 0, 365, false, false);
  assert.equal(zero.valorFinal, 10000);
  assert.equal(zero.panual, 0);
  const sabado = E.calculadora(new Date(2026, 9, 31)).simular(10000, CDI, 1, false, false);  // sábado → domingo
  assert.equal(sabado.du, 0);
  assert.equal(sabado.valorFinal, 10000);
  assert.ok(Number.isFinite(sabado.panual));
  const semAporte = C.simularComAportes(10000, 0, CDI, 365, true, false);
  perto(semAporte.valorFinal, C.simular(10000, CDI, 365, true, false).valorFinal, 1e-9);
});

test('curva por ano constante dá o mesmo que a taxa constante', () => {
  const curva = { curva: { 2026: CDI, 2027: CDI, 2028: CDI }, mult: 1.1 };
  perto(C.simular(10000, curva, 800, false, false).valorFinal, C.simular(10000, CDI * 1.1, 800, false, false).valorFinal, 1e-6);
  const subindo = { curva: { 2026: 13, 2027: 11 }, mult: 1 };
  assert.equal(E.taxaNoAno(subindo, 2030), 11, 'depois do último ano mantém o último valor');
  const eq = C.taxaEquivalente(subindo, 365);
  assert.ok(eq > 11 && eq < 13, 'equivalente fica entre as taxas dos anos');
});

test('evolução: começa no valor aplicado e termina no valor final', () => {
  const pts = C.evolucao(10000, 0, CDI, 365, true, false);
  assert.equal(pts[0].valor, 10000);
  perto(pts[pts.length - 1].valor, C.simular(10000, CDI, 365, true, false).valorFinal, 1e-9);
  assert.ok(pts.every((p, i) => i === 0 || p.valor >= pts[i - 1].valor - 1e-9), 'cresce sem saltos para baixo (LCA sem IOF)');
});

/* ---------- taxas ---------- */
test('taxa real pela fórmula exata; inflação maior que a taxa dá real negativa', () => {
  perto(E.taxaReal(10, 4), (1.10 / 1.04 - 1) * 100, 1e-12);
  assert.ok(E.taxaReal(5, 6) < 0);
  perto(E.taxaReal(5, 6), -0.9433962264150941, 1e-12);
});

test('taxa equivalente entre LCA e RDC pelo IR do prazo', () => {
  perto(E.taxaEquivalenteIR(CDI * 0.95, 365, true), CDI * 0.95 / 0.825, 1e-12);
  perto(E.taxaEquivalenteIR(CDI * 1.10, 100, false), CDI * 1.10 * 0.775, 1e-12);
});

/* ---------- referências de mercado ---------- */
test('poupança: 0,5% a.m. + TR com Selic acima de 8,5%; só meses completos', () => {
  const ref = C.referencias({ pv: 10000, aporte: 0, dias: 365, cdi: CDI, trMensal: 0.1690, percCdb: 100 });
  perto(ref.poupanca.vf, 10834.098986090601, 1e-6);
  const curto = C.referencias({ pv: 10000, aporte: 0, dias: 20, cdi: CDI, trMensal: 0.1690, percCdb: 100 });
  assert.equal(curto.poupanca.vf, 10000, 'menos de 1 mês: não rende');
  const selicBaixa = C.referencias({ pv: 10000, aporte: 0, dias: 365, cdi: 6, trMensal: 0, percCdb: 100 });
  perto(selicBaixa.poupanca.taxaMensal / 100, 0.0034905363507502507, 1e-12, '70% da Selic quando ela é até 8,5%');
});

test('CDB igual a um RDC com a mesma taxa; Tesouro Selic com custódia só acima de R$ 10 mil', () => {
  const ref = C.referencias({ pv: 10000, aporte: 0, dias: 365, cdi: CDI, trMensal: 0, percCdb: 100 });
  perto(ref.cdb.vf, C.simular(10000, CDI, 365, false, false).valorFinal, 1e-9);
  const pequeno = C.referencias({ pv: 5000, aporte: 0, dias: 365, cdi: CDI, trMensal: 0, percCdb: 100 });
  assert.equal(pequeno.tesouroSelic.custodia, 0);
  const grande = C.referencias({ pv: 100000, aporte: 0, dias: 365, cdi: CDI, trMensal: 0, percCdb: 100 });
  assert.ok(grande.tesouroSelic.custodia > 180 && grande.tesouroSelic.custodia < 200, 'cerca de 0,20% sobre R$ 90 mil e o rendimento');
  perto(grande.tesouroSelic.taxaEquivalente, CDI + E.SPREAD_CDI_SELIC, 1e-12);
});

test('taxa interna de retorno: sem aportes é a própria rentabilidade líquida', () => {
  const r = C.simular(10000, CDI, 365, false, false);
  const ref = C.referencias({ pv: 10000, aporte: 0, dias: 365, cdi: CDI, trMensal: 0, percCdb: 100 });
  perto(ref.tir(r.valorFinal), r.panual, 1e-6);
  const comAportes = C.referencias({ pv: 10000, aporte: 1000, dias: 365, cdi: CDI, trMensal: 0, percCdb: 100 });
  const vf = C.simularComAportes(10000, 1000, CDI, 365, false, false).valorFinal;
  const tir = comAportes.tir(vf);
  assert.ok(tir > 0 && tir < CDI, 'positiva e abaixo da taxa bruta');
});
