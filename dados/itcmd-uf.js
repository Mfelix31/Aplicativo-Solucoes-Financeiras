/*
 * Tabelas de ITCMD dos 27 estados — Planejamento Sucessório
 * --------------------------------------------------------------
 * Dados (não lógica). Cada estado tem três regimes:
 *  - vigente:  a lei estadual em vigor na data de referência;
 *  - reforma:  adequação à LC 227/2026 (faixas sucessivas sobre a parte de cada
 *              herdeiro ou donatário, teto 8%). Onde o estado já cumpre, é igual à
 *              vigente. Onde a lei aplica a alíquota sobre o valor inteiro ou sobre o
 *              total da herança, a reforma usa as MESMAS faixas, de forma sucessiva e
 *              por quinhão (como em RO). Onde a alíquota é fixa, é uma HIPÓTESE
 *              rotulada: as faixas de MT em reais (como em MS);
 *  - estresse: as alíquotas da reforma em dobro, limitadas a 16%
 *              (teto proposto no PRS 57/2019, não aprovado).
 *
 * Regra de cada tabela: { metodo, faixas | aliquota, base, isencao, isencaoEspolio }
 *  - metodo 'sucessivas': cada alíquota incide só sobre a parcela dentro da faixa;
 *           'total':      a alíquota da faixa em que o valor cai incide sobre todo o valor;
 *           'unica':      uma alíquota sobre todo o valor.
 *  - base 'quinhao' (padrão): a tabela vale para a parte de cada herdeiro/donatário;
 *         'monte':  a lei estadual aplica a tabela ao total da herança (AC, AP, PB).
 *  - isencao { ate, tipo: 'tudoOuNada' }: por quinhão ou donatário. Faixa de 0% = isenção
 *    que funciona como dedução (paga só o que passa do limite).
 *  - isencaoEspolio: herança inteira até esse valor não paga (tudo ou nada).
 * Outros campos por estado:
 *  - nuaPropriedadePct: base da doação da nua-propriedade com reserva de usufruto
 *    (1 = valor cheio, quando a fonte não informa); usufrutoExtincaoIsenta: se a
 *    consolidação no falecimento do usufrutuário não paga o restante.
 *  - doacaoMoveis: tabela própria para doação de bens móveis e cotas (SE).
 * Faixas em REAIS (convertidas pela unidade fiscal do mês indicado).
 * dataRef = mês da unidade fiscal; revisadoEm = mês da última conferência.
 * Revisão trimestral: scripts/verificar-dados.js e .github/workflows/revisao-dados.yml.
 *
 * Fontes: MT, MS, RO e PA conferidos nas leis estaduais (out/2026). Os demais estados
 * (e a reconferência de MT e MS) pelas páginas estaduais de itcmd.com.br, revisadas em
 * set/2026, que citam a lei e o artigo de cada regra; confirmar na Sefaz antes de usar.
 * Simplificações: alíquotas especiais (colaterais, imóveis específicos, quotas na herança
 * em SE) e isenções por tipo de bem não estão modeladas; os herdeiros são descendentes.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ItcmdUF = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const UPF_MT = 263.97;   // UPF/MT de setembro/2026 (1.500 UPF = R$ 395.955)
  const UPF_RO = 124.46;   // UPF/RO 2026 (62 UPF = R$ 7.716,52)
  const UPF_PA = 5.0155;   // UPF-PA 2026 (Portaria SEFA/GS nº 640/2025)

  const f = (lista, mult) => lista.map(([ate, aliq]) => ({ ate: ate === null ? Infinity : ate * (mult || 1), aliq }));
  const unica = (aliquota, extra) => Object.assign({ metodo: 'unica', aliquota }, extra || {});
  const suc = (faixas, extra) => Object.assign({ metodo: 'sucessivas', faixas: f(faixas) }, extra || {});
  const tot = (faixas, extra) => Object.assign({ metodo: 'total', faixas: f(faixas) }, extra || {});
  const tudo = ate => ({ ate, tipo: 'tudoOuNada' });
  const MULTA_CONFERIR = 'Multa por atraso: confira na lei estadual (não modelada por padrão).';
  const SOMA_NAO_INFORMADA = 'A fonte não informa regra estadual de soma de doações; a LC 227/2026 autoriza o estado a criar.';
  const FONTE_SITE = 'itcmd.com.br (página estadual revisada em set/2026); confirmar na Sefaz.';

  /* Hipótese de adequação para estados com alíquota fixa: faixas sucessivas iguais às de MT
     em reais — estado já adequado à LC 227/2026. Editável. */
  const HIPOTESE_PROGRESSIVA = f([[1500, 0], [4000, 0.02], [8000, 0.04], [16000, 0.06], [null, 0.08]], UPF_MT);
  const TXT_HIPOTESE_FIXA = 'Hipótese editável: o estado ainda não aprovou tabela progressiva; usadas as faixas de MT em reais.';
  const TXT_HIPOTESE_FAIXAS = 'Mesmas faixas aplicadas de forma sucessiva e sobre a parte de cada herdeiro, como exige a LC 227/2026 (art. 156).';

  const ESTADOS = {
    AC: { nome: 'Acre', lei: 'LC 373/2020, arts. 4º, 21, 29 e 30', dataRef: '2026-09', revisadoEm: '2026-10', unidade: { nome: 'R$', valor: 1 },
      somaDoacoes: 'A lei estadual ainda não soma doações sucessivas (a LC 227/2026 manda somar).', multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      vigente: {
        heranca: suc([[50000, 0], [1500000, 0.04], [2500000, 0.05], [3500000, 0.06], [null, 0.07]], { base: 'monte' }),
        doacao: suc([[25000, 0.02], [100000, 0.04], [200000, 0.06], [null, 0.08]])
      },
      alerta: 'A lei do Acre aplica a tabela ao total da herança; a LC 227/2026 exige a parte de cada herdeiro.' },
    AL: { nome: 'Alagoas', lei: 'Lei 5.077/1989, arts. 162 a 183 (redação da Lei 9.440/2024)', dataRef: '2026-09', revisadoEm: '2026-10', unidade: { nome: 'R$', valor: 1 },
      somaDoacoes: 'Doações do mesmo doador ao mesmo donatário em 12 meses são somadas (art. 168, parágrafo único, I).', multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      vigente: {
        heranca: tot([[1000000, 0.04], [10000000, 0.06], [null, 0.08]]),
        doacao: tot([[50000, 0.01], [100000, 0.015], [null, 0.02]])
      },
      alerta: 'A lei de Alagoas aplica a alíquota da faixa ao valor inteiro; a LC 227/2026 exige faixa a faixa.' },
    AP: { nome: 'Amapá', lei: 'Lei 3.149/2024, arts. 8º e 13', dataRef: '2026-10', revisadoEm: '2026-10', unidade: { nome: 'UPF/AP', valor: 4.9355 },
      somaDoacoes: 'Doações do mesmo doador ao mesmo donatário no ano são somadas (art. 8º, § 4º).', multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      vigente: {
        heranca: tot([[24677.5, 0.02], [246775, 0.03], [493550, 0.04], [987100, 0.05], [null, 0.06]], { base: 'monte' }),
        doacao: tot([[24677.5, 0.02], [246775, 0.03], [null, 0.04]])
      },
      alerta: 'A lei do Amapá aplica a alíquota ao valor inteiro, com a faixa definida pelo total transmitido; a LC 227/2026 exige faixa a faixa por herdeiro.' },
    AM: { nome: 'Amazonas', lei: 'LC 19/1997, art. 119-A (LC 269/2024 e LC 280/2025)', dataRef: '2026-09', revisadoEm: '2026-10', unidade: { nome: 'R$', valor: 1 },
      somaDoacoes: 'Doações do mesmo doador ao mesmo donatário em um ano são somadas (art. 119-A, § 3º).', multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      vigente: {
        heranca: suc([[2000000, 0.02], [6000000, 0.03], [null, 0.04]], { isencaoEspolio: 1000000 }),
        doacao: suc([[2000000, 0.02], [6000000, 0.03], [null, 0.04]], { isencao: tudo(150000) })
      },
      reformaIgualVigente: true },
    BA: { nome: 'Bahia', lei: 'Lei 4.826/1989, arts. 4º, 9º e 11 (redação da Lei 14.802/2024)', dataRef: '2026-09', revisadoEm: '2026-10', unidade: { nome: 'R$', valor: 1 },
      somaDoacoes: 'Doações do mesmo doador ao mesmo donatário no ano são somadas (art. 9º, parágrafo único).', multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      vigente: {
        heranca: tot([[100000, 0], [200000, 0.04], [300000, 0.06], [null, 0.08]]),
        doacao: tot([[200000, 0.03], [300000, 0.035], [null, 0.04]])
      },
      alerta: 'A Bahia aplica a alíquota da faixa ao quinhão inteiro; a LC 227/2026 exige faixa a faixa.' },
    CE: { nome: 'Ceará', lei: 'Lei 15.812/2015, arts. 8º, 11, 16 e 17', dataRef: '2026-01', revisadoEm: '2026-10', unidade: { nome: 'UFIRCE', valor: 6.29872 },
      somaDoacoes: 'Período de soma de doações ainda não definido em lei estadual.', multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      nuaPropriedadePct: 2 / 3,
      vigente: {
        heranca: suc([[44091.04, 0], [107078.24, 0.02], [170065.44, 0.04], [296039.84, 0.06], [null, 0.08]]),
        doacao: suc([[157468, 0.02], [944808, 0.04], [1574680, 0.06], [null, 0.08]])
      },
      reformaIgualVigente: true },
    DF: { nome: 'Distrito Federal', lei: 'Lei 3.804/2006 (Leis 5.549/2015 e 6.466/2019); valores de 2026 pelo Ato Declaratório SUREC 25/2025', dataRef: '2026-01', revisadoEm: '2026-10', unidade: { nome: 'R$', valor: 1 },
      somaDoacoes: 'Doações do mesmo doador ao mesmo donatário em 12 meses são somadas (art. 9º, § 2º).', multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      vigente: {
        heranca: suc([[1644288.5, 0.04], [3288577, 0.05], [null, 0.06]], { isencaoEspolio: 176080.78 }),
        doacao: suc([[1644288.5, 0.04], [3288577, 0.05], [null, 0.06]])
      },
      reformaIgualVigente: true },
    ES: { nome: 'Espírito Santo', lei: 'Lei 10.011/2013, arts. 10 e 12', dataRef: '2026-01', revisadoEm: '2026-10', unidade: { nome: 'VRTE', valor: 4.9383 },
      somaDoacoes: 'Doações do mesmo doador ao mesmo donatário no ano civil são somadas (art. 10, § 6º).', multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      vigente: { heranca: unica(0.04), doacao: unica(0.04, { isencao: tudo(24691.5) }) },
      alerta: 'O Espírito Santo ainda cobra 4% fixos; a EC estadual 119/2026 exige progressividade, mas a tabela não saiu.' },
    GO: { nome: 'Goiás', lei: 'Lei 11.651/1991 (CTE), arts. 72 a 91 (Lei 19.021/2015)', dataRef: '2026-09', revisadoEm: '2026-10', unidade: { nome: 'R$', valor: 1 },
      somaDoacoes: 'Doações do mesmo doador ao mesmo donatário em 12 meses são somadas (art. 77-A).', multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      vigente: {
        heranca: suc([[25000, 0.02], [200000, 0.04], [600000, 0.06], [null, 0.08]], { isencao: tudo(20000) }),
        doacao: suc([[25000, 0.02], [200000, 0.04], [600000, 0.06], [null, 0.08]], { isencao: tudo(20000) })
      },
      reformaIgualVigente: true },
    MA: { nome: 'Maranhão', lei: 'Lei 7.799/2002, arts. 105 a 110 (Lei 10.283/2015)', dataRef: '2026-01', revisadoEm: '2026-10', unidade: { nome: 'R$ (isenções em salários mínimos)', valor: 1 },
      somaDoacoes: 'Doações do mesmo doador ao mesmo donatário no ano são somadas (art. 110, parágrafo único, I).', multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      vigente: {
        heranca: tot([[300000, 0.03], [600000, 0.04], [900000, 0.05], [1200000, 0.06], [null, 0.07]], { isencaoEspolio: 51872 }),
        doacao: tot([[100000, 0.01], [300000, 0.015], [null, 0.02]], { isencao: tudo(34041) })
      },
      alerta: 'O Maranhão aplica a alíquota da faixa ao quinhão inteiro; a LC 227/2026 exige faixa a faixa.' },
    MT: {
      nome: 'Mato Grosso',
      lei: 'Lei nº 7.850/2002, art. 19 (redação da Lei nº 10.488/2016)',
      dataRef: '2026-09',
      revisadoEm: '2026-10',
      unidade: { nome: 'UPF/MT', valor: UPF_MT },
      somaDoacoes: 'Doações do mesmo doador ao mesmo donatário no ano civil são somadas (art. 19, § 5º).',
      multa: 'Inventário protocolado após 120 dias do óbito: multa de 5% do imposto; após 240 dias, 10%.',
      usufrutoExtincaoIsenta: true,
      nuaPropriedadePct: 0.70,
      vigente: {
        heranca: { metodo: 'sucessivas', faixas: f([[1500, 0], [4000, 0.02], [8000, 0.04], [16000, 0.06], [null, 0.08]], UPF_MT) },
        doacao: { metodo: 'sucessivas', faixas: f([[500, 0], [1000, 0.02], [4000, 0.04], [10000, 0.06], [null, 0.08]], UPF_MT) }
      },
      reformaIgualVigente: true
    },
    MS: {
      nome: 'Mato Grosso do Sul',
      lei: 'Lei nº 1.810/1997, arts. 121 a 143',
      dataRef: '2026-10',
      revisadoEm: '2026-10',
      unidade: { nome: 'R$', valor: 1 },
      somaDoacoes: 'Sem regra estadual de soma; a LC 227/2026 autoriza o estado a criar.',
      multa: 'Inventário requerido após 2 meses do óbito: multa de 20% do imposto.',
      usufrutoExtincaoIsenta: false,
      vigente: {
        heranca: { metodo: 'unica', aliquota: 0.06, isencao: { ate: 100000, tipo: 'tudoOuNada' } },
        doacao: { metodo: 'unica', aliquota: 0.03 }
      },
      reforma: {
        hipotese: 'Hipótese editável: MS ainda não aprovou tabela progressiva; usadas as faixas de MT em reais.',
        heranca: { metodo: 'sucessivas', faixas: HIPOTESE_PROGRESSIVA },
        doacao: { metodo: 'sucessivas', faixas: HIPOTESE_PROGRESSIVA }
      },
      alerta: 'MS ainda não adotou o ITCMD progressivo exigido pela LC 227/2026. Enquanto a lei não muda, doar custa 3% contra 6% na herança; uma lei nova só vale no ano seguinte e após 90 dias.'
    },
    MG: { nome: 'Minas Gerais', lei: 'Lei 14.941/2003, arts. 3º, 10 e 11', dataRef: '2026-01', revisadoEm: '2026-10', unidade: { nome: 'UFEMG', valor: 5.7899 },
      somaDoacoes: 'Doações ao mesmo donatário em três anos civis são somadas (art. 11).', multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      vigente: { heranca: unica(0.05), doacao: unica(0.05, { isencao: tudo(57899) }) },
      alerta: 'Minas Gerais ainda cobra 5% fixos; o PL 2.881/2024 (e emenda de 2026 com 3%, 5% e 8%) não foi votado. Pagamento em 90 dias tem desconto de 15% na herança (não modelado).' },
    PA: {
      nome: 'Pará',
      lei: 'Lei nº 5.529/1989, art. 8º (redação da Lei nº 8.868/2019)',
      dataRef: '2026-01',
      revisadoEm: '2026-10',
      unidade: { nome: 'UPF-PA', valor: UPF_PA },
      somaDoacoes: 'Doações do mesmo doador ao mesmo donatário no ano civil são somadas (art. 8º, § 2º).',
      multa: 'Inventário não requerido em 2 meses: multa fixa de 300 UPF-PA.',
      usufrutoExtincaoIsenta: false,
      vigente: {
        heranca: { metodo: 'sucessivas', faixas: f([[15000, 0.02], [50000, 0.03], [150000, 0.04], [350000, 0.05], [null, 0.06]], UPF_PA) },
        doacao: { metodo: 'sucessivas', faixas: f([[60000, 0.02], [120000, 0.03], [null, 0.04]], UPF_PA) }
      },
      reformaIgualVigente: true,
      alerta: 'A lei aplica as faixas de forma sucessiva (art. 8º, § 1º), mas há quem leia de outro modo; confirme o cálculo com a Sefa-PA.'
    },
    PB: { nome: 'Paraíba', lei: 'Lei 5.123/1989, arts. 6º, 7º e 8º (Leis 10.507/2015 e 12.585/2023)', dataRef: '2026-10', revisadoEm: '2026-10', unidade: { nome: 'UFR-PB', valor: 74.13 },
      somaDoacoes: 'Doações do mesmo doador ao mesmo donatário no ano são somadas (art. 8º, § 10).', multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      vigente: {
        heranca: suc([[125000, 0.02], [400000, 0.04], [1000000, 0.06], [null, 0.08]], { base: 'monte' }),
        doacao: suc([[125000, 0.02], [1000000, 0.04], [2000000, 0.06], [null, 0.08]])
      },
      alerta: 'A Paraíba define a faixa pelo total da herança; a LC 227/2026 exige a parte de cada herdeiro.' },
    PR: { nome: 'Paraná', lei: 'Lei 18.573/2015, art. 22', dataRef: '2026-10', revisadoEm: '2026-10', unidade: { nome: 'UPF/PR', valor: 152.25 },
      somaDoacoes: SOMA_NAO_INFORMADA, multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      vigente: { heranca: unica(0.04), doacao: unica(0.04) },
      alerta: 'O Paraná ainda cobra 4% fixos; a tabela de 2% a 8% foi retirada da Lei 22.262/2024. Há isenções para imóvel residencial urbano e rural de até 25 ha (não modeladas).' },
    PE: { nome: 'Pernambuco', lei: 'Lei 13.974/2009, Anexo 2, arts. 9º e 11 (LC 563/2025)', dataRef: '2026-01', revisadoEm: '2026-10', unidade: { nome: 'R$ (corrigido pelo IPCA a partir de 2027)', valor: 1 },
      somaDoacoes: 'Doações no ano civil somam para a isenção de R$ 80 mil; para as faixas, a lei ainda não soma.', multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      nuaPropriedadePct: 2 / 3,
      vigente: {
        heranca: suc([[80000, 0], [350000, 0.02], [550000, 0.04], [750000, 0.06], [null, 0.08]]),
        doacao: suc([[80000, 0], [350000, 0.02], [550000, 0.04], [750000, 0.06], [null, 0.08]])
      },
      reformaIgualVigente: true },
    PI: { nome: 'Piauí', lei: 'Lei 4.261/1989, art. 15 (LC 327/2025 e Lei 8.558/2024)', dataRef: '2026-01', revisadoEm: '2026-10', unidade: { nome: 'UFR-PI', valor: 4.95 },
      somaDoacoes: SOMA_NAO_INFORMADA, multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      vigente: {
        heranca: suc([[49500, 0.02], [742500, 0.04], [null, 0.06]], { isencaoEspolio: 74250 }),
        doacao: suc([[49500, 0.02], [null, 0.04]], { isencao: tudo(14850) })
      },
      reformaIgualVigente: true },
    RJ: { nome: 'Rio de Janeiro', lei: 'Lei 7.174/2015, art. 26 (Lei 7.786/2017)', dataRef: '2026-01', revisadoEm: '2026-10', unidade: { nome: 'UFIR-RJ', valor: 4.9604 },
      somaDoacoes: SOMA_NAO_INFORMADA, multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      vigente: {
        heranca: tot([[347228, 0.04], [496040, 0.045], [992080, 0.05], [1488120, 0.06], [1984160, 0.07], [null, 0.08]], { isencaoEspolio: 64485.2 }),
        doacao: tot([[347228, 0.04], [496040, 0.045], [992080, 0.05], [1488120, 0.06], [1984160, 0.07], [null, 0.08]])
      },
      alerta: 'O Rio de Janeiro aplica uma única alíquota, conforme a faixa, ao valor inteiro; a LC 227/2026 exige faixa a faixa. A Sefaz-RJ pode usar o total transmitido.' },
    RN: { nome: 'Rio Grande do Norte', lei: 'Lei 5.887/1989, arts. 1º, 5º e 7º (Lei 9.993/2015)', dataRef: '2026-09', revisadoEm: '2026-10', unidade: { nome: 'R$', valor: 1 },
      somaDoacoes: SOMA_NAO_INFORMADA, multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      vigente: {
        heranca: suc([[500000, 0.03], [1000000, 0.04], [3000000, 0.05], [null, 0.06]]),
        doacao: suc([[500000, 0.03], [1000000, 0.04], [3000000, 0.05], [null, 0.06]])
      },
      reformaIgualVigente: true },
    RS: { nome: 'Rio Grande do Sul', lei: 'Lei 8.821/1989, arts. 18 e 19', dataRef: '2026-01', revisadoEm: '2026-10', unidade: { nome: 'UPF-RS', valor: 28.3264 },
      somaDoacoes: 'Doações às mesmas pessoas em menos de 1 ano são somadas (art. 19, § 2º, I).', multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      vigente: {
        heranca: tot([[56652.8, 0], [283264, 0.03], [849792, 0.04], [1416320, 0.05], [null, 0.06]]),
        doacao: tot([[283264, 0.03], [null, 0.04]])
      },
      alerta: 'O Rio Grande do Sul aplica a alíquota da faixa ao valor inteiro do quinhão; a LC 227/2026 exige faixa a faixa, mas a Receita Estadual ainda cobra pela lei gaúcha.' },
    RO: {
      nome: 'Rondônia',
      lei: 'Lei nº 959/2000, arts. 5º e 6º',
      dataRef: '2026-10',
      revisadoEm: '2026-10',
      unidade: { nome: 'UPF/RO', valor: UPF_RO },
      somaDoacoes: 'Sem regra estadual de soma; a LC 227/2026 autoriza o estado a criar.',
      multa: 'Inventário aberto após 60 dias: multa de 10% do imposto; após 120 dias, 20%.',
      usufrutoExtincaoIsenta: false,
      vigente: {
        heranca: { metodo: 'total', faixas: f([[1250, 0.02], [6170, 0.03], [null, 0.04]], UPF_RO), isencao: { ate: 62 * UPF_RO, tipo: 'tudoOuNada' } },
        doacao: { metodo: 'total', faixas: f([[1250, 0.02], [6170, 0.03], [null, 0.04]], UPF_RO), isencao: { ate: 62 * UPF_RO, tipo: 'tudoOuNada' } }
      },
      reforma: {
        hipotese: 'Mesmas faixas aplicadas de forma sucessiva, como exige a LC 227/2026 (art. 156, § 2º).',
        heranca: { metodo: 'sucessivas', faixas: f([[1250, 0.02], [6170, 0.03], [null, 0.04]], UPF_RO) },
        doacao: { metodo: 'sucessivas', faixas: f([[1250, 0.02], [6170, 0.03], [null, 0.04]], UPF_RO) }
      },
      alerta: 'RO aplica a alíquota da faixa sobre o quinhão inteiro; a LC 227/2026 exige faixas sucessivas. Pode haver discussão sobre qual regra prevalece.'
    },
    RR: { nome: 'Roraima', lei: 'Lei 59/1993, arts. 73 a 95', dataRef: '2026-01', revisadoEm: '2026-10', unidade: { nome: 'UFERR', valor: 540.57 },
      somaDoacoes: SOMA_NAO_INFORMADA, multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      vigente: { heranca: unica(0.04, { isencao: tudo(27028.5) }), doacao: unica(0.04, { isencao: tudo(27028.5) }) },
      alerta: 'Roraima ainda cobra 4% fixos e não há projeto de tabela progressiva.' },
    SC: { nome: 'Santa Catarina', lei: 'Lei 13.136/2004, arts. 2º, 7º e 9º (Leis 18.831/2024 e 19.053/2024)', dataRef: '2026-09', revisadoEm: '2026-10', unidade: { nome: 'R$', valor: 1 },
      somaDoacoes: 'Doações do mesmo doador ao mesmo donatário em 12 meses são somadas (art. 9º, parágrafo único).', multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      nuaPropriedadePct: 0.5,
      vigente: {
        heranca: suc([[20000, 0.01], [50000, 0.03], [150000, 0.05], [null, 0.07]], { isencao: tudo(20000) }),
        doacao: suc([[20000, 0.01], [50000, 0.03], [150000, 0.05], [null, 0.07]], { isencao: tudo(20000) })
      },
      reformaIgualVigente: true },
    SP: { nome: 'São Paulo', lei: 'Lei 10.705/2000, arts. 6º, 9º e 16', dataRef: '2026-01', revisadoEm: '2026-10', unidade: { nome: 'UFESP', valor: 38.42 },
      somaDoacoes: 'Doações do mesmo doador ao mesmo donatário no ano civil são somadas (art. 9º, § 3º).', multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      vigente: { heranca: unica(0.04), doacao: unica(0.04, { isencao: tudo(96050) }) },
      alerta: 'São Paulo ainda cobra 4% fixos; os PLs 7/2024 e 409/2025 estão parados na Alesp. Pagamento em 90 dias tem desconto de 5% na herança, e há isenções para imóvel residencial e aplicações de pequeno valor (não modelados).' },
    SE: { nome: 'Sergipe', lei: 'Lei 7.724/2013, arts. 8º, 10 e 14 (Lei 9.297/2023)', dataRef: '2026-10', revisadoEm: '2026-10', unidade: { nome: 'UFP/SE', valor: 87.19 },
      somaDoacoes: 'Doações do mesmo doador ao mesmo donatário em 12 meses são somadas (art. 10, § 7º).', multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      vigente: {
        heranca: tot([[43595, 0], [210738.23, 0.03], [1053778.34, 0.06], [null, 0.08]]),
        doacao: tot([[43595, 0], [601611, 0.02], [1053778.34, 0.04], [2375753.12, 0.06], [null, 0.08]]),
        doacaoMoveis: unica(0.02, { isencao: tudo(43595) })
      },
      alerta: 'Sergipe aplica a alíquota da faixa ao quinhão inteiro; a LC 227/2026 exige faixa a faixa. Doação de dinheiro, aplicações e cotas paga 2% (usado na holding); cotas de empresa na herança pagam 2% (não modelado).' },
    TO: { nome: 'Tocantins', lei: 'Lei 1.287/2001, arts. 53 a 68 (Lei 3.019/2015)', dataRef: '2026-09', revisadoEm: '2026-10', unidade: { nome: 'R$', valor: 1 },
      somaDoacoes: 'Doações do mesmo doador ao mesmo donatário em 5 anos são somadas (art. 60, § 8º).', multa: MULTA_CONFERIR, fonte: FONTE_SITE,
      vigente: {
        heranca: tot([[25000, 0], [100000, 0.02], [500000, 0.04], [2000000, 0.06], [null, 0.08]]),
        doacao: tot([[25000, 0], [100000, 0.02], [500000, 0.04], [2000000, 0.06], [null, 0.08]])
      },
      alerta: 'Tocantins aplica a alíquota da faixa ao valor inteiro; a LC 227/2026 exige faixa a faixa.' }
  };

  /* honorários de referência por estado (tabelas das seccionais da OAB) */
  const HONORARIOS = {
    padrao: { cartorio: 0.06, judicial: 0.08, litigio: 0.10, fonte: 'Referência das tabelas da OAB (6% cartório, 8% judicial, 10% com litígio); tabela da seccional não conferida.' },
    RO: { cartorio: 0.10, judicial: 0.10, litigio: 0.10, fonte: 'Tabela de Honorários OAB-RO 2024: inventário, 10% (sem a meação).' }
  };

  /** Estados em ordem alfabética do nome, para listas. */
  const SIGLAS = Object.keys(ESTADOS).sort((a, b) => ESTADOS[a].nome.localeCompare(ESTADOS[b].nome, 'pt-BR'));

  /** Adequação à LC 227/2026 derivada da lei vigente (quando o estado não tem uma explícita). */
  function reformaDerivada(e) {
    const conv = t => t.metodo === 'unica'
      ? { metodo: 'sucessivas', faixas: HIPOTESE_PROGRESSIVA }
      : Object.assign({}, t, { metodo: 'sucessivas', base: 'quinhao' });
    const fixa = e.vigente.heranca.metodo === 'unica';
    const r = { hipotese: fixa ? TXT_HIPOTESE_FIXA : TXT_HIPOTESE_FAIXAS, heranca: conv(e.vigente.heranca), doacao: conv(e.vigente.doacao) };
    if (e.vigente.doacaoMoveis) r.doacaoMoveis = e.vigente.doacaoMoveis.metodo === 'unica' ? e.vigente.doacaoMoveis : conv(e.vigente.doacaoMoveis);
    return r;
  }
  /** Texto da adequação à reforma do estado (vazio quando já cumpre). */
  function hipoteseReforma(uf) {
    const e = ESTADOS[uf];
    if (!e || e.reformaIgualVigente) return '';
    return (e.reforma || reformaDerivada(e)).hipotese;
  }

  /** Tabela do regime pedido: 'vigente' | 'reforma' | 'estresse'. */
  function tabela(uf, regime) {
    const e = ESTADOS[uf];
    if (!e) throw new Error('Estado sem tabela: ' + uf);
    const ref = e.reformaIgualVigente ? e.vigente : (e.reforma || reformaDerivada(e));
    if (regime === 'vigente' || !regime) return e.vigente;
    if (regime === 'reforma') return ref;
    if (regime === 'estresse') {
      const dobra = t => t && Object.assign({}, t, { metodo: 'sucessivas', base: 'quinhao',
        faixas: (t.faixas || [{ ate: Infinity, aliq: t.aliquota }]).map(x => ({ ate: x.ate, aliq: Math.min(0.16, x.aliq * 2) })) });
      const o = { heranca: dobra(ref.heranca), doacao: dobra(ref.doacao) };
      if (ref.doacaoMoveis) o.doacaoMoveis = dobra(ref.doacaoMoveis);
      return o;
    }
    throw new Error('Regime desconhecido: ' + regime);
  }

  return { ESTADOS, HONORARIOS, SIGLAS, tabela, hipoteseReforma, UNIDADES: { UPF_MT, UPF_RO, UPF_PA } };
});
