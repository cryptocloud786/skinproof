import { YouCamClient, normalizeSkin } from './youcam.js';
import { CONCERNS, PRODUCTS, GOALS, rankProducts, simIntensities, verdict } from './catalog.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const LS = 'skinproof.v1';
const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="260" height="350"><rect width="100%" height="100%" rx="14" fill="#f3ede6"/><rect x="10" y="10" width="240" height="330" rx="10" fill="none" stroke="#d9cbbd" stroke-width="2" stroke-dasharray="8 6"/><text x="130" y="170" text-anchor="middle" font-family="system-ui" font-size="16" fill="#8a7d72">Next check-in</text><text x="130" y="194" text-anchor="middle" font-family="system-ui" font-size="12" fill="#a39488">same light, same angle</text></svg>');

// ---------------- state ----------------
const state = Object.assign({
  baseline: null,      // { analysis, thumb, source }
  tracking: null,      // { productId, startDate, baseline: {analysis, thumb} }
  checkins: [],        // [{ date, analysis, thumb, source }]
  cart: [],
}, JSON.parse(localStorage.getItem(LS) || '{}'));
const save = () => localStorage.setItem(LS, JSON.stringify(state));

const settings = {
  key: localStorage.getItem('skinproof.key') || sessionStorage.getItem('skinproof.key') || '',
  region: localStorage.getItem('skinproof.region') || 'india',
  proxy: false,
};
let current = { blob: null, url: null, isSample: null }; // image prepared in the cropper
let lastAnalysis = null; // in-memory (has fresh mask urls)

const isLive = () => settings.proxy || !!settings.key;
const client = () => new YouCamClient({ mode: settings.proxy ? 'proxy' : 'direct', apiKey: settings.key, region: settings.region });

// ---------------- helpers ----------------
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600); }
function status(el, msg, err) { el.innerHTML = msg; el.classList.toggle('err', !!err); }
const spin = (m) => `<span class="spinner"></span>${m}`;
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const today = () => new Date().toISOString().slice(0, 10);
const band = (v) => (v < 68 ? 'lo' : v < 78 ? 'mid' : 'hi');
const inr = (n) => '₹' + n.toLocaleString('en-IN');

function go(step) {
  $$('.steps button').forEach((b) => b.classList.toggle('active', b.dataset.step === step));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + step));
  if (step === 'match') renderMatch();
  if (step === 'track') renderTrack();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
$$('.steps button').forEach((b) => b.onclick = () => go(b.dataset.step));

function updateBadge() {
  const b = $('#modeBadge');
  b.textContent = settings.proxy ? 'Live · server key' : settings.key ? 'Live · your key' : 'Demo · recorded API results';
  b.classList.toggle('live', isLive());
}

// ---------------- cropper ----------------
const cv = $('#cropCanvas'), ctx = cv.getContext('2d');
let img = null;
function loadImage(src, isSample) {
  return new Promise((res, rej) => {
    const i = new Image(); i.crossOrigin = 'anonymous';
    i.onload = () => { img = i; current.isSample = isSample; $('#dropHint').classList.add('hidden'); $('#cropControls').classList.remove('hidden');
      if (isSample) { $('#zoom').value = 1; $('#offX').value = 0; $('#offY').value = 0; }
      drawCrop(); $('#analyzeBtn').disabled = false; res(); };
    i.onerror = rej; i.src = src;
  });
}
function layout(W, H) {
  const z = +$('#zoom').value, ox = +$('#offX').value, oy = +$('#offY').value;
  const s = Math.max(W / img.width, H / img.height) * z;
  const w = img.width * s, h = img.height * s;
  return { x: (W - w) / 2 - ox * w, y: (H - h) / 2 - oy * h, w, h };
}
function drawCrop() {
  if (!img) return;
  const W = cv.width, H = cv.height, L = layout(W, H);
  ctx.fillStyle = '#fbf8f5'; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, L.x, L.y, L.w, L.h);
  // guide oval: face should fill ~68% of the width
  ctx.save(); ctx.fillStyle = 'rgba(247,243,238,.55)'; ctx.beginPath(); ctx.rect(0, 0, W, H);
  ctx.ellipse(W / 2, H * 0.46, W * 0.34, H * 0.33, 0, 0, Math.PI * 2, true); ctx.fill('evenodd');
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.beginPath();
  ctx.ellipse(W / 2, H * 0.46, W * 0.34, H * 0.33, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}
