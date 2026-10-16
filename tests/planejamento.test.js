// Testes do motor de Planejamento. Rodar: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine/planejamento.js');

const perto = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, (msg || '') + ` esperado ${b}, obtido ${a}`);

/* ---------- Referências extraídas da planilha "Planejamento Financeiro - Teste.xlsx" ----------
   Com inflação = 0, valores reais = nominais, o que permite comparar
   diretamente com FV/PMT/NPER do Excel. */
const planilha = {
  patrimonio: 100000, aporte: 1000, anos: 20,
  metaPlanilha: 4651162.790697674,          // 20.000 ÷ 0,43%
  H: { 0.05: 671134.2558322606, 0.06: 774152.1797704172, 0.07: 894504.8228119886,
       0.08: 1035094.7835930983, 0.10: 1391009.223045133 },
  J: { 0.05: 10807.748999492847, 0.06: 9550.243258126608, 0.07: 8401.75116771481,
       0.08: 7355.1387037184195, 0.10: 5538.965097906967 },
  K: { 0.05: 55, 0.06: 48, 0.07: 43, 0.08: 39, 0.10: 33 }
};

test('taxa mensal equivalente = aba Cenários (linha 10)', () => {
  perto(E.taxaMensal(0.05), 0.0040741237836483535, 1e-15);
  perto(E.taxaMensal(0.09), 0.007207323316136716, 1e-15);
});

test('Cenários: R$ 100 mil a 5% a.a. por 1 ano = 105.000 (B19)', () => {
  const r = E.simular({ patrimonioInicial: 100000, aporteMensal: 0, rentabNominalAnual: 0.05,
    inflacaoAnual: 0, meses: 12, objetivos: [] });
  perto(r.final.nominal, 105000, 1e-6);
});

for (const taxa of [0.05, 0.06, 0.07, 0.08, 0.10]) {
  test(`Planejamento ${Math.round(taxa * 100)}%: patrimônio futuro, aporte necessário e tempo = planilha`, () => {
    const r = E.planejarCenario({
      patrimonioInicial: planilha.patrimonio, aporteMensal: planilha.aporte,
      rentabNominalAnual: taxa, inflacaoAnual: 0, objetivos: [],
      anosParaRenda: planilha.anos, metaHoje: planilha.metaPlanilha, mesesMaximo: 12 * 80
    });
    perto(r.projetadoNominal, planilha.H[taxa], 1e-4, 'FV (coluna H)');
    perto(r.aporteNecessario, planilha.J[taxa], 1e-4, 'PMT (coluna J)');
    assert.equal(Math.ceil(r.mesLiberdade / 12), planilha.K[taxa], 'NPER em anos (coluna K)');
    assert.equal(r.atinge, false);
  });
}

test('meta usa a taxa mensal EQUIVALENTE de IPCA + 5,16% (não 5,16/12)', () => {
  const meta = E.patrimonioNecessario(20000, 0.0516);
  perto(meta, 20000 / (Math.pow(1.0516, 1 / 12) - 1), 1e-6);
  perto(meta, 4760163.56, 0.01);
});

test('taxa real pela relação de Fisher', () => {
  perto(E.taxaRealDeNominal(0.10, 0.04), 0.057692307692, 1e-12);
  perto(E.nominalDeReal(0.0516, 0.04), 0.093664, 1e-12);
});

test('valor real desconta a inflação: 100 mil, taxa = inflação → real constante', () => {
  const r = E.simular({ patrimonioInicial: 100000, aporteMensal: 0, rentabNominalAnual: 0.04,
    inflacaoAnual: 0.04, meses: 240, objetivos: [] });
  perto(r.final.real, 100000, 1e-6);
  perto(r.final.nominal, 100000 * Math.pow(1.04, 20), 1e-6);
});

test('taxa zero e sem aporte: patrimônio fica parado', () => {
  const r = E.simular({ patrimonioInicial: 50000, aporteMensal: 0, rentabNominalAnual: 0,
    inflacaoAnual: 0, meses: 120, objetivos: [] });
  assert.equal(r.final.nominal, 50000);
});

test('taxa zero com aporte: soma simples dos aportes', () => {
  const r = E.simular({ patrimonioInicial: 0, aporteMensal: 1000, rentabNominalAnual: 0,
    inflacaoAnual: 0, meses: 120, objetivos: [] });
  perto(r.final.nominal, 120000, 1e-9);
});

test('inflação maior que a rentabilidade: sem aporte nunca atinge a meta', () => {
  const r = E.planejarCenario({ patrimonioInicial: 100000, aporteMensal: 0, rentabNominalAnual: 0.03,
    inflacaoAnual: 0.05, objetivos: [], anosParaRenda: 20, metaHoje: 500000, mesesMaximo: 12 * 70,
    baseComparacao: 'real' });
  assert.equal(r.atinge, false);
  assert.equal(r.mesLiberdade, null);
  assert.ok(r.projetadoReal < 100000, 'perde poder de compra');
  assert.ok(r.aporteNecessario > 0);
});

