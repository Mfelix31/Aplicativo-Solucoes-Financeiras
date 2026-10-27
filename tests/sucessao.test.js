// Testes do motor de Planejamento Sucessório. Rodar: node --test tests/
// Referências conferidas de forma independente: leis estaduais (faixas), exemplos
// publicados (quantocustainventario.com.br, set/2026), a planilha "Sicoob - Seguro
// Whole Life.xlsx" (valores linha a linha) e contas feitas à mão/Python.
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../engine/sucessao.js');
const T = require('../dados/itcmd-uf.js');

const perto = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, (msg || '') + ` esperado ${b}, obtido ${a}`);

/* ---------- ITCMD por estado ---------- */
test('MT: R$ 5 milhões, dois filhos → ITCMD R$ 157.456 (faixas sucessivas, isenção até 1.500 UPF)', () => {
  // por quinhão de R$ 2,5 mi: 0 + 2%·659.925 + 4%·1.055.880 + 6%·388.240 = R$ 78.728,10
  perto(S.itcmdDividido(5e6, 2, 'MT', 'vigente', 'heranca'), 157456.2, 0.01);
  assert.equal(S.itcmdValor(395955, T.tabela('MT').heranca), 0);
});

test('MT: doação tem tabela própria (isenta até 500 UPF; 8% acima de 10.000 UPF)', () => {
  const d = T.tabela('MT').doacao;
  assert.equal(S.itcmdValor(500 * T.UNIDADES.UPF_MT, d), 0);
  perto(S.itcmdValor(1000 * T.UNIDADES.UPF_MT, d), 500 * T.UNIDADES.UPF_MT * 0.02, 1e-6);
});

test('MS: 6% fixo com isenção "tudo ou nada" até R$ 100 mil por herdeiro; doação 3%', () => {
  const h = T.tabela('MS').heranca;
  assert.equal(S.itcmdValor(100000, h), 0);
  perto(S.itcmdValor(100001, h), 6000.06, 1e-6);
  perto(S.itcmdDividido(500000, 2, 'MS', 'vigente', 'heranca'), 30000, 1e-6); // exemplo publicado: R$ 30.000
  perto(S.itcmdValor(200000, T.tabela('MS').doacao), 6000, 1e-6);
});

test('RO: a alíquota da faixa incide sobre o quinhão inteiro (degrau em 1.250 UPF)', () => {
  const h = T.tabela('RO').heranca, lim = 1250 * T.UNIDADES.UPF_RO;
  perto(S.itcmdValor(lim, h), lim * 0.02, 1e-6);
  perto(S.itcmdValor(lim + 1, h), (lim + 1) * 0.03, 1e-6);
  perto(S.itcmdDividido(500000, 2, 'RO', 'vigente', 'heranca'), 15000, 1e-6); // exemplo publicado: R$ 15.000
  assert.equal(S.itcmdValor(7000, h), 0); // até 62 UPF isento
});

test('PA: faixas sucessivas da Lei 8.868/2019 → R$ 500 mil, dois filhos = R$ 13.495', () => {
  perto(S.itcmdDividido(500000, 2, 'PA', 'vigente', 'heranca'), 13495.35, 0.01);
});

test('regimes: reforma aplica faixas sucessivas em RO; estresse dobra até 16%', () => {
  const lim = 1250 * T.UNIDADES.UPF_RO;
  perto(S.itcmdValor(lim + 1, T.tabela('RO', 'reforma').heranca), lim * 0.02 + 1 * 0.03, 1e-6);
  perto(S.itcmdDividido(5e6, 2, 'MT', 'estresse', 'heranca'), 2 * 157456.2, 0.01);
  assert.ok(T.tabela('MS', 'reforma').hipotese, 'hipótese de MS precisa estar rotulada');
  for (const f of T.tabela('PA', 'estresse').heranca.faixas) assert.ok(f.aliq <= 0.16);
});

/* ---------- custo do inventário ---------- */
test('inventário em cartório MT: componentes do exemplo da modelagem', () => {
  const c = S.custoInventario({ monte: 5e6, imoveis: 2.5e6, herdeiros: 2, uf: 'MT', tipo: 'cartorio' });
  perto(c.itcmd, 157456.2, 0.01);
  assert.equal(c.honorarios, 300000);
  assert.equal(c.registro, 10000);
  assert.equal(c.cartorio, 20000); // 0,5% limitado ao teto de R$ 20 mil
  perto(c.total, 488456.2, 0.01);
});

