/*
 * Planejamento Sucessório — lógica da página (sucessao.html).
 *
 * Organização deste arquivo:
 *   1. Utilidades
 *   2. Constantes da página (nomes e cores dos caminhos)
 *   3. Estado
 *   4. Entradas: leitura dos campos → objeto do motor
 *   5. Dicas ao vivo
 *   6. Cálculo (chama o motor e guarda o resultado em `ultimo`)
 *   7. Resultados (conclusão, destaques, custo de não planejar, cards, seguro, aluguel, holding, alertas)
 *   8. Gráfico
 *   9. Relatório em PDF
 *  10. Ligações e início
 *
 * Regras de cálculo ficam no motor (engine/sucessao.js) e as tabelas de ITCMD em
 * dados/itcmd-uf.js; aqui só há leitura de campos, textos e desenho.
 */
(function () {
'use strict';

/* =========================================================================
 * 1. Utilidades
 * ========================================================================= */
const E = window.SucessaoEngine;
const T = window.ItcmdUF;
const $ = id => document.getElementById(id);
const HOJE = new Date();
const {brl: fmtBRL, brl0: fmtBRL0, pct: fmtPct, curto: fmtCurto, anos: fmtAnos, esc, lerMoeda, moeda, mascara} = Formato;
const num = id => { const v = parseFloat($(id).value); return isNaN(v) ? NaN : v; };
const money = id => lerMoeda($(id));
const pctCampo = id => num(id) / 100;
const linha = (k, v, cls) => '<div class="lrow"><span class="k">' + k + '</span><span class="v' + (cls ? ' ' + cls : '') + '">' + v + '</span></div>';
const cssVar = Grafico.cssVar;
const pct0 = v => fmtPct(v, 0);
const pct1 = v => fmtPct(v, 1);

/* =========================================================================
 * 2. Constantes da página
 * ========================================================================= */
const ESTR_NOME = { nenhuma: '', doacao: 'Doação com usufruto', holdingGradual: 'Holding (doação gradual)', holdingTotal: 'Holding (doação total)' };
const LIQ_NOME = { nenhuma: '', previdencia: 'previdência', seguro: 'whole life', combinado: 'previdência + whole life' };
const COR_ESTR = { doacao: '--l-verde', holdingGradual: '--hl', holdingTotal: '--gold' };
const COR_LIQ = { nenhuma: '--ink-faint', previdencia: '--l-turq', seguro: '--l-roxo', combinado: '--blue-dim' };
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
/** nome de uma combinação, montado da estrutura e da liquidez */
function nomeDe(c){
  if(!c) return '';
  let n;
  if(c.estrutura === 'nenhuma') n = c.liquidez === 'nenhuma' ? 'Só o inventário' : cap(LIQ_NOME[c.liquidez]);
  else n = (c.liquidez === 'nenhuma' ? 'Só a ' + ESTR_NOME[c.estrutura].charAt(0).toLowerCase() + ESTR_NOME[c.estrutura].slice(1) : ESTR_NOME[c.estrutura] + ' + ' + LIQ_NOME[c.liquidez]);
  return n + (c.offshore ? ' + offshore' : '');
}
const corDe = c => c.estrutura === 'nenhuma' ? COR_LIQ[c.liquidez] : COR_ESTR[c.estrutura];
const HIP = { proximo: 'No próximo ano', dez: 'Em 10 anos', expectativa: 'Na expectativa de vida' };
const PRAZO_INV = { cartorio: '30 a 90 dias', judicial: '1 a 3 anos', litigio: '3 anos ou mais' };
const MOTIVO_HOLDING = {
  numeros: m => '<b>Os números não favorecem:</b> ' + nomeId(m.vencedor) + ' entrega ' + fmtBRL0(m.diferenca) + ' a mais à família que a melhor opção com holding (R$ de hoje).',
  caixa: m => '<b>Falta dinheiro para estruturar:</b> com holding, seria preciso pagar ' + (m.externoHoje > 0 ? fmtBRL0(m.externoHoje) + ' à parte hoje' : 'até ' + fmtBRL0(m.externoMensalMax) + ' por mês à parte') + '.',
  financeiro: () => '<b>O patrimônio é principalmente financeiro:</b> a previdência leva esse dinheiro aos herdeiros sem empresa.',
  poucosImoveis: m => '<b>' + (m.n === 1 ? 'Há um só imóvel' : 'Há poucos imóveis') + ':</b> a doação direta com usufruto resolve sem custo anual.',
  aluguel: m => '<b>A holding pagaria mais imposto sobre os aluguéis:</b> ' + fmtBRL0(m.diferencaAno) + ' a mais no próximo ano, já com a contabilidade.'
};

/* =========================================================================
 * 3. Estado
 * ========================================================================= */
const seg = { regime: 'vigente', grafico: null };
let ultimo = null;          // { inp, r }
let timer = null;
let ufHonorarios = null;    // estado cujos honorários de referência estão nos campos
let itbiTocado = false;     // enquanto o planejador não editar o ITBI, ele segue a regra automática
let mesesTocado = false;    // idem para os meses de sustento (padrão pelo tipo de inventário)
const LIMITE_MESES_TABELA = 6;   // tabela de ITCMD com referência mais antiga que isso gera alerta

/* =========================================================================
 * 4. Entradas
 * ========================================================================= */
function lerEntradas(){
  return {
    idade: num('idade'), uf: $('uf').value, herdeiros: num('herdeiros'), tipoInventario: $('tipoInv').value,
    conjuge: { regime: $('regimeBens').value, pctComuns: pctCampo('pctComuns'), ascendenteComum: $('ascComum').checked },
    sustento: { despesaMensal: money('despesaFamilia'), meses: num('mesesSustento') },
    sobraMensal: money('sobraMensal'), sucessaoCasal: $('sucessaoCasal').checked,
    regime: seg.regime,
    imoveis: money('imoveis'), nImoveis: num('nImoveis') || 0, aplicacoes: money('aplicacoes'), empresa: money('empresa'), exterior: money('exterior'),
    previdenciaTipo: $('prevTipo').value,
    previdencia: money('previdencia'), previdenciaAportado: money('previdencia') > 0 ? Math.min(money('prevAportado') || money('previdencia'), money('previdencia')) : 0,
    previdenciaAnos: num('prevAnos') || 0, seguroExistente: money('seguroExist'),
    rendaMensal: money('rendaMensal'), outrasRendasMensais: money('outrasRendas'),
    aluguelMensal: money('aluguel'), deducoesAluguelMensal: money('dedAluguel'), nImoveisAlugados: num('nAlugados') || 0, nResidenciais: num('nResid') || 0,
    doacaoCustoPct: pctCampo('dCusto'),
    premissas: { rentabilidade: pctCampo('rentab'), ipca: pctCampo('ipca'), metaLiquidez: pctCampo('meta'), irAplicacoes: pctCampo('irAplic'),
      margemEmpate: pctCampo('margem'), comprometimentoRenda: pctCampo('comprometimento'), taxaAdmPrevidencia: pctCampo('taxaAdm'), rentabilidadeBruta: $('rentBruta').checked, anoInicial: HOJE.getFullYear() },
    custos: { honorarios: { cartorio: pctCampo('honCart'), judicial: pctCampo('honJud'), litigio: pctCampo('honLit') },
      escrituraPct: pctCampo('escPct'), custasPct: pctCampo('custasPct'), registroPct: pctCampo('regPct'), certidoes: money('certidoes'), multaPctImposto: pctCampo('multa') },
    holding: { juridicoPct: pctCampo('hJur'), juridicoMin: money('hJurMin'), cartorioPct: pctCampo('hCart'), itbiPct: pctCampo('hItbi'), laudo: money('hLaudo'),
      contabilMensal: money('hContab'), anosDoacaoGradual: num('hAnos') || 10, incluirEmpresa: $('hEmpresa').checked },
    aluguelOpcoes: { lc224: $('hLc224').checked, opcao487: $('h487').checked, aliqRefIVA: pctCampo('hIva') },
    wholeLife: { parcelaPor100k: money('wlParcela'), basicaPor100k: money('wlBasica'), ganhoReal: pctCampo('wlGanho'),
      idadeReferencia: num('wlIdadeRef'), ajustarIdade: $('wlAjustar').checked,
      sexo: $('sexo').value, sexoReferencia: $('wlSexoRef').value, tabua: $('wlTabua').value },
    offshore: { limiar: money('oLimiar'), abertura: money('oAbertura'), manutencaoAnual: money('oManut'),
      custoSucessaoExteriorPct: pctCampo('oCustoExt'), impostoExteriorPct: pctCampo('oImpExt') },
    sinais: { incapaz: $('sinIncapaz').checked, conflito: $('sinConflito').checked, empresa: $('sinEmpresa').checked }
  };
}

/** erros de campo que o motor não vê (campos numéricos vazios ou fora do intervalo) */
function errosDeCampo(inp){
  const e = [];
  const campos = [['comprometimento','Limite para pagar à parte'],['mesesSustento','Meses a cobrir'],['pctComuns','Bens comuns'],['wlIdadeRef','Idade da proposta de referência'],['rentab','Rentabilidade'],['ipca','Inflação'],['meta','Custo esperado do inventário'],['honCart','Honorários'],['hJur','Jurídico da holding']];
  campos.forEach(([id, nome]) => { if(!isFinite(num(id))) e.push(nome + ': preencha o campo.'); });
  if(inp.nResidenciais > inp.nImoveisAlugados) e.push('Os imóveis residenciais não podem passar dos alugados.');
  if(inp.wholeLife.basicaPor100k > inp.wholeLife.parcelaPor100k) e.push('A cobertura básica do whole life não pode passar da parcela.');
  return e;
}

/* =========================================================================
 * 5. Dicas ao vivo
 * ========================================================================= */
function atualizarDicas(){
  const uf = $('uf').value, est = T.ESTADOS[uf];
  const idade = num('idade');
  if(isFinite(idade) && idade >= 18 && idade <= 100){
    const e = E.expectativaSobrevida(idade);
    $('hintIdade').textContent = 'Expectativa de vida pela tábua do IBGE (2024): mais ' + e.toLocaleString('pt-BR') + ' anos, até cerca de ' + Math.round(idade + e) + ' anos.';
  } else $('hintIdade').textContent = '';
  $('hintUf').textContent = 'ITCMD: ' + est.lei + '. ' + est.somaDoacoes;
  $('hintMulta').textContent = est.multa;
  $('hintRegime').textContent = seg.regime === 'vigente' ? 'Tabela em vigor no estado (referência ' + est.dataRef.split('-').reverse().join('/') + ').'
    : seg.regime === 'reforma' ? (est.reformaIgualVigente ? 'O estado já cumpre a LC 227/2026: igual à lei vigente.' : (T.ESTADOS[uf].reforma.hipotese))
    : 'Alíquotas da reforma em dobro, até 16% (PRS 57/2019, em tramitação, não aprovado). Teste de robustez.';
  // honorários de referência do estado (só troca se o usuário não alterou os campos daquele estado)
  if(ufHonorarios !== uf){
    const h = E.honorariosPadrao(uf);
    $('honCart').value = +(h.cartorio * 100).toFixed(2); $('honJud').value = +(h.judicial * 100).toFixed(2); $('honLit').value = +(h.litigio * 100).toFixed(2);
    $('subHonorarios').textContent = h.fonte;
    ufHonorarios = uf;
  }
  const alug = money('aluguel') > 0;
  $('hintPrevTipo').textContent = $('prevTipo').value === 'pgbl' ? 'PGBL: o IR incide sobre todo o saldo; o valor aportado não muda a conta.' : 'VGBL: o IR do beneficiário incide só sobre o rendimento.';
  // regime de bens
  const rb = $('regimeBens').value, nH = Math.max(1, Math.round(num('herdeiros') || 1));
  $('campoComuns').hidden = rb === 'sem' || rb === 'obrigatoria';
  $('lblComuns').hidden = rb !== 'parcial';
  $('lblFiliacao').hidden = rb === 'parcial';
  $('pctComuns').closest('.row-input').hidden = rb !== 'parcial';
  $('pctComuns').closest('.field').querySelector('.hint').hidden = rb !== 'parcial';
  const part = E.partilha({ herdeiros: nH, regime: rb, pctComuns: pctCampo('pctComuns'), ascendenteComum: $('ascComum').checked });
  $('campoAsc').hidden = !part.conjugeHerdeiro;
  $('campoCasal').hidden = !(part.meacaoPct > 0);
  $('hintRegimeBens').textContent = ({
    sem: 'Toda a herança vai aos filhos.',
    parcial: 'Meação de metade dos bens comuns; o cônjuge também herda sobre os bens particulares (CC, art. 1.829, I).',
    universal: 'Meação de metade de tudo; o cônjuge não herda junto com os filhos.',
    separacao: 'Sem meação; o cônjuge herda junto com os filhos sobre todos os bens.',
    obrigatoria: 'Sem meação nem herança do cônjuge (a Súmula 377 do STF não está modelada).'
  })[rb] + (isFinite(part.meacaoPct) ? ' Meação: ' + pct0(part.meacaoPct) + ' do patrimônio' + (part.conjugeHerdeiro ? '; cônjuge com ' + pct1(part.fracConjuge) + ' da herança.' : '.') : '');
  // sustento: meses seguem o tipo de inventário até o planejador editar
  const tipo = $('tipoInv').value;
  if(!mesesTocado) $('mesesSustento').value = E.MESES_SUSTENTO[tipo];
  $('hintSustento').textContent = 'Padrão: 3 meses em cartório, 24 no judicial, 36 com conflito. ' +
    (money('despesaFamilia') > 0 && isFinite(num('mesesSustento')) ? 'Soma ' + fmtBRL0(money('despesaFamilia') * num('mesesSustento')) + ' ao que a família precisa ter em dinheiro (R$ de hoje).' : '');
  // whole life pela idade
  const wlRef = num('wlIdadeRef');
  if($('wlAjustar').checked && isFinite(idade) && isFinite(wlRef) && money('wlParcela') > 0){
    const f = E.fatorIdadeWholeLife(idade, { idadeReferencia: wlRef, parcelaPor100k: money('wlParcela'), ganhoReal: pctCampo('wlGanho'),
      sexo: $('sexo').value, sexoReferencia: $('wlSexoRef').value, tabua: $('wlTabua').value });
    $('hintWlIdade').textContent = (($('sexo').value === 'f') ? 'Mulher' : 'Homem') + ' de ' + idade + ' anos: ' + fmtBRL(money('wlParcela') * f.fator) + ' por R$ 100 mil (fator ' + f.fator.toLocaleString('pt-BR', {maximumFractionDigits:3}) + ', ' + f.tabua + ').';
  } else $('hintWlIdade').textContent = 'Parcela fixa da proposta, para qualquer idade e sexo.';
  if(!itbiTocado) $('hItbi').value = alug ? 2 : 0;
  $('hintItbi').textContent = alug ? 'Com aluguéis, a holding tende a ter atividade imobiliária preponderante e pagar ITBI integral (2% a 3% conforme o município).' : 'Imune quando a atividade preponderante não é imobiliária (STF, Tema 796: até o valor do capital).';
}

/* =========================================================================
 * 6. Cálculo
 * ========================================================================= */
function agendar(){ clearTimeout(timer); timer = setTimeout(recalcular, 250); }

function recalcular(){
  atualizarDicas();
  const inp = lerEntradas();
  const errosCampo = errosDeCampo(inp);
  let r;
  try { r = errosCampo.length ? { ok: false, erros: errosCampo } : E.analisar(inp); }
  catch(err){
    console.error(err);
    r = { ok: false, erros: ['Não foi possível calcular com esses dados. Confira os valores informados; se o problema continuar, salve a simulação e envie o arquivo para revisão.'] };
  }
  const banner = $('errBanner');
  if(!r.ok){
    banner.innerHTML = '<strong>Revise os dados:</strong><ul>' + r.erros.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
    banner.classList.add('show');
    $('resultados').classList.add('stale');
    $('btnPdf').disabled = true;
    ultimo = null;
    return;
  }
  banner.classList.remove('show');
  $('resultados').classList.remove('stale');
  $('btnPdf').disabled = false;
  ultimo = { inp, r };
  try { renderResultados(); }
  catch(err){
    console.error(err);
    banner.innerHTML = '<strong>Erro ao mostrar o resultado.</strong> Os números foram calculados, mas a tela não pôde ser montada. Salve a simulação e envie o arquivo para revisão.';
    banner.classList.add('show');
  }
}

/* =========================================================================
 * 7. Resultados
 * ========================================================================= */
const venc = r => r.caminhos.find(c => c.id === r.recomendacao.vencedor);
const porId = id => ultimo && ultimo.r.caminhos.find(c => c.id === id);
const nomeId = id => nomeDe(porId(id)) || id;
const valorEm = (c, h) => c.em[h].familiaReal;
const parcelaSeguro = (c, e) => e.wholeLife.parcelaPor100k * c.cfg.C / 100000;   // R$/mês no 1º ano

/** componentes da solução, cada um com o que é e quanto custa */
function componentes(c, r){
  const e = r.entrada, out = [];
  if(c.cfg.holding) out.push({ tipo: 'holding', cor: COR_ESTR[c.estrutura], titulo: c.cfg.holding === 'gradual' ? 'Holding com doação gradual' : 'Holding com doação total',
    texto: 'Integralizar ' + fmtBRL0(e.imoveis + (e.holding.incluirEmpresa ? e.empresa : 0)) + ' e doar ' + (c.cfg.holding === 'gradual' ? 'as cotas aos filhos em ' + fmtAnos(e.holding.anosDoacaoGradual) : 'todas as cotas aos filhos já') + ', com usufruto.' });
  if(c.cfg.doaImoveis) out.push({ tipo: 'doacao', cor: COR_ESTR.doacao, titulo: 'Doação dos imóveis com usufruto', texto: 'Passar ' + fmtBRL0(e.imoveis) + ' em imóveis aos filhos agora; o cooperado continua usando e recebendo a renda.' });
  if(c.cfg.X > 0) out.push({ tipo: 'previdencia', cor: COR_LIQ.previdencia, titulo: 'Previdência (VGBL)', texto: 'Levar ' + fmtBRL0(c.cfg.X) + ' das aplicações, com os herdeiros como beneficiários.' });
  if(c.cfg.C > 0) out.push({ tipo: 'seguro', cor: COR_LIQ.seguro, titulo: 'Whole life', texto: 'Capital de ' + fmtBRL0(c.cfg.C) + '; parcela de ' + fmtBRL0(parcelaSeguro(c, e)) + '/mês por ' + e.wholeLife.anosPagamento + ' anos, corrigida pelo IPCA.' });
  if(c.cfg.offshore) out.push({ tipo: 'offshore', cor: '--teal', titulo: 'Offshore', texto: 'Levar ' + fmtBRL0(e.exterior) + ' de bens no exterior para uma empresa no exterior.' });
  return out;
}

/** por que esta solução: frases curtas com números */
function motivos(v, r){
  const e = r.entrada, rec = r.recomendacao, inv = r.caminhos.find(c => c.id === 'inventario'), out = [];
  const nTest = r.caminhos.length;
  if(v.protegeJa) out.push('<b>Protege desde já:</b> a família recebe ' + fmtBRL0(v.em.proximo.liquidez) + ' em dias, o suficiente para pagar todo o inventário' + (e.sustento.despesaMensal > 0 ? ' e as despesas da família' : '') + ' sem vender bens.');
  else out.push('<b>Cobre ' + pct0(v.coberturaAno1) + ' do inventário no 1º ano</b>, a maior cobertura possível com o que foi informado.');
  const outros = rec.ordem.filter(id => id !== v.id).map(porId).filter(Boolean);
  if(rec.nivel === 2) out.push('<b>Vale pagar uma parte por fora:</b> pede até ' + fmtBRL0(v.pagamento.externoMensalMax) + '/mês além da sobra e das aplicações' + (e.rendaMensal > 0 ? ' (' + pct0(v.pagamento.externoMensalMax / e.rendaMensal) + ' da renda, dentro do limite de ' + pct0(e.premissas.comprometimentoRenda) + ')' : '') + '; mesmo descontando esse dinheiro, entrega mais à família' + (rec.alternativaSemAParte ? ' (' + fmtBRL0(rec.alternativaSemAParte.perda) + ' a mais que a melhor opção sem pagar à parte)' : '') + '.');
  if(rec.porSimplicidade) out.push('<b>Mais simples, quase o mesmo valor:</b> ' + nomeId(rec.maiorValor) + ' entregaria só ' + fmtBRL0(valorEm(porId(rec.maiorValor), 'expectativa') - valorEm(v, 'expectativa')) + ' a mais (menos de ' + pct0(e.premissas.margemEmpate) + ').');
  else if(outros.length) out.push('<b>Entrega mais à família:</b> das ' + nTest + ' combinações testadas, é a de maior valor na expectativa de vida; a 2ª melhor (' + nomeDe(outros[0]) + ') entrega ' + fmtBRL0(valorEm(v, 'expectativa') - valorEm(outros[0], 'expectativa')) + ' a menos.');
  const ganho = valorEm(v, 'expectativa') - valorEm(inv, 'expectativa');
  if(v.id !== 'inventario' && ganho >= 0) out.push('<b>Vale a pena fazer:</b> ' + fmtBRL0(ganho) + ' a mais do que não planejar nada (R$ de hoje, já descontados todos os custos).');
  else if(v.id !== 'inventario') out.push('<b>Custo da proteção:</b> a família recebe ' + fmtBRL0(-ganho) + ' a menos do que sem planejar, ' +
    (v.pagamento.externo >= 1 ? 'por causa do dinheiro pago à parte' : 'porque ' + (v.cfg.C > 0 ? 'as parcelas do seguro' : 'os custos') + ' somam mais do que a solução devolve na expectativa de vida') +
    '. Em troca, tem ' + fmtBRL0(r.base.metaHoje) + ' em dinheiro para o inventário logo após o falecimento; sem isso, precisaria vender bens ou esperar a partilha.');
  if(v.cfg.holding || v.cfg.doaImoveis){
    const a1 = v.sim.pagamentos[1] && v.sim.pagamentos[1].itens.aluguel;
    out.push('<b>' + (v.cfg.holding ? 'Holding' : 'Doação') + ':</b> os imóveis saem do inventário' + (e.meacaoPct > 0 && e.sucessaoCasal ? ' do cooperado e do cônjuge' : '') + (v.cfg.holding && a1 < 0 ? ', e a holding paga ' + fmtBRL0(-a1) + ' a menos de imposto sobre os aluguéis por ano' : '') + '. A doação feita agora trava o ITCMD de hoje.');
  }
  if(v.cfg.X > 0) out.push('<b>Previdência:</b> usa dinheiro que já está aplicado, sem parcela nova; fica fora do inventário e sem ITCMD.');
  if(v.cfg.C > 0) out.push('<b>Whole life:</b> o capital chega em dias, sem IR nem ITCMD' + (v.cfg.X > 0 ? ', e cobre o que a previdência sozinha não alcança' : '') + '.');
  if(r.holding.aplicavel && !r.holding.recomendada){
    const m = r.holding.motivos[0], h = porId(r.holding.melhor);
    const pq = !m ? 'não traz vantagem neste caso' : m.id === 'numeros' ? 'a melhor opção com holding (' + nomeDe(h) + ') entregaria ' + fmtBRL0(m.diferenca) + ' a menos'
      : m.id === 'caixa' ? 'não cabe no orçamento (' + porqueNao(h, v, r) + ')' : m.id === 'financeiro' ? 'o patrimônio é principalmente financeiro' : m.id === 'poucosImoveis' ? 'há poucos imóveis' : 'pagaria mais imposto sobre os aluguéis';
    out.push('<b>Sem holding:</b> ' + pq + '. Deixar de abrir evita ' + fmtBRL0(r.holding.custoEvitado) + ' de custo.');
  }
  const sn = ultimo.inp.sinais;
  if((sn.conflito || sn.empresa) && r.holding.aplicavel && !r.holding.recomendada){
    const h = r.caminhos.filter(c => (c.estrutura === 'holdingGradual' || c.estrutura === 'holdingTotal') && c.protegeJa)
      .sort((a, b) => (a.cabe === 'nao') - (b.cabe === 'nao') || valorEm(b, 'expectativa') - valorEm(a, 'expectativa'))[0];
    if(h && h.id !== v.id){
      const d = valorEm(v, 'expectativa') - valorEm(h, 'expectativa');
      const quem = [sn.conflito ? 'risco de conflito' : '', sn.empresa ? 'empresa operacional' : ''].filter(Boolean).join(' e ');
      let comp;
      if(h.cabe === 'nao') comp = 'não cabe no orçamento informado (' + porqueNao(h, v, r) + ')';
      else if(d > 0) comp = 'entrega ' + fmtBRL0(d) + ' a menos (' + pct1(d / Math.max(1, valorEm(v, 'expectativa'))) + ')';
      else if(h.cabe === 'aParte' && v.cabe === 'sim') comp = 'entrega ' + fmtBRL0(-d) + ' a mais, mas precisa de até ' + fmtBRL0(h.pagamento.externoMensalMax) + '/mês à parte, enquanto a solução cabe no orçamento';
      else comp = 'entrega ' + fmtBRL0(-d) + ' a mais, mas a diferença fica abaixo de ' + pct0(e.premissas.margemEmpate) + ' e a regra favorece o caminho mais simples';
      out.push('<b>Governança:</b> há ' + quem + '. A melhor opção com holding (' + nomeDe(h) + ') ' + comp +
        '. Em troca, organiza quem decide e evita condomínio entre herdeiros: avalie com o advogado se esse benefício compensa.');
    }
  }
  const est = r.estabilidade, av = [];
  if(est.proximo) av.push('se o falecimento for no próximo ano, ' + nomeId(est.proximo) + ' entregaria mais');
  if(est.dez) av.push('em 10 anos, ' + nomeId(est.dez) + ' entregaria mais');
  if(est.estresse) av.push('se o ITCMD dobrar, ' + nomeId(est.estresse) + ' passaria à frente');
  if(av.length) out.push('<b>Atenção:</b> ' + av.join('; ') + '.');
  return out;
}

/** como pagar: cada custo e de onde sai o dinheiro */
function comoPagar(v, r){
  const e = r.entrada, pg = v.sim.pagamentos, z = v.pagamento, linhas = [];
  const p0 = pg[0];
  if(p0.custo > 0) linhas.push(['Estruturação hoje', fmtBRL0(p0.custo) + ' uma vez', p0.externo > 0.5 ? fmtBRL0(p0.custo - p0.externo) + ' das aplicações + <b class="no-t">' + fmtBRL0(p0.externo) + ' à parte</b>' : 'das aplicações']);
  if(v.cfg.X > 0) linhas.push(['Previdência', fmtBRL0(v.cfg.X) + ' uma vez', 'transferido das aplicações (não é custo: continua da família)']);
  const anosCom = k => pg.filter(p => p.ano > 0 && p.itens[k] > 0.5);
  const media = (k, l) => l.reduce((a, p) => a + p.itens[k] / Math.pow(1 + e.premissas.ipca, p.ano), 0) / Math.max(1, l.length);
  if(v.cfg.C > 0) linhas.push(['Parcela do whole life', fmtBRL0(parcelaSeguro(v, e)) + '/mês por ' + e.wholeLife.anosPagamento + ' anos', 'corrigida pelo IPCA']);
  if(v.cfg.holding){
    linhas.push(['Contabilidade da holding', fmtBRL0(e.holding.contabilMensal) + '/mês', 'enquanto a holding existir']);
    const g = anosCom('itcmdDoacao');
    if(g.length) linhas.push(['ITCMD das doações anuais', '≈ ' + fmtBRL0(media('itcmdDoacao', g)) + '/ano por ' + g.length + ' anos', 'R$ de hoje, com o laudo de cada doação']);
    const a1 = pg[1] && pg[1].itens.aluguel;
    if(a1) linhas.push(['Imposto sobre os aluguéis', (a1 < 0 ? 'economia de ' : 'a mais: ') + fmtBRL0(Math.abs(a1)) + ' no 1º ano', a1 < 0 ? 'a economia vai para as aplicações' : 'comparado à pessoa física']);
  }
  if(v.cfg.offshore) linhas.push(['Manutenção da offshore', fmtBRL0(e.offshore.manutencaoAnual) + '/ano', '']);
  // quem paga, em R$ de hoje
  const tot = z.daSobra + z.daRendimento + z.daPrincipal + z.externo;
  const fontes = [
    { c: 'p-sobra', t: 'sobra mensal', v: z.daSobra }, { c: 'p-rend', t: 'rendimentos das aplicações', v: z.daRendimento },
    { c: 'p-princ', t: 'dinheiro aplicado (principal)', v: z.daPrincipal }, { c: 'p-fora', t: 'pago à parte', v: z.externo }];
  let resumo;
  if(tot < 1) resumo = 'Não há custo a pagar: a solução usa só o que já existe.';
  else if(z.externo < 1 && !z.principalConsumido) resumo = '<b>Cabe no orçamento sem mexer no dinheiro aplicado:</b> ' + (z.daSobra > 0 ? 'a sobra mensal' + (z.daRendimento > 0 ? ' e os rendimentos das aplicações pagam' : ' paga') : 'os rendimentos das aplicações pagam') + ' todos os custos.';
  else if(z.externo < 1) resumo = '<b>Cabe no orçamento, usando parte do dinheiro aplicado:</b> ' + fmtBRL0(z.daPrincipal) + ' (R$ de hoje) saem do principal das aplicações; o resto vem ' + (z.daSobra > 0 ? 'da sobra e ' : '') + 'dos rendimentos.';
  else resumo = '<b>Precisa de dinheiro à parte:</b> ' + (z.externoHoje > 0.5 ? fmtBRL0(z.externoHoje) + ' hoje' + (z.externoMensalMax > 0 ? ' e ' : '') : '') +
    (z.externoMensalMax > 0 ? 'até ' + fmtBRL0(z.externoMensalMax) + ' por mês' + (e.rendaMensal > 0 ? ' (' + pct0(z.externoMensalMax / e.rendaMensal) + ' da renda)' : '') : '') +
    ', porque a sobra e as aplicações não bastam' + (z.anosExterno.length ? ' (anos ' + faixaAnos(z.anosExterno) + ')' : '') + '. Esse dinheiro já está descontado do valor à família.';
  return { linhas, fontes: fontes.filter(f => f.v > 0.5), tot, resumo };
}
function faixaAnos(l){
  const a = l.filter(x => x > 0); if(!a.length) return 'hoje';
  return a.length === 1 ? a[0] + 'º' : a[0] + 'º ao ' + a[a.length - 1] + 'º';
}

/** passo a passo simples para executar cada parte */
function passos(v, r){
  const e = r.entrada, out = [];
  const comuns = e.conjuge.regime === 'parcial' || e.conjuge.regime === 'universal';
  if(v.cfg.X > 0) out.push({ titulo: 'Previdência (VGBL)', quem: 'Sicoob', itens: [
    'Abrir um VGBL de ' + fmtBRL0(v.cfg.X) + ' com recursos das aplicações (veja IR e carência dos produtos que serão resgatados).',
    'Indicar os herdeiros como beneficiários, com o percentual de cada um.',
    'Escolher a tabela regressiva de IR (cai para 10% após 10 anos).',
    'Revisar os beneficiários sempre que a família mudar (casamento, nascimento, divórcio).'] });
  if(v.cfg.C > 0) out.push({ titulo: 'Whole life', quem: 'Corretor / Sicoob Seguros', itens: [
    'Pedir a cotação com capital de ' + fmtBRL0(v.cfg.C) + ' para ' + (e.wholeLife.sexo === 'f' ? 'mulher' : 'homem') + ' de ' + e.idade + ' anos.',
    'Preencher a declaração de saúde (a seguradora pode pedir exames).',
    'Indicar os beneficiários: o capital paga o inventário e chega em dias.',
    'Colocar a parcela (' + fmtBRL0(parcelaSeguro(v, e)) + '/mês hoje) em débito automático; ela é corrigida pelo IPCA por ' + e.wholeLife.anosPagamento + ' anos.'] });
  if(v.cfg.holding) out.push({ titulo: v.cfg.holding === 'gradual' ? 'Holding com doação gradual' : 'Holding com doação total', quem: 'Advogado + contador', itens: [
    'Definir com advogado e contador o contrato social (LTDA), com usufruto, cláusulas de proteção (inalienabilidade, incomunicabilidade) e regras de quem administra.',
    'Registrar a empresa na Junta Comercial e obter o CNPJ.',
    'Integralizar os imóveis: escritura e registro no cartório de imóveis, com o ITBI pago ou a imunidade pedida à prefeitura' + (e.aluguelMensal > 0 ? ' (com aluguéis, a tendência é pagar ITBI)' : '') + '.',
    (v.cfg.holding === 'gradual' ? 'Doar ' + fmtPct(1 / Math.max(1, e.holding.anosDoacaoGradual), 0) + ' das cotas por ano aos filhos, com laudo de avaliação e ITCMD pago antes de cada alteração do contrato.' : 'Doar todas as cotas aos filhos com reserva de usufruto, com laudo de avaliação e ITCMD pago antes da alteração do contrato.') + (comuns ? ' O cônjuge assina junto.' : ''),
    'Passar os contratos de aluguel para a holding e manter a contabilidade mensal.'] });
  if(v.cfg.doaImoveis) out.push({ titulo: 'Doação com usufruto', quem: 'Advogado + cartório', itens: [
    'Avaliar os imóveis a valor de mercado (base do ITCMD).',
    'Declarar a doação e pagar o ITCMD na Sefaz de ' + e.uf + ' (vale a lei de hoje).',
    'Lavrar a escritura de doação com reserva de usufruto no cartório de notas' + (comuns ? ', com o cônjuge' : '') + '.',
    'Registrar a escritura no cartório de imóveis.'] });
  if(v.cfg.offshore) out.push({ titulo: 'Offshore', quem: 'Especialista em estruturas no exterior', itens: [
    'Escolher a jurisdição e abrir a empresa com o especialista.',
    'Transferir os bens no exterior para a empresa.',
    'Declarar à Receita e pagar o IR anual de 15% (Lei 14.754/2023).'] });
  if(e.previdencia > 0 || e.seguroExistente > 0) out.push({ titulo: 'Previdência e seguro que já existem', quem: 'Sicoob / seguradora', itens: [
    'Confirmar que os beneficiários são os herdeiros: ' + [e.previdencia > 0 ? fmtBRL0(e.previdencia) + ' de previdência' : '', e.seguroExistente > 0 ? fmtBRL0(e.seguroExistente) + ' de seguro' : ''].filter(Boolean).join(' e ') + ' já entram no pagamento do inventário.',
    'Conferir se o seguro existente é vitalício; seguro com prazo pode acabar antes do falecimento.'] });
  const sn = ultimo.inp.sinais;
  out.push({ titulo: 'Testamento (recomendado em qualquer solução)', quem: 'Advogado + cartório de notas', itens: [
    'Fazer testamento público para organizar a parte disponível (' + fmtBRL0(r.base.disponivel) + ') e evitar disputas.']
    .concat(sn.incapaz ? ['Nomear no testamento um tutor para o filho menor ou incapaz (CC, art. 1.729) e quem administra os bens até a maioridade.',
      'Valores de seguro e previdência para beneficiário menor são administrados pelo responsável legal e podem exigir autorização judicial: alinhe isso com o advogado.'] : [])
    .concat(['Revisar o planejamento a cada 2 anos ou quando a família ou a lei mudarem.']) });
  return out;
}

const coberturaTxt = x => !isFinite(x) ? 'nada vai a inventário' : x > 3 ? 'mais de 300%' : pct0(x);

/** frase curta para uma alternativa não escolhida */
function porqueNao(c, v, r){
  if(!c.protegeJa) return 'não paga todo o inventário no 1º ano (' + (isFinite(c.coberturaAno1) ? pct0(c.coberturaAno1) : '—') + ')';
  if(c.cabe === 'nao'){
    const z = c.pagamento, p = [];
    if(z.externoHoje > 0.5) p.push(fmtBRL0(z.externoHoje) + ' à parte hoje');
    if(z.externoMensalMax >= 1) p.push('até ' + fmtBRL0(z.externoMensalMax) + '/mês à parte');
    return 'precisa de ' + (p.join(' e ') || 'dinheiro à parte');
  }
  if(c.cabe === 'aParte' && v.cabe === 'sim') return 'pede ' + fmtBRL0(c.pagamento.externoMensalMax) + '/mês à parte';
  const d = valorEm(v, 'expectativa') - valorEm(c, 'expectativa');
  return d >= 0 ? 'entrega ' + fmtBRL0(d) + ' a menos à família' : 'entrega ' + fmtBRL0(-d) + ' a mais, mas é mais complexa';
}

const NIVEL = {
  1: { cls: 'ok', t: 'Cabe no orçamento' },
  2: { cls: 'neutral', t: 'Precisa de dinheiro à parte, dentro do limite da renda' },
  3: { cls: 'no', t: 'Precisa de dinheiro à parte acima do limite da renda' },
  4: { cls: 'no', t: 'Nenhuma combinação cobre todo o inventário desde já' }
};

function renderVerdict(){
  const {r} = ultimo, rec = r.recomendacao, v = venc(r), e = r.entrada, inv = r.caminhos.find(c => c.id === 'inventario');
  const comp = componentes(v, r), pg = comoPagar(v, r), ps = passos(v, r);
  const nv = NIVEL[rec.nivel];
  const chips = comp.length ? comp.map(x => '<div class="sol-chip" style="--cl:var(' + x.cor + ')"><b>' + x.titulo + '</b><span>' + x.texto + '</span></div>').join('')
    : '<div class="sol-chip" style="--cl:var(--ink-faint)"><b>Nada a estruturar agora</b><span>A previdência e o seguro já existentes pagam o inventário.</span></div>';
  const kpi = (k, val, s) => '<div class="sol-kpi"><div class="k">' + k + '</div><div class="v">' + val + '</div>' + (s ? '<div class="s">' + s + '</div>' : '') + '</div>';
  const ganho = valorEm(v, 'expectativa') - valorEm(inv, 'expectativa');
  const bar = pg.tot > 0.5 ? '<div class="qbar">' + pg.fontes.map(f => '<span class="' + f.c + '" style="--w:' + Math.max(1.5, f.v / pg.tot * 100).toFixed(2) + '%"></span>').join('') + '</div>' +
    '<ul class="qleg">' + pg.fontes.map(f => '<li class="' + f.c + '"><span>' + f.t + '</span><b>' + fmtBRL0(f.v) + '</b></li>').join('') + '</ul>' : '';
  // alternativas: primeiro as que protegem e cabem, depois as que protegem mas pedem dinheiro de fora, por fim as que não protegem
  const grupo = c => !c.protegeJa ? 3 : c.cabe === 'sim' ? 0 : c.cabe === 'aParte' ? 1 : 2;
  const alt = r.caminhos.filter(c => c.id !== v.id && c.id !== 'inventario')
    .sort((a, b) => grupo(a) - grupo(b) || valorEm(b, 'expectativa') - valorEm(a, 'expectativa')).slice(0, 4);
  const altAParte = rec.alternativaSemAParte ? '<li><b>Sem pagar nada à parte:</b> a melhor opção seria ' + nomeId(rec.alternativaSemAParte.id) + ', que entrega ' + fmtBRL0(rec.alternativaSemAParte.perda) + ' a menos à família.</li>' : '';
  $('verdict').innerHTML =
    '<div class="sol-top"><span class="sol-eyebrow">Solução para este caso</span><span class="status ' + nv.cls + '">' + nv.t + '</span></div>' +
    '<h2 class="sol-nome">' + nomeDe(v) + '</h2>' +
    (!(e.sobraMensal > 0) && e.rendaMensal > 0 && v.pagamento.custo > 0.5 ? '<p class="sol-aviso"><b>Sobra mensal não informada:</b> a simulação considera que nada da renda (' + fmtBRL0(e.rendaMensal) + '/mês) sobra para o planejamento, e os custos saem das aplicações ou à parte. Informe a sobra na etapa 1 para um resultado mais fiel.</p>' : '') +
    '<div class="sol-chips">' + chips + '</div>' +
    '<div class="sol-kpis">' +
      kpi('Chega à família', fmtBRL0(valorEm(v, 'expectativa')), 'na expectativa de vida (' + Math.round(e.idade + r.Texp) + ' anos), em R$ de hoje') +
      (ganho >= 0 || v.id === 'inventario' ? kpi('A mais que não planejar', v.id === 'inventario' ? '—' : fmtBRL0(ganho), 'já descontados todos os custos')
        : kpi('Custo da proteção', fmtBRL0(-ganho), 'a menos que sem planejar' + (v.pagamento.externo >= 1 ? ', pelo dinheiro pago à parte' : ', em troca da liquidez imediata'))) +
      kpi('Inventário pago no 1º ano', coberturaTxt(v.coberturaAno1), 'precisa de ' + fmtBRL0(r.base.metaHoje) + ' em dinheiro') +
    '</div>' +
    '<div class="sol-grid">' +
      '<div class="sol-box"><h3>Por que esta solução</h3><ul class="sol-lista">' + motivos(v, r).map(x => '<li>' + x + '</li>').join('') + '</ul></div>' +
      '<div class="sol-box"><h3>Como pagar</h3>' +
        (pg.linhas.length ? '<table class="t sol-t">' + pg.linhas.map(l => '<tr><td>' + l[0] + '</td><td>' + l[1] + '</td><td class="suave">' + l[2] + '</td></tr>').join('') + '</table>' : '') +
        '<p class="sol-resumo">' + pg.resumo + '</p>' + bar +
      '</div>' +
    '</div>' +
    '<div class="sol-box sol-passos"><h3>O que fazer, passo a passo</h3><div class="sol-passos-grid">' +
      ps.map((p, i) => '<div class="sol-passo"><div class="sol-passo-h"><span class="q-n">' + (i + 1) + '</span><b>' + p.titulo + '</b><span class="suave">' + p.quem + '</span></div><ol>' + p.itens.map(x => '<li>' + x + '</li>').join('') + '</ol></div>').join('') +
    '</div></div>' +
    (alt.length || altAParte ? '<div class="sol-box"><h3>Outras opções e por que ficaram atrás</h3><ul class="sol-lista">' + altAParte +
      alt.map(c => '<li><b>' + nomeDe(c) + '</b>: ' + porqueNao(c, v, r) + '.</li>').join('') + '</ul></div>' : '');
}

function renderDestaques(){
  const {r} = ultimo, h = r.holding, out = [];
  if(h.aplicavel){
    if(h.recomendada) out.push('<div class="destaque" style="--cl:var(--l-verde)"><h4>Holding recomendada</h4><p>Neste caso a holding entrega mais à família do que a alternativa simples, mesmo com os custos de abrir e manter.</p></div>');
    else out.push('<div class="destaque" style="--cl:var(--hl)"><h4>Holding não recomendada</h4>' + h.motivos.map(m => '<p>' + MOTIVO_HOLDING[m.id](m) + '</p>').join('') +
      '<div class="big">' + fmtBRL0(h.custoEvitado) + '</div><p>de custo evitado: abertura e manutenção até a expectativa de vida, em R$ de hoje.</p></div>');
  }
  const v = venc(r);
  if(r.seguroDesnecessario && v && !(v.cfg.C > 0)){
    out.push('<div class="destaque" style="--cl:var(--l-roxo)"><h4>Whole life não é necessário para o inventário</h4><p>A previdência com ' + fmtBRL0(r.previdencia.X) + ' das aplicações já paga sozinha o custo esperado do inventário, em todos os anos. O seguro só faria sentido por outro motivo (por exemplo, proteger a renda da família).</p></div>');
  } else if(!r.seguroDesnecessario && r.previdencia.disponivel > 0){
    out.push('<div class="destaque" style="--cl:var(--l-roxo)"><h4>As aplicações não bastam para a previdência</h4><p>Mesmo levando todas as aplicações (' + fmtBRL0(r.previdencia.disponivel) + ') para a previdência, falta liquidez para o inventário. O whole life cobre a diferença.</p></div>');
  }
  $('destaques').innerHTML = out.join('');
}

function renderBase(){
  const {r} = ultimo, b = r.base, e = r.entrada;
  const total = e.imoveis + e.aplicacoes + e.empresa + e.exterior;
  $('baseSub').innerHTML = 'Quatro respostas para a pergunta: <b>se o falecimento fosse hoje, sem planejamento nenhum, o que aconteceria?</b> ' + fmtBRL0(total) + ' iriam a inventário em ' + T.ESTADOS[e.uf].nome + ', ' + ({cartorio:'em cartório', judicial:'na Justiça', litigio:'na Justiça, com conflito'})[e.tipoInventario] + '.';
  const pat = total, mil = v => fmtCurto(v);
  const barra = partes => '<div class="qbar">' + partes.filter(x => x.v > 0).map(x => '<span class="' + x.c + '" style="--w:' + Math.max(1.5, x.v * 100).toFixed(2) + '%" title="' + esc(x.t) + '"></span>').join('') + '</div>';
  const legenda = itens => '<ul class="qleg">' + itens.filter(x => x.mostra !== false).map(x => '<li class="' + x.c + '"><span>' + x.t + '</span><b>' + x.v + '</b></li>').join('') + '</ul>';
  const card = (n, pergunta, valor, oque, visual, conta) => '<div class="q-card">' +
    '<div class="q-top"><span class="q-n">' + n + '</span><span class="q-p">' + pergunta + '</span></div>' +
    '<div class="q-v">' + valor + '</div><p class="q-o">' + oque + '</p>' + visual +
    '<p class="q-c"><b>Como foi calculado:</b> ' + conta + '</p></div>';
  // 1. quanto a família precisa ter em dinheiro
  const c1 = card(1, 'Quanto a família precisa ter em dinheiro logo após o falecimento?', fmtBRL0(b.metaHoje),
    'É o <b>custo esperado do inventário</b>' + (b.sustentoHoje > 0 ? ' mais as despesas da família enquanto ele corre' : '') + ': o dinheiro para pagar tudo sem vender bens' +
      '. Previdência e whole life são dimensionados para pagar esse valor sozinhos.',
    barra([{ c: 'p-meta', v: b.metaInventarioHoje / pat, t: 'Inventário' }, { c: 'p-sus', v: b.sustentoHoje / pat, t: 'Sustento' }, { c: 'p-resto', v: Math.max(0, 1 - b.metaHoje / pat), t: 'Restante do patrimônio' }]) +
    legenda([{ c: 'p-meta', t: 'custo esperado do inventário (' + pct0(e.premissas.metaLiquidez) + ')', v: fmtBRL0(b.metaInventarioHoje) },
      { c: 'p-sus', t: e.sustento.meses + ' meses de despesas', v: fmtBRL0(b.sustentoHoje), mostra: b.sustentoHoje > 0 },
      { c: 'p-resto', t: 'restante do patrimônio', v: fmtBRL0(Math.max(0, pat - b.metaHoje)) }]),
    pct0(e.premissas.metaLiquidez) + ' de ' + fmtBRL0(pat) + ' (média observada em MT e MS: ITCMD, advogado, cartório, contador e trâmites)' +
      (b.sustentoHoje > 0 ? ' + ' + fmtBRL0(e.sustento.despesaMensal) + ' × ' + e.sustento.meses + ' meses' : '') + '.');
  // 2. quanto o inventário custaria pela conta item a item
  const folga = b.metaInventarioHoje - b.custoHoje.total;
  const c2 = card(2, 'Quanto o inventário custaria, item por item, pela lei e pelas tabelas?', fmtBRL0(b.custoHoje.total),
    'É uma <b>conferência</b> do custo esperado, pela lei do estado. ' + (folga >= 0
      ? 'A média de ' + pct0(e.premissas.metaLiquidez) + ' fica ' + fmtBRL0(folga) + ' acima da conta pela lei: a diferença é o que a experiência mostra e a conta não vê (multas, avaliações, atrasos, imprevistos).'
      : '<b>A conta pela lei passou do custo esperado em ' + fmtBRL0(-folga) + ':</b> neste caso, considere aumentar o percentual na etapa 2.'),
    barra([{ c: 'p-est', v: Math.min(1, b.custoHoje.total / Math.max(1, b.metaInventarioHoje)), t: 'Estimativa' }, { c: 'p-resto', v: Math.max(0, 1 - b.custoHoje.total / Math.max(1, b.metaInventarioHoje)), t: 'Folga da meta' }]) +
    legenda([{ c: 'p-est', t: 'estimativa (' + pct1(b.custoHoje.pct) + ' do patrimônio)', v: fmtBRL0(b.custoHoje.total) },
      { c: 'p-resto', t: 'diferença até a média de ' + pct0(e.premissas.metaLiquidez), v: fmtBRL0(Math.max(0, folga)) }]),
    'ITCMD ' + mil(b.custoHoje.itcmd) + ' + honorários ' + mil(b.custoHoje.honorarios) + ' + ' + (e.tipoInventario === 'cartorio' ? 'escritura ' : 'custas ') + mil(b.custoHoje.cartorio) +
      ' + registro ' + mil(b.custoHoje.registro) + ' + certidões ' + mil(b.custoHoje.certidoes) + (b.custoHoje.multa > 0 ? ' + multa ' + mil(b.custoHoje.multa) : '') + '. Detalhe na tabela abaixo.');
  // 3. quanto tempo os bens ficam travados
  const diasInv = { cartorio: 90, judicial: 1095, litigio: 1460 }[e.tipoInventario], diasLiq = 30;
  const c3 = card(3, 'Quanto tempo a família fica sem poder usar os bens?', PRAZO_INV[e.tipoInventario],
    'Enquanto o inventário não termina, os bens ficam <b>travados</b>: não podem ser vendidos nem divididos, e as contas do falecido ficam bloqueadas. Previdência e seguro não entram no inventário e chegam aos beneficiários em dias.',
    '<div class="qtempo"><div><span>Inventário ' + ({cartorio:'em cartório', judicial:'judicial', litigio:'com conflito'})[e.tipoInventario] + '</span><div class="qbar"><span class="p-trava" style="--w:100%"></span></div><b>' + PRAZO_INV[e.tipoInventario] + '</b></div>' +
      '<div><span>Previdência e seguro</span><div class="qbar"><span class="p-meta" style="--w:' + Math.max(3, diasLiq / diasInv * 100).toFixed(1) + '%"></span></div><b>até 30 dias</b></div></div>',
    'prazo usual do tipo de inventário escolhido na etapa 1 (cartório: herdeiros de acordo e maiores; judicial: menores, incapazes ou desacordo).');
  // 4. de quem é o patrimônio
  const c4 = card(4, 'Quanto é herança e quanto já é do cônjuge?', fmtBRL0(b.heranca) + ' <small>de herança</small>',
    (b.meacao > 0 ? 'A <b>meação</b> (' + fmtBRL0(b.meacao) + ') já é do cônjuge pelo regime de bens: não é herança e não paga ITCMD. ' : 'Não há meação neste regime de bens. ') +
      'Da herança, a <b>legítima</b> fica obrigatoriamente com os herdeiros necessários; a <b>parte disponível</b> pode ir para quem o cooperado quiser, por testamento ou doação.',
    barra([{ c: 'p-meacao', v: b.meacao / pat, t: 'Meação' }, { c: 'p-leg', v: b.legitima / pat, t: 'Legítima' }, { c: 'p-disp', v: b.disponivel / pat, t: 'Disponível' }]) +
    legenda([{ c: 'p-meacao', t: 'meação do cônjuge', v: fmtBRL0(b.meacao), mostra: b.meacao > 0 },
      { c: 'p-leg', t: 'legítima (herdeiros necessários)', v: fmtBRL0(b.legitima) },
      { c: 'p-disp', t: 'parte disponível (testamento ou doação)', v: fmtBRL0(b.disponivel) }]),
    'patrimônio ' + fmtBRL0(pat) + (b.meacao > 0 ? ' − meação ' + fmtBRL0(b.meacao) : '') + ' = herança ' + fmtBRL0(b.heranca) + '; metade legítima, metade disponível (Código Civil, arts. 1.789 e 1.846)' +
      (e.partilha.conjugeHerdeiro ? '. O cônjuge também herda ' + pct1(e.partilha.fracConjuge) + ' da herança junto com os filhos' : '') + '.' +
      (b.conjugeHoje ? ' <b>Sucessão do casal:</b> quando a meação passar aos filhos, haverá um 2º inventário de cerca de ' + fmtBRL0(b.conjugeHoje.total) + ' (hoje); ele entra na comparação dos caminhos.' : ''));
  $('baseCards').innerHTML = c1 + c2 + c3 + c4;
  const rg = b.regimes, linhaT = (k, f) => '<tr><td>' + k + '</td>' + ['vigente','reforma','estresse'].map(x => '<td>' + fmtBRL0(f(rg[x])) + '</td>').join('') + '</tr>';
  $('tabInventario').innerHTML = '<tr><th>Componente</th><th>Lei vigente</th><th>Adequação à reforma</th><th>Estresse 16%</th></tr>' +
    linhaT('ITCMD (por quinhão)', c => c.itcmd) + linhaT('Honorários', c => c.honorarios) +
    linhaT(e.tipoInventario === 'cartorio' ? 'Escritura' : 'Custas judiciais', c => c.cartorio) + linhaT('Registro dos imóveis', c => c.registro) +
    linhaT('Certidões', c => c.certidoes) + (e.custos.multaPctImposto > 0 ? linhaT('Multa por atraso', c => c.multa) : '') +
    '<tr class="now"><td>Total</td>' + ['vigente','reforma','estresse'].map(x => '<td>' + fmtBRL0(rg[x].total) + ' <small class="suave inline">(' + pct1(rg[x].pct) + ')</small></td>').join('') + '</tr>';
  $('baseNota').textContent = 'O custo esperado de ' + pct0(e.premissas.metaLiquidez) + ' é a média observada em MT e MS para todo o trâmite (ITCMD, advogado, cartório, contador, avaliações, certidões) e é o custo usado na comparação; a conta item por item é só uma conferência. ' +
    (b.patrimonioGrande ? 'Patrimônio acima de ' + fmtBRL0(b.limitePatrimonioGrande) + ': honorários e cartório costumam ser negociados ou ter teto, e o custo real em percentual tende a ser menor; revise o percentual. ' : '') +
    (e.uf === 'RO' || e.uf === 'PA' ? 'Em ' + T.ESTADOS[e.uf].nome + ', confirme se a média de 18% de MT e MS vale para os seus clientes. ' : '') +
    (e.partilha.conjugeHerdeiro ? 'O ITCMD considera o cônjuge como herdeiro, com ' + pct1(e.partilha.fracConjuge) + ' da herança. ' : '') +
    (T.ESTADOS[e.uf].reformaIgualVigente ? '' : 'Adequação à reforma: ' + T.ESTADOS[e.uf].reforma.hipotese);
}

function renderCards(){
  const {r} = ultimo, e = r.entrada, rec = r.recomendacao, v = venc(r);
  $('cardsSub').textContent = r.caminhos.length + ' combinações de estrutura (nada, doação, holding) com liquidez (nada, previdência, whole life ou os dois). Valor à família em R$ de hoje, já descontados todos os custos. Clique numa linha para vê-la no gráfico.';
  const nivelDe = c => !c.protegeJa ? 3 : c.cabe === 'sim' ? 0 : c.cabe === 'aParte' ? 1 : 2;
  const lista = r.caminhos.slice().sort((a, b) => (a.id === v.id ? -1 : b.id === v.id ? 1 : 0) || nivelDe(a) - nivelDe(b) || valorEm(b, 'expectativa') - valorEm(a, 'expectativa'));
  const melhor = h => Math.max(...r.caminhos.filter(c => c.protegeJa && c.cabe !== 'nao').map(c => valorEm(c, h)));
  const caixa = c => c.cabe === 'sim' ? '<span class="status ok">Cabe</span>' : c.cabe === 'aParte'
    ? '<span class="status neutral">' + fmtBRL0(c.pagamento.externoMensalMax) + '/mês à parte</span>' : '<span class="status no">Não cabe</span>';
  $('cards').innerHTML = '<tr><th>Combinação</th><th>Inventário no 1º ano</th><th>Caixa</th><th>' + HIP.proximo + '</th><th>' + HIP.dez + '</th><th>Expectativa (' + Math.round(e.idade + r.Texp) + ' anos)</th><th>Custos até lá</th></tr>' +
    lista.map(c => '<tr data-id="' + esc(c.id) + '" class="' + (c.id === v.id ? 'now' : '') + (c.id === seg.grafico ? ' sel' : '') + '">' +
      '<td><span class="dot" style="--c:var(' + corDe(c) + ')"></span>' + nomeDe(c) + (c.id === v.id ? ' <span class="best-tag inline">SOLUÇÃO</span>' : '') + '</td>' +
      '<td class="' + (c.protegeJa ? 'ok-t' : 'no-t') + '">' + coberturaTxt(c.coberturaAno1) + '</td>' +
      '<td>' + caixa(c) + '</td>' +
      ['proximo', 'dez', 'expectativa'].map(h => '<td class="' + (c.protegeJa && c.cabe !== 'nao' && Math.abs(valorEm(c, h) - melhor(h)) < 1 ? 'win' : '') + '">' + fmtBRL0(valorEm(c, h)) + '</td>').join('') +
      '<td>' + (c.em.expectativa.custosReais < 0 ? 'economia de ' + fmtBRL0(-c.em.expectativa.custosReais) : fmtBRL0(c.em.expectativa.custosReais)) + '</td></tr>').join('');
}

function renderSeguro(){
  const {r} = ultimo, s = r.seguro;
  $('blocoSeguro').hidden = !s;
  if(!s) return;
  const e = r.entrada;
  const cabe = v => v === null ? '' : ' · ' + pct1(v) + ' da renda';
  const wl = e.wholeLife;
  $('seguroSub').textContent = wl.fatorIdade !== 1
    ? 'Parcela da proposta Sicoob (' + (wl.sexoReferencia === 'f' ? 'mulher' : 'homem') + ' de ' + wl.idadeReferencia + ' anos: ' + fmtBRL(wl.parcelaReferencia) + ' por R$ 100 mil), ajustada para ' + (wl.sexo === 'f' ? 'mulher' : 'homem') + ' de ' + e.idade + ' anos pela tábua ' + wl.tabuaNome + ' da SUSEP (fator ' + wl.fatorIdade.toLocaleString('pt-BR', {maximumFractionDigits:3}) + '): ' + fmtBRL(wl.parcelaPor100k) + ' por R$ 100 mil. A proposta real pode ser diferente.'
    : 'Parcela da proposta Sicoob (' + fmtBRL(wl.parcelaPor100k) + ' por R$ 100 mil), proporcional ao capital. A proposta real pode ser diferente.';
  $('seguroCards').innerHTML =
    '<div class="eq-card"><div class="k">Capital segurado (' + nomeId(s.caminho) + ')</div><div class="v">' + fmtBRL0(s.capital) + '</div><div class="s">Corrigido a IPCA + ' + fmtPct(e.wholeLife.ganhoReal, 1) + ' ao ano, vitalício.</div></div>' +
    '<div class="eq-card"><div class="k">A parcela cabe?</div><div class="v">' + fmtBRL0(s.parcelaInicial) + '/mês</div><div class="s">No 1º ano' + cabe(s.pctRenda) + '. No 10º ano: ' + fmtBRL0(s.parcela10) + '/mês' + cabe(s.pctRenda10) + '.</div></div>' +
    '<div class="eq-card"><div class="k">Desembolso em 10 anos</div><div class="v">' + fmtBRL0(s.desembolso) + '</div><div class="s">Capital ÷ desembolso: ' + s.alavancagem.toLocaleString('pt-BR', {maximumFractionDigits:2}) + ' vezes. Resgatável supera o pago ' + (s.anoResgateSuperaPago ? 'no ' + s.anoResgateSuperaPago + 'º ano' : 'não ocorre no período') + '.</div></div>';
  $('tabSeguro').innerHTML = '<tr><th>Se as parcelas fossem aplicadas a</th><th>A aplicação alcança o capital aos</th><th>Leitura</th></tr>' +
    s.equilibrio.map(q => '<tr><td>' + pct0(q.taxa) + ' a.a.</td><td>' + (q.ano ? Math.round(e.idade + q.ano) + ' anos' : 'não alcança') + '</td><td>' +
      (q.ano ? 'falecimento antes dessa idade: o seguro entrega mais; depois, a aplicação.' : 'o seguro entrega mais em qualquer idade.') + '</td></tr>').join('');
  $('seguroNota').textContent = 'Expectativa de vida pela tábua do IBGE: ' + Math.round(e.idade + r.Texp) + ' anos. A proposta real depende de idade, saúde e coberturas; peça a cotação ao corretor.';
}

function renderAluguel(){
  const {r} = ultimo, a = r.aluguel;
  $('blocoAluguel').hidden = !a;
  if(!a) return;
  $('tabAluguel').innerHTML = '<tr><th>Ano</th><th>Aluguel</th><th>PF: IR</th><th>PF: IBS/CBS</th><th>Pessoa física</th><th>Holding</th><th>Diferença</th></tr>' +
    a.map(x => '<tr><td>' + x.ano + '</td><td>' + fmtBRL0(x.receita) + '</td><td>' + fmtBRL0(x.pf.ir + x.pf.irpfm) + '</td><td>' + fmtBRL0(x.pf.iva) + '</td>' +
      '<td>' + fmtBRL0(x.pf.total) + ' <small class="suave inline">(' + pct1(x.cargaPF) + ')</small></td><td>' + fmtBRL0(x.holding.total) + ' <small class="suave inline">(' + pct1(x.cargaHolding) + ')</small></td>' +
      '<td class="' + (x.diferenca < 0 ? 'win' : '') + '">' + (x.diferenca < 0 ? 'holding paga ' + fmtBRL0(-x.diferenca) + ' a menos' : 'holding paga ' + fmtBRL0(x.diferenca) + ' a mais') + '</td></tr>').join('');
  const primeiro = a.find(x => x.diferenca < 0);
  $('aluguelNota').textContent = (primeiro ? 'A holding passa a pagar menos imposto sobre os aluguéis em ' + primeiro.ano + '. ' : 'Nos próximos 10 anos, a holding não paga menos imposto sobre os aluguéis do que a pessoa física. ') +
    'Holding no lucro presumido (32%, IRPJ, CSLL, PIS/COFINS até 2026; CBS a partir de 2027 e IBS de 2029 a 2033, com redução de 70%), contabilidade e IRPFM sobre os dividendos (Lei 15.270/2025). Pessoa física: tabela do IR de 2026 com o redutor, IBS/CBS só para mais de R$ 240 mil por ano e mais de 3 imóveis.';
}

function renderHolding(){
  const {r} = ultimo, h = r.holding;
  $('blocoHolding').hidden = !h.aplicavel;
  if(!h.aplicavel) return;
  const e = r.entrada, hp = e.holding;
  const v = e.imoveis + (hp.incluirEmpresa ? e.empresa : 0);
  const itcmdCotas = E.itcmdDividido(v, e.herdeiros, e.uf, e.regime, 'doacao');
  const lin = (k, val, nota) => '<tr><td class="k">' + k + '</td><td>' + fmtBRL0(val) + '</td><td>' + (nota || '') + '</td></tr>';
  $('tabHolding').innerHTML = '<tr><th>Item</th><th>Valor</th><th>Base</th></tr>' +
    lin('Jurídico de estruturação', Math.max(hp.juridicoMin, v * hp.juridicoPct), fmtPct(hp.juridicoPct, 1) + ' de ' + fmtBRL0(v) + ' integralizados') +
    lin('Cartório, Junta e registro', e.imoveis * hp.cartorioPct, fmtPct(hp.cartorioPct, 1) + ' dos imóveis') +
    lin('ITBI na integralização', e.imoveis * hp.itbiPct, fmtPct(hp.itbiPct, 1) + ' dos imóveis') +
    lin('Laudo de avaliação', hp.laudo, 'por doação de cotas (LC 227/2026, art. 154)') +
    lin('Contabilidade', hp.contabilMensal * 12, 'por ano') +
    '<tr class="now"><td>Custo evitado se não abrir</td><td>' + fmtBRL0(h.custoEvitado) + '</td><td>estruturação + manutenção até a expectativa, R$ de hoje</td></tr>' +
    lin('ITCMD da doação das cotas (informativo)', itcmdCotas, 'tabela de doação de ' + e.uf + '; também existe na doação direta');
}

function renderAlertas(){
  const {r, inp} = ultimo, e = r.entrada, s = inp.sinais, v = venc(r), out = [];
  const total = e.imoveis + e.aplicacoes + e.previdencia + e.empresa + e.exterior;
  void total;
  const est = T.ESTADOS[e.uf], idadeTab = mesesDesde(est.revisadoEm);
  if(idadeTab > LIMITE_MESES_TABELA) out.push('<b>Tabela de ITCMD revisada há ' + idadeTab + ' meses:</b> a última conferência de ' + est.nome + ' foi em ' + est.revisadoEm.split('-').reverse().join('/') + '. Confira se a lei ou a unidade fiscal mudaram antes de apresentar.');
  if(v && (v.cfg.X > 0 || e.previdencia > 0)){
    const prev = e.previdencia + (v.cfg.X || 0);
    out.push('<b>Previdência e legítima:</b> metade da herança (' + fmtBRL0(r.base.legitima) + ') é dos herdeiros necessários (Código Civil, art. 1.846). Previdência com beneficiários diferentes deles, ou aportes grandes perto do falecimento, pode ser questionada.' +
      (prev > r.base.disponivel ? ' <b>Aqui a previdência (' + fmtBRL0(prev) + ') passaria da parte disponível (' + fmtBRL0(r.base.disponivel) + '):</b> indique os herdeiros necessários como beneficiários.' : ''));
  }
  if(r.base.patrimonioGrande) out.push('<b>Patrimônio acima de ' + fmtBRL0(r.base.limitePatrimonioGrande) + ':</b> o custo esperado de ' + pct0(e.premissas.metaLiquidez) + ' é a média dos clientes de MT e MS. Neste porte, honorários e cartório costumam ser negociados ou ter teto; revise o percentual na etapa 2 com base em orçamentos reais.');
  if(e.partilha.conjugeHerdeiro) out.push('<b>O cônjuge é herdeiro junto com os filhos</b> (CC, art. 1.829, I)' + (e.conjuge.regime === 'parcial' ? ', só sobre os bens particulares' : '') + ': recebe ' + pct1(e.partilha.fracConjuge) + ' da herança' + (e.conjuge.ascendenteComum && e.herdeiros >= 3 ? ', com o mínimo de 1/4 por ser pai ou mãe de todos (art. 1.832)' : '') + '. Previdência e seguro podem indicá-lo como beneficiário à parte.');
  if(e.conjuge.regime === 'obrigatoria') out.push('<b>Separação obrigatória:</b> pela Súmula 377 do STF, os bens adquiridos com esforço comum podem ser partilhados como meação. A simulação considera meação zero; confirme com o advogado.');
  if(e.conjuge.regime === 'universal' || e.conjuge.regime === 'parcial') out.push('<b>Doação de bens comuns</b> precisa da concordância do cônjuge, que também doa a sua meação.');
  if(e.wholeLife.fatorIdade !== 1 && e.idade >= 65 && r.caminhos.some(c => c.cfg.C > 0)) out.push('<b>Whole life aos ' + e.idade + ' anos:</b> as seguradoras limitam a idade de entrada e o capital sem exames; a parcela usada é estimada pela tábua ' + e.wholeLife.tabuaNome + ' a partir da proposta de ' + e.wholeLife.idadeReferencia + ' anos. Peça a cotação antes de apresentar.');
  if(r.caminhos.some(c => c.cfg.doaImoveis || c.cfg.holding)) out.push('<b>Doação a filhos é adiantamento da herança</b> (CC, arts. 544 e 2.002) e vai à colação, salvo se sair da parte disponível; a parte que passa da disponível é nula (art. 549). Cláusulas de inalienabilidade sobre a legítima exigem justa causa (art. 1.848).');
  if(s.incapaz) out.push('<b>Herdeiro menor ou incapaz:</b> o inventário em cartório só é possível nas condições da Res. CNJ 571/2024 (parte ideal em cada bem e concordância do Ministério Público); senão, é judicial.');
  if(s.conflito) out.push('<b>Risco de conflito:</b> testamento e regras de governança reduzem disputas. Uma holding com acordo de sócios pode compensar mesmo sem vencer nos números; avalie com advogado.');
  if(s.empresa) out.push('<b>Empresa operacional:</b> a sucessão da gestão (quem decide) costuma pesar mais que o imposto. Holding com governança pode se justificar por esse motivo.');
  if(e.aluguelMensal > 0) out.push('<b>ITBI:</b> holding com atividade imobiliária preponderante (locação) não tem a imunidade do ITBI na integralização; e a imunidade não alcança o valor acima do capital (STF, Tema 796).');
  if(e.uf === 'MS') out.push('<b>MS ainda não adotou o ITCMD progressivo</b> exigido pela LC 227/2026. Enquanto a lei não muda, doar custa 3% contra 6% na herança; uma lei nova só vale no ano seguinte e após 90 dias.');
  if(e.uf === 'RO') out.push('<b>RO aplica a alíquota da faixa sobre o quinhão inteiro;</b> a LC 227/2026 exige faixas sucessivas. Pode haver discussão sobre qual regra prevalece.');
  if(e.uf === 'PA') out.push('<b>PA:</b> a lei aplica as faixas de forma sucessiva (art. 8º, § 1º), mas há quem leia de outro modo; confirme o cálculo com a Sefa-PA.');
  if(r.caminhos.some(c => c.cfg.C > 0)) out.push('<b>Whole life:</b> a contratação depende de declaração de saúde e análise da seguradora; a parcela usada vem da planilha Sicoob' + (e.wholeLife.fatorIdade !== 1 ? ', ajustada pela idade' : '') + '.');
  if(e.exterior > 0) out.push('<b>Bens no exterior:</b> desde 2026 pagam ITCMD no estado de domicílio (LC 227/2026) e os rendimentos pagam IR de 15% ao ano (Lei 14.754/2023).');
  out.push('<b>Testamento</b> organiza a parte disponível e reduz conflitos em qualquer caminho; não evita o inventário.');
  out.push('<b>Imposto da herança é o da data do falecimento; o da doação, o da data da doação</b> (LC 227/2026, art. 156, § 1º). Quem antecipa trava a regra de hoje.');
  $('alertas').innerHTML = out.map(x => '<li>' + x + '</li>').join('');
}

function renderFontes(){
  const {r} = ultimo, est = T.ESTADOS[r.entrada.uf];
  $('fontes').innerHTML = '<h3>Premissas e fontes</h3><ul>' + [
    'ITCMD de ' + est.nome + ': ' + est.lei + ' (unidade de ' + est.dataRef.split('-').reverse().join('/') + ', revisado em ' + est.revisadoEm.split('-').reverse().join('/') + '; ' + est.unidade.nome + (est.unidade.valor !== 1 ? ' = R$ ' + est.unidade.valor.toLocaleString('pt-BR', {maximumFractionDigits:4}) : '') + '). Normas gerais: LC 227/2026.',
    'Honorários: ' + E.honorariosPadrao(r.entrada.uf).fonte,
    'Expectativa de vida: IBGE, Tábua Completa de Mortalidade 2024 (ambos os sexos).',
    'Whole life: planilha "Sicoob - Seguro Whole Life" (R$ ' + r.entrada.wholeLife.parcelaReferencia.toLocaleString('pt-BR', {minimumFractionDigits:2}) + '/mês por R$ 100 mil aos ' + r.entrada.wholeLife.idadeReferencia + ' anos)' +
      (r.entrada.wholeLife.fatorIdade !== 1 ? '; fator de idade e sexo pela tábua ' + r.entrada.wholeLife.tabuaNome + ' (SUSEP), juros técnicos implícitos de ' + fmtPct(r.entrada.wholeLife.taxaTecnica, 2) + ' a.a. reais.' : '.'),
    'Partilha: Código Civil, arts. 1.658 a 1.688 (regimes), 1.829, 1.832 e 1.846; STJ, REsp 1.368.123 e 1.382.170.',
    'Aluguéis: Lei 15.270/2025 (IR e dividendos), LC 214/2025 (IBS/CBS na locação), LC 224/2025 (presumido).',
    'Custos de holding, cartório e offshore: referências de mercado, editáveis. Simulação gerada em ' + HOJE.toLocaleDateString('pt-BR') + '.'
  ].map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
}

function renderResultados(){
  renderVerdict(); renderDestaques(); renderBase(); renderCards();
  renderSeguro(); renderAluguel(); renderHolding(); renderAlertas(); renderFontes();
  renderSegGrafico(); desenharGrafico();
}

/* =========================================================================
 * 8. Gráfico
 * ========================================================================= */
let geo = null;
function caminhosGrafico(r){
  const v = venc(r), ids = [v.id].concat(r.recomendacao.ordem.filter(id => id !== v.id)).slice(0, 5);
  if(seg.grafico && !ids.includes(seg.grafico) && r.caminhos.some(c => c.id === seg.grafico)) ids.push(seg.grafico);
  return ids.map(porId).filter(c => c && c.id !== 'inventario');
}

function renderSegGrafico(){
  const {r} = ultimo, lista = caminhosGrafico(r);
  if(!lista.length){ $('segGrafico').innerHTML = ''; return; }
  if(!r.caminhos.some(c => c.id === seg.grafico) || seg.grafico === 'inventario') seg.grafico = lista[0].id;
  $('segGrafico').innerHTML = lista.map(c => '<button type="button" data-v="' + esc(c.id) + '"' + (c.id === seg.grafico ? ' class="active"' : '') + '>' + nomeDe(c) + '</button>').join('');
}

function seriesGrafico(){
  const {r} = ultimo, c = r.caminhos.find(x => x.id === seg.grafico) || venc(r), idade = r.entrada.idade;
  const pts = f => [{ x: idade, y: f(null) }].filter(p => p.y !== null).concat(c.sim.anos.map(a => ({ x: idade + a.ano, y: f(a) })));
  const s = [
    { nome: 'Custo esperado do inventário (' + pct0(r.entrada.premissas.metaLiquidez) + ')' + (r.entrada.sustento.despesaMensal > 0 ? ' + despesas da família' : ''), cor: cssVar('--l-meta'), dash: true, pontos: pts(a => a ? a.meta : null) },
    { nome: 'Previdência líquida de IR', cor: cssVar('--l-turq'), pontos: pts(a => a ? a.previdenciaLiquida : null) },
    { nome: 'Capital do seguro', cor: cssVar('--l-roxo'), pontos: pts(a => a ? a.seguro : null) },
    { nome: 'Liquidez total', cor: cssVar('--hl'), pontos: pts(a => a ? a.liquidez : null) }
  ];
  return { c, s: s.filter(x => x.pontos.some(p => p.y > 0)) };
}

function desenharGrafico(){
  if(!ultimo) return;
  const canvas = $('ch'), {r} = ultimo, {c, s} = seriesGrafico();
  geo = Grafico.desenhar(canvas, { series: s, altura: 290, rotuloX: 'idade', vline: { x: r.entrada.idade + r.Texp, rotulo: 'expectativa de vida' } });
  $('legenda').innerHTML = s.map(x => '<span style="--c:' + x.cor + '">' + esc(x.nome) + '</span>').join('');
  $('chartSub').textContent = nomeDe(c) + ': cobertura de ' + pct0(c.coberturaAno1) + ' no 1º ano e no mínimo ' + pct0(c.coberturaMin) + ' até ' + Math.round(r.entrada.idade + r.H) + ' anos. Valores nominais.';
}

function ligarTooltip(){
  Grafico.tooltip($('ch'), $('tt'), () => {
    if(!ultimo || !geo) return null;
    const {r} = ultimo, c = r.caminhos.find(x => x.id === seg.grafico) || venc(r), idade = r.entrada.idade;
    return { geo, html: xv => {
      const t = Math.max(1, Math.min(c.sim.anos.length, Math.round(xv - idade)));
      const a = c.sim.anos[t - 1];
      return '<div class="t">Aos ' + Math.round(idade + t) + ' anos</div>Meta: ' + fmtBRL0(a.meta) + '<br>Previdência: ' + fmtBRL0(a.previdenciaLiquida) + '<br>Seguro: ' + fmtBRL0(a.seguro) + '<br><b>Cobertura: ' + pct0(Math.min(a.cobertura, 99)) + '</b>';
    } };
  });
}

/* =========================================================================
 * 9. Relatório em PDF
 * ========================================================================= */
function graficoParaImpressao(){
  const canvas = $('ch');
  try { return canvas.toDataURL('image/png'); } catch(err){ return ''; }
}

/** solução no PDF: o mesmo conteúdo do painel, em blocos simples */
function pdfSolucao(r){
  const v = venc(r), pg = comoPagar(v, r), lst = l => '<ul>' + l.map(x => '<li>' + x + '</li>').join('') + '</ul>';
  return '<div class="bloco"><h2>Solução para este caso: ' + esc(nomeDe(v)) + '</h2><p><b>' + NIVEL[r.recomendacao.nivel].t + '.</b> Chega à família ' + fmtBRL0(valorEm(v, 'expectativa')) +
      ' na expectativa de vida (R$ de hoje).</p>' + lst(componentes(v, r).map(x => '<b>' + x.titulo + ':</b> ' + x.texto)) + '</div>' +
    '<div class="bloco"><h2>Por que esta solução</h2>' + lst(motivos(v, r)) + '</div>' +
    '<div class="bloco"><h2>Como pagar</h2>' + (pg.linhas.length ? '<table>' + pg.linhas.map(l => '<tr><td class="k">' + l[0] + '</td><td class="v">' + l[1] + (l[2] ? ' · ' + l[2] : '') + '</td></tr>').join('') + '</table>' : '') +
      '<p>' + pg.resumo + '</p>' + (pg.fontes.length ? '<p>' + pg.fontes.map(f => f.t + ': ' + fmtBRL0(f.v)).join(' · ') + ' (R$ de hoje)</p>' : '') + '</div>' +
    '<div class="bloco"><h2>O que fazer, passo a passo</h2>' + passos(v, r).map((p, i) => '<p><b>' + (i + 1) + '. ' + p.titulo + '</b> — ' + p.quem + '</p><ol>' + p.itens.map(x => '<li>' + x + '</li>').join('') + '</ol>').join('') + '</div>';
}

function gerarPdf(){
  recalcular();
  if(!ultimo) return;
  const {r} = ultimo, e = r.entrada;
  const tr = (k, val) => '<tr><td class="k">' + k + '</td><td class="v">' + val + '</td></tr>';
  const REG = { sem: 'sem cônjuge', parcial: 'comunhão parcial', universal: 'comunhão universal', separacao: 'separação convencional', obrigatoria: 'separação obrigatória' };
  const dados = tr('Idade · sexo · estado · filhos herdeiros', e.idade + ' anos · ' + (e.wholeLife.sexo === 'f' ? 'feminino' : 'masculino') + ' · ' + T.ESTADOS[e.uf].nome + ' · ' + e.herdeiros) +
    tr('Regime de bens', REG[e.conjuge.regime] + (e.meacaoPct > 0 ? ' · meação ' + pct0(e.meacaoPct) : '') + (e.partilha.conjugeHerdeiro ? ' · cônjuge herdeiro (' + pct1(e.partilha.fracConjuge) + ')' : '')) +
    (e.sobraMensal > 0 ? tr('Sobra mensal investida', fmtBRL0(e.sobraMensal) + '/mês') : '') +
    (e.meacaoPct > 0 ? tr('Inventário do cônjuge', e.sucessaoCasal ? 'incluído (a meação também passa aos filhos)' : 'não incluído') : '') +
    (e.sustento.despesaMensal > 0 ? tr('Despesas da família incluídas', fmtBRL0(e.sustento.despesaMensal) + '/mês × ' + e.sustento.meses + ' meses') : '') +
    tr('Imóveis · aplicações', fmtBRL0(e.imoveis) + ' · ' + fmtBRL0(e.aplicacoes)) +
    (e.empresa ? tr('Participações em empresas', fmtBRL0(e.empresa)) : '') + (e.exterior ? tr('Bens no exterior', fmtBRL0(e.exterior)) : '') +
    (e.previdencia ? tr('Previdência existente', fmtBRL0(e.previdencia)) : '') + (e.seguroExistente ? tr('Seguro existente', fmtBRL0(e.seguroExistente)) : '') +
    (e.aluguelMensal ? tr('Aluguéis', fmtBRL0(e.aluguelMensal) + '/mês') : '') +
    tr('Premissas', 'rentabilidade ' + fmtPct(e.premissas.rentabilidade, 1) + ' a.a. · IPCA ' + fmtPct(e.premissas.ipca, 1) + ' · custo esperado do inventário ' + pct0(e.premissas.metaLiquidez) + ' · ITCMD ' + ({vigente:'lei vigente', reforma:'adequação à reforma', estresse:'estresse 16%'})[e.regime]);
  const comp = '<table><tr><th>Caminho</th><th class="n">Próximo ano</th><th class="n">Em 10 anos</th><th class="n">Expectativa</th><th class="n">Cobertura 1º ano</th></tr>' +
    r.caminhos.slice().sort((a, b) => (a.id === r.recomendacao.vencedor ? -1 : b.id === r.recomendacao.vencedor ? 1 : valorEm(b, 'expectativa') - valorEm(a, 'expectativa'))).map(c => '<tr><td>' + nomeDe(c) + (c.id === r.recomendacao.vencedor ? ' <span class="ok">(solução)</span>' : '') + '</td>' +
      ['proximo','dez','expectativa'].map(h => '<td class="n">' + fmtBRL0(valorEm(c, h)) + '</td>').join('') +
      '<td class="n ' + (c.protegeJa ? 'ok' : 'no') + '">' + coberturaTxt(c.coberturaAno1) + (c.cabe === 'nao' ? ' · não cabe' : c.cabe === 'aParte' ? ' · à parte' : '') + '</td></tr>').join('') + '</table>';
  const b = r.base;
  const inv = '<table>' + tr('Dinheiro necessário logo após o falecimento', fmtBRL0(b.metaHoje) + (b.sustentoHoje > 0 ? ' (custo esperado do inventário ' + fmtBRL0(b.metaInventarioHoje) + ' + família ' + fmtBRL0(b.sustentoHoje) + ')' : '')) +
    tr('Herança · legítima · parte disponível', fmtBRL0(b.heranca) + ' · ' + fmtBRL0(b.legitima) + ' · ' + fmtBRL0(b.disponivel)) + tr('Estimativa por componentes (lei vigente)', fmtBRL0(b.regimes.vigente.total) + ' (' + pct1(b.regimes.vigente.pct) + ')') +
    tr('Com a adequação à reforma · estresse 16%', fmtBRL0(b.regimes.reforma.total) + ' · ' + fmtBRL0(b.regimes.estresse.total)) + '</table>';
  const destaques = [...$('destaques').querySelectorAll('h4, p, .big')].map(x => x.textContent.trim()).join(' ').replace(/\s+/g, ' ').trim();
  const img = graficoParaImpressao();
  const seguro = r.seguro ? '<div class="bloco"><h2>Whole life</h2><table>' + tr('Capital', fmtBRL0(r.seguro.capital)) +
    tr('Parcela 1º ano · 10º ano', fmtBRL0(r.seguro.parcelaInicial) + ' · ' + fmtBRL0(r.seguro.parcela10) + ' por mês') + tr('Desembolso em 10 anos', fmtBRL0(r.seguro.desembolso)) +
    tr('Aplicação alcança o capital aos (8% · 10% · 12%)', r.seguro.equilibrio.map(q => q.ano ? Math.round(e.idade + q.ano) + ' anos' : 'não alcança').join(' · ')) + '</table></div>' : '';
  $('printArea').innerHTML =
    '<div class="pr-badge">SIMULAÇÃO — NÃO É CONSULTORIA JURÍDICA, TRIBUTÁRIA OU DE SEGUROS</div>' +
    '<h1>Planejamento Sucessório</h1><div class="pr-sub">Simulação gerada em ' + HOJE.toLocaleDateString('pt-BR') + ' · previdência × whole life × doação × holding' + (r.caminhos.some(c => c.offshore) ? ' × offshore' : '') + '</div>' +
    pdfSolucao(r) + (destaques ? '<div class="bloco"><h2>Destaques</h2><p>' + esc(destaques) + '</p></div>' : '') +
    '<div class="bloco"><h2>Dados informados</h2><table>' + dados + '</table></div>' +
    '<div class="bloco"><h2>O custo de não planejar</h2>' + inv + '</div>' +
    '<div class="bloco"><h2>Valor que chega à família (R$ de hoje) por momento do falecimento</h2>' + comp + '<p class="pr-note">Expectativa de vida: ' + Math.round(e.idade + r.Texp) + ' anos (IBGE 2024). Só concorrem os caminhos que pagam o inventário desde o 1º ano.</p></div>' +
    (img ? '<div class="bloco"><h2>Liquidez para o inventário — ' + nomeId(seg.grafico) + '</h2><img class="pr-chart" src="' + img + '" alt="Gráfico da liquidez para o inventário ao longo do tempo"><div class="pr-legend">' + $('legenda').innerText.replace(/\n/g, ' · ') + '</div></div>' : '') +
    seguro +
    '<div class="bloco"><h2>Alertas</h2><ul>' + $('alertas').innerHTML + '</ul></div>' +
    '<div class="pr-aviso"><strong>Aviso:</strong> este documento é uma <strong>simulação</strong> com base nos parâmetros informados. Leis estaduais do ITCMD estão em adaptação à LC 227/2026; custos de cartório, advogado, contador e seguro são referências de mercado; rentabilidades e inflação variam. ' +
      'Não constitui consultoria jurídica, tributária ou de seguros, oferta ou recomendação. Consulte advogado, contador e corretor habilitado antes de decidir.</div>' +
    '<div class="pr-footer">' + [...document.querySelectorAll('footer p')].map(p => '<p>' + esc(p.textContent) + '</p>').join('') + '</div>';
  setTimeout(() => window.print(), 120);
}

/* =========================================================================
 * 9b. Salvar e abrir simulação (arquivo .json só com os campos da tela)
 * ========================================================================= */
const VERSAO_ARQUIVO = 1;
function mesesDesde(ref){
  const [a, m] = String(ref).split('-').map(Number);
  return (HOJE.getFullYear() - a) * 12 + (HOJE.getMonth() + 1 - m);
}
function camposDaTela(){
  return [...document.querySelectorAll('#step-1 input[id], #step-1 select[id], #step-2 input[id], #step-2 select[id]')];
}
function salvarArquivo(){
  const campos = {};
  camposDaTela().forEach(el => { campos[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
  const dados = { modulo: 'sucessao', versao: VERSAO_ARQUIVO, salvoEm: HOJE.toISOString().slice(0, 10),
    regime: seg.regime, tocados: { itbi: itbiTocado, meses: mesesTocado }, campos };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'simulacao-sucessao-' + dados.salvoEm + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  msgArquivo('Simulação salva no arquivo ' + a.download + '.', 'ok');
}
function msgArquivo(t, cls){ const m = $('arquivoMsg'); m.textContent = t; m.className = 'hint' + (cls ? ' ' + cls : ''); }
function abrirArquivo(arquivo){
  if(!arquivo) return;
  if(arquivo.size > 200000){ msgArquivo('Arquivo grande demais para uma simulação.', 'erro'); return; }
  const leitor = new FileReader();
  leitor.onload = () => {
    let d;
    try { d = JSON.parse(leitor.result); } catch(err){ msgArquivo('O arquivo não é uma simulação válida.', 'erro'); return; }
    if(!d || d.modulo !== 'sucessao' || typeof d.campos !== 'object'){ msgArquivo('Este arquivo não é uma simulação do Planejamento Sucessório.', 'erro'); return; }
    let aplicados = 0;
    camposDaTela().forEach(el => {
      if(!Object.prototype.hasOwnProperty.call(d.campos, el.id)) return;
      const v = d.campos[el.id];
      if(el.type === 'checkbox') el.checked = v === true;
      else if(el.tagName === 'SELECT'){ if([...el.options].some(o => o.value === String(v))) el.value = String(v); else return; }
      else el.value = String(v).slice(0, 40);
      aplicados++;
    });
    itbiTocado = !!(d.tocados && d.tocados.itbi); mesesTocado = !!(d.tocados && d.tocados.meses);
    ufHonorarios = $('uf').value;   // mantém os honorários do arquivo
    if(['vigente', 'reforma', 'estresse'].includes(d.regime)){
      seg.regime = d.regime;
      $('segRegime').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === d.regime));
    }
    $('segCenario').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === $('rentab').value));
    recalcular();
    msgArquivo('Simulação de ' + (d.salvoEm || 'data não informada').split('-').reverse().join('/') + ' aberta (' + aplicados + ' campos).', 'ok');
  };
  leitor.readAsText(arquivo);
}

/* =========================================================================
 * 10. Ligações e início
 * ========================================================================= */
function irPara(n){
  document.querySelectorAll('.step-btn').forEach(b => b.classList.toggle('active', b.dataset.step === String(n)));
  document.querySelectorAll('.step-panel').forEach(p => p.classList.toggle('active', p.id === 'step-' + n));
  desenharGrafico();
  window.scrollTo({top:0, behavior:'smooth'});
}

function ligarSeg(id, chave, depois){
  $(id).addEventListener('click', ev => {
    const b = ev.target.closest('button[data-v]');
    if(!b) return;
    $(id).querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    seg[chave] = b.dataset.v;
    if(depois) depois(b.dataset.v);
  });
}

function iniciar(){
  document.querySelectorAll('.money').forEach(mascara);
  document.querySelectorAll('.step-btn').forEach(b => b.addEventListener('click', () => irPara(parseInt(b.dataset.step, 10))));
  document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => irPara(parseInt(b.dataset.goto, 10))));
  ['step-1', 'step-2'].forEach(id => { $(id).addEventListener('input', agendar); $(id).addEventListener('change', agendar); });
  $('segCenario').addEventListener('click', ev => {
    const b = ev.target.closest('button[data-v]'); if(!b) return;
    $('segCenario').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    $('rentab').value = b.dataset.v; agendar();
  });
  $('rentab').addEventListener('input', () => {
    $('segCenario').querySelectorAll('button').forEach(x => x.classList.toggle('active', x.dataset.v === $('rentab').value));
  });
  ligarSeg('segRegime', 'regime', agendar);
  ligarSeg('segGrafico', 'grafico', () => { desenharGrafico(); if(ultimo) renderCards(); });
  $('cards').addEventListener('click', ev => {
    const tr = ev.target.closest('tr[data-id]');
    if(!tr || !ultimo || tr.dataset.id === 'inventario') return;
    seg.grafico = tr.dataset.id;
    renderSegGrafico(); desenharGrafico(); renderCards();
  });
  // whole life: a parcela e a básica aceitam centavos já formatados
  ['wlParcela', 'wlBasica'].forEach(id => { $(id).value = moeda(lerMoeda($(id))); });
  $('hItbi').addEventListener('input', () => { itbiTocado = true; });
  $('mesesSustento').addEventListener('input', () => { mesesTocado = true; });
  $('btnSalvar').addEventListener('click', salvarArquivo);
  $('btnAbrir').addEventListener('click', () => $('arqAbrir').click());
  $('arqAbrir').addEventListener('change', ev => { abrirArquivo(ev.target.files[0]); ev.target.value = ''; });
  $('btnPdf').addEventListener('click', gerarPdf);
  Tema.ligarBotao($('btnTema'), () => setTimeout(desenharGrafico, 30));
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(desenharGrafico, 150); });
  ligarTooltip();
  recalcular();
}

iniciar();
})();
