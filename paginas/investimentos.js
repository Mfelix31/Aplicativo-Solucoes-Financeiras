/*
 * Simulador e comparador de investimentos (investimentos.html) — lógica da página.
 */
const $ = id => document.getElementById(id);

function fmtBRL(v){
  return v.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
}
function fmtPct(v, casas=2){
  return v.toLocaleString('pt-BR', {minimumFractionDigits:casas, maximumFractionDigits:casas}) + '%';
}
function fmtBRLShort(v){
  if(Math.abs(v) >= 1000000) return 'R$ ' + (v/1000000).toFixed(1).replace('.',',') + 'M';
  if(Math.abs(v) >= 1000) return 'R$ ' + (v/1000).toFixed(1).replace('.',',') + 'mil';
  return fmtBRL(v);
}
function taxaReal(taxaAnualLiquidaPct, ipcaPct){
  return ((1 + taxaAnualLiquidaPct/100) / (1 + ipcaPct/100) - 1) * 100;
}

const escHTML = Formato.esc;

function numeroDoCampo(id){
  const raw = $(id).value || '0';
  const num = parseFloat(String(raw).replace(/\./g,'').replace(',','.'));
  return isNaN(num) ? 0 : num;
}

function aplicarMascaraMoeda(id){ Formato.mascara($(id)); }

let ultimoNominalSim = null;
function atualizarCaixaRealSim(){
  if(!ultimoNominalSim) return;
  const {taxaAnualLiquida, valorFinal, dias} = ultimoNominalSim;
  const ipca = parseFloat($('s_ipca').value) || 0;
  const preal = taxaReal(taxaAnualLiquida, ipca);
  const valorRealFinal = valorFinal / Math.pow(1 + ipca/100, dias/365);
  $('s_realValue').textContent = fmtPct(preal) + ' a.a.';
  $('s_realMoney').textContent = fmtBRL(valorRealFinal);
  $('s_realNote').textContent = 'Descontando um IPCA de ' + fmtPct(ipca) + ' ao ano, esse é o ganho de poder de compra estimado — acima de zero significa que o investimento venceu a inflação.';
}

let ultimoNominalCmp = null;
function atualizarCaixasRealCmp(){
  if(!ultimoNominalCmp) return;
  const {panualEsq, valorFinalEsq, panualDir, valorFinalDir, dias} = ultimoNominalCmp;
  const ipca = parseFloat($('c_ipca').value) || 0;
  const prealEsq = taxaReal(panualEsq, ipca);
  const prealDir = taxaReal(panualDir, ipca);
  const valorRealEsq = valorFinalEsq / Math.pow(1 + ipca/100, dias/365);
  const valorRealDir = valorFinalDir / Math.pow(1 + ipca/100, dias/365);
  $('c_lca_realValue').textContent = fmtPct(prealEsq) + ' a.a.';
  $('c_lca_realMoney').textContent = fmtBRL(valorRealEsq);
  $('c_rdc_realValue').textContent = fmtPct(prealDir) + ' a.a.';
  $('c_rdc_realMoney').textContent = fmtBRL(valorRealDir);
}


const IOF_TABLE = [96,93,90,86,83,80,76,73,70,66,63,60,56,53,50,46,43,40,36,33,30,26,23,20,16,13,10,6,3];
function iofAliquota(dias){
  if(dias >= 30) return 0;
  const idx = Math.max(1, Math.floor(dias)) - 1;
  return IOF_TABLE[Math.min(idx, IOF_TABLE.length-1)];
}
function irAliquota(dias){
  if(dias <= 180) return 22.5;
  if(dias <= 360) return 20;
  if(dias <= 720) return 17.5;
  return 15;
}
/* ---------------- CALENDÁRIO: dias corridos e dias úteis (base 252) ----------------
   Convenção de mercado para CDB/LCA/RDC/compromissada:
   - rendimento: (1 + taxa)^(DU/252), DU = dias úteis de [aplicação, resgate)
   - IR e IOF: dias corridos entre aplicação e resgate
   Feriados nacionais (calendário ANBIMA): fixos + móveis calculados pela Páscoa. */
const HOJE0 = (()=>{ const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); })();
function pascoa(ano){
  const a = ano % 19, b = Math.floor(ano/100), c = ano % 100, d = Math.floor(b/4), e = b % 4;
  const f = Math.floor((b+8)/25), g = Math.floor((b-f+1)/3), h = (19*a + b - d - g + 15) % 30;
  const i = Math.floor(c/4), k = c % 4, l = (32 + 2*e + 2*i - h - k) % 7, m = Math.floor((a + 11*h + 22*l)/451);
  const mes = Math.floor((h + l - 7*m + 114)/31), dia = ((h + l - 7*m + 114) % 31) + 1;
  return new Date(ano, mes-1, dia);
}
const _feriados = {};
function feriadosNacionais(ano){
  if(_feriados[ano]) return _feriados[ano];
  const set = new Set(['1-1','4-21','5-1','9-7','10-12','11-2','11-15','12-25']);
  if(ano >= 2024) set.add('11-20'); // Dia Nacional de Zumbi e da Consciência Negra (Lei 14.759/2023)
  const p = pascoa(ano);
  [-48, -47, -2, 60].forEach(off=>{ // Carnaval (seg e ter), Sexta-feira Santa, Corpus Christi
    const d = new Date(p.getFullYear(), p.getMonth(), p.getDate() + off);
    set.add((d.getMonth()+1) + '-' + d.getDate());
  });
  return (_feriados[ano] = set);
}
function ehDiaUtil(d){
  const w = d.getDay();
  if(w === 0 || w === 6) return false;
  return !feriadosNacionais(d.getFullYear()).has((d.getMonth()+1) + '-' + d.getDate());
}
const _cumDU = [0]; // _cumDU[n] = dias úteis em [hoje, hoje + n)
function diasUteisAte(n){
  n = Math.max(0, Math.round(n));
  while(_cumDU.length <= n){
    const i = _cumDU.length - 1;
    const d = new Date(HOJE0.getFullYear(), HOJE0.getMonth(), HOJE0.getDate() + i);
    _cumDU.push(_cumDU[i] + (ehDiaUtil(d) ? 1 : 0));
  }
  return _cumDU[n];
}
function diasUteisEntre(offIni, offFim){ return diasUteisAte(offFim) - diasUteisAte(offIni); }
function diasAteMesesDepois(n){
  const dia = HOJE0.getDate();
  const alvo = new Date(HOJE0.getFullYear(), HOJE0.getMonth() + n, 1);
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(dia, ultimo));
  return Math.round((alvo - HOJE0) / 864e5);
}
function prazoEmDias(valor, unidade){
  if(unidade === 'dias') return Math.round(valor);
  if(unidade === 'meses') return diasAteMesesDepois(Math.round(valor));
  return diasAteMesesDepois(Math.round(valor * 12));
}
function textoPrazo(valor, unidade){
  const v = Math.round(valor);
  if(unidade === 'dias') return v + (v===1 ? ' dia' : ' dias');
  if(unidade === 'meses') return v + (v===1 ? ' mês' : ' meses');
  return v + (v===1 ? ' ano' : ' anos');
}

/* ---------------- TAXA CONSTANTE OU CURVA POR ANO ----------------
   taxa = número (% a.a., constante)  ou  {curva: {ano: CDI % a.a.}, mult: % do CDI / 100, add: p.p. somados}
   O fator de rendimento compõe ano a ano: Π (1 + taxa_ano)^(DU_ano/252). */
function taxaNoAno(taxa, ano){
  if(typeof taxa === 'number') return taxa;
  const anos = Object.keys(taxa.curva).map(Number).sort((a,b)=>a-b);
  let v = taxa.curva[anos[0]];
  for(const a of anos){ if(a <= ano) v = taxa.curva[a]; }
  return v * (taxa.mult == null ? 1 : taxa.mult) + (taxa.add || 0);
}
function fatorRend(taxa, ini, fim){
  if(typeof taxa === 'number') return Math.pow(1 + taxa/100, diasUteisEntre(ini, fim)/252);
  let f = 1, c = ini;
  while(c < fim){
    const d = new Date(HOJE0.getFullYear(), HOJE0.getMonth(), HOJE0.getDate() + c);
    const ano = d.getFullYear();
    const inicioProxAno = Math.round((new Date(ano + 1, 0, 1) - HOJE0) / 864e5);
    const seg = Math.min(fim, inicioProxAno);
    f *= Math.pow(1 + taxaNoAno(taxa, ano)/100, diasUteisEntre(c, seg)/252);
    c = seg;
  }
  return f;
}
/** taxa anual equivalente (base 252) de uma taxa constante ou curva, num intervalo */
function taxaEquivalente(taxa, dias, ini){
  if(typeof taxa === 'number') return taxa;
  const i = Math.round(ini || 0), du = diasUteisEntre(i, i + Math.round(dias));
  return du > 0 ? (Math.pow(fatorRend(taxa, i, i + Math.round(dias)), 252/du) - 1) * 100 : taxaNoAno(taxa, HOJE0.getFullYear());
}

