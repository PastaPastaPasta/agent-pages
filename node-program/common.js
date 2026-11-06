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
function wireTips(root = document) {
  root.querySelectorAll('[data-tip]').forEach(el => bindTip(el, el.dataset.tip));
  root.querySelectorAll('.pbar:not([aria-label])').forEach(b => { const t = [...b.querySelectorAll('[data-tip]')].map(x => x.dataset.tip).join('; '); if (t) { b.setAttribute('role', 'img'); b.setAttribute('aria-label', t); } });
}

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
      s += `<rect class="m" x="${x}" y="${y1}" width="${w}" height="${Math.max(y0 - y1 - (acc > v ? 2 : 0), 1)}" rx="3" fill="var(${se.color})"${d.dim ? ' fill-opacity="0.45"' : ''}/>`;
      tipTxt += `${se.label ? esc(se.label) + ': ' : ''}${v}<br>`; });
    s += `<rect class="hit-rect" data-i="${i}" x="${l + i * bw}" y="${t}" width="${bw}" height="${H - t - b}" fill="transparent"/>`;
    // d.always: always labelled (the last bar's label ends at the right edge); regular labels it would overlap are dropped
    const end = d.always && i === data.length - 1, clear = Math.ceil(80 / bw);
    if (d.always) s += `<text class="tick" x="${end ? x + w : x + w / 2}" y="${H - 8}" text-anchor="${end ? 'end' : 'middle'}">${esc(d.short || d.label)}</text>`;
    else if ((data.length <= 16 || i % Math.ceil(data.length / 12) === 0) && !data.some((o, j) => o.always && Math.abs(j - i) <= clear))
      s += `<text class="tick" x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${esc(d.short || d.label)}</text>`;
    d._tip = tipTxt;
  });
  svg.innerHTML = s;
  svg.querySelectorAll('.hit-rect').forEach(r => bindTip(r, data[+r.dataset.i]._tip));
}
function niceStep(max) { const raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw))); const n = raw / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }

