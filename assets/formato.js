/*
 * Formatação e entrada de valores — compartilhado pelas páginas da plataforma.
 * Números sempre no padrão brasileiro. Carregar antes do script da página.
 */
(function () {
  'use strict';
  const brl = v => (isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const brl0 = v => (isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  /** fração → "12,34%" */
  const pct = (v, c = 2) => (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }) + '%';
  /** valor compacto para eixos de gráfico: "R$ 1,25 mi", "R$ 350 mil" */
  function curto(v) {
    const a = Math.abs(v), s = v < 0 ? '−' : '';
    if (a >= 1e6) return s + 'R$ ' + (a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi';
    if (a >= 1e3) return s + 'R$ ' + (a / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' mil';
    return s + brl0(a);
  }
  const anos = n => n === 1 ? '1 ano' : n + ' anos';
  /** 30 → "2 anos e 6 meses" */
  function prazo(meses) {
    const a = Math.floor(meses / 12), m = meses % 12;
    if (a === 0) return m + (m === 1 ? ' mês' : ' meses');
    return anos(a) + (m ? ' e ' + m + (m === 1 ? ' mês' : ' meses') : '');
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /** lê um campo de moeda ("1.234,56") como número */
  function lerMoeda(el) { const n = parseFloat(String(el.value || '0').replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : n; }
  /** número → texto do campo de moeda ("1.234,56") */
  const moeda = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  /** máscara de moeda: os dígitos entram pela direita, com centavos */
  function mascara(el) {
    if (!el) return;
    el.addEventListener('input', () => {
      let d = el.value.replace(/\D/g, '') || '0';
      d = d.replace(/^0+(?=\d)/, '');
      while (d.length < 3) d = '0' + d;
      const int = (d.slice(0, -2).replace(/^0+(?=\d)/, '') || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      el.value = int + ',' + d.slice(-2);
    });
  }
  window.Formato = { brl, brl0, pct, curto, anos, prazo, esc, lerMoeda, moeda, mascara };
})();