function simular(pv, taxaAnualPct, dias, isentoIR, isentoIOF, inicioOffset){
  // dias = dias corridos da aplicação ao resgate; inicioOffset = dias corridos entre hoje e a aplicação
  const ini = Math.round(inicioOffset || 0);
  const du = diasUteisEntre(ini, ini + Math.round(dias));
  const fv = pv * fatorRend(taxaAnualPct, ini, ini + Math.round(dias));
  const bruto = fv - pv;

  const aliqIOF = isentoIOF ? 0 : iofAliquota(dias);
  const iofValor = bruto * (aliqIOF/100);
  const aposIOF = bruto - iofValor;

  const aliqIR = isentoIR ? 0 : irAliquota(dias);
  const irValor = aposIOF * (aliqIR/100);
  const liquido = aposIOF - irValor;

  const valorFinal = pv + liquido;
  const pPeriodo = (liquido/pv)*100;
  const taxaAnualLiquida = du > 0 ? (Math.pow(valorFinal/pv, 252/du) - 1) * 100 : 0;
  const pMensal = (Math.pow(1+taxaAnualLiquida/100, 1/12) - 1) * 100;

  return {bruto, pBrutoAnual: taxaEquivalente(taxaAnualPct, dias, ini), iofValor, aliqIOF, isentoIOF: !!isentoIOF, irValor, aliqIR, liquido, valorFinal, pPeriodo, panual: taxaAnualLiquida, pmensal: pMensal, du, dc: Math.round(dias)};
}

function preencherCard(prefix, r, pv){
  $(prefix+'_pv').textContent = fmtBRL(pv);
  $(prefix+'_bruto').textContent = fmtBRL(r.bruto);
  $(prefix+'_pbrutoanual').textContent = fmtPct(r.pBrutoAnual);
  $(prefix+'_iof').textContent = r.iofValor > 0 ? '- ' + fmtBRL(r.iofValor) + (r.aliqIOF!=null ? ' (' + fmtPct(r.aliqIOF,0) + ')' : '') : (r.isentoIOF ? 'isenta de IOF' : 'não incide');
  $(prefix+'_ir').textContent = r.irValor > 0 ? '- ' + fmtBRL(r.irValor) + (r.aliqIR!=null ? ' (' + fmtPct(r.aliqIR,1) + ')' : '') : 'isento';
  $(prefix+'_liq').textContent = fmtBRL(r.liquido);
  $(prefix+'_panual').textContent = fmtPct(r.panual);
  if(r.preal !== undefined) $(prefix+'_preal').textContent = fmtPct(r.preal);
  $(prefix+'_pperiodo').textContent = fmtPct(r.pPeriodo);
  $(prefix+'_pmensal').textContent = fmtPct(r.pmensal);
  $(prefix+'_final').textContent = fmtBRL(r.valorFinal);
}

async function buscarCDI(inputId, heroSync, statusId){
  try{
    const d = await BCB.metaSelic(); // assets/bcb.js: Meta Selic (SGS 432) e CDI = Selic − 0,10 p.p.
    const data = [{data: d.data}];
    const metaSelic = d.metaSelic;
    const cdiEstimado = d.cdi;
    $(inputId).value = cdiEstimado.toFixed(2);
    if(heroSync){
      $('cdiHeroValue').textContent = fmtPct(cdiEstimado,2);
      $('cdiHeroSub').textContent = 'a.a. · Selic Meta ' + fmtPct(metaSelic,2) + ' desde ' + data[0].data;
    }
    if(statusId) $(statusId).textContent = 'CDI estimado a partir da Meta Selic definida pelo Copom (' + fmtPct(metaSelic,2) + ', vigente desde ' + data[0].data + '), descontando o spread histórico de 0,10 p.p. Essa fonte reflete decisões do Copom no mesmo dia, sem a defasagem de 1-2 dias úteis da série de CDI realizado.';
    return true;
  }catch(err){
    if(statusId) $(statusId).textContent = 'Não foi possível consultar o Banco Central agora (rede indisponível). Use o valor manual acima.';
    return false;
  }
}

async function buscarIPCA(inputId, statusId){
  try{
    const d = await BCB.ipca12m(); // assets/bcb.js: IPCA acumulado em 12 meses (SGS 13522)
    const data = [{data: d.data}];
    const valor = d.valor;
    $(inputId).value = valor.toFixed(2);
    const partes = data[0].data.split('/');
    const mesesNome = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    const refMes = partes.length === 3 ? mesesNome[parseInt(partes[1],10)-1] + '/' + partes[2] : data[0].data;
    if(statusId) $(statusId).textContent = 'IPCA acumulado em 12 meses até ' + refMes + ': ' + fmtPct(valor) + ' (série 13522, BCB). Esta é a série oficial mais atual — o IPCA é um índice fechado mensalmente pelo IBGE (divulgado por volta do dia 10 do mês seguinte), diferente da Selic, que muda por decisão do Copom; por isso não existe uma versão "mais rápida" para consultar.';
    return true;
  }catch(err){
    if(statusId) $(statusId).textContent = 'Não foi possível consultar o Banco Central agora (rede indisponível). Use o valor manual acima.';
    return false;
  }
}

/* ---------------- GRÁFICO DE EVOLUÇÃO ---------------- */
/* datas (em dias corridos a partir de hoje) dos aportes mensais dentro do prazo */
function datasAportes(diasTotal){
  const datas = [];
  for(let k=1; ; k++){
    const off = diasAteMesesDepois(k);
    if(off > diasTotal) break;
    datas.push(off);
  }
  return datas;
}
function evolucaoMensal(pv, aporte, taxa, diasTotal, isentoIR, isentoIOF){
  const datas = aporte > 0 ? datasAportes(diasTotal) : [];
  const nPontos = Math.min(24, Math.max(6, Math.round(diasTotal/15)));
  const pontos = [];
  for(let i=0; i<=nPontos; i++){
    const diaAtual = Math.round((diasTotal * i) / nPontos);
    let liquidoTotal = 0;
    let capitalTotal = pv;
    if(diaAtual > 0){
      const rIni = simular(pv, taxa, diaAtual, isentoIR, isentoIOF);
      liquidoTotal += rIni.liquido;
    }
    for(const off of datas){
      if(off > diaAtual) break;
      capitalTotal += aporte;
      const diasAporte = diaAtual - off;
      if(diasAporte > 0){
        const rAp = simular(aporte, taxa, diasAporte, isentoIR, isentoIOF, off);
        liquidoTotal += rAp.liquido;
      }
    }
    pontos.push({dia: diaAtual, valor: capitalTotal + liquidoTotal});
  }
  return pontos;
}

function coresTemaAtual(){
  const cs = getComputedStyle(document.documentElement);
  return {
    grid: getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || 'rgba(0,54,65,.10)',
    textFaint: cs.getPropertyValue('--ink-faint').trim() || '#628f8a',
    textMuted: cs.getPropertyValue('--ink-muted').trim() || '#8fc4bf',
    textStrong: cs.getPropertyValue('--ink').trim() || '#eef6f4',
  };
}