test('inventário: meação não paga ITCMD; judicial usa custas; RO usa honorários de 10%', () => {
  const sem = S.custoInventario({ monte: 2e6, herdeiros: 2, uf: 'MS' });
  const com = S.custoInventario({ monte: 2e6, herdeiros: 2, uf: 'MS', meacaoPct: 0.5 });
  perto(com.itcmd, sem.itcmd / 2, 1e-6);
  const jud = S.custoInventario({ monte: 2e6, herdeiros: 2, uf: 'MS', tipo: 'judicial' });
  perto(jud.cartorio, 30000, 1e-6);
  perto(jud.honorarios, 160000, 1e-6);
  perto(S.custoInventario({ monte: 500000, herdeiros: 2, uf: 'RO' }).honorarios, 50000, 1e-6); // exemplo publicado
  assert.equal(S.custoInventario({ monte: 0, herdeiros: 2, uf: 'MT' }).total, 0);
});

/* ---------- whole life: planilha Sicoob linha a linha ---------- */
test('whole life reproduz a aba Projeção da planilha (48 anos, R$ 100 mil, IPCA 4%)', () => {
  const p = S.projetarWholeLife({ capital: 100000, anos: 70, ipca: 0.04, idade: 48 }).linhas;
  perto(p[0].capital, 100000, 1e-6);
  perto(p[9].capital, 177752.14172222884, 1e-6);
  perto(p[29].capital, 638203.13912836264, 1e-5);
  perto(p[0].parcelaMensal, 637.15, 1e-9);
  perto(p[9].parcelaMensal, 906.86312128434906, 1e-6);
  assert.equal(p[10].parcelaMensal, 0);
  assert.equal(p[1].resgatavel, 0);
  perto(p[2].resgatavel, 3837.0225012503015, 1e-4);
  perto(p[5].resgatavel, 35598.391928713041, 1e-3);
  perto(p[9].resgatavel, 72083.326238590322, 1e-3);
  perto(p[10].resgatavel, 73701.285963891656, 1e-3);
  perto(p[29].resgatavel, 110180.67487894997, 1e-2);
  perto(p[69].resgatavel, 185252.9020680105, 1e-1);
  assert.equal(p[9].idade, 58);
});

test('whole life: parcela proporcional ao capital; desembolso real de 10 anos', () => {
  const p = S.projetarWholeLife({ capital: 900000, anos: 10, ipca: 0.04 }).linhas;
  perto(p[0].parcelaMensal, 637.15 * 9, 1e-9);
  const esperado = 637.15 * 12 * ((Math.pow(1.04, 10) - 1) / 0.04); // R$ 91.797 por R$ 100 mil
  perto(p[9].desembolsoAcumulado, esperado * 9, 1e-4);
});

test('"o prêmio é bom?": parcelas aplicadas alcançam o capital aos 79, 64 e 60 anos (entrada aos 48)', () => {
  const o = { capital: 100000, ipca: 0.04 };
  assert.equal(S.anoEquilibrioSeguro(o, 0.08), 31);
  assert.equal(S.anoEquilibrioSeguro(o, 0.10), 16);
  assert.equal(S.anoEquilibrioSeguro(o, 0.12), 12);
});

/* ---------- previdência ---------- */
test('IR regressivo da previdência no pagamento', () => {
  assert.equal(S.aliquotaIRPrevidencia(1), 0.35);
  assert.equal(S.aliquotaIRPrevidencia(5), 0.25);
  assert.equal(S.aliquotaIRPrevidencia(10), 0.15);
  assert.equal(S.aliquotaIRPrevidencia(11), 0.10);
});

test('previdência que paga sozinha o inventário: X = 18%/1,18 do patrimônio (sem ganho a tributar)', () => {
  const r = S.analisar({ idade: 55, uf: 'MT', herdeiros: 2, aplicacoes: 5e6, premissas: { rentabilidade: 0, ipca: 0 } });
  assert.ok(r.ok);
  perto(r.previdencia.X / 5e6, 0.18 / 1.18, 1e-6);
  assert.equal(r.seguroDesnecessario, true);
});

