/*
 * Revisão periódica das tabelas do Planejamento Sucessório.
 * Rodado pelo GitHub Actions (.github/workflows/revisao-dados.yml) no início de
 * cada trimestre; também pode ser rodado à mão: node scripts/verificar-dados.js
 * Imprime, em Markdown, a lista do que conferir e há quantos meses cada tabela foi revisada.
 * Não altera nenhum valor: leis e unidades fiscais não têm API oficial; a conferência é humana.
 */
'use strict';
const T = require('../dados/itcmd-uf.js');

const hoje = process.env.HOJE ? new Date(process.env.HOJE + 'T12:00:00') : new Date();
const meses = ref => { const [a, m] = ref.split('-').map(Number); return (hoje.getFullYear() - a) * 12 + (hoje.getMonth() + 1 - m); };
const LIMITE = 3;

// o que conferir em cada estado: a lei e a unidade fiscal (quando houver)
const FONTES = Object.fromEntries(T.SIGLAS.map(uf => {
  const e = T.ESTADOS[uf];
  return [uf, 'ITCMD: ' + e.lei + '.' + (e.unidade.valor !== 1 ? ' Unidade: ' + e.unidade.nome + '.' : '') + (e.fonte ? ' Fonte usada: ' + e.fonte : '')];
}));

const linhas = [];
let vencidas = 0;
linhas.push('Revisão trimestral das tabelas de ITCMD e custos do **Planejamento Sucessório** (`dados/itcmd-uf.js`).', '');
linhas.push('| Estado | Lei | Unidade (mês) | Última revisão | Meses desde a revisão |', '|---|---|---|---|---|');
for (const uf of T.SIGLAS) {
  const e = T.ESTADOS[uf];
  const n = meses(e.revisadoEm);
  if (n > LIMITE) vencidas++;
  linhas.push(`| ${uf} | ${e.lei} | ${e.unidade.nome}${e.unidade.valor !== 1 ? ' = R$ ' + e.unidade.valor : ''} (${e.dataRef}) | ${e.revisadoEm} | ${n}${n > LIMITE ? ' ⚠️' : ''} |`);
}
linhas.push('', '### O que conferir', '');
for (const [uf, f] of Object.entries(FONTES)) linhas.push(`- [ ] **${uf}** — ${f}`);
linhas.push('- [ ] Honorários de referência (tabelas da OAB de cada seccional).',
  '- [ ] Tributação de aluguéis: tabela do IRPF, Lei 15.270/2025, LC 214/2025 (fases do IBS/CBS).',
  '- [ ] Previdência: tabela regressiva do IR e regras de ITCMD sobre VGBL/PGBL.',
  '- [ ] Whole life: proposta de referência Sicoob (parcela e cobertura básica por R$ 100 mil).',
  '', 'Ao atualizar, mude o `dataRef` (mês da unidade) e o `revisadoEm` (mês da conferência) do estado e rode `npm test`. A página mostra um alerta quando a referência passa de 6 meses.');
console.log(linhas.join('\n'));
if (process.env.GITHUB_OUTPUT) require('fs').appendFileSync(process.env.GITHUB_OUTPUT, `vencidas=${vencidas}\n`);