function desenharGraficoLinha(canvasId, pontos, cor){
  const canvas = $(canvasId);
  if(!canvas) return;
  const cssWidth = canvas.parentElement.clientWidth || 560;
  canvas.width = cssWidth;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  const padding = {top: 14, right: 12, bottom: 26, left: 66};
  const plotW = W - padding.left - padding.right;
  const plotH = H - padding.top - padding.bottom;

  const valores = pontos.map(p=>p.valor);
  const minRaw = Math.min(...valores);
  const maxRaw = Math.max(...valores);
  const spread = maxRaw - minRaw;
  const folga = spread > 0 ? spread * 0.15 : Math.max(maxRaw * 0.05, 10);
  const minV = minRaw - folga;
  const maxV = maxRaw + folga;
  const rangeV = (maxV - minV) || 1;

  const xFor = i => padding.left + (plotW * i/(pontos.length-1));
  const yFor = v => padding.top + plotH - ((v-minV)/rangeV)*plotH;

  const cores = coresTemaAtual();
  ctx.strokeStyle = cores.grid;
  ctx.lineWidth = 1;
  ctx.font = '10.5px Arial, Helvetica, sans-serif';
  ctx.fillStyle = cores.textFaint;
  ctx.textAlign = 'left';
  for(let g=0; g<=3; g++){
    const v = minV + rangeV*g/3;
    const y = yFor(v);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(W-padding.right, y);
    ctx.stroke();
    ctx.fillText(fmtBRLShort(v), 2, y+3);
  }

  ctx.beginPath();
  pontos.forEach((p,i)=>{
    const x = xFor(i), y = yFor(p.valor);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.lineTo(xFor(pontos.length-1), padding.top+plotH);
  ctx.lineTo(xFor(0), padding.top+plotH);
  ctx.closePath();
  ctx.fillStyle = cor + '22';
  ctx.fill();

  ctx.beginPath();
  pontos.forEach((p,i)=>{
    const x = xFor(i), y = yFor(p.valor);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.strokeStyle = cor;
  ctx.lineWidth = 2;
  ctx.stroke();

  [0, pontos.length-1].forEach(i=>{
    const x = xFor(i), y = yFor(pontos[i].valor);
    ctx.beginPath();
    ctx.arc(x,y,3,0,Math.PI*2);
    ctx.fillStyle = cor;
    ctx.fill();
  });

  ctx.fillStyle = cores.textMuted;
  ctx.font = '11px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Início', padding.left, H-6);
  ctx.textAlign = 'right';
  ctx.fillText('Resgate', W-padding.right, H-6);
}

function desenharGraficoMultiplo(canvasId, series){
  const canvas = $(canvasId);
  if(!canvas) return;
  const cssWidth = canvas.parentElement.clientWidth || 560;
  canvas.width = cssWidth;
  canvas.height = 240;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  const padding = {top: 34, right: 12, bottom: 26, left: 66};
  const plotW = W - padding.left - padding.right;
  const plotH = H - padding.top - padding.bottom;

  const allValores = series.flatMap(s=>s.pontos.map(p=>p.valor));
  const minRaw = Math.min(...allValores);
  const maxRaw = Math.max(...allValores);
  const spread = maxRaw - minRaw;
  const folga = spread > 0 ? spread * 0.15 : Math.max(maxRaw * 0.05, 10);
  const minV = minRaw - folga;
  const maxV = maxRaw + folga;
  const rangeV = (maxV - minV) || 1;

  const nPontos = series[0].pontos.length;
  const xFor = i => padding.left + (plotW * i/(nPontos-1));
  const yFor = v => padding.top + plotH - ((v-minV)/rangeV)*plotH;

  const cores = coresTemaAtual();
  ctx.strokeStyle = cores.grid;
  ctx.lineWidth = 1;
  ctx.font = '10.5px Arial, Helvetica, sans-serif';
  ctx.fillStyle = cores.textFaint;
  ctx.textAlign = 'left';
  for(let g=0; g<=3; g++){
    const v = minV + rangeV*g/3;
    const y = yFor(v);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(W-padding.right, y);
    ctx.stroke();
    ctx.fillText(fmtBRLShort(v), 2, y+3);
  }

  series.forEach(s=>{
    ctx.beginPath();
    s.pontos.forEach((p,i)=>{
      const x = xFor(i), y = yFor(p.valor);
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.strokeStyle = s.cor;
    ctx.lineWidth = 2;
    ctx.stroke();

    const last = s.pontos.length-1;
    const x = xFor(last), y = yFor(s.pontos[last].valor);
    ctx.beginPath();
    ctx.arc(x,y,3,0,Math.PI*2);
    ctx.fillStyle = s.cor;
    ctx.fill();
  });

  let lx = padding.left;
  ctx.font = '11px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'left';
  series.forEach(s=>{
    ctx.fillStyle = s.cor;
    ctx.fillRect(lx, 10, 10, 10);
    ctx.fillStyle = cores.textStrong;
    ctx.fillText(s.nome, lx+14, 19);
    lx += ctx.measureText(s.nome).width + 40;
  });

  ctx.fillStyle = cores.textMuted;
  ctx.font = '11px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Início', padding.left, H-6);
  ctx.textAlign = 'right';
  ctx.fillText('Resgate', W-padding.right, H-6);
}

/* ---------------- CENÁRIOS SALVOS ---------------- */
let cenariosSalvos = [];
let ultimoResultadoSim = null;
let ultimoGrafico = null;
let ultimoGraficoCmp = null;
let ultimoGraficoCenarios = null;
const produtoLabels = {lca:'LCA', rdc:'RDC', compromissada:'Compromissada'};

let cenariosSelecionados = [];

function renderCenarios(){
  const lista = $('s_cenariosLista');
  const vazio = $('s_cenariosVazio');
  lista.innerHTML = '';
  cenariosSelecionados = cenariosSelecionados.filter(id => cenariosSalvos.some(c=>String(c.id)===String(id)));

  if(cenariosSalvos.length === 0){
    vazio.classList.remove('hidden');
    $('s_cenarioCompareWrap').classList.add('hidden');
    return;
  }
  vazio.classList.add('hidden');
  $('s_cenarioCompareWrap').classList.toggle('hidden', cenariosSalvos.length < 2);

  const head = document.createElement('div');
  head.className = 'scenario-row-head';
  head.innerHTML = '<span></span><span>Cenário</span><span style="text-align:right;">Total Aportado</span><span style="text-align:right;">Rentab. Líquida a.a.</span><span style="text-align:right;">Valor Final</span><span></span>';
  lista.appendChild(head);

  const atingiuLimite = cenariosSelecionados.length >= 2;

  cenariosSalvos.forEach(c=>{
    const marcado = cenariosSelecionados.some(id=>String(id)===String(c.id));
    const row = document.createElement('div');
    row.className = 'scenario-row';
    row.innerHTML =
      '<input type="checkbox" class="cenario-check" data-id="'+c.id+'" '+(marcado?'checked':'')+' '+((!marcado && atingiuLimite)?'disabled':'')+'>' +
      '<span class="nome">' + escHTML(c.nome) + ' <span style="color:var(--ink-faint);">(' + c.produtoLabel + ')</span></span>' +
      '<span class="val">' + fmtBRL(c.totalCapital) + '</span>' +
      '<span class="val">' + fmtPct(c.pAnualLiquida) + '</span>' +
      '<span class="val">' + fmtBRL(c.valorFinal) + '</span>' +
      '<span class="row-actions"><button class="pdf" data-id="'+c.id+'" type="button">PDF</button><button class="remove" data-id="'+c.id+'" type="button">remover</button></span>';
    lista.appendChild(row);
  });

  lista.querySelectorAll('.cenario-check').forEach(chk=>{
    chk.addEventListener('change', ()=>{
      const id = String(chk.dataset.id);
      if(chk.checked){
        if(cenariosSelecionados.length >= 2){ chk.checked = false; return; }
        cenariosSelecionados.push(id);
      } else {
        cenariosSelecionados = cenariosSelecionados.filter(x=>String(x)!==id);
      }
      renderCenarios();
    });
  });

  lista.querySelectorAll('.remove').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = String(btn.dataset.id);
      cenariosSalvos = cenariosSalvos.filter(c=>String(c.id) !== id);
      cenariosSelecionados = cenariosSelecionados.filter(x=>String(x)!==id);
      renderCenarios();
    });
  });

  lista.querySelectorAll('.pdf').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const c = cenariosSalvos.find(x=>String(x.id)===String(btn.dataset.id));
      if(c) gerarPdfCenario(c);
    });
  });

  $('s_btnCompararCenarios').disabled = cenariosSelecionados.length !== 2;
  if(cenariosSelecionados.length !== 2){
    $('s_cenarioChartBox').classList.add('hidden');
  }
}

function formatarPrazo(dias){
  if(dias % 365 === 0 && dias >= 365) return (dias/365) + (dias===365 ? ' ano' : ' anos');
  if(dias % 30 === 0 && dias >= 30) return (dias/30) + (dias===30 ? ' mês' : ' meses');
  return Math.round(dias) + ' dias';
}

$('s_btnSalvarCenario').addEventListener('click', ()=>{
  if(!ultimoResultadoSim) return;
  const nomeInput = $('s_cenarioNome');
  const nome = (nomeInput.value || '').trim() || (ultimoResultadoSim.produtoLabel + ' ' + (cenariosSalvos.length+1));
  cenariosSalvos.push(Object.assign({}, ultimoResultadoSim, {nome, id: Date.now() + '_' + Math.random().toString(36).slice(2)}));
  nomeInput.value = '';
  renderCenarios();
});

