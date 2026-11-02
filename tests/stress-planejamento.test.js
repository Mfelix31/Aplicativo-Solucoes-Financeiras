// Stress test do Planejamento Financeiro (engine/planejamento.js): 15 cenários variados.
// Cada número é conferido com uma conta independente (fórmula fechada ou soma direta),
// não com o próprio laço do motor. Convenção do app: capitalização mensal com taxa
// equivalente, aportes no fim do mês, comparação nominal com a meta (decisão do usuário).
// Rodar: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../engine/planejamento.js');

const perto = (a, b, tolRel, msg) => assert.ok(Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * tolRel), `${msg || ''} ${a} ≠ ${b}`);
const im = a => Math.pow(1 + a, 1 / 12) - 1;
/** valor futuro com aporte fixo no fim do mês (fórmula fechada) */
const vf = (pv, pmt, taxaAnual, n) => { const i = im(taxaAnual), f = Math.pow(1 + i, n); return pv * f + (i ? pmt * (f - 1) / i : pmt * n); };
const META_SPREAD = 0.0516;
const meta = renda => renda / im(META_SPREAD);
const cen = o => P.planejarCenario(Object.assign({ patrimonioInicial: 0, aporteMensal: 0, rentabNominalAnual: 0.10, inflacaoAnual: 0.04, objetivos: [], anosParaRenda: 20, mesesMaximo: 1200 }, o));

test('P1 jovem CLT: R$ 1.500/mês por 32 anos a 10% → projeção, meta, aporte e mês da meta pela fórmula fechada', t => {
  const m = meta(8000), N = 32 * 12;
  const r = cen({ aporteMensal: 1500, anosParaRenda: 32, metaHoje: m });
  perto(r.projetadoNominal, vf(0, 1500, 0.10, N), 1e-9, 'projetado');
  perto(r.metaHoje, 8000 / im(0.0516), 1e-12, 'meta');
  const i = im(0.10);
  perto(r.aporteNecessario, m * i / (Math.pow(1 + i, N) - 1), 1e-6, 'aporte necessário');
  const mesFechado = Math.ceil(Math.log(1 + m * i / 1500) / Math.log(1 + i));
  assert.equal(r.mesLiberdade, mesFechado);
  assert.equal(r.atinge, r.projetadoNominal >= m);
  t.diagnostic(`meta ${m.toFixed(0)} | projetado ${r.projetadoNominal.toFixed(0)} | aporte necessário ${r.aporteNecessario.toFixed(2)} | meta no mês ${r.mesLiberdade}`);
});

test('P2 já atingiu a meta hoje: liberdade no mês 0, aporte necessário 0 e sem lacuna', t => {
  const r = cen({ patrimonioInicial: 6e6, metaHoje: meta(20000) });
  assert.equal(r.mesLiberdade, 0);
  assert.equal(r.aporteNecessario, 0);
  assert.equal(r.lacuna, 0);
  assert.ok(r.atinge);
  t.diagnostic(`meta ${r.metaHoje.toFixed(0)} | excedente ${r.excedente.toFixed(0)}`);
});

test('P3 inflação maior que a rentabilidade (3% × 6%) e ganho real zero: taxa real negativa, meta impossível sem quebrar', t => {
  const real = P.taxaRealDeNominal(0.03, 0.06);
  perto(real, 1.03 / 1.06 - 1, 1e-12);
  assert.ok(real < 0);
  const s = P.simular({ patrimonioInicial: 1e6, aporteMensal: 0, rentabNominalAnual: 0.03, inflacaoAnual: 0.06, meses: 120 });
  perto(s.final.real, 1e6 * Math.pow(1 + real, 10), 1e-9, 'poder de compra cai pela taxa real');
  assert.equal(P.rendaPerpetua(1e6, real), 0, 'sem ganho real não há renda perpétua');
  assert.equal(P.patrimonioNecessario(10000, 0), Infinity);
  const r = cen({ patrimonioInicial: 1e6, aporteMensal: 5000, metaHoje: P.patrimonioNecessario(10000, 0) });
  assert.equal(r.aporteNecessario, null);
  assert.equal(r.mesLiberdade, null);
  assert.equal(r.atinge, false);
  t.diagnostic(`taxa real ${(real * 100).toFixed(4)}% | R$ 1 mi vira ${s.final.real.toFixed(0)} de hoje em 10 anos`);
});