test('meta já coberta pelo patrimônio atual: aporte necessário = 0, liberdade no mês 0', () => {
  const r = E.planejarCenario({ patrimonioInicial: 5e6, aporteMensal: 0, rentabNominalAnual: 0.10,
    inflacaoAnual: 0.04, objetivos: [], anosParaRenda: 10, metaHoje: 4e6, mesesMaximo: 600 });
  assert.equal(r.aporteNecessario, 0);
  assert.equal(r.mesLiberdade, 0);
  assert.equal(r.atinge, true);
});

test('meta infinita (taxa real ≤ 0): sem aporte possível', () => {
  assert.equal(E.patrimonioNecessario(10000, 0), Infinity);
  const r = E.planejarCenario({ patrimonioInicial: 0, aporteMensal: 1000, rentabNominalAnual: 0.1,
    inflacaoAnual: 0.04, objetivos: [], anosParaRenda: 10, metaHoje: Infinity, mesesMaximo: 600 });
  assert.equal(r.aporteNecessario, null);
  assert.equal(r.atinge, false);
});

test('aporte necessário de fato atinge a meta (e um centavo a menos não)', () => {
  const p = { patrimonioInicial: 20000, rentabNominalAnual: 0.10, inflacaoAnual: 0.04,
    objetivos: [], meses: 300 };
  const meta = 1500000;
  for (const base of ['nominal', 'real']) {
    const a = E.aporteNecessario(p, meta, base);
    assert.ok(E.simular({ ...p, aporteMensal: a }).final[base] >= meta);
    assert.ok(E.simular({ ...p, aporteMensal: a - 0.01 }).final[base] < meta);
  }
});

/* ---------- objetivos ---------- */
test('objetivo alcançável é retirado com valor corrigido pela inflação', () => {
  const obj = [{ id: 1, nome: 'Carro', tipo: 'carro', valorHoje: 50000, mes: 24, recorrenciaAnos: 0 }];
  const sem = E.simular({ patrimonioInicial: 200000, aporteMensal: 0, rentabNominalAnual: 0.10,
    inflacaoAnual: 0.04, meses: 24, objetivos: [] });
  const com = E.simular({ patrimonioInicial: 200000, aporteMensal: 0, rentabNominalAnual: 0.10,
    inflacaoAnual: 0.04, meses: 24, objetivos: obj });
  const valorNominal = 50000 * Math.pow(1.04, 2);
  assert.equal(com.eventos.length, 1);
  assert.equal(com.eventos[0].atingido, true);
  perto(com.eventos[0].valorNominal, valorNominal, 1e-6);
  perto(sem.final.nominal - com.final.nominal, valorNominal, 1e-6);
});

test('objetivo NÃO alcançável: marcado e nada é retirado', () => {
  const obj = [{ id: 1, nome: 'Imóvel', tipo: 'imovel', valorHoje: 800000, mes: 12, recorrenciaAnos: 0 }];
  const r = E.simular({ patrimonioInicial: 100000, aporteMensal: 1000, rentabNominalAnual: 0.10,
    inflacaoAnual: 0.04, meses: 24, objetivos: obj });
  const sem = E.simular({ patrimonioInicial: 100000, aporteMensal: 1000, rentabNominalAnual: 0.10,
    inflacaoAnual: 0.04, meses: 24, objetivos: [] });
  assert.equal(r.eventos[0].atingido, false);
  perto(r.final.nominal, sem.final.nominal, 1e-9);
});

test('recorrência: carro a cada 4 anos repete até o início da renda', () => {
  const obj = [{ id: 1, nome: 'Carro', tipo: 'carro', valorHoje: 10000, mes: 12, recorrenciaAnos: 4 }];
  const oc = E.ocorrenciasObjetivos(obj, 20 * 12);
  assert.deepEqual(oc.map(o => o.mes), [12, 60, 108, 156, 204]);
  const r = E.planejarCenario({ patrimonioInicial: 500000, aporteMensal: 0, rentabNominalAnual: 0.10,
    inflacaoAnual: 0.04, objetivos: obj, anosParaRenda: 20, metaHoje: 1e7, mesesMaximo: 12 * 40 });
  assert.equal(r.eventos.length, 5);
  assert.ok(r.eventos.every(e => e.atingido));
});