let ultimoParComparado = null;

$('s_btnCompararCenarios').addEventListener('click', ()=>{
  if(cenariosSelecionados.length !== 2) return;
  const cores = ['#00AE9D', '#7774D4'];
  const cenariosObj = cenariosSelecionados.map(id => cenariosSalvos.find(x=>String(x.id)===String(id)));
  const series = cenariosObj.map((c, i)=>{
    const pontos = evolucaoMensal(c.valorInvestido, c.aporte || 0, c.taxaCalc != null ? c.taxaCalc : c.taxa, c.prazoDias, c.isentoIR, c.isentoIOF);
    return {pontos, cor: cores[i], nome: c.nome};
  });
  ultimoGraficoCenarios = series;
  ultimoParComparado = cenariosObj;
  $('s_cenarioChartBox').classList.remove('hidden');
  desenharGraficoMultiplo('s_cenarioChart', series);
});

$('s_btnPdfComparativo').addEventListener('click', ()=>{
  if(!ultimoParComparado) return;
  gerarPdfComparativo(ultimoParComparado[0], ultimoParComparado[1]);
});

function gerarPdfCenario(c){
  $('pr_titulo').textContent = c.nome;
  $('pr_subtitulo').textContent = 'Gerado em ' + new Date().toLocaleDateString('pt-BR');
  $('pr_produto').textContent = c.produtoLabel;
  $('pr_valorInicial').textContent = fmtBRL(c.valorInvestido);
  $('pr_aporte').textContent = c.aporte > 0 ? fmtBRL(c.aporte) + ' / mês' : 'Sem aporte mensal';
  $('pr_prazo').textContent = c.prazoTexto || formatarPrazo(c.prazoDias);
  $('pr_taxa').textContent = fmtPct(c.taxa) + ' a.a.' + (c.cdiProjetado ? ' (equivalente, CDI projetado)' : '');
  $('pr_totalAportado').textContent = fmtBRL(c.totalCapital);
  $('pr_iof').textContent = c.valorIOF > 0 ? fmtBRL(c.valorIOF) : (c.isentoIOF ? 'Isenta de IOF' : 'Não incide (prazo ≥ 30 dias)');
  $('pr_ir').textContent = c.valorIR > 0 ? fmtBRL(c.valorIR) : (c.isentoIR ? 'Isento de IR' : fmtBRL(0));
  $('pr_pAnual').textContent = fmtPct(c.pAnualLiquida);
  $('pr_pPeriodo').textContent = fmtPct(c.pPeriodo);
  $('pr_pReal').textContent = fmtPct(c.pReal);
  $('pr_valorReal').textContent = fmtBRL(c.valorReal);
  $('pr_valorFinal').textContent = fmtBRL(c.valorFinal);

  $('printArea').classList.add('print-active');
  $('printAreaCmp').classList.remove('print-active');
  setTimeout(()=>window.print(), 80);
}

function preencherColunaPdfComparativo(sufixo, c){
  $('prc_nome'+sufixo).textContent = c.nome;
  $('prc_produto'+sufixo).textContent = c.produtoLabel;
  $('prc_valorInicial'+sufixo).textContent = fmtBRL(c.valorInvestido);
  $('prc_aporte'+sufixo).textContent = c.aporte > 0 ? fmtBRL(c.aporte) + ' / mês' : 'Sem aporte';
  $('prc_prazo'+sufixo).textContent = c.prazoTexto || formatarPrazo(c.prazoDias);
  $('prc_taxa'+sufixo).textContent = fmtPct(c.taxa) + ' a.a.' + (c.cdiProjetado ? ' (equivalente, CDI projetado)' : '');
  $('prc_total'+sufixo).textContent = fmtBRL(c.totalCapital);
  $('prc_iof'+sufixo).textContent = c.valorIOF > 0 ? fmtBRL(c.valorIOF) : (c.isentoIOF ? 'Isenta' : 'Não incide');
  $('prc_ir'+sufixo).textContent = c.valorIR > 0 ? fmtBRL(c.valorIR) : (c.isentoIR ? 'Isento' : fmtBRL(0));
  $('prc_pAnual'+sufixo).textContent = fmtPct(c.pAnualLiquida);
  $('prc_pPeriodo'+sufixo).textContent = fmtPct(c.pPeriodo);
  $('prc_pReal'+sufixo).textContent = fmtPct(c.pReal);
  $('prc_valorReal'+sufixo).textContent = fmtBRL(c.valorReal);
  $('prc_valorFinal'+sufixo).textContent = fmtBRL(c.valorFinal);
}

function gerarPdfComparativo(cenarioA, cenarioB){
  $('prc_subtitulo').textContent = 'Gerado em ' + new Date().toLocaleDateString('pt-BR');
  preencherColunaPdfComparativo('A', cenarioA);
  preencherColunaPdfComparativo('B', cenarioB);

  const diffAnual = cenarioA.pAnualLiquida - cenarioB.pAnualLiquida;
  let veredito;
  if(Math.abs(diffAnual) < 0.01){
    veredito = 'As duas simulações têm rentabilidade líquida anual praticamente igual nas condições informadas.';
  } else if(diffAnual > 0){
    veredito = '"' + cenarioA.nome + '" tem rentabilidade líquida anual ' + fmtPct(Math.abs(diffAnual)) + ' p.p. maior que "' + cenarioB.nome + '" nas condições simuladas.';
  } else {
    veredito = '"' + cenarioB.nome + '" tem rentabilidade líquida anual ' + fmtPct(Math.abs(diffAnual)) + ' p.p. maior que "' + cenarioA.nome + '" nas condições simuladas.';
  }
  $('prc_veredito').textContent = veredito;

  $('printAreaCmp').classList.add('print-active');
  $('printArea').classList.remove('print-active');
  setTimeout(()=>window.print(), 80);
}

/* ---------------- TABS ---------------- */
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    $('tab-'+btn.dataset.tab).classList.add('active');
    redesenharTodosGraficos(); // gráficos de abas ocultas foram desenhados sem largura: redesenha ao aparecer
  });
});

/* ---------------- CDI PROJETADO (Boletim Focus) ----------------
   Expectativa de mercado para a Selic no fim de cada ano (mediana do Focus, API do Banco Central),
   descontado o spread de 0,10 p.p. entre CDI e Selic. Ano atual = CDI informado.
   Depois do último ano do Focus, mantém o último valor. Todos os anos futuros são editáveis.
   Se a consulta falhar, nada é inventado: os anos ficam com o CDI informado e o aviso é exibido. */
const ANO_ATUAL = HOJE0.getFullYear();
const SPREAD_CDI_SELIC_PP = 0.10;
let modoCDI = 'constante';
let curvaCDI = null;          // {ano: CDI % a.a.}
let focusInfo = {estado: 'inicial', texto: ''};

