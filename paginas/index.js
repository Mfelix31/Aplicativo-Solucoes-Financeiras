/* Página inicial — tema e painel de indicadores do Banco Central (sem valores substitutos se a consulta falhar). */
(function () {
  'use strict';
  Tema.ligarBotao(document.getElementById('btnTema'));

  const $ = id => document.getElementById(id);
  const pct = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  const dataBR = s => { const p = String(s).split('-'); return p.length === 3 ? p[2].slice(0, 2) + '/' + p[1] + '/' + p[0] : s; };

  if (!window.BCB || !window.fetch) { $('mesaEstado').textContent = 'consulta indisponível neste navegador'; return; }

  const ano = new Date().getFullYear();
  Promise.allSettled([BCB.metaSelic(), BCB.ipca12m(), BCB.focusSelic(ano)]).then(([s, i, f]) => {
    let ok = 0;
    if (s.status === 'fulfilled') {
      ok++;
      $('indSelic').textContent = pct(s.value.metaSelic);
      $('indSelicData').textContent = 'vigente em ' + s.value.data;
      $('indCdi').textContent = pct(s.value.cdi);
    }
    if (i.status === 'fulfilled') {
      ok++;
      $('indIpca').textContent = pct(i.value.valor);
      $('indIpcaData').textContent = 'até ' + i.value.mesRef;
    }
    if (s.status === 'fulfilled' && i.status === 'fulfilled') {
      $('indReal').textContent = pct(((1 + s.value.metaSelic / 100) / (1 + i.value.valor / 100) - 1) * 100);
    }
    if (f.status === 'fulfilled') {
      const anos = Object.keys(f.value.porAno).map(Number).sort((a, b) => a - b);
      const alvo = anos[0];
      ok++;
      $('indFocus').textContent = pct(f.value.porAno[alvo]);
      $('indFocusData').textContent = 'fim de ' + alvo + ' · ' + dataBR(f.value.data);
    }
    const estado = $('mesaEstado');
    if (ok === 3) { estado.textContent = 'atualizado agora'; estado.classList.add('ok'); }
    else if (ok === 0) { estado.textContent = 'Banco Central indisponível agora. Consulte bcb.gov.br'; estado.classList.add('erro'); }
    else { estado.textContent = 'parte dos dados indisponível agora'; estado.classList.add('erro'); }
  });
})();
