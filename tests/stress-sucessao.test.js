// Stress test do Planejamento Sucessório (engine/sucessao.js): 15 cenários variados.
// ITCMD conferido com as faixas da lei escritas aqui à mão (MT: Lei 7.850/2002 em UPF;
// MS: 6% com isenção até R$ 100 mil por herdeiro), partilha pelo Código Civil e IR de
// ganho de capital pela Lei 13.259/2016. Rodar: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../engine/sucessao.js');

const perto = (a, b, tolAbs, msg) => assert.ok(Math.abs(a - b) <= tolAbs, `${msg || ''} ${a} ≠ ${b}`);
const UPF = 263.97;
const FAIXAS_MT = [[1500 * UPF, 0], [4000 * UPF, 0.02], [8000 * UPF, 0.04], [16000 * UPF, 0.06], [Infinity, 0.08]];
/** ITCMD de MT sobre um quinhão, faixa a faixa */
const itcmdMT = q => { let t = 0, ant = 0; for (const [ate, a] of FAIXAS_MT) { if (q > ant) t += (Math.min(q, ate) - ant) * a; ant = ate; } return t; };
const caso = o => Object.assign({ idade: 60, uf: 'MT', herdeiros: 2, aplicacoes: 0, rendaMensal: 30000 }, o);
const inv = r => r.caminhos.find(c => c.id === 'inventario');

test('S1 patrimônio abaixo da isenção de MT (R$ 600 mil, 2 herdeiros): ITCMD zero e custo pela lei + 5% de margem', t => {
  const r = S.analisar(caso({ aplicacoes: 6e5 }));
  const c = r.base.custoHoje;
  assert.equal(c.itcmd, 0, 'quinhão de R$ 300 mil < 1.500 UPF');
  perto(c.total, 0.06 * 6e5 + 0.005 * 6e5 + 1000, 1e-6, 'honorários 6% + escritura 0,5% + certidões');
  perto(r.base.metaInventarioHoje, c.total + 0.05 * 6e5, 1e-6);
  t.diagnostic(`custo esperado ${r.base.metaInventarioHoje.toFixed(0)} = ${(r.base.pctEsperado * 100).toFixed(2)}% do patrimônio`);
});

test('S2 mesmo patrimônio (R$ 8 mi), 1 a 4 herdeiros: ITCMD por quinhão cai com mais herdeiros', t => {
  const v = [1, 2, 3, 4].map(n => S.itcmdDividido(8e6, n, 'MT', 'vigente', 'heranca'));
  [1, 2, 3, 4].forEach((n, k) => perto(v[k], n * itcmdMT(8e6 / n), 0.01, `${n} herdeiros`));
  assert.ok(v[0] > v[1] && v[1] > v[2] && v[2] > v[3]);
  t.diagnostic(v.map((x, k) => `${k + 1}: ${x.toFixed(0)} (${(x / 8e6 * 100).toFixed(2)}%)`).join(' | '));
});

test('S3 comunhão parcial com tudo comum: meação de 50% fora do ITCMD e 2º inventário do cônjuge considerado', t => {
  const r = S.analisar(caso({ aplicacoes: 6e6, conjuge: { regime: 'parcial', pctComuns: 1 } }));
  assert.equal(r.entrada.partilha.conjugeHerdeiro, false);
  perto(r.base.meacao, 3e6, 1e-6);
  perto(r.base.custoHoje.heranca, 3e6, 1e-6);
  perto(r.base.custoHoje.itcmd, 2 * itcmdMT(1.5e6), 0.01);
  assert.ok(r.base.conjugeHoje && r.base.conjugeHoje.total > 0, 'inventário futuro do cônjuge sobre a meação');
  t.diagnostic(`ITCMD ${r.base.custoHoje.itcmd.toFixed(0)} | 2º inventário ${r.base.conjugeHoje.total.toFixed(0)}`);
});

test('S4 separação convencional, 2 filhos: o cônjuge herda em igualdade (CC, art. 1.829, I)', t => {
  const p = S.partilha({ herdeiros: 2, regime: 'separacao', ascendenteComum: true });
  assert.equal(p.meacaoPct, 0);
  p.quinhoes.forEach(q => perto(q, 1 / 3, 1e-12));
  t.diagnostic('quinhões: 1/3 para cada filho e 1/3 para o cônjuge');
});

