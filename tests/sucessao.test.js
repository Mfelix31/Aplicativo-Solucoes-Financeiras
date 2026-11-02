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
  for (const r of T.tabela('PA', 'estresse').heranca.regras) for (const f of (r.faixas || [{ aliq: r.aliquota }])) assert.ok(f.aliq <= 0.16);
  // estresse nunca abaixo da lei vigente: SP (4% fixo) com quinhão de R$ 300 mil
  perto(S.itcmdDividido(6e5, 2, 'SP', 'estresse', 'heranca'), S.itcmdDividido(6e5, 2, 'SP', 'vigente', 'heranca'), 1e-6);
  assert.ok(S.itcmdDividido(2e7, 2, 'SP', 'estresse', 'heranca') > S.itcmdDividido(2e7, 2, 'SP', 'vigente', 'heranca'));
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
  const r = S.analisar({ idade: 55, uf: 'MT', herdeiros: 2, aplicacoes: 5e6, premissas: { rentabilidade: 0, ipca: 0, custoModo: 'fixo' } });
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
const fake = (id, valor, protege, complexidade, cabe, externo) => ({ id, protegeJa: protege, complexidade, cabe: cabe || 'sim',
  coberturaAno1: protege ? 1 : 0.5, pagamento: { externo: externo || 0, externoMensalMax: (externo || 0) / 120 },
  em: { expectativa: { familiaReal: valor }, proximo: { familiaReal: valor }, dez: { familiaReal: valor } } });

test('recomendação: fora quem não protege; empate abaixo de 3% favorece o mais simples', () => {
  const r = S.recomendar([fake('holdingTotal', 1020, true, 4), fake('previdencia', 1000, true, 1), fake('seguro', 2000, false, 2)], 0.03);
  assert.equal(r.vencedor, 'previdencia');
  assert.equal(r.maiorValor, 'holdingTotal');
  assert.equal(r.porSimplicidade, true);
  const r2 = S.recomendar([fake('holdingTotal', 1100, true, 4), fake('previdencia', 1000, true, 1)], 0.03);
  assert.equal(r2.vencedor, 'holdingTotal');
});

