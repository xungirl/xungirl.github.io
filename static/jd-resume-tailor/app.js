// Demo player: replays recorded runs from data/runs.json. No network calls besides this site's own files.
const $ = (id) => document.getElementById(id);
const el = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
const STATUS = { ready: 'passed the gate', needs_you: 'needs your call', needs_user: 'asked a question', skip: 'not a fit', failed: 'failed' };
const dur = (s) => s == null ? '' : s >= 60 ? `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s` : `${Math.round(s)}s`;

let RUNS = [], cur = null, timer = null;

async function main() {
  RUNS = await (await fetch('data/runs.json')).json();
  const picker = $('picker');
  for (const r of RUNS) {
    const b = el('button', null, 'pick');
    b.setAttribute('role', 'tab');
    b.append(el('div', r.company, 'co'), el('div', r.title, 't'), el('span', STATUS[r.summary.status] || r.summary.status, 'badge ' + r.summary.status));
    b.onclick = () => show(r);
    picker.appendChild(b);
  }
  table();
  if (RUNS.length) show(RUNS[0], false);
}

function show(r, autoplay = true) {
  cur = r;
  document.querySelectorAll('.pick').forEach((b, i) => b.classList.toggle('on', RUNS[i] === r));
  $('pTitle').textContent = `${r.company} · ${r.title}`;
  $('pLink').href = r.url;
  $('pBadge').className = 'badge ' + r.summary.status;
  $('pBadge').textContent = STATUS[r.summary.status] || r.summary.status;
  $('pWhy').textContent = 'Why this one: ' + r.why;
  const s = r.summary;
  $('pMeta').textContent = [s.seconds && `${dur(s.seconds)} total`, s.cost_usd && `$${s.cost_usd.toFixed(2)} API-equivalent`, 'writer and reviewers: Claude Code (Opus)', s.mode].filter(Boolean).join(' · ');
  drawTimeline(r.stages.length);
  // resume versions
  const vers = $('vers');
  vers.innerHTML = '';
  r.versions.forEach((v, i) => {
    const b = el('button', v.stage === 'write' ? 'First draft' : v.stage.startsWith('revise') ? `After review ${v.stage.slice(6) || ''}`.trim() : v.stage, 'btn small');
    b.onclick = () => pdf(v, b);
    vers.appendChild(b);
    if (i === r.versions.length - 1) pdf(v, b);
  });
  if (!r.versions.length) { $('pdf').removeAttribute('src'); $('pdfLink').hidden = true; vers.appendChild(el('span', 'No resume was built for this posting: see the timeline.', 'muted small')); }
  // reviews
  const revs = $('revs');
  revs.innerHTML = '';
  if (!r.reviews.length) revs.appendChild(el('p', 'No reviews: the writer stopped before building.', 'muted small'));
  r.reviews.forEach((rv, i) => {
    const d = el('details', null, 'rev');
    if (i < 2) d.open = i === 0;
    const sum = el('summary');
    sum.append(el('span', `${rv.kind === 'hm' ? 'Hiring manager' : 'ATS'} review, round ${rv.round}`), el('span', rv.verdict || '?', 'badge ' + rv.verdict));
    d.append(sum, el('pre', rv.text, 'doc'));
    revs.appendChild(d);
  });
  $('analysis').textContent = r.analysis || '(none)';
  $('jd').textContent = r.jd;
  const diff = $('diff');
  diff.innerHTML = '';
  for (const line of (r.diff || '(no changes)').split('\n')) {
    diff.appendChild(el('span', line + '\n', line.startsWith('+') && !line.startsWith('+++') ? 'add' : line.startsWith('-') && !line.startsWith('---') ? 'del' : line.startsWith('@@') ? 'hunk' : ''));
  }
  if (autoplay) play();
}

function pdf(v, btn) {
  document.querySelectorAll('#vers .btn').forEach((b) => b.classList.toggle('on', b === btn));
  $('pdf').src = v.png || v.pdf;
  $('pdfLink').href = v.pdf;
  $('pdfLink').hidden = false;
}

// Draw the first n stages as finished, the rest as to-do.
function drawTimeline(n, running = -1) {
  const tl = $('timeline');
  tl.innerHTML = '';
  cur.stages.forEach((s, i) => {
    const cls = i < n ? (s.status === 'failed' ? 'failed' : 'done') : i === running ? 'running' : 'todo';
    const li = el('li', s.label, cls);
    if (i < n && s.seconds != null) li.prepend(el('span', dur(s.seconds), 't'));
    if (i < n && s.detail) li.appendChild(el('span', s.detail, 'd'));
    tl.appendChild(li);
  });
}

// Replay at about 40x: a 6-minute run takes ~9 seconds, every stage at least 0.7 s.
function play() {
  clearTimeout(timer);
  let i = 0, elapsed = 0;
  const step = () => {
    if (!cur || i > cur.stages.length) return;
    if (i === cur.stages.length) { drawTimeline(i); $('clock').textContent = `done in ${dur(cur.summary.seconds)} (real time)`; return; }
    drawTimeline(i, i);
    const real = cur.stages[i].seconds || 3;
    elapsed += real;
    $('clock').textContent = `${dur(elapsed)} of real time`;
    i++;
    timer = setTimeout(step, Math.max(700, real * 25));
  };
  step();
}

$('play').onclick = play;
$('skip').onclick = () => { clearTimeout(timer); drawTimeline(cur.stages.length); $('clock').textContent = ''; };
document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== b.dataset.tab));
}));

function table() {
  const t = $('table');
  const head = el('tr');
  for (const h of ['Posting', 'Outcome', 'HM', 'ATS', 'Time', 'Cost*', 'New numbers', 'New terms', 'Gaps it admitted']) head.appendChild(el('th', h));
  t.appendChild(head);
  let built = 0, fabricated = 0, secs = 0, n = 0;
  for (const r of RUNS) {
    const s = r.summary;
    const tr = el('tr');
    const a = el('a', `${r.company}: ${r.title}`); a.href = r.url; a.target = '_blank'; a.rel = 'noopener';
    const td0 = el('td'); td0.appendChild(a); tr.appendChild(td0);
    const out = el('td'); out.appendChild(el('span', STATUS[s.status] || s.status, 'badge ' + s.status)); tr.appendChild(out);
    for (const v of [s.hm, s.ats]) { const td = el('td'); if (v) td.appendChild(el('span', v, 'badge ' + v)); else td.textContent = '-'; tr.appendChild(td); }
    tr.appendChild(el('td', dur(s.seconds), 'num'));
    tr.appendChild(el('td', s.cost_usd ? `$${s.cost_usd.toFixed(2)}` : '-', 'num'));
    tr.appendChild(el('td', r.versions.length ? (s.numbers_not_in_bank.length ? s.numbers_not_in_bank.join(', ') : '0') : '-', 'num'));
    tr.appendChild(el('td', r.versions.length ? (s.terms_not_in_bank.length ? s.terms_not_in_bank.join(', ') : '0') : '-'));
    tr.appendChild(el('td', (s.gaps || []).slice(0, 4).join(', ') || '-', 'small'));
    t.appendChild(tr);
    if (r.versions.length) { built++; fabricated += s.numbers_not_in_bank.length; }
    if (s.seconds && r.versions.length) { secs += s.seconds; n++; }
  }
  $('totals').innerHTML = '';
  $('totals').append(
    el('b', `${built} resumes built, ${fabricated} numbers not found in the bank.`),
    document.createTextNode(` Average run that built a resume: ${dur(secs / Math.max(n, 1))}. *Cost is what Claude Code reports at API prices; with a Claude subscription it comes out of the plan's limits.`));
}

main();