/* ---------- aluguel: pessoa física × holding ---------- */
test('IRPF 2026: até R$ 5 mil por mês fica zerado pelo redutor; R$ 22 mil paga 27,5%', () => {
  assert.equal(S.tributacaoAluguel({ aluguelMensal: 5000, ano: 2026 }).pf.ir, 0);
  // (22.000 − 607,20) × 27,5% − 908,73 = 4.974,29 por mês
  perto(S.tributacaoAluguel({ aluguelMensal: 22000, ano: 2026 }).pf.ir, 4974.29 * 12, 0.01);
});

test('holding no presumido em 2026: 11,33% da receita antes da contabilidade', () => {
  const t = S.tributacaoAluguel({ aluguelMensal: 22000, ano: 2026, contabilMensal: 0 });
  perto(t.holding.total, 264000 * 0.1133, 0.01);
});

test('IBS/CBS: só para grande locador PF (> R$ 240 mil e > 3 imóveis); IBS em fases de 2029 a 2033', () => {
  assert.equal(S.tributacaoAluguel({ aluguelMensal: 22000, nImoveisAlugados: 3, ano: 2033 }).pf.iva, 0);
  assert.ok(S.tributacaoAluguel({ aluguelMensal: 22000, nImoveisAlugados: 4, ano: 2033 }).pf.iva > 0);
  assert.equal(S.faseIBS(2028), 0);
  perto(S.faseIBS(2030), 0.2, 1e-12);
  assert.equal(S.faseIBS(2033), 1);
});

test('IRPFM: zero até R$ 600 mil; 10% acima de R$ 1,2 milhão, descontado o IR pago', () => {
  assert.equal(S.irpfm(600000, 0), 0);
  perto(S.irpfm(900000, 0), 45000, 1e-6);
  perto(S.irpfm(2e6, 50000), 150000, 1e-6);
});

/* ---------- regra de recomendação ---------- */
const fake = (id, valor, protege, complexidade) => ({ id, protegeJa: protege, faltaRecurso: false, complexidade,
  em: { expectativa: { familiaReal: valor }, proximo: { familiaReal: valor }, dez: { familiaReal: valor } } });

test('recomendação: fora quem não protege; empate abaixo de 3% favorece o mais simples', () => {
  const r = S.recomendar([fake('holdingTotal', 1020, true, 4), fake('previdencia', 1000, true, 1), fake('seguro', 2000, false, 2)], 0.03);
  assert.equal(r.vencedor, 'previdencia');
  assert.equal(r.maiorValor, 'holdingTotal');
  assert.equal(r.porSimplicidade, true);
  const r2 = S.recomendar([fake('holdingTotal', 1100, true, 4), fake('previdencia', 1000, true, 1)], 0.03);
  assert.equal(r2.vencedor, 'holdingTotal');
});

/* ---------- análise completa ---------- */
const caso = over => Object.assign({ idade: 55, uf: 'MT', herdeiros: 2, imoveis: 2.5e6, nImoveis: 3, aplicacoes: 2.5e6, rendaMensal: 40000 }, over);

test('análise: hipóteses pela tábua do IBGE e caminhos que cobrem desde já', () => {
  const r = S.analisar(caso());
  assert.ok(r.ok);
  assert.equal(r.Texp, 27); // e(55) = 26,6 anos
  assert.deepEqual(r.hipoteses.map(h => h.ano), [1, 10, 27]);
  const inv = r.caminhos.find(c => c.id === 'inventario');
  assert.equal(inv.protegeJa, false);
  for (const id of ['previdencia', 'seguro', 'doacao', 'holdingTotal']) assert.ok(r.caminhos.find(c => c.id === id).protegeJa, id);
  assert.ok(r.recomendacao.vencedor);
});

test('holding não recomendada quando o patrimônio é principalmente financeiro', () => {
  const r = S.analisar(caso({ imoveis: 800000, nImoveis: 1, aplicacoes: 4.2e6 }));
  assert.equal(r.holding.recomendada, false);
  const ids = r.holding.motivos.map(m => m.id);
  assert.ok(ids.includes('financeiro') && ids.includes('poucosImoveis'), ids.join(','));
  assert.ok(r.holding.custoEvitado > 0);
});

