/*
 * Ajuda da plataforma — botões "?" ao lado dos campos e títulos, dica no topo de cada etapa
 * e o guia "Como usar" de cada página.
 *
 * Cada página chama Ajuda.iniciar(config) no arquivo paginas/<página>-ajuda.js:
 *   guia:    { titulo, intro, passos: [{titulo, texto}], dicas: [texto] }   → botão "Como usar"
 *   etapas:  { 'id-do-painel': texto }                                      → faixa no topo da etapa
 *   campos:  { 'id-do-campo': texto }                                       → "?" no rótulo do campo
 *   topicos: { 'Texto do título' ou '#seletor': texto }                     → "?" no título, bloco ou indicador
 *
 * Textos: string simples; "\n\n" separa parágrafos e **trecho** vira negrito.
 * Um bloco em que toda linha começa com "|" vira tabela ("| a | b |"); a primeira linha é o cabeçalho.
 * Os textos são fixos, escritos no código — nunca vêm do usuário.
 * Só apresentação: não altera nenhum cálculo nem lê valores dos campos.
 */
(function () {
  'use strict';

  var CHAVE_ETAPAS = 'ajuda-etapas-ocultas';
  /** partes do título que não fazem parte do nome (numeração, selos, opções) */
  var IGNORAR = '.n, .opcional, .tag-ir, .switch, .dot, .unit, small, .d, input, select, button, .ajuda-btn';
  /** onde procurar os títulos dos tópicos */
  var CANDIDATOS = 'h2, h3, .lbl, .block-title, .chart-title, .equiv-label, .q-title, dt, .label, .field > label:not([for])';

  var pop = null;       // balão aberto pelos botões "?"
  var botaoAberto = null;
  var contador = 0;

  function lerOcultas() { try { return localStorage.getItem(CHAVE_ETAPAS) === '1'; } catch (e) { return false; } }
  function salvarOcultas(v) { try { localStorage.setItem(CHAVE_ETAPAS, v ? '1' : '0'); } catch (e) { /* sem armazenamento */ } }

  function escapar(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /** texto → HTML: parágrafos e negrito, com o restante escapado */
  function linha(t) { return escapar(t.trim()).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); }
  function formatar(texto) {
    return String(texto).split(/\n\s*\n/).map(function (p) {
      var linhas = p.trim().split('\n');
      // bloco em que toda linha começa com "|" vira tabela; a primeira linha é o cabeçalho
      if (linhas.every(function (l) { return /^\s*\|/.test(l); })) {
        var cel = function (l) { return l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|'); };
        var cab = cel(linhas[0]).map(function (c) { return '<th>' + linha(c) + '</th>'; }).join('');
        var corpo = linhas.slice(1).map(function (l) { return '<tr>' + cel(l).map(function (c) { return '<td>' + linha(c) + '</td>'; }).join('') + '</tr>'; }).join('');
        return '<table class="ajuda-tab"><thead><tr>' + cab + '</tr></thead><tbody>' + corpo + '</tbody></table>';
      }
      return '<p>' + escapar(p.trim()).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }
  function normalizar(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  function textoProprio(el) {
    var c = el.cloneNode(true);
    c.querySelectorAll(IGNORAR).forEach(function (x) { x.remove(); });
    return normalizar(c.textContent).replace(/^\d+\s+/, '');
  }

  /* ---------------- balão ---------------- */
  function criarBalao() {
    pop = document.createElement('div');
    pop.className = 'ajuda-pop';
    pop.id = 'ajudaPop';
    pop.setAttribute('role', 'dialog');
    pop.hidden = true;
    pop.innerHTML = '<button type="button" class="ajuda-pop-x" aria-label="Fechar ajuda">×</button>' +
      '<div class="ajuda-pop-tit"></div><div class="ajuda-pop-txt"></div>';
    document.body.appendChild(pop);
    pop.querySelector('.ajuda-pop-x').addEventListener('click', function () { fecharBalao(true); });
    document.addEventListener('click', function (e) {
      if (!pop.hidden && !pop.contains(e.target) && !e.target.closest('.ajuda-btn')) fecharBalao(false);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) fecharBalao(true); });
    window.addEventListener('resize', function () { if (botaoAberto) posicionar(botaoAberto); });
  }

  function posicionar(btn) {
    var r = btn.getBoundingClientRect();
    var vw = document.documentElement.clientWidth;
    var largura = Math.min(pop.querySelector('.ajuda-tab') ? 460 : 320, vw - 24);   // mais largo quando há tabela
    pop.style.width = largura + 'px';
    var esq = Math.min(Math.max(12, r.left + r.width / 2 - largura / 2), vw - largura - 12);
    var alto = pop.offsetHeight;
    var abaixo = r.bottom + 8;
    var topo = (abaixo + alto > window.innerHeight - 8 && r.top - alto - 8 > 8) ? r.top - alto - 8 : abaixo;
    pop.style.left = (esq + window.scrollX) + 'px';
    pop.style.top = (topo + window.scrollY) + 'px';
  }

  function abrirBalao(btn) {
    if (botaoAberto === btn) { fecharBalao(true); return; }
    if (botaoAberto) botaoAberto.setAttribute('aria-expanded', 'false');
    pop.querySelector('.ajuda-pop-tit').textContent = btn.dataset.titulo || 'Ajuda';
    pop.querySelector('.ajuda-pop-txt').innerHTML = formatar(btn.dataset.texto);
    pop.setAttribute('aria-label', 'Ajuda: ' + (btn.dataset.titulo || ''));
    pop.hidden = false;
    posicionar(btn);
    btn.setAttribute('aria-expanded', 'true');
    botaoAberto = btn;
  }

  function fecharBalao(devolverFoco) {
    pop.hidden = true;
    if (botaoAberto) {
      botaoAberto.setAttribute('aria-expanded', 'false');
      if (devolverFoco) botaoAberto.focus();
    }
    botaoAberto = null;
  }

  /** cria o "?" e o mantém dentro do elemento mesmo quando a página troca o texto dele */
  function anexarBotao(host, titulo, texto) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ajuda-btn';
    btn.textContent = '?';
    btn.dataset.titulo = titulo;
    btn.dataset.texto = texto;
    btn.setAttribute('aria-label', 'Ajuda: ' + titulo);
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'ajudaPop');
    btn.addEventListener('click', function (e) {
      e.preventDefault();      // não marca a caixa nem foca o campo do rótulo
      e.stopPropagation();
      abrirBalao(btn);
    });
    function colocar() {
      var desc = host.querySelector(':scope > .d, :scope > small');   // descrição abaixo do título: o "?" fica no título
      if (desc) host.insertBefore(btn, desc); else host.appendChild(btn);
    }
    colocar();
    host.classList.add('tem-ajuda');
    new MutationObserver(function () {
      if (!host.contains(btn)) {
        colocar();
        btn.dataset.titulo = textoProprio(host) || titulo;
        btn.setAttribute('aria-label', 'Ajuda: ' + btn.dataset.titulo);
      }
    }).observe(host, { childList: true });
    return btn;
  }

  /* ---------------- campos e tópicos ---------------- */
  function rotuloDoCampo(id) {
    var campo = document.getElementById(id);
    if (!campo) return null;
    var rot = document.querySelector('label[for="' + id + '"]');
    if (rot) {
      // rótulo que envolve a caixa de marcar: o "?" vai no texto (.t), se houver
      return rot.querySelector('.t') || rot;
    }
    return campo.closest('label') || null;
  }

  function ligarCampos(campos) {
    Object.keys(campos || {}).forEach(function (id) {
      var host = rotuloDoCampo(id);
      if (!host) { console.warn('Ajuda: campo sem rótulo', id); return; }
      anexarBotao(host, textoProprio(host), campos[id]);
    });
  }

  function ligarTopicos(topicos) {
    var todos = Array.prototype.slice.call(document.querySelectorAll(CANDIDATOS));
    Object.keys(topicos || {}).forEach(function (chave) {
      var alvos;
      if (/^[#.]/.test(chave)) {
        alvos = Array.prototype.slice.call(document.querySelectorAll(chave));
      } else {
        var k = normalizar(chave);
        alvos = todos.filter(function (el) { return textoProprio(el) === k; });
        if (!alvos.length) alvos = todos.filter(function (el) { return textoProprio(el).indexOf(k) === 0; });
      }
      if (!alvos.length) { console.warn('Ajuda: tópico não encontrado', chave); return; }
      alvos.forEach(function (el) { anexarBotao(el, textoProprio(el) || chave, topicos[chave]); });
    });
  }

  /* ---------------- dicas das etapas ---------------- */
  function ligarEtapas(etapas) {
    var faixas = [];
    Object.keys(etapas || {}).forEach(function (id) {
      var painel = document.getElementById(id);
      if (!painel) { console.warn('Ajuda: etapa não encontrada', id); return; }
      var faixa = document.createElement('div');
      faixa.className = 'ajuda-etapa';
      faixa.innerHTML = '<span class="ajuda-etapa-ico" aria-hidden="true">i</span>' +
        '<div class="ajuda-etapa-txt">' + formatar(etapas[id]) + '</div>' +
        '<button type="button" class="ajuda-etapa-x">Ocultar dicas</button>';
      faixa.querySelector('.ajuda-etapa-x').addEventListener('click', function () { mostrarEtapas(false); });
      painel.insertBefore(faixa, painel.firstChild);
      faixas.push(faixa);
    });
    function mostrarEtapas(sim) {
      faixas.forEach(function (f) { f.hidden = !sim; });
      salvarOcultas(!sim);
      var b = document.getElementById('ajudaEtapasToggle');
      if (b) b.textContent = sim ? 'Ocultar as dicas das etapas' : 'Mostrar as dicas das etapas';
    }
    if (faixas.length) mostrarEtapas(!lerOcultas());
    return faixas.length ? mostrarEtapas : null;
  }

  /* ---------------- guia "Como usar" ---------------- */
  function ligarGuia(guia, mostrarEtapas) {
    if (!guia) return;
    var fundo = document.createElement('div');
    fundo.className = 'ajuda-guia-bg';
    fundo.hidden = true;
    var passos = (guia.passos || []).map(function (p, i) {
      return '<li><span class="ajuda-guia-n">' + (i + 1) + '</span><div><div class="ajuda-guia-pt">' + escapar(p.titulo) +
        '</div>' + formatar(p.texto) + '</div></li>';
    }).join('');
    var dicas = (guia.dicas || []).map(function (d) { return '<li>' + formatar(d) + '</li>'; }).join('');
    fundo.innerHTML =
      '<div class="ajuda-guia" role="dialog" aria-modal="true" aria-labelledby="ajudaGuiaTit">' +
        '<div class="ajuda-guia-cab"><h2 id="ajudaGuiaTit">' + escapar(guia.titulo || 'Como usar') + '</h2>' +
        '<button type="button" class="ajuda-guia-x" aria-label="Fechar o guia">×</button></div>' +
        '<div class="ajuda-guia-corpo">' +
          (guia.intro ? '<div class="ajuda-guia-intro">' + formatar(guia.intro) + '</div>' : '') +
          (passos ? '<ol class="ajuda-guia-passos">' + passos + '</ol>' : '') +
          (dicas ? '<div class="ajuda-guia-sub">Dicas</div><ul class="ajuda-guia-dicas">' + dicas + '</ul>' : '') +
          '<p class="ajuda-guia-rod">Procure o botão <span class="ajuda-btn ajuda-btn-demo" aria-hidden="true">?</span> ao lado dos campos e títulos: ele explica cada item. ' +
          'Tudo aqui é simulação: não é recomendação de investimento.</p>' +
        '</div>' +
        '<div class="ajuda-guia-acoes">' +
          (mostrarEtapas ? '<button type="button" class="ajuda-guia-sec" id="ajudaEtapasToggle"></button>' : '') +
          '<button type="button" class="ajuda-guia-ok">Entendi</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(fundo);

    var gatilho = null;
    function abrir(origem) {
      gatilho = origem || null;
      fundo.hidden = false;
      document.body.classList.add('ajuda-sem-rolagem');
      fundo.querySelector('.ajuda-guia-ok').focus();
    }
    function fechar() {
      fundo.hidden = true;
      document.body.classList.remove('ajuda-sem-rolagem');
      if (gatilho) gatilho.focus();
    }
    fundo.querySelector('.ajuda-guia-x').addEventListener('click', fechar);
    fundo.querySelector('.ajuda-guia-ok').addEventListener('click', fechar);
    fundo.addEventListener('click', function (e) { if (e.target === fundo) fechar(); });
    document.addEventListener('keydown', function (e) {
      if (fundo.hidden) return;
      if (e.key === 'Escape') { fechar(); return; }
      if (e.key === 'Tab') { // mantém o foco dentro do guia
        var f = fundo.querySelectorAll('button');
        var primeiro = f[0], ultimo = f[f.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
      }
    });
    var toggle = fundo.querySelector('#ajudaEtapasToggle');
    if (toggle) {
      toggle.textContent = lerOcultas() ? 'Mostrar as dicas das etapas' : 'Ocultar as dicas das etapas';
      toggle.addEventListener('click', function () { mostrarEtapas(lerOcultas()); });
    }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ajuda-guia-btn';
    btn.innerHTML = '<span class="ajuda-guia-btn-ico" aria-hidden="true">?</span><span class="ajuda-guia-btn-txt">Como usar</span>';
    btn.setAttribute('aria-label', 'Como usar esta página');
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.addEventListener('click', function () { abrir(btn); });
    var tema = document.getElementById('btnTema');
    if (tema && tema.parentNode) tema.parentNode.insertBefore(btn, tema);
    else document.body.insertBefore(btn, document.body.firstChild);
  }

  window.Ajuda = {
    iniciar: function (config) {
      config = config || {};
      if (!pop) criarBalao();
      ligarCampos(config.campos);
      ligarTopicos(config.topicos);
      var mostrarEtapas = ligarEtapas(config.etapas);
      ligarGuia(config.guia, mostrarEtapas);
    },
    /* expostos para os testes */
    _formatar: formatar
  };
})();
