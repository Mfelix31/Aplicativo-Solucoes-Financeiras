/*
 * Tema da plataforma — claro é o padrão; o escuro é opcional.
 * A escolha fica lembrada no navegador do usuário e vale para todas as páginas.
 * Carregar no <head> (sem defer) para aplicar o tema antes da página aparecer.
 */
(function () {
  var CHAVE = 'tema';
  function ler() { try { return localStorage.getItem(CHAVE); } catch (e) { return null; } }
  function salvar(v) { try { localStorage.setItem(CHAVE, v); } catch (e) { /* armazenamento indisponível */ } }
  function aplicar(t) { document.documentElement.dataset.theme = (t === 'dark') ? 'dark' : 'light'; }

  aplicar(ler());

  window.Tema = {
    atual: function () { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; },
    escuro: function () { return this.atual() === 'dark'; },
    alternar: function () {
      var novo = this.escuro() ? 'light' : 'dark';
      aplicar(novo); salvar(novo);
      return novo;
    },
    /** ícone do botão: mostra para onde o clique leva */
    icone: function () { return this.escuro() ? '☀️' : '🌙'; },
    rotulo: function () { return this.escuro() ? 'Mudar para tema claro' : 'Mudar para tema escuro'; }
  };
})();