test('recomendação sempre devolve uma solução, em níveis', () => {
  // quem pede dinheiro à parte dentro do limite concorre pelo valor; a melhor opção sem pedir nada é informada
  const r1 = S.recomendar([fake('a', 1000, true, 1, 'sim'), fake('b', 1500, true, 2, 'aParte', 50000)], 0.03);
  assert.equal(r1.vencedor, 'b'); assert.equal(r1.nivel, 2); assert.equal(r1.alternativaSemAParte.id, 'a');
  // empate abaixo da margem: vence quem não pede dinheiro de fora, mesmo sendo mais complexo
  const r1b = S.recomendar([fake('a', 1000, true, 4, 'sim'), fake('b', 1020, true, 1, 'aParte', 5000)], 0.03);
  assert.equal(r1b.vencedor, 'a'); assert.equal(r1b.nivel, 1);
  // só cabe pagando à parte dentro do limite
  const r2 = S.recomendar([fake('a', 1000, true, 1, 'aParte', 9e4), fake('b', 900, true, 2, 'aParte', 1e4), fake('c', 5000, false, 0)], 0.03);
  assert.equal(r2.vencedor, 'a'); assert.equal(r2.nivel, 2);
  // nada cabe: vence o que pede menos dinheiro de fora
  const r3 = S.recomendar([fake('a', 1000, true, 1, 'nao', 9e5), fake('b', 800, true, 2, 'nao', 2e5)], 0.03);
  assert.equal(r3.vencedor, 'b'); assert.equal(r3.nivel, 3);
  // nada protege: vence a maior cobertura
  const r4 = S.recomendar([fake('a', 1000, false, 1), Object.assign(fake('b', 900, false, 2), { coberturaAno1: 0.8 })], 0.03);
  assert.equal(r4.vencedor, 'b'); assert.equal(r4.nivel, 4);
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
  for (const id of ['previdencia', 'seguro']) assert.ok(r.caminhos.find(c => c.id === id).protegeJa, id);
  for (const estr of ['doacao', 'holdingGradual', 'holdingTotal']) assert.ok(r.caminhos.some(c => c.estrutura === estr && c.protegeJa), estr);
  // todas as combinações estrutura × liquidez aparecem
  for (const id of ['doacao', 'doacao+previdencia', 'doacao+seguro', 'holdingGradual+seguro', 'holdingTotal+previdencia', 'combinado'])
    assert.ok(r.caminhos.some(c => c.id === id), id);
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
  assert.ok(!S.analisar(caso({ exterior: 500000 })).caminhos.some(c => c.offshore));
  assert.ok(S.analisar(caso({ exterior: 3e6 })).caminhos.some(c => c.offshore && c.id.endsWith('+offshore')));
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

test('custos dos bens travados: somam às despesas da família pelos mesmos meses', () => {
  const so = S.analisar(caso({ tipoInventario: 'judicial', sustento: { despesaMensal: 20000 } }));
  const com = S.analisar(caso({ tipoInventario: 'judicial', sustento: { despesaMensal: 20000, custoBensMensal: 5000 } }));
  perto(com.base.custoBensHoje, 5000 * 24, 1e-6);
  perto(com.base.sustentoFamiliaHoje, 20000 * 24, 1e-6);
  perto(com.base.sustentoHoje, 25000 * 24, 1e-6);
  perto(com.base.metaHoje - so.base.metaHoje, 120000, 1e-6);
  perto(com.caminhos.find(c => c.id === 'inventario').sim.anos[0].sustento, 600000 * 1.04, 1e-6);
  assert.equal(S.analisar(caso({ sustento: { custoBensMensal: -1 } })).ok, false);
});

/* ---------- PGBL anual (dedução de até 12% da renda tributável) ---------- */
const comPGBL = over => caso(Object.assign({ sobraMensal: 10000, pgbl: { elegivel: true, rendaTributavelAnual: 480000 } }, over));

test('PGBL: só entra com declaração completa e renda tributável', () => {
  const sem = S.analisar(caso({ pgbl: { elegivel: false, rendaTributavelAnual: 480000 } }));
  assert.ok(!sem.caminhos.some(c => c.pgbl), 'sem declaração completa não há PGBL');
  assert.ok(!S.analisar(caso({ pgbl: { elegivel: true, rendaTributavelAnual: 0 } })).caminhos.some(c => c.pgbl));
  const r = S.analisar(comPGBL());
  assert.ok(r.caminhos.some(c => c.id === 'pgbl') && r.caminhos.some(c => c.id === 'pgbl+previdencia'));
  perto(r.pgbl.aporteAno, 57600, 1e-9);
  perto(r.pgbl.economiaAno, 57600 * 0.275, 1e-9);
  perto(r.pgbl.economiaTotal, 57600 * 0.275 * 10, 1e-9);
});

test('PGBL: aporte e IR economizado entram no fluxo; IR regressivo sobre todo o saldo, aporte a aporte', () => {
  const r = S.analisar(comPGBL());
  const c = r.caminhos.find(x => x.id === 'pgbl'), ipca = r.entrada.premissas.ipca, rt = r.entrada.premissas.rentabilidade;
  const it1 = c.sim.pagamentos[1].itens;
  perto(it1.pgbl, 57600, 1e-9);
  perto(it1.irPgbl, -57600 * 0.275, 1e-9);
  perto(c.sim.pagamentos[2].itens.pgbl, 57600 * (1 + ipca), 1e-9);
  assert.equal(c.sim.pagamentos[11].itens.pgbl, 0, 'aportes só nos anos configurados');
  // falecimento no fim do ano 2: aporte do ano 1 rendeu um ano; os dois pagam 35% (até 2 anos)
  const a2 = c.sim.anos[1], saldo = 57600 * (1 + rt) + 57600 * (1 + ipca);
  perto(a2.pgbl, saldo, 1e-9);
  perto(a2.irPgbl, 0.35 * saldo, 1e-9);
  // depois de mais de 10 anos de cada aporte, todos pagam 10%
  const a25 = c.sim.anos[24];
  perto(a25.irPgbl, 0.10 * a25.pgbl, 1e-9);
});

test('PGBL: fica fora do inventário e aumenta o valor à família; reduz a previdência necessária', () => {
  const r = S.analisar(comPGBL());
  const prev = r.caminhos.find(x => x.id === 'previdencia'), pp = r.caminhos.find(x => x.id === 'pgbl+previdencia');
  assert.ok(pp.em.expectativa.familiaReal > prev.em.expectativa.familiaReal, 'o IR economizado e o saldo fora do inventário favorecem o PGBL');
  assert.ok(pp.cfg.X <= prev.cfg.X + 1, 'o saldo do PGBL ajuda a pagar o inventário');
  const inv = r.caminhos.find(x => x.id === 'inventario'), so = r.caminhos.find(x => x.id === 'pgbl');
  assert.ok(so.em.dez.monte < inv.em.dez.monte, 'o dinheiro do PGBL sai do monte do inventário');
});

test('PGBL: o aporte é pago pelo fluxo, mas não conta como custo', () => {
  const r = S.analisar(comPGBL());
  const c = r.caminhos.find(x => x.id === 'pgbl'), inv = r.caminhos.find(x => x.id === 'inventario');
  assert.equal(c.sim.custosAno[0], 0);
  assert.ok(c.pagamento.custo < 1, 'sem custo no resumo');
  assert.ok(c.pagamento.daSobra > 0, 'a sobra paga o aporte');
  assert.equal(c.em.expectativa.custosReais, inv.em.expectativa.custosReais);
});

test('PGBL: validação dos parâmetros', () => {
  assert.equal(S.analisar(comPGBL({ pgbl: { elegivel: true, rendaTributavelAnual: 1e5, limitePct: 0.2 } })).ok, false);
  assert.equal(S.analisar(comPGBL({ pgbl: { elegivel: true, rendaTributavelAnual: -1 } })).ok, false);
});

test('dados: todo estado tem lei, unidade, mês da unidade e mês da última revisão', () => {
  for (const [uf, e] of Object.entries(T.ESTADOS)) {
    assert.match(e.dataRef, /^\d{4}-\d{2}$/, uf);
    assert.match(e.revisadoEm, /^\d{4}-\d{2}$/, uf);
    assert.ok(e.lei && e.unidade && e.unidade.valor > 0, uf);
  }
});

test('doação feita hoje paga o ITCMD da lei de hoje, mesmo no regime de estresse', () => {
  const c = { idade: 55, uf: 'MT', herdeiros: 2, imoveis: 4e6, nImoveis: 3, aplicacoes: 4e6 };
  const vig = S.analisar(c), est = S.analisar(Object.assign({}, c, { regime: 'estresse' }));
  const d = r => r.caminhos.find(x => x.id === 'doacao').sim.custoEstruturacao;
  perto(d(est), d(vig), 1e-6);
  // MT: doação com usufruto paga sobre a nua-propriedade (70% do valor); a consolidação é isenta
  perto(d(vig), S.itcmdDividido(4e6 * 0.7, 2, 'MT', 'vigente', 'doacao') + 4e6 * 0.01, 1e-6);
});

test('falta de caixa: quem não cabe nas aplicações aparece com o valor à parte, e sempre há uma solução', () => {
  const r = S.analisar({ idade: 55, uf: 'MT', herdeiros: 3, conjuge: { regime: 'parcial' }, imoveis: 40e6, nImoveis: 10, aplicacoes: 2.5e6, empresa: 1e6, aluguelMensal: 100000, nImoveisAlugados: 10, nResidenciais: 5 });
  assert.ok(r.recomendacao.vencedor);
  const s = r.caminhos.find(c => c.id === 'seguro');
  assert.ok(s.protegeJa && s.pagamento.externo > 0 && s.pagamento.anosExterno.length > 0);
  assert.equal(s.cabe, 'nao');   // sem renda informada, nada pode ser pago à parte
  assert.equal(r.caminhos.find(c => c.id === 'inventario').pagamento.externo, 0);
});

test('quem paga: sobra primeiro, depois rendimentos, depois principal, por fim à parte', () => {
  const e = S.normalizar({ idade: 55, uf: 'MT', herdeiros: 2, imoveis: 1e6, aplicacoes: 100000, sobraMensal: 1000, premissas: { rentabilidade: 0.10, ipca: 0 } });
  // seguro de R$ 1 mi: parcela ≈ R$ 6.976/mês (55 anos) → R$ 83.716/ano
  const sim = S.simular(e, { C: 1e6 }, 3), p1 = sim.pagamentos[1];
  const parcelaAno = e.wholeLife.parcelaPor100k * 10 * 12;
  perto(p1.custo, parcelaAno, 1e-6);
  perto(p1.daSobra, 12000, 1e-6);
  perto(p1.daRendimento, 10000, 1e-6);                  // 10% de R$ 100 mil
  perto(p1.daPrincipal, parcelaAno - 22000, 1e-6);
  assert.equal(p1.externo, 0);
  const p2 = sim.pagamentos[2];                          // as aplicações acabaram: o resto é à parte
  assert.ok(p2.externo > 0);
  perto(p2.daSobra + p2.daRendimento + p2.daPrincipal + p2.externo, p2.custo, 1e-6);
  // o dinheiro de fora tem custo: reduz o valor à família
  const semCusto = S.simular(e, { C: 1e6 }, 3).anos[2];
  assert.ok(semCusto.externoAcumulado > 0);
});

test('limite de comprometimento da renda decide se o pagamento à parte cabe', () => {
  const base = { idade: 55, uf: 'MT', herdeiros: 2, imoveis: 3e6, nImoveis: 2, aplicacoes: 0, rendaMensal: 60000 };
  const r = S.analisar(base);
  const s = r.caminhos.find(c => c.id === 'seguro');
  assert.ok(s.pagamento.externo > 0);
  assert.equal(s.cabe, s.pagamento.externoMensalMax <= 0.3 * 60000 ? 'aParte' : 'nao');
  const r0 = S.analisar(Object.assign({}, base, { premissas: { comprometimentoRenda: 0 } }));
  assert.equal(r0.caminhos.find(c => c.id === 'seguro').cabe, 'nao');
});

/* ---------- sobra mensal e sucessão do casal ---------- */
const grande = over => Object.assign({ idade: 55, uf: 'MT', herdeiros: 3, conjuge: { regime: 'parcial' }, imoveis: 40e6, nImoveis: 10,
  aplicacoes: 2.5e6, empresa: 1e6, aluguelMensal: 100000, nImoveisAlugados: 10, nResidenciais: 5 }, over);

test('sobra mensal entra nas aplicações de todos os caminhos, corrigida pelo IPCA', () => {
  const e0 = S.normalizar(grande({})), e1 = S.normalizar(grande({ sobraMensal: 10000 }));
  const a = (e, t) => S.simular(e, {}, 3).anos[t - 1].aplicacoes;
  perto(a(e1, 1) - a(e0, 1), 120000, 1e-6);
  perto(a(e1, 2) - a(e0, 2), 120000 * 1.10 + 120000 * 1.04, 1e-6);
  assert.equal(S.analisar(grande({ sobraMensal: -1 })).ok, false);
});

test('sucessão do casal: a meação paga um 2º inventário em "só o inventário", e a doação dos imóveis o evita', () => {
  const com = S.analisar(grande({ sobraMensal: 80000 })), sem = S.analisar(grande({ sobraMensal: 80000, sucessaoCasal: false }));
  const inv = r => r.caminhos.find(c => c.id === 'inventario').em.expectativa;
  assert.ok(inv(com).inventarioConjuge.total > 0);
  assert.ok(inv(com).familiaReal < inv(sem).familiaReal);
  const ano1 = com.caminhos.find(c => c.id === 'inventario').sim.anos[0];
  perto(ano1.inventarioConjuge.total, S.custoInventario({ monte: ano1.monte * 0.5, imoveis: 40e6 * 1.04 * 0.5, meacaoPct: 0, herdeiros: 3, uf: 'MT', tipo: 'cartorio' }).total, 1e-6);
  assert.ok(com.base.conjugeHoje.total > 0);
  assert.equal(S.analisar(grande({ conjuge: { regime: 'sem' } })).base.conjugeHoje, null);
});

test('caso de patrimônio imobiliário grande: com sobra mensal e 8% a.a., a holding com doação gradual é recomendada', () => {
  const r = S.analisar(grande({ sobraMensal: 80000, premissas: { rentabilidade: 0.08 } }));
  assert.equal(r.caminhos.find(c => c.id === r.recomendacao.vencedor).estrutura, 'holdingGradual');
  assert.equal(r.holding.recomendada, true);
});

test('PGBL: IR sobre todo o saldo; VGBL: só sobre o rendimento', () => {
  const c = { idade: 55, uf: 'MT', herdeiros: 2, imoveis: 1e6, aplicacoes: 0, previdencia: 1e6, previdenciaAportado: 600000, previdenciaAnos: 15, premissas: { rentabilidade: 0.10 } };
  const liq = tipo => S.simular(S.normalizar(Object.assign({}, c, { previdenciaTipo: tipo })), {}, 1).anos[0].previdenciaLiquida;
  perto(liq('vgbl'), 1.1e6 - 0.10 * (1.1e6 - 600000), 1e-6);
  perto(liq('pgbl'), 1.1e6 * 0.90, 1e-6);
  assert.equal(S.analisar(Object.assign({}, c, { previdenciaTipo: 'outro' })).ok, false);
});

test('modo fixo: custo do inventário na comparação = 18%, inclusive no 2º inventário do cônjuge', () => {
  const fixo = { custoModo: 'fixo' };
  const e = S.normalizar({ idade: 55, uf: 'MT', herdeiros: 2, imoveis: 1e6, aplicacoes: 0, premissas: fixo });
  const a = S.simular(e, {}, 1).anos[0];
  perto(a.custoEsperado, 0.18 * a.monte, 1e-6);
  perto(a.familia, a.monte * 0.82, 1e-6);
  const ec = S.normalizar({ idade: 55, uf: 'MT', herdeiros: 2, imoveis: 1e6, aplicacoes: 0, conjuge: { regime: 'universal' }, premissas: fixo });
  const b = S.simular(ec, {}, 1).anos[0];
  perto(b.familia, b.monte * 0.82 - 0.18 * b.monte * 0.5, 1e-6);
  const r = S.analisar({ idade: 55, uf: 'MT', herdeiros: 2, imoveis: 60e6, aplicacoes: 1e6 });
  assert.equal(r.base.patrimonioGrande, true);
});

/* ---------- custo esperado pela lei + margem de mercado (modo padrão) ---------- */
// Calibração com o usuário (01/11/2026): os 18% observados valem para patrimônios a partir de R$ 10 mi.
// Caso de referência: R$ 10 mi em MT (R$ 6 mi em fazendas, R$ 4 mi em aplicações), 2 herdeiros, sem cônjuge, lei vigente.
// Conta pela lei: 11,34% em cartório e 14,64% judicial (ITCMD 4,89%, faixas de MT conferidas no stress test);
// média 12,99% + margem de 5% ≈ 18%.
const ref10 = tipo => ({ idade: 60, uf: 'MT', herdeiros: 2, tipoInventario: tipo, bens: [{ tipo: 'fazenda', uf: 'MT', qtd: 2, valor: 6e6 }], aplicacoes: 4e6, rendaMensal: 50000 });
test('custo esperado: conta pela lei + 5% de margem; o caso de referência de R$ 10 mi dá 18% na média', () => {
  const c = S.analisar(ref10('cartorio'), { semEstresse: true }).base, j = S.analisar(ref10('judicial'), { semEstresse: true }).base;
  perto(c.metaInventarioHoje, c.custoHoje.total + 0.05 * 1e7, 1e-6);
  perto((c.pctEsperado + j.pctEsperado) / 2, 0.18, 0.003);
  assert.ok(j.pctEsperado > c.pctEsperado, 'judicial custa mais que cartório');
});
test('custo esperado acompanha o patrimônio (ITCMD progressivo) e o tipo de inventário', () => {
  const pct = (v, tipo) => S.analisar({ idade: 60, uf: 'MT', herdeiros: 2, tipoInventario: tipo, bens: [{ tipo: 'fazenda', uf: 'MT', qtd: 1, valor: v * 0.6 }], aplicacoes: v * 0.4 }, { semEstresse: true }).base.pctEsperado;
  const p15 = pct(1.5e6, 'cartorio'), p10 = pct(10e6, 'cartorio'), p50 = pct(50e6, 'cartorio');
  assert.ok(p15 < p10 && p10 < p50, 'cresce com o patrimônio');
  assert.ok(p15 < 0.14, 'família de R$ 1,5 mi fica bem abaixo de 18% (stress test, teste 22)');
  assert.ok(pct(30e6, 'litigio') > 0.20, 'litígio de R$ 30 mi passa de 20% (stress test, teste 24)');
});
test('custo esperado: o 2º inventário do cônjuge usa a mesma regra sobre a meação', () => {
  const r = S.analisar({ idade: 60, uf: 'MT', herdeiros: 2, bens: [{ tipo: 'fazenda', uf: 'MT', qtd: 1, valor: 6e6 }], aplicacoes: 4e6, conjuge: { regime: 'universal' } }, { semEstresse: true });
  const cj = r.base.conjugeHoje;
  perto(cj.total, cj.conferencia.total + 0.05 * 1e7 * 0.5, 1e-6);
  assert.equal(S.analisar(Object.assign(ref10('cartorio'), { premissas: { margemMercado: -0.01 } })).ok, false);
});

/* ---------- dívidas do espólio (stress test MT, teste 28: R$ 20 mi brutos, R$ 8 mi de custeio rural) ---------- */
const espolio = over => Object.assign({ idade: 60, uf: 'MT', herdeiros: 2, bens: [{ tipo: 'fazenda', uf: 'MT', qtd: 1, valor: 16e6 }], aplicacoes: 4e6 }, over);
test('dívidas: saem da base do inventário; no modo fixo, 18% de R$ 12 mi = R$ 2,16 mi (teste 28)', () => {
  const r = S.analisar(espolio({ dividas: 8e6, premissas: { custoModo: 'fixo' } }), { semEstresse: true });
  perto(r.base.monteHoje, 12e6, 1e-6);
  perto(r.base.metaInventarioHoje, 2.16e6, 1e-6);
  // pela lei: o mesmo que um espólio de R$ 12 mi com a mesma proporção entre fazenda e aplicações
  const comDiv = S.analisar(espolio({ dividas: 8e6 }), { semEstresse: true }).base.custoHoje;
  const liquido = S.analisar(espolio({ bens: [{ tipo: 'fazenda', uf: 'MT', qtd: 1, valor: 16e6 * 0.6 }], aplicacoes: 4e6 * 0.6 }), { semEstresse: true }).base.custoHoje;
  perto(comDiv.itcmd, liquido.itcmd, 1e-6);
});
test('dívidas: o valor à família cai pela dívida paga; dívida maior que os bens não deixa monte negativo', () => {
  const sem = S.analisar(espolio(), { semEstresse: true }), com = S.analisar(espolio({ dividas: 8e6 }), { semEstresse: true });
  const a0 = sem.caminhos.find(c => c.id === 'inventario').sim.anos[0], a1 = com.caminhos.find(c => c.id === 'inventario').sim.anos[0];
  perto(a1.divida, 8e6 * 1.04, 1e-6);
  assert.ok(a0.familia - a1.familia > a1.divida * 0.8, 'a família recebe menos, quase o valor da dívida (o custo do inventário também cai)');
  const grande = S.analisar(espolio({ dividas: 30e6 }), { semEstresse: true });
  assert.ok(grande.ok);
  assert.equal(grande.base.monteHoje, 0);
  perto(grande.base.dividaExcedente, 10e6, 1e-6);
  assert.equal(S.analisar(espolio({ dividas: -1 })).ok, false);
});

/* ---------- ganho de capital (stress test MT, teste 30: fazenda de R$ 1 mi que vale R$ 20 mi) ---------- */
test('ganho de capital: faixas da Lei 13.259/2016 sobre o ganho de R$ 19 mi = R$ 3.425.000 (conta à mão)', () => {
  // 5 mi × 15% + 5 mi × 17,5% + 9 mi × 20% = 750 mil + 875 mil + 1,8 mi
  perto(S.irGanhoCapital(19e6), 3425000, 1e-6);
  perto(S.irGanhoCapital(1e6), 150000, 1e-6);
  perto(S.irGanhoCapital(40e6), 750000 + 875000 + 4e6 + 10e6 * 0.225, 1e-6);
  assert.equal(S.irGanhoCapital(0), 0);
  const r = S.analisar({ idade: 60, uf: 'MT', herdeiros: 2, bens: [{ tipo: 'fazenda', uf: 'MT', qtd: 1, valor: 20e6 }], aplicacoes: 1e6, custoAquisicaoImoveis: 1e6 }, { semEstresse: true });
  perto(r.ganhoCapital.ir, 3425000, 1e-6);
  assert.equal(S.analisar({ idade: 60, uf: 'MT', herdeiros: 2, aplicacoes: 1e6 }).ganhoCapital, null);
});

/* ---------- rebanho (stress test MT, teste 21: gado entrava como terra) ---------- */
test('rebanho: bem móvel, ITCMD no domicílio, fora da holding e da doação, acompanha o IPCA', () => {
  const e = S.normalizar({ idade: 60, uf: 'MT', herdeiros: 2, bens: [{ tipo: 'fazenda', uf: 'GO', qtd: 1, valor: 10e6 }, { tipo: 'rebanho', uf: 'GO', qtd: 1, valor: 4e6 }], aplicacoes: 1e6 });
  assert.equal(e.rebanho, 4e6);
  assert.equal(e.imoveis, 10e6);
  assert.deepEqual(Object.keys(e.imoveisPorUF), ['GO']);
  // na holding total, o rebanho continua no inventário: a diferença para o mesmo caso sem rebanho é o rebanho corrigido pelo IPCA
  const semReb = S.normalizar({ idade: 60, uf: 'MT', herdeiros: 2, bens: [{ tipo: 'fazenda', uf: 'GO', qtd: 1, valor: 10e6 }], aplicacoes: 1e6 });
  perto(S.simular(e, { holding: 'total' }, 1).anos[0].monte - S.simular(semReb, { holding: 'total' }, 1).anos[0].monte, 4e6 * 1.04, 1e-6);
  const r = S.analisar({ idade: 60, uf: 'MT', herdeiros: 2, bens: [{ tipo: 'rebanho', uf: 'GO', qtd: 1, valor: 4e6 }], aplicacoes: 1e6 }, { semEstresse: true });
  assert.deepEqual(Object.keys(r.base.custoHoje.itcmdPorUF), ['MT']);
});

test('registro: maior entre o % do valor e o mínimo × nº de imóveis (stress test, teste 26: 5 imóveis, R$ 5 mi)', () => {
  const caso26 = custos => S.analisar({ idade: 60, uf: 'MT', herdeiros: 2, bens: [{ tipo: 'urbano', uf: 'MT', qtd: 5, valor: 5e6 }], aplicacoes: 0, custos }, { semEstresse: true }).base.custoHoje.registro;
  perto(caso26(), 5e6 * 0.004, 1e-6);                              // padrão: 0,4% = R$ 20 mil
  perto(caso26({ registroMinimo: 6000 }), 5 * 6000, 1e-6);          // 5 matrículas × R$ 6 mil = R$ 30 mil
  perto(caso26({ registroMinimo: 1000 }), 5e6 * 0.004, 1e-6);      // o percentual continua maior
});

test('whole life: a cotação do próprio cooperado vale no lugar da estimativa (stress test, teste 25: R$ 2 mi por R$ 5 mil/mês)', () => {
  const e = S.normalizar({ idade: 55, uf: 'MT', herdeiros: 2, aplicacoes: 1e6, wholeLife: { cotacao: { capital: 2e6, parcela: 5000 } } });
  perto(e.wholeLife.parcelaPor100k, 250, 1e-9);
  assert.equal(e.wholeLife.cotacaoCliente, true);
  perto(e.wholeLife.basicaPor100k, 397.23 * 250 / 637.15, 1e-9);
  const sim = S.simular(e, { C: 2e6 }, 1);
  perto(sim.pagamentos[1].itens.seguro, 5000 * 12, 1e-6);
  // sem cotação, segue a estimativa pela idade (55 anos, fator 1,0946)
  assert.ok(Math.abs(S.normalizar({ idade: 55, uf: 'MT', aplicacoes: 1e6 }).wholeLife.parcelaPor100k - 637.15 * 1.0945944) < 0.01);
});

test('holding: ano de equilíbrio contra a melhor opção sem holding (stress test, teste 27)', () => {
  const r = S.analisar({ idade: 55, uf: 'MT', herdeiros: 2, bens: [{ tipo: 'fazenda', uf: 'MT', qtd: 4, valor: 20e6 }], aplicacoes: 2e6,
    rendaMensal: 200000, sobraMensal: 80000, aluguelMensal: 150000, nImoveisAlugados: 4 }, { semEstresse: true });
  const eq = r.holding.equilibrio;
  assert.ok(eq, 'há comparação');
  const h = r.caminhos.find(c => c.id === eq.holding), a = r.caminhos.find(c => c.id === eq.alternativa);
  assert.ok(!a.cfg.holding);
  if (eq.ano) {
    for (let t = eq.ano; t <= r.Texp; t++) assert.ok(h.sim.anos[t - 1].familiaReal >= a.sim.anos[t - 1].familiaReal, 'holding à frente desde o ano ' + eq.ano);
    if (eq.ano > 1) assert.ok(h.sim.anos[eq.ano - 2].familiaReal < a.sim.anos[eq.ano - 2].familiaReal, 'atrás no ano anterior');
    assert.equal(eq.idade, 55 + eq.ano);
  }
});

/* ---------- tabela própria de ITCMD (stress test MT, teste 29) ---------- */
test('tabela própria de ITCMD: faixas por quinhão, faixa a faixa, no lugar da tabela do estado', () => {
  const base = { idade: 60, uf: 'MT', herdeiros: 2, aplicacoes: 2e6 };
  // 4% fixo: R$ 2 mi em 2 quinhões de R$ 1 mi → R$ 80 mil
  const fixo = S.analisar(Object.assign({}, base, { itcmdManual: { faixas: [{ ate: null, aliq: 0.04 }] } }), { semEstresse: true });
  perto(fixo.base.custoHoje.itcmd, 80000, 1e-6);
  // 2% até R$ 500 mil e 6% acima, por quinhão de R$ 1 mi: 10 mil + 30 mil = R$ 40 mil × 2
  const prog = S.analisar(Object.assign({}, base, { itcmdManual: { faixas: [{ ate: 500000, aliq: 0.02 }, { ate: null, aliq: 0.06 }] } }), { semEstresse: true });
  perto(prog.base.custoHoje.itcmd, 80000, 1e-6);
  const prog2 = S.analisar(Object.assign({}, base, { herdeiros: 1, itcmdManual: { faixas: [{ ate: 500000, aliq: 0.02 }, { ate: null, aliq: 0.06 }] } }), { semEstresse: true });
  perto(prog2.base.custoHoje.itcmd, 10000 + 1.5e6 * 0.06, 1e-6);
  // sem tabela própria, segue a lei do estado
  assert.notEqual(S.analisar(base, { semEstresse: true }).base.custoHoje.itcmd, 80000);
  assert.equal(S.analisar(Object.assign({}, base, { itcmdManual: { faixas: [{ ate: null, aliq: 0.3 }] } })).ok, false);
});

/* ---------- 27 estados (contas à mão a partir das tabelas de itcmd.com.br, set/2026) ---------- */
test('27 estados: tabelas válidas nos três regimes', () => {
  assert.equal(T.SIGLAS.length, 27);
  for (const uf of T.SIGLAS) for (const rg of ['vigente', 'reforma', 'estresse']) {
    const t = T.tabela(uf, rg);
    for (const k of ['heranca', 'doacao']) {
      const r = t[k];
      // no estresse, 'maior' compara a lei vigente com a hipótese dobrada; cada uma é uma tabela comum
      const partes = rg === 'estresse' ? (assert.equal(r.metodo, 'maior', uf + ' estresse'), r.regras) : [r];
      for (const p of partes) {
        assert.ok(['sucessivas', 'total', 'unica'].includes(p.metodo), uf + rg + k);
        if (p.faixas) for (let i = 1; i < p.faixas.length; i++) assert.ok(p.faixas[i].ate > p.faixas[i - 1].ate, uf + ' faixas em ordem');
      }
      const v = S.itcmdValor(2e6, r);
      assert.ok(v >= 0 && v <= 2e6 * 0.16 + 1e-6, uf + ' ' + rg + ' ' + k + ' = ' + v);
      if (rg === 'estresse') assert.ok(v >= S.itcmdValor(2e6, T.tabela(uf, 'vigente')[k]) - 1e-6, uf + ' ' + k + ': estresse ≥ lei vigente');
    }
    if (rg === 'reforma') assert.equal(t.heranca.metodo, 'sucessivas', uf + ': reforma faixa a faixa');
  }
});

test('ITCMD por estado: faixas sucessivas, alíquota sobre o total, base no monte e isenção do espólio', () => {
  // GO, quinhão de R$ 1 mi: 25 mil × 2% + 175 mil × 4% + 400 mil × 6% + 400 mil × 8% = 63.500
  perto(S.itcmdValor(1e6, T.tabela('GO', 'vigente').heranca), 63500, 1e-6);
  // RJ, quinhão de R$ 800 mil: lei estadual 5% sobre tudo = 40.000; reforma faixa a faixa = 35.783,66
  perto(S.itcmdValor(800000, T.tabela('RJ', 'vigente').heranca), 40000, 1e-6);
  perto(S.itcmdValor(800000, T.tabela('RJ', 'reforma').heranca), 347228 * 0.04 + (496040 - 347228) * 0.045 + (800000 - 496040) * 0.05, 1e-6);
  // PB, herança de R$ 1,5 mi para 3 filhos: lei estadual aplica a tabela ao total (89.500); reforma, por quinhão (3 × 19.500)
  perto(S.itcmdDividido(1.5e6, 3, 'PB', 'vigente', 'heranca'), 2500 + 11000 + 36000 + 40000, 1e-6);
  perto(S.itcmdDividido(1.5e6, 3, 'PB', 'reforma', 'heranca'), 3 * (2500 + 11000 + 6000), 1e-6);
  // AM: espólio até R$ 1 mi não paga
  assert.equal(S.custoInventario({ monte: 9e5, herdeiros: 2, uf: 'AM', tipo: 'cartorio' }).itcmd, 0);
  assert.ok(S.custoInventario({ monte: 1.2e6, herdeiros: 2, uf: 'AM', tipo: 'cartorio' }).itcmd > 0);
  // SP 4% fixo; SE: doação de cotas (móveis) a 2%
  perto(S.itcmdDividido(1e6, 2, 'SP', 'vigente', 'heranca'), 40000, 1e-6);
  perto(S.itcmdDividido(1e6, 2, 'SE', 'vigente', 'doacaoMoveis'), 20000, 1e-6);
  perto(S.itcmdDividido(1e6, 2, 'MT', 'vigente', 'doacaoMoveis'), S.itcmdDividido(1e6, 2, 'MT', 'vigente', 'doacao'), 1e-9);
});

test('bens em vários estados: imóvel paga onde fica, móveis no domicílio; mesmo estado soma antes das faixas', () => {
  const tabMT = T.tabela('MT', 'vigente').heranca;
  const inv = S.custoInventario({ monte: 3e6, herdeiros: 1, uf: 'MT', tipo: 'cartorio',
    partes: [{ uf: 'SP', valor: 1e6 }, { uf: 'MT', valor: 1e6 }, { uf: 'MT', valor: 1e6 }] });
  perto(inv.itcmdPorUF.SP, 40000, 1e-6);
  perto(inv.itcmdPorUF.MT, S.itcmdValor(2e6, tabMT), 1e-6);
  const r = S.analisar({ idade: 55, uf: 'MT', herdeiros: 1, aplicacoes: 1e6,
    bens: [{ tipo: 'urbano', uf: 'SP', qtd: 1, valor: 1e6 }, { tipo: 'fazenda', uf: 'MT', qtd: 1, valor: 2e6 }, { tipo: 'veiculo', uf: 'MT', qtd: 2, valor: 300000 }] });
  assert.ok(r.ok);
  assert.equal(r.entrada.imoveis, 3e6); assert.equal(r.entrada.nImoveis, 2); assert.equal(r.entrada.veiculos, 300000);
  perto(r.base.custoHoje.itcmdPorUF.SP, 40000, 1e-6);
  perto(r.base.custoHoje.itcmdPorUF.MT, S.itcmdValor(2e6 + 1e6 + 300000, tabMT), 1e-6);   // fazenda + aplicações + veículos
});

test('veículos: depreciam e ficam fora da holding e da doação', () => {
  const e = S.normalizar({ idade: 55, uf: 'MT', herdeiros: 2, aplicacoes: 1e6, bens: [{ tipo: 'urbano', uf: 'MT', qtd: 1, valor: 2e6 }, { tipo: 'veiculo', uf: 'MT', qtd: 1, valor: 200000 }] });
  const inv = S.simular(e, {}, 2).anos, hold = S.simular(e, { holding: 'total' }, 2).anos;
  perto(inv[0].veiculos, 180000, 1e-6); perto(inv[1].veiculos, 162000, 1e-6);
  perto(hold[0].monte, hold[0].aplicacoes + 180000, 1e-6);   // só aplicações e veículos seguem para o inventário
});

test('nua-propriedade: base reduzida na doação; no falecimento, paga o restante onde a consolidação não é isenta', () => {
  const caso2 = uf => S.normalizar({ idade: 55, uf, herdeiros: 2, aplicacoes: 2e6, bens: [{ tipo: 'urbano', uf, qtd: 1, valor: 1e6 }] });
  const sc = S.simular(caso2('SC'), { doaImoveis: true }, 1);
  perto(sc.pagamentos[0].itens.itcmdDoacao, S.itcmdDividido(1e6 * 0.5, 2, 'SC', 'vigente', 'doacao'), 1e-6);
  perto(sc.anos[0].extincaoUsufruto, S.itcmdDividido(1e6 * 1.04 * 0.5, 2, 'SC', 'vigente', 'heranca'), 1e-6);
  const mt = S.simular(caso2('MT'), { doaImoveis: true }, 1);
  assert.equal(mt.anos[0].extincaoUsufruto, 0);                     // MT: consolidação isenta
  const sp = S.simular(caso2('SP'), { doaImoveis: true }, 1);
  perto(sp.pagamentos[0].itens.itcmdDoacao, 40000, 1e-6);           // fonte não informa redução: valor cheio
  assert.equal(sp.anos[0].extincaoUsufruto, 0);
});