// theme toggle
(() => {
  const root = document.documentElement, btn = document.getElementById('themebtn'); if (!btn) return;
  const modes = ['auto', 'light', 'dark']; let m = 'auto'; try { m = localStorage.getItem('np-theme') || 'auto'; } catch (e) {}
  const apply = () => { if (m === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', m); btn.textContent = ({ auto: '◐ auto', light: '☀ light', dark: '☾ dark' })[m]; btn.setAttribute('aria-label', 'Theme: ' + m); dispatchEvent(new Event('themechange')); };
  btn.onclick = () => { m = modes[(modes.indexOf(m) + 1) % 3]; try { localStorage.setItem('np-theme', m); } catch (e) {} apply(); };
  apply();
})();

// "Status now": one row per line of work, with its fork / integration / upstream steps, next gate and dated source.
const ACT = { moving: ['Moving', 'st-in_progress'], waiting: ['Waiting', 'u-held'], paused: ['Paused', 'st-not_started'], blocked: ['Blocked', 'st-blocked'], done: ['Done', 'st-merged'] };
const actPill = a => `<span class="pill ${(ACT[a] || ACT.waiting)[1]}" data-act="${esc(a)}">${(ACT[a] || [a])[0]}</span>`;
const STEP = { done: ['done', '--s-merged'], partial: ['part', '--s-partial'], none: ['not yet', '--s-none'], na: ['n/a', '--line'] };
const WHEN = { deadline: 'Deadline', plan: 'Plan target', estimate: 'Estimate', unknown: 'Date unknown', none: 'No set date' };
const prStateOf = p => (p.state === 'open' && p.draft ? 'draft' : p.state);
function fillVars(s, v) { return String(s ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)); }
const prPill = (repo, n, st) => `<a class="pill ${st === 'merged' ? 'u-up' : st === 'open' ? 'u-open' : st === 'draft' ? 'u-held' : 'u-none'}" href="https://github.com/dashpay/${repo === 'bsdk' ? 'base-sdk' : 'rust-dashcore'}/pull/${n}" data-pr="${repo}#${n}" data-prstate="${esc(st)}">#${n} ${esc(st)}</a>`;
const WHEN_CLS = { deadline: 'u-held', plan: 'st-design' };
const whenDate = (r, vars) => (r.when.date ? fillVars(r.when.date, vars) : '');
const normRow = r => ({ ...r, when: r.when || { kind: 'unknown' }, stage: r.stage || [], src: r.src || [] });
const sortKey = d => { const m = String(d).match(/(\d{4}-\d\d-\d\d)(?:[ T](\d\d:\d\d))?/); return m ? m[1] + 'T' + (m[2] || '23:59') : '9999'; };
// "Status now", compact: one line per line of work; steps, next gate, owner and dated sources open per row
function renderStatusNow(el, S, page, vars, prState, snap, detail = {}) {
  const rows = S.rows.filter(r => r.pages.includes(page)).map(normRow);
  const f = s => esc(fillVars(s, vars));
  const src = r => r.src.map(x => { const at = x.at === 'snapshot' ? snap : x.at; return `${x.url ? `<a href="${esc(x.url)}">${esc(x.label)}</a>` : esc(x.label)}, <span class="mono" data-at="${esc(at)}">${esc(at)}</span>`; }).join('; ');
  const st = r => r.stage.filter(s => s[0]);
  const dots = r => `<span class="dots3" role="img" aria-label="${esc(st(r).map(([l, s]) => `${l}: ${(STEP[s] || [s])[0]}`).join('; '))}">${st(r).map(([l, s]) => `<i class="d-${esc(s)}" title="${esc(l)}: ${esc((STEP[s] || [s])[0])}"></i>`).join('')}</span>`;
  el.innerHTML = `<p class="sub">${esc(S.note)} Dots: <span class="dots3 inl"><i class="d-done"></i></span> done, <span class="dots3 inl"><i class="d-partial"></i></span> partly, <span class="dots3 inl"><i class="d-none"></i></span> not yet, <span class="dots3 inl"><i class="d-na"></i></span> does not apply, for the row's steps (built, landed, upstream or released).</p>
  <div class="statusnow">${rows.map(r => `<details class="srow" data-row="${esc(r.id)}"><summary>
    <span class="sl"><b>${esc(r.line)}</b> ${actPill(r.act)}</span>${dots(r)}<span class="sh"><span class="lab">Next</span>${f(r.next)}</span><span class="sw" data-when="${esc(r.when.kind)}">${r.when.short ? f(r.when.short).replace(/\b2026-/g, '') : '<span aria-hidden="true">—</span><span class="vh">no date recorded</span>'}</span></summary>
    <div class="sbody">
      <div class="steps3">${st(r).map(([lab, s, note]) => `<div class="st3" style="--sc:var(${(STEP[s] || STEP.none)[1]})" data-step="${esc(s)}"><b>${esc(lab)}</b> <span class="muted">${esc((STEP[s] || [s])[0])}</span>${note ? ` <span class="small muted">· ${f(note)}</span>` : ''}</div>`).join('')}</div>
      <div><span class="lab">Now</span> ${f(r.now)}${r.prs ? ` <span class="prs">${r.prs.map(([repo, n]) => prPill(repo, n, prState[`${repo}#${n}`] || 'unknown')).join(' ')}</span>` : ''}</div>
      <div><span class="lab">Owner</span> ${esc(r.who)}</div>
      <div><span class="lab">Checkpoint</span> <span class="pill ${WHEN_CLS[r.when.kind] || 'st-not_started'}">${esc(WHEN[r.when.kind] || r.when.kind)}</span> ${f(r.when.text)}</div>
      <div class="small muted"><span class="lab">Source</span> ${src(r)}${detail[r.id] ? ` · <a href="${esc(detail[r.id])}">Details →</a>` : ''}</div>
    </div></details>`).join('')}</div>`;
}
// "#brief": the first thing on each page. Now (moving lines), next checkpoints by date, and what waits on whom.
function renderBrief(el, o) {
  const { S, page, vars, snap, docs } = o, f = s => esc(fillVars(s, vars));
  const rows = S.rows.filter(r => r.pages.includes(page)).map(normRow), byId = Object.fromEntries(rows.map(r => [r.id, r]));
  const now = (o.now || rows.filter(r => r.act === 'moving').map(r => r.id)).map(i => byId[i]).filter(Boolean);
  const waiting = rows.filter(r => r.act === 'waiting' || r.act === 'blocked');
  const cks = [...rows.filter(r => r.when.date).map(r => ({ d: whenDate(r, vars), kind: r.when.kind, text: r.when.what || r.line })), ...(o.extra || [])]
    .filter(c => sortKey(c.d) === '9999' || sortKey(c.d).slice(0, 10) >= snap.slice(0, 10)).sort((a, b) => sortKey(a.d).localeCompare(sortKey(b.d)));
  const undated = rows.filter(r => !r.when.date && r.when.kind !== 'none').map(r => r.short);
  const moving = rows.filter(r => r.act === 'moving').length;
  const fmt = d => esc(String(d).replace(/^2026-/, ''));
  el.innerHTML = `<div class="brief-h"><span>Snapshot <b class="mono">${esc(snap.slice(5))}</b> (git, GitHub) · status notes as of docs commit ${esc(docs)}</span><span><b>${moving}</b> of ${rows.length} lines of work moving, <b data-waitcount="${waiting.length}">${waiting.length}</b> waiting on others</span>${cks[0] ? `<span>next checkpoint <b class="mono">${fmt(cks[0].d)}</b></span>` : ''}</div>
  <div class="brief-g">
    <div><h3>Now</h3><ul class="bl" data-brief="now">${now.map(r => `<li data-row="${esc(r.id)}">${f(r.headline)}</li>`).join('')}${(o.nowExtra || []).map(x => `<li>${x}</li>`).join('')}</ul></div>
    <div><h3>${o.seq && !cks.length ? 'Next, in order' : 'Next checkpoints'}</h3>${cks.length || !o.seq ? `<ol class="cks" data-brief="next">${cks.map(c => `<li data-date="${esc(c.d)}"><span class="mono d">${fmt(c.d)}</span><span>${esc(c.text)} <span class="pill ${WHEN_CLS[c.kind] || 'st-not_started'}">${esc(WHEN[c.kind] || c.kind)}</span></span></li>`).join('')}</ol>` : ''}${o.seq && cks.length ? '<p class="small muted" style="margin:8px 0 2px">Then, in order (no dates):</p>' : ''}${o.seq ? `<ol class="cks"${cks.length ? ' data-brief-seq' : ' data-brief="next"'}>${o.seq.map((t, i) => `<li data-seq="${i + 1}"><span class="mono d">${i + 1}.</span><span>${esc(t)}</span></li>`).join('')}</ol>` : ''}
      ${o.seq && !cks.length ? `<p class="small muted" style="margin:6px 0 0">No dates are known for these steps; each waits on review.</p>` : undated.length ? `<p class="small muted" style="margin:6px 0 0">No date known: ${esc(undated.join('; '))}.</p>` : ''}</div>
    <div><h3>Waiting on others</h3><ul class="bl" data-brief="waiting">${waiting.map(r => `<li data-row="${esc(r.id)}"><b>${esc(r.who)}</b>: ${f(r.headline)}</li>`).join('') || '<li class="muted">Nothing.</li>'}</ul></div>
  </div>`;
}
// page furniture: the on-page contents follow the h2 order; links into closed <details> open them
function buildToc() {
  document.querySelectorAll('.toc[data-auto]').forEach(t => t.innerHTML = [...document.querySelectorAll('.wrap > h2[id]')].map(h => `<a href="#${h.id}">${esc(h.dataset.short || h.textContent)}</a>`).join(''));
}
function openTo(id) {
  const el = id && document.getElementById(id); if (!el) return;
  for (let p = el; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
  el.scrollIntoView({ block: 'start' });
}
const hashId = h => { try { return decodeURIComponent(h.slice(1)); } catch (e) { return h.slice(1); } };
addEventListener('hashchange', () => openTo(hashId(location.hash)));
addEventListener('load', () => { if (location.hash) openTo(hashId(location.hash)); });
document.addEventListener('click', e => { const a = e.target.closest('a[href^="#"]'); if (a && a.getAttribute('href').length > 1) { const id = hashId(a.getAttribute('href')); const el = document.getElementById(id); if (el && el.closest('details:not([open])')) { e.preventDefault(); history.pushState(null, '', '#' + id); openTo(id); } } });
// compact list of tasks for the "now" views: one line now, one line next, full history behind a disclosure
const WAIT_STATES = ['in_progress', 'ready', 'partial', 'blocked'];
function nowSets(all) {
  return { moving: all.filter(t => t.act === 'moving'), waiting: all.filter(t => WAIT_STATES.includes(t.state) && t.act !== 'moving') };
}
function splitCount(list) {
  const s = list.filter(t => t.kind === 'slice').length, p = list.length - s;
  return `${p} planned task${p === 1 ? '' : 's'}${s ? ` + ${s} slice${s === 1 ? '' : 's'}` : ''}`;
}
function daysOld(at, snap) {
  const m = String(at || '').match(/(?:(\d{4})-)?(\d\d)-(\d\d)(?!\d)/), s = String(snap || '').match(/(\d{4})-(\d\d)-(\d\d)/);
  return m && s ? Math.round((Date.UTC(+s[1], s[2] - 1, +s[3]) - Date.UTC(+(m[1] || s[1]), m[2] - 1, +m[3])) / 864e5) : null;
}
function depNote(t, all) {
  if (t.state !== 'blocked' && t.state !== 'not_started') return '';
  const by = Object.fromEntries(all.map(x => [x.id, x]));
  const open = (t.deps || []).map(d => by[d]).filter(d => d && d.state !== 'merged');
  if (!open.length) return '';
  const sl = d => { const n = all.filter(x => x.parent === d.id && x.state === 'merged').length; return n ? `, ${n} slice${n === 1 ? '' : 's'} in` : ''; };
  return 'on ' + open.map(d => d.state === 'partial' ? `${d.id} (partly merged${sl(d)})` : `${d.id} (${(STATES[d.state] || { label: d.state }).label.toLowerCase()})`).join(', ');
}
function taskNowRow(t, href, snap, all) {
  const age = daysOld(t.nowAt || t.stateDate, snap), dn = all ? depNote(t, all) : '';
  return `<tr data-task="${esc(t.id)}" data-act="${esc(t.act || '')}"><td class="id">${href ? `<a href="${href}">${esc(t.id)}</a>` : esc(t.id)}${t.owner && t.owner !== t.id ? `<div class="small muted" style="font-weight:400" title="the work lane that runs this task">lane ${esc(t.owner)}</div>` : ''}</td>
    <td>${statePill(t.state)}${dn ? `<div class="small" data-dep>${esc(dn)}</div>` : ''}<div class="small muted">${esc(t.nowAt || t.stateDate || '')}</div>${age >= 3 ? `<div class="small" data-stale="${age}" style="color:var(--warn)">no update in ${age} days</div>` : ''}</td>
    <td class="small"><b>${esc(t.title)}</b><div>${esc(t.now || t.stateNote)}</div>${t.next ? `<div class="muted"><b>Next:</b> ${esc(t.next)}</div>` : ''}${t.now && t.stateNote ? `<details class="hist"><summary>History</summary><div class="muted">${esc(t.stateNote)}</div></details>` : ''}</td></tr>`;
}
// waiting tasks in three closed groups: on a dependency, partly merged, the rest
function waitGroups(el, waiting, href, snap, all) {
  const G = [['dep', 'Waiting on another task', t => t.state === 'blocked' || t.state === 'not_started'], ['part', 'Partly merged: the next slice is not moving', t => t.state === 'partial'], ['rest', 'In progress or ready, but paused or waiting', () => true]];
  const left = [...waiting];
  el.innerHTML = G.map(([k, lab, fn]) => { const xs = left.filter(fn); xs.forEach(x => left.splice(left.indexOf(x), 1)); if (!xs.length) return '';
    const stale = xs.filter(t => daysOld(t.nowAt || t.stateDate, snap) >= 3).length;
    return `<details class="grp" data-group="${k}"><summary><b>${xs.length}</b> ${esc(lab)}${stale ? ` <span class="small" style="color:var(--warn)">· ${stale} with no update in 3+ days</span>` : ''}</summary><div class="tbl"><table class="cards"><tr><th>Task</th><th>State · as of</th><th>Why it is not moving</th></tr>${xs.map(t => taskNowRow(t, href(t), snap, all)).join('')}</table></div></details>`; }).join('');
}
// milestone label: merged of the live (not dropped) tasks
function msCount(ts) { const c = {}; ts.forEach(t => c[t.state] = (c[t.state] || 0) + 1); const d = c.dropped || 0; return `${c.merged || 0}/${ts.length - d} merged${d ? ` · ${d} dropped` : ''}`; }
// phone: the milestone chart becomes a list with full dates
function msList(el, ms, tasksOf) {
  el.innerHTML = `<table class="mslist"><tr><th>Milestone</th><th>Plan target</th><th>Tasks</th></tr>${ms.map(m => `<tr><td><b>${esc(m.id)}</b> ${esc(m.name)}</td><td class="mono">${esc(m.target)}</td><td class="small" data-msct>${msCount(tasksOf(m))}</td></tr>`).join('')}</table>`;
}
function todayMarker(x, top, H, date) {
  return `<g data-today="${esc(date)}"><line x1="${x}" x2="${x}" y1="${top - 8}" y2="${H}" stroke="var(--bad)" stroke-width="1.5" stroke-dasharray="3 3"/><text x="${x + 4}" y="${top - 2}" font-size="10.5" fill="var(--bad)">today ${esc(date.slice(5))}</text></g>`;
}
