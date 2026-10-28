/* Página inicial — tema e painel de indicadores.
 * Mostra primeiro os valores de referência (dados/referencias-mercado.js, os mesmos do simulador),
 * identificados com a data, e troca pelos valores atuais do Banco Central quando a consulta responde. */
(function () {
  'use strict';
  Tema.ligarBotao(document.getElementById('btnTema'));

  const $ = id => document.getElementById(id);
  const pct = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  const dataBR = s => { const p = String(s).split('-'); return p.length === 3 ? p[2].slice(0, 2) + '/' + p[1] + '/' + p[0] : s; };
  const real = (selic, ipca) => ((1 + selic / 100) / (1 + ipca / 100) - 1) * 100;

  const ref = window.ReferenciasMercado;
  let selic = null, ipca = null, selicAtual = false, ipcaAtual = false;

  function mostrarSelic(v, data, atual) {
    selic = v; selicAtual = atual;
    $('indSelic').textContent = pct(v);
    $('indSelicData').textContent = (atual ? 'vigente desde ' : 'referência de ') + data;
  }
  function mostrarIpca(v, mesRef, atual) {
    ipca = v; ipcaAtual = atual;
    $('indIpca').textContent = pct(v);
    $('indIpcaData').textContent = (atual ? 'até ' : 'referência até ') + mesRef;
  }
  function mostrarReal() {
    if (selic === null || ipca === null) return;
    $('indReal').textContent = pct(real(selic, ipca));
    $('indRealData').textContent = (selicAtual && ipcaAtual) ? 'calculado' : 'calculado com a referência';
  }

  if (ref) {
    mostrarSelic(ref.metaSelic.valor, ref.metaSelic.data, false);
    mostrarIpca(ref.ipca12m.valor, ref.ipca12m.mesRef, false);
    mostrarReal();
  }

  const estado = $('mesaEstado');
  if (!window.BCB || !window.fetch) { estado.textContent = 'valores de referência · consulta indisponível neste navegador'; estado.classList.add('ref'); return; }

  const num = (v, c) => v.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
  const variacao = v => (v === null ? '' : (v > 0 ? '+' : v < 0 ? '−' : '') + num(Math.abs(v) * 100, 2) + '% no dia · ');
  /** cotação diária: só mostra o número se o último fechamento for recente; senão avisa a data */
  function mostrarDiaria(r, idV, idD, texto) {
    if (r.status !== 'fulfilled') { $(idD).textContent = 'indisponível agora'; return false; }
    const d = r.value;
    if (!d.recente) { $(idD).textContent = 'sem atualização desde ' + d.data; return false; }
    $(idV).textContent = texto(d.valor);
    $(idD).textContent = variacao(d.variacao) + d.data;
    return true;
  }

  const ano = new Date().getFullYear();
  Promise.allSettled([BCB.metaSelic(), BCB.ipca12m(), BCB.focusSelic(ano), BCB.dolarPtax(), BCB.ibovespa()]).then(([s, i, f, usd, ibov]) => {
    const okUsd = mostrarDiaria(usd, 'indDolar', 'indDolarData', v => 'R$ ' + num(v, 4));
    const okIbov = mostrarDiaria(ibov, 'indIbov', 'indIbovData', v => num(v, 0));
    if (s.status === 'fulfilled') mostrarSelic(s.value.metaSelic, s.value.data, true);
    if (i.status === 'fulfilled') mostrarIpca(i.value.valor, i.value.mesRef, true);
    mostrarReal();
    if (f.status === 'fulfilled') {
      const alvo = Object.keys(f.value.porAno).map(Number).sort((a, b) => a - b)[0];
      $('indFocus').textContent = pct(f.value.porAno[alvo]);
      $('indFocusData').textContent = 'fim de ' + alvo + ' · ' + dataBR(f.value.data);
    } else {
      $('indFocusData').textContent = 'indisponível agora';
    }
    const ok = [s, i, f].filter(x => x.status === 'fulfilled').length + okUsd + okIbov;
    if (ok === 5) { estado.textContent = 'atualizado agora'; estado.classList.add('ok'); }
    else if (ok === 0) { estado.textContent = 'valores de referência · o Banco Central não respondeu agora'; estado.classList.add('ref'); }
    else { estado.textContent = 'parte dos dados indisponível agora'; estado.classList.add('ref'); }
  });
})();
