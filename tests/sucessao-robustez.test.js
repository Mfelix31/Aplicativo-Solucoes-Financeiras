// Teste de robustez do Planejamento Sucessório: entradas aleatórias (semente fixa, reproduzível)
// em toda a faixa aceita. Nenhuma pode gerar erro, número inválido ou ficar sem solução.
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../engine/sucessao.js');
const T = require('../dados/itcmd-uf.js');

function gerador(semente) {           // mulberry32: mesmos casos em toda execução
  let a = semente >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rnd = gerador(20261027);
const umDe = l => l[Math.floor(rnd() * l.length)];
const valor = (max, zero) => (rnd() < (zero || 0.3) ? 0 : Math.round(rnd() * max));

function casoAleatorio() {
  const alugados = Math.floor(rnd() * 8);
  return {
    idade: 18 + Math.floor(rnd() * 80), uf: umDe(T.SIGLAS), herdeiros: 1 + Math.floor(rnd() * 6),
    tipoInventario: umDe(['cartorio', 'judicial', 'litigio']), regime: umDe(['vigente', 'reforma', 'estresse']),
    conjuge: { regime: umDe(['sem', 'parcial', 'universal', 'separacao', 'obrigatoria']), pctComuns: rnd(), ascendenteComum: rnd() < 0.7 },
    bens: Array.from({ length: Math.floor(rnd() * 5) }, () => ({ tipo: umDe(['urbano', 'terreno', 'fazenda', 'veiculo']), uf: umDe(T.SIGLAS), qtd: 1 + Math.floor(rnd() * 4), valor: valor(30e6, 0.1) })),
    aplicacoes: valor(20e6, 0.2), empresa: valor(10e6, 0.6), exterior: valor(8e6, 0.75),
    previdencia: valor(3e6, 0.7), previdenciaAnos: Math.floor(rnd() * 20), seguroExistente: valor(2e6, 0.8),
    rendaMensal: valor(300000, 0.2), outrasRendasMensais: valor(60000, 0.5), sobraMensal: valor(150000, 0.4),
    aluguelMensal: alugados ? valor(300000, 0.1) : 0, nImoveisAlugados: alugados, nResidenciais: Math.floor(rnd() * (alugados + 1)),
    sustento: { despesaMensal: valor(60000, 0.5) }, sucessaoCasal: rnd() < 0.8,
    premissas: { rentabilidade: umDe([0.08, 0.10, 0.12, 0.03, 0.15]), ipca: umDe([0.04, 0.02, 0.07, 0]), metaLiquidez: umDe([0.18, 0.10, 0.25]) },
    wholeLife: { sexo: umDe(['m', 'f']), tabua: umDe(['2026', '2021']) }
  };
}

const finito = (x, onde) => assert.ok(Number.isFinite(x), onde + ' = ' + x);

test('robustez: 40 casos aleatórios (27 estados, bens em vários estados) sempre trazem uma solução, sem erro e com números válidos', () => {
  for (let i = 0; i < 40; i++) {
    const c = casoAleatorio();
    if (c.bens.reduce((t, b) => t + b.valor, 0) + c.aplicacoes + c.empresa + c.exterior + c.previdencia === 0) c.aplicacoes = 1e6;
    let r;
    assert.doesNotThrow(() => { r = S.analisar(c); }, 'caso ' + i);
    assert.ok(r.ok, 'caso ' + i + ': ' + JSON.stringify(r.erros));
    const v = r.caminhos.find(x => x.id === r.recomendacao.vencedor);
    assert.ok(v, 'caso ' + i + ' sem vencedor');
    assert.ok([1, 2, 3, 4].includes(r.recomendacao.nivel));
    for (const k of r.caminhos) {
      for (const h of ['proximo', 'dez', 'expectativa']) finito(k.em[h].familiaReal, 'caso ' + i + ' ' + k.id + ' ' + h);
      finito(k.pagamento.externo, k.id); assert.ok(k.pagamento.externo >= 0);
      assert.ok(k.cfg.X === undefined || (k.cfg.X >= 0 && k.cfg.X <= c.aplicacoes + 1), 'previdência maior que as aplicações');
      for (const p of k.sim.pagamentos) {
        // o custo do ano é pago integralmente pelas quatro fontes
        if (p.custo > 0) assert.ok(Math.abs(p.daSobra + p.daRendimento + p.daPrincipal + p.externo - p.custo) < 1e-3 * Math.max(1, p.custo), 'fontes ≠ custo');
        assert.ok(p.aplicacoes >= -1e-6, 'aplicações negativas');
      }
      for (const a of k.sim.anos) assert.ok(a.monte >= 0 && a.meta >= 0);
    }
    // o vencedor protege desde já sempre que algum caminho protege
    if (r.caminhos.some(k => k.protegeJa)) assert.ok(v.protegeJa, 'caso ' + i + ': vencedor não protege');
  }
});

test('robustez: entradas inválidas viram mensagens, nunca exceções', () => {
  const ruins = [{}, { idade: 'x' }, { idade: 55, uf: 'SP' }, { idade: 55, uf: 'MT', herdeiros: 0, imoveis: 1e6 },
    { idade: 55, uf: 'MT', herdeiros: 2, imoveis: -1 }, { idade: 55, uf: 'MT', herdeiros: 2, imoveis: 1e6, premissas: { rentabilidade: NaN } },
    { idade: 55, uf: 'MT', herdeiros: 2, imoveis: 1e6, conjuge: { regime: 'outro' } }, { idade: 55, uf: 'MT', herdeiros: 2, imoveis: 1e6, sobraMensal: -5 }];
  for (const c of ruins) {
    let r;
    assert.doesNotThrow(() => { r = S.analisar(c); });
    assert.equal(r.ok, false); assert.ok(r.erros.length > 0);
  }
});
