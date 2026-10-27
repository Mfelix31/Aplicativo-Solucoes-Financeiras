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
const {brl0: fmtBRL0, pct: fmtPct, curto: fmtCurto, anos: fmtAnos, esc, lerMoeda, moeda, mascara} = Formato;
const num = id => { const v = parseFloat($(id).value); return isNaN(v) ? NaN : v; };
const money = id => lerMoeda($(id));
const pctCampo = id => num(id) / 100;
const linha = (k, v, cls) => '<div class="lrow"><span class="k">' + k + '</span><span class="v' + (cls ? ' ' + cls : '') + '">' + v + '</span></div>';
const cssVar = Grafico.cssVar;
const semHtml = s => String(s).replace(/<[^>]+>/g, '');
const pct0 = v => fmtPct(v, 0);
const pct1 = v => fmtPct(v, 1);

/* =========================================================================
 * 2. Constantes da página
 * ========================================================================= */
const CAM = {
  inventario: {nome:'Só o inventário', cor:'--ink-faint', hex:'#4F7178', desc:'Nada muda hoje: a família paga o inventário com o próprio patrimônio, que fica travado até a partilha.'},
  previdencia: {nome:'Previdência', cor:'--l-turq', hex:'#00AE9D', desc:'Parte das aplicações vai para um VGBL com os herdeiros como beneficiários: o saldo chega em dias, fora do inventário e sem ITCMD.'},
  seguro: {nome:'Whole life', cor:'--l-roxo', hex:'#49479D', desc:'Seguro vitalício pago em 10 anos: o capital chega aos beneficiários fora do inventário, sem ITCMD e sem IR.'},
  combinado: {nome:'Previdência + whole life', cor:'--blue-dim', hex:'#8E8CD6', desc:'As aplicações não bastam para a previdência pagar o inventário sozinha; o seguro cobre o que falta.'},
  doacao: {nome:'Doação com usufruto', cor:'--l-verde', hex:'#7DB61C', desc:'Os imóveis são doados em vida com reserva de usufruto (o cooperado continua usando e recebendo a renda); a liquidez cobre o restante.'},
  holdingTotal: {nome:'Holding — doação total', cor:'--gold', hex:'#007A73', desc:'Imóveis integralizados numa empresa; todas as cotas doadas já, com usufruto. Tem custo de abertura e de manutenção.'},
  holdingGradual: {nome:'Holding — doação gradual', cor:'--hl', hex:'#C9D200', desc:'Mesma empresa, mas as cotas são doadas aos poucos; enquanto não forem doadas, vão a inventário.'},
  offshore: {nome:'Offshore', cor:'--teal', hex:'#437526', desc:'Bens no exterior numa empresa offshore: evita inventário e imposto sucessório no país dos bens. Paga IR de 15% ao ano (Lei 14.754/2023).'}
};
const HIP = { proximo: 'No próximo ano', dez: 'Em 10 anos', expectativa: 'Na expectativa de vida' };
const PRAZO_INV = { cartorio: '30 a 90 dias', judicial: '1 a 3 anos', litigio: '3 anos ou mais' };
const MOTIVO_HOLDING = {
  numeros: m => '<b>Os números não favorecem:</b> ' + CAM[m.vencedor].nome + ' entrega ' + fmtBRL0(m.diferenca) + ' a mais à família (R$ de hoje).',
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

/* =========================================================================
 * 4. Entradas
 * ========================================================================= */
function lerEntradas(){
  return {
    idade: num('idade'), uf: $('uf').value, herdeiros: num('herdeiros'), meacaoPct: pctCampo('meacao'), tipoInventario: $('tipoInv').value,
    regime: seg.regime,
    imoveis: money('imoveis'), nImoveis: num('nImoveis') || 0, aplicacoes: money('aplicacoes'), empresa: money('empresa'), exterior: money('exterior'),
    previdencia: money('previdencia'), previdenciaAportado: money('previdencia') > 0 ? Math.min(money('prevAportado') || money('previdencia'), money('previdencia')) : 0,
    previdenciaAnos: num('prevAnos') || 0, seguroExistente: money('seguroExist'),
    rendaMensal: money('rendaMensal'), outrasRendasMensais: money('outrasRendas'),
    aluguelMensal: money('aluguel'), deducoesAluguelMensal: money('dedAluguel'), nImoveisAlugados: num('nAlugados') || 0, nResidenciais: num('nResid') || 0,
    doacaoCustoPct: pctCampo('dCusto'),
    premissas: { rentabilidade: pctCampo('rentab'), ipca: pctCampo('ipca'), metaLiquidez: pctCampo('meta'), irAplicacoes: pctCampo('irAplic'),
      margemEmpate: pctCampo('margem'), taxaAdmPrevidencia: pctCampo('taxaAdm'), rentabilidadeBruta: $('rentBruta').checked, anoInicial: HOJE.getFullYear() },
    custos: { honorarios: { cartorio: pctCampo('honCart'), judicial: pctCampo('honJud'), litigio: pctCampo('honLit') },
      escrituraPct: pctCampo('escPct'), custasPct: pctCampo('custasPct'), registroPct: pctCampo('regPct'), certidoes: money('certidoes'), multaPctImposto: pctCampo('multa') },
    holding: { juridicoPct: pctCampo('hJur'), juridicoMin: money('hJurMin'), cartorioPct: pctCampo('hCart'), itbiPct: pctCampo('hItbi'), laudo: money('hLaudo'),
      contabilMensal: money('hContab'), anosDoacaoGradual: num('hAnos') || 10, incluirEmpresa: $('hEmpresa').checked },
    aluguelOpcoes: { lc224: $('hLc224').checked, opcao487: $('h487').checked, aliqRefIVA: pctCampo('hIva') },
    wholeLife: { parcelaPor100k: money('wlParcela'), basicaPor100k: money('wlBasica'), ganhoReal: pctCampo('wlGanho') },
    offshore: { limiar: money('oLimiar'), abertura: money('oAbertura'), manutencaoAnual: money('oManut'),
      custoSucessaoExteriorPct: pctCampo('oCustoExt'), impostoExteriorPct: pctCampo('oImpExt') },
    sinais: { incapaz: $('sinIncapaz').checked, conflito: $('sinConflito').checked, empresa: $('sinEmpresa').checked }
  };
}

/** erros de campo que o motor não vê (campos numéricos vazios ou fora do intervalo) */
function errosDeCampo(inp){
  const e = [];
  const campos = [['rentab','Rentabilidade'],['ipca','Inflação'],['meta','Meta de liquidez'],['honCart','Honorários'],['hJur','Jurídico da holding']];
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
  const r = errosCampo.length ? { ok: false, erros: errosCampo } : E.analisar(inp);
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
  renderResultados();
}

/* =========================================================================
 * 7. Resultados
 * ========================================================================= */
const venc = r => r.caminhos.find(c => c.id === r.recomendacao.vencedor);
const valorEm = (c, h) => c.em[h].familiaReal;
const hipRotulo = (r, h) => h === 'expectativa' ? HIP.expectativa + ' (' + fmtAnos(r.Texp) + ', aos ' + Math.round(r.entrada.idade + r.Texp) + ')' : HIP[h];

/** o que o caminho pede hoje, em uma frase por item */
function comoFazer(c, r){
  const e = r.entrada, itens = [];
  if(c.cfg.X > 0) itens.push('levar ' + fmtBRL0(c.cfg.X) + ' das aplicações para previdência (VGBL), herdeiros como beneficiários');
  if(c.cfg.C > 0){
    const p = e.wholeLife.parcelaPor100k * c.cfg.C / 100000;
    itens.push('contratar whole life de ' + fmtBRL0(c.cfg.C) + ' (parcela inicial ' + fmtBRL0(p) + '/mês por 10 anos)');
  }
  if(c.cfg.doaImoveis) itens.push('doar os imóveis com usufruto (ITCMD e escritura: ' + fmtBRL0(c.sim.custoEstruturacao) + ' hoje)');
  if(c.cfg.holding === 'total') itens.push('abrir a holding e doar todas as cotas com usufruto (' + fmtBRL0(c.sim.custoEstruturacao) + ' hoje, mais ' + fmtBRL0(e.holding.contabilMensal * 12) + '/ano)');
  if(c.cfg.holding === 'gradual') itens.push('abrir a holding (' + fmtBRL0(c.sim.custoEstruturacao) + ' hoje) e doar as cotas em ' + fmtAnos(e.holding.anosDoacaoGradual));
  if(c.cfg.offshore) itens.push('estruturar a offshore para os bens no exterior');
  if(!itens.length) itens.push('nada a fazer hoje');
  return itens;
}

function renderVerdict(){
  const {r} = ultimo, rec = r.recomendacao, v = venc(r), inv = r.caminhos.find(c => c.id === 'inventario');
  if(!v){
    $('verdict').innerHTML = '<p class="headline">Nenhum caminho paga o inventário desde já com os recursos informados</p><p>Revise as aplicações disponíveis ou a meta de liquidez.</p>';
    return;
  }
  const ganho = valorEm(v, 'expectativa') - valorEm(inv, 'expectativa');
  const p = [];
  p.push('Entre os caminhos que pagam o inventário inteiro desde o primeiro ano, é o que mais entrega à família na expectativa de vida: <b>' + fmtBRL0(valorEm(v, 'expectativa')) + '</b> em R$ de hoje' +
    (v.id !== 'inventario' ? ', <b>' + fmtBRL0(ganho) + ' a mais</b> que deixar tudo para o inventário.' : '.'));
  if(rec.porSimplicidade){
    const m = r.caminhos.find(c => c.id === rec.maiorValor);
    p.push(CAM[m.id].nome + ' entregaria ' + fmtBRL0(valorEm(m, 'expectativa') - valorEm(v, 'expectativa')) + ' a mais, menos de ' + pct0(r.entrada.premissas.margemEmpate) + ' de diferença: fica o caminho mais simples.');
  }
  p.push('<b>O que fazer:</b> ' + comoFazer(v, r).join('; ') + '.');
  const est = r.estabilidade, avisos = [];
  if(est.proximo) avisos.push('se o falecimento ocorrer no próximo ano, ' + CAM[est.proximo].nome + ' entregaria mais');
  if(est.dez) avisos.push('em 10 anos, ' + CAM[est.dez].nome + ' entregaria mais');
  if(est.estresse) avisos.push('se o ITCMD dobrar (estresse de 16%), ' + CAM[est.estresse].nome + ' passaria à frente');
  p.push(avisos.length ? '<b>Atenção:</b> ' + avisos.join('; ') + '.' : 'A recomendação se mantém nas três hipóteses de falecimento e no estresse do ITCMD.');
  $('verdict').innerHTML = '<p class="headline">Recomendado: ' + CAM[v.id].nome + '</p>' + p.map(x => '<p>' + x + '</p>').join('');
}

function renderDestaques(){
  const {r} = ultimo, h = r.holding, out = [];
  if(h.aplicavel){
    if(h.recomendada) out.push('<div class="destaque" style="--cl:var(--l-verde)"><h4>Holding recomendada</h4><p>Neste caso a holding entrega mais à família do que a alternativa simples, mesmo com os custos de abrir e manter.</p></div>');
    else out.push('<div class="destaque" style="--cl:var(--hl)"><h4>Holding não recomendada</h4>' + h.motivos.map(m => '<p>' + MOTIVO_HOLDING[m.id](m) + '</p>').join('') +
      '<div class="big">' + fmtBRL0(h.custoEvitado) + '</div><p>de custo evitado: abertura e manutenção até a expectativa de vida, em R$ de hoje.</p></div>');
  }
  const v = venc(r);
  if(r.seguroDesnecessario && v && v.id !== 'seguro'){
    out.push('<div class="destaque" style="--cl:var(--l-roxo)"><h4>Whole life não é necessário para o inventário</h4><p>A previdência com ' + fmtBRL0(r.previdencia.X) + ' das aplicações já paga a meta de liquidez sozinha, em todos os anos. O seguro só faria sentido por outro motivo (por exemplo, proteger a renda da família).</p></div>');
  } else if(!r.seguroDesnecessario){
    out.push('<div class="destaque" style="--cl:var(--l-roxo)"><h4>As aplicações não bastam para a previdência</h4><p>Mesmo levando todas as aplicações (' + fmtBRL0(r.previdencia.disponivel) + ') para a previdência, falta liquidez para o inventário. O whole life cobre a diferença.</p></div>');
  }
  $('destaques').innerHTML = out.join('');
}

function renderBase(){
  const {r} = ultimo, b = r.base, e = r.entrada;
  const total = e.imoveis + e.aplicacoes + e.empresa + e.exterior;
  $('baseSub').textContent = 'Se o falecimento fosse hoje, sem nenhum planejamento: ' + fmtBRL0(total) + ' iriam a inventário em ' + T.ESTADOS[e.uf].nome + ', ' + ({cartorio:'em cartório', judicial:'na Justiça', litigio:'na Justiça, com conflito'})[e.tipoInventario] + '.';
  $('baseCards').innerHTML =
    '<div class="eq-card"><div class="k">Meta de liquidez (' + pct0(e.premissas.metaLiquidez) + ')</div><div class="v">' + fmtBRL0(b.metaHoje) + '</div><div class="s">O que previdência ou seguro precisam pagar, sozinhos.</div></div>' +
    '<div class="eq-card"><div class="k">Estimativa por componentes</div><div class="v">' + fmtBRL0(b.custoHoje.total) + '</div><div class="s">' + pct1(b.custoHoje.pct) + ' do patrimônio que vai a inventário.</div></div>' +
    '<div class="eq-card"><div class="k">Tempo com os bens travados</div><div class="v">' + PRAZO_INV[e.tipoInventario] + '</div><div class="s">Previdência e seguro chegam em dias.</div></div>';
  const rg = b.regimes, linhaT = (k, f) => '<tr><td>' + k + '</td>' + ['vigente','reforma','estresse'].map(x => '<td>' + fmtBRL0(f(rg[x])) + '</td>').join('') + '</tr>';
  $('tabInventario').innerHTML = '<tr><th>Componente</th><th>Lei vigente</th><th>Adequação à reforma</th><th>Estresse 16%</th></tr>' +
    linhaT('ITCMD (por quinhão)', c => c.itcmd) + linhaT('Honorários', c => c.honorarios) +
    linhaT(e.tipoInventario === 'cartorio' ? 'Escritura' : 'Custas judiciais', c => c.cartorio) + linhaT('Registro dos imóveis', c => c.registro) +
    linhaT('Certidões', c => c.certidoes) + (e.custos.multaPctImposto > 0 ? linhaT('Multa por atraso', c => c.multa) : '') +
    '<tr class="now"><td>Total</td>' + ['vigente','reforma','estresse'].map(x => '<td>' + fmtBRL0(rg[x].total) + ' <small class="suave inline">(' + pct1(rg[x].pct) + ')</small></td>').join('') + '</tr>';
  $('baseNota').textContent = 'A meta de ' + pct0(e.premissas.metaLiquidez) + ' é maior que a estimativa porque cobre o que ela deixa de fora: inventário judicial, multas, avaliações e o tempo com bens travados. ' +
    (T.ESTADOS[e.uf].reformaIgualVigente ? '' : 'Adequação à reforma: ' + T.ESTADOS[e.uf].reforma.hipotese);
}

function renderCards(){
  const {r} = ultimo, e = r.entrada, rec = r.recomendacao;
  const aptos = r.caminhos.filter(c => c.protegeJa && !c.faltaRecurso);
  const melhor = h => Math.max(...aptos.map(c => valorEm(c, h)));
  $('cardsSub').textContent = 'Valor que chega à família, em R$ de hoje, conforme o momento do falecimento. Só concorrem os caminhos que pagam o inventário desde o primeiro ano.';
  const liquidezPrazo = c => (c.cfg.X > 0 || c.cfg.C > 0 || e.previdencia > 0 || e.seguroExistente > 0) ? 'dias (liquidez) · ' + PRAZO_INV[e.tipoInventario] + ' (inventário)' : PRAZO_INV[e.tipoInventario];
  $('cards').innerHTML = r.caminhos.map(c => {
    const nome = CAM[c.id], ehVenc = c.id === rec.vencedor, apto = c.protegeJa && !c.faltaRecurso;
    const badges = [];
    badges.push(apto ? '<span class="status ok">Paga o inventário desde já</span>' : '<span class="status no">' + (c.faltaRecurso ? 'Faltam recursos' : 'Não cobre no 1º ano (' + pct0(Math.min(c.coberturaAno1, 9.99)) + ')') + '</span>');
    if(rec.porSimplicidade && c.id === rec.maiorValor) badges.push('<span class="status neutral">Maior valor</span>');
    const hip = ['proximo','dez','expectativa'].map(h => '<span>' + (h === 'expectativa' ? 'Expectativa (' + Math.round(e.idade + r.Texp) + ' anos)' : HIP[h]) + '</span><span class="' + (apto && Math.abs(valorEm(c, h) - melhor(h)) < 1 ? 'win' : '') + '">' + fmtBRL0(valorEm(c, h)) + '</span>').join('');
    const ex = c.em.expectativa;
    return '<div class="ledger' + (ehVenc ? ' best' : '') + (apto ? '' : ' inapto') + '" style="--cl:var(' + nome.cor + '); --cl-t:var(--ink)">' +
      (ehVenc ? '<span class="best-tag">RECOMENDADO</span>' : '') +
      '<h3><span class="dot" style="--c:var(' + nome.cor + ')"></span>' + nome.nome + '</h3>' +
      '<div class="badges">' + badges.join('') + '</div>' +
      '<div class="desc">' + nome.desc + '</div>' +
      '<div class="hip">' + hip + '</div>' +
      linha('Cobertura do inventário no 1º ano', isFinite(c.coberturaAno1) ? pct0(c.coberturaAno1) : '—', apto ? 'ok-t' : 'no-t') +
      linha('Menor cobertura no período', isFinite(c.coberturaMin) ? pct0(c.coberturaMin) : '—') +
      linha('Patrimônio no inventário', pct0(ex.travado)) +
      linha('Prazo para a família', liquidezPrazo(c)) +
      linha('Custo de estruturação hoje', fmtBRL0(c.sim.custoEstruturacao)) +
      linha('Custos até a expectativa', fmtBRL0(ex.custosReais) + '<small>R$ de hoje, com parcelas e manutenção</small>') +
      '<div class="como"><b>O que fazer:</b> ' + comoFazer(c, r).join('; ') + '.</div>' +
    '</div>';
  }).join('');
}

function renderSeguro(){
  const {r} = ultimo, s = r.seguro;
  $('blocoSeguro').hidden = !s;
  if(!s) return;
  const e = r.entrada;
  const cabe = v => v === null ? '' : ' · ' + pct1(v) + ' da renda';
  $('seguroCards').innerHTML =
    '<div class="eq-card"><div class="k">Capital segurado (' + CAM[s.caminho].nome + ')</div><div class="v">' + fmtBRL0(s.capital) + '</div><div class="s">Corrigido a IPCA + ' + fmtPct(e.wholeLife.ganhoReal, 1) + ' ao ano, vitalício.</div></div>' +
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
  if(v && (v.cfg.X > 0 || e.previdencia > 0)){
    const prev = e.previdencia + (v.cfg.X || 0);
    out.push('<b>Previdência e legítima:</b> metade do patrimônio é dos herdeiros necessários (Código Civil, art. 1.846). Previdência com beneficiários diferentes dos herdeiros, ou aportes grandes perto do falecimento, pode ser questionada.' +
      (prev > total * 0.5 ? ' <b>Aqui a previdência passaria de 50% do patrimônio.</b>' : ''));
  }
  if(r.caminhos.some(c => c.cfg.doaImoveis || c.cfg.holding)) out.push('<b>Doação a filhos é adiantamento da herança</b> (CC, arts. 544 e 2.002) e vai à colação, salvo se sair da parte disponível; a parte que passa da disponível é nula (art. 549). Cláusulas de inalienabilidade sobre a legítima exigem justa causa (art. 1.848).');
  if(s.incapaz) out.push('<b>Herdeiro menor ou incapaz:</b> o inventário em cartório só é possível nas condições da Res. CNJ 571/2024 (parte ideal em cada bem e concordância do Ministério Público); senão, é judicial.');
  if(s.conflito) out.push('<b>Risco de conflito:</b> testamento e regras de governança reduzem disputas. Uma holding com acordo de sócios pode compensar mesmo sem vencer nos números; avalie com advogado.');
  if(s.empresa) out.push('<b>Empresa operacional:</b> a sucessão da gestão (quem decide) costuma pesar mais que o imposto. Holding com governança pode se justificar por esse motivo.');
  if(e.aluguelMensal > 0) out.push('<b>ITBI:</b> holding com atividade imobiliária preponderante (locação) não tem a imunidade do ITBI na integralização; e a imunidade não alcança o valor acima do capital (STF, Tema 796).');
  if(e.uf === 'MS') out.push('<b>MS ainda não adotou o ITCMD progressivo</b> exigido pela LC 227/2026. Enquanto a lei não muda, doar custa 3% contra 6% na herança; uma lei nova só vale no ano seguinte e após 90 dias.');
  if(e.uf === 'RO') out.push('<b>RO aplica a alíquota da faixa sobre o quinhão inteiro;</b> a LC 227/2026 exige faixas sucessivas. Pode haver discussão sobre qual regra prevalece.');
  if(e.uf === 'PA') out.push('<b>PA:</b> a lei aplica as faixas de forma sucessiva (art. 8º, § 1º), mas há quem leia de outro modo; confirme o cálculo com a Sefa-PA.');
  if(r.caminhos.some(c => c.cfg.C > 0)) out.push('<b>Whole life:</b> a contratação depende de declaração de saúde e análise da seguradora; a parcela usada é a média da planilha Sicoob.');
  if(e.exterior > 0) out.push('<b>Bens no exterior:</b> desde 2026 pagam ITCMD no estado de domicílio (LC 227/2026) e os rendimentos pagam IR de 15% ao ano (Lei 14.754/2023).');
  out.push('<b>Testamento</b> organiza a parte disponível e reduz conflitos em qualquer caminho; não evita o inventário.');
  out.push('<b>Imposto da herança é o da data do falecimento; o da doação, o da data da doação</b> (LC 227/2026, art. 156, § 1º). Quem antecipa trava a regra de hoje.');
  $('alertas').innerHTML = out.map(x => '<li>' + x + '</li>').join('');
}

function renderFontes(){
  const {r} = ultimo, est = T.ESTADOS[r.entrada.uf];
  $('fontes').innerHTML = '<h3>Premissas e fontes</h3><ul>' + [
    'ITCMD de ' + est.nome + ': ' + est.lei + ' (referência ' + est.dataRef.split('-').reverse().join('/') + '; ' + est.unidade.nome + (est.unidade.valor !== 1 ? ' = R$ ' + est.unidade.valor.toLocaleString('pt-BR', {maximumFractionDigits:4}) : '') + '). Normas gerais: LC 227/2026.',
    'Honorários: ' + E.honorariosPadrao(r.entrada.uf).fonte,
    'Expectativa de vida: IBGE, Tábua Completa de Mortalidade 2024 (ambos os sexos).',
    'Whole life: média da planilha "Sicoob - Seguro Whole Life" (R$ ' + r.entrada.wholeLife.parcelaPor100k.toLocaleString('pt-BR', {minimumFractionDigits:2}) + '/mês por R$ 100 mil).',
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
function caminhosComLiquidez(r){ return r.caminhos.filter(c => c.id !== 'inventario'); }

function renderSegGrafico(){
  const {r} = ultimo, lista = caminhosComLiquidez(r);
  if(!lista.some(c => c.id === seg.grafico)) seg.grafico = (venc(r) && venc(r).id !== 'inventario') ? venc(r).id : lista[0].id;
  $('segGrafico').innerHTML = lista.map(c => '<button type="button" data-v="' + c.id + '"' + (c.id === seg.grafico ? ' class="active"' : '') + '>' + CAM[c.id].nome + '</button>').join('');
}

function seriesGrafico(){
  const {r} = ultimo, c = r.caminhos.find(x => x.id === seg.grafico), idade = r.entrada.idade;
  const pts = f => [{ x: idade, y: f(null) }].filter(p => p.y !== null).concat(c.sim.anos.map(a => ({ x: idade + a.ano, y: f(a) })));
  const s = [
    { nome: 'Meta de liquidez (' + pct0(r.entrada.premissas.metaLiquidez) + ' do que vai a inventário)', cor: cssVar('--l-meta'), dash: true, pontos: pts(a => a ? a.meta : null) },
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
  $('chartSub').textContent = CAM[c.id].nome + ': cobertura de ' + pct0(c.coberturaAno1) + ' no 1º ano e no mínimo ' + pct0(c.coberturaMin) + ' até ' + Math.round(r.entrada.idade + r.H) + ' anos. Valores nominais.';
}

function ligarTooltip(){
  Grafico.tooltip($('ch'), $('tt'), () => {
    if(!ultimo || !geo) return null;
    const {r} = ultimo, c = r.caminhos.find(x => x.id === seg.grafico), idade = r.entrada.idade;
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

function gerarPdf(){
  recalcular();
  if(!ultimo) return;
  const {r} = ultimo, e = r.entrada;
  const tr = (k, val) => '<tr><td class="k">' + k + '</td><td class="v">' + val + '</td></tr>';
  const dados = tr('Idade · estado · herdeiros', e.idade + ' anos · ' + T.ESTADOS[e.uf].nome + ' · ' + e.herdeiros) +
    tr('Imóveis · aplicações', fmtBRL0(e.imoveis) + ' · ' + fmtBRL0(e.aplicacoes)) +
    (e.empresa ? tr('Participações em empresas', fmtBRL0(e.empresa)) : '') + (e.exterior ? tr('Bens no exterior', fmtBRL0(e.exterior)) : '') +
    (e.previdencia ? tr('Previdência existente', fmtBRL0(e.previdencia)) : '') + (e.seguroExistente ? tr('Seguro existente', fmtBRL0(e.seguroExistente)) : '') +
    (e.aluguelMensal ? tr('Aluguéis', fmtBRL0(e.aluguelMensal) + '/mês') : '') +
    tr('Premissas', 'rentabilidade ' + fmtPct(e.premissas.rentabilidade, 1) + ' a.a. · IPCA ' + fmtPct(e.premissas.ipca, 1) + ' · meta de liquidez ' + pct0(e.premissas.metaLiquidez) + ' · ITCMD ' + ({vigente:'lei vigente', reforma:'adequação à reforma', estresse:'estresse 16%'})[e.regime]);
  const comp = '<table><tr><th>Caminho</th><th class="n">Próximo ano</th><th class="n">Em 10 anos</th><th class="n">Expectativa</th><th class="n">Cobertura 1º ano</th></tr>' +
    r.caminhos.map(c => '<tr><td>' + CAM[c.id].nome + (c.id === r.recomendacao.vencedor ? ' <span class="ok">(recomendado)</span>' : '') + '</td>' +
      ['proximo','dez','expectativa'].map(h => '<td class="n">' + fmtBRL0(valorEm(c, h)) + '</td>').join('') +
      '<td class="n ' + (c.protegeJa ? 'ok' : 'no') + '">' + (isFinite(c.coberturaAno1) ? pct0(Math.min(c.coberturaAno1, 9.99)) : '—') + '</td></tr>').join('') + '</table>';
  const b = r.base;
  const inv = '<table>' + tr('Meta de liquidez', fmtBRL0(b.metaHoje)) + tr('Estimativa por componentes (lei vigente)', fmtBRL0(b.regimes.vigente.total) + ' (' + pct1(b.regimes.vigente.pct) + ')') +
    tr('Com a adequação à reforma · estresse 16%', fmtBRL0(b.regimes.reforma.total) + ' · ' + fmtBRL0(b.regimes.estresse.total)) + '</table>';
  const destaques = semHtml($('destaques').innerHTML.replace(/<\/(p|h4|div)>/g, ' ')).replace(/\s+/g, ' ').trim();
  const img = graficoParaImpressao();
  const seguro = r.seguro ? '<div class="bloco"><h2>Whole life</h2><table>' + tr('Capital', fmtBRL0(r.seguro.capital)) +
    tr('Parcela 1º ano · 10º ano', fmtBRL0(r.seguro.parcelaInicial) + ' · ' + fmtBRL0(r.seguro.parcela10) + ' por mês') + tr('Desembolso em 10 anos', fmtBRL0(r.seguro.desembolso)) +
    tr('Aplicação alcança o capital aos (8% · 10% · 12%)', r.seguro.equilibrio.map(q => q.ano ? Math.round(e.idade + q.ano) + ' anos' : 'não alcança').join(' · ')) + '</table></div>' : '';
  $('printArea').innerHTML =
    '<div class="pr-badge">SIMULAÇÃO — NÃO É CONSULTORIA JURÍDICA, TRIBUTÁRIA OU DE SEGUROS</div>' +
    '<h1>Planejamento Sucessório</h1><div class="pr-sub">Simulação gerada em ' + HOJE.toLocaleDateString('pt-BR') + ' · previdência × whole life × doação × holding' + (r.caminhos.some(c => c.id === 'offshore') ? ' × offshore' : '') + '</div>' +
    '<div class="bloco"><h2>Conclusão</h2><div class="pr-concl">' + $('verdict').innerHTML + (destaques ? '<p>' + esc(destaques) + '</p>' : '') + '</div></div>' +
    '<div class="bloco"><h2>Dados informados</h2><table>' + dados + '</table></div>' +
    '<div class="bloco"><h2>O custo de não planejar</h2>' + inv + '</div>' +
    '<div class="bloco"><h2>Valor que chega à família (R$ de hoje) por momento do falecimento</h2>' + comp + '<p class="pr-note">Expectativa de vida: ' + Math.round(e.idade + r.Texp) + ' anos (IBGE 2024). Só concorrem os caminhos que pagam o inventário desde o 1º ano.</p></div>' +
    (img ? '<div class="bloco"><h2>Liquidez para o inventário — ' + CAM[seg.grafico].nome + '</h2><img class="pr-chart" src="' + img + '" alt="Gráfico da liquidez para o inventário ao longo do tempo"><div class="pr-legend">' + $('legenda').innerText.replace(/\n/g, ' · ') + '</div></div>' : '') +
    seguro +
    '<div class="bloco"><h2>Alertas</h2><ul>' + $('alertas').innerHTML + '</ul></div>' +
    '<div class="pr-aviso"><strong>Aviso:</strong> este documento é uma <strong>simulação</strong> com base nos parâmetros informados. Leis estaduais do ITCMD estão em adaptação à LC 227/2026; custos de cartório, advogado, contador e seguro são referências de mercado; rentabilidades e inflação variam. ' +
      'Não constitui consultoria jurídica, tributária ou de seguros, oferta ou recomendação. Consulte advogado, contador e corretor habilitado antes de decidir.</div>' +
    '<div class="pr-footer">' + [...document.querySelectorAll('footer p')].map(p => '<p>' + esc(p.textContent) + '</p>').join('') + '</div>';
  setTimeout(() => window.print(), 120);
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
  ligarSeg('segGrafico', 'grafico', desenharGrafico);
  // whole life: a parcela e a básica aceitam centavos já formatados
  ['wlParcela', 'wlBasica'].forEach(id => { $(id).value = moeda(lerMoeda($(id))); });
  $('hItbi').addEventListener('input', () => { itbiTocado = true; });
  $('btnPdf').addEventListener('click', gerarPdf);
  Tema.ligarBotao($('btnTema'), () => setTimeout(desenharGrafico, 30));
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(desenharGrafico, 150); });
  ligarTooltip();
  recalcular();
}

iniciar();
})();
