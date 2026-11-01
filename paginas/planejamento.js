/*
 * Planejamento financeiro (planejamento.html) — lógica da página.
 */
(function(){
'use strict';
const E = window.PlanEngine;
const $ = id => document.getElementById(id);
const HOJE = new Date();
const ANO = HOJE.getFullYear();

/* ---------- formatação (assets/formato.js) ---------- */
const {brl: fmtBRL, brl0: fmtBRL0, pct: fmtPct, curto: fmtCurto, anos: fmtAnos, prazo: fmtPrazo, esc, lerMoeda, mascara} = Formato;
function escreverMoeda(el, v){ el.value = Formato.moeda(v); }
const num = id => { const v = parseFloat($(id).value); return isNaN(v) ? NaN : v; };

/* ---------- objetivos e entradas extraordinárias ----------
   As duas listas usam a mesma linha de edição (nome, valor de hoje, data, frequência).
   Objetivos tiram dinheiro do patrimônio; entradas somam. */
const TIPOS = {
  reserva: {rotulo:'Reserva de emergência', recorrente:false, mesesPadrao:12},
  carro:   {rotulo:'Carro', recorrente:true},
  imovel:  {rotulo:'Imóvel', recorrente:false},
  terreno: {rotulo:'Terreno', recorrente:false},
  viagem:  {rotulo:'Viagem', recorrente:true},
  educacao:{rotulo:'Educação dos filhos', recorrente:false},
  outro:   {rotulo:'Outro objetivo', recorrente:false}
};
const TIPOS_ENTRADA = {
  terra:   {rotulo:'Venda de terra', recorrente:false, mesesPadrao:60},
  vendaImovel: {rotulo:'Venda de imóvel', recorrente:false, mesesPadrao:60},
  safra:   {rotulo:'Sobra da safra', recorrente:true, mesesPadrao:12, recorrenciaPadrao:1},
  heranca: {rotulo:'Herança', recorrente:false, mesesPadrao:60},
  bonus:   {rotulo:'Bônus ou PLR', recorrente:true, mesesPadrao:12, recorrenciaPadrao:1},
  outraEntrada: {rotulo:'Outra entrada', recorrente:false, mesesPadrao:24}
};
const LISTAS = {
  obj: {tipos: TIPOS, itens: [], chips: 'chips', box: 'objList', vazio: 'objEmpty', rotulo: 'Objetivo', remover: 'Remover objetivo'},
  ent: {tipos: TIPOS_ENTRADA, itens: [], chips: 'entChips', box: 'entList', vazio: 'entEmpty', rotulo: 'Entrada', remover: 'Remover entrada'}
};
const objetivos = LISTAS.obj.itens;
const entradasExtra = LISTAS.ent.itens;
let seqObj = 1;

function mesFuturo(meses){
  const d = new Date(HOJE.getFullYear(), HOJE.getMonth() + meses, 1);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
}
function addItem(lista, tipo){
  const L = LISTAS[lista], T = L.tipos[tipo];
  L.itens.push({id: seqObj++, tipo, nome: T.rotulo, valorHoje: 0, data: mesFuturo(T.mesesPadrao || 24), recorrenciaAnos: T.recorrenciaPadrao || 0});
  renderLista(lista);
  const last = $(L.box).querySelector('.obj-row:last-child .money');
  if(last) last.focus();
  recalcular();
}
function renderChips(lista){
  const L = LISTAS[lista];
  $(L.chips).innerHTML = Object.keys(L.tipos).map(t => '<button type="button" class="chip" data-tipo="'+t+'">+ '+esc(L.tipos[t].rotulo)+'</button>').join('');
  $(L.chips).querySelectorAll('.chip').forEach(b => b.addEventListener('click', ()=>addItem(lista, b.dataset.tipo)));
}
function renderLista(lista){
  const L = LISTAS[lista];
  const box = $(L.box);
  box.innerHTML = '';
  $(L.vazio).classList.toggle('hidden', L.itens.length > 0);
  L.itens.forEach(o=>{
    const rec = L.tipos[o.tipo].recorrente;
    const row = document.createElement('div');
    row.className = 'obj-row';
    row.innerHTML =
      '<div class="field"><label>' + L.rotulo + '</label><div class="row-input"><input type="text" data-k="nome" maxlength="40" value="'+esc(o.nome)+'"></div></div>' +
      '<div class="field"><label>Valor <span class="unit hoje">HOJE</span></label><div class="row-input"><span class="prefix">R$</span><input type="text" inputmode="decimal" class="money" data-k="valorHoje"></div></div>' +
      '<div class="field"><label>Quando</label><div class="row-input" data-wrap="data"><input type="month" data-k="data" value="'+o.data+'"></div><div class="hint" data-hint="data"></div></div>' +
      '<div class="field"><label>Frequência</label><div class="row-input"><select data-k="recorrenciaAnos" '+(rec?'':'disabled')+'>' +
        [0,1,2,3,4,5,10].map(n=>'<option value="'+n+'"'+(o.recorrenciaAnos===n?' selected':'')+'>'+(n===0?'Uma vez':(n===1?'Todo ano':'A cada '+n+' anos'))+'</option>').join('') +
      '</select></div></div>' +
      '<div class="rm-wrap"><button type="button" class="btn-rm" aria-label="' + L.remover + '">Remover</button></div>';
    const money = row.querySelector('.money');
    escreverMoeda(money, o.valorHoje);
    mascara(money);
    row.querySelectorAll('[data-k]').forEach(el=>{
      el.addEventListener('input', ()=>{
        const k = el.dataset.k;
        if(k === 'valorHoje') o.valorHoje = lerMoeda(el);
        else if(k === 'recorrenciaAnos') o.recorrenciaAnos = parseInt(el.value,10) || 0;
        else o[k] = el.value;
        agendar();
      });
      if(el.tagName === 'SELECT') el.addEventListener('change', ()=>{ o.recorrenciaAnos = parseInt(el.value,10)||0; agendar(); });
    });
    row.querySelector('.btn-rm').addEventListener('click', ()=>{
      L.itens.splice(L.itens.indexOf(o), 1);
      renderLista(lista); recalcular();
    });
    o._row = row;
    box.appendChild(row);
  });
}
/** valida as datas de uma lista e devolve os itens prontos para o motor */
function lerLista(lista, anos){
  const L = LISTAS[lista], saida = [];
  L.itens.forEach(o=>{
    const m = E.mesesAteData(o.data, HOJE);
    let msg = '';
    if(m === null) msg = 'Informe mês e ano.';
    else if(m < 1) msg = 'Data no passado — use um mês futuro.';
    else if(isFinite(anos) && m > anos*12) msg = 'Depois do início da renda — não entra no cálculo.';
    if(o._row){
      o._row.querySelector('[data-hint="data"]').textContent = msg || ('daqui a ' + fmtPrazo(m));
      o._row.querySelector('[data-hint="data"]').classList.toggle('err', !!msg);
      o._row.querySelector('[data-wrap="data"]').classList.toggle('invalid', !!msg && m !== null && m < 1);
    }
    if(m !== null && m >= 1 && o.valorHoje > 0){
      const rotulo = L.tipos[o.tipo].rotulo;
      saida.push({id:o.id, nome:(o.nome||rotulo).trim() || rotulo, tipo:o.tipo,
        valorHoje:o.valorHoje, mes:m, recorrenciaAnos: L.tipos[o.tipo].recorrente ? o.recorrenciaAnos : 0});
    }
  });
  return saida;
}
const textoFrequencia = (L, o) => L.tipos[o.tipo].recorrente && o.recorrenciaAnos ? (o.recorrenciaAnos === 1 ? 'Todo ano' : 'A cada ' + o.recorrenciaAnos + ' anos') : 'Uma vez';

/* ---------- leitura e validação ---------- */
function lerEntradas(){
  const erros = [];
  const idade = num('idade');
  const anos = num('anosRenda');
  const inflacao = num('inflacao')/100;
  const spread = num('spread')/100;
  const taxas = [num('tx0'), num('tx1'), num('tx2')].map(t=>t/100);
  if(!(idade >= 0 && idade < 100)) erros.push('Informe uma idade entre 0 e 99 anos.');
  if(!(lerMoeda($('renda')) > 0)) erros.push('Informe a renda mensal desejada (maior que zero).');
  const idadeFim = num('idadeFim');
  if(!(Number.isInteger(idadeFim) && idadeFim > idade + anos && idadeFim <= 120)) erros.push('A idade até a qual a renda consome o patrimônio deve ser um número inteiro maior que a idade de início da renda (' + (idade + anos) + ' anos) e até 120.');
  if(!(anos >= 1 && Number.isInteger(anos))) erros.push('O prazo para começar a receber deve ser de pelo menos 1 ano (número inteiro).');
  if(idade + anos >= 100) erros.push('A idade de início da renda precisa ser menor que 100 anos.');
  if(!(inflacao >= 0 && inflacao <= 0.5)) erros.push('Inflação média deve estar entre 0% e 50% a.a.');
  if(!(spread > 0)) erros.push('A rentabilidade real da fase de renda precisa ser maior que zero; com taxa real zero ou negativa não existe patrimônio que pague a renda para sempre.');
  if(taxas.some(t=>!(t >= 0 && t <= 0.5))) erros.push('As rentabilidades dos cenários devem estar entre 0% e 50% a.a.');
  const rentUso = num('rentUso')/100;
  if(!(rentUso >= 0 && rentUso <= 0.5)) erros.push('A rentabilidade da fase de renda deve estar entre 0% e 50% a.a.');
  if([0,1,2].some(i=>!(num('cons'+i) >= 0 && num('cons'+i) <= 100))) erros.push('As taxas de consumo devem estar entre 0% e 100% a.a.');

  const objs = lerLista('obj', anos);
  const ents = lerLista('ent', anos);
  const reajusteAporte = $('reajusteAporte').checked;

  return {
    erros, idade, anos, inflacao, spread, taxas,
    patrimonio: lerMoeda($('patrimonio')), aporte: lerMoeda($('aporte')),
    renda: lerMoeda($('renda')), outrasRendas: lerMoeda($('outrasRendas')), idadeFim: num('idadeFim'), rentUso: num('rentUso')/100,
    consumo: [0,1,2].map(i=>num('cons'+i)/100),
    objetivos: objs, entradas: ents, reajusteAporte
  };
}

/* ---------- cálculo ---------- */
const CENARIOS = [
  {nome:'Conservador', cor:'--blue'},
  {nome:'Base', cor:'--gold'},
  {nome:'Otimista', cor:'--teal'}
];
let ultimo = null;
let modoGrafico = 'nominal';

function recalcular(){
  const inp = lerEntradas();
  const banner = $('errBanner');
  if(inp.erros.length){
    banner.innerHTML = inp.erros.map(esc).join('<br>');
    banner.classList.add('show');
    ultimo = null;
    marcarResultados(true);
    return;
  }
  banner.classList.remove('show');
  marcarResultados(false);


  const N = inp.anos*12;
  inp.rendaCarteira = Math.max(0, inp.renda - inp.outrasRendas);   // a carteira gera só o que faltar
  const meta = E.patrimonioNecessario(inp.rendaCarteira, inp.spread);
  const fN = E.fatorInflacao(inp.inflacao, N);
  const mesesMax = (100 - inp.idade)*12;

  const cenarios = inp.taxas.map((tx, i)=>Object.assign({}, CENARIOS[i], {taxa:tx},
    E.planejarCenario({
      patrimonioInicial: inp.patrimonio, aporteMensal: inp.aporte, rentabNominalAnual: tx,
      inflacaoAnual: inp.inflacao, objetivos: inp.objetivos, entradas: inp.entradas, reajusteAporte: inp.reajusteAporte, anosParaRenda: inp.anos,
      metaHoje: meta, mesesMaximo: mesesMax
    })));

  const curvas = E.curvasConsumo({
    patrimonioInicial: meta, rentabNominalAnual: inp.rentUso, inflacaoAnual: inp.inflacao,
    taxasConsumo: inp.consumo, anos: Math.max(10, 100 - inp.idade - inp.anos)
  });

  ultimo = {inp, N, meta, fN, cenarios, curvas};
  renderEtapa1Hints();
  renderEtapa2();
  renderEtapa3();
}
/* com dado inválido, os resultados das etapas 2 e 3 ficam esmaecidos (não mostram cálculo antigo) */
function marcarResultados(invalido){
  document.querySelectorAll('#step-2 > *, #step-3 > *').forEach(el=>{
    if(el.classList.contains('nav-row')){ const b = el.querySelector('#btnPdf'); if(b) b.disabled = invalido; return; }
    el.classList.toggle('stale', invalido);
  });
}
const fmtIpca = r => r >= 0 ? 'IPCA + ' + fmtPct(r) : 'IPCA − ' + fmtPct(-r);
let timer;
function agendar(){ clearTimeout(timer); timer = setTimeout(recalcular, 120); }

/* ---------- etapa 1: dicas ---------- */
function renderEtapa1Hints(){
  const {inp} = ultimo;
  $('aporteHint').textContent = inp.reajusteAporte ? 'Valor do 1º ano. Sobe pela inflação uma vez por ano.' : 'Valor fixo todo mês, sem reajuste.';
  $('anosRendaHint').textContent = 'Aos ' + (inp.idade + inp.anos) + ' anos, em ' + (ANO + inp.anos) + '.';
  inp.taxas.forEach((t,i)=>{
    $('tx'+i+'Real').textContent = '≈ ' + fmtIpca(E.taxaRealDeNominal(t, inp.inflacao)) + ' (real)';
  });
}

/* ---------- etapa 2 ---------- */
function renderEtapa2(){
  const {inp, meta} = ultimo;
  const rm = E.taxaMensal(inp.spread);
  $('k_renda').innerHTML = fmtBRL0(inp.renda) + '<span class="unit hoje">HOJE</span>';
  $('k_taxa').textContent = 'IPCA + ' + fmtPct(inp.spread);
  $('k_taxaNom').textContent = fmtPct(E.nominalDeReal(inp.spread, inp.inflacao)) + ' a.a. · real ' + fmtPct(rm, 4) + ' a.m.';
  $('k_meta').textContent = fmtCurto(meta);
  $('k_metaNom').textContent = fmtBRL0(meta) + ' × ' + fmtPct(rm,4) + ' = ' + fmtBRL0(inp.rendaCarteira) + '/mês';
  const extra = $('k_rendaCarteira');
  extra.hidden = !(inp.outrasRendas > 0);
  extra.textContent = inp.outrasRendas >= inp.renda
    ? 'Outras rendas (' + fmtBRL0(inp.outrasRendas) + ') já cobrem a renda desejada.'
    : 'A carteira gera ' + fmtBRL0(inp.rendaCarteira) + '/mês; ' + fmtBRL0(inp.outrasRendas) + ' vêm de outras rendas.';

  $('explainMeta').innerHTML =
    '<p><strong>Como calculamos.</strong> A carteira precisa render pelo menos IPCA + ' + fmtPct(inp.spread) + ' ao ano. Convertendo para taxa mensal equivalente: ' +
    '<span class="f">(1 + ' + fmtPct(inp.spread) + ')^(1/12) − 1 = ' + fmtPct(rm,4) + ' ao mês</span>.</p>' +
    (inp.outrasRendas > 0 ? '<p>Das ' + fmtBRL0(inp.renda) + ' desejadas, ' + fmtBRL0(Math.min(inp.outrasRendas, inp.renda)) + ' vêm de outras rendas (INSS, aluguel, previdência…). A carteira precisa gerar <span class="f">' + fmtBRL0(inp.rendaCarteira) + '/mês</span>.</p>' : '') +
    '<p>O patrimônio necessário é aquele cujo ganho real mensal paga a renda: <span class="f">' + fmtBRL0(inp.rendaCarteira) + ' ÷ ' + fmtPct(rm,4) + ' = ' + fmtBRL0(meta) + '</span> em valores de hoje. ' +
    'Esse é o patrimônio comparado com o patrimônio projetado na etapa de Planejamento.</p>' +
    '<p>Por usar ganho real, esse patrimônio paga a renda corrigida pela inflação sem se desgastar — desde que a carteira de fato renda o percentual acima. Valores antes de IR.</p>';

  renderCurvas();
}

const CORES_CURVA = ['--teal', '--gold', '--red'];
const NOME_TIPO = {
  acumulo: {titulo:'Acúmulo de patrimônio', txt:'Consome menos que o ganho acima da inflação: a carteira continua crescendo além do principal.'},
  perpetuidade: {titulo:'Perpetuidade do patrimônio', txt:'Consome exatamente o ganho acima da inflação: o patrimônio fica estável em poder de compra.'},
  deterioracao: {titulo:'Deterioração do patrimônio', txt:'Consome também a parte do rendimento que repõe a inflação: o principal vai sendo consumido.'}
};
function montarCardsCurvas(){
  const padrao = [5.16, 6, 10];
  $('curveCards').innerHTML = padrao.map((v,i)=>
    '<div class="curve-card" style="--c:var(' + CORES_CURVA[i] + ')">' +
      '<h3 id="cvT'+i+'">Curva ' + (i+1) + '</h3>' +
      '<label for="cons'+i+'" style="display:block;font-size:12px;color:var(--ink-muted);margin-top:6px;">Taxa de consumo</label>' +
      '<div class="row-input"><input type="number" id="cons'+i+'" value="'+v+'" min="0" max="100" step="0.01"><span class="suffix">% a.a.</span></div>' +
      '<p id="cvD'+i+'" style="margin-top:8px;"></p>' +
      '<div class="res" id="cvR'+i+'"></div>' +
    '</div>').join('');
  [0,1,2].forEach(i=>$('cons'+i).addEventListener('input', agendar));
}
function renderCurvas(){
  const {inp, meta, curvas} = ultimo;
  const idadeIni = inp.idade + inp.anos;
  const realRent = E.taxaRealDeNominal(inp.rentUso, inp.inflacao);
  $('rentUsoHint').textContent = 'Com inflação de ' + fmtPct(inp.inflacao,1) + ', o ganho acima da inflação é ' + fmtPct(realRent) + ' a.a. (' + fmtPct(inp.rentUso - inp.inflacao) + ' pela conta simples).';
  const anosVer = Math.min(20, curvas[0].serie.length - 1);
  curvas.forEach((c,i)=>{
    const n = NOME_TIPO[c.tipo];
    $('cvT'+i).textContent = n.titulo;
    $('cvD'+i).textContent = n.txt;
    const fim = c.serie[anosVer];
    const sinal = c.variacaoReal >= 0 ? '+' : '−';
    $('cvR'+i).innerHTML =
      'Renda no 1º ano: ' + fmtBRL0(c.serie[0].retiradaMensalNominal) + '/mês<br>' +
      'Variação real: ' + sinal + fmtPct(Math.abs(c.variacaoReal)) + ' a.a.<br>' +
      'Em ' + anosVer + ' anos: ' + fmtCurto(fim.real) + ' (' + (fim.real >= meta ? '+' : '−') + fmtPct(Math.abs(fim.real/meta - 1), 0) + ')';
  });
  desenharGrafico('chUso', 'ttUso', {
    series: curvas.map((c,i)=>({
      nome: NOME_TIPO[c.tipo].titulo + ' (' + fmtPct(c.taxaConsumo) + ')', cor: cssVar(LINHA[CORES_CURVA[i]]),
      pontos: c.serie.map(p=>({x: idadeIni + p.ano, y: p.real}))
    })),
    xFmt: x => Math.round(x) + ' anos'
  });
  legenda('lgUso', curvas.map((c,i)=>({nome: NOME_TIPO[c.tipo].titulo + ' — consumo de ' + fmtPct(c.taxaConsumo) + ' a.a.', cor: CORES_CURVA[i]})));
}

/* ---------- etapa 3 ---------- */
function textoLiberdade(c, inp){
  const N = c.mesesAteRenda;
  if(c.mesLiberdade === null){
    return '<strong>Não atinge</strong> a liberdade financeira até os 100 anos mantendo esses parâmetros. Aumente o aporte, o prazo ou reveja a renda desejada.';
  }
  const idade = Math.floor(inp.idade + c.mesLiberdade/12);
  if(c.mesLiberdade === 0) return '<strong>Já atingiu</strong> a liberdade financeira com o patrimônio atual.';
  if(c.mesLiberdade <= N){
    const antes = N - c.mesLiberdade;
    return 'Atinge a liberdade em <strong>' + fmtPrazo(c.mesLiberdade) + '</strong>, aos ' + idade + ' anos' + (antes >= 12 ? ' — ' + fmtPrazo(antes) + ' antes do previsto.' : '.');
  }
  const falta = c.mesLiberdade - N;
  return 'Não atinge em ' + fmtAnos(inp.anos) + '. Mantendo os parâmetros, <strong>faltam ' + fmtPrazo(falta) + '</strong>: atinge aos ' + idade + ' anos.';
}

function renderEtapa3(){
  const {inp, meta, cenarios} = ultimo;
  const idadeRenda = inp.idade + inp.anos;
  const totalEntradas = cenarios[0].entradas.reduce((s, e) => s + e.valorNominal, 0);
  $('scenNote').textContent = (totalEntradas > 0 ? 'Inclui ' + fmtBRL0(totalEntradas) + ' em entradas extraordinárias (corrigidas pela inflação até cada data). ' : '') +
    'Patrimônio projetado em ' + (ANO + inp.anos) + ' comparado com o patrimônio necessário para que a carteira, rendendo IPCA + ' +
    fmtPct(inp.spread) + ', pague a renda desejada.';
  $('scenCards').innerHTML = cenarios.map((c, ci)=>{
    const ap = c.aporteNecessario;
    const apTxt = ap === null ? 'inviável' : (ap === 0 ? 'nenhum' : fmtBRL0(ap) + '/mês');
    const apSub = ap === null ? '' : ((ap > inp.aporte ? '+' + fmtBRL0(ap - inp.aporte) + ' sobre o atual' : (ap < inp.aporte ? 'abaixo do atual' : '')) +
      (inp.reajusteAporte && ap > 0 ? (ap !== inp.aporte ? '; ' : '') + 'no 1º ano, reajustado pela inflação' : ''));
    return '<div class="ledger" style="--c:var('+c.cor+')">' +
      '<h3>' + c.nome + '</h3>' +
      '<div class="desc">' + fmtPct(c.taxa,2) + ' a.a. nominal · ' + fmtIpca(E.taxaRealDeNominal(c.taxa, inp.inflacao)) + '</div>' +
      '<span class="status ' + (c.atinge?'ok':'no') + '">' + (c.atinge ? 'Chega na liberdade financeira' : 'Não chega na liberdade financeira') + '</span>' +
      '<div class="lrow hl"><span class="k">Patrimônio projetado aos ' + idadeRenda + '</span><span class="v">' + fmtCurto(c.projetadoNominal) + '</span></div>' +
      '<div class="lrow"><span class="k">Patrimônio necessário</span><span class="v">' + fmtCurto(meta) + '</span></div>' +
      '<div class="lrow"><span class="k">' + (c.atinge ? 'Excedente' : 'Lacuna') + '</span><span class="v" style="color:var(' + (c.atinge?'--ok':'--red') + ')">' + fmtCurto(c.atinge ? c.excedente : c.lacuna) + '</span></div>' +
      '<div class="lrow"><span class="k">Aporte necessário p/ ' + idadeRenda + ' anos</span><span class="v">' + apTxt + (apSub ? '<small>' + apSub + '</small>' : '') + '</span></div>' +
      '<div class="lrow sep"><span class="k">Renda perpétua com esse patrimônio<small>saca só o ganho real; o patrimônio se mantém</small></span><span class="v">' + fmtBRL0(E.rendaPerpetua(c.projetadoNominal, inp.spread)) + '/mês</span></div>' +
      '<div class="lrow"><span class="k">Renda consumindo até os ' + inp.idadeFim + '<small>saques maiores; o patrimônio zera nessa idade</small></span><span class="v">' + fmtBRL0(E.rendaComConsumo(c.projetadoNominal, inp.spread, (inp.idadeFim - idadeRenda) * 12)) + '/mês</span></div>' +
      '<div class="freedom">' + textoLiberdade(c, inp) + '</div>' +
      linhasObjetivos(c, ci) +
    '</div>';
  }).join('');

  desenharPlano();
  renderComparacaoAportes();
}

/* ---------- aportar mais ou render mais? ----------
   Os campos começam com os dados da etapa 1 (A: aporte atual no cenário Otimista;
   B: o dobro do aporte no Conservador; prazo até a renda) e param de acompanhar
   assim que o planejador mexe neles. */
const cmpEditado = {};
function preencherComparacao(inp){
  const padrao = {cmpApA: inp.aporte, cmpApB: inp.aporte * 2, cmpTxA: inp.taxas[2]*100, cmpTxB: inp.taxas[0]*100, cmpAnos: inp.anos};
  Object.keys(padrao).forEach(id=>{
    if(cmpEditado[id]) return;
    if(id.startsWith('cmpAp')) escreverMoeda($(id), padrao[id]); else $(id).value = Math.round(padrao[id]*100)/100;
  });
}
function renderComparacaoAportes(){
  if(!ultimo) return;
  const {inp} = ultimo;
  preencherComparacao(inp);
  const apA = lerMoeda($('cmpApA')), apB = lerMoeda($('cmpApB'));
  const txA = num('cmpTxA')/100, txB = num('cmpTxB')/100, anos = num('cmpAnos');
  const box = $('cmpRes');
  if(!(apA >= 0 && apB >= 0 && (apA > 0 || apB > 0)) || !(txA >= 0 && txA <= 0.5 && txB >= 0 && txB <= 0.5) || !(Number.isInteger(anos) && anos >= 1 && anos <= 80)){
    box.innerHTML = '<p class="hint err">Informe aportes (pelo menos um maior que zero), rentabilidades entre 0% e 50% a.a. e um prazo inteiro entre 1 e 80 anos.</p>';
    return;
  }
  const c = E.compararAportes({aporteMensal: apA, rentabNominalAnual: txA}, {aporteMensal: apB, rentabNominalAnual: txB},
    {meses: anos*12, inflacaoAnual: inp.inflacao, reajusteAporte: inp.reajusteAporte});
  const bloco = (nome, ap, tx, f, vence) => '<div class="cmp-out' + (vence ? ' vence' : '') + '">' +
    '<div class="cmp-tit">' + nome + (vence ? ' <span class="cmp-selo">Chega mais longe</span>' : '') + '</div>' +
    '<div class="cmp-desc">' + fmtBRL0(ap) + '/mês a ' + fmtPct(tx) + ' a.a.</div>' +
    '<div class="lrow"><span class="k">Em ' + fmtAnos(anos) + '</span><span class="v">' + fmtBRL0(f.nominal) + '</span></div>' +
    '<div class="lrow"><span class="k">Em poder de compra de hoje</span><span class="v">' + fmtBRL0(f.real) + '</span></div></div>';
  const nomeMaior = c.maior === 'a' ? 'O plano A' : 'O plano B', nomeMenor = c.maior === 'a' ? 'o plano B' : 'o plano A';
  const doMenor = c.maior === 'a' ? 'do plano B' : 'do plano A';
  const txMenor = c.maior === 'a' ? txB : txA;
  let conclusao = nomeMaior + (c.vezes ? ' termina com ' + c.vezes.toLocaleString('pt-BR', {maximumFractionDigits: 2}) + '× o valor ' + doMenor + '.' : ' é o único com aporte.');
  if(c.taxaEmpate !== null && c.taxaEmpate > txMenor + 1e-6) conclusao += ' Para empatar, ' + nomeMenor + ' precisaria render ' + fmtPct(c.taxaEmpate) + ' a.a.';
  box.innerHTML = '<div class="cmp-grid">' + bloco('Plano A', apA, txA, c.a, c.maior === 'a') + bloco('Plano B', apB, txB, c.b, c.maior === 'b') + '</div>' +
    '<p class="cmp-conc">' + esc(conclusao) + '</p>' +
    '<p class="hint">Só os aportes, partindo do zero, com a inflação de ' + fmtPct(inp.inflacao, 1) + ' a.a.' + (inp.reajusteAporte ? ' e o aporte reajustado pela inflação uma vez por ano' : ' e o aporte fixo') + '. Valores antes de IR. Simulação, não recomendação.</p>';
}

function desenharPlano(){
  if(!ultimo) return;
  const {inp, meta, cenarios, N} = ultimo;
  // horizonte: até 5 anos após a renda, ou até a liberdade mais tardia (limite 100 anos)
  let fim = N + 60;
  cenarios.forEach(c=>{ if(c.mesLiberdade !== null) fim = Math.max(fim, c.mesLiberdade + 24); });
  fim = Math.min(fim, (100 - inp.idade)*12);
  const passo = Math.max(1, Math.round(fim/240));
  const series = cenarios.map(c=>({
    nome: c.nome, cor: cssVar(LINHA[c.cor]),
    pontos: c.serie.filter(p=>p.mes<=fim && (p.mes%passo===0 || p.mes===fim)).map(p=>({x: inp.idade + p.mes/12, y: modoGrafico==='real' ? p.real : p.nominal}))
  }));
  const metaPts = [];
  for(let m=0; m<=fim; m+=passo){ metaPts.push({x: inp.idade + m/12, y: meta}); }
  series.push({nome:'Patrimônio necessário', cor: cssVar('--l-meta'), pontos: metaPts, dash:true});
  desenharGrafico('chPlan', 'ttPlan', {
    series,
    xFmt: x => Math.floor(x) + ' anos',
    vline: {x: inp.idade + inp.anos, rotulo: 'Início da renda'}
  });
  legenda('lgPlan', CENARIOS.map(c=>({nome:c.nome, cor:c.cor})).concat([{nome:'Patrimônio necessário', cor:'--ink-muted', dash:true}]));
}

/* objetivos agrupados por id (várias ocorrências se houver frequência) */
function gruposObjetivos(c){
  const mapa = new Map();
  c.eventos.forEach(e=>{ if(!mapa.has(e.id)) mapa.set(e.id, []); mapa.get(e.id).push(e); });
  return [...mapa.values()];
}
function linhasObjetivos(c, ci){
  const grupos = gruposObjetivos(c);
  if(!grupos.length) return '';
  return '<div class="obj-lines"><div class="t">Objetivos — toque para ver o detalhe</div>' + grupos.map(evs=>{
    const ok = evs.every(e=>e.atingido);
    return '<button type="button" class="obj-line" data-ci="' + ci + '" data-id="' + evs[0].id + '">' +
      '<span>' + esc(evs[0].nome) + (evs.length > 1 ? ' <span style="color:var(--ink-faint)">(' + evs.length + 'x)</span>' : '') + '</span>' +
      '<span class="st ' + (ok ? 'ok' : 'no') + '">' + (ok ? 'Alcançado' : 'Rever planejamento') + '</span></button>';
  }).join('') + '</div>';
}
const dataTxt = m => mesFuturo(m).split('-').reverse().join('/');
function popupObjetivo(ci, id){
  if(!ultimo) return;
  const c = ultimo.cenarios[ci];
  const evs = c.eventos.filter(e=>String(e.id) === String(id));
  if(!evs.length) return;
  const ok = evs.every(e=>e.atingido);
  const nome = esc(evs[0].nome);
  $('modalBox').classList.toggle('ok', ok);
  $('modalTitle').textContent = ok ? 'Objetivo alcançado' : 'Não chega no objetivo';
  $('modalIntro').innerHTML = ok
    ? 'No cenário <strong>' + c.nome + '</strong>, o patrimônio projetado cobre <strong>' + nome + '</strong>' + (evs.length > 1 ? ' em todas as datas' : ' na data escolhida') + '. O valor é corrigido pela inflação até a data e retirado do patrimônio:'
    : 'No cenário <strong>' + c.nome + '</strong>, o patrimônio projetado não cobre <strong>' + nome + '</strong>' + (evs.length > 1 ? ' em todas as datas' : ' na data escolhida') + ':';
  $('modalList').innerHTML = evs.map(e=>{
    const quando = (evs.length > 1 ? e.ocorrencia + 'ª vez, ' : '') + dataTxt(e.mes);
    if(e.atingido){
      return '<li>' + (ok ? '' : '<span class="ok-t">✓</span> ') + '<strong>' + quando + '</strong>: precisa de ' + fmtBRL0(e.valorNominal) +
        ' (' + fmtBRL0(e.valorHoje) + ' hoje); patrimônio projetado ' + fmtBRL0(e.patrimonioNominalAntes) +
        ' — após a compra restam ' + fmtBRL0(e.patrimonioNominalAntes - e.valorNominal) + '.</li>';
    }
    return '<li><span class="no-t">✕</span> <strong>' + quando + '</strong>: precisa de ' + fmtBRL0(e.valorNominal) +
      ' (' + fmtBRL0(e.valorHoje) + ' hoje); patrimônio projetado ' + fmtBRL0(e.patrimonioNominalAntes) +
      ' — faltam ' + fmtBRL0(e.valorNominal - e.patrimonioNominalAntes) + '. Nada é retirado do patrimônio.</li>';
  }).join('');
  $('modalRec').style.display = ok ? 'none' : 'block';
  $('modal').classList.add('open');
  $('modalOk').focus();
}
$('scenCards').addEventListener('click', ev=>{
  const b = ev.target.closest('.obj-line');
  if(b) popupObjetivo(parseInt(b.dataset.ci,10), b.dataset.id);
});
$('modalOk').addEventListener('click', ()=>$('modal').classList.remove('open'));
$('modal').addEventListener('click', e=>{ if(e.target.id==='modal') $('modal').classList.remove('open'); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape') $('modal').classList.remove('open'); });

/* ---------- gráficos (canvas, sem bibliotecas) ---------- */
const LINHA = {'--blue':'--l-roxo', '--gold':'--l-turq', '--teal':'--l-verde', '--red':'--l-red', '--ink-muted':'--l-meta'};
const cssVar = Grafico.cssVar;
function legenda(id, itens){
  $(id).innerHTML = itens.map(i=>'<span class="'+(i.dash?'dash':'')+'" style="--c:var('+(LINHA[i.cor]||i.cor)+')">'+esc(i.nome)+'</span>').join('');
}
/* gráfico de linhas compartilhado (assets/grafico.js); o tooltip mostra o ponto mais próximo de cada série */
const graficos = {};
function desenharGrafico(canvasId, ttId, cfg){
  graficos[canvasId] = {ttId, cfg, geo: Grafico.desenhar($(canvasId), Object.assign({rotuloX: 'idade'}, cfg))};
}
function ligarTooltip(canvasId, ttId){
  Grafico.tooltip($(canvasId), $(ttId), () => {
    const g = graficos[canvasId]; if(!g) return null;
    return {geo: g.geo, html: xv => '<div class="t">' + g.cfg.xFmt(xv) + '</div>' + g.cfg.series.map(s=>{
      let best = s.pontos[0];
      for(const p of s.pontos){ if(Math.abs(p.x-xv) < Math.abs(best.x-xv)) best = p; }
      return '<div class="r"><span style="color:'+s.cor+'">●</span> ' + esc(s.nome) + ': ' + fmtCurto(best.y) + '</div>';
    }).join('')};
  });
}
function redesenhar(){
  Object.keys(graficos).forEach(id=>{ const g = graficos[id]; desenharGrafico(id, g.ttId, g.cfg); });
}

/* ---------- navegação ---------- */
function irPara(n){
  document.querySelectorAll('.step-btn').forEach(b=>b.classList.toggle('active', b.dataset.step==String(n)));
  document.querySelectorAll('.step-panel').forEach(p=>p.classList.toggle('active', p.id==='step-'+n));
  if(ultimo){ if(n===2) renderEtapa2(); if(n===3){ renderEtapa3(); } }
  redesenhar();
  window.scrollTo({top:0, behavior:'smooth'});
}
document.querySelectorAll('.step-btn').forEach(b=>b.addEventListener('click', ()=>irPara(parseInt(b.dataset.step,10))));
document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click', ()=>irPara(parseInt(b.dataset.goto,10))));

/* ---------- relatório em PDF ---------- */
function graficoParaImpressao(){
  // redesenha o gráfico em tema claro para o papel, captura a imagem e restaura o tema
  const temaAnterior = document.documentElement.dataset.theme;
  document.documentElement.dataset.theme = 'light';
  desenharPlano();
  const img = $('chPlan').toDataURL('image/png');
  document.documentElement.dataset.theme = temaAnterior || 'light';
  desenharPlano();
  return img;
}
function gerarPdf(){
  recalcular();
  if(!ultimo){ irPara(1); return; }
  const {inp, meta, cenarios} = ultimo;
  const anoRenda = ANO + inp.anos, idadeRenda = inp.idade + inp.anos;
  const hoje = HOJE.toLocaleDateString('pt-BR');
  const linha = (k, v) => '<tr><td class="k">' + k + '</td><td class="v">' + v + '</td></tr>';
  const semHtml = h => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent; };

  // objetivos informados
  const objsInformados = objetivos.filter(o => o.valorHoje > 0);
  const tabObj = objsInformados.length ? (
    '<h2>Objetivos de vida</h2><table><tr><th>Objetivo</th><th class="n">Valor (hoje)</th><th>Quando</th><th>Frequência</th></tr>' +
    objsInformados.map(o => '<tr><td>' + esc(o.nome || TIPOS[o.tipo].rotulo) + '</td><td class="n">' + fmtBRL0(o.valorHoje) + '</td><td>' +
      esc((o.data || '').split('-').reverse().join('/')) + '</td><td>' + textoFrequencia(LISTAS.obj, o) + '</td></tr>').join('') +
    '</table>'
  ) : '';
  const entsInformadas = entradasExtra.filter(o => o.valorHoje > 0);
  const tabEnt = entsInformadas.length ? (
    '<h2>Entradas extraordinárias</h2><table><tr><th>Entrada</th><th class="n">Valor (hoje)</th><th>Quando</th><th>Frequência</th></tr>' +
    entsInformadas.map(o => '<tr><td>' + esc(o.nome || TIPOS_ENTRADA[o.tipo].rotulo) + '</td><td class="n">' + fmtBRL0(o.valorHoje) + '</td><td>' +
      esc((o.data || '').split('-').reverse().join('/')) + '</td><td>' + textoFrequencia(LISTAS.ent, o) + '</td></tr>').join('') +
    '</table>'
  ) : '';

  // cenários
  const col = f => cenarios.map(c => '<td class="n">' + f(c) + '</td>').join('');
  const objLinhas = (() => {
    const ids = [...new Set(cenarios.flatMap(c => c.eventos.map(e => e.id)))];
    return ids.map(id => {
      const nome = (cenarios.flatMap(c => c.eventos).find(e => e.id === id) || {}).nome || '';
      return '<tr><td>Objetivo: ' + esc(nome) + '</td>' + cenarios.map(c => {
        const evs = c.eventos.filter(e => e.id === id);
        const ok = evs.length && evs.every(e => e.atingido);
        return '<td class="n ' + (ok ? 'ok' : 'no') + '">' + (ok ? 'Alcançado' : 'Rever planejamento') + '</td>';
      }).join('') + '</tr>';
    }).join('');
  })();
  const temFalha = cenarios.some(c => c.eventos.some(e => !e.atingido));

  const tabCen = '<table><tr><th></th>' + cenarios.map(c => '<th class="n">' + c.nome + '</th>').join('') + '</tr>' +
    '<tr><td>Rentabilidade nominal</td>' + col(c => fmtPct(c.taxa) + ' a.a.') + '</tr>' +
    '<tr><td>Situação</td>' + cenarios.map(c => '<td class="n ' + (c.atinge ? 'ok' : 'no') + '">' + (c.atinge ? 'Chega na liberdade' : 'Não chega') + '</td>').join('') + '</tr>' +
    '<tr><td>Patrimônio projetado aos ' + idadeRenda + '</td>' + col(c => fmtBRL0(c.projetadoNominal)) + '</tr>' +
    '<tr><td>Patrimônio necessário</td>' + col(() => fmtBRL0(meta)) + '</tr>' +
    '<tr><td>Lacuna / excedente</td>' + cenarios.map(c => '<td class="n ' + (c.atinge ? 'ok' : 'no') + '">' + (c.atinge ? '+' + fmtBRL0(c.excedente) : '−' + fmtBRL0(c.lacuna)) + '</td>').join('') + '</tr>' +
    '<tr><td>Aporte necessário p/ ' + idadeRenda + ' anos</td>' + col(c => c.aporteNecessario === null ? 'inviável' : (c.aporteNecessario === 0 ? 'nenhum' : fmtBRL0(c.aporteNecessario) + '/mês')) + '</tr>' +
    '<tr><td>Renda perpétua com o patrimônio projetado</td>' + col(c => fmtBRL0(E.rendaPerpetua(c.projetadoNominal, inp.spread)) + '/mês') + '</tr>' +
    '<tr><td>Renda consumindo o patrimônio até os ' + inp.idadeFim + ' anos</td>' + col(c => fmtBRL0(E.rendaComConsumo(c.projetadoNominal, inp.spread, (inp.idadeFim - idadeRenda) * 12)) + '/mês') + '</tr>' +
    objLinhas + '</table>' +
    '<table style="margin-top:6px">' + cenarios.map(c => '<tr><td class="k" style="width:18%"><strong>' + c.nome + '</strong></td><td>' + esc(semHtml(textoLiberdade(c, inp))) + '</td></tr>').join('') + '</table>' +
    (temFalha ? '<p class="pr-note no">Objetivo com "Rever planejamento": reveja o valor e o prazo, ou avalie consórcio e financiamento para esse objetivo.</p>' : '');

  const img = graficoParaImpressao();
  const legenda = CENARIOS.map(c => '<span><i style="background:' + ({'--blue':'#49479D','--gold':'#00AE9D','--teal':'#7DB61C'})[c.cor] + '"></i>' + c.nome + '</span>').join('') +
    '<span><i style="background:repeating-linear-gradient(90deg,#003641 0 4px,transparent 4px 7px)"></i>Patrimônio necessário</span>';

  $('printArea').innerHTML =
    '<div class="pr-badge">SIMULAÇÃO — NÃO É EXTRATO NEM PROMESSA DE RENTABILIDADE</div>' +
    '<h1>Planejamento Financeiro</h1><div class="pr-sub">Simulação gerada em ' + hoje + ' · valores antes de IR</div>' +

    '<div class="bloco"><h2>Dados informados</h2><table>' +
      linha('Idade atual', inp.idade + ' anos') +
      linha('Patrimônio investido hoje', fmtBRL(inp.patrimonio)) +
      linha('Aporte mensal', fmtBRL(inp.aporte)) +
      (inp.reajusteAporte ? linha('Reajuste do aporte', 'Pela inflação, uma vez por ano') : '') +
      linha('Renda mensal desejada', fmtBRL(inp.renda)) +
      (inp.outrasRendas > 0 ? linha('Outras rendas mensais', fmtBRL(inp.outrasRendas)) + linha('Renda gerada pela carteira', fmtBRL(inp.rendaCarteira)) : '') +
      linha('Início da renda', 'daqui a ' + fmtAnos(inp.anos) + ' — aos ' + idadeRenda + ' anos, em ' + anoRenda) +
      linha('Inflação média prevista', fmtPct(inp.inflacao) + ' a.a.') +
      linha('Rentabilidade Base Mínima', 'IPCA + ' + fmtPct(inp.spread) + ' a.a.') +
      linha('Renda consumindo o patrimônio até', inp.idadeFim + ' anos') +
      linha('Rentabilidade nominal dos cenários', cenarios.map(c => c.nome + ' ' + fmtPct(c.taxa)).join(' · ')) +
    '</table></div>' +

    tabObj +
    tabEnt +

    '<div class="bloco"><h2>Planejamento por cenário</h2>' + tabCen + '</div>' +

    '<div class="bloco"><h2>Evolução do patrimônio</h2><img class="pr-chart" src="' + img + '" alt="Gráfico da evolução do patrimônio por cenário"><div class="pr-legend">' + legenda + '</div></div>' +

    '<div class="pr-aviso"><strong>Aviso:</strong> este documento é uma <strong>simulação</strong> gerada com base nos parâmetros informados (idade, patrimônio, aporte, renda desejada, taxas, inflação e prazos). ' +
      'Os valores apresentados <strong>podem se alterar</strong> e não representam a realidade garantida do investimento nem constituem previsão: rentabilidade e inflação reais variam ao longo do tempo, e o resultado efetivo pode ser diferente do projetado. ' +
      'Rentabilidade passada não representa garantia de rentabilidade futura. Todo investimento envolve riscos e pode resultar em perdas do capital investido.</div>' +
    '<div class="pr-footer">' + [...document.querySelectorAll('footer p')].map(p => '<p>' + esc(p.textContent) + '</p>').join('') + '</div>';

  setTimeout(() => window.print(), 120);
}
$('btnPdf').addEventListener('click', gerarPdf);

/* ---------- tema ---------- */
Tema.ligarBotao($('btnTema'), ()=> setTimeout(()=>{ if(ultimo){ renderEtapa2(); desenharPlano(); } }, 30));
let rz; window.addEventListener('resize', ()=>{ clearTimeout(rz); rz = setTimeout(redesenhar, 150); });

/* ---------- inicialização ---------- */
document.querySelectorAll('.money').forEach(mascara);
['idade','patrimonio','aporte','renda','outrasRendas','idadeFim','anosRenda','inflacao','spread','tx0','tx1','tx2'].forEach(id=>$(id).addEventListener('input', agendar));
$('rentUso').addEventListener('input', agendar);
$('reajusteAporte').addEventListener('change', recalcular);
['cmpApA','cmpApB','cmpTxA','cmpTxB','cmpAnos'].forEach(id=>$(id).addEventListener('input', ()=>{ cmpEditado[id] = true; renderComparacaoAportes(); }));
ligarTooltip('chUso', 'ttUso'); ligarTooltip('chPlan', 'ttPlan');
montarCardsCurvas();
['obj','ent'].forEach(l=>{ renderChips(l); renderLista(l); });
recalcular();
})();