test('sem aplicações suficientes, a previdência não cobre e o seguro entra na combinação', () => {
  const r = S.analisar(caso({ imoveis: 4.9e6, aplicacoes: 100000 }));
  assert.equal(r.seguroDesnecessario, false);
  const comb = r.caminhos.find(c => c.id === 'combinado');
  assert.ok(comb && comb.cfg.C > 0 && comb.protegeJa);
});

test('offshore só aparece com bens no exterior acima do limite', () => {
  assert.ok(!S.analisar(caso({ exterior: 500000 })).caminhos.some(c => c.id === 'offshore'));
  assert.ok(S.analisar(caso({ exterior: 3e6 })).caminhos.some(c => c.id === 'offshore'));
});

test('validação: estado, idade, herdeiros e patrimônio', () => {
  const r = S.analisar({ idade: 10, uf: 'SP', herdeiros: 0 });
  assert.equal(r.ok, false);
  assert.ok(r.erros.length >= 3);
});

/* ---------- whole life por idade e sexo (BR-EMSmt da SUSEP; conferido em Python: scipy.brentq) ---------- */
test('tábuas BR-EMSmt: idades 0..116, q = 1 no fim, conferidas com a planilha da SUSEP', () => {
  const B = require('../dados/tabuas-br-ems.js');
  assert.equal(B.VERSOES['2026'].m.length, 117);
  assert.equal(B.VERSOES['2026'].m[48], 0.0028082592);
  assert.equal(B.VERSOES['2026'].f[70], 0.01372770337);
  assert.equal(B.VERSOES['2021'].m[48], 0.0029891469);
  for (const v of Object.values(B.VERSOES)) for (const s of ['m', 'f']) assert.equal(v[s][v[s].length - 1], 1);
});

test('whole life: fator por idade e sexo calibrado na proposta (homem, 48 anos)', () => {
  const f = (x, o) => S.fatorIdadeWholeLife(x, o).fator;
  perto(f(48), 1, 1e-9);
  perto(S.fatorIdadeWholeLife(48).taxaTecnica, 0.0381165340, 1e-8, 'juros técnicos implícitos');
  perto(f(30), 0.8020689, 1e-6); perto(f(55), 1.0945944, 1e-6); perto(f(70), 1.3726639, 1e-6); perto(f(80), 1.7262621, 1e-6);
  perto(f(48, { sexo: 'f' }), 0.9491189, 1e-6, 'mulher paga menos');
  perto(f(70, { sexo: 'f' }), 1.2847711, 1e-6);
  perto(f(70, { tabua: '2021' }), 1.3839351, 1e-6, 'tábua v.2021');
  for (let x = 25; x < 85; x += 5) assert.ok(f(x + 5) > f(x), 'cresce com a idade');
});

test('whole life: parcela ajustada entra na análise; desligar mantém a planilha', () => {
  const a48 = S.normalizar(caso({ idade: 48 })).wholeLife;
  assert.equal(a48.parcelaPor100k, 637.15);
  const a70 = S.normalizar(caso({ idade: 70 })).wholeLife;
  perto(a70.parcelaPor100k, 637.15 * 1.3726639, 0.01);
  perto(a70.basicaPor100k, 397.23 * 1.3726639, 0.01);
  assert.equal(a70.parcelaReferencia, 637.15);
  const fixo = S.normalizar(caso({ idade: 70, wholeLife: { ajustarIdade: false } })).wholeLife;
  assert.equal(fixo.parcelaPor100k, 637.15);
  const r = S.analisar(caso({ idade: 70 }));
  perto(r.seguro.parcelaInicial, 637.15 * 1.3726639 * r.seguro.capital / 1e5, 0.05);
  assert.notEqual(S.normalizar(caso({ idade: 48, wholeLife: { sexo: 'f' } })).wholeLife.parcelaPor100k, 637.15, 'sexo diferente da referência ajusta mesmo aos 48');
});