test('P4 aporte reajustado pela inflação uma vez por ano: soma por ano com fórmula fechada', t => {
  const pmt = 3000, nom = 0.10, inf = 0.05, anos = 20, i = im(nom), s12 = (Math.pow(1 + i, 12) - 1) / i;
  let esperado = 0;
  for (let y = 0; y < anos; y++) esperado += pmt * Math.pow(1 + inf, y) * s12 * Math.pow(1 + i, 12 * (anos - 1 - y));
  const s = P.simular({ patrimonioInicial: 0, aporteMensal: pmt, rentabNominalAnual: nom, inflacaoAnual: inf, meses: anos * 12, reajusteAporte: true });
  perto(s.final.nominal, esperado, 1e-9);
  assert.equal(P.aporteDoMes(pmt, 13, inf, true), pmt * 1.05);
  assert.equal(P.aporteDoMes(pmt, 12, inf, true), pmt);
  // o aporte necessário com reajuste (o do 1º ano) leva exatamente à meta
  const m = meta(15000);
  const r = cen({ aporteMensal: pmt, rentabNominalAnual: nom, inflacaoAnual: inf, anosParaRenda: anos, metaHoje: m, reajusteAporte: true });
  const com = P.simular({ patrimonioInicial: 0, aporteMensal: r.aporteNecessario, rentabNominalAnual: nom, inflacaoAnual: inf, meses: anos * 12, reajusteAporte: true });
  perto(com.final.nominal, m, 1e-6, 'aporte necessário reajustado atinge a meta');
  t.diagnostic(`final com reajuste ${s.final.nominal.toFixed(0)} | sem reajuste ${vf(0, pmt, nom, 240).toFixed(0)} | aporte necessário (1º ano) ${r.aporteNecessario.toFixed(2)}`);
});

test('P5 entradas extraordinárias: herança no ano 8 e bônus de safra todo ano, corrigidos pela inflação', t => {
  const i = im(0.10), N = 240;
  const s = P.simular({ patrimonioInicial: 0, aporteMensal: 2000, rentabNominalAnual: 0.10, inflacaoAnual: 0.04, meses: N,
    entradas: [{ id: 'h', nome: 'Herança', valorHoje: 500000, mes: 96 }, { id: 'b', nome: 'Safra', valorHoje: 50000, mes: 12, recorrenciaAnos: 1 }] });
  let esperado = vf(0, 2000, 0.10, N) + 500000 * Math.pow(1.04, 8) * Math.pow(1 + i, N - 96);
  for (let m = 12; m <= N; m += 12) esperado += 50000 * Math.pow(1.04, m / 12) * Math.pow(1 + i, N - m);
  perto(s.final.nominal, esperado, 1e-9);
  assert.equal(s.entradas.length, 21, '1 herança + 20 bônus');
  perto(s.entradas.find(e => e.id === 'h').valorNominal, 500000 * Math.pow(1.04, 8), 1e-12);
  t.diagnostic(`final ${s.final.nominal.toFixed(0)} | só aportes ${vf(0, 2000, 0.10, N).toFixed(0)}`);
});

test('P6 objetivo maior que o patrimônio na data: marcado como não atingido e nada é retirado', t => {
  const base = { patrimonioInicial: 50000, aporteMensal: 1000, rentabNominalAnual: 0.10, inflacaoAnual: 0.04, meses: 60 };
  const sem = P.simular(base);
  const com = P.simular(Object.assign({}, base, { objetivos: [{ id: 'c', nome: 'Carro', valorHoje: 200000, mes: 6 }] }));
  assert.equal(com.eventos[0].atingido, false);
  perto(com.final.nominal, sem.final.nominal, 1e-12, 'patrimônio igual ao sem objetivo');
  // objetivo que cabe sai pelo valor corrigido pela inflação
  const cabe = P.simular(Object.assign({}, base, { objetivos: [{ id: 'v', nome: 'Viagem', valorHoje: 20000, mes: 12 }] }));
  const i = im(0.10), vNom = 20000 * 1.04;
  perto(cabe.final.nominal, sem.final.nominal - vNom * Math.pow(1 + i, 48), 1e-9);
  assert.ok(cabe.eventos[0].atingido);
  t.diagnostic(`carro: patrimônio no mês 6 ${com.eventos[0].patrimonioNominalAntes.toFixed(0)} × custo ${com.eventos[0].valorNominal.toFixed(0)}`);
});