test('S5 comunhão parcial com 40% comuns e 4 filhos: cônjuge herda só nos particulares, com o mínimo de 1/4 (art. 1.832)', t => {
  const p = S.partilha({ herdeiros: 4, regime: 'parcial', pctComuns: 0.4, ascendenteComum: true });
  perto(p.meacaoPct, 0.2, 1e-12);
  // herança = 20% comuns herdados + 60% particulares; cônjuge leva 1/4 dos particulares
  perto(p.fracConjuge, 0.6 * 0.25 / 0.8, 1e-12);
  p.quinhoes.slice(0, 4).forEach(q => perto(q, (0.2 / 4 + 0.6 * 0.75 / 4) / 0.8, 1e-12));
  perto(p.quinhoes.reduce((a, b) => a + b, 0), 1, 1e-12);
  const sem = S.partilha({ herdeiros: 4, regime: 'parcial', pctComuns: 0.4, ascendenteComum: false });
  perto(sem.fracConjuge, 0.6 * 0.2 / 0.8, 1e-12, 'sem ascendente comum: quota igual (1/5)');
  t.diagnostic(`cônjuge ${(p.fracConjuge * 100).toFixed(2)}% da herança; cada filho ${(p.quinhoes[0] * 100).toFixed(3)}%`);
});

test('S6 bens em dois estados: fazenda em MS paga ITCMD de MS; casa e aplicações, de MT (domicílio)', t => {
  const r = S.analisar(caso({ bens: [{ tipo: 'fazenda', uf: 'MS', qtd: 1, valor: 4e6 }, { tipo: 'urbano', uf: 'MT', qtd: 1, valor: 1e6 }], aplicacoes: 1e6 }));
  const c = r.base.custoHoje;
  perto(c.itcmdPorUF.MS, 0.06 * 4e6, 0.01, 'MS: 6% acima de R$ 100 mil por herdeiro');
  perto(c.itcmdPorUF.MT, 2 * itcmdMT(1e6), 0.01, 'MT: R$ 2 mi ÷ 2 herdeiros');
  t.diagnostic(`MS ${c.itcmdPorUF.MS.toFixed(0)} + MT ${c.itcmdPorUF.MT.toFixed(2)} = ${c.itcmd.toFixed(2)}`);
});

test('S7 dívidas maiores que os bens: herdeiros não pagam o excedente e a previdência não responde por ele (CC, art. 1.792)',
  { todo: 'achado novo: o excedente da dívida é descontado do que a família recebe (fica negativo e consome a previdência)' }, t => {
    const r = S.analisar(caso({ bens: [{ tipo: 'urbano', uf: 'MT', qtd: 1, valor: 2e6 }], dividas: 3e6 }));
    assert.equal(r.base.monteHoje, 0);
    assert.equal(r.base.custoHoje.itcmd, 0);
    perto(r.base.dividaExcedente, 1e6, 1e-6);
    const fam = inv(r).em.proximo.familiaReal;
    const comPrev = S.analisar(caso({ bens: [{ tipo: 'urbano', uf: 'MT', qtd: 1, valor: 2e6 }], previdencia: 1e6, dividas: 3e6, premissas: { rentabilidade: 0, ipca: 0 } }));
    const anoP = inv(comPrev).sim.anos[0];
    t.diagnostic(`família recebe ${fam.toFixed(0)} sem previdência; com R$ 1 mi de previdência (líquida ${anoP.previdenciaLiquida.toFixed(0)}) recebe ${inv(comPrev).em.proximo.familiaReal.toFixed(0)}`);
    assert.ok(fam >= 0, 'nunca negativo');
    assert.ok(inv(comPrev).em.proximo.familiaReal >= anoP.previdenciaLiquida - 1, 'a previdência chega inteira aos beneficiários');
  });

test('S8 previdência de R$ 1 mi (R$ 600 mil aportados, 12 anos): IR de 10% sobre o rendimento no VGBL e sobre tudo no PGBL', t => {
  const prev = tipo => inv(S.analisar(caso({ aplicacoes: 1e6, previdencia: 1e6, previdenciaAportado: 6e5, previdenciaAnos: 12, previdenciaTipo: tipo,
    premissas: { rentabilidade: 0, ipca: 0 } }))).sim.anos[0].previdenciaLiquida;
  perto(prev('vgbl'), 1e6 - 0.10 * 4e5, 1e-6);
  perto(prev('pgbl'), 1e6 - 0.10 * 1e6, 1e-6);
  assert.equal(S.aliquotaIRPrevidencia(2), 0.35);
  assert.equal(S.aliquotaIRPrevidencia(11), 0.10);
  t.diagnostic(`VGBL líquido ${prev('vgbl').toFixed(0)} | PGBL líquido ${prev('pgbl').toFixed(0)}`);
});

