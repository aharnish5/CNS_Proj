// ---------- Math helpers (mirrors the Java version) ----------
const $ = s => document.querySelector(s);
const mod = a => ((a % 26) + 26) % 26;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const ch = v => String.fromCharCode(65 + v);

function modInverse(a) {
  a = mod(a);
  for (let x = 1; x < 26; x++) if ((a * x) % 26 === 1) return x;
  return -1;
}
const minor = (m, r, c) => m.filter((_, i) => i !== r).map(w => w.filter((_, j) => j !== c));
// determinant by cofactor expansion along the first row
const det = m =>
  m.length === 1 ? m[0][0]
  : m.length === 2 ? m[0][0] * m[1][1] - m[0][1] * m[1][0]
  : m[0].reduce((s, v, j) => s + (j % 2 ? -1 : 1) * v * det(minor(m, 0, j)), 0);
// adjugate = transpose of the cofactor matrix, reduced mod 26
const adjugate = m => m.map((w, i) => w.map((_, j) => mod(((i + j) % 2 ? -1 : 1) * det(minor(m, j, i)))));

// ---------- State & elements ----------
let n = 3, mode = 'enc';
const grid = $('#grid'), out = $('#out');
const DEFAULT_KEY = [6, 24, 1, 13, 16, 10, 20, 17, 15];
const EMPTY = '<div class="empty">Enter your text and key, then press the button. The key check, any matrix inverse, and each block calculation appear here.</div>';

// ---------- Key grid ----------
function build(vals = []) {
  grid.style.setProperty('--n', n);
  grid.innerHTML = Array.from({ length: n * n }, (_, i) =>
    `<input class="cell" type="number" value="${vals[i] ?? ''}" aria-label="Key row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}">`
  ).join('');
  status();
}
function readKey() {
  const v = [...grid.querySelectorAll('input')].map(c => (c.value.trim() === '' ? NaN : mod(parseInt(c.value, 10))));
  if (v.some(isNaN)) return null;
  return Array.from({ length: n }, (_, i) => v.slice(i * n, i * n + n));
}
function status() {
  const k = readKey(), s = $('#status');
  if (!k) { s.className = 'badge'; s.textContent = 'Fill every cell to check the key'; return; }
  const d = mod(det(k)), g = gcd(d, 26);
  s.className = 'badge ' + (g === 1 ? 'ok' : 'bad');
  s.textContent = g === 1 ? `Valid key: det = ${d}, gcd(${d}, 26) = 1` : `Invalid key: det = ${d}, gcd(${d}, 26) = ${g}`;
}
function randomKey() {
  let k;
  do k = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.floor(Math.random() * 26)));
  while (gcd(mod(det(k)), 26) !== 1);
  build(k.flat());
}

// ---------- Rendering helpers ----------
const card = (t, b) => `<article class="card"><h3>${t}</h3>${b}</article>`;
const mat = (name, m) =>
  `<div class="mat"><small>${name}</small><div class="mg" style="--n:${m.length}">${m.flat().map(v => `<span>${v}</span>`).join('')}</div></div>`;
const err = m => (out.innerHTML = `<div class="err">${m}</div>`);

// Multiply each n-letter block by matrix m (mod 26) and record the working
function run(m, t) {
  let res = '', html = '';
  for (let i = 0; i < t.length; i += n) {
    const b = t.slice(i, i + n), p = [...b].map(c => c.charCodeAt(0) - 65);
    const rows = m.map((w, r) => {
      const s = w.reduce((a, v, c) => a + v * p[c], 0), x = mod(s);
      res += ch(x);
      return `<div class="calc"><span class="rn">Row ${r + 1}</span><span>${w.map((v, c) => `${v}×${p[c]}`).join(' + ')}</span><span>= ${s}</span><span>mod 26 = <b>${x}</b></span><span class="lt">${ch(x)}</span></div>`;
    });
    html += `<div class="blk"><div class="bh">${[...b].map((c, k) => `<span class="tile">${c}<sub>${p[k]}</sub></span>`).join('')}<span class="muted">Block ${i / n + 1}</span></div>${rows.join('')}</div>`;
  }
  return { res, html };
}

