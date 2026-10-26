/*
 * Estratégia de Aquisição — lógica da página (aquisicao.html).
 *
 * Organização deste arquivo:
 *   1. Utilidades (formatação, datas, leitura de campos)
 *   2. Constantes da página
 *   3. Estado
 *   4. Entradas: leitura dos campos → objeto do motor
 *   5. Entradas: validação
 *   6. Dicas ao vivo (textos de apoio nos formulários)
 *   7. Cálculo (chama o motor e guarda o resultado em `ultimo`)
 *   8. Resultados (conclusão, cards, estresse, custos, fluxo)
 *   9. Gráfico
 *  10. Relatório em PDF
 *  11. Importar simulações do Sicoob (PDF)
 *  12. Dados do Banco Central (CDI, IPCA, Focus)
 *  13. Ligações e início
 *
 * Regras de cálculo ficam no motor (engine/aquisicao.js); aqui só há leitura de
 * campos, textos e desenho. Para acrescentar um campo: HTML (id) → seção 4 →
 * validação (seção 5) → motor → teste em tests/aquisicao.test.js.
 */
(function () {
'use strict';

/* =========================================================================
 * 1. Utilidades
 * ========================================================================= */
const E = window.AquisicaoEngine;
const $ = id => document.getElementById(id);
const HOJE = new Date();
const ANO = HOJE.getFullYear();
const {brl: fmtBRL, brl0: fmtBRL0, pct: fmtPct, curto: fmtCurto, anos: fmtAnos, prazo: fmtPrazo, esc, lerMoeda, moeda, mascara} = Formato;
const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

/** número com até 1 casa ("43", "42,5") */
const fmtUmaCasa = v => v.toLocaleString('pt-BR', {maximumFractionDigits:1});
/** "nov/2026" para o mês t a partir de hoje */
function mesAno(t){
  const d = new Date(HOJE.getFullYear(), HOJE.getMonth() + t, 1);
  return MESES[d.getMonth()] + '/' + d.getFullYear();
}
/** "aaaa-mm" do mês atual (valor de <input type="month">) */
const mesAtualStr = () => HOJE.getFullYear() + '-' + String(HOJE.getMonth()+1).padStart(2,'0');
/** meses entre o mês atual e 'aaaa-mm' (0 = este mês; negativo = passado; NaN se vazio) */
function mesesAte(str){
  const m = /^(\d{4})-(\d{2})/.exec(str || '');
  if(!m) return NaN;
  return (parseInt(m[1],10) - HOJE.getFullYear())*12 + (parseInt(m[2],10) - 1 - HOJE.getMonth());
}
/** 'aaaa-mm-dd' → 'dd/mm/aaaa' */
const dataBR = str => (str || '').split('-').reverse().join('/');

/** valor numérico de um campo (NaN se vazio ou inválido) */
const num = id => { const v = parseFloat($(id).value); return isNaN(v) ? NaN : v; };
/** valor de um campo de moeda */
const money = id => lerMoeda($(id));
const ehNumero = v => typeof v === 'number' && isFinite(v);
const linhaLedger = (k, v) => '<div class="lrow"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
const cssVar = Grafico.cssVar;

/* =========================================================================
 * 2. Constantes da página
 * ========================================================================= */
const CAM = {
  financiamento: {nome:'Financiamento', cor:'--l-turq', txt:'--gold', desc:'Entrada + parcelas da proposta', hex:'#00AE9D'},
  consorcio:     {nome:'Consórcio', cor:'--l-roxo', txt:'--blue', desc:'Carta de crédito com lance', hex:'#49479D'},
  avista:        {nome:'Capital próprio', cor:'--l-verde', txt:'--teal', desc:'Compra à vista', hex:'#7DB61C'}
};
const ORDEM = ['financiamento','consorcio','avista'];
const BEM = {imovel:'imóvel', carro:'carro', terreno:'terreno', outro:'bem'};
const PRODUTOS = {lca:'LCA', rdc:'RDC', cdb:'CDB', compromissada:'Operação Compromissada', outro:'Produto tributado'};
const ISENTO = {lca:true};
/** pares comparados no teste de estresse (taxa de equilíbrio) */
const PARES = [
  {chave:'finAv',   a:'financiamento', b:'avista',    titulo:'Financiamento × capital próprio', acima:'. Acima disso, financiar e manter investido compensa.',
   semEmpate:'Um caminho vence o outro em qualquer taxa entre 0% e 40% a.a.'},
  {chave:'consAv',  a:'consorcio',     b:'avista',    titulo:'Consórcio × capital próprio', acima:'.',
   semEmpate:'Com essas condições, um caminho vence o outro em qualquer taxa entre 0% e 40% a.a.'},
  {chave:'finCons', a:'financiamento', b:'consorcio', titulo:'Financiamento × consórcio', acima:'.',
   semEmpate:'Um caminho vence o outro em qualquer taxa entre 0% e 40% a.a.'}
];
/** rendimentos líquidos da tabela de sensibilidade (o atual é acrescentado) */
const TAXAS_ESTRESSE = [0.08, 0.09, 0.10, 0.11, 0.12, 0.13, 0.14];
/** seguro MIP por faixa de idade (proposta Sicoob/Tokio Marine, 23/10/2026): [idade até, % a.m.] */
const MIP_PADRAO = [[45,0.0244],[50,0.0424],[55,0.0655],[60,0.0915],[65,0.1329],[70,0.2170],[75,0.3588],[80,0.5835]];
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

/* =========================================================================
 * 3. Estado
 * ========================================================================= */
/** botões de opção (segmentos) */
const seg = {lanceEm:'pct', finModo:'proposta', modal:'embutido', modo:'renda', sistema:'SAC', reduz:'parcela', serie:'patrimonio', janela:'h', fluxo:'financiamento'};
let mipTabela = MIP_PADRAO.slice();
/* meses desde o último aniversário do proponente, vindos da proposta importada (0 se digitado à mão);
   não é exibido nem guardado — só posiciona a troca de faixa do seguro MIP */
let idadeMesesExtra = 0;
let curvaFocus = null;   // {ano: CDI % projetado}
let ultimo = null;       // último cálculo válido: {inp, r, eq, sens, atualAA}

/* =========================================================================
 * 4. Entradas: leitura
 * ========================================================================= */
/** fração da carta paga em cada parcela do consórcio: (100% + adm + FR) ÷ nº de parcelas */
const fracaoParcela = () => (1 + num('consAdm')/100 + num('consFr')/100) / num('consPrazo');

function lerRendimento(capital){
  if(seg.modo === 'renda'){
    const renda = money('rendaMensal');
    const taxa = E.taxaMensalLiquida({modo:'renda', rendaMensal:renda, capital});
    return {taxaMes: taxa, taxaMesInicial: taxa, aliquotaIRResgate: 0, info: {modo:'renda', renda}};
  }
  const prod = $('produto').value, isento = !!ISENTO[prod];
  const perc = num('percCdi')/100, cdi = num('cdi')/100, prazoMedio = num('prazoMedio');
  const cfg = t => ({modo:'produto', taxaBrutaAnual: cdiDoMes(t, cdi*100)/100 * perc, isentoIR: isento, prazoMedioDias: prazoMedio});
  // exibição: taxa líquida equivalente; cálculo: taxa bruta com o IR cobrado em cada resgate
  const bruta = t => E.taxaMensalLiquida(Object.assign(cfg(t), {isentoIR: true}));
  const focus = $('usarFocus').checked && curvaFocus;
  return {
    taxaMes: focus ? bruta : bruta(1),
    taxaMesInicial: E.taxaMensalLiquida(cfg(1)),
    aliquotaIRResgate: isento ? 0 : E.aliquotaIR(prazoMedio),
    info: {modo:'produto', prod, isento, perc, cdi, prazoMedio, focus: !!focus}
  };
}

function lerFinanciamento(mesCompra){
  const f = {ativo: $('onFin').checked, modo: seg.finModo, valorFinanciado: money('finValor'), cetAnual: num('finCet')/100,
    prazoMeses: Math.round(num('finPrazo')), sistema: seg.sistema, mesInicio: mesCompra};
  if(seg.finModo !== 'proposta') return f;
  return Object.assign(f, {jurosNominalAnual: num('finJuros')/100, trMensal: num('finTr')/100, tabelaMIP: lerMip(),
    idadeMesesHoje: Math.round(num('finIdade')) * 12 + idadeMesesExtra, dfiMensal: num('finDfi')/100,
    tacMensal: money('finTac'), despesasIniciais: money('finDesp'), dataProposta: $('finData').value});
}

function lerConsorcio(valorBem){
  const emParcelas = seg.lanceEm === 'parcelas';
  const lance = num('consLance');
  return {ativo: $('onCons').checked, modalidade: seg.modal,
    carta: seg.modal === 'bem' ? valorBem : money('consCarta'), prazoMeses: Math.round(num('consPrazo')),
    taxaAdm: num('consAdm')/100, fundoReserva: num('consFr')/100, seguroValor: money('consSeg'), reajusteAnual: num('consReaj')/100,
    lanceTotal: emParcelas ? E.lanceDeParcelas(lance, num('consPrazo'), num('consAdm')/100, num('consFr')/100) : lance/100,
    lanceParcelas: emParcelas ? lance : lance/100 / fracaoParcela(),
    mediaLanceParcelas: num('consMedia'), lanceEmbutido: seg.modal === 'bem' ? 0 : num('consEmb')/100,
    lanceReduz: seg.reduz, mesContemplacao: mesesAte($('consMes').value) + 1};
}

const lerMip = () => mipTabela.map(([a], k) => ({idadeAte: a, taxa: num('mip' + k)/100}));

/** lê todos os campos e devolve a entrada do motor, as informações de exibição e os erros de preenchimento */
function lerEntradas(){
  const capital = money('capital');
  const valorBem = money('valorBem');
  const ipca = num('ipca')/100;
  const valorizacao = $('valIpca').checked ? ipca : num('valOutra')/100;
  const mesCompra = Math.max(0, mesesAte($('dataCompra').value) || 0);
  const rend = lerRendimento(capital);
  const e = {
    capital, valorBem, aporteMensal: money('aporte'), reservaMinima: money('reserva'),
    valorizacaoAnual: valorizacao, ipcaAnual: ipca, custoEsperaMensal: money('custoEspera'),
    horizonteMeses: Math.round(num('horizonte')*12), taxaMes: rend.taxaMes, aliquotaIRResgate: rend.aliquotaIRResgate,
    mesCompra,
    financiamento: lerFinanciamento(mesCompra),
    consorcio: lerConsorcio(valorBem),
    avista: {ativo: $('onAv').checked}
  };
  const inp = {e, info: rend.info, taxaMesInicial: rend.taxaMesInicial, tipo: $('tipoBem').value};
  inp.extraErros = validarEntradas(inp, ipca, valorizacao);
  return inp;
}

/* =========================================================================
 * 5. Entradas: validação (as regras do motor são conferidas por E.validar)
 * ========================================================================= */
function validarEntradas(inp, ipca, valorizacao){
  const {e} = inp;
  const erros = [];
  if(!(e.capital > 0)) erros.push('Informe o capital investido.');
  if(!(inp.taxaMesInicial >= 0) || !isFinite(inp.taxaMesInicial)) erros.push('Rendimento do capital inválido.');
  if(!isFinite(ipca)) erros.push('IPCA previsto inválido.');
  if(!$('valIpca').checked && !isFinite(valorizacao)) erros.push('Valorização do bem inválida.');
  if(e.financiamento.ativo && e.financiamento.valorFinanciado > e.valorBem) erros.push('Financiamento: o valor financiado não pode passar do valor do bem.');
  if(!(num('horizonte') >= 1 && num('horizonte') <= 50)) erros.push('Horizonte: de 1 a 50 anos.');
  if(!e.financiamento.ativo && !e.consorcio.ativo && !e.avista.ativo) erros.push('Inclua pelo menos um caminho de compra.');
  const dc = mesesAte($('dataCompra').value);
  if(isNaN(dc)) erros.push('Informe a data prevista da compra.');
  else if(dc < 0) erros.push('A data prevista da compra não pode ser anterior a este mês.');
  if(e.consorcio.ativo){
    const dk = mesesAte($('consMes').value);
    if(isNaN(dk)) erros.push('Consórcio: informe a contemplação prevista.');
    else if(dk < 0) erros.push('Consórcio: a contemplação não pode ser anterior a este mês.');
  }
  if(e.financiamento.ativo && seg.finModo === 'proposta'){
    const idade = num('finIdade');
    if(!(idade >= 18 && idade < 100)) erros.push('Financiamento: informe a idade do 1º proponente (18 a 99 anos).');
    if(lerMip().some(x => !(x.taxa >= 0))) erros.push('Financiamento: revise a tabela do seguro MIP.');
  }
  return erros;
}

/* =========================================================================
 * 6. Dicas ao vivo
 * ========================================================================= */
function renderDicas(inp){
  dicaRendimento(inp);
  dicaFinanciamento(inp.e);
  dicaConsorcio(inp.e);
  resumoAVista(inp.e);
}

function dicaRendimento({e, info, taxaMesInicial}){
  const aa = E.taxaAnualDeMensal(taxaMesInicial);
  if(info.modo === 'renda'){
    const cdi = num('cdi');
    $('hintRenda').innerHTML = 'Equivale a <strong>' + fmtPct(taxaMesInicial, 3) + ' a.m.</strong> = <strong>' + fmtPct(aa) + ' a.a. líquidos</strong>' +
      (isFinite(cdi) && cdi > 0 ? ' (≈ ' + fmtPct(aa / (cdi/100), 0) + ' do CDI de ' + fmtPct(cdi/100) + ' se fosse isento)' : '') + '.';
    return;
  }
  $('prazoMedioBox').hidden = info.isento;
  if(!info.isento) $('hintIR').innerHTML = 'IR cobrado só nos resgates, sobre a parte de ganho, à alíquota de <strong>' + fmtPct(E.aliquotaIR(info.prazoMedio),1) + '</strong>.';
  $('hintProduto').innerHTML = 'Rendimento líquido do capital: <strong>' + fmtPct(taxaMesInicial,3) + ' a.m.</strong> = <strong>' + fmtPct(aa) + ' a.a.</strong> · renda líquida hoje ≈ <strong>' + fmtBRL0(e.capital * taxaMesInicial) + '/mês</strong>' +
    (info.focus ? ' (muda a cada ano pela curva Focus).' : '.');
}

function dicaFinanciamento(e){
  const proposta = seg.finModo === 'proposta';
  $('finProposta').hidden = !proposta;
  $('hintCet').textContent = proposta ? 'Informativo: pela regra do Banco Central, o CET não inclui a TR futura. O app calcula o custo com a TR projetada.' : 'Usado como taxa de juros, sem TR, seguros ou tarifas à parte. Prefira os dados da proposta.';
  $('hintEntrada').innerHTML = 'Entrada (sai do capital): <strong>' + fmtBRL0(Math.max(0, e.valorBem - e.financiamento.valorFinanciado)) + '</strong>';
}

function dicaConsorcio(e){
  const c = e.consorcio;
  const k = mesesAte($('consMes').value);
  if(!isNaN(k) && k >= 0) $('hintConsMes').textContent = (k === 0 ? 'Contemplação neste mês (1ª assembleia): compra imediata.' : 'Contemplação na ' + (k+1) + 'ª assembleia, daqui a ' + fmtPrazo(k) + '. Até lá, as parcelas saem do capital, que segue rendendo.') + ' Sem lance vencedor, a data é incerta.';
  const valido = c.carta > 0 && c.prazoMeses > 0;
  if(valido) $('consResumo').innerHTML = resumoConsorcio(c, e.valorBem);
  $('sufLance').textContent = seg.lanceEm === 'parcelas' ? 'parcelas' : '% da carta';
  if(valido) $('hintLance').innerHTML = textoLance(c);
  dicaModalidade(e.valorBem);
}

function resumoConsorcio(c, valorBem){
  const P = 1 + (c.taxaAdm||0) + (c.fundoReserva||0);
  const credito = c.carta * (1 - (c.lanceEmbutido||0));
  const proprio = c.carta * Math.max(0, (c.lanceTotal||0) - (c.lanceEmbutido||0));
  const sobra = credito - valorBem;
  return '<div>Parcela antes do lance<b>' + fmtBRL0(P / c.prazoMeses * c.carta + (c.seguroValor || 0)) + '</b></div>' +
    '<div>' + (c.modalidade === 'bem' ? 'Crédito recebido' : 'Crédito líquido (após embutido)') + '<b>' + fmtBRL0(credito) + '</b></div>' +
    '<div>Lance com recursos próprios<b>' + fmtBRL0(proprio) + '</b></div>' +
    '<div>Total devido ao grupo<b>' + fmtBRL0(P * c.carta) + '</b></div>' +
    (Math.abs(sobra) >= 1 ? '<div class="full">' + (sobra > 0
      ? 'Sobra de crédito frente ao bem de hoje<b>' + fmtBRL0(sobra) + ' → abate o saldo devedor</b>'
      : 'Crédito abaixo do bem de hoje<b>' + fmtBRL0(-sobra) + ' → sai do capital na compra</b>') + '</div>' : '');
}

function textoLance(c){
  const parc = c.lanceParcelas, frac = c.lanceTotal;
  if(!(isFinite(parc) && isFinite(frac))) return '';
  let media = '';
  if(c.mediaLanceParcelas > 0){
    if(parc + 0.05 < c.mediaLanceParcelas) media = ' · <span class="cor-no">abaixo da média do grupo (' + c.mediaLanceParcelas + ')</span>';
    else if(Math.abs(parc - c.mediaLanceParcelas) <= 0.05) media = ' · igual à média do grupo';
    else media = ' · acima da média do grupo (' + c.mediaLanceParcelas + ')';
  }
  return '= <strong>' + fmtPct(frac,1) + ' da carta</strong> · ' + fmtUmaCasa(parc) + ' parcelas · ' + fmtBRL0(frac * c.carta) + media;
}

/** carta no valor do bem (só lance livre) × carta maior com lance embutido */
function dicaModalidade(valorBem){
  const modoBem = seg.modal === 'bem';
  $('embBox').hidden = modoBem;
  $('consCarta').readOnly = modoBem;
  $('consCartaBox').classList.toggle('leitura', modoBem);
  $('lblLance').textContent = modoBem ? 'Lance com recursos próprios' : 'Lance total';
  const btn = $('btnCartaIdeal');
  btn.hidden = true;
  if(modoBem){
    $('consCarta').value = moeda(valorBem);
    $('hintCarta').innerHTML = 'Igual ao valor do bem hoje. Contemplado mais tarde, a diferença para o bem valorizado sai do capital, a menos que a carta seja reajustada.';
    return;
  }
  const emb = num('consEmb')/100;
  const ideal = emb < 1 ? valorBem / (1 - emb) : 0;
  if(emb > 0 && ideal > 0){
    $('hintCarta').innerHTML = 'Para o crédito líquido cobrir exatamente o bem: carta de <strong>' + fmtBRL0(ideal) + '</strong>.';
    btn.dataset.valor = String(Math.ceil(ideal/1000)*1000);
    btn.hidden = false;
  } else {
    $('hintCarta').innerHTML = 'Informe o percentual embutido para ver a carta que cobre o bem.';
  }
}

function resumoAVista(e){
  const av = ultimo && ultimo.r && ultimo.r.cenarios.avista;
  const meses = av ? av.mesCompra : undefined;
  const quandoTxt = meses === undefined ? '—' : meses === null ? 'não alcança' : (meses === 0 ? 'hoje' : 'em ' + fmtPrazo(meses));
  $('avResumo').innerHTML =
    '<div>Preço do bem hoje<b>' + fmtBRL0(e.valorBem) + '</b></div>' +
    '<div>Capital hoje<b>' + fmtBRL0(e.capital) + '</b></div>' +
    '<div>Quando consegue comprar<b>' + quandoTxt + '</b></div>';
}

/* =========================================================================
 * 7. Cálculo
 * ========================================================================= */
let timer;
function agendar(){ clearTimeout(timer); timer = setTimeout(recalcular, 120); }

function recalcular(){
  const inp = lerEntradas();
  const r = inp.extraErros.length ? {ok:false, erros:[]} : E.analisar(inp.e);
  const erros = inp.extraErros.concat(r.erros || []);
  if(erros.length){
    mostrarErros(erros);
    renderDicas(inp);
    return;
  }
  mostrarErros([]);
  // estresse: sempre com taxa constante (independe da curva Focus)
  const H = inp.e.horizonteMeses;
  const eq = {};
  PARES.forEach(p => { if(r.cenarios[p.a] && r.cenarios[p.b]) eq[p.chave] = E.taxaEquilibrio(inp.e, p.a, p.b, H); });
  const atualAA = E.taxaAnualDeMensal(inp.taxaMesInicial);
  const taxas = TAXAS_ESTRESSE.filter(t => Math.abs(t - atualAA) > 0.002).concat([atualAA]).sort((a,b)=>a-b);
  const sens = E.sensibilidade(inp.e, taxas, H);
  ultimo = {inp, r, eq, sens, atualAA};
  renderDicas(inp);
  renderTudo();
}

function mostrarErros(erros){
  const banner = $('errBanner');
  const tem = erros.length > 0;
  if(tem) banner.innerHTML = '<strong>Revise os dados:</strong><ul>' + erros.map(x=>'<li>'+esc(x)+'</li>').join('') + '</ul>';
  banner.classList.toggle('show', tem);
  $('resultados').classList.toggle('stale', tem);
  $('btnPdf').disabled = tem;
}

function renderTudo(){
  if(!ultimo) return;
  renderConclusao(); renderResposta(); renderCards(); renderEstresse(); renderCusto(); renderFluxo(); desenharGrafico();
}

/* =========================================================================
 * 8. Resultados
 * ========================================================================= */
const caminhosAtivos = r => ORDEM.filter(id => r.cenarios[id]);
const anosDoHorizonte = inp => Math.round(inp.e.horizonteMeses/12);

/** selos de cada caminho (cards e PDF) */
function statusDe(id, c, inp){
  const b = [];
  const H = inp.e.horizonteMeses;
  if(c.mesCompra === null || c.mesCompra > H) b.push({cls:'no', txt:'Não compra em ' + fmtAnos(Math.round(H/12))});
  if(c.mesEsgota !== null && c.mesEsgota <= H) b.push({cls:'no', txt:'Consome o capital'});
  else if(c.mesEsgota !== null) b.push({cls:'no', txt:'Capital zera após ' + fmtAnos(Math.floor(c.mesEsgota/12))});
  if(id !== 'avista'){
    if(c.cobertura !== null && c.cobertura >= 1 && c.mesEsgota === null) b.push({cls:'ok', txt:'A renda paga a parcela'});
    else if(c.cobertura !== null && c.cobertura < 1 && c.mesEsgota === null) b.push({cls:'neutral', txt:'Descapitaliza no início'});
  } else if(c.mesCompra !== null) b.push({cls:'neutral', txt:'Sem parcela'});
  if(inp.e.reservaMinima > 0 && c.mesAbaixoReserva !== null && c.mesAbaixoReserva <= H) b.push({cls:'no', txt:'Abaixo da reserva'});
  else if(inp.e.reservaMinima > 0 && c.mesCompra !== null && c.mesEsgota === null) b.push({cls:'ok', txt:'Mantém a reserva'});
  return b;
}
function quando(c){
  if(c.mesCompra === null) return 'não alcança';
  if(c.mesCompra === 0) return 'hoje';
  return 'em ' + fmtPrazo(c.mesCompra) + ' <small>' + mesAno(c.mesCompra) + '</small>';
}
/** resposta à pergunta central: a renda do investimento paga a parcela? */
function respostaDe(id, c, H){
  if(id === 'avista') return {cls:'mid', txt: c.mesCompra === null ? 'Não alcança o preço do bem' : 'Sem parcela'};
  if(c.mesCompra === null || c.mesCompra > H) return {cls:'mid', txt:'Não chega a comprar no período'};
  const cob = c.periodo.cobertura;
  if(cob !== null && cob >= 0.999) return {cls:'ok', txt:'Sim, paga toda a parcela'};
  if(c.mesEsgota !== null && c.mesEsgota <= H) return {cls:'no', txt:'Não: a parcela consome o capital'};
  return {cls:'mid', txt:'Em parte: paga ' + fmtPct(cob || 0, 0) + ' das parcelas'};
}

function renderCards(){
  const {inp, r} = ultimo;
  const anos = anosDoHorizonte(inp);
  $('cards').innerHTML = caminhosAtivos(r).map(id => {
    const c = r.cenarios[id], k = CAM[id];
    const melhor = r.melhor === id;
    const selos = statusDe(id, c, inp).map(s => '<span class="status ' + s.cls + '">' + s.txt + '</span>').join('');
    return '<div class="ledger' + (melhor ? ' best' : '') + '" style="--cl:var(' + k.cor + '); --cl-t:var(' + k.txt + ')">' +
      (melhor ? '<span class="best-tag">MAIOR PATRIMÔNIO EM ' + anos + ' ' + (anos === 1 ? 'ANO' : 'ANOS') + '</span>' : '') +
      '<h3>' + k.nome + '</h3><div class="desc">' + k.desc + '</div>' +
      '<div class="badges">' + selos + '</div>' + barraCobertura(id, c) +
      linhasDoCard(id, c, inp).map(l => linhaLedger(l[0], l[1])).join('') +
      '<div class="lrow total"><span class="k">Patrimônio líquido em ' + fmtAnos(anos) + '<span class="unit nom">NOMINAL</span></span><span class="v">' + fmtBRL0(c.horizonte.patrimonio) + '<small>' + fmtBRL0(c.horizonte.patrimonioReal) + ' em R$ de hoje</small></span></div>' +
      '</div>';
  }).join('');
}

function barraCobertura(id, c){
  const cob = c.cobertura;
  if(id === 'avista' || cob === null) return '';
  return '<div class="cover"><div class="t"><span>Renda do capital ÷ parcela</span><b class="' + (cob >= 1 ? 'cor-ok' : 'cor-no') + '">' + fmtPct(cob, 0) + '</b></div><div class="bar"><i style="width:' + Math.min(100, cob*100).toFixed(1) + '%"></i></div></div>';
}

function linhasDoCard(id, c, inp){
  const linhas = [['Compra do ' + BEM[inp.tipo], quando(c)]];
  if(c.mesCompra === null) return linhas;
  linhas.push(['Sai do capital na compra', fmtBRL0(c.desembolsoCompra) + (id === 'consorcio' && c.complemento > 0 ? '<small>inclui ' + fmtBRL0(c.complemento) + ' de complemento</small>' : '')]);
  linhas.push(['Fica investido', '<span class="' + (c.capitalAposCompra < inp.e.reservaMinima ? 'no-t' : '') + '">' + fmtBRL0(c.capitalAposCompra) + '</span>']);
  linhas.push(['Renda do capital no 1º mês', fmtBRL0(c.rendaInicial)]);
  if(id !== 'avista') linhas.push(['Parcela no 1º mês após a compra', fmtBRL0(c.parcelaInicial) + (id === 'financiamento' && seg.sistema === 'SAC' ? '<small>cai até ' + fmtBRL0(c.parcelaFinal) + '</small>' : '')]);
  linhas.push(['Menor capital no caminho', '<span class="' + (c.capitalMinimo < 0 ? 'no-t' : '') + '">' + fmtBRL0(Math.max(0, c.capitalMinimo)) + '</span><small>' + (c.capitalMinimo < 0 ? 'precisa de dinheiro de fora' : 'em ' + mesAno(c.mesCapitalMinimo)) + '</small>']);
  if(c.mesEsgota !== null) linhas.push(['Capital zera', '<span class="no-t">em ' + fmtPrazo(c.mesEsgota) + '</span><small>' + mesAno(c.mesEsgota) + '</small>']);
  return linhas;
}

function renderResposta(){
  const {inp, r} = ultimo;
  const H = inp.e.horizonteMeses, anos = anosDoHorizonte(inp);
  $('answer').innerHTML = caminhosAtivos(r).map(id => {
    const c = r.cenarios[id], k = CAM[id], a = respostaDe(id, c, H);
    let linhas = '';
    if(id === 'avista'){
      if(c.mesCompra !== null){
        const capitalAntes = c.mesCompra === 0 ? inp.e.capital : c.serie[c.mesCompra - 1].capital;
        linhas += linhaLedger('Renda que deixa de existir', fmtBRL0(Math.max(0, capitalAntes * inp.taxaMesInicial - c.rendaInicial)) + '/mês');
        linhas += linhaLedger('Fica investido', fmtBRL0(c.capitalAposCompra));
      }
    } else if(c.mesCompra !== null && c.mesCompra <= H){
      const p = c.periodo;
      linhas += linhaLedger('1º mês após a compra', 'renda ' + fmtBRL0(c.rendaInicial) + ' × parcela ' + fmtBRL0(c.parcelaInicial));
      linhas += linhaLedger('Em ' + fmtAnos(anos) + ', a renda pagou', fmtBRL0(p.rendaUsada) + ' de ' + fmtBRL0(p.somaParcelas) + '<small>' + fmtPct(p.cobertura || 0, 0) + ' das parcelas</small>');
      linhas += linhaLedger('Saiu do capital para completar', '<span class="' + (p.retiradoDoCapital > 0.5 ? 'no-t' : 'ok-t') + '">' + fmtBRL0(p.retiradoDoCapital) + '</span>');
      linhas += linhaLedger('Meses em que a renda cobriu a parcela', p.mesesCobertos + ' de ' + p.mesesComParcela);
    }
    return '<div class="ans" style="--cl:var(' + k.cor + ')"><h4>' + k.nome + '</h4><div class="big ' + a.cls + '">' + a.txt + '</div>' + linhas + '</div>';
  }).join('');
}

/** conclusão em linguagem de conversa: manchete imparcial + um parágrafo por caminho + alertas */
function textoConclusao(){
  const {inp, r} = ultimo;
  const H = inp.e.horizonteMeses, anos = anosDoHorizonte(inp);
  const C = r.cenarios, nome = id => CAM[id].nome.toLowerCase();
  const difs = id => ORDEM.filter(x => C[x] && x !== id && C[x].mesCompra !== null && C[x].mesCompra <= H)
    .map(x => fmtBRL0(C[id].horizonte.patrimonio - C[x].horizonte.patrimonio) + ' a mais que ' + nome(x)).join(' e ');
  const entreParenteses = id => difs(id) ? ' (' + difs(id) + ').' : '.';
  let head;
  if(!r.melhor) head = 'Nenhum caminho compra o bem dentro de ' + fmtAnos(anos) + ' com esses dados.';
  else if(r.melhor === 'avista') head = 'Neste cenário, <b>não compensa</b> manter o capital investido e pagar parcelas: comprar com capital próprio deixa o cliente com o maior patrimônio em ' + fmtAnos(anos) + entreParenteses('avista');
  else {
    const pagou = C[r.melhor].periodo.cobertura !== null && C[r.melhor].periodo.cobertura >= 0.999;
    head = 'Neste cenário, <b>compensa</b> manter o capital investido: o ' + nome(r.melhor) + (pagou ? ', com a renda do investimento pagando a parcela,' : '') + ' deixa o cliente com o maior patrimônio em ' + fmtAnos(anos) + entreParenteses(r.melhor);
  }
  const p = [];
  if(C.financiamento) p.push(paragrafoFinanciamento(C.financiamento));
  if(C.consorcio) p.push(paragrafoConsorcio(C.consorcio));
  if(C.avista) p.push(paragrafoAVista(C.avista, inp));
  if(C.consorcio && C.consorcio.mesCompra !== null) p.push(...alertasConsorcio(inp.e.consorcio));
  const cdi = alertaCdi(C, r);
  if(cdi) p.push(cdi);
  return {head, p};
}

function paragrafoFinanciamento(f){
  if(f.mesEsgota === null && f.cobertura >= 1) return '<b>Financiamento:</b> mantém ' + fmtBRL0(f.capitalAposCompra) + ' investidos e a renda desse capital (' + fmtBRL0(f.rendaInicial) + ') já paga a primeira parcela (' + fmtBRL0(f.parcelaInicial) + ')' + (seg.sistema === 'SAC' ? '; no SAC a parcela cai e a folga cresce.' : '.');
  if(f.mesEsgota === null) return '<b>Financiamento:</b> no início a renda paga ' + fmtPct(f.cobertura,0) + ' da parcela e o capital desce até ' + fmtBRL0(f.capitalMinimo) + ' (' + mesAno(f.mesCapitalMinimo) + '), mas não zera.';
  return '<b>Financiamento:</b> a renda não acompanha a parcela e o capital zera em ' + fmtPrazo(f.mesEsgota) + '.';
}

function paragrafoConsorcio(c){
  if(c.mesCompra === null) return '<b>Consórcio:</b> não chega à contemplação dentro do período simulado.';
  const inicio = c.mesCompra === 0 ? 'com o lance, ' : 'contemplado em ' + fmtPrazo(c.mesCompra) + ', ';
  if(c.mesEsgota === null) return '<b>Consórcio:</b> ' + inicio + 'ficam ' + fmtBRL0(c.capitalAposCompra) + ' investidos e a renda cobre ' + fmtPct(c.cobertura || 0,0) + ' da parcela; o capital não zera.';
  if(c.capitalAposCompra < 0) return '<b>Consórcio:</b> ' + inicio + 'o capital não cobre o lance' + (c.complemento > 0 ? ' e a diferença entre o crédito e o preço do bem (' + fmtBRL0(c.complemento) + ')' : '') + ': faltariam ' + fmtBRL0(-c.capitalAposCompra) + ' de outra fonte.';
  return '<b>Consórcio:</b> ' + inicio + 'sobram só ' + fmtBRL0(c.capitalAposCompra) + ' investidos; a renda (' + fmtBRL0(c.rendaInicial) + ') não paga a parcela (' + fmtBRL0(c.parcelaInicial) + ') e o capital zera em ' + fmtPrazo(c.mesEsgota) + '. O custo do crédito (' + (c.custoEfetivoAnual !== null ? fmtPct(c.custoEfetivoAnual) + ' a.a.' : '—') + ') não é o problema: o problema é a descapitalização do lance.';
}

function paragrafoAVista(a, inp){
  if(a.mesCompra === null) return '<b>Capital próprio:</b> o capital não alcança o preço do bem no período simulado.';
  const reserva = inp.e.reservaMinima;
  return '<b>Capital próprio:</b> ' + (a.mesCompra === 0 ? 'compra hoje' : 'compra em ' + fmtPrazo(a.mesCompra) + ', pagando ' + fmtBRL0(a.desembolsoCompra) + ' pelo bem já valorizado') + ', sem parcela, mas fica com ' + fmtBRL0(a.capitalAposCompra) + ' investidos' + (reserva > 0 && a.capitalAposCompra < reserva ? ' — abaixo da reserva mínima de ' + fmtBRL0(reserva) + '.' : '.');
}

function alertasConsorcio(cc){
  const p = [];
  if(cc.mediaLanceParcelas > 0 && cc.lanceTotal > 0) p.push('<b>Lance × média do grupo:</b> o lance simulado equivale a ' + fmtUmaCasa(cc.lanceParcelas) + ' parcelas; a média de lance do grupo é ' + cc.mediaLanceParcelas + ' parcelas' +
    (cc.lanceParcelas + 1e-9 < cc.mediaLanceParcelas ? ', então a chance de contemplação na data simulada é menor.' : '.'));
  p.push('<b>Atenção à contemplação:</b> o consórcio foi simulado com contemplação em ' + mesAno(cc.mesContemplacao - 1) + (cc.lanceTotal > 0 ? ' com lance de ' + fmtPct(cc.lanceTotal,0) + ' da carta' : ' sem lance') + '. Isso é uma hipótese, não uma garantia: confira o histórico de lances vencedores do grupo e simule também uma contemplação mais tarde.');
  return p;
}

/** até que rendimento o caminho de crédito vence a compra à vista */
function alertaCdi(C, r){
  const {eq, atualAA} = ultimo;
  const porCaminho = {financiamento: eq.finAv, consorcio: eq.consAv};
  const ref = r.melhor && r.melhor !== 'avista' ? r.melhor : (C.financiamento ? 'financiamento' : null);
  if(!ref || porCaminho[ref] == null) return null;
  const t = porCaminho[ref], folga = atualAA - t;
  return '<b>Atenção ao CDI:</b> o ' + CAM[ref].nome.toLowerCase() + ' só vence a compra à vista enquanto o capital render mais de <b>' + fmtPct(t) + ' a.a. líquidos</b>' + cdiEq(t) + '. Hoje rende ' + fmtPct(atualAA) +
    (folga >= 0 ? ', uma folga de ' + fmtPct(folga) + ' (pontos percentuais).' : ', abaixo desse ponto.');
}

/** taxa líquida → CDI equivalente, quando o rendimento foi informado como produto + % do CDI */
function cdiEq(t){
  const {info} = ultimo.inp;
  if(info.modo !== 'produto' || !(info.perc > 0)) return '';
  const g = Math.pow(1 + t, 1/12) - 1;
  const brutaMes = info.isento ? g : g / (1 - E.aliquotaIR(info.prazoMedio));
  const cdi = (Math.pow(1 + brutaMes, 12) - 1) / info.perc;
  return ' (CDI de ' + fmtPct(cdi) + ' com ' + fmtPct(info.perc,0) + ' do CDI' + (info.isento ? '' : ' e IR de ' + fmtPct(E.aliquotaIR(info.prazoMedio),1)) + ')';
}

function renderConclusao(){
  const t = textoConclusao();
  $('verdict').innerHTML = '<p class="headline">' + t.head + '</p>' + t.p.map(x => '<p>' + x + '</p>').join('');
}

const cabecalhoCaminhos = (ids, primeira) => '<tr><th>' + primeira + '</th>' + ids.map(id => '<th><span class="dot" style="--c:var(' + CAM[id].cor + ')"></span>' + CAM[id].nome + '</th>').join('') + '</tr>';

function renderEstresse(){
  const {r, eq, sens, atualAA, inp} = ultimo;
  const H = inp.e.horizonteMeses, anos = anosDoHorizonte(inp);
  const card = (k, v, s) => '<div class="eq-card"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="s">' + s + '</div></div>';
  const cards = PARES.filter(p => p.chave in eq).map(p => {
    const t = eq[p.chave];
    return card(p.titulo, t == null ? 'sem empate' : fmtPct(t) + ' a.a.',
      t == null ? p.semEmpate : 'Rendimento líquido em que os dois empatam em ' + fmtAnos(anos) + cdiEq(t) + p.acima);
  });
  cards.push(card('Rendimento líquido usado hoje', fmtPct(atualAA) + ' a.a.', inp.info.focus ? 'No 1º ano. Com a curva Focus marcada, os cards seguem a curva; esta tabela usa taxas constantes.' : 'Constante durante todo o período simulado.'));
  $('eqCards').innerHTML = cards.join('');

  const ids = caminhosAtivos(r);
  $('tabSens').innerHTML = cabecalhoCaminhos(ids, 'Rendimento líquido do capital') + sens.map(l => {
    const vals = ids.map(id => l[id]);
    let melhor = null;
    vals.forEach((v, i) => { if(v && v.comprou && (melhor === null || v.patrimonio > vals[melhor].patrimonio)) melhor = i; });
    const hoje = Math.abs(l.taxa - atualAA) < 1e-9;
    return '<tr class="' + (hoje ? 'now' : '') + '"><td>' + fmtPct(l.taxa) + ' a.a.' + (hoje ? ' (hoje)' : '') + '</td>' + vals.map((v, i) =>
      '<td class="' + (i === melhor ? 'win' : '') + '">' + (v ? (v.comprou ? fmtBRL0(v.patrimonio) : 'não compra') + (v.mesEsgota !== null && v.mesEsgota <= H ? '<small>capital zera em ' + fmtPrazo(v.mesEsgota) + '</small>' : '') : '—') + '</td>').join('') + '</tr>';
  }).join('');
  $('sensNota').textContent = 'Patrimônio líquido nominal em ' + fmtAnos(anos) + ', com o rendimento líquido do capital constante em cada linha. Em verde, o maior de cada linha.';
}

function renderCusto(){
  const {r, inp} = ultimo;
  const ids = caminhosAtivos(r), C = r.cenarios;
  const linha = (k, f) => '<tr><td>' + k + '</td>' + ids.map(id => '<td>' + f(C[id], id) + '</td>').join('') + '</tr>';
  const credito = f => (c, id) => id === 'avista' ? '—' : f(c, id);
  let h = cabecalhoCaminhos(ids, '');
  h += linha('Crédito usado', credito(c => fmtBRL0(c.creditoUtil)));
  h += linha('Total pago ao credor', credito((c, id) => fmtBRL0(id === 'financiamento' ? c.totalPago - c.desembolsoCompra : c.totalPago)));
  h += linha('Custo do crédito (juros e taxas)', credito(c => fmtBRL0(c.custoCredito)));
  const f = C.financiamento;
  if(f && f.modo === 'proposta'){
    h += linha('… juros · correção TR · seguros · tarifas', (c, id) => id === 'financiamento' ? fmtBRL0(f.juros) + ' · ' + fmtBRL0(f.correcao) + ' · ' + fmtBRL0(f.seguros) + ' · ' + fmtBRL0(f.tarifas + f.despesas) : '—');
  }
  h += linha('Custo efetivo', (c, id) => id === 'avista' ? 'custo de oportunidade' : (c.custoEfetivoAnual === null ? '—' : fmtPct(c.custoEfetivoAnual) + ' a.a.' +
    (id === 'financiamento' && c.modo === 'proposta' ? '<small class="suave">com TR projetada · CET da proposta ' + fmtPct(inp.e.financiamento.cetAnual) + ' (sem TR)</small>' : '')));
  h += linha('Fim do contrato', credito((c, id) => fmtPrazo(c.fimContrato + (id === 'consorcio' ? 1 : 0)) + ' <small class="suave">' + mesAno(c.fimContrato) + '</small>'));
  $('tabCusto').innerHTML = h;
}

function renderFluxo(){
  const {r} = ultimo;
  const ids = caminhosAtivos(r);
  if(!ids.includes(seg.fluxo)) seg.fluxo = ids[0];
  $('segFluxo').innerHTML = ids.map(id => '<button type="button" data-v="' + id + '" class="' + (id === seg.fluxo ? 'active' : '') + '">' + CAM[id].nome + '</button>').join('');
  const c = r.cenarios[seg.fluxo];
  const todos = $('fluxoMensal').checked;
  let h = '<tr><th>Mês</th><th>Renda</th><th>Parcela</th><th>Capital</th><th>Saldo devedor</th><th>Valor do bem</th><th>Patrimônio</th></tr>';
  c.serie.forEach(s => {
    if(!todos && s.mes % 12 !== 0 && s.mes !== c.mesCompra && s.mes !== c.mesEsgota) return;
    h += '<tr><td>' + s.mes + ' <small class="suave inline">' + mesAno(s.mes) + '</small></td><td>' + fmtBRL0(s.renda) + '</td><td>' + fmtBRL0(s.parcela) + '</td><td' + (s.capital < 0 ? ' class="cor-no"' : '') + '>' + fmtBRL0(s.capital) +
      '</td><td>' + fmtBRL0(s.saldoDevedor) + '</td><td>' + (s.temBem ? fmtBRL0(s.valorBem) : '—') + '</td><td>' + fmtBRL0(s.patrimonio) + '</td></tr>';
  });
  $('tabFluxo').innerHTML = h;
}

/* =========================================================================
 * 9. Gráfico (assets/grafico.js)
 * ========================================================================= */
let geo = null, seriesGrafico = [];
function desenharGrafico(){
  if(!ultimo) return;
  const {r, inp} = ultimo;
  const H = inp.e.horizonteMeses;
  const fim = seg.janela === 'h' ? H : r.mesesSimulados;
  const campo = seg.serie;
  const reserva = inp.e.reservaMinima;
  const series = caminhosAtivos(r).map(id => {
    const c = r.cenarios[id];
    const marca = c.mesCompra !== null && c.mesCompra <= fim ? c.serie[c.mesCompra] : null;
    return {id, nome: CAM[id].nome, cor: cssVar(CAM[id].cor),
      pontos: c.serie.filter(s => s.mes <= fim).map(s => ({x: s.mes/12, y: s[campo]})),
      marcador: marca ? {x: marca.mes/12, y: marca[campo]} : null};
  });
  const mostraReserva = campo === 'capital' && reserva > 0;
  const g = Grafico.desenhar($('ch'), {
    series, altura: 290, escala: 'auto', yExtra: [campo === 'capital' ? reserva : 0],
    xMin: 0, xMax: fim/12, passoX: s => s > 30 ? 5 : (s > 12 ? 2 : 1), rotuloX: 'anos',
    linhasH: mostraReserva ? [{y: reserva, cor: cssVar('--l-red'), rotulo: 'reserva mínima', corRotulo: cssVar('--red')}] : [],
    vline: seg.janela === 'tudo' && H < fim ? {x: H/12, rotulo: 'horizonte', alinhar: 'esquerda'} : null
  });
  if(!g) return;
  geo = g; seriesGrafico = series;
  $('legenda').innerHTML = series.map(s => '<span style="--c:var(' + CAM[s.id].cor + ')">' + s.nome + '</span>').join('') +
    (mostraReserva ? '<span style="--c:var(--l-red)">Reserva mínima</span>' : '');
  $('chartSub').textContent = campo === 'patrimonio'
    ? 'Capital investido + valor do bem − saldo devedor, em valores nominais. O ponto marca a compra do bem.'
    : 'Quanto continua investido rendendo. Abaixo de zero = dinheiro que precisaria vir de fora.';
}
function ligarTooltip(){
  Grafico.tooltip($('ch'), $('tt'), () => geo && {geo, html: xv => {
    const t = Math.round(xv*12);
    return '<div class="t">Mês ' + t + ' · ' + mesAno(t) + '</div>' + seriesGrafico.map(s => {
      const p = s.pontos[Math.min(t, s.pontos.length-1)];
      return '<div><span style="color:' + s.cor + '">●</span> ' + esc(s.nome) + ': ' + fmtCurto(p.y) + '</div>';
    }).join('');
  }}, 70);
}

/* =========================================================================
 * 10. Relatório em PDF (impressão do navegador)
 * ========================================================================= */
/** redesenha o gráfico em tema claro, captura a imagem e restaura o estado */
function graficoParaImpressao(){
  const tema = document.documentElement.dataset.theme;
  const serieAnterior = seg.serie;
  const etapa3 = $('step-3'), visivel = etapa3.classList.contains('active');
  document.documentElement.dataset.theme = 'light';
  seg.serie = 'patrimonio';
  if(!visivel) etapa3.classList.add('active');
  desenharGrafico();
  const img = $('ch').toDataURL('image/png');
  if(!visivel) etapa3.classList.remove('active');
  seg.serie = serieAnterior;
  document.documentElement.dataset.theme = tema || 'light';
  desenharGrafico();
  return img;
}

const semHtml = h => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent; };
const linhaPdf = (k, v) => '<tr><td class="k">' + k + '</td><td class="v">' + v + '</td></tr>';

function pdfDadosInformados(inp){
  const {e, info} = inp, atualAA = ultimo.atualAA;
  const rendimento = info.modo === 'renda'
    ? fmtBRL(info.renda) + ' por mês, líquido (' + fmtPct(atualAA) + ' a.a.)'
    : PRODUTOS[info.prod] + ' a ' + fmtPct(info.perc,0) + ' do CDI (' + fmtPct(info.cdi) + ')' + (info.isento ? '' : ', IR ' + fmtPct(E.aliquotaIR(info.prazoMedio),1)) + ' → ' + fmtPct(atualAA) + ' a.a. líquidos' + (info.focus ? ' no 1º ano (curva Focus)' : '');
  return linhaPdf('Bem', BEM[inp.tipo].replace(/^./, c => c.toUpperCase()) + ' · ' + fmtBRL(e.valorBem) + ' hoje · valoriza ' + ($('valIpca').checked ? 'pelo IPCA (' + fmtPct(e.valorizacaoAnual) + ' a.a.)' : fmtPct(e.valorizacaoAnual) + ' a.a.')) +
    linhaPdf('Capital investido', fmtBRL(e.capital)) +
    linhaPdf('Rendimento do capital', rendimento) +
    (e.aporteMensal > 0 ? linhaPdf('Aporte mensal', fmtBRL(e.aporteMensal)) : '') +
    (e.reservaMinima > 0 ? linhaPdf('Reserva mínima de liquidez', fmtBRL(e.reservaMinima)) : '') +
    (e.custoEsperaMensal > 0 ? linhaPdf('Custo de esperar pelo bem', fmtBRL(e.custoEsperaMensal) + '/mês') : '') +
    linhaPdf('IPCA previsto', fmtPct(e.ipcaAnual) + ' a.a.') +
    linhaPdf('Horizonte da comparação', fmtAnos(anosDoHorizonte(inp)));
}

function pdfCondicoes(e){
  const f = e.financiamento, c = e.consorcio;
  const fin = f.modo === 'proposta'
    ? ' · juros ' + fmtPct(f.jurosNominalAnual) + ' a.a. nominais · TR projetada ' + fmtPct(f.trMensal,4) + ' a.m. · DFI ' + fmtPct(f.dfiMensal,5) + ' a.m. · TAC ' + fmtBRL(f.tacMensal) + '/mês · despesas ' + fmtBRL0(f.despesasIniciais) + ' · CET ' + fmtPct(f.cetAnual) + ' a.a. (sem TR) · condições conforme proposta Sicoob de ' + dataBR(f.dataProposta)
    : ' · CET ' + fmtPct(f.cetAnual) + ' a.a. usado como taxa (sem a proposta detalhada)';
  return linhaPdf('Data prevista da compra', mesAno(e.mesCompra)) +
    (f.ativo ? linhaPdf('Financiamento', fmtBRL0(f.valorFinanciado) + ' · ' + f.prazoMeses + ' meses · ' + (f.sistema === 'SAC' ? 'SAC' : 'Price') + fin) : '') +
    (c.ativo ? linhaPdf('Consórcio', (c.modalidade === 'bem' ? 'Carta no valor do bem' : 'Carta com lance embutido') + ' · ' + fmtBRL0(c.carta) + ' · ' + c.prazoMeses + ' parcelas · adm ' + fmtPct(c.taxaAdm,1) + ' · fundo de reserva ' + fmtPct(c.fundoReserva,1) + ' · seguro ' + fmtBRL(c.seguroValor) + ' na 1ª parcela · reajuste ' + fmtPct(c.reajusteAnual,1) + ' a.a. (' + $('consIndice').value + ') · lance ' + fmtPct(c.lanceTotal,1) + ' da carta (' + fmtUmaCasa(c.lanceParcelas) + ' parcelas; ' + fmtPct(c.lanceEmbutido,0) + ' embutido)' + (c.mediaLanceParcelas > 0 ? ' · média de lance do grupo ' + c.mediaLanceParcelas + ' parcelas' : '') + ', ' + (c.lanceReduz === 'prazo' ? 'reduz o prazo' : 'reduz a parcela') + ' · contemplação prevista em ' + mesAno(c.mesContemplacao - 1)) : '');
}

function pdfResultado(inp, r){
  const H = inp.e.horizonteMeses, anos = anosDoHorizonte(inp);
  const ids = caminhosAtivos(r), C = r.cenarios;
  const col = f => ids.map(id => '<td class="n">' + f(C[id], id) + '</td>').join('');
  const linha = (rotulo, f) => '<tr><td>' + rotulo + '</td>' + col(f) + '</tr>';
  const comCor = (cls, txt) => '<span class="' + (cls === 'ok' ? 'ok' : cls === 'no' ? 'no' : '') + '">' + txt + '</span>';
  const semCompra = f => x => x.mesCompra === null ? '—' : f(x);
  const soCredito = f => (x, id) => id === 'avista' ? '—' : f(x, id);
  return '<table><tr><th></th>' + ids.map(id => '<th class="n">' + CAM[id].nome + '</th>').join('') + '</tr>' +
    linha('Situação', (x, id) => statusDe(id, x, inp).map(s => comCor(s.cls, s.txt)).join('<br>')) +
    linha('Compra do bem', x => semHtml(quando(x))) +
    linha('Sai do capital na compra', semCompra(x => fmtBRL0(x.desembolsoCompra))) +
    linha('Fica investido', semCompra(x => fmtBRL0(x.capitalAposCompra))) +
    linha('Renda do capital no 1º mês', semCompra(x => fmtBRL0(x.rendaInicial))) +
    linha('Parcela no 1º mês após a compra', soCredito(x => fmtBRL0(x.parcelaInicial))) +
    linha('Renda ÷ parcela', soCredito(x => x.cobertura === null ? '—' : '<span class="' + (x.cobertura >= 1 ? 'ok' : 'no') + '">' + fmtPct(x.cobertura,0) + '</span>')) +
    linha('<strong>A renda paga a parcela?</strong>', (x, id) => { const a = respostaDe(id, x, H); return comCor(a.cls, a.txt); }) +
    linha('Renda pagou das parcelas em ' + fmtAnos(anos), soCredito(x => !x.periodo || x.periodo.somaParcelas === 0 ? '—' : fmtBRL0(x.periodo.rendaUsada) + ' de ' + fmtBRL0(x.periodo.somaParcelas) + ' (' + fmtPct(x.periodo.cobertura,0) + ')')) +
    linha('Saiu do capital para pagar parcelas', soCredito(x => !x.periodo ? '—' : fmtBRL0(x.periodo.retiradoDoCapital))) +
    linha('Capital zera', x => x.mesEsgota === null ? 'não zera' : '<span class="no">em ' + fmtPrazo(x.mesEsgota) + '</span>') +
    linha('Custo efetivo do crédito', soCredito(x => x.custoEfetivoAnual === null ? '—' : fmtPct(x.custoEfetivoAnual) + ' a.a.')) +
    linha('<strong>Patrimônio líquido em ' + fmtAnos(anos) + '</strong>', (x, id) => '<strong class="' + (r.melhor === id ? 'ok' : '') + '">' + fmtBRL0(x.horizonte.patrimonio) + '</strong>') +
    linha('… em R$ de hoje', x => fmtBRL0(x.horizonte.patrimonioReal)) +
    '</table>';
}

function pdfEstresse(r){
  const {sens, atualAA} = ultimo;
  const ids = caminhosAtivos(r);
  return '<table><tr><th>Rendimento líquido</th>' + ids.map(id => '<th class="n">' + CAM[id].nome + '</th>').join('') + '</tr>' +
    sens.map(l => {
      const hoje = Math.abs(l.taxa - atualAA) < 1e-9;
      return '<tr><td>' + fmtPct(l.taxa) + ' a.a.' + (hoje ? ' (hoje)' : '') + '</td>' + ids.map(id => { const v = l[id]; return '<td class="n">' + (v ? (v.comprou ? fmtBRL0(v.patrimonio) : 'não compra') : '—') + '</td>'; }).join('') + '</tr>';
    }).join('') + '</table>';
}

function gerarPdf(){
  recalcular();
  if(!ultimo) return;
  const {inp, r} = ultimo;
  const anos = anosDoHorizonte(inp);
  const ids = caminhosAtivos(r);
  const t = textoConclusao();
  const img = graficoParaImpressao();
  const legenda = ids.map(id => '<span><i style="background:' + CAM[id].hex + '"></i>' + CAM[id].nome + '</span>').join('');
  $('printArea').innerHTML =
    '<div class="pr-badge">SIMULAÇÃO — NÃO É PROPOSTA DE CRÉDITO NEM PROMESSA DE RENTABILIDADE</div>' +
    '<h1>Estratégia de Aquisição</h1><div class="pr-sub">Simulação gerada em ' + HOJE.toLocaleDateString('pt-BR') + ' · consórcio × financiamento × capital próprio</div>' +
    '<div class="bloco"><h2>Conclusão</h2><div class="pr-concl"><p><strong>' + semHtml(t.head) + '</strong></p>' + t.p.map(x => '<p>' + x + '</p>').join('') + '</div></div>' +
    '<div class="bloco"><h2>Dados informados</h2><table>' + pdfDadosInformados(inp) + pdfCondicoes(inp.e) + '</table></div>' +
    '<div class="bloco"><h2>Resultado por caminho</h2>' + pdfResultado(inp, r) + '</div>' +
    '<div class="bloco"><h2>Evolução do patrimônio líquido</h2><img class="pr-chart" src="' + img + '" alt="Gráfico da evolução do patrimônio líquido por caminho"><div class="pr-legend">' + legenda + '</div></div>' +
    '<div class="bloco"><h2>Teste de estresse: patrimônio em ' + fmtAnos(anos) + ' conforme o rendimento do capital</h2>' + pdfEstresse(r) +
      '<p class="pr-note">Patrimônio líquido = capital investido + valor do bem − saldo devedor (nominal). Rendimento líquido constante em cada linha.</p></div>' +
    '<div class="pr-aviso"><strong>Aviso:</strong> este documento é uma <strong>simulação</strong> com base nos parâmetros informados. Taxas de juros, inflação, reajustes e condições de crédito variam ao longo do tempo; o lance do consórcio pode não ser vencedor na data simulada; e o resultado efetivo pode ser diferente do projetado. ' +
      'Não constitui proposta de crédito, oferta ou recomendação de investimento. Rentabilidade passada não representa garantia de rentabilidade futura.</div>' +
    '<div class="pr-footer">' + [...document.querySelectorAll('footer p')].map(p => '<p>' + esc(p.textContent) + '</p>').join('') + '</div>';
  setTimeout(() => window.print(), 120);
}

/* =========================================================================
 * 11. Importar simulações do Sicoob (PDF, opcional)
 * ========================================================================= */
let pdfjsPromessa = null;
/** carrega o pdf.js só quando o usuário importa um PDF */
function carregarPdfjs(){
  if(window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if(!pdfjsPromessa) pdfjsPromessa = new Promise((ok, falha) => {
    const sc = document.createElement('script');
    sc.src = PDFJS + 'pdf.min.js';
    sc.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; ok(window.pdfjsLib); };
    sc.onerror = () => { pdfjsPromessa = null; falha(new Error('Não foi possível carregar o leitor de PDF.')); };
    document.head.appendChild(sc);
  });
  return pdfjsPromessa;
}
async function lerPdfSicoob(arquivo){
  const lib = await carregarPdfjs();
  const doc = await lib.getDocument({data: new Uint8Array(await arquivo.arrayBuffer())}).promise;
  const paginas = [];
  for(let p = 1; p <= doc.numPages; p++) paginas.push((await (await doc.getPage(p)).getTextContent()).items);
  return PropostasSicoob.ler(PropostasSicoob.linhasDeItens(paginas), {idadeAnos: num('finIdade')});
}
/** marca um botão de opção sem disparar a ação dele */
function setSeg(id, chave, v){
  seg[chave] = v;
  $(id).querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === v));
}
function statusImport(id, txt, cls){ const el = $(id + 'Status'); el.innerHTML = txt; el.className = 'hint' + (cls ? ' ' + cls : ''); }