function exportCrop() {
  const W = 1040, H = 1400, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), L = layout(W, H);
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.drawImage(img, L.x, L.y, L.w, L.h);
  return new Promise((r) => c.toBlob((b) => r({ blob: b, url: c.toDataURL('image/jpeg', 0.9), thumb: thumbOf(c) }), 'image/jpeg', 0.92));
}
function thumbOf(c) { const t = document.createElement('canvas'); t.width = 260; t.height = 350; t.getContext('2d').drawImage(c, 0, 0, 260, 350); return t.toDataURL('image/jpeg', 0.8); }
['zoom', 'offX', 'offY'].forEach((id) => $('#' + id).oninput = drawCrop);

const drop = $('#drop');
drop.onclick = () => $('#file').click();
drop.ondragover = (e) => { e.preventDefault(); drop.style.borderColor = 'var(--accent)'; };
drop.ondragleave = () => drop.style.borderColor = '';
drop.ondrop = (e) => { e.preventDefault(); drop.style.borderColor = ''; const f = e.dataTransfer.files[0]; if (f) loadImage(URL.createObjectURL(f), false); };
$('#file').onchange = (e) => { const f = e.target.files[0]; if (f) { $('#zoom').value = 1.4; loadImage(URL.createObjectURL(f), false); } };
$('#sampleBtn').onclick = () => loadImage('demo/week0/selfie.jpg', 'week0').then(() => toast('Sample selfie loaded (AI-generated person)'));

// ---------------- analysis ----------------
async function runAnalysis(sampleKey, statusEl) {
  if (!isLive()) {
    if (!sampleKey) { openSettings('Add your YouCam API key to analyse your own photo - or try the sample selfie.'); throw new Error('no-key'); }
    status(statusEl, spin('Replaying recorded YouCam API response…'));
    const data = await fetch(`demo/${sampleKey}/result.json`).then((r) => r.json());
    await new Promise((r) => setTimeout(r, 900));
    const a = normalizeSkin(data.data); a.source = 'recorded'; return a;
  }
  const t0 = Date.now();
  const crop = await exportCrop();
  const a = await client().analyzeSkin(crop.blob, (st, ms) => status(statusEl, spin(`YouCam AI Skin Analysis: ${st}… ${(ms / 1000).toFixed(0)}s`)));
  a.source = 'live'; a.ms = Date.now() - t0; a._crop = crop; return a;
}

$('#analyzeBtn').onclick = async () => {
  const btn = $('#analyzeBtn'); btn.disabled = true;
  status($('#scanStatus'), spin('Uploading selfie…'));
  try {
    const a = await runAnalysis(current.isSample, $('#scanStatus'));
    const crop = a._crop || await exportCrop(); delete a._crop;
    lastAnalysis = { ...a, imageUrl: a.source === 'recorded' ? `demo/${current.isSample}/selfie.jpg` : crop.url };
    state.baseline = { analysis: a, thumb: crop.thumb, sample: current.isSample };
    save(); renderResult(lastAnalysis);
    status($('#scanStatus'), a.source === 'live' ? `Done in ${(a.ms / 1000).toFixed(1)}s · 16 units` : 'Recorded result shown (add a key in Settings for live analysis).');
  } catch (e) { if (e.message !== 'no-key') status($('#scanStatus'), e.message, true); else status($('#scanStatus'), ''); }
  btn.disabled = false;
};