// ---------- Main action ----------
function go() {
  const k = readKey();
  if (!k) return err('Fill every cell of the key matrix.');
  let t = $('#text').value.toUpperCase().replace(/[^A-Z]/g, '');
  if (!t) return err('Enter at least one letter (A–Z). Other characters are ignored.');
  const D = det(k), d = mod(D);
  if (gcd(d, 26) !== 1)
    return err(`This key can't be used: det(K) = ${D} ≡ ${d} (mod 26) and gcd(${d}, 26) = ${gcd(d, 26)}. The determinant must share no factor with 26. Edit the key or press Random key.`);

  const dec = mode === 'dec';
  let m = k, pad = 0;
  let h = card('Key check', `<div class="row">${mat('K', k)}<p class="note">det(K) = ${D}<br>${D} mod 26 = ${d}<br>gcd(${d}, 26) = 1, so K is invertible mod 26.</p></div>`);

  if (dec) {
    if (t.length % n) return err(`The ciphertext has ${t.length} letters. It must be a multiple of ${n} for a ${n}×${n} key.`);
    const di = modInverse(d), a = adjugate(k);
    m = a.map(w => w.map(v => mod(v * di)));
    h += card('Inverse of the key',
      `<p class="note">det⁻¹ = ${di}, because ${d} × ${di} = ${d * di} ≡ 1 (mod 26).<br>K⁻¹ = det⁻¹ × adj(K) mod 26</p>
       <div class="row">${mat('adj(K) mod 26', a)}<span class="op">× ${di} =</span>${mat('K⁻¹', m)}</div>`);
  } else {
    pad = (n - (t.length % n)) % n;
    t += 'X'.repeat(pad);
  }

  const { res, html } = run(m, t);
  h += card(dec ? 'Decryption steps' : 'Encryption steps',
    `<p class="note">${dec ? 'P = K⁻¹ · C' : 'C = K · P'}. Each block is a column of letter values (A = 0 … Z = 25).${pad ? ` The text was padded with ${pad} × X.` : ''}</p>${html}`);
  h += card(dec ? 'Plaintext' : 'Ciphertext',
    `<div class="res">${res}</div><div class="btns"><button class="ghost" id="cp">Copy</button>${dec ? '' : '<button class="ghost" id="sd">Use in Decrypt</button>'}</div>`);
  out.innerHTML = h;

  $('#cp').onclick = e => { navigator.clipboard?.writeText(res); e.target.textContent = 'Copied'; };
  if ($('#sd')) $('#sd').onclick = () => { setMode('dec'); $('#text').value = res; go(); };
}

function setMode(m) {
  mode = m;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  $('#tl').textContent = m === 'enc' ? 'Plaintext' : 'Ciphertext';
  $('#go').textContent = m === 'enc' ? 'Encrypt' : 'Decrypt';
  $('#text').placeholder = m === 'enc' ? 'Letters only, e.g. HELLO WORLD' : 'Ciphertext, e.g. from an earlier encryption';
  out.innerHTML = EMPTY;
}

// ---------- Wiring ----------
grid.addEventListener('input', status);
document.querySelectorAll('.tab').forEach(b => (b.onclick = () => setMode(b.dataset.mode)));
document.querySelectorAll('#sizes button').forEach(b => (b.onclick = () => {
  n = +b.dataset.n;
  document.querySelectorAll('#sizes button').forEach(x => x.classList.toggle('on', x === b));
  randomKey();
  out.innerHTML = EMPTY;
}));
$('#rand').onclick = randomKey;
$('#clear').onclick = () => { build(); $('#text').value = ''; out.innerHTML = EMPTY; };
$('#go').onclick = go;
$('#text').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } });

build(DEFAULT_KEY);
setMode('enc');

// ---------- One-time pad (mirrors the Java version) ----------
let omode = 'enc';
const oout = $('#oout'), otext = $('#otext'), okey = $('#okey');
const clean = s => s.toUpperCase().replace(/[^A-Z]/g, '');
const OEMPTY = '<div class="empty">Enter a message and a key of the same length, or press Random key. The letter-by-letter table appears here.</div>';
const oerr = m => (oout.innerHTML = `<div class="err">${m}</div>`);

