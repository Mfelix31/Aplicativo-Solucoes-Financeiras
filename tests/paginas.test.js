// Testes de estrutura das páginas: protegem contra quebras ao mexer no código.
// Conferem que arquivos referenciados existem, que todo id usado pelo JavaScript
// existe no HTML e que os scripts não têm erro de sintaxe. Rodar: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RAIZ = path.join(__dirname, '..');
const ler = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const PAGINAS = ['index.html', 'investimentos.html', 'planejamento.html', 'aquisicao.html', 'sucessao.html'];

/** arquivos locais carregados pela página (scripts e folhas de estilo) */
function recursosLocais(html) {
  return [...html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*\shref)="([^"]+)"/g)]
    .map(m => m[1]).filter(u => !/^(https?:)?\/\//.test(u) && !u.startsWith('#') && !u.startsWith('mailto:'));
}
/** JavaScript da página: scripts em linha + arquivos de paginas/ */
function scriptsDaPagina(html) {
  const emLinha = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const proprios = recursosLocais(html).filter(u => u.startsWith('paginas/') && u.endsWith('.js')).map(ler);
  return emLinha.concat(proprios).join('\n');
}

for (const pagina of PAGINAS) {
  const html = ler(pagina);

  test(`${pagina}: todos os arquivos referenciados existem`, () => {
    for (const u of recursosLocais(html)) assert.ok(fs.existsSync(path.join(RAIZ, u)), `${u} não encontrado`);
    for (const m of html.matchAll(/<a[^>]*\shref="([^"#:]+\.html)"/g)) assert.ok(fs.existsSync(path.join(RAIZ, m[1])), `link para ${m[1]} quebrado`);
  });

  test(`${pagina}: todo id usado no JavaScript existe no HTML`, () => {
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
    const js = scriptsDaPagina(html);
    const usados = new Set([...js.matchAll(/(?:\$|getElementById)\('([\w-]+)'\)/g)].map(m => m[1]));
    const faltando = [...usados].filter(id => !ids.has(id));
    assert.deepEqual(faltando, [], 'ids usados no JavaScript sem elemento no HTML');
  });

  test(`${pagina}: ids não se repetem`, () => {
    const lista = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    const repetidos = lista.filter((id, i) => lista.indexOf(id) !== i);
    assert.deepEqual(repetidos, []);
  });
}

test('todos os arquivos JavaScript têm sintaxe válida', () => {
  const pastas = ['assets', 'dados', 'engine', 'paginas', 'scripts'];
  for (const pasta of pastas) {
    for (const f of fs.readdirSync(path.join(RAIZ, pasta)).filter(f => f.endsWith('.js'))) {
      assert.doesNotThrow(() => new vm.Script(ler(path.join(pasta, f)), { filename: f }), `${pasta}/${f}`);
    }
  }
  for (const pagina of PAGINAS) {
    for (const m of ler(pagina).matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      assert.doesNotThrow(() => new vm.Script(m[1], { filename: pagina }), pagina);
    }
  }
});

test('nenhum estilo em linha fixo nas páginas (só variáveis de cor por item)', () => {
  for (const pagina of ['aquisicao.html', 'index.html', 'sucessao.html']) {
    const estilos = [...ler(pagina).matchAll(/\sstyle="([^"]*)"/g)].map(m => m[1]).filter(s => !/^--c[bl]?:/.test(s.trim()));
    assert.deepEqual(estilos, [], pagina);
  }
});