function renderResult(a) {
  $('#emptyResult').classList.add('hidden'); $('#result').classList.remove('hidden');
  $('#overallRing').style.setProperty('--v', a.overall || 0); $('#overallVal').textContent = a.overall ?? '-';
  $('#skinAge').textContent = a.skinAge ?? '-';
  $('#skinType').textContent = a.skinType.whole || '-';
  $('#zones').textContent = `${a.skinType.t_zone || '-'} / ${a.skinType.u_zone || '-'}`;
  $('#viewerImg').src = a.imageUrl; $('#viewerMask').src = ''; $('#viewerMask').classList.add('hidden');
  $('#viewerLabel').textContent = 'Tap a concern to see where it shows';
  const list = $('#concernList'); list.innerHTML = '';
  Object.entries(a.scores).sort((x, y) => x[1].ui - y[1].ui).forEach(([k, v]) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${CONCERNS[k]?.label || k}</span><b>${v.ui}</b><div class="bar"><i class="${band(v.ui)}" style="width:${v.ui}%"></i></div>`;
    li.onclick = () => {
      $$('#concernList li').forEach((x) => x.classList.remove('on')); li.classList.add('on');
      if (v.mask) { $('#viewerMask').src = v.mask; $('#viewerMask').classList.remove('hidden'); }
      $('#viewerLabel').textContent = `${CONCERNS[k]?.label}: ${v.ui}/100 (raw ${v.raw})`;
    };
    list.appendChild(li);
  });
  $('#sourceNote').textContent = a.source === 'recorded'
    ? 'Recorded response from a real YouCam AI Skin Analysis call (SD, 13 concerns) on 30 Oct 2026. Sample face is AI-generated.'
    : `Live YouCam AI Skin Analysis · ${fmtDate(a.at)} · masks expire after 2 hours.`;
}
$('#toMatch').onclick = () => go('match');

// ---------------- match ----------------
function renderMatch() {
  const grid = $('#productGrid'); grid.innerHTML = '';
  const base = state.baseline?.analysis;
  $('#needScan').classList.toggle('hidden', !!base);
  $('#goalBar').classList.toggle('hidden', !base);
  if (!base) return;
  const goals = state.goals || [];
  $('#goalChips').innerHTML = Object.entries(GOALS).map(([k, g]) => `<button class="goal${goals.includes(k) ? ' on' : ''}" data-g="${k}">${g.label}</button>`).join('');
  $$('#goalChips [data-g]').forEach((b) => b.onclick = () => {
    const g = b.dataset.g; state.goals = goals.includes(g) ? goals.filter((x) => x !== g) : [...goals, g]; save(); renderMatch();
  });
  const ranked = rankProducts(base, goals); const top = ranked[0].fit || 1;
  ranked.slice(0, 6).forEach((p, i) => {
    const pct = Math.round(97 * p.fit / top);
    const el = document.createElement('div'); el.className = 'card product' + (i === 0 ? ' rank1' : '');
    el.innerHTML = `
      <div class="ptop"><div><div class="type">${i === 0 ? 'Best match · ' : ''}${p.type}</div><h3>${p.name}</h3></div>
      <div class="fit">${pct}%<small>match</small></div></div>
      <div class="chips">${p.targets.map((t) => `<span class="chip t">${CONCERNS[t].label} ${base.scores[t]?.ui ?? ''}</span>`).join('')}</div>
      <div class="chips">${p.actives.map((a) => `<span class="chip">${a}</span>`).join('')}</div>
      ${p.why.length ? `<ul class="why">${p.why.map((w) => `<li>${w}</li>`).join('')}</ul>` : ''}
      ${p.warnings.map((w) => `<p class="warn">⚠ ${w}</p>`).join('')}
      <p class="muted" style="font-size:12px;margin:0">Visible results typically in ~${p.weeks} weeks</p>
      <div class="price">${inr(p.price)}</div>
      <div class="pactions">
        <button class="ghost" data-a="sim">Preview goal</button>
        <button class="ghost" data-a="cart">Add to cart</button>
        <button class="primary" data-a="track">Start tracking</button>
      </div>`;
    el.querySelector('[data-a=sim]').onclick = () => previewGoal(p);
    el.querySelector('[data-a=cart]').onclick = () => addToCart(p);
    el.querySelector('[data-a=track]').onclick = () => startTracking(p);
    grid.appendChild(el);
  });
}

async function previewGoal(p) {
  const m = $('#simModal'); m.classList.remove('hidden');
  $('#simTitle').textContent = `Goal preview · ${p.name}`;
  const beforeSrc = lastAnalysis?.imageUrl || state.baseline.thumb;
  $('#simBefore').src = beforeSrc; $('#simAfter').src = beforeSrc; setSlider(50);
  try {
    let url;
    if (!isLive()) {
      status($('#simStatus'), spin('Loading recorded simulation…'));
      url = (await fetch('demo/week0/simulation.json').then((r) => r.json())).data.results.url;
      $('#simBefore').src = 'demo/week0/selfie.jpg';
      status($('#simStatus'), 'Recorded YouCam AI Skin Simulation (acne 0.8, redness 0.7, oiliness 0.6). Add a key for a live preview of this product.');
    } else {
      if (!img) throw new Error('Load your selfie in step 1 first.');
      const crop = await exportCrop();
      const intens = simIntensities(p);
      status($('#simStatus'), spin('Running YouCam AI Skin Simulation…'));
      url = await client().simulate(crop.blob, intens, (st, ms) => status($('#simStatus'), spin(`Skin Simulation: ${st}… ${(ms / 1000).toFixed(0)}s`)));
      $('#simBefore').src = crop.url;
      status($('#simStatus'), `Simulated: ${Object.keys(intens).join(', ')}. Drag the slider to compare.`);
    }
    $('#simAfter').src = url;
  } catch (e) { status($('#simStatus'), e.message, true); }
}
function setSlider(v) {
  $('#simSlider').value = v; const wrap = $('#simAfterWrap'); wrap.style.width = v + '%';
  $('#simAfter').style.width = $('#compare').clientWidth + 'px';
}
$('#simSlider').oninput = (e) => setSlider(+e.target.value);
window.addEventListener('resize', () => setSlider(+$('#simSlider').value));

function startTracking(p) {
  state.tracking = { productId: p.id, startDate: today(), baseline: { analysis: stripMasks(state.baseline.analysis), thumb: state.baseline.thumb, sample: state.baseline.sample } };
  state.checkins = []; save();
  if (!state.cart.find((c) => c.id === p.id)) addToCart(p, true);
  toast(`Tracking ${p.name}`); go('track');
}
const stripMasks = (a) => ({ ...a, scores: Object.fromEntries(Object.entries(a.scores).map(([k, v]) => [k, { ui: v.ui, raw: v.raw }])) });

// ---------------- track ----------------
function renderTrack() {
  const t = state.tracking;
  $('#noTracking').classList.toggle('hidden', !!t); $('#tracking').classList.toggle('hidden', !t);
  if (!t) return;
  const p = PRODUCTS.find((x) => x.id === t.productId);
  $('#trackName').textContent = p.name;
  $('#trackMeta').textContent = `Started ${fmtDate(t.startDate)} · targets ${p.targets.map((c) => CONCERNS[c].label.toLowerCase()).join(', ')} · ~${p.weeks}-week window`;
  $('#baseThumb').src = t.baseline.thumb; $('#baseCap').textContent = `Baseline · overall ${t.baseline.analysis.overall}`;
  const last = state.checkins[state.checkins.length - 1];
  $('#lastThumb').src = last ? last.thumb : PLACEHOLDER;
  $('#lastCap').textContent = last ? `${fmtDate(last.date)} · overall ${last.analysis.overall}` : 'No check-in yet';
  if (!$('#checkDate').value) $('#checkDate').value = today();
  // history
  $('#history').innerHTML = [{ date: t.startDate, analysis: t.baseline.analysis, label: 'Baseline' }, ...state.checkins]
    .map((c, i) => `<li><span>${c.label || 'Check-in ' + i} · ${fmtDate(c.date)}</span><span>overall <b>${c.analysis.overall}</b>${c.source === 'recorded' ? ' · recorded' : ''}</span></li>`).join('');
  // verdict
  $('#noVerdict').classList.toggle('hidden', !!last); $('#verdict').classList.toggle('hidden', !last);
  if (!last) return;
  const v = verdict(p, t.baseline.analysis, last.analysis, daysBetween(t.startDate, last.date));
  $('#verdictBox').className = 'verdict ' + v.status; $('#verdictTitle').textContent = v.title; $('#verdictText').textContent = v.advice;
  $('#deltaRows').innerHTML = v.rows.map((r) => `<tr><td>${CONCERNS[r.concern].label}</td><td>${r.before}</td><td>${r.after}</td>
    <td class="${r.delta >= 2 ? 'up' : r.delta <= -2 ? 'down' : 'flat'}">${r.delta > 0 ? '+' : ''}${r.delta}</td></tr>`).join('');
  $('#verdictFine').textContent = `YouCam raw scores (1-100, higher = healthier). Changes under ±2 are treated as photo noise. Overall ${v.overallDelta >= 0 ? '+' : ''}${v.overallDelta} · ${v.weeks} weeks in.`;
  const acts = $('#verdictActions'); acts.innerHTML = '';
  if (v.status === 'good' || v.status === 'wait') {
    const b = document.createElement('button'); b.className = 'primary'; b.textContent = `Reorder · ${inr(p.price)}`; b.onclick = () => addToCart(p); acts.appendChild(b);
  }
  if (v.status === 'bad' || v.status === 'meh') {
    const alt = rankProducts(last.analysis, state.goals || []).find((x) => x.id !== p.id);
    const b = document.createElement('button'); b.className = 'primary'; b.textContent = `Switch to ${alt.name}`; b.onclick = () => { addToCart(alt); toast('Next-best match added to cart'); }; acts.appendChild(b);
  }
}

async function doCheckin(sampleKey) {
  const st = $('#checkStatus');
  try {
    const date = $('#checkDate').value || today();
    let a, thumb;
    if (sampleKey && !isLive()) { a = await runAnalysis(sampleKey, st); thumb = `demo/${sampleKey}/selfie.jpg`; }
    else {
      if (!isLive()) { openSettings('Add your YouCam API key to analyse your own check-in photo.'); return; }
      status(st, spin('Uploading check-in…'));
      a = await runAnalysis(null, st); thumb = a._crop.thumb; delete a._crop;
    }
    state.checkins.push({ date, analysis: stripMasks(a), thumb, source: a.source }); save();
    status(st, a.source === 'live' ? `Check-in analysed live in ${(a.ms / 1000).toFixed(1)}s` : 'Recorded check-in result used.');
    renderTrack();
  } catch (e) { if (e.message !== 'no-key') status(st, e.message, true); }
}
$('#checkFileBtn').onclick = () => $('#checkFile').click();
$('#checkFile').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  await loadImage(URL.createObjectURL(f), false);
  doCheckin(null);
};
$('#sampleCheckBtn').onclick = async () => {
  if (state.tracking) {
    const d = new Date(state.tracking.startDate); d.setDate(d.getDate() + 42);
    $('#checkDate').value = d.toISOString().slice(0, 10);
  }
  await loadImage('demo/week6/selfie.jpg', 'week6');
  doCheckin('week6');
};
$('#resetTrack').onclick = () => { if (confirm('Reset tracking and history?')) { state.tracking = null; state.checkins = []; save(); renderTrack(); } };

// ---------------- cart ----------------
function addToCart(p, silent) { state.cart.push({ id: p.id, name: p.name, price: p.price }); save(); renderCart(); if (!silent) toast('Added to cart'); }
function renderCart() {
  $('#cartCount').textContent = state.cart.length;
  $('#cartList').innerHTML = state.cart.map((c, i) => `<li><span>${c.name}</span><span>${inr(c.price)} <button class="link" data-rm="${i}">remove</button></span></li>`).join('') || '<li class="muted">Empty</li>';
  $('#cartTotal').textContent = inr(state.cart.reduce((a, c) => a + c.price, 0));
  $$('[data-rm]').forEach((b) => b.onclick = () => { state.cart.splice(+b.dataset.rm, 1); save(); renderCart(); });
}
$('#cartBtn').onclick = () => $('#cart').classList.remove('hidden');
$('#checkoutBtn').onclick = () => { toast('Demo store - no real checkout'); };

// ---------------- settings ----------------
function openSettings(note) {
  $('#settingsModal').classList.remove('hidden');
  $('#apiKey').value = settings.key; $('#region').value = settings.region;
  $('#remember').checked = !!localStorage.getItem('skinproof.key');
  $('#proxyNote').textContent = note || (settings.proxy ? 'This server already holds a YouCam API key - live analysis works without entering one.' : 'Paste your YouCam API key to run live analysis. Without a key the app replays recorded API responses for the sample selfie.');
}
$('#settingsBtn').onclick = () => openSettings();
$('#saveSettings').onclick = () => {
  settings.key = $('#apiKey').value.trim(); settings.region = $('#region').value;
  localStorage.removeItem('skinproof.key'); sessionStorage.removeItem('skinproof.key');
  if (settings.key) ($('#remember').checked ? localStorage : sessionStorage).setItem('skinproof.key', settings.key);
  localStorage.setItem('skinproof.region', settings.region);
  $('#settingsModal').classList.add('hidden'); updateBadge(); toast(isLive() ? 'Live mode on' : 'Demo mode');
};
$('#clearKey').onclick = () => { $('#apiKey').value = ''; };
$$('[data-close]').forEach((b) => b.onclick = () => b.closest('.modal, .drawer').classList.add('hidden'));

// ---------------- boot ----------------
(async function boot() {
  try { const h = await fetch('api/health').then((r) => r.ok ? r.json() : {}); settings.proxy = !!h.proxy; } catch { /* static hosting */ }
  updateBadge(); renderCart();
  if (state.baseline) {
    lastAnalysis = { ...state.baseline.analysis, imageUrl: state.baseline.sample ? `demo/${state.baseline.sample}/selfie.jpg` : state.baseline.thumb };
    renderResult(lastAnalysis);
  }
  const params = new URLSearchParams(location.search);
  if (params.get('step')) go(params.get('step'));
})();
