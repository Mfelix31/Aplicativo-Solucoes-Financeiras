// Testes da ajuda (botões "?", dicas das etapas e guia "Como usar").
// Conferem que cada texto de ajuda aponta para um campo, etapa ou título que existe na página,
// para a ajuda não sumir em silêncio quando um campo for renomeado. Rodar: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RAIZ = path.join(__dirname, '..');
const ler = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const PAGINAS = ['index', 'investimentos', 'planejamento', 'aquisicao', 'sucessao'];

/** roda paginas/<p>-ajuda.js e devolve a configuração passada a Ajuda.iniciar */
function configDaPagina(p) {
  let config = null;
  vm.runInNewContext(ler(`paginas/${p}-ajuda.js`), { Ajuda: { iniciar: c => { config = c; } } });
  return config;
}
/** texto visível do HTML, sem tags e com espaços normalizados */
function textoDoHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/\s+/g, ' ');
}

for (const p of PAGINAS) {
  const html = ler(`${p}.html`);
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  const cfg = configDaPagina(p);

  test(`${p}: carrega a ajuda depois do script da página`, () => {
    const iPag = html.indexOf(`src="paginas/${p}.js"`);
    const iComp = html.indexOf('src="assets/ajuda.js"');
    const iTxt = html.indexOf(`src="paginas/${p}-ajuda.js"`);
    assert.ok(html.includes('href="assets/ajuda.css"'), 'falta assets/ajuda.css');
    assert.ok(iPag > 0 && iComp > iPag && iTxt > iComp, 'ordem esperada: página → assets/ajuda.js → paginas/<página>-ajuda.js');
  });

  test(`${p}: tem guia "Como usar" com passos`, () => {
    assert.ok(cfg && cfg.guia && cfg.guia.titulo, 'guia sem título');
    assert.ok(Array.isArray(cfg.guia.passos) && cfg.guia.passos.length >= 2, 'guia com menos de 2 passos');
    for (const passo of cfg.guia.passos) assert.ok(passo.titulo && passo.texto, 'passo sem título ou texto');
  });

  test(`${p}: todo campo com ajuda existe e tem rótulo`, () => {
    for (const id of Object.keys(cfg.campos || {})) {
      assert.ok(ids.has(id), `campo ${id} não existe no HTML`);
      const temRotulo = new RegExp(`<label[^>]*for="${id}"`).test(html) ||
        new RegExp(`<label[^>]*>[^]*?id="${id}"[^]*?</label>`).test(html.slice(Math.max(0, html.indexOf(`id="${id}"`) - 400), html.indexOf(`id="${id}"`) + 200));
      assert.ok(temRotulo, `campo ${id} sem <label>`);
      assert.ok(String(cfg.campos[id]).trim().length > 10, `texto curto demais para ${id}`);
    }
  });

  test(`${p}: toda etapa e tópico com ajuda existe`, () => {
    for (const id of Object.keys(cfg.etapas || {})) assert.ok(ids.has(id), `etapa ${id} não existe`);
    const texto = textoDoHtml(html);
    for (const chave of Object.keys(cfg.topicos || {})) {
      if (chave.startsWith('#')) {
        const id = chave.slice(1).split(/[\s.:[]/)[0];
        assert.ok(ids.has(id), `tópico ${chave}: id ${id} não existe`);
      } else if (!chave.startsWith('.')) {
        assert.ok(texto.includes(chave), `tópico "${chave}" não aparece na página`);
      }
    }
  });
}

test('ajuda: textos são escapados (sem HTML vindo dos textos)', () => {
  const ctx = { window: {}, document: {}, localStorage: null, console };
  vm.runInNewContext(ler('assets/ajuda.js'), ctx);
  const f = ctx.window.Ajuda._formatar;
  assert.equal(f('a <b>x</b>'), '<p>a &lt;b&gt;x&lt;/b&gt;</p>');
  assert.equal(f('**forte** e normal\n\nsegundo'), '<p><strong>forte</strong> e normal</p><p>segundo</p>');
});