// secure random letters; values >= 234 are skipped so every letter is equally likely
function rnd(len) {
  let s = '';
  while (s.length < len)
    for (const v of crypto.getRandomValues(new Uint8Array(len))) if (v < 234 && s.length < len) s += ch(v % 26);
  return s;
}
function ostatus() {
  const a = clean(otext.value).length, b = clean(okey.value).length, s = $('#ostatus');
  s.className = 'badge ' + (a && a === b ? 'ok' : a && b ? 'bad' : '');
  s.textContent = a && a === b ? `Lengths match: ${a} letters` : `Message ${a} letters, key ${b} letters (must be equal)`;
}
function orandom() {
  const len = clean(otext.value).length;
  if (!len) return oerr('Enter the message first so the random key can match its length.');
  okey.value = rnd(len);
  ostatus();
}
function ogo() {
  const t = clean(otext.value), dec = omode === 'dec';
  let k = clean(okey.value);
  if (!t) return oerr(dec ? 'Enter the ciphertext (letters A–Z).' : 'Enter a message (letters A–Z). Other characters are ignored.');
  if (!k) {
    if (dec) return oerr('Enter the key that was used to encrypt.');
    okey.value = k = rnd(t.length);
    ostatus();
  }
  if (k.length !== t.length) return oerr(`The key must be exactly as long as the ${dec ? 'ciphertext' : 'message'} (${t.length} letters). Yours has ${k.length}.`);

  let res = '', rows = '';
  [...t].forEach((c, i) => {
    const a = c.charCodeAt(0) - 65, b = k.charCodeAt(i) - 65, s = dec ? a - b : a + b, x = mod(s);
    res += ch(x);
    rows += `<tr><td>${i + 1}</td><td>${c}</td><td>${a}</td><td>${k[i]}</td><td>${b}</td><td>${a} ${dec ? '−' : '+'} ${b} = ${s}</td><td>${s < 0 ? `(${s} + 26) ` : ''}<b>${x}</b></td><td class="c">${ch(x)}</td></tr>`;
  });
  const head = ['#', dec ? 'Cipher' : 'Plain', 'Value', 'Key', 'Value', dec ? 'C − K' : 'P + K', 'mod 26', dec ? 'Plain' : 'Cipher'];
  oout.innerHTML =
    card(dec ? 'Decryption steps' : 'Encryption steps',
      `<p class="note">${dec ? 'P = (C − K) mod 26' : 'C = (P + K) mod 26'}, with A = 0 … Z = 25. Each letter uses its own key letter.</p>
       <div class="tw"><table class="ot"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`) +
    card(dec ? 'Plaintext' : 'Ciphertext',
      `<div class="res">${res}</div>
       <p class="note">Key: <span class="mono">${k}</span>${dec ? '' : '<br>Use each key once. Reusing a key breaks the security of a one-time pad.'}</p>
       <div class="btns"><button class="ghost" id="ocp">Copy ${dec ? 'plaintext' : 'ciphertext'}</button><button class="ghost" id="ock">Copy key</button>${dec ? '' : '<button class="ghost" id="osd">Use in Decrypt</button>'}</div>`);

  const copy = (id, v) => ($(id).onclick = e => { navigator.clipboard?.writeText(v); e.target.textContent = 'Copied'; });
  copy('#ocp', res);
  copy('#ock', k);
  if ($('#osd')) $('#osd').onclick = () => { osetMode('dec'); otext.value = res; okey.value = k; ostatus(); ogo(); };
}
function osetMode(m) {
  omode = m;
  document.querySelectorAll('.otab').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  $('#otl').textContent = m === 'enc' ? 'Plaintext' : 'Ciphertext';
  $('#ogo').textContent = m === 'enc' ? 'Encrypt' : 'Decrypt';
  otext.placeholder = m === 'enc' ? 'Letters only, e.g. HELLO' : 'Ciphertext, e.g. from an earlier encryption';
  oout.innerHTML = OEMPTY;
}

otext.addEventListener('input', ostatus);
okey.addEventListener('input', ostatus);
otext.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ogo(); } });
document.querySelectorAll('.otab').forEach(b => (b.onclick = () => osetMode(b.dataset.mode)));
$('#orand').onclick = orandom;
$('#oclear').onclick = () => { otext.value = okey.value = ''; ostatus(); oout.innerHTML = OEMPTY; };
$('#ogo').onclick = ogo;

// ---------- Top-level cipher tabs ----------
document.querySelectorAll('.navb').forEach(b => (b.onclick = () => {
  document.querySelectorAll('.navb').forEach(x => x.classList.toggle('on', x === b));
  $('#v-hill').hidden = b.dataset.view !== 'hill';
  $('#v-otp').hidden = b.dataset.view !== 'otp';
}));

ostatus();
osetMode('enc');