function taxaPosFixada(cdi, perc){
  if(modoCDI !== 'projetado' || !curvaCDI) return cdi * perc/100;
  const curva = Object.assign({}, curvaCDI, {[ANO_ATUAL]: cdi});   // ano atual acompanha o CDI informado
  return {curva, mult: perc/100};
}
function anoFinalDoPrazo(prefixo){
  const raw = parseFloat($(prefixo + '_prazo').value);
  const dias = raw > 0 ? prazoEmDias(raw, $(prefixo + '_prazoUnidade').value) : 0;
  return new Date(HOJE0.getFullYear(), HOJE0.getMonth(), HOJE0.getDate() + dias).getFullYear();
}
function montarCurvaPadrao(cdi){
  const c = {};
  for(let a = ANO_ATUAL; a <= ANO_ATUAL + 60; a++) c[a] = cdi;
  return c;
}
async function buscarFocusSelic(){
  return BCB.focusSelic(ANO_ATUAL); // assets/bcb.js: Boletim Focus, mediana mais recente da Selic de fim de ano
}
async function ativarCurva(){
  const cdi = parseFloat($('s_cdi').value) || 0;
  if(!curvaCDI) curvaCDI = montarCurvaPadrao(cdi);
  if(focusInfo.estado === 'ok' || focusInfo.estado === 'carregando') return;
  focusInfo = {estado: 'carregando', texto: 'Consultando o Boletim Focus no Banco Central…'};
  renderCurvas();
  try{
    const f = await buscarFocusSelic();
    const anos = Object.keys(f.porAno).map(Number).sort((a,b)=>a-b);
    let ultimo = null;
    for(let a = ANO_ATUAL + 1; a <= ANO_ATUAL + 60; a++){
      if(f.porAno[a] != null) ultimo = f.porAno[a] - SPREAD_CDI_SELIC_PP;
      if(ultimo != null) curvaCDI[a] = Math.round(ultimo*100)/100;
    }
    const dt = String(f.data).split('-').reverse().join('/');
    focusInfo = {estado: 'ok', texto: 'Selic esperada para o fim de cada ano: mediana do Boletim Focus de ' + dt +
      ' (expectativa de mercado, não é previsão oficial), menos 0,10 p.p. Depois de ' + anos[anos.length-1] +
      ' mantém o último valor. Ano atual = CDI informado. Você pode editar qualquer ano futuro.'};
  }catch(e){
    focusInfo = {estado: 'erro', texto: 'Não foi possível consultar o Boletim Focus agora. Os anos estão com o CDI informado — preencha a projeção de cada ano manualmente.'};
  }
  renderCurvas();
  calcularSimulacao(); calcularComparacao();
}
function renderCurva(prefixo){
  const box = $(prefixo + '_curvaBox');
  box.classList.toggle('hidden', modoCDI !== 'projetado');
  if(modoCDI !== 'projetado' || !curvaCDI) return;
  const fim = Math.max(ANO_ATUAL + 1, anoFinalDoPrazo(prefixo));
  const cdiAtual = parseFloat($(prefixo === 's' ? 's_cdi' : 'c_cdi').value) || 0;
  let html = '<div class="curva-status' + (focusInfo.estado === 'erro' ? ' err' : '') + '">' + escHTML(focusInfo.texto) + '</div><div class="curva-grid">';
  for(let a = ANO_ATUAL; a <= fim; a++){
    const v = a === ANO_ATUAL ? cdiAtual : curvaCDI[a];
    html += '<div class="field"><label for="' + prefixo + '_curva_' + a + '">' + a + (a === ANO_ATUAL ? ' (atual)' : '') + '</label>' +
      '<div class="row-input"><input type="number" step="0.01" min="0" id="' + prefixo + '_curva_' + a + '" data-ano="' + a + '" value="' + (Math.round(v*100)/100).toFixed(2) + '"' +
      (a === ANO_ATUAL ? ' disabled title="O ano atual usa o CDI informado acima"' : '') + '><span class="suffix">%</span></div></div>';
  }
  html += '</div><div class="curva-status">CDI médio considerado em cada ano, % a.a.</div>';
  box.innerHTML = html;
  box.querySelectorAll('input[data-ano]').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      const v = parseFloat(inp.value);
      if(!(v >= 0 && v < 100)){ inp.value = curvaCDI[inp.dataset.ano]; return; }
      curvaCDI[inp.dataset.ano] = v;
      renderCurvas(); calcularSimulacao(); calcularComparacao();
    });
  });
}
function renderCurvas(){ renderCurva('s'); renderCurva('c'); }
function selecionarModoCDI(modo){
  modoCDI = modo;
  ['s_cdiProj','c_cdiProj'].forEach(id=>{ $(id).checked = modo === 'projetado'; });
  if(modo === 'projetado') ativarCurva();
  renderCurvas();
  calcularSimulacao(); calcularComparacao();
}

/* ---------------- REFERÊNCIAS DE MERCADO ----------------
   Poupança: 0,5% a.m. + TR enquanto a Selic for maior que 8,5% a.a. (senão 70% da Selic + TR);
             rende só a cada mês completo (aniversário); isenta de IR.
   CDB:      % do CDI; IR regressivo e IOF (mesma regra do RDC).
   Tesouro Selic: Selic ≈ CDI + 0,10 p.p.; IR regressivo e IOF; taxa de custódia B3 de 0,20% a.a.
             sobre o valor que exceder R$ 10 mil por CPF (estimada mês a mês). */
function mesesCompletos(dias){ let k = 0; while(diasAteMesesDepois(k + 1) <= dias) k++; return k; }
function lotesAplicacao(pv, aporte, dias){
  const lotes = [{off: 0, v: pv}];
  if(aporte > 0) datasAportes(dias).forEach(o => lotes.push({off: o, v: aporte}));
  return lotes;
}
function liquidoRendaFixa(lotes, taxa, dias, isentoIR, isentoIOF){
  let liq = 0;
  lotes.forEach(l=>{ if(dias - l.off > 0) liq += simular(l.v, taxa, dias - l.off, isentoIR, isentoIOF, l.off).liquido; });
  return liq;
}
function calcularReferencias(pv, aporte, dias, cdi, valorFinalSim, capitalSim, duTotal){
  const lotes = lotesAplicacao(pv, aporte, dias);
  const capital = lotes.reduce((a,l)=>a + l.v, 0);
  // taxa interna de retorno anual (base 252): considera o tempo que cada aporte ficou aplicado
  const anual = vf => {
    const fluxos = lotes.map(l => ({v: l.v, du: diasUteisEntre(l.off, dias)}));
    const total = r => fluxos.reduce((a,f)=>a + f.v * Math.pow(1 + r, f.du/252), 0);
    if(!(capital > 0) || !(duTotal > 0)) return 0;
    let lo = -0.99, hi = 5;
    for(let k = 0; k < 80; k++){ const m = (lo + hi)/2; if(total(m) > vf) hi = m; else lo = m; }
    return ((lo + hi)/2) * 100;
  };
  const selic = cdi + SPREAD_CDI_SELIC_PP;
  const linhas = [];

  // Poupança
  const tr = (parseFloat($('s_refTr').value) || 0) / 100;
  const rBase = selic > 8.5 ? 0.005 : Math.pow(1 + 0.7*selic/100, 1/12) - 1;
  const rMes = (1 + rBase) * (1 + tr) - 1;
  const mTot = mesesCompletos(dias);
  let vfPoup = 0;
  lotes.forEach((l, i)=>{ const m = Math.max(0, mTot - i); vfPoup += l.v * Math.pow(1 + rMes, m); });
  linhas.push({nome: 'Poupança', sub: fmtPct(rMes*100, 4) + ' a.m.', vf: vfPoup, garantia: 'FGC/FGCoop até R$ 250 mil'});

  // CDB
  const percCdb = parseFloat($('s_refCdb').value) || 0;
  const taxaCdb = taxaPosFixada(cdi, percCdb);
  const vfCdb = capital + liquidoRendaFixa(lotes, taxaCdb, dias, false, false);
  linhas.push({nome: 'CDB', sub: fmtPct(percCdb, 0) + ' do CDI', vf: vfCdb, garantia: 'FGC até R$ 250 mil'});

  // Tesouro Selic
  const taxaSelic = typeof taxaCdb === 'number' ? selic : {curva: taxaCdb.curva, mult: 1, add: SPREAD_CDI_SELIC_PP};
  let custodia = 0, ant = 0;
  for(let k = 1; ant < dias; k++){
    const o = Math.min(dias, diasAteMesesDepois(k));
    let saldo = 0;
    lotes.forEach(l=>{ if(l.off < o) saldo += l.v * fatorRend(taxaSelic, l.off, o); });
    custodia += 0.002 * Math.max(0, saldo - 10000) * ((o - ant) / 365);
    ant = o;
  }
  const vfSelic = capital + liquidoRendaFixa(lotes, taxaSelic, dias, false, false) - custodia;
  linhas.push({nome: 'Tesouro Selic', sub: 'Selic ' + fmtPct(taxaEquivalente(taxaSelic, dias)) + ' a.a.' + (custodia > 0.005 ? ' · custódia ≈ ' + fmtBRL(custodia) : ''), vf: vfSelic, garantia: 'Tesouro Nacional'});

  const nomeSim = produtoLabels[tipoSelecionado];
  let html = '<tr><th>Investimento</th><th class="n">Valor final líquido</th><th class="n">Rent. líquida a.a.</th><th class="n">Diferença</th><th>Garantia</th></tr>';
  html += '<tr class="atual"><td>' + escHTML(nomeSim) + '<small>sua simulação</small></td><td class="n">' + fmtBRL(valorFinalSim) + '</td><td class="n">' + fmtPct(anual(valorFinalSim)) + '</td><td class="n">—</td><td>' +
    (tipoSelecionado === 'compromissada' ? 'Lastro em crédito privado' : 'FGCoop até R$ 250 mil') + '</td></tr>';
  linhas.forEach(l=>{
    const d = valorFinalSim - l.vf;
    html += '<tr><td>' + l.nome + '<small>' + l.sub + '</small></td><td class="n">' + fmtBRL(l.vf) + '</td><td class="n">' + fmtPct(anual(l.vf)) + '</td>' +
      '<td class="n ' + (d >= 0 ? 'pos' : 'neg') + '">' + (d >= 0 ? 'simulação +' : 'simulação −') + fmtBRL(Math.abs(d)) + '</td><td>' + l.garantia + '</td></tr>';
  });
  $('s_refTable').innerHTML = html;
  $('s_refNote').textContent = 'Poupança: 0,5% a.m. + TR (Selic acima de 8,5% a.a.), rendimento só em meses completos, isenta de IR' +
    (mTot === 0 ? ' — com prazo menor que 1 mês, não rende' : '') + '. CDB e Tesouro Selic: IR regressivo e IOF. Tesouro Selic: Selic considerada como CDI + 0,10 p.p.; taxa de custódia da B3 de 0,20% a.a. sobre o que exceder R$ 10 mil por CPF (estimativa). ' +
    'TR de referência: 0,1690% a.m. (01/09 a 01/10/2026, Banco Central) — ajuste se necessário.' + (aporte > 0 ? ' Com aportes, a rentabilidade anual da tabela considera o tempo que cada aporte ficou aplicado (taxa interna de retorno).' : '') + (typeof taxaCdb !== 'number' ? ' CDB e Tesouro Selic usam o CDI projetado por ano.' : '');
}