test('objetivos são processados em ordem de data (o primeiro consome o patrimônio)', () => {
  const obj = [
    { id: 2, nome: 'B', tipo: 'outro', valorHoje: 60000, mes: 10, recorrenciaAnos: 0 },
    { id: 1, nome: 'A', tipo: 'outro', valorHoje: 60000, mes: 5, recorrenciaAnos: 0 }
  ];
  const r = E.simular({ patrimonioInicial: 100000, aporteMensal: 0, rentabNominalAnual: 0,
    inflacaoAnual: 0, meses: 12, objetivos: obj });
  assert.deepEqual(r.eventos.map(e => [e.nome, e.atingido]), [['A', true], ['B', false]]);
});

/* ---------- fase de utilização: curvas da planilha (aba Renda Desejada) ---------- */
const curvas = () => E.curvasConsumo({ patrimonioInicial: 4651162.790697674, rentabNominalAnual: 0.10,
  inflacaoAnual: 0.04, taxasConsumo: [0.0516, 0.06, 0.10], anos: 30 });

test('curva 5,16%: acúmulo — ganho real de 0,81% a.a. (planilha: B12 usava fórmula aproximada)', () => {
  const [c1] = curvas();
  assert.equal(c1.tipo, 'acumulo');
  perto(c1.variacaoReal, 1.0484 / 1.04 - 1, 1e-12);
  perto(c1.serie[1].real, 4651162.790697674 * 1.0484 / 1.04, 1e-6);
  perto(c1.serie[30].real, 4651162.790697674 * Math.pow(1.0484 / 1.04, 30), 1e-4);
});

test('curva 6%: perpetuidade — poder de compra constante (planilha C12 = 0)', () => {
  const [, c2] = curvas();
  assert.equal(c2.tipo, 'perpetuidade');
  for (const pt of c2.serie) perto(pt.real, 4651162.790697674, 1e-4);
  perto(c2.serie[0].retiradaMensalNominal, 4651162.790697674 * 0.06 / 12, 1e-6);
  perto(c2.serie[10].retiradaMensalReal, c2.serie[0].retiradaMensalReal, 1e-6); // renda real constante
});

test('curva 10%: deterioração — nominal parado, real cai 3,85% a.a.', () => {
  const [, , c3] = curvas();
  assert.equal(c3.tipo, 'deterioracao');
  perto(c3.serie[30].nominal, 4651162.790697674, 1e-6);
  perto(c3.variacaoReal, 1 / 1.04 - 1, 1e-12);
});

test('consumo acima de rentabilidade + 100%: patrimônio não fica negativo', () => {
  const [c] = E.curvasConsumo({ patrimonioInicial: 1000, rentabNominalAnual: 0.1, inflacaoAnual: 0.04,
    taxasConsumo: [1.5], anos: 5 });
  assert.ok(c.serie.every(p => p.nominal >= 0));
});

test('mesesAteData', () => {
  const hoje = new Date(2026, 9, 16); // out/2026
  assert.equal(E.mesesAteData('2026-11', hoje), 1);
  assert.equal(E.mesesAteData('2028-10', hoje), 24);
  assert.equal(E.mesesAteData('2026-07', hoje), -3);
  assert.equal(E.mesesAteData('xx', hoje), null);
});

test('caso do usuário: 100 mil + 1 mil/mês a 10% a.a. por 20 anos = R$ 1.391.009 (planilha H5), com qualquer inflação', () => {
  for (const infl of [0, 0.04]) {
    const r = E.planejarCenario({ patrimonioInicial: 100000, aporteMensal: 1000, rentabNominalAnual: 0.10,
      inflacaoAnual: infl, objetivos: [], anosParaRenda: 20, metaHoje: 4760163.56, mesesMaximo: 840 });
    perto(r.projetadoNominal, 1391009.223045133, 1e-4);
    perto(r.projetadoReal, 1391009.223045133 / Math.pow(1 + infl, 20), 1e-4);
    perto(r.metaNominal, 4760163.56 * Math.pow(1 + infl, 20), 1e-4);
  }
});

test('padrão do usuário: valor futuro comparado com a meta, mesmo com inflação de 4% (planilha H5, J5, K5)', () => {
  const r = E.planejarCenario({ patrimonioInicial: 100000, aporteMensal: 1000, rentabNominalAnual: 0.10,
    inflacaoAnual: 0.04, objetivos: [], anosParaRenda: 20, metaHoje: 4651162.790697674, mesesMaximo: 12 * 80 });
  assert.equal(r.baseComparacao, 'nominal');
  perto(r.projetadoNominal, 1391009.223045133, 1e-4);
  perto(r.lacuna, 4651162.790697674 - 1391009.223045133, 1e-4);
  perto(r.aporteNecessario, 5538.965097906967, 1e-4);           // J5
  assert.equal(Math.ceil(r.mesLiberdade / 12), 33);             // K5
  assert.equal(r.atinge, false);
});
