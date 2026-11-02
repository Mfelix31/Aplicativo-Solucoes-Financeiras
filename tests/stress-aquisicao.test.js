// Stress test da Estratégia de Aquisição de Bens (engine/aquisicao.js): 15 cenários variados.
// Cada número é conferido com uma conta independente (fórmula fechada, soma direta ou uma
// taxa interna de retorno calculada aqui), não com o próprio laço do motor.
// Rodar: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../engine/aquisicao.js');

const perto = (a, b, tolAbs, msg) => assert.ok(Math.abs(a - b) <= tolAbs, `${msg || ''} ${a} ≠ ${b}`);
const im = a => Math.pow(1 + a, 1 / 12) - 1;
const sN = (i, n) => (i ? (Math.pow(1 + i, n) - 1) / i : n);
/** entrada básica: capital isento (LCA ou renda líquida) rendendo `taxa` ao ano */
const base = o => Object.assign({ capital: 1e6, valorBem: 300000, aporteMensal: 0, valorizacaoAnual: 0, ipcaAnual: 0.04, custoEsperaMensal: 0,
  reservaMinima: 0, mesCompra: 0, horizonteMeses: 120, taxaMes: im(0.10), aliquotaIRResgate: 0, avista: { ativo: true } }, o);
const fin = o => Object.assign({ ativo: true, modo: 'cet', sistema: 'PRICE', mesInicio: 0 }, o);
const cons = o => Object.assign({ ativo: true, taxaAdm: 0, fundoReserva: 0, seguroValor: 0, reajusteAnual: 0, lanceTotal: 0, lanceEmbutido: 0,
  lanceReduz: 'parcela', mesContemplacao: 1 }, o);
