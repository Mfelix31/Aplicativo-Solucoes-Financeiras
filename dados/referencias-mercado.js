/*
 * Valores de referência de mercado — os mesmos que o simulador de investimentos traz preenchidos.
 * Aparecem na página inicial enquanto o Banco Central não responde, sempre identificados como
 * referência com a data. Quando a consulta ao BCB funciona, são substituídos pelos valores atuais.
 * Ao atualizar aqui, atualize também os valores padrão de investimentos.html e aquisicao.html
 * (o teste tests/paginas.test.js confere se estão iguais).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ReferenciasMercado = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
    metaSelic: { valor: 13.75, data: '16/09/2026', fonte: 'Copom (BCB, SGS 432)' },
    spreadCdi: 0.10, // CDI estimado = Meta Selic − 0,10 p.p.
    ipca12m: { valor: 4.44, mesRef: 'jul/2026', fonte: 'IBGE via BCB (SGS 13522)' }
    // Focus: sem valor de referência guardado; se a consulta falhar, a página mostra "—".
  };
});