/** preenche os campos do financiamento; devolve o que foi preenchido e avisos */
function aplicarFinanciamento(r){
  const feitos = [];
  const preencher = (id, valor, rotulo) => { if(ehNumero(valor)){ $(id).value = valor; if(rotulo) feitos.push(rotulo); } };
  if(ehNumero(r.valorFinanciado)){ $('finValor').value = moeda(r.valorFinanciado); feitos.push('valor financiado'); }
  preencher('finPrazo', r.prazoMeses, 'prazo');
  if(ehNumero(r.cetAnual)){ $('finCet').value = (r.cetAnual*100).toFixed(2); feitos.push('CET'); }
  if(ehNumero(r.jurosNominalAnual)){ $('finJuros').value = (r.jurosNominalAnual*100).toFixed(2); feitos.push('juros'); }
  if(ehNumero(r.trMensal)) preencher('finTr', +(r.trMensal*100).toFixed(4), 'TR');
  if(ehNumero(r.dfiMensal)) preencher('finDfi', +(r.dfiMensal*100).toFixed(5), 'DFI');
  if(ehNumero(r.tacMensal)){ $('finTac').value = moeda(r.tacMensal); feitos.push('tarifa mensal'); }
  if(ehNumero(r.despesasIniciais)){ $('finDesp').value = moeda(r.despesasIniciais); feitos.push('despesas'); }
  if(ehNumero(r.idadeAnos)){ $('finIdade').value = r.idadeAnos; idadeMesesExtra = r.idadeMesesExtra || 0; feitos.push('idade'); }
  if(r.dataProposta) $('finData').value = r.dataProposta;
  if(r.sistema) setSeg('segSistema', 'sistema', r.sistema);
  setSeg('segFinModo', 'finModo', 'proposta');
  if(r.tabelaMIP && r.tabelaMIP.length){ mipTabela = r.tabelaMIP.map(x => [x.idadeAte, +(x.taxa*100).toFixed(4)]); renderMip(); feitos.push('seguro MIP por idade'); }
  let extra = '';
  if(ehNumero(r.valorImovel) && Math.abs(r.valorImovel - money('valorBem')) > 0.5){
    $('valorBem').value = moeda(r.valorImovel);
    extra = ' O valor do bem foi atualizado para ' + fmtBRL0(r.valorImovel) + ', como na proposta.';
  }
  return {feitos, extra};
}