/* ---------- regime de bens (contas à mão) ---------- */
test('partilha: meação e concorrência do cônjuge por regime', () => {
  const u = S.partilha({ herdeiros: 2, regime: 'universal' });
  assert.equal(u.meacaoPct, 0.5); assert.equal(u.conjugeHerdeiro, false);
  const p1 = S.partilha({ herdeiros: 2, regime: 'parcial', pctComuns: 1 });
  assert.equal(p1.meacaoPct, 0.5); assert.equal(p1.conjugeHerdeiro, false);
  // parcial, metade comum: herança = 0,25 (comum) + 0,5 (particular) = 0,75; cônjuge 1/3 do particular
  const p = S.partilha({ herdeiros: 2, regime: 'parcial', pctComuns: 0.5 });
  perto(p.meacaoPct, 0.25, 1e-12);
  perto(p.fracConjuge, (0.5 / 3) / 0.75, 1e-12);
  perto(p.quinhoes[0], (0.125 + 0.5 * (2 / 3) / 2) / 0.75, 1e-12);
  perto(p.quinhoes.reduce((a, b) => a + b, 0), 1, 1e-12);
  // separação convencional, 4 filhos comuns: cônjuge com 1/4 (art. 1.832), filhos 3/16 cada
  const s4 = S.partilha({ herdeiros: 4, regime: 'separacao' });
  assert.equal(s4.meacaoPct, 0); perto(s4.fracConjuge, 0.25, 1e-12); perto(s4.quinhoes[0], 0.1875, 1e-12);
  const s4b = S.partilha({ herdeiros: 4, regime: 'separacao', ascendenteComum: false });
  perto(s4b.fracConjuge, 0.2, 1e-12);
  const ob = S.partilha({ herdeiros: 2, regime: 'obrigatoria' });
  assert.equal(ob.meacaoPct, 0); assert.equal(ob.conjugeHerdeiro, false);
  assert.equal(S.partilha({ herdeiros: 2, regime: 'sem', meacaoPct: 0.3 }).meacaoPct, 0.3);
});

test('ITCMD por quinhão quando o cônjuge herda (MT, separação, 2 filhos, R$ 3 milhões)', () => {
  const tab = T.tabela('MT', 'vigente').heranca;
  const esperado = 3 * S.itcmdValor(1e6, tab);   // três quinhões de R$ 1 milhão
  const inv = S.custoInventario({ monte: 3e6, imoveis: 0, meacaoPct: 0, herdeiros: 2, quinhoes: [1 / 3, 1 / 3, 1 / 3], uf: 'MT', tipo: 'cartorio' });
  perto(inv.itcmd, esperado, 1e-6);
  assert.ok(inv.itcmd < S.itcmdDividido(3e6, 2, 'MT', 'vigente', 'heranca'), 'mais quinhões, menos imposto progressivo');
  const r = S.analisar(caso({ conjuge: { regime: 'separacao' } }));
  assert.equal(r.entrada.partilha.quinhoes.length, 3);
});

test('legítima e parte disponível: metade da herança cada', () => {
  const r = S.analisar(caso({ conjuge: { regime: 'universal' } }));
  perto(r.base.meacao, 2.5e6, 1e-6);
  perto(r.base.heranca, 2.5e6, 1e-6);
  perto(r.base.legitima, 1.25e6, 1e-6); perto(r.base.disponivel, 1.25e6, 1e-6);
});

/* ---------- sustento da família durante o inventário ---------- */
test('sustento: meses de despesas somados à meta, com padrão por tipo de inventário', () => {
  assert.equal(S.normalizar(caso({ tipoInventario: 'judicial', sustento: { despesaMensal: 20000 } })).sustento.meses, 24);
  assert.equal(S.normalizar(caso({ sustento: { despesaMensal: 20000, meses: 6 } })).sustento.meses, 6);
  const sem = S.analisar(caso({ tipoInventario: 'judicial' }));
  const com = S.analisar(caso({ tipoInventario: 'judicial', sustento: { despesaMensal: 20000 } }));
  perto(com.base.metaHoje - sem.base.metaHoje, 480000, 1e-6);
  const a1 = com.caminhos.find(c => c.id === 'inventario').sim.anos[0];
  perto(a1.sustento, 480000 * 1.04, 1e-6);
  assert.ok(com.previdencia.X > sem.previdencia.X, 'previdência maior para cobrir o sustento');
  assert.equal(S.analisar(caso({ sustento: { despesaMensal: -1 } })).ok, false);
});

test('dados: todo estado tem lei, unidade, mês da unidade e mês da última revisão', () => {
  for (const [uf, e] of Object.entries(T.ESTADOS)) {
    assert.match(e.dataRef, /^\d{4}-\d{2}$/, uf);
    assert.match(e.revisadoEm, /^\d{4}-\d{2}$/, uf);
    assert.ok(e.lei && e.unidade && e.unidade.valor > 0, uf);
  }
});