/* ---------------- TEXTOS DOS PRODUTOS ---------------- */
const DESC_PRODUTO = {
  lca: 'Letra de Crédito do Agronegócio — isenta de IR para pessoa física',
  rdc: 'Recibo de Depósito Cooperativo — tributado pela tabela regressiva de IR',
  compromissada: 'A operação é lastreada em título de crédito privado, o que garante isenção de IOF, proporcionando maior eficiência tributária para aplicações de curto prazo'
};
const GARANTIA_PRODUTO = {
  lca: '🛡️ <span>Garantia: <strong>FGCoop</strong>, até R$ 250 mil por CPF</span>',
  rdc: '🛡️ <span>Garantia: <strong>FGCoop</strong>, até R$ 250 mil por CPF</span>',
  compromissada: '🛡️ <span>Lastro: <strong>título de crédito privado</strong></span>'
};

/* ---------------- VALIDAÇÃO DO PRAZO ----------------
   - prazo precisa ser maior que zero (senão o cálculo não roda e os resultados ficam esmaecidos)
   - LCA: prazo mínimo de 6 meses (Resolução CMN nº 5.215/2025) — o prazo é travado em 6 meses, com aviso */
function validarPrazo(prefixo, ehLCA){
  const el = $(prefixo + '_prazo'), un = $(prefixo + '_prazoUnidade'), msg = $(prefixo + '_prazoMsg');
  const caixa = el.closest('.row-input');
  msg.className = 'cdi-status prazo-msg'; msg.textContent = '';
  caixa.classList.remove('invalid');
  const raw = parseFloat(el.value);
  let dias = (Number.isFinite(raw) && raw > 0) ? prazoEmDias(raw, un.value) : 0;
  if(!(dias >= 1)){
    msg.textContent = 'Informe um prazo de pelo menos 1 dia (número maior que zero).';
    msg.classList.add('err'); caixa.classList.add('invalid');
    return null;
  }
  if(ehLCA){
    const minimo = prazoEmDias(6, 'meses');
    if(dias < minimo){
      el.value = 6; un.value = 'meses'; dias = minimo;
      msg.textContent = 'A LCA tem prazo mínimo de 6 meses (Resolução CMN nº 5.215/2025). O prazo foi ajustado para 6 meses.';
      msg.classList.add('warn');
    }
  }
  return {dias, raw: parseFloat(el.value), unidade: un.value};
}

/* ---------------- SIMULAÇÃO (aba principal) ---------------- */
let tipoSelecionado = 'lca';
let indexadorSim = 'pos';

function selecionarTipo(tipo){
  tipoSelecionado = tipo;
  $('optLCA').classList.toggle('selected', tipo==='lca');
  $('optRDC').classList.toggle('selected', tipo==='rdc');
  $('optCompromissada').classList.toggle('selected', tipo==='compromissada');

  const card = $('s_card');
  const btn = $('s_btnCalc');
  const accent = tipo === 'lca' ? 'var(--gold)' : (tipo === 'rdc' ? 'var(--teal)' : 'var(--blue)');
  card.style.setProperty('--accent', accent);
  $('s_idxSwitch').style.setProperty('--accent', accent);
  $('s_equivBox').style.setProperty('--accent', accent);
  $('s_realBox').style.setProperty('--accent', accent);
  btn.classList.remove('teal','blue');

  if(tipo === 'lca'){
    $('s_cardTitle').textContent = 'LCA';
    $('s_cardDesc').textContent = DESC_PRODUTO.lca;
    $('s_percLabel').textContent = '% do CDI pago (LCA)';
    $('s_preLabel').textContent = 'Taxa fixa contratada (LCA)';
    $('s_equivLabel').textContent = 'Equivalente em RDC (taxa bruta)';
  } else if(tipo === 'rdc'){
    $('s_cardTitle').textContent = 'RDC';
    $('s_cardDesc').textContent = DESC_PRODUTO.rdc;
    $('s_percLabel').textContent = '% do CDI pago (RDC)';
    $('s_preLabel').textContent = 'Taxa fixa contratada (RDC)';
    $('s_equivLabel').textContent = 'Equivalente em LCA (taxa líquida)';
    btn.classList.add('teal');
  } else {
    $('s_cardTitle').textContent = 'Operação Compromissada';
    $('s_cardDesc').textContent = DESC_PRODUTO.compromissada;
    $('s_percLabel').textContent = '% do CDI pago (Compromissada)';
    $('s_preLabel').textContent = 'Taxa fixa contratada (Compromissada)';
    $('s_equivLabel').textContent = 'Equivalente em LCA (taxa líquida)';
    btn.classList.add('blue');
    $('s_prazoUnidade').value = 'dias';
  }
  $('s_garantia').innerHTML = GARANTIA_PRODUTO[tipo];
  calcularSimulacao();
}
$('optLCA').addEventListener('click', ()=>selecionarTipo('lca'));
$('optRDC').addEventListener('click', ()=>selecionarTipo('rdc'));
$('optCompromissada').addEventListener('click', ()=>selecionarTipo('compromissada'));

function selecionarIndexadorSim(idx){
  indexadorSim = idx;
  $('s_idxSwitch').querySelectorAll('.seg-opt').forEach(el=>{
    el.classList.toggle('active', el.dataset.idx === idx);
  });
  $('s_cdiBlock').classList.toggle('hidden', idx !== 'pos');
  $('s_preBlock').classList.toggle('hidden', idx !== 'pre');
  calcularSimulacao();
}
$('s_idxSwitch').querySelectorAll('.seg-opt').forEach(el=>{
  el.addEventListener('click', ()=>selecionarIndexadorSim(el.dataset.idx));
});