/** taxa interna de retorno mensal por bissecção, independente da do motor */
function tirIndep(f) {
  const vpl = r => f.reduce((s, x, t) => s + x / Math.pow(1 + r, t), 0);
  let lo = -0.2, hi = 0.2;
  for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2; if (vpl(lo) * vpl(m) <= 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}

test('A1 financiamento no padrão da proposta (SAC, TR, MIP, DFI, TAC): 1ª parcela conferida item a item', t => {
  const e = base({ valorBem: 700000, avista: { ativo: false }, financiamento: fin({ modo: 'proposta', sistema: 'SAC', valorFinanciado: 500000, prazoMeses: 240,
    jurosNominalAnual: 0.09, trMensal: 0.001, tabelaMIP: [{ idadeAte: 200, taxa: 0.0003 }], idadeMesesHoje: 480, dfiMensal: 0.00006, tacMensal: 25, despesasIniciais: 2000 }) });
  const f = A.analisar(e).cenarios.financiamento;
  const d = f.serie[1].detalhe;
  assert.equal(d.correcao, 500);                 // 500.000 × 0,1%
  assert.equal(d.juros, 3753.75);                // 500.500 × 9% ÷ 12
  assert.equal(d.amortizacao, 2085.42);          // 500.500 ÷ 240
  assert.equal(d.mip, 150.15);                   // 500.500 × 0,03%
  assert.equal(d.dfi, 42);                       // 700.000 × 0,006%
  perto(f.parcelaInicial, 3753.75 + 2085.42 + 150.15 + 42 + 25, 1e-9);
  assert.equal(f.serie[240].saldoDevedor, 0, 'quita no fim do prazo');
  perto(f.desembolsoCompra, 200000 + 2000, 1e-9, 'entrada + despesas');
  t.diagnostic(`1ª parcela ${f.parcelaInicial.toFixed(2)} | custo efetivo ${(f.custoEfetivoAnual * 100).toFixed(2)}% a.a.`);
});

test('A2 Price × SAC (R$ 300 mil, 120x, 10% a.a.): parcela fixa, juros pela fórmula e SAC paga menos juros', t => {
  const mk = s => A.analisar(base({ avista: { ativo: false }, financiamento: fin({ sistema: s, valorFinanciado: 300000, prazoMeses: 120, cetAnual: 0.10 }) })).cenarios.financiamento;
  const price = mk('PRICE'), sac = mk('SAC'), i = im(0.10);
  const parcela = 300000 * i / (1 - Math.pow(1 + i, -120));
  price.serie.filter(s => s.parcela > 0).forEach(s => perto(s.parcela, parcela, 1e-6));
  perto(price.juros, parcela * 120 - 300000, 1e-4);
  perto(sac.juros, i * 300000 * 121 / 2, 1e-4, 'SAC: juros = i × PV × (n + 1) ÷ 2');
  assert.ok(sac.juros < price.juros && sac.parcelaInicial > price.parcelaInicial);
  perto(price.custoEfetivoAnual, 0.10, 1e-9);
  t.diagnostic(`Price ${parcela.toFixed(2)} fixa, juros ${price.juros.toFixed(0)} | SAC 1ª ${sac.parcelaInicial.toFixed(2)}, juros ${sac.juros.toFixed(0)}`);
});

test('A3 financiamento a juro zero (R$ 120 mil, 24x) com capital a 10%: financiar vence pelo rendimento mantido', t => {
  const r = A.analisar(base({ capital: 120000, valorBem: 120000, horizonteMeses: 24, financiamento: fin({ valorFinanciado: 120000, prazoMeses: 24, cetAnual: 0 }) }));
  const f = r.cenarios.financiamento, i = im(0.10);
  perto(f.parcelaInicial, 5000, 1e-9);
  const capital24 = 120000 * Math.pow(1 + i, 24) - 5000 * sN(i, 24);
  perto(f.horizonte.patrimonio, capital24 + 120000, 1e-6);
  perto(r.cenarios.avista.horizonte.patrimonio, 120000, 1e-6);
  assert.equal(r.melhor, 'financiamento');
  assert.equal(f.custoEfetivoAnual, 0);
  t.diagnostic(`vantagem de financiar a 0%: ${capital24.toFixed(0)} em 24 meses`);
});

test('A4 capital rende exatamente o custo do crédito (12% a.a., isento): empate em 12%', t => {
  const e = base({ capital: 500000, valorBem: 500000, horizonteMeses: 60, financiamento: fin({ valorFinanciado: 500000, prazoMeses: 60, cetAnual: 0.12 }) });
  const eq = A.taxaEquilibrio(e, 'financiamento', 'avista', 60);
  perto(eq, 0.12, 1e-6);
  const p = tx => A.patrimonioComTaxa(e, tx, 'financiamento', 60) - A.patrimonioComTaxa(e, tx, 'avista', 60);
  assert.ok(p(0.11) < 0 && p(0.13) > 0, 'abaixo de 12% à vista vence; acima, financiar');
  t.diagnostic(`taxa de empate ${(eq * 100).toFixed(4)}%`);
});

test('A5 compra à vista quando o capital alcança o bem valorizado: mês conferido pela fórmula fechada', t => {
  const r = A.analisar(base({ capital: 100000, aporteMensal: 5000, valorBem: 300000, valorizacaoAnual: 0.05, horizonteMeses: 180 }));
  const i = im(0.10);
  let m = 0;
  while (100000 * Math.pow(1 + i, m) + 5000 * sN(i, m) < 300000 * Math.pow(1.05, m / 12) - 1e-6) m++;
  assert.equal(r.cenarios.avista.mesCompra, m);
  perto(r.cenarios.avista.precoCompra, 300000 * Math.pow(1.05, m / 12), 1e-6);
  t.diagnostic(`compra no mês ${m}, por ${(300000 * Math.pow(1.05, m / 12)).toFixed(0)}`);
});

test('A6 o capital nunca alcança o bem (rende 4%, bem sobe 6%): sem compra e sem "melhor caminho" inventado', t => {
  const r = A.analisar(base({ capital: 50000, valorBem: 300000, valorizacaoAnual: 0.06, taxaMes: im(0.04), horizonteMeses: 360 }));
  assert.ok(r.ok);
  assert.equal(r.cenarios.avista.mesCompra, null);
  assert.equal(r.melhor, null);
  assert.ok(Number.isFinite(r.cenarios.avista.horizonte.patrimonio));
  t.diagnostic(`capital em 30 anos ${r.cenarios.avista.horizonte.capital.toFixed(0)} × bem ${(300000 * Math.pow(1.06, 30)).toFixed(0)}`);
});

test('A7 consórcio contemplado na 1ª assembleia (100x, adm 10%, fundo 2%): parcela e custo efetivo conferidos', t => {
  const c = A.analisar(base({ capital: 1e6, valorBem: 200000, avista: { ativo: false }, horizonteMeses: 100,
    consorcio: cons({ carta: 200000, prazoMeses: 100, taxaAdm: 0.10, fundoReserva: 0.02, mesContemplacao: 1 }) })).cenarios.consorcio;
  const parcela = 200000 * 1.12 / 100;
  perto(c.parcelaInicial, parcela, 1e-6);
  perto(c.totalPago, 224000, 1e-4);
  const fluxos = Array.from({ length: 100 }, (_, t) => -parcela); fluxos[0] += 200000;
  perto(c.custoEfetivoAnual, Math.pow(1 + tirIndep(fluxos), 12) - 1, 1e-6);
  t.diagnostic(`parcela ${parcela.toFixed(2)} | custo efetivo ${(c.custoEfetivoAnual * 100).toFixed(3)}% a.a.`);
});

test('A8 consórcio contemplado tarde (mês 100 de 120): o custo efetivo deveria ser mostrado', { todo: 'custo efetivo some ("—") quando o fluxo troca de sinal duas vezes; melhoria 5 do Stress Test MT' }, t => {
  const c = A.analisar(base({ capital: 500000, valorBem: 300000, avista: { ativo: false }, horizonteMeses: 120,
    consorcio: cons({ carta: 300000, prazoMeses: 120, taxaAdm: 0.15, fundoReserva: 0.02, mesContemplacao: 100 }) })).cenarios.consorcio;
  t.diagnostic(`custo efetivo do app: ${c.custoEfetivoAnual}`);
  assert.notEqual(c.custoEfetivoAnual, null);
});

test('A9 lance de 30%: "reduz prazo" termina antes de "reduz parcela" e os dois pagam o mesmo total', t => {
  const mk = reduz => A.analisar(base({ capital: 1e6, valorBem: 200000, avista: { ativo: false }, horizonteMeses: 100,
    consorcio: cons({ carta: 200000, prazoMeses: 100, taxaAdm: 0.15, fundoReserva: 0.02, lanceTotal: 0.30, mesContemplacao: 10, lanceReduz: reduz }) })).cenarios.consorcio;
  const parcela = mk('parcela'), prazo = mk('prazo');
  perto(parcela.totalPago, 200000 * 1.17, 1e-4, 'reduz parcela');
  perto(prazo.totalPago, 200000 * 1.17, 1e-4, 'reduz prazo');
  assert.ok(prazo.fimContrato < parcela.fimContrato);
  perto(parcela.lanceProprio, 60000, 1e-6);
  t.diagnostic(`fim: reduz parcela no mês ${parcela.fimContrato}, reduz prazo no mês ${prazo.fimContrato}`);
});

test('A10 entradas inválidas são recusadas com mensagem clara', t => {
  const casos = [
    ['lance embutido maior que o lance', base({ consorcio: cons({ carta: 3e5, prazoMeses: 100, lanceTotal: 0.1, lanceEmbutido: 0.2 }) }), /embutido/],
    ['prazo de 601 meses', base({ financiamento: fin({ valorFinanciado: 1e5, prazoMeses: 601, cetAnual: 0.1 }) }), /prazo/i],
    ['contemplação fora do prazo', base({ consorcio: cons({ carta: 3e5, prazoMeses: 60, mesContemplacao: 61 }) }), /contemplação/],
    ['bem sem valor', base({ valorBem: 0 }), /valor do bem/],
    ['capital negativo', base({ capital: -1 }), /Capital/],
    ['lance acima de 100%', base({ consorcio: cons({ carta: 3e5, prazoMeses: 60, lanceTotal: 1.2 }) }), /lance total/]
  ];
  for (const [nome, e, re] of casos) {
    const r = A.analisar(e);
    assert.equal(r.ok, false, nome);
    assert.ok(r.erros.some(m => re.test(m)), `${nome}: ${r.erros.join(' / ')}`);
  }
  t.diagnostic(`${casos.length} entradas inválidas recusadas`);
});

test('A11 reserva mínima de liquidez: comprar à vista deixa R$ 50 mil, abaixo dos R$ 100 mil, e o app sinaliza', t => {
  const r = A.analisar(base({ capital: 400000, valorBem: 350000, reservaMinima: 100000, financiamento: fin({ valorFinanciado: 280000, prazoMeses: 60, cetAnual: 0.12 }) }));
  assert.equal(r.cenarios.avista.mesAbaixoReserva, 0);
  perto(r.cenarios.avista.capitalAposCompra, 50000, 1e-6);
  t.diagnostic(`financiamento abaixo da reserva no mês ${r.cenarios.financiamento.mesAbaixoReserva}`);
});

test('A12 custo de espera (aluguel de R$ 2.000) até comprar à vista: soma exata dos meses pagos', t => {
  const r = A.analisar(base({ capital: 100000, aporteMensal: 5000, valorBem: 300000, valorizacaoAnual: 0.05, custoEsperaMensal: 2000, horizonteMeses: 240 }));
  const a = r.cenarios.avista;
  perto(a.custos.aluguel, 2000 * a.mesCompra, 1e-6);
  t.diagnostic(`compra no mês ${a.mesCompra}; aluguel pago ${a.custos.aluguel.toFixed(0)}`);
});

test('A13 veículo que perde 15% ao ano: o bem entra no patrimônio já depreciado', t => {
  const r = A.analisar(base({ capital: 300000, valorBem: 200000, valorizacaoAnual: -0.15, horizonteMeses: 48, financiamento: fin({ valorFinanciado: 160000, prazoMeses: 48, cetAnual: 0.18 }) }));
  const bem48 = 200000 * Math.pow(0.85, 4);
  perto(r.cenarios.avista.serie[48].valorBem, bem48, 1e-6);
  perto(r.cenarios.avista.horizonte.patrimonio, r.cenarios.avista.horizonte.capital + bem48, 1e-6);
  t.diagnostic(`bem de R$ 200 mil vale ${bem48.toFixed(0)} em 4 anos | melhor: ${r.melhor}`);
});

test('A14 IR só no resgate e só sobre o ganho: saque de R$ 50 mil de uma conta tributada a 15%', t => {
  const conta = A.novaConta({ capital: 100000, aliquotaIR: 0.15, taxa: () => 0.01 });
  conta.render(1);                                   // saldo bruto 101.000, custo 100.000
  conta.sacar(50000);
  const f = 1000 / 101000, bruto = 50000 / (1 - 0.15 * f);
  perto(conta.irPago, bruto - 50000, 1e-9);
  const B = 101000 - bruto, K = 100000 - bruto * 100000 / 101000;
  perto(conta.liquido(), B - 0.15 * (B - K), 1e-9);
  t.diagnostic(`IR do saque ${conta.irPago.toFixed(2)} (sobre a parte de ganho do valor resgatado)`);
});

test('A15 robustez: 300 casos aleatórios — sem NaN, melhor = maior patrimônio e a decomposição dos custos fecha', t => {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let validos = 0, recusados = 0, conferidos = 0;
  for (let k = 0; k < 300; k++) {
    const bem = 5e4 + rnd() * 3e6, taxa = rnd() * 0.15, H = 12 * (1 + Math.floor(rnd() * 30));
    const e = base({ capital: rnd() * 4e6, valorBem: bem, aporteMensal: rnd() < 0.5 ? 0 : rnd() * 20000, valorizacaoAnual: rnd() * 0.18 - 0.10,
      custoEsperaMensal: rnd() < 0.5 ? 0 : rnd() * 5000, horizonteMeses: H, taxaMes: im(taxa), avista: { ativo: rnd() < 0.8 } });
    if (rnd() < 0.7) e.financiamento = fin({ sistema: rnd() < 0.5 ? 'SAC' : 'PRICE', valorFinanciado: bem * (0.2 + rnd() * 0.8), prazoMeses: 12 + Math.floor(rnd() * 408), cetAnual: rnd() * 0.25 });
    if (rnd() < 0.7) { const n = 12 + Math.floor(rnd() * 228), lt = rnd() * 0.6;
      e.consorcio = cons({ carta: bem * (1 + rnd() * 0.5), prazoMeses: n, taxaAdm: rnd() * 0.25, fundoReserva: rnd() * 0.03, reajusteAnual: rnd() * 0.08,
        lanceTotal: lt, lanceEmbutido: lt * rnd(), mesContemplacao: 1 + Math.floor(rnd() * n), lanceReduz: rnd() < 0.5 ? 'parcela' : 'prazo' }); }
    const r = A.analisar(e);
    if (!r.ok) { recusados++; continue; }
    validos++;
    const i = e.taxaMes, semCompra = n => e.capital * Math.pow(1 + i, n) + e.aporteMensal * sN(i, n);
    let melhor = null;
    for (const [id, c] of Object.entries(r.cenarios)) {
      for (const v of [c.horizonte.patrimonio, c.horizonte.capital, c.horizonte.patrimonioReal]) assert.ok(Number.isFinite(v), `caso ${k} ${id}`);
      if (c.mesCompra !== null && c.mesCompra <= H) {
        if (!melhor || c.horizonte.patrimonio > r.cenarios[melhor].horizonte.patrimonio) melhor = id;
        // patrimônio = capital sem compra + (bem no horizonte − bem hoje) − custo total (identidade do motor)
        const bemH = bem * Math.pow(1 + e.valorizacaoAnual, H / 12);
        perto(c.horizonte.patrimonio, semCompra(H) + bemH - bem - c.custos.total, Math.max(1e-3, Math.abs(c.horizonte.patrimonio) * 1e-9), `identidade caso ${k} ${id}`);
        conferidos++;
      }
    }
    assert.equal(r.melhor, melhor, 'caso ' + k);
  }
  t.diagnostic(`${validos} casos válidos (${recusados} recusados pela validação), ${conferidos} caminhos com a decomposição conferida`);
});