test('S9 seguro já contratado cobre o inventário: a solução não recomenda seguro novo', t => {
  const r = S.analisar(caso({ idade: 55, aplicacoes: 1e7, seguroExistente: 5e6, rendaMensal: 50000 }));
  assert.ok(inv(r).protegeJa, 'sem planejar já cobre desde o 1º ano');
  assert.ok(r.seguroDesnecessario);
  const venc = r.caminhos.find(c => c.id === r.recomendacao.vencedor);
  assert.equal(venc.cfg.C || 0, 0, 'sem seguro novo');
  t.diagnostic(`cobertura sem planejar ${(inv(r).coberturaAno1 * 100).toFixed(0)}% | solução: ${r.recomendacao.vencedor}`);
});

test('S10 cooperado de 85 anos: expectativa curta (7 anos), seguro mais caro e ainda assim uma solução', t => {
  const mk = idade => S.analisar(caso({ idade, herdeiros: 3, bens: [{ tipo: 'fazenda', uf: 'MT', qtd: 2, valor: 2e7 }], aplicacoes: 2e6, rendaMensal: 60000 }));
  const r85 = mk(85), r55 = mk(55);
  assert.ok(r85.ok);
  assert.equal(r85.Texp, Math.round(S.expectativaSobrevida(85)));
  assert.ok(r85.caminhos.some(c => c.id === r85.recomendacao.vencedor));
  assert.ok(r85.entrada.wholeLife.parcelaPor100k > r55.entrada.wholeLife.parcelaPor100k, 'parcela por R$ 100 mil sobe com a idade');
  t.diagnostic(`85 anos: e(x) ${S.expectativaSobrevida(85)} | parcela por R$ 100 mil ${r85.entrada.wholeLife.parcelaPor100k.toFixed(2)} × ${r55.entrada.wholeLife.parcelaPor100k.toFixed(2)} aos 55 | solução ${r85.recomendacao.vencedor}`);
});

test('S11 limites de idade: 18 e 100 anos aceitos; 17 e 101 recusados', t => {
  assert.ok(S.analisar(caso({ idade: 18, aplicacoes: 1e6 })).ok);
  const r100 = S.analisar(caso({ idade: 100, aplicacoes: 1e6 }));
  assert.ok(r100.ok);
  assert.equal(r100.Texp, Math.max(1, Math.round(S.expectativaSobrevida(100))));
  for (const idade of [17, 101]) assert.ok(S.analisar(caso({ idade, aplicacoes: 1e6 })).erros.some(m => /idade/.test(m)));
  t.diagnostic(`18 anos: horizonte ${S.analisar(caso({ idade: 18, aplicacoes: 1e6 })).Texp} anos | 100 anos: ${r100.Texp}`);
});

test('S12 offshore só entra com bens no exterior acima do limite (R$ 2 mi)', t => {
  const acima = S.analisar(caso({ aplicacoes: 5e6, exterior: 3e6, rendaMensal: 50000 }));
  const abaixo = S.analisar(caso({ aplicacoes: 5e6, exterior: 1e6, rendaMensal: 50000 }));
  assert.ok(acima.caminhos.some(c => c.offshore));
  assert.ok(!abaixo.caminhos.some(c => c.offshore));
  t.diagnostic(`variante avaliada: ${acima.caminhos.filter(c => c.offshore).map(c => c.id).join(', ')} | solução ${acima.recomendacao.vencedor}`);
});

test('S13 ganho de capital: imóveis de R$ 40 mi com custo de R$ 2 mi → IR pelas faixas de 15% a 22,5%', t => {
  const g = S.analisar(caso({ bens: [{ tipo: 'urbano', uf: 'MT', qtd: 1, valor: 4e7 }], custoAquisicaoImoveis: 2e6, aplicacoes: 1e6, rendaMensal: 100000 })).ganhoCapital;
  perto(g.ir, 5e6 * 0.15 + 5e6 * 0.175 + 2e7 * 0.20 + 8e6 * 0.225, 1e-6);
  assert.equal(S.irGanhoCapital(0), 0);
  assert.equal(S.analisar(caso({ bens: [{ tipo: 'urbano', uf: 'MT', qtd: 1, valor: 1e6 }], custoAquisicaoImoveis: 2e6 })).ganhoCapital.ir, 0, 'sem ganho, sem IR');
  t.diagnostic(`ganho ${g.ganho.toFixed(0)} → IR ${g.ir.toFixed(0)} (${(g.aliquotaMedia * 100).toFixed(2)}% médio)`);
});

