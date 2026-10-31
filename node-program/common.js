// Shared helpers for the node-program status pages.
const STATES = {
  merged:      { label: 'Merged',      v: '--s-merged' },
  partial:     { label: 'Partly merged', v: '--s-partial' },
  ready:       { label: 'Ready',       v: '--s-ready' },
  in_progress: { label: 'In progress', v: '--s-progress' },
  design:      { label: 'Design',      v: '--s-design' },
  blocked:     { label: 'Blocked',     v: '--s-blocked' },
  not_started: { label: 'Not started', v: '--s-none' },
  dropped:     { label: 'Dropped',     v: '--s-dropped' },
};
const STATE_ORDER = ['merged', 'partial', 'ready', 'in_progress', 'design', 'blocked', 'not_started', 'dropped'];
const WS_COLORS = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6', '--c7', '--c8'];

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const statePill = s => `<span class="pill st-${s}">${(STATES[s] || { label: s }).label}</span>`;

// tooltip
const tip = document.createElement('div'); tip.id = 'tip'; document.body.appendChild(tip);
function moveTip(e) { const w = tip.offsetWidth, h = tip.offsetHeight; let x = e.clientX + 14, y = e.clientY + 14;
  if (x + w > innerWidth - 8) x = e.clientX - w - 14; if (y + h > innerHeight - 8) y = e.clientY - h - 14;
  tip.style.left = x + 'px'; tip.style.top = y + 'px'; }
function bindTip(el, html) {
  el.addEventListener('mouseenter', e => { tip.innerHTML = html; tip.style.opacity = 1; moveTip(e); });
  el.addEventListener('mousemove', moveTip);
  el.addEventListener('mouseleave', () => { tip.style.opacity = 0; });
}

// stacked state bar (HTML)
function stateBar(counts, total) {
  total = total || Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return `<div class="pbar">${STATE_ORDER.filter(s => counts[s]).map(s =>
    `<span class="hit" data-tip="${STATES[s].label}: ${counts[s]}" style="width:${counts[s] / total * 100}%;background:var(${STATES[s].v})"></span>`).join('')}</div>`;
}
function stateLegend(only) {
  return `<div class="legend">${STATE_ORDER.filter(s => !only || only.includes(s)).map(s =>
    `<span><i style="background:var(${STATES[s].v})"></i>${STATES[s].label}</span>`).join('')}</div>`;
}
function wireTips(root = document) { root.querySelectorAll('[data-tip]').forEach(el => bindTip(el, el.dataset.tip)); }

// generic vertical bar chart (weeks)
function barChart(svg, data, opts = {}) {
  const W = svg.clientWidth || 600, H = opts.h || 180, l = 34, r = 8, t = 10, b = 24;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('height', H);
  const series = opts.series || [{ key: 'v', color: '--c1', label: '' }];
  const max = Math.max(1, ...data.map(d => series.reduce((a, s) => a + (d[s.key] || 0), 0)));
  const step = niceStep(max), top = Math.ceil(max / step) * step;
  const bw = (W - l - r) / data.length, y = v => t + (H - t - b) * (1 - v / top);
  let s = '';
  for (let v = 0; v <= top; v += step) s += `<line class="gl" x1="${l}" x2="${W - r}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${l - 6}" y="${y(v) + 3}" text-anchor="end">${v}</text>`;
  data.forEach((d, i) => {
    let acc = 0; const x = l + i * bw + 3, w = Math.max(bw - 6, 2);
    let tipTxt = `<b>${esc(d.label)}</b>`;
    series.forEach(se => { const v = d[se.key] || 0; if (!v) return; const y0 = y(acc), y1 = y(acc + v); acc += v;
      s += `<rect class="m" x="${x}" y="${y1}" width="${w}" height="${Math.max(y0 - y1 - (acc > v ? 2 : 0), 1)}" rx="3" fill="var(${se.color})"/>`;
      tipTxt += `${se.label ? esc(se.label) + ': ' : ''}${v}<br>`; });
    s += `<rect class="hit-rect" data-i="${i}" x="${l + i * bw}" y="${t}" width="${bw}" height="${H - t - b}" fill="transparent"/>`;
    if (data.length <= 16 || i % Math.ceil(data.length / 12) === 0) s += `<text class="tick" x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${esc(d.short || d.label)}</text>`;
    d._tip = tipTxt;
  });
  svg.innerHTML = s;
  svg.querySelectorAll('.hit-rect').forEach(r => bindTip(r, data[+r.dataset.i]._tip));
}
function niceStep(max) { const raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw))); const n = raw / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }

// theme toggle
(() => {
  const root = document.documentElement, btn = document.getElementById('themebtn'); if (!btn) return;
  const modes = ['auto', 'light', 'dark']; let m = localStorage.getItem('np-theme') || 'auto';
  const apply = () => { if (m === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', m); btn.textContent = 'Theme: ' + m; dispatchEvent(new Event('themechange')); };
  btn.onclick = () => { m = modes[(modes.indexOf(m) + 1) % 3]; localStorage.setItem('np-theme', m); apply(); };
  apply();
})();