function calcularSimulacao(){
  const pv = numeroDoCampo('s_valor');
  const aporte = numeroDoCampo('s_aporte');
  const prazoOk = validarPrazo('s', tipoSelecionado === 'lca');
  $('s_resultsBlock').classList.toggle('stale', !prazoOk);
  if(!prazoOk) return;
  const prazoRaw = prazoOk.raw;
  const unidade = prazoOk.unidade;
  const dias = prazoOk.dias;
  const isentoIR = tipoSelecionado === 'lca';
  const isentoIOF = tipoSelecionado === 'compromissada';

  let taxa;
  let cdiAtualSim = 0;
  if(indexadorSim === 'pre'){
    taxa = parseFloat($('s_taxaPre').value) || 0;
  } else {
    cdiAtualSim = parseFloat($('s_cdi').value) || 0;
    const perc = parseFloat($('s_perc').value) || 0;
    taxa = taxaPosFixada(cdiAtualSim, perc);
  }

  const rInicial = simular(pv, taxa, dias, isentoIR, isentoIOF);

  let totalBruto = rInicial.bruto;
  let totalIOF = rInicial.iofValor;
  let totalIR = rInicial.irValor;
  let totalLiquido = rInicial.liquido;
  let totalCapital = pv;
  let nAportes = 0;

  if(aporte > 0){
    const datas = datasAportes(dias);
    nAportes = datas.length;
    for(const off of datas){
      const diasAporte = dias - off;
      if(diasAporte <= 0){ totalCapital += aporte; continue; } // aporte no dia do resgate: entra sem render
      const rAporte = simular(aporte, taxa, diasAporte, isentoIR, isentoIOF, off);
      totalBruto += rAporte.bruto;
      totalIOF += rAporte.iofValor;
      totalIR += rAporte.irValor;
      totalLiquido += rAporte.liquido;
      totalCapital += aporte;
    }
  }

  const valorFinal = totalCapital + totalLiquido;
  const pPeriodo = totalCapital > 0 ? (totalLiquido/totalCapital)*100 : 0;
  const duTotal = rInicial.du;
  const taxaAnualLiquida = duTotal > 0 && totalCapital > 0 ? (Math.pow(valorFinal/totalCapital, 252/duTotal) - 1) * 100 : 0;
  const pMensal = (Math.pow(1+taxaAnualLiquida/100, 1/12) - 1) * 100;

  const taxaCalc = taxa;                     // constante ou curva — usada nos cálculos
  taxa = taxaEquivalente(taxaCalc, dias);    // número equivalente — usado nos textos
  const r = {
    bruto: totalBruto,
    pBrutoAnual: taxa,
    iofValor: totalIOF,
    aliqIOF: nAportes > 0 ? undefined : rInicial.aliqIOF,
    isentoIOF: rInicial.isentoIOF,
    irValor: totalIR,
    aliqIR: nAportes > 0 ? undefined : rInicial.aliqIR,
    liquido: totalLiquido,
    valorFinal,
    pPeriodo,
    panual: taxaAnualLiquida,
    pmensal: pMensal
  };

  ultimoNominalSim = {taxaAnualLiquida, valorFinal, totalCapital, dias};
  atualizarCaixaRealSim();
  const ipcaAtual = parseFloat($('s_ipca').value) || 0;
  const prealAtual = taxaReal(taxaAnualLiquida, ipcaAtual);

  preencherCard('s', r, pv);

  if(aporte > 0 && nAportes > 0){
    $('s_aporteRow').classList.remove('hidden');
    $('s_totalRow').classList.remove('hidden');
    $('s_aporteValue').textContent = fmtBRL(aporte) + ' × ' + nAportes + (nAportes===1 ? ' mês' : ' meses');
    $('s_totalAportado').textContent = fmtBRL(totalCapital);
    $('s_aporteNote').classList.remove('hidden');
    $('s_aporteNote').textContent = 'Com aportes mensais, o IOF e o IR são calculados aporte a aporte, cada um pelo seu próprio prazo de aplicação até o resgate — por isso não é exibido um percentual único de alíquota, e as rentabilidades anual/mensal são aproximadas.';
  } else {
    $('s_aporteRow').classList.add('hidden');
    $('s_totalRow').classList.add('hidden');
    $('s_aporteNote').classList.add('hidden');
  }

  const corMap = {lca:'#7DB61C', rdc:'#00AE9D', compromissada:'#7774D4'};
  ultimoGrafico = {pontos: evolucaoMensal(pv, aporte, taxaCalc, dias, isentoIR, isentoIOF), cor: corMap[tipoSelecionado]};
  desenharGraficoLinha('s_chart', ultimoGrafico.pontos, ultimoGrafico.cor);

  const valorRealAtual = valorFinal / Math.pow(1 + ipcaAtual/100, dias/365);

  ultimoResultadoSim = {
    tipo: tipoSelecionado,
    produtoLabel: produtoLabels[tipoSelecionado],
    valorInvestido: pv,
    aporte: aporte,
    prazoDias: dias,
    prazoTexto: textoPrazo(prazoRaw, unidade),
    taxa: taxa,
    taxaCalc: taxaCalc,
    cdiProjetado: typeof taxaCalc !== 'number',
    isentoIR: isentoIR,
    isentoIOF: isentoIOF,
    ipca: ipcaAtual,
    totalCapital: totalCapital,
    valorIOF: totalIOF,
    valorIR: totalIR,
    pPeriodo: pPeriodo,
    valorFinal: valorFinal,
    pAnualLiquida: taxaAnualLiquida,
    pReal: prealAtual,
    valorReal: valorRealAtual
  };

  $('s_resultsBlock').style.display = 'block';

  const aliqIR = irAliquota(dias);
  let equivalente, nota;
  if(isentoIR){
    equivalente = taxa / (1 - aliqIR/100);
    nota = 'Um RDC precisaria pagar essa taxa bruta ao ano para, após ' + fmtPct(aliqIR,1) + ' de IR (prazo de ' + Math.round(dias) + ' dias), render o mesmo líquido que essa LCA.';
  } else {
    equivalente = taxa * (1 - aliqIR/100);
    const nomeProduto = tipoSelecionado === 'rdc' ? 'esse RDC' : 'essa Operação Compromissada';
    nota = 'Uma LCA (isenta de IR) precisaria pagar essa taxa ao ano para render o mesmo líquido que ' + nomeProduto + ', que perde ' + fmtPct(aliqIR,1) + ' de IR nesse prazo.';
  }

  if(indexadorSim === 'pos' && cdiAtualSim > 0 && typeof taxaCalc === 'number'){
    const percCDIequivalente = (equivalente / cdiAtualSim) * 100;
    $('s_equivValue').textContent = fmtPct(percCDIequivalente, 0) + ' do CDI';
    nota += ' Isso equivale a ' + fmtPct(percCDIequivalente, 0) + ' do CDI atual (' + fmtPct(cdiAtualSim) + ' a.a.), ou ' + fmtPct(equivalente) + ' a.a. em taxa fixa — a mesma referência (% do CDI) usada na sua simulação.';
  } else {
    $('s_equivValue').textContent = fmtPct(equivalente) + ' a.a.';
  }
  $('s_equivNote').textContent = nota;
  calcularReferencias(pv, aporte, dias, cdiAtualSim || (parseFloat($('s_cdi').value) || 0), valorFinal, totalCapital, duTotal);
}
$('s_btnCalc').addEventListener('click', calcularSimulacao);
$('s_prazoUnidade').addEventListener('change', calcularSimulacao);
$('s_prazo').addEventListener('change', calcularSimulacao);
$('s_btnCdi').addEventListener('click', ()=>buscarCDI('s_cdi', true, 's_cdiStatus'));
$('s_btnIpca').addEventListener('click', async ()=>{
  await buscarIPCA('s_ipca', 's_ipcaStatus');
  atualizarCaixaRealSim();
});
$('s_ipca').addEventListener('input', atualizarCaixaRealSim);
$('btnCdiGlobal').addEventListener('click', async ()=>{
  await buscarCDI('s_cdi', true, 's_cdiStatus');
  $('c_cdi').value = $('s_cdi').value;
});

/* ---------------- COMPARAÇÃO ---------------- */
let indexadorLCA = 'pos';
let indexadorRDC = 'pos';

function selecionarIndexadorCmp(produto, idx){
  const switchId = produto === 'lca' ? 'c_lca_idxSwitch' : 'c_rdc_idxSwitch';
  const percBlockId = produto === 'lca' ? 'c_lca_percBlock' : 'c_rdc_percBlock';
  const preBlockId = produto === 'lca' ? 'c_lca_preBlock' : 'c_rdc_preBlock';

  if(produto === 'lca') indexadorLCA = idx; else indexadorRDC = idx;

  $(switchId).querySelectorAll('.seg-opt').forEach(el=>{
    el.classList.toggle('active', el.dataset.idx === idx);
  });
  $(percBlockId).classList.toggle('hidden', idx !== 'pos');
  $(preBlockId).classList.toggle('hidden', idx !== 'pre');
  calcularComparacao();
}
$('c_lca_idxSwitch').querySelectorAll('.seg-opt').forEach(el=>{
  el.addEventListener('click', ()=>selecionarIndexadorCmp('lca', el.dataset.idx));
});
$('c_rdc_idxSwitch').querySelectorAll('.seg-opt').forEach(el=>{
  el.addEventListener('click', ()=>selecionarIndexadorCmp('rdc', el.dataset.idx));
});