test('P7 objetivo recorrente: viagem a cada 2 anos do mês 24 ao 120 = 5 ocorrências, cada uma corrigida', t => {
  const s = P.simular({ patrimonioInicial: 300000, aporteMensal: 3000, rentabNominalAnual: 0.10, inflacaoAnual: 0.04, meses: 120,
    objetivos: [{ id: 'v', nome: 'Viagem', valorHoje: 20000, mes: 24, recorrenciaAnos: 2 }] });
  assert.deepEqual(s.eventos.map(e => e.mes), [24, 48, 72, 96, 120]);
  s.eventos.forEach(e => perto(e.valorNominal, 20000 * Math.pow(1.04, e.mes / 12), 1e-12));
  assert.ok(s.eventos.every(e => e.atingido));
  t.diagnostic(`última viagem custa ${s.eventos[4].valorNominal.toFixed(0)} nominais`);
});

test('P8 outras rendas cobrem a renda desejada: a carteira não precisa gerar nada', t => {
  const rendaCarteira = Math.max(0, 8000 - 10000);   // regra da página: max(0, renda − outras rendas)
  const m = P.patrimonioNecessario(rendaCarteira, META_SPREAD);
  assert.equal(m, 0);
  const r = cen({ aporteMensal: 500, metaHoje: m });
  assert.equal(r.mesLiberdade, 0);
  assert.equal(r.aporteNecessario, 0);
  t.diagnostic('meta zero → atingida desde hoje');
});

test('P9 prazos extremos: 1 ano confere; 70 anos sem alcançar a meta devolve "não atinge"', t => {
  const r1 = cen({ patrimonioInicial: 10000, aporteMensal: 1000, anosParaRenda: 1, metaHoje: meta(1000) });
  perto(r1.projetadoNominal, vf(10000, 1000, 0.10, 12), 1e-12);
  const r70 = cen({ aporteMensal: 100, rentabNominalAnual: 0.08, anosParaRenda: 70, mesesMaximo: 70 * 12, metaHoje: meta(50000) });
  perto(r70.projetadoNominal, vf(0, 100, 0.08, 840), 1e-9);
  assert.equal(r70.mesLiberdade, null);
  assert.ok(Number.isFinite(r70.aporteNecessario));
  t.diagnostic(`70 anos: projetado ${r70.projetadoNominal.toFixed(0)} × meta ${r70.metaHoje.toFixed(0)} | aporte necessário ${r70.aporteNecessario.toFixed(0)}`);
});

test('P10 rentabilidade e inflação zero: patrimônio = inicial + aportes; aporte necessário = falta ÷ meses', t => {
  const r = cen({ patrimonioInicial: 100000, aporteMensal: 2000, rentabNominalAnual: 0, inflacaoAnual: 0, anosParaRenda: 10, metaHoje: 1e6 });
  perto(r.projetadoNominal, 100000 + 2000 * 120, 1e-12);
  perto(r.aporteNecessario, (1e6 - 100000) / 120, 1e-9);
  assert.equal(r.mesLiberdade, Math.ceil((1e6 - 100000) / 2000));
  t.diagnostic(`aporte necessário ${r.aporteNecessario.toFixed(2)} (falta R$ 900 mil em 120 meses)`);
});

test('P11 valores extremos: R$ 500 mi sem erro numérico; meta de R$ 10 mi/mês em 1 ano é inviável (null)', t => {
  const r = cen({ patrimonioInicial: 5e8, aporteMensal: 0, anosParaRenda: 5, metaHoje: meta(3e6) });
  perto(r.projetadoNominal, 5e8 * Math.pow(1.10, 5), 1e-9);
  assert.ok(r.atinge);
  const inv = cen({ aporteMensal: 0, anosParaRenda: 1, metaHoje: meta(1e7) });
  assert.equal(inv.aporteNecessario, null, 'exigiria mais de R$ 100 milhões por mês');
  t.diagnostic(`meta de R$ 10 mi/mês = ${meta(1e7).toExponential(3)} → aporte inviável`);
});