/** preenche os campos do consórcio; devolve o que foi preenchido e avisos */
function aplicarConsorcio(r){
  const feitos = [];
  const bem = money('valorBem');
  const cartaDiferente = ehNumero(r.carta) && Math.abs(r.carta - bem) > 0.5;
  if(ehNumero(r.carta)){
    if(r.lanceEmbutido > 0 || cartaDiferente){ setSeg('segModal', 'modal', 'embutido'); $('consCarta').value = moeda(r.carta); }
    else setSeg('segModal', 'modal', 'bem');
    feitos.push('carta');
  }
  if(ehNumero(r.prazoRateio)){ $('consPrazo').value = r.prazoRateio; feitos.push('nº de parcelas'); }
  if(ehNumero(r.taxaAdm)){ $('consAdm').value = +(r.taxaAdm*100).toFixed(4); feitos.push('taxa de administração'); }
  if(ehNumero(r.fundoReserva)){ $('consFr').value = +(r.fundoReserva*100).toFixed(4); feitos.push('fundo de reserva'); }
  if(ehNumero(r.seguroValor)){ $('consSeg').value = moeda(r.seguroValor); feitos.push('seguro'); }
  if(r.lanceEm === 'parcelas' && ehNumero(r.valorLance)){ setSeg('segLance', 'lanceEm', 'parcelas'); $('consLance').value = r.valorLance; feitos.push('lance'); }
  else if(ehNumero(r.lanceTotal)){ setSeg('segLance', 'lanceEm', 'pct'); $('consLance').value = +(r.lanceTotal*100).toFixed(2); feitos.push('lance'); }
  if(ehNumero(r.lanceEmbutido)) $('consEmb').value = +(r.lanceEmbutido*100).toFixed(2);
  if(ehNumero(r.mediaLanceParcelas)){ $('consMedia').value = r.mediaLanceParcelas; feitos.push('média de lance'); }
  if(r.lanceReduz) setSeg('segReduz', 'reduz', r.lanceReduz);
  if(r.vencimento){ $('consMes').value = mesAtualStr(); feitos.push('contemplação na 1ª assembleia (' + dataBR(r.vencimento) + ')'); }
  let extra = '';
  if(cartaDiferente) extra = ' Atenção: a carta (' + fmtBRL0(r.carta) + (r.descricaoBem ? ', ' + esc(r.descricaoBem) : '') + ') é diferente do valor do bem informado (' + fmtBRL0(bem) + '). Confira se é o mesmo bem.';
  if(r.taxaAntecipada) extra += ' A simulação tem taxa antecipada, que não entra no cálculo.';
  return {feitos, extra};
}

