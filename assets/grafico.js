/*
 * Gráfico de linhas em canvas (sem bibliotecas) — usado pelo Planejamento e pela
 * Estratégia de Aquisição. Cores vêm dos tokens do tema; o gráfico se redesenha
 * ao trocar o tema ou a largura chamando desenhar() de novo com a mesma config.
 *
 * Grafico.desenhar(canvas, cfg) → geometria (ou null se o canvas estiver oculto)
 * cfg:
 *   series:      [{nome, cor, pontos:[{x,y}], dash?, marcador?:{x,y}}]
 *   altura:      px (padrão 280)
 *   escala:      'zero' (eixo y de 0 até o máximo + 8%) ou 'auto' (aceita negativos)
 *   yExtra:      valores que o eixo y deve alcançar (ex.: uma linha de referência)
 *   xMin, xMax:  limites do eixo x (padrão: os dos pontos)
 *   passoX:      função (amplitude) → passo dos rótulos do eixo x
 *   rotuloX:     texto do eixo x ('idade', 'anos')
 *   linhasH:     [{y, cor, rotulo, corRotulo}] linhas horizontais tracejadas
 *   vline:       {x, rotulo, alinhar:'auto'|'esquerda'} linha vertical tracejada
 *   fmtY:        função de rótulo do eixo y (padrão Formato.curto)
 * Grafico.tooltip(canvas, tt, obter) liga o tooltip; obter() devolve
 *   {geo, html(xv)} do gráfico atual, e o tooltip fica a `topo` px do topo.
 */
(function () {
  'use strict';
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  function desenhar(canvas, cfg) {
    const W = canvas.parentElement.clientWidth - 36;
    if (W <= 0) return null; // aba oculta: desenha ao abrir
    const H = cfg.altura || 280, dpr = window.devicePixelRatio || 1;
    const fmtY = cfg.fmtY || window.Formato.curto;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.font = '10.5px Arial, Helvetica, sans-serif';
    const all = cfg.series.flatMap(s => s.pontos);
    let yMin, yMax, padL;
    if (cfg.escala === 'auto') {
      if (!all.length) return null;
      yMax = Math.max(...all.map(p => p.y), ...(cfg.yExtra || []), 1);
      yMin = Math.min(...all.map(p => p.y), 0);
      const span = (yMax - yMin) || 1;
      yMax += span * 0.06; if (yMin < 0) yMin -= span * 0.04;
      padL = Math.ceil(Math.max(ctx.measureText(fmtY(yMax)).width, ctx.measureText(fmtY(yMin)).width)) + 16;
    } else {
      const yMaxPrev = Math.max(...all.map(p => p.y), 1) * 1.08;
      padL = Math.ceil(ctx.measureText(fmtY(yMaxPrev)).width) + 16;
      if (!all.length) return null;
      yMax = Math.max(...all.map(p => p.y)); yMin = 0;
      yMax = yMax > 0 ? yMax * 1.08 : 1;
    }
    const pad = { t: 14, r: 14, b: 28, l: padL };
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const xMin = cfg.xMin !== undefined ? cfg.xMin : Math.min(...all.map(p => p.x));
    const xMax = cfg.xMax !== undefined ? cfg.xMax : Math.max(...all.map(p => p.x));
    const X = x => pad.l + (xMax === xMin ? 0 : (x - xMin) / (xMax - xMin) * pw);
    const Y = y => pad.t + ph - (y - yMin) / (yMax - yMin) * ph;
    const grid = cssVar('--grid'), faint = cssVar('--ink-faint');
    ctx.font = '10.5px Arial, Helvetica, sans-serif';
    ctx.fillStyle = faint; ctx.strokeStyle = grid; ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const v = yMin + (yMax - yMin) * g / 4, y = Y(v);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(fmtY(v), pad.l - 8, y + 3);
    }
    if (yMin < 0) { ctx.save(); ctx.strokeStyle = faint; ctx.beginPath(); ctx.moveTo(pad.l, Y(0)); ctx.lineTo(W - pad.r, Y(0)); ctx.stroke(); ctx.restore(); }
    // eixo x
    ctx.textAlign = 'center';
    const span = xMax - xMin;
    const stepX = (cfg.passoX || (s => s > 50 ? 10 : (s > 20 ? 5 : (s > 8 ? 2 : 1))))(span);
    for (let x = Math.ceil(xMin / stepX) * stepX; x <= xMax + 1e-9; x += stepX) ctx.fillText(Math.round(x) + '', X(x), H - 10);
    ctx.textAlign = 'left'; ctx.fillText(cfg.rotuloX || '', pad.l, H - 0.5);
    (cfg.linhasH || []).forEach(l => {
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = l.cor;
      ctx.beginPath(); ctx.moveTo(pad.l, Y(l.y)); ctx.lineTo(W - pad.r, Y(l.y)); ctx.stroke(); ctx.restore();
      if (l.rotulo) { ctx.fillStyle = l.corRotulo || l.cor; ctx.textAlign = 'right'; ctx.fillText(l.rotulo, W - pad.r - 4, Y(l.y) - 5); }
    });
    if (cfg.vline) {
      const vx = X(cfg.vline.x);
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = faint;
      ctx.beginPath(); ctx.moveTo(vx, pad.t); ctx.lineTo(vx, pad.t + ph); ctx.stroke(); ctx.restore();
      ctx.fillStyle = faint;
      ctx.textAlign = cfg.vline.alinhar === 'esquerda' ? 'left' : (vx > W - 110 ? 'right' : 'left');
      ctx.fillText(cfg.vline.rotulo, vx + (ctx.textAlign === 'left' ? 5 : -5), pad.t + 10);
    }
    cfg.series.forEach(s => {
      ctx.save();
      if (s.dash) ctx.setLineDash([6, 4]);
      ctx.strokeStyle = s.cor; ctx.lineWidth = s.dash ? 1.5 : 2.2;
      ctx.beginPath();
      s.pontos.forEach((p, i) => { const x = X(p.x), y = Y(p.y); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke(); ctx.restore();
      if (s.marcador) { ctx.beginPath(); ctx.arc(X(s.marcador.x), Y(s.marcador.y), 3.5, 0, Math.PI * 2); ctx.fillStyle = s.cor; ctx.fill(); }
    });
    return { X, Y, xMin, xMax, pad, pw, W };
  }

  function tooltip(canvas, tt, obter, topo) {
    const mover = ev => {
      const atual = obter(); if (!atual || !atual.geo) return;
      const r = canvas.getBoundingClientRect();
      const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      const { xMin, xMax, pad, pw, W } = atual.geo;
      if (px < pad.l || px > pad.l + pw) { tt.style.display = 'none'; return; }
      const xv = xMin + (px - pad.l) / pw * (xMax - xMin);
      tt.innerHTML = atual.html(xv);
      tt.style.display = 'block';
      tt.style.left = Math.max(10, Math.min(px + 30, W - tt.offsetWidth + 10)) + 'px';
      tt.style.top = (topo || 54) + 'px';
    };
    canvas.addEventListener('mousemove', mover);
    canvas.addEventListener('touchmove', mover, { passive: true });
    canvas.addEventListener('mouseleave', () => { tt.style.display = 'none'; });
  }

  window.Grafico = { desenhar, tooltip, cssVar };
})();
