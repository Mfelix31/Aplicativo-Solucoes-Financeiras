/*
 * Tabelas de ITCMD por estado — Planejamento Sucessório
 * --------------------------------------------------------------
 * Dados (não lógica). Cada estado tem três regimes:
 *  - vigente:  a lei estadual em vigor na data de referência;
 *  - reforma:  adequação à LC 227/2026 (faixas sucessivas, teto 8%).
 *              Onde o estado já cumpre, é igual à vigente; onde não
 *              cumpre, é uma HIPÓTESE editável, rotulada como tal;
 *  - estresse: as alíquotas da reforma em dobro, limitadas a 16%
 *              (teto proposto no PRS 57/2019, não aprovado).
 *
 * Métodos de cálculo:
 *  - 'sucessivas': cada alíquota incide só sobre a parcela dentro da faixa;
 *  - 'total':      a alíquota da faixa em que o valor cai incide sobre todo o valor;
 *  - 'unica':      uma alíquota sobre todo o valor.
 * Isenção 'tudoOuNada': valor até o limite não paga; acima, paga sobre tudo.
 * Faixas e limites em REAIS (convertidos pela unidade fiscal da data de
 * referência); a unidade e a conversão ficam registradas para atualização.
 * Base de cálculo: valor de mercado do quinhão de cada herdeiro (herança)
 * ou do bem doado a cada donatário (doação) — LC 227/2026, arts. 148 e 152.
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

  const f = (lista, mult) => lista.map(([ate, aliq]) => ({ ate: ate === null ? Infinity : ate * mult, aliq }));

  /* Hipótese de adequação para MS (estado sem lei progressiva até out/2026):
     faixas sucessivas iguais às de MT em reais — vizinho já adequado. Editável. */
  const HIPOTESE_PROGRESSIVA = f([[1500, 0], [4000, 0.02], [8000, 0.04], [16000, 0.06], [null, 0.08]], UPF_MT);

  const ESTADOS = {
    MT: {
      nome: 'Mato Grosso',
      lei: 'Lei nº 7.850/2002, art. 19 (redação da Lei nº 10.488/2016)',
      dataRef: '2026-09',
      unidade: { nome: 'UPF/MT', valor: UPF_MT },
      somaDoacoes: 'Doações do mesmo doador ao mesmo donatário no ano civil são somadas (art. 19, § 5º).',
      multa: 'Inventário protocolado após 120 dias do óbito: multa de 5% do imposto; após 240 dias, 10%.',
      usufrutoExtincaoIsenta: true,
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
      }
    },
    RO: {
      nome: 'Rondônia',
      lei: 'Lei nº 959/2000, arts. 5º e 6º',
      dataRef: '2026-10',
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
      }
    },
    PA: {
      nome: 'Pará',
      lei: 'Lei nº 5.529/1989, art. 8º (redação da Lei nº 8.868/2019)',
      dataRef: '2026-01',
      unidade: { nome: 'UPF-PA', valor: UPF_PA },
      somaDoacoes: 'Doações do mesmo doador ao mesmo donatário no ano civil são somadas (art. 8º, § 2º).',
      multa: 'Inventário não requerido em 2 meses: multa fixa de 300 UPF-PA.',
      usufrutoExtincaoIsenta: false,
      vigente: {
        heranca: { metodo: 'sucessivas', faixas: f([[15000, 0.02], [50000, 0.03], [150000, 0.04], [350000, 0.05], [null, 0.06]], UPF_PA) },
        doacao: { metodo: 'sucessivas', faixas: f([[60000, 0.02], [120000, 0.03], [null, 0.04]], UPF_PA) }
      },
      reformaIgualVigente: true
    }
  };

  /* honorários de referência por estado (tabelas das seccionais da OAB) */
  const HONORARIOS = {
    padrao: { cartorio: 0.06, judicial: 0.08, litigio: 0.10, fonte: 'Referência das tabelas da OAB (6% cartório, 8% judicial, 10% com litígio); tabela da seccional não conferida.' },
    RO: { cartorio: 0.10, judicial: 0.10, litigio: 0.10, fonte: 'Tabela de Honorários OAB-RO 2024: inventário, 10% (sem a meação).' }
  };

  /** Tabela do regime pedido: 'vigente' | 'reforma' | 'estresse'. */
  function tabela(uf, regime) {
    const e = ESTADOS[uf];
    if (!e) throw new Error('Estado sem tabela: ' + uf);
    const ref = e.reformaIgualVigente ? e.vigente : e.reforma;
    if (regime === 'vigente' || !regime) return e.vigente;
    if (regime === 'reforma') return ref;
    if (regime === 'estresse') {
      const dobra = t => ({ metodo: 'sucessivas', faixas: (t.faixas || [{ ate: Infinity, aliq: t.aliquota }]).map(x => ({ ate: x.ate, aliq: Math.min(0.16, x.aliq * 2) })) });
      return { heranca: dobra(ref.heranca), doacao: dobra(ref.doacao) };
    }
    throw new Error('Regime desconhecido: ' + regime);
  }

  return { ESTADOS, HONORARIOS, tabela, UNIDADES: { UPF_MT, UPF_RO, UPF_PA } };
});