async function importarPdf(id){
  const arq = $(id).files && $(id).files[0];
  if(!arq) return;
  statusImport(id, 'Lendo ' + esc(arq.name) + '…');
  try{
    const r = await lerPdfSicoob(arq);
    const esperado = id === 'pdfFin' ? 'financiamento' : 'consorcio';
    if(r.tipo !== esperado){
      statusImport(id, r.tipo ? 'Este PDF é uma simulação de ' + (r.tipo === 'financiamento' ? 'financiamento' : 'consórcio') + '. Use o botão da seção correspondente.' : esc(r.avisos[0]), 'err');
      return;
    }
    const {feitos, extra} = esperado === 'financiamento' ? aplicarFinanciamento(r) : aplicarConsorcio(r);
    const data = r.dataProposta || r.dataSimulacao;
    statusImport(id, 'Simulação' + (data ? ' de ' + dataBR(data) : '') + ' importada: ' + feitos.join(', ') + '. Confira os campos.' + extra + (r.avisos.length ? ' ' + esc(r.avisos.join(' ')) : ''), 'ok');
    agendar();
  }catch(err){
    statusImport(id, 'Não foi possível ler o PDF (' + esc(err.message || 'erro') + '). Digite os dados manualmente.', 'err');
  }finally{ $(id).value = ''; }
}