function calcularComparacao(){
  const pv = numeroDoCampo('c_valor');
  const prazoOk = validarPrazo('c', parComparacao === 'lca');
  $('c_resultsBlock').classList.toggle('stale', !prazoOk);
  if(!prazoOk) return;
  const dias = prazoOk.dias;
  const cdi = parseFloat($('c_cdi').value) || 0;

  let taxaLCA, taxaRDC;
  if(indexadorLCA === 'pre'){
    taxaLCA = parseFloat($('c_lca_taxaPre').value) || 0;
  } else {
    const percLCA = parseFloat($('c_percLCA').value) || 0;
    taxaLCA = taxaPosFixada(cdi, percLCA);
  }
  if(indexadorRDC === 'pre'){
    taxaRDC = parseFloat($('c_rdc_taxaPre').value) || 0;
  } else {
    const percRDC = parseFloat($('c_percRDC').value) || 0;
    taxaRDC = taxaPosFixada(cdi, percRDC);
  }

  const isEsquerdaLCA = parComparacao === 'lca';
  const isentoIResq = isEsquerdaLCA;       // LCA: isenta de IR / Compromissada: não isenta
  const isentoIOFesq = !isEsquerdaLCA;     // Compromissada: isenta de IOF / LCA: não isenta
  const nomeEsq = isEsquerdaLCA ? 'LCA' : 'Operação Compromissada';

  const rLCA = simular(pv, taxaLCA, dias, isentoIResq, isentoIOFesq);
  const rRDC = simular(pv, taxaRDC, dias, false, false);

  const corEsq = isEsquerdaLCA ? '#7DB61C' : '#7774D4';
  const pontosEsq = evolucaoMensal(pv, 0, taxaLCA, dias, isentoIResq, isentoIOFesq);
  const pontosDir = evolucaoMensal(pv, 0, taxaRDC, dias, false, false);
  ultimoGraficoCmp = [
    {pontos: pontosEsq, cor: corEsq, nome: nomeEsq},
    {pontos: pontosDir, cor: '#00AE9D', nome: 'RDC'}
  ];
  desenharGraficoMultiplo('c_chart', ultimoGraficoCmp);

  ultimoNominalCmp = {panualEsq: rLCA.panual, valorFinalEsq: rLCA.valorFinal, panualDir: rRDC.panual, valorFinalDir: rRDC.valorFinal, pv, dias};
  atualizarCaixasRealCmp();

  preencherCard('c_lca', rLCA, pv);
  preencherCard('c_rdc', rRDC, pv);

  $('c_tagLCA').style.display = 'none';
  $('c_tagRDC').style.display = 'none';
  $('c_cardLCA').classList.remove('winner');
  $('c_cardRDC').classList.remove('winner');

  const diff = rLCA.valorFinal - rRDC.valorFinal;
  const maxVal = Math.max(rLCA.valorFinal, rRDC.valorFinal, pv);
  $('c_barLCA').style.width = (rLCA.valorFinal/maxVal*100).toFixed(1) + '%';
  $('c_barRDC').style.width = (rRDC.valorFinal/maxVal*100).toFixed(1) + '%';
  $('c_barLCAval').textContent = fmtBRL(rLCA.valorFinal);
  $('c_barRDCval').textContent = fmtBRL(rRDC.valorFinal);

  let headline, body;
  if(Math.abs(diff) < 0.01){
    headline = 'Empate técnico entre ' + nomeEsq + ' e RDC';
    body = 'Nas condições informadas, os dois produtos entregam praticamente o mesmo valor líquido final. Considere outros fatores, como liquidez, carência e garantia do FGC/FGCoop.';
  } else if(diff > 0){
    $('c_tagLCA').style.display = 'inline-block';
    $('c_cardLCA').classList.add('winner');
    const descEsq = indexadorLCA === 'pre' ? fmtPct(rLCA.pBrutoAnual) + ' a.a. fixos' : fmtPct(rLCA.pBrutoAnual) + ' a.a. equivalentes';
    const motivoEsq = isEsquerdaLCA ? 'Isenta de IR' : 'Isenta de IOF';
    headline = 'A <b>' + nomeEsq + '</b> rende mais no líquido';
    body = motivoEsq + ' e rendendo ' + descEsq + ', a ' + nomeEsq + ' supera o RDC por ' + fmtBRL(diff) + ' no valor final líquido, uma diferença de ' + fmtPct((diff/pv)*100) + ' sobre o valor investido.';
  } else {
    $('c_tagRDC').style.display = 'inline-block';
    $('c_cardRDC').classList.add('winner');
    const descRDC = indexadorRDC === 'pre' ? fmtPct(rRDC.pBrutoAnual) + ' a.a. fixos' : fmtPct(rRDC.pBrutoAnual) + ' a.a. equivalentes';
    headline = 'O <b>RDC</b> rende mais no líquido';
    body = 'Mesmo pagando ' + irAliquota(dias) + '% de IR sobre o rendimento, o RDC rendendo ' + descRDC + ' supera a ' + nomeEsq + ' por ' + fmtBRL(Math.abs(diff)) + ' no valor final líquido, uma diferença de ' + fmtPct((Math.abs(diff)/pv)*100) + ' sobre o valor investido.';
  }
  $('c_verdictHeadline').innerHTML = headline;
  $('c_verdictBody').textContent = body;

  $('c_resultsBlock').style.display = 'block';
}
$('c_btnCalc').addEventListener('click', calcularComparacao);
$('c_btnCdi').addEventListener('click', ()=>buscarCDI('c_cdi', false, 'c_cdiStatus'));
$('c_btnIpca').addEventListener('click', async ()=>{
  await buscarIPCA('c_ipca', 'c_ipcaStatus');
  atualizarCaixasRealCmp();
});
$('c_ipca').addEventListener('input', atualizarCaixasRealCmp);

/* ------------- alternância do par comparado (LCA x Compromissada) ------------- */
let parComparacao = 'lca';

function selecionarParComparacao(par){
  parComparacao = par;
  $('c_parSwitch').querySelectorAll('.seg-opt').forEach(el=>{
    el.classList.toggle('active', el.dataset.par === par);
  });

  const accent = par === 'lca' ? 'var(--gold)' : 'var(--blue)';
  $('c_lca_block').style.setProperty('--accent', accent);
  $('c_lca_idxSwitch').style.setProperty('--accent', accent);
  $('c_cardLCA').style.setProperty('--accent', accent);
  $('c_lca_realBox').style.setProperty('--accent', accent);
  $('c_barLCA').style.background = accent;
  $('c_parSwitch').style.setProperty('--accent', accent);

  if(par === 'lca'){
    $('c_lca_blockTitle').textContent = 'LCA';
    $('c_lca_cardTitle').textContent = 'LCA';
    $('c_lca_cardDesc').textContent = DESC_PRODUTO.lca;
    $('c_barLCALabel').textContent = 'LCA';
    $('c_lca_realLabel').textContent = 'Rentabilidade Real de LCA (após IPCA)';
  } else {
    $('c_lca_blockTitle').textContent = 'Operação Compromissada';
    $('c_lca_cardTitle').textContent = 'Operação Compromissada';
    $('c_lca_cardDesc').textContent = DESC_PRODUTO.compromissada;
    $('c_barLCALabel').textContent = 'Compromissada';
    $('c_lca_realLabel').textContent = 'Rentabilidade Real da Compromissada (após IPCA)';
    $('c_prazoUnidade').value = 'dias';
  }
  $('c_lca_garantia').innerHTML = GARANTIA_PRODUTO[par];
  $('c_rdc_garantia').innerHTML = GARANTIA_PRODUTO.rdc;
  calcularComparacao();
}
$('c_parSwitch').querySelectorAll('.seg-opt').forEach(el=>{
  el.addEventListener('click', ()=>selecionarParComparacao(el.dataset.par));
});

function redesenharTodosGraficos(){
  if(ultimoGrafico) desenharGraficoLinha('s_chart', ultimoGrafico.pontos, ultimoGrafico.cor);
  if(ultimoGraficoCmp) desenharGraficoMultiplo('c_chart', ultimoGraficoCmp);
  if(ultimoGraficoCenarios) desenharGraficoMultiplo('s_cenarioChart', ultimoGraficoCenarios);
}

let resizeTimer;
window.addEventListener('resize', ()=>{
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(redesenharTodosGraficos, 150);
});

/* ---------------- TEMA CLARO/ESCURO ---------------- */
Tema.ligarBotao($('btnTema'), ()=> setTimeout(redesenharTodosGraficos, 50));

aplicarMascaraMoeda('s_valor');
aplicarMascaraMoeda('s_aporte');
aplicarMascaraMoeda('c_valor');

['s_refCdb','s_refTr'].forEach(id=>$(id).addEventListener('input', ()=>calcularSimulacao()));
['s_cdiProj','c_cdiProj'].forEach(id=>$(id).addEventListener('change', e=>selecionarModoCDI(e.target.checked ? 'projetado' : 'constante')));
['s_prazo','s_prazoUnidade','c_prazo','c_prazoUnidade','s_cdi','c_cdi'].forEach(id=>$(id).addEventListener('change', renderCurvas));

/* primeira simulação automática */
$('c_prazo').addEventListener('change', calcularComparacao);
$('c_prazoUnidade').addEventListener('change', calcularComparacao);
selecionarTipo('lca');
selecionarParComparacao('lca');