test('S14 tabela própria de ITCMD (4% fixo): vale no lugar da tabela do estado; alíquota de 25% é recusada', t => {
  const r = S.analisar(caso({ aplicacoes: 5e6, itcmdManual: { faixas: [{ ate: 0, aliq: 0.04 }] } }));
  perto(r.base.custoHoje.itcmd, 0.04 * 5e6, 1e-6);
  assert.ok(S.analisar(caso({ aplicacoes: 5e6, itcmdManual: { faixas: [{ ate: 0, aliq: 0.25 }] } })).erros.some(m => /Tabela própria/.test(m)));
  t.diagnostic(`ITCMD com a tabela própria: ${r.base.custoHoje.itcmd.toFixed(0)}`);
});

test('S15 robustez: 100 famílias aleatórias — sempre uma solução, números válidos, estresse ≥ lei vigente', async t => {
  let seed = 23;
  const estresseAbaixo = [];
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ufs = ['MT', 'MS', 'RO', 'PA', 'SP', 'GO', 'PR'], tipos = ['urbano', 'terreno', 'fazenda', 'veiculo', 'rebanho'], regimes = ['sem', 'parcial', 'universal', 'separacao'];
  let infinitos = 0;
  for (let k = 0; k < 100; k++) {
    const bens = Array.from({ length: Math.floor(rnd() * 4) }, () => ({ tipo: tipos[Math.floor(rnd() * tipos.length)], uf: ufs[Math.floor(rnd() * ufs.length)], qtd: 1 + Math.floor(rnd() * 4), valor: Math.round(rnd() * 2e7) }));
    const e = { idade: 25 + Math.floor(rnd() * 70), uf: ufs[Math.floor(rnd() * ufs.length)], herdeiros: 1 + Math.floor(rnd() * 5), bens,
      aplicacoes: Math.round(rnd() * 1e7) + 1000, previdencia: rnd() < 0.3 ? Math.round(rnd() * 3e6) : 0, seguroExistente: rnd() < 0.2 ? Math.round(rnd() * 3e6) : 0,
      dividas: rnd() < 0.2 ? Math.round(rnd() * 5e6) : 0, rendaMensal: Math.round(rnd() * 2e5), sobraMensal: Math.round(rnd() * 3e4),
      tipoInventario: ['cartorio', 'judicial', 'litigio'][Math.floor(rnd() * 3)], conjuge: { regime: regimes[Math.floor(rnd() * regimes.length)], pctComuns: rnd() },
      premissas: { rentabilidade: [0.08, 0.10, 0.12][Math.floor(rnd() * 3)] } };
    const r = S.analisar(e);
    assert.ok(r.ok, `caso ${k}: ${r.erros}`);
    assert.ok(r.caminhos.some(c => c.id === r.recomendacao.vencedor), 'caso ' + k);
    for (const c of r.caminhos) for (const h of ['proximo', 'dez', 'expectativa']) assert.ok(Number.isFinite(c.em[h].familiaReal), `caso ${k} ${c.id}`);
    for (const c of r.caminhos) if (!Number.isFinite(c.coberturaAno1)) infinitos++;
    if (r.base.regimes.estresse.itcmd < r.base.regimes.vigente.itcmd - 1e-6) estresseAbaixo.push(`${k} (${e.uf}: ${Math.round(r.base.regimes.vigente.itcmd)} → ${Math.round(r.base.regimes.estresse.itcmd)})`);
  }
  t.diagnostic(`100 famílias em 7 estados com solução válida; ${infinitos} caminhos com cobertura infinita (custo esperado zero)`);
  await t.test('o regime de estresse nunca cobra menos ITCMD que a lei vigente',
    { todo: 'achado novo: em estados de alíquota fixa (SP, PR, MS) o estresse parte das faixas de MT com isenção e cobra menos que a lei atual' }, () => {
      t.diagnostic(`estresse abaixo da lei vigente em ${estresseAbaixo.length} de 100 casos: ${estresseAbaixo.slice(0, 5).join('; ')}`);
      assert.deepEqual(estresseAbaixo, []);
    });
});