/** tabela do seguro MIP, editável */
function renderMip(){
  $('mipGrid').innerHTML = mipTabela.map(([a,t],k) => '<div class="field"><label for="mip' + k + '">' + (k === 0 ? 'até ' + a + ' anos' : (mipTabela[k-1][0]+1) + ' a ' + a + ' anos') + '</label><div class="row-input"><input type="number" id="mip' + k + '" value="' + t + '" min="0" step="0.0001"><span class="suffix">%</span></div></div>').join('');
}

/* =========================================================================
 * 12. Dados do Banco Central (assets/bcb.js)
 * ========================================================================= */
async function buscarFocus(){
  const st = $('focusStatus'); st.hidden = false;
  st.textContent = 'Consultando o Boletim Focus no Banco Central…';
  try{
    const f = await BCB.focusSelic(ANO + 1);
    const porAno = {};
    Object.keys(f.porAno).forEach(a => { porAno[a] = f.porAno[a] - BCB.SPREAD_CDI_SELIC; });
    curvaFocus = porAno;
    const anos = Object.keys(porAno).map(Number).sort((a,b)=>a-b);
    st.textContent = 'CDI por ano = Selic de fim de ano esperada no Boletim Focus de ' + dataBR(String(f.data)) +
      ' (expectativa de mercado, não é previsão oficial) − 0,10 p.p.: ' + anos.map(a => a + ' ' + fmtPct(porAno[a]/100)).join(' · ') +
      '. Ano atual = CDI informado; depois de ' + anos[anos.length-1] + ' mantém o último valor.';
  }catch(e){
    curvaFocus = null;
    st.textContent = 'Não foi possível consultar o Boletim Focus agora. A análise usa o CDI informado, constante.';
  }
  agendar();
}
/** CDI (% a.a.) do mês t: o informado no ano atual; depois, a curva Focus (se marcada) */
function cdiDoMes(t, cdiAtual){
  if(!($('usarFocus').checked && curvaFocus)) return cdiAtual;
  const ano = new Date(HOJE.getFullYear(), HOJE.getMonth() + t - 1, 1).getFullYear();
  if(ano <= ANO) return cdiAtual;
  let v = cdiAtual;
  Object.keys(curvaFocus).map(Number).sort((a,b)=>a-b).forEach(a => { if(a <= ano) v = curvaFocus[a]; });
  return v;
}
async function buscarCdi(){
  const st = $('cdiStatus'); st.textContent = 'Consultando o Banco Central…';
  try{
    const d = await BCB.metaSelic();
    $('cdi').value = d.cdi.toFixed(2);
    st.textContent = 'CDI estimado pela Meta Selic do Copom (' + fmtPct(d.metaSelic/100) + ', vigente desde ' + d.data + ') − 0,10 p.p. Fonte: BCB, SGS 432.';
  }catch(e){ st.textContent = 'Não foi possível consultar o Banco Central agora. Use o valor manual.'; }
  agendar();
}
async function buscarIpca(){
  const st = $('ipcaStatus'); st.textContent = 'Consultando o Banco Central…';
  try{
    const d = await BCB.ipca12m();
    $('ipca').value = d.valor.toFixed(2);
    const p = String(d.data).split('/');
    st.textContent = 'IPCA acumulado em 12 meses até ' + (p.length === 3 ? p[1] + '/' + p[2] : d.data) + ': ' + fmtPct(d.valor/100) + ' (BCB, SGS 13522). É inflação passada usada como premissa para o futuro — ajuste se quiser.';
  }catch(e){ st.textContent = 'Não foi possível consultar o Banco Central agora. Use o valor manual.'; }
  agendar();
}

