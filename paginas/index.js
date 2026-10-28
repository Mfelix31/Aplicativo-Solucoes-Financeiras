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
    $('indCdi').textContent = pct(v - (window.BCB ? BCB.SPREAD_CDI_SELIC : ref.spreadCdi));
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

  const ano = new Date().getFullYear();
  Promise.allSettled([BCB.metaSelic(), BCB.ipca12m(), BCB.focusSelic(ano)]).then(([s, i, f]) => {
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
    const ok = [s, i, f].filter(x => x.status === 'fulfilled').length;
    if (ok === 3) { estado.textContent = 'atualizado agora'; estado.classList.add('ok'); }
    else if (ok === 0) { estado.textContent = 'valores de referência · o Banco Central não respondeu agora'; estado.classList.add('ref'); }
    else { estado.textContent = 'parte dos dados é referência · o Banco Central respondeu em parte'; estado.classList.add('ref'); }
  });
})();