test('P12 curvas de consumo: consumir 6% com 10% e IPCA 4% preserva o poder de compra; 5,16% acumula; 10% deteriora', t => {
  const curvas = P.curvasConsumo({ patrimonioInicial: 1e6, rentabNominalAnual: 0.10, inflacaoAnual: 0.04, taxasConsumo: [0.06, 0.0516, 0.10], anos: 30 });
  assert.deepEqual(curvas.map(c => c.tipo), ['perpetuidade', 'acumulo', 'deterioracao']);
  perto(curvas[0].serie[30].real, 1e6, 1e-9, 'perpetuidade mantém R$ 1 mi de hoje');
  perto(curvas[2].serie[30].real, 1e6 * Math.pow(1 / 1.04, 30), 1e-9, 'consumo igual ao nominal: perde a inflação');
  t.diagnostic(`em 30 anos (R$ de hoje): 6% → ${curvas[0].serie[30].real.toFixed(0)} | 5,16% → ${curvas[1].serie[30].real.toFixed(0)} | 10% → ${curvas[2].serie[30].real.toFixed(0)}`);
});

test('P13 renda consumindo o capital: taxa zero = P ÷ n; 5% real em 30 anos zera o saldo; taxa real negativa', t => {
  assert.equal(P.rendaComConsumo(1.2e6, 0, 120), 10000);
  const i = im(0.05), n = 360, pmt = P.rendaComConsumo(1e6, 0.05, n);
  perto(pmt, 1e6 * i / (1 - Math.pow(1 + i, -n)), 1e-12);
  let saldo = 1e6; for (let k = 0; k < n; k++) saldo = saldo * (1 + i) - pmt;
  assert.ok(Math.abs(saldo) < 1e-4, 'saldo final zero');
  const neg = P.rendaComConsumo(1e6, -0.02, 240);
  assert.ok(neg > 0 && neg < 1e6 / 240, 'com perda real a renda fica abaixo de P ÷ n');
  t.diagnostic(`R$ 1 mi a 5% real por 30 anos: ${pmt.toFixed(2)}/mês | a −2% por 20 anos: ${neg.toFixed(2)}/mês`);
});

test('P14 aportar mais ou render mais: R$ 1.000 a 14% × R$ 2.500 a 6% em 30 anos e a taxa de empate', t => {
  const c = P.compararAportes({ aporteMensal: 1000, rentabNominalAnual: 0.14 }, { aporteMensal: 2500, rentabNominalAnual: 0.06 }, { meses: 360, inflacaoAnual: 0.04 });
  perto(c.a.nominal, vf(0, 1000, 0.14, 360), 1e-9);
  perto(c.b.nominal, vf(0, 2500, 0.06, 360), 1e-9);
  assert.equal(c.maior, c.a.nominal >= c.b.nominal ? 'a' : 'b');
  const menor = c.maior === 'a' ? { p: 2500 } : { p: 1000 };
  perto(vf(0, menor.p, c.taxaEmpate, 360), Math.max(c.a.nominal, c.b.nominal), 1e-6, 'na taxa de empate os dois empatam');
  t.diagnostic(`R$ 1.000 a 14% → ${c.a.nominal.toFixed(0)} | R$ 2.500 a 6% → ${c.b.nominal.toFixed(0)} | vence ${c.maior} por ${c.vezes.toFixed(2)}× | empate a ${(c.taxaEmpate * 100).toFixed(2)}%`);
});

test('P15 robustez: 400 casos aleatórios sem NaN; o aporte necessário atinge a meta e 1% a menos não atinge', t => {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let comAporte = 0;
  for (let k = 0; k < 400; k++) {
    const o = { patrimonioInicial: Math.round(rnd() * 2e6), aporteMensal: Math.round(rnd() * 20000), rentabNominalAnual: rnd() * 0.18 - 0.02,
      inflacaoAnual: rnd() * 0.12, anosParaRenda: 1 + Math.floor(rnd() * 45), reajusteAporte: rnd() < 0.5, metaHoje: meta(1000 + rnd() * 80000) };
    const r = cen(o);
    for (const v of [r.projetadoNominal, r.projetadoReal, r.lacuna, r.excedente]) assert.ok(Number.isFinite(v), 'caso ' + k);
    if (r.aporteNecessario > 0) {
      comAporte++;
      const fim = a => P.simular({ patrimonioInicial: o.patrimonioInicial, aporteMensal: a, rentabNominalAnual: o.rentabNominalAnual,
        inflacaoAnual: o.inflacaoAnual, meses: r.mesesAteRenda, reajusteAporte: o.reajusteAporte }).final.nominal;
      assert.ok(fim(r.aporteNecessario) >= o.metaHoje - 1e-6, 'atinge, caso ' + k);
      assert.ok(fim(r.aporteNecessario * 0.99) < o.metaHoje, 'mínimo, caso ' + k);
    }
  }
  t.diagnostic(`400 casos, ${comAporte} com aporte necessário conferido`);
});