/* =========================================================================
 * 13. Ligações e início
 * ========================================================================= */
function ligarSeg(id, chave, aoMudar){
  $(id).querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    seg[chave] = b.dataset.v;
    $(id).querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    if(aoMudar) aoMudar();
  }));
}

function irPara(n){
  document.querySelectorAll('.step-btn').forEach(b => b.classList.toggle('active', b.dataset.step == String(n)));
  document.querySelectorAll('.step-panel').forEach(p => p.classList.toggle('active', p.id === 'step-' + n));
  desenharGrafico();
  window.scrollTo({top:0, behavior:'smooth'});
}

/** ao trocar a unidade do lance, converte o valor digitado para manter o mesmo lance */
function converterUnidadeLance(){
  const fracao = fracaoParcela();
  const v = num('consLance');
  if(isFinite(v) && fracao > 0) $('consLance').value = seg.lanceEm === 'parcelas' ? +(v/100/fracao).toFixed(1) : +(v*fracao*100).toFixed(2);
  agendar();
}

function iniciar(){
  // valores iniciais
  renderMip();
  $('dataCompra').value = mesAtualStr();
  $('consMes').value = mesAtualStr();
  document.querySelectorAll('.money').forEach(mascara);

  // navegação entre etapas
  document.querySelectorAll('.step-btn').forEach(b => b.addEventListener('click', () => irPara(parseInt(b.dataset.step,10))));
  document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => irPara(parseInt(b.dataset.goto,10))));

  // qualquer mudança nos formulários recalcula (delegação: vale também para campos criados depois)
  $('finIdade').addEventListener('input', () => { idadeMesesExtra = 0; });
  ['pdfFin', 'pdfCons'].forEach(id => $(id).addEventListener('change', () => importarPdf(id)));
  ['step-1', 'step-2'].forEach(id => { $(id).addEventListener('input', agendar); $(id).addEventListener('change', agendar); });

  // botões de opção
  ligarSeg('segModo', 'modo', () => { $('modoRenda').hidden = seg.modo !== 'renda'; $('modoProduto').hidden = seg.modo !== 'produto'; agendar(); });
  ligarSeg('segSistema', 'sistema', agendar);
  ligarSeg('segReduz', 'reduz', agendar);
  ligarSeg('segModal', 'modal', agendar);
  ligarSeg('segFinModo', 'finModo', agendar);
  ligarSeg('segLance', 'lanceEm', converterUnidadeLance);
  ligarSeg('segSerie', 'serie', desenharGrafico);
  ligarSeg('segJanela', 'janela', desenharGrafico);
  $('segFluxo').addEventListener('click', ev => {
    const b = ev.target.closest('button[data-v]');
    if(b){ seg.fluxo = b.dataset.v; renderFluxo(); }
  });

  // campos com efeito na tela
  $('valIpca').addEventListener('change', () => { $('valOutraBox').hidden = $('valIpca').checked; });
  $('tipoBem').addEventListener('change', () => {
    if($('tipoBem').value === 'carro' && $('valIpca').checked){ $('valIpca').checked = false; $('valOutraBox').hidden = false; }
  });
  ['onFin','onCons','onAv'].forEach(id => $(id).addEventListener('change', () => {
    $(id).closest('section').classList.toggle('off', !$(id).checked);
  }));
  $('btnCartaIdeal').addEventListener('click', () => { $('consCarta').value = moeda(Number($('btnCartaIdeal').dataset.valor)); agendar(); });
  $('usarFocus').addEventListener('change', () => {
    if($('usarFocus').checked && !curvaFocus) buscarFocus();
    else { $('focusStatus').hidden = !$('usarFocus').checked; agendar(); }
  });
  $('fluxoMensal').addEventListener('change', renderFluxo);

  // dados externos, relatório, tema e gráfico
  $('btnCdi').addEventListener('click', buscarCdi);
  $('btnIpca').addEventListener('click', buscarIpca);
  $('btnPdf').addEventListener('click', gerarPdf);
  Tema.ligarBotao($('btnTema'), () => setTimeout(desenharGrafico, 30));
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(desenharGrafico, 150); });
  ligarTooltip();

  recalcular();
}

iniciar();
})();
