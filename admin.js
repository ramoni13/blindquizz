// ======================================================================
// BLIND QUIZZ — écran animateur
// Le serveur fait autorité : ce script affiche l'état et envoie les commandes.
// ======================================================================

const STORAGE_KEY = 'bq_session';
const DEFAULT_TEAMS = ['Équipe 1', 'Équipe 2', 'Équipe 3', 'Équipe 4'];

let S = null;               // dernier état admin reçu
let currentScreen = 'accueil';
let started = false;        // l'animateur a quitté l'écran d'accueil
let network = null;         // { port, addresses }
let pollTimer = null;
let teamsSig = '';
let lastQuestionKey = null;

// ======================================================================
// UTILITAIRES
// ======================================================================

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function $(id) { return document.getElementById(id); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function teamName(id) {
  const t = S && S.teams.find(x => x.id === id);
  return t ? t.name : '?';
}

let toastTimer = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 3500);
}

async function api(url, body = {}) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.error) { toast(data.error); return null; }
    await poll();
    return data;
  } catch (e) {
    toast('Connexion au serveur impossible');
    return null;
  }
}

// ======================================================================
// ÉCRANS
// ======================================================================

function showScreen(name) {
  if (name === currentScreen) return;
  if (currentScreen === 'final') stopConfetti();
  if (currentScreen === 'verify') { stopFireworks(); hideBanners(); }
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
  currentScreen = name;
  if (name === 'final') renderFinal();
}

const PHASE_SCREEN = {
  lobby: 'config', intro: 'intro', answering: 'game',
  verifying: 'verify', roundEnd: 'roundEnd', final: 'final'
};

// ======================================================================
// SESSION
// ======================================================================

async function goConfig() {
  started = true;
  if (!S) {
    const res = await api('/api/session/create', { teams: DEFAULT_TEAMS });
    if (!res) return;
    localStorage.setItem(STORAGE_KEY, res.code);
  }
  render();
}

function recreateSession() {
  showConfirm({
    icon: '🔄',
    title: 'Générer un nouveau code ?',
    message: 'Une nouvelle partie est créée avec les mêmes équipes. Tous les téléphones devront se reconnecter.',
    labelOk: 'Nouveau code',
    danger: true,
    onOk: async () => {
      const names = S ? S.teams.map(t => t.name) : DEFAULT_TEAMS;
      const res = await api('/api/session/create', { teams: names, bank: S ? S.bank : undefined });
      if (res) localStorage.setItem(STORAGE_KEY, res.code);
    }
  });
}

function startGame() {
  if (!S) return;
  const offline = S.teams.filter(t => !t.connected);
  const go = () => api('/api/game/start');
  if (offline.length) {
    showConfirm({
      icon: '📵',
      title: 'Des équipes ne sont pas connectées',
      message: `${offline.map(t => t.name).join(', ')} : sans téléphone, il faudra utiliser « Forcer » à chaque question. Démarrer quand même ?`,
      labelOk: 'Démarrer',
      onOk: go
    });
  } else {
    go();
  }
}

function restartGame() {
  showConfirm({
    icon: '🔄',
    title: 'Redémarrer la partie ?',
    message: 'Les scores sont remis à zéro et on revient à l\'écran de configuration. Les équipes et les téléphones connectés sont conservés.',
    labelOk: 'Redémarrer',
    danger: true,
    onOk: () => api('/api/session/reset')
  });
}

function newGame() {
  showConfirm({
    icon: '🔄',
    title: 'Nouvelle partie ?',
    message: 'Tous les scores seront remis à zéro. Les équipes et les téléphones connectés sont conservés.',
    labelOk: 'Nouvelle partie',
    danger: true,
    onOk: () => api('/api/session/reset')
  });
}

// ======================================================================
// POLLING
// ======================================================================

async function poll() {
  try {
    const res = await fetch('/api/state?view=admin');
    const data = await res.json();
    S = data.session;
    if (S) localStorage.setItem(STORAGE_KEY, S.code);
    render();
  } catch (e) { /* serveur indisponible */ }
}

function render() {
  if (!S) {
    teamsSig = '';
    if (started) { started = false; toast('Session introuvable (serveur redémarré ?)'); }
    showScreen('accueil');
    return;
  }
  if (!started && S.phase === 'lobby') { showScreen('accueil'); return; }
  started = true;

  if (S.phase !== 'verifying') vState = null;
  if (S.phase !== 'answering') lastQuestionKey = null;
  renderScoreboard();
  renderTeamsConfig();
  const screen = PHASE_SCREEN[S.phase];
  switch (S.phase) {
    case 'lobby': renderSessionPanel(); renderBankSelect(); break;
    case 'intro': renderIntro(); break;
    case 'answering': renderGame(); break;
    case 'verifying': renderVerify(); break;
    case 'roundEnd': renderRoundEnd(); break;
  }
  showScreen(screen);
  if (S.phase === 'final' && currentScreen === 'final') renderFinalIfChanged();
}

// ======================================================================
// CONFIG : PANNEAU SESSION + ÉQUIPES
// ======================================================================

function playerUrl() {
  let origin = location.origin;
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname);
  if (local && network && network.addresses.length) {
    origin = `http://${network.addresses[0]}:${network.port}`;
  }
  return `${origin}/joueur?code=${S.code}`;
}

let qrUrl = '';
function renderSessionPanel() {
  const url = playerUrl();
  $('session-code-display').textContent = S.code;
  $('session-url-display').textContent = url;
  if (url !== qrUrl && window.QR) {          // QR régénéré seulement si le lien change
    qrUrl = url;
    const svg = QR.svg(url);
    $('session-qr').innerHTML = svg;
    $('qr-zoom-img').innerHTML = svg;
    $('qr-zoom-code').textContent = S.code;
  }
  const n = S.teams.filter(t => t.connected).length;
  $('session-conn-status').textContent = `${n} / ${S.teams.length} équipe(s) connectée(s)`;
  $('session-conn-list').innerHTML = S.teams.map(t =>
    `<span class="conn-chip ${t.connected ? 'online' : 'offline'}">${t.connected ? '📱' : '○'} ${escHtml(t.name)}</span>`
  ).join('');
}

// Liste déroulante du questionnaire (reconstruite seulement si la liste change)
let banksSig = '';
function renderBankSelect() {
  const sel = $('select-bank');
  if (!sel || !S.banks) return;
  const sig = JSON.stringify(S.banks);
  if (sig !== banksSig) {
    banksSig = sig;
    sel.innerHTML = S.banks.map(b =>
      `<option value="${escHtml(b.id)}">${escHtml(b.label)} — ${b.count} questions</option>`
    ).join('');
  }
  if (document.activeElement !== sel && sel.value !== S.bank) sel.value = S.bank;

  // Questions déjà posées dans les parties précédentes (même session)
  const total = S.freshCount + S.askedCount;
  const txt = S.askedCount === 0
    ? `Toutes les questions sont neuves (<b>${total}</b>).`
    : `<b>${S.freshCount}</b> question(s) jamais posée(s) sur ${total} — elles sortiront en premier.`
      + (S.freshCount < 60 ? ' Les déjà vues compléteront si besoin.' : '');
  if ($('bank-history-text').innerHTML !== txt) $('bank-history-text').innerHTML = txt;
  $('btn-history-clear').style.display = S.askedCount ? '' : 'none';
}

function clearHistory() {
  showConfirm({
    icon: '♻',
    title: 'Remettre toutes les questions en jeu ?',
    message: 'Les questions déjà posées pourront ressortir dès la prochaine partie. Utile avec un nouveau public.',
    labelOk: 'Remettre en jeu',
    onOk: () => api('/api/history/clear')
  });
}

function selectBank(bank) {
  if (!S || bank === S.bank) return;
  api('/api/bank/select', { bank });
}

function openQrZoom() { if (qrUrl) $('qr-zoom').classList.add('visible'); }
function closeQrZoom() { $('qr-zoom').classList.remove('visible'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeQrZoom(); });

function renderTeamsConfig() {
  const sig = JSON.stringify([S.canEditTeams, S.teams]);
  if (sig === teamsSig) return;
  const grids = [$('teams-grid'), $('teams-grid-roundend')];
  // Ne pas écraser un champ en cours d'édition
  if (grids.some(g => g.contains(document.activeElement) && document.activeElement.tagName === 'INPUT')) return;
  teamsSig = sig;

  const n = S.teams.length;
  let html = '';
  S.teams.forEach((t, i) => {
    const removeBtn = (n > 2 && S.canEditTeams)
      ? `<button class="team-remove-btn" onclick="removeTeam('${t.id}')" title="Supprimer">✕</button>` : '';
    const kickBtn = t.connected
      ? `<button class="team-kick-btn" onclick="kickTeam('${t.id}')" title="Déconnecter le téléphone">📵</button>` : '';
    html += '<div class="team-input-wrap">'
      + `<label><span class="team-conn-dot ${t.connected ? 'on' : ''}" title="${t.connected ? 'Connectée' : 'Non connectée'}"></span>`
      + `Équipe ${i + 1} ${kickBtn} ${removeBtn}</label>`
      + `<input type="text" maxlength="40" value="${escHtml(t.name)}" placeholder="Équipe ${i + 1}"`
      + ` onchange="renameTeam('${t.id}', this.value)">`
      + '</div>';
  });
  if (S.canEditTeams) {
    html += '<div class="team-add-wrap">'
      + '<button onclick="addTeam()" class="btn btn-success team-add-btn">+ Ajouter une équipe</button>'
      + '</div>';
  }
  grids.forEach(g => { g.innerHTML = html; });
}

function addTeam() {
  api('/api/teams/add', { name: 'Équipe ' + (S.teams.length + 1) });
}

function renameTeam(teamId, name) {
  teamsSig = '';
  api('/api/teams/rename', { teamId, name });
}

function removeTeam(teamId) {
  if (S.teams.length <= 2) return;
  showConfirm({
    icon: '🗑️',
    title: 'Supprimer cette équipe ?',
    message: `"${teamName(teamId)}" sera supprimée. Ses scores seront perdus.`,
    labelOk: 'Supprimer',
    danger: true,
    onOk: () => api('/api/teams/remove', { teamId })
  });
}

function kickTeam(teamId) {
  showConfirm({
    icon: '📵',
    title: 'Libérer cette équipe ?',
    message: `Le téléphone de "${teamName(teamId)}" sera déconnecté. Un capitaine pourra ensuite la rejoindre depuis un autre téléphone.`,
    labelOk: 'Libérer',
    danger: true,
    onOk: () => api('/api/teams/kick', { teamId })
  });
}

// ======================================================================
// SCOREBOARD (sidebar CLASSEMENT)
// ======================================================================

function renderScoreboard() {
  const html = S.ranking.map(item => `
    <div class="score-item ${item.rank === 1 ? 'leader' : ''}">
      <span class="score-rank ${item.rank === 1 ? 'gold-rank' : ''}">${item.rank === 1 ? '🥇' : item.rank}</span>
      <span class="score-name">${escHtml(item.name)}</span>
      <span class="score-value">${item.score}</span>
    </div>`).join('');
  document.querySelectorAll('.score-list').forEach(el => { if (el.innerHTML !== html) el.innerHTML = html; });
}

// ======================================================================
// INTRO MANCHE
// ======================================================================

function renderIntro() {
  const n = S.round + 1;
  $('intro-number').textContent = `MANCHE ${n} / ${S.roundCount}`;
  $('intro-title').textContent = `Objectif : ${S.target}`;
  $('intro-description').innerHTML =
    `Chaque bonne réponse est un chiffre de 0 à 9. Additionnez-les pour approcher <b>${S.target}</b> sans le dépasser.<br>`
    + 'Quand vous pensez être assez près, appuyez sur <b>STOP</b> : c\'est définitif pour la manche !';
  $('intro-points').innerHTML =
    'Jauge : + valeur de la bonne réponse · Points : <b>exact +3</b> · <b>±1 : +1</b> · <b>plus loin : 0</b> · <b>⚡ +1</b> la plus rapide<br>'
    + `Au-dessus de ${S.target} : <b>plus aucun point</b> · Bilan : pile <b>+10</b> · en dessous <b>+10 − écart</b> · au-dessus <b>−dépassement</b>`;

  // Bonus de la manche (cumulés depuis la manche 2), présentés avant de jouer
  const bonuses = S.bonuses || [];
  const newId = S.newBonus ? S.newBonus.id : null;
  const html = bonuses.length
    ? bonuses.map(b => `<div class="intro-bonus${b.id === newId ? ' new' : ''}">`
      + `<div class="ib-icon">${escHtml(b.icon)}</div>`
      + `<div class="ib-name">${escHtml(b.name)}${b.id === newId ? '<span class="ib-new">NOUVEAU</span>' : ''}</div>`
      + `<div class="ib-desc">${escHtml(b.short)} · 1 fois dans la manche</div></div>`).join('')
    : '';
  if ($('intro-bonuses').innerHTML !== html) $('intro-bonuses').innerHTML = html;
  $('btn-intro-bonuses').style.display = bonuses.length ? '' : 'none';

  // Première arrivée sur l'intro d'une manche qui apporte un nouveau bonus : diaporama automatique
  const key = S.code + '-' + S.round;
  if (newId && introBonusShown !== key) {
    introBonusShown = key;
    showRoundBonuses();
  }
}

let introBonusShown = null;

function showRoundBonuses() {
  if (!S || !S.bonuses || !S.bonuses.length) return;
  openBonuses(S.bonuses, S.newBonus ? [S.newBonus.id] : []);
}

// ======================================================================
// JEU : QUESTION EN COURS
// ======================================================================

const STATUS_LABEL = {
  thinking: 'En réflexion', answered: '✓ Répondu', forced: '0 (forcé)', stopped: 'STOP', out: 'Prochaine manche'
};

function renderGame() {
  const c = S.current;
  if (!c) return;
  $('game-round-badge').textContent = `MANCHE ${S.round + 1} / ${S.roundCount}`;
  $('game-target-badge').textContent = `🎯 Cible : ${S.target}`;
  $('game-question-num').textContent = `QUESTION ${c.num}`;

  const key = S.round + '-' + c.num;
  if (key !== lastQuestionKey) {
    lastQuestionKey = key;
    const el = $('game-question-text');
    el.textContent = c.text;
    el.classList.remove('animate-in');
    void el.offsetWidth;
    el.classList.add('animate-in');
  }

  const BONUS_TAG = { x2: '×2', fifty: '50/50', spy: '🕵️ espion' };
  $('status-grid').innerHTML = S.teams.map(t => {
    const st = c.statuses[t.id] || 'out';
    const tags = ((c.bonusNow || {})[t.id] || []).map(b => `<span class="st-bonus">${BONUS_TAG[b] || b}</span>`).join('');
    return `<div class="status-chip ${st}">
      <span class="st-name">${escHtml(t.name)}${t.connected ? '' : ' 📵'}${tags}</span>
      <span class="st-label">${STATUS_LABEL[st]}</span>
    </div>`;
  }).join('');

  const answered = c.active - c.pending;
  $('game-progress').textContent =
    `${answered} / ${c.active} équipe(s) en jeu ont répondu · ${S.deckRemaining} question(s) restante(s) dans le pool`;
  $('btn-next-question').disabled = c.pending > 0;
  $('btn-force').style.display = c.pending > 0 ? '' : 'none';
}

function nextQuestion() {
  api('/api/question/next');
}

function forceNext() {
  const c = S && S.current;
  if (!c) return;
  const late = S.teams.filter(t => c.statuses[t.id] === 'thinking').map(t => t.name);
  showConfirm({
    icon: '⏩',
    title: 'Forcer la question suivante ?',
    message: `${late.join(', ')} : une estimation de 0 sera enregistrée (la vraie réponse comptera quand même dans leur cumul réel, sans bonus).`,
    labelOk: 'Forcer',
    danger: true,
    onOk: () => api('/api/question/next', { force: true })
  });
}

// ======================================================================
// VÉRIFICATION
// Cadre du haut : question, bonne réponse et piste unique (un pion par équipe).
// Dessous : blocs (bonne réponse / ± 1 / plus rapide) puis écarts de 2 ou plus.
// À droite : classement, mis à jour équipe par équipe puis réordonné.
// Étapes : une par question révélée, puis le « bilan de manche ».
// ======================================================================

const OVER_MARGIN = 5;
let vState = null;   // { round, shown, animating, overShown, base, scores, order, scaleMax }

const GROUP_BODY = { a: 'vb-a-body', b: 'vb-b-body', c: 'vb-c-body', w: 'vb-wrong-body' };
const TITLES_Q = {
  a: ['🎯 Bonne réponse', '+3'], b: ['± 1 (à un près)', '+1'], c: ['⚡ Équipe la plus rapide', '+1'], w: ['❌ Écart de 2 ou plus', '+0 pt']
};

function teamColor(tid) {
  const i = S.teams.findIndex(t => t.id === tid);
  return `hsl(${Math.round((Math.max(i, 0) * 137.508) % 360)} 85% 62%)`;
}
function fmtMs(ms) { return (ms === null || ms === undefined) ? '' : (ms / 1000).toFixed(2).replace('.', ',') + ' s'; }
function shortName(n) { return n.length > 12 ? n.slice(0, 11) + '…' : n; }
function listNames(ids) { return ids.length <= 4 ? ids.map(teamName).join(' · ') : `${ids.length} équipes`; }
function sgn(n) { return n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '+0'; }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function cumulAt(v, upto, tid) {
  let c = 0;
  for (let i = 0; i < Math.min(upto, v.questions.length); i++) {
    const e = v.questions[i].entries[tid];
    if (e) c = e.cumul;
  }
  return c;
}

function cumMap(v, upto) {
  const m = {};
  S.participants.forEach(tid => { m[tid] = cumulAt(v, upto, tid); });
  return m;
}

// Score total d'une équipe après les `upto` premières étapes (questions, puis bilan)
function scoreAt(v, upto, tid) {
  let s = vState.base[tid] || 0;
  for (let i = 0; i < Math.min(upto, v.questions.length); i++) {
    const e = v.questions[i].entries[tid];
    if (e) s += e.gain;
  }
  if (upto > v.total && v.bilan && v.bilan[tid]) s += v.bilan[tid].adjust;
  return s;
}

// ---------- Piste unique + pions ----------

function buildVerifyGauge() {
  const target = S.target;
  const max = target + OVER_MARGIN;       // la piste s'arrête à cible + 5
  vState.scaleMax = max;
  const major = target <= 25 ? 5 : 10;
  const tp = (target / max * 100).toFixed(3);
  let ticks = '';
  for (let k = 1; k < max; k++) {
    ticks += `<span class="${k % major === 0 ? 'major' : ''}" style="left:${(k / max * 100).toFixed(3)}%"></span>`;
  }
  const track = $('vtrack');
  track.style.setProperty('--tp', tp + '%');
  track.innerHTML = `<div class="vtrack-ticks">${ticks}</div><div class="vtrack-target" style="left:${tp}%"></div>`;

  let scale = '<span style="left:0%">0</span>';
  for (let k = major; k < max; k += major) {
    if (Math.abs(k - target) <= major / 2) continue;
    scale += `<span style="left:${(k / max * 100).toFixed(3)}%">${k}</span>`;
  }
  scale += `<span class="is-target" style="left:${tp}%">🎯 ${target}</span>`;
  $('vtrack-scale').innerHTML = scale;

  $('vpawns').innerHTML = S.participants.map(tid =>
    `<div class="vpawn" id="vp-${tid}" style="--pc:${teamColor(tid)}">`
    + '<span class="vp-dot"></span>'
    + `<span class="vp-name">${escHtml(shortName(teamName(tid)))}</span>`
    + `<span class="vp-num" id="vp-num-${tid}">0</span></div>`
  ).join('');
}

function layoutPawns(cum, active) {
  const max = vState.scaleMax, target = S.target;
  const groups = {};
  S.participants.forEach(tid => {
    const k = Math.min(cum[tid] || 0, max);
    (groups[k] = groups[k] || []).push(tid);
  });
  const maxStack = Math.max(1, ...Object.values(groups).map(g => g.length));
  const rowH = clamp(Math.floor(150 / maxStack), 7, 28);
  const cont = $('vpawns');
  cont.classList.toggle('tiny', rowH < 20);
  cont.style.height = (maxStack * rowH + 8) + 'px';
  Object.keys(groups).forEach(k => {
    const pos = Number(k) / max * 100;
    groups[k].forEach((tid, lvl) => {
      const el = $('vp-' + tid);
      if (!el) return;
      const val = cum[tid] || 0;
      el.style.left = pos + '%';
      el.style.transform = `translateX(-${pos}%)`;
      el.style.bottom = (6 + lvl * rowH) + 'px';
      el.style.height = (rowH - 2) + 'px';
      el.style.setProperty('--ptr', pos + '%');
      el.style.setProperty('--stem', (14 + lvl * rowH) + 'px');
      el.style.zIndex = 2 + (lvl % 50);
      el.classList.toggle('over', val > target);
      el.classList.toggle('exact', val === target);
      el.classList.toggle('idle', !!active && !active.has(tid));
      $('vp-num-' + tid).textContent = val;
      el.classList.toggle('beyond', val > max);
    });
  });
}

// ---------- Plan de révélation d'une étape ----------

function chipHtml(tid, o = {}) {
  if (o.over) {
    o = { ...o, small: '💥 dépassé · 0 pt', sq: o.sq, sqCls: o.sqCls === 'wide pos' ? '' : o.sqCls };
  }
  const sq = (o.sq !== undefined && o.sq !== null)
    ? `<span class="vchip-sq ${o.sqCls || ''}"${o.title ? ` title="${escHtml(o.title)}"` : ''}>${o.sq}</span>` : '';
  const small = o.small ? `<small>${o.small}</small>` : '';
  const tags = (o.spy ? '<span class="vchip-bonus spy" title="Espion joué">🕵️</span>' : '')
    + (o.fifty ? '<span class="vchip-bonus fifty" title="50-50 joué">50/50</span>' : '')
    + (o.x2 ? `<span class="vchip-bonus" title="×2 joué : ${o.gain || 0} pt">×2${o.gain ? ' = ' + o.gain : ''}</span>` : '');
  return `<span class="vchip${o.over ? ' busted' : ''}">`
    + `<span class="vchip-dot" style="background:${teamColor(tid)}"></span>`
    + `<span class="vchip-name">${escHtml(teamName(tid))}</span>${tags}${small}${sq}</span>`;
}

function buildPlan(v, i) {
  if (i < 1) return null;

  // ----- Bilan de manche -----
  if (i > v.total) {
    if (!v.bilan) return null;
    const rows = S.participants.filter(t => v.bilan[t] && v.bilan[t].answered > 0).map(t => ({ tid: t, ...v.bilan[t] }));
    const pile = rows.filter(r => r.exactTarget);
    const under = rows.filter(r => !r.over && !r.exactTarget).sort((a, b) => a.gap - b.gap);
    const over = rows.filter(r => r.over).sort((a, b) => b.gap - a.gap);
    const mk = (group, r) => ({
      group, tid: r.tid, gain: r.adjust,
      html: chipHtml(r.tid, {
        small: `${r.cumul} / ${S.target}`, sq: sgn(r.adjust),
        sqCls: 'wide ' + (r.adjust > 0 ? 'pos' : r.adjust < 0 ? 'neg' : '')
      })
    });
    const items = [...pile.map(r => mk('a', r)), ...under.map(r => mk('b', r)), ...over.map(r => mk('c', r))];
    return {
      mode: 'bilan',
      titles: {
        a: ['🎯 Pile sur la cible', '+10'],
        b: ['📉 Sous la cible', '+10 − écart'],
        c: ['💥 Au-dessus de la cible', '− dépassement']
      },
      reveal: items, scoreOrder: items.map(x => ({ tid: x.tid, gain: x.gain })),
      active: new Set(rows.map(r => r.tid)),
      pile: pile.map(r => r.tid)
    };
  }

  // ----- Question -----
  const q = v.questions[i - 1];
  const E = q.entries;
  const tids = S.participants.filter(t => E[t]);
  const byMs = (a, b) => (E[a].ms === null ? 1e12 : E[a].ms) - (E[b].ms === null ? 1e12 : E[b].ms);
  // L'équipe la plus rapide n'apparaît que dans son bloc (pas aussi dans « bonne réponse »)
  const A = tids.filter(t => E[t].exact && !E[t].fastest).sort(byMs);
  const B = tids.filter(t => E[t].near).sort(byMs);
  const W = tids.filter(t => !E[t].exact && !E[t].near).sort((a, b) => (E[a].forced - E[b].forced) || byMs(a, b));
  const C = tids.filter(t => E[t].fastest);
  const item = (group, t, o) => ({
    group, tid: t, gain: E[t].gain,
    html: chipHtml(t, { ...o, over: E[t].over, x2: E[t].x2, fifty: E[t].fifty, spy: E[t].spy, gain: E[t].gain })
  });
  const a = A.map(t => item('a', t, { small: fmtMs(E[t].ms) }));
  const b = B.map(t => item('b', t, { sq: E[t].value, sqCls: 'near', title: 'Réponse donnée' }));
  const c = C.map(t => item('c', t, {
    small: fmtMs(E[t].ms),
    sq: E[t].speed ? '3+1' : '3', sqCls: 'wide pos', title: 'Bonne réponse (+3) et la plus rapide (+1)'
  }));
  const w = W.map(t => E[t].forced
    ? item('w', t, { sq: '0*', sqCls: 'forced', title: 'Estimation forcée par l\'animateur' })
    : item('w', t, { sq: E[t].value, title: 'Réponse donnée' }));
  return {
    mode: 'question',
    titles: TITLES_Q,
    reveal: [...a, ...b, ...c, ...w],
    scoreOrder: [...a, ...b, ...c, ...w].map(x => ({ tid: x.tid, gain: x.gain })),
    active: new Set(tids)
  };
}

function resetBlocks(plan) {
  const mode = plan ? plan.mode : 'question';
  const T = plan ? plan.titles : TITLES_Q;
  $('vblocks').dataset.mode = mode;
  ['a', 'b', 'c'].forEach(g => {
    $(`vb-${g}-title`).textContent = T[g][0];
    $(`vb-${g}-pts`).textContent = T[g][1];
  });
  $('vb-wrong-title').textContent = TITLES_Q.w[0];
  $('vb-wrong-pts').textContent = TITLES_Q.w[1];
  const empty = S.verify && S.verify.total === 0;
  $('vb-wrong').style.display = (mode === 'bilan' || empty) ? 'none' : '';
  Object.values(GROUP_BODY).forEach(id => { $(id).innerHTML = ''; });
}

function addChip(it, animate) {
  const body = $(GROUP_BODY[it.group]);
  body.insertAdjacentHTML('beforeend', it.html);
  if (!animate) return;
  body.lastElementChild.classList.add('stamp');
  const blk = body.parentElement;
  blk.classList.remove('hit');
  void blk.offsetWidth;
  blk.classList.add('hit');
}

// ---------- Cadre du haut ----------

function renderVerifyCard(v, i) {
  if (v.total === 0) {
    $('verify-card').innerHTML = '<div class="verify-empty">Toutes les équipes se sont arrêtées dès la première question : aucun point à vérifier pour cette manche.</div>';
    return;
  }
  if (i === 0) {
    $('verify-card').innerHTML = `<div class="verify-card">
      <div class="vq-text">Vérification de la manche : ${v.total} question(s) à révéler.<div class="vq-expl">Les points sont gagnés au fil des bonnes réponses ; le bilan par rapport à la cible clôt la manche.</div></div>
      <div class="verify-answer hidden-answer">?</div></div>`;
    return;
  }
  if (i > v.total) {
    $('verify-card').innerHTML = `<div class="verify-card">
      <div class="vq-text"><span style="color:var(--text-muted);font-size:1rem;">BILAN DE LA MANCHE</span><br>Jauge finale comparée à la cible
        <div class="vq-expl">Au-dessus : on perd le dépassement · Pile : +10 · En dessous : +10 moins l'écart.</div></div>
      <div class="verify-answer is-target"><span class="va-small">CIBLE</span>${S.target}</div></div>`;
    return;
  }
  const q = v.questions[i - 1];
  $('verify-card').innerHTML = `<div class="verify-card">
    <div class="vq-text"><span style="color:var(--text-muted);font-size:1rem;">QUESTION ${i} / ${v.total}</span><br>${escHtml(q.text)}
      ${q.explanation ? `<div class="vq-expl">${escHtml(q.explanation)}</div>` : ''}
      <div class="vq-pts">La jauge de toutes les équipes avance de ${q.answer}. Points : exact ${q.answer}+3 · à 1 près ${q.answer}+1 · plus loin 0 · au-dessus de la cible 0${(S.bonuses || []).some(b => b.id === 'x2') ? ' · ×2 : points doublés' : ''}.</div></div>
    <div class="verify-answer">${q.answer}</div></div>`;
}

function renderVerifyStatic(v, i) {
  renderVerifyCard(v, i);
  const plan = buildPlan(v, i);
  resetBlocks(plan);
  if (plan) plan.reveal.forEach(it => addChip(it, false));
  layoutPawns(cumMap(v, Math.min(i, v.total)), plan ? plan.active : null);
}

// ---------- Classement (colonne de droite) ----------

function updateVerifyRanks(st) {
  st.order.forEach(tid => {
    const mine = st.scores[tid] || 0;
    const rank = 1 + st.order.filter(o => (st.scores[o] || 0) > mine).length;
    const el = $('vs-rank-' + tid);
    el.textContent = rank === 1 ? '🥇' : rank;
    el.classList.toggle('gold-rank', rank === 1);
    $('vs-' + tid).classList.toggle('leader', rank === 1 && mine > 0);
  });
}

function buildVerifyScores(st) {
  const list = $('verify-score-list');
  list.classList.toggle('compact', st.order.length > 12);
  list.innerHTML = st.order.map(tid =>
    `<div class="vs-item" id="vs-${tid}">`
    + `<span class="vs-dot" style="background:${teamColor(tid)}"></span>`
    + `<span class="score-rank" id="vs-rank-${tid}"></span>`
    + `<span class="score-name">${escHtml(teamName(tid))}</span>`
    + '<span class="vs-wrap">'
    + `<span class="score-value" id="vs-val-${tid}">${st.scores[tid] || 0}</span>`
    + `<span class="score-plus" id="vs-plus-${tid}"></span></span></div>`
  ).join('');
  updateVerifyRanks(st);
}

function sortedOrder(st) {
  const prev = st.order;
  return prev.slice().sort((a, b) => ((st.scores[b] || 0) - (st.scores[a] || 0)) || (prev.indexOf(a) - prev.indexOf(b)));
}

async function reorderScores(st) {
  const list = $('verify-score-list');
  const before = {};
  st.order.forEach(t => { before[t] = $('vs-' + t).getBoundingClientRect().top; });
  const next = sortedOrder(st);
  next.forEach(t => list.appendChild($('vs-' + t)));
  st.order = next;
  updateVerifyRanks(st);
  const done = [];
  next.forEach(t => {
    const el = $('vs-' + t);
    const dy = before[t] - el.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) return;
    el.classList.add('moving');
    const anim = el.animate([
      { transform: `translateY(${dy}px) scale(1)` },
      { transform: `translateY(${dy / 2}px) scale(1.07)`, offset: 0.5 },
      { transform: 'translateY(0) scale(1)' }
    ], { duration: 1300, easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)' });
    done.push(anim.finished.catch(() => {}).then(() => el.classList.remove('moving')));
  });
  if (done.length) await Promise.all(done);
}

// items : [{ tid, gain }] dans l'ordre de révélation des blocs
async function animateScores(items, st) {
  items = items.filter(x => $('vs-' + x.tid));
  if (!items.length) return;
  const delay = clamp(Math.round(3600 / items.length), 90, 400);

  // 1. Le +X apparaît par-dessus le total, équipe par équipe
  for (const it of items) {
    const p = $('vs-plus-' + it.tid);
    p.textContent = sgn(it.gain);
    p.className = 'score-plus ' + (it.gain < 0 ? 'neg' : it.gain === 0 ? 'zero' : '');
    void p.offsetWidth;
    p.classList.add('show');
    $('vs-' + it.tid).scrollIntoView({ block: 'nearest' });
    await sleep(delay);
    if (vState !== st) return;
  }
  await sleep(700);
  if (vState !== st) return;

  // 2. Les totaux montent, dans le même ordre
  for (const it of items) {
    st.scores[it.tid] = (st.scores[it.tid] || 0) + it.gain;
    const val = $('vs-val-' + it.tid);
    val.textContent = st.scores[it.tid];
    val.classList.remove('bump');
    void val.offsetWidth;
    val.classList.add('bump');
    const p = $('vs-plus-' + it.tid);
    p.classList.remove('show');
    p.classList.add('hide');
    await sleep(60);
  }
  await sleep(600);
  if (vState !== st) return;

  // 3. Les badges glissent vers leur nouvelle position
  await reorderScores(st);
  items.forEach(it => { const p = $('vs-plus-' + it.tid); if (p) p.className = 'score-plus'; });
  await sleep(300);
}

// ---------- Barre du bas et boucle d'animation ----------

function updateVerifyBar(v) {
  const shown = vState.shown;
  const btn = $('btn-verify-next');
  btn.disabled = vState.animating;
  btn.textContent = v.total === 0 ? 'Voir les résultats ▶'
    : shown === 0 ? 'Révéler la 1re question ▶'
    : shown < v.total ? 'Question suivante ▶'
    : shown === v.total ? 'Bilan de la manche ▶'
    : 'Voir les résultats ▶';
  $('verify-progress-badge').textContent = v.total === 0 ? ''
    : shown === 0 ? 'Vérification'
    : shown <= v.total ? `Question ${shown} / ${v.total}` : 'Bilan de manche';
  $('verify-progress').textContent = v.total
    ? (shown <= v.total ? `${shown} / ${v.total} question(s) vérifiée(s)` : 'Bilan de manche affiché')
    : 'Aucune question à vérifier';
}

function renderVerify() {
  const v = S.verify;
  if (!v) return;
  $('verify-round-badge').textContent = `MANCHE ${S.round + 1} / ${S.roundCount} — VÉRIFICATION`;
  $('verify-target-badge').textContent = `🎯 Cible : ${S.target}`;
  $('verify-notice').innerHTML = v.roundExhausted
    ? '<div class="notice">⚠ Toutes les questions du pool ont été utilisées : la manche s\'est arrêtée automatiquement.</div>' : '';

  if (!vState || vState.round !== S.round) {
    // Première vue de cette vérification (ou F5) : affichage direct, sans animation
    const base = {};
    S.ranking.forEach(r => { base[r.id] = r.score; });
    vState = {
      round: S.round, shown: v.revealed, animating: false, overShown: new Set(),
      base, scores: {}, order: S.ranking.map(r => r.id), scaleMax: S.target
    };
    S.teams.forEach(t => { vState.scores[t.id] = scoreAt(v, v.revealed, t.id); });
    vState.order = sortedOrder(vState);
    const empty = v.total === 0;
    $('vgauge').style.display = empty ? 'none' : '';
    $('vblocks').style.display = empty ? 'none' : '';
    buildVerifyGauge();
    buildVerifyScores(vState);
    renderVerifyStatic(v, v.revealed);
    S.participants.forEach(tid => { if (cumulAt(v, v.revealed, tid) > S.target) vState.overShown.add(tid); });
  }
  if (!vState.animating && v.revealed > vState.shown) animateVerify();
  updateVerifyBar(v);
}

async function animateVerify() {
  vState.animating = true;
  const st = vState;
  while (S && S.verify && S.round === st.round && S.verify.revealed > st.shown) {
    const v = S.verify;
    const i = st.shown + 1;
    updateVerifyBar(v);
    if (i > v.total) await animateBilan(v, i, st);
    else await animateQuestion(v, i, st);
    if (vState !== st) return;
    st.shown = i;
  }
  st.animating = false;
  if (S && S.verify) updateVerifyBar(S.verify);
}

async function animateQuestion(v, i, st) {
  stopFireworks();
  hideBanners();
  const q = v.questions[i - 1];
  const plan = buildPlan(v, i);

  // 0. La question et la bonne réponse apparaissent dans le cadre du haut
  renderVerifyCard(v, i);
  resetBlocks(plan);
  const cum = cumMap(v, i - 1);
  layoutPawns(cum, plan.active);
  await sleep(1100);
  if (vState !== st) return;

  // 1. Les équipes sont « tamponnées » dans les blocs, bonnes réponses d'abord
  const delay = clamp(Math.round(5000 / Math.max(1, plan.reveal.length)), 150, 520);
  for (const it of plan.reveal) {
    addChip(it, true);
    await sleep(delay);
    if (vState !== st) return;
  }
  await sleep(600);
  if (vState !== st) return;

  // 2. La jauge (piste du haut) avance de 1 en 1 pour les équipes en jeu
  const movers = plan.scoreOrder.map(x => x.tid);
  const newlyOver = [];
  for (let step = 1; step <= q.answer; step++) {
    movers.forEach(tid => {
      cum[tid] += 1;
      if (cum[tid] > S.target && !st.overShown.has(tid)) { st.overShown.add(tid); newlyOver.push(tid); }
    });
    layoutPawns(cum, plan.active);
    await sleep(170);
    if (vState !== st) return;
  }
  if (newlyOver.length) {
    showBanner('over-banner', 'over-banner-teams', listNames(newlyOver));
    await sleep(2200);
    hideBanners();
    if (vState !== st) return;
  }
  await sleep(300);

  // 3. Les points : +X sur le total, puis déplacement des badges
  await animateScores(plan.scoreOrder, st);
}

async function animateBilan(v, i, st) {
  stopFireworks();
  hideBanners();
  const plan = buildPlan(v, i);
  renderVerifyCard(v, i);
  resetBlocks(plan);
  layoutPawns(cumMap(v, v.total), plan.active);
  await sleep(1200);
  if (vState !== st) return;

  const delay = clamp(Math.round(5000 / Math.max(1, plan.reveal.length)), 150, 520);
  for (const it of plan.reveal) {
    addChip(it, true);
    await sleep(delay);
    if (vState !== st) return;
  }
  await sleep(600);
  if (vState !== st) return;

  if (plan.pile.length) {
    showBanner('exact-banner', 'exact-banner-teams', listNames(plan.pile));
    launchFireworks();
    plan.pile.forEach(tid => launchBadgeFirework($('vp-' + tid)));
    await sleep(2500);
    hideBanners();
    if (vState !== st) return;
  }
  await animateScores(plan.scoreOrder, st);
}

function showBanner(id, subId, text) {
  $(subId).textContent = text;
  const el = $(id);
  el.classList.remove('visible');
  void el.offsetWidth;
  el.classList.add('visible');
}

function hideBanners() {
  $('exact-banner').classList.remove('visible');
  $('over-banner').classList.remove('visible');
}

function verifyNext() {
  if (vState && vState.animating) return;
  api('/api/verify/next');
}
// ======================================================================
// FIN DE MANCHE
// ======================================================================

function renderRoundEnd() {
  const res = S.roundResults || {};
  $('roundend-title').textContent = `Résultats de la manche ${S.round + 1} — cible ${S.target}`;
  $('roundend-notice').innerHTML = S.exhausted
    ? '<div class="notice">⚠ Le pool de 100 questions est épuisé : la partie s\'arrête après cette manche.</div>' : '';

  const rows = Object.keys(res).filter(tid => S.teams.some(t => t.id === tid))
    .map(tid => ({ tid, ...res[tid] }))
    .sort((a, b) => b.score - a.score);
  const html = rows.map(r => {
    const cls = r.over ? 'over' : r.exactTarget ? 'exact' : '';
    const bilan = r.over
      ? `<span class="cancelled">${sgn(r.adjust)}</span> <small>(dépasse de ${-r.gap})</small>`
      : r.exactTarget ? '<b>+10</b>' : `${sgn(r.adjust)} <small>(écart ${r.gap})</small>`;
    const x2 = r.x2Extra ? ` + ×2 ${r.x2Extra}` : '';
    const gained = `${r.gained} <small style="color:var(--text-muted)">(valeurs ${r.gained - r.precision - r.speed - (r.x2Extra || 0)} + préc. ${r.precision} + rapid. ${r.speed}${x2})</small>`;
    return `<tr class="${cls}">
      <td>${r.exactTarget ? '🎯 ' : r.over ? '💥 ' : ''}${escHtml(teamName(r.tid))}</td>
      <td class="num">${r.cumul}${r.over ? ' <span class="cancelled">&gt; ' + S.target + '</span>' : ''}</td>
      <td class="num">${bilan}</td>
      <td class="num">${gained}</td>
      <td class="num score">${r.score}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Aucune équipe n\'a joué cette manche.</td></tr>';
  if ($('round-tbody').innerHTML !== html) $('round-tbody').innerHTML = html;

  const last = S.round + 1 >= S.roundCount || S.exhausted;
  $('btn-round-next').textContent = last ? '🏆 Classement final' : `Manche ${S.round + 2} (cible ${S.targets[S.round + 1]}) ▶`;
  $('roundend-progress').textContent = `Manche ${S.round + 1} / ${S.roundCount} terminée`;
}

// ======================================================================
// FIREWORKS (repris de Le Juste Prix)
// ======================================================================

let fwAnimFrame = null;
let fwParticles = [];
let fwStopTimer = null;

function launchFireworks() {
  const canvas = $('fireworks-canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  fwParticles = [];

  let count = 0;
  function burst() {
    if (count < 8 && fwAnimFrame !== null) {
      spawnBurst(canvas, fwParticles);
      count++;
      setTimeout(burst, 350);
    }
  }

  function loop() {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    fwParticles = fwParticles.filter(p => p.alpha > 0.02);
    fwParticles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.vx *= 0.98;
      p.alpha -= 0.012;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    fwAnimFrame = requestAnimationFrame(loop);
  }
  cancelAnimationFrame(fwAnimFrame);
  loop();
  burst();
  clearTimeout(fwStopTimer);
  fwStopTimer = setTimeout(stopFireworks, 6000);
}

function spawnBurst(canvas, particles) {
  const colors = ['#ffd700','#ff4444','#44ff88','#4488ff','#ff88ff','#ffffff','#ffaa00','#00ffee'];
  const x = Math.random() * canvas.width * 0.8 + canvas.width * 0.1;
  const y = Math.random() * canvas.height * 0.5 + 50;
  const num = 80 + Math.floor(Math.random() * 60);
  const color = colors[Math.floor(Math.random() * colors.length)];
  for (let i = 0; i < num; i++) {
    const angle = (Math.PI * 2 * i) / num + (Math.random() - 0.5) * 0.3;
    const speed = 2 + Math.random() * 5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      r: 2 + Math.random() * 3,
      color: Math.random() > 0.3 ? color : colors[Math.floor(Math.random() * colors.length)]
    });
  }
}

// Mini feu d'artifice centré sur un élément (ligne de jauge)
function launchBadgeFirework(el) {
  if (!el) return;
  const canvas = document.createElement('canvas');
  const W = el.offsetWidth + 120;
  const H = el.offsetHeight + 120;
  canvas.width = W;
  canvas.height = H;
  Object.assign(canvas.style, {
    position: 'absolute', left: '-60px', top: '-60px', width: W + 'px', height: H + 'px',
    pointerEvents: 'none', zIndex: 5
  });
  el.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const colors = ['#ffd700','#ffaa00','#ffffff','#ff88ff','#44ff88','#4488ff'];
  let particles = [];

  function burst() {
    const color = colors[Math.floor(Math.random() * colors.length)];
    const cx = 60 + Math.random() * (W - 120);
    const cy = H / 2;
    const num = 40 + Math.floor(Math.random() * 20);
    for (let k = 0; k < num; k++) {
      const angle = (Math.PI * 2 * k) / num + (Math.random() - 0.5) * 0.4;
      const speed = 1.5 + Math.random() * 3.5;
      particles.push({
        x: cx + (Math.random() - 0.5) * 20,
        y: cy + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        r: 1.5 + Math.random() * 2,
        color: Math.random() > 0.3 ? color : colors[Math.floor(Math.random() * colors.length)]
      });
    }
  }
  burst();
  setTimeout(burst, 250);
  setTimeout(burst, 500);

  function loop() {
    ctx.clearRect(0, 0, W, H);
    particles = particles.filter(p => p.alpha > 0.03);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.08; p.vx *= 0.98;
      p.alpha -= 0.018;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (particles.length > 0) requestAnimationFrame(loop);
    else canvas.remove();
  }
  loop();
}

function stopFireworks() {
  cancelAnimationFrame(fwAnimFrame);
  fwAnimFrame = null;
  clearTimeout(fwStopTimer);
  const canvas = $('fireworks-canvas');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  fwParticles = [];
}

// ======================================================================
// CONFETTIS (repris de Le Juste Prix)
// ======================================================================

let confettiFrame = null;
let confettiPieces = [];

function startConfetti() {
  const canvas = $('confetti-canvas');
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');

  const COLORS = ['#ffd700','#ff4466','#44ccff','#88ff44','#ff88ff','#ffffff','#ffaa00','#00ffcc','#ff6644'];
  const SHAPES = ['rect', 'circle', 'ribbon'];
  confettiPieces = [];

  for (let i = 0; i < 160; i++) {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    confettiPieces.push({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height,
      w: shape === 'ribbon' ? 3 + Math.random() * 4 : 7 + Math.random() * 9,
      h: shape === 'ribbon' ? 14 + Math.random() * 12 : 7 + Math.random() * 9,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.18,
      vx: (Math.random() - 0.5) * 1.8,
      vy: 1.4 + Math.random() * 2.8,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.03 + Math.random() * 0.04,
      swayAmp: 0.6 + Math.random() * 1.2,
      alpha: 0.85 + Math.random() * 0.15
    });
  }

  cancelAnimationFrame(confettiFrame);

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    confettiPieces.forEach(p => {
      p.sway += p.swaySpeed;
      p.x += p.vx + Math.sin(p.sway) * p.swayAmp;
      p.y += p.vy;
      p.angle += p.spin;
      if (p.y > canvas.height + 20) {
        p.y = -20;
        p.x = Math.random() * canvas.width;
      }
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'ribbon') {
        ctx.scale(Math.cos(p.sway * 1.5), 1);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    });
    confettiFrame = requestAnimationFrame(loop);
  }
  loop();
}

function stopConfetti() {
  cancelAnimationFrame(confettiFrame);
  confettiFrame = null;
  confettiPieces = [];
  const canvas = $('confetti-canvas');
  if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

// ======================================================================
// CLASSEMENT FINAL
// ======================================================================

let finalSig = '';

function renderFinalIfChanged() {
  const sig = JSON.stringify([S.ranking, S.roundScores]);
  if (sig !== finalSig) renderFinal(false);
}

function renderFinal(withConfetti = true) {
  if (!S) return;
  finalSig = JSON.stringify([S.ranking, S.roundScores]);
  const ranked = S.ranking;

  const top3 = ranked.filter(t => t.rank <= 3);
  const podiumOrder = [];
  const second = top3.find(t => t.rank === 2);
  const first = top3.filter(t => t.rank === 1);
  const third = top3.find(t => t.rank === 3);
  if (second) podiumOrder.push({ ...second, cls: 'second', num: '2' });
  first.forEach(f => podiumOrder.push({ ...f, cls: 'first', num: '1' }));
  if (third) podiumOrder.push({ ...third, cls: 'third', num: '3' });

  $('podium').innerHTML = podiumOrder.map(t => `
    <div class="podium-place ${t.cls}">
      <div class="podium-avatar">🏆</div>
      <div class="podium-name">${escHtml(t.name)}</div>
      <div class="podium-score">${t.score} pts</div>
      <div class="podium-block">${t.num}</div>
    </div>`).join('');

  const played = S.targets.slice(0, S.round + 1);
  $('final-thead').innerHTML = '<tr><th>Rang</th><th>Équipe</th>'
    + played.map((tg, i) => `<th class="num">M${i + 1} (${tg})</th>`).join('')
    + '<th class="num">Pile</th><th class="num">Dépass.</th><th class="num">Exactes</th><th class="num">Total</th></tr>';

  $('final-tbody').innerHTML = ranked.map(t => {
    const scores = (S.roundScores[t.id] || []);
    const ex = ranked.filter(o => o.rank === t.rank).length > 1;
    return `<tr class="${t.rank <= 3 ? 'top-rank' : ''}">
      <td>${t.rank}${ex ? ' <span title="Ex æquo">=</span>' : ''}</td>
      <td>${escHtml(t.name)}</td>
      ${played.map((_, i) => `<td class="num">${scores[i] === null || scores[i] === undefined ? '—' : scores[i]}</td>`).join('')}
      <td class="num">${t.exactTargets}</td>
      <td class="num">${t.overs}</td>
      <td class="num">${t.exactAnswers}</td>
      <td class="num"><b>${t.score} pts</b></td>
    </tr>`;
  }).join('');

  if (withConfetti) startConfetti();
}

window.addEventListener('resize', () => {
  const c = $('confetti-canvas');
  if (c && confettiFrame) { c.width = window.innerWidth; c.height = window.innerHeight; }
  const f = $('fireworks-canvas');
  if (f && fwAnimFrame) { f.width = window.innerWidth; f.height = window.innerHeight; }
});

// ======================================================================
// CONFIRM MODAL (repris de Le Juste Prix)
// ======================================================================

function showConfirm({ icon = '⚠️', title, message, labelOk = 'Confirmer', danger = false, onOk }) {
  $('confirm-icon').textContent = icon;
  $('confirm-title').textContent = title;
  $('confirm-message').textContent = message;

  const okBtn = $('confirm-ok');
  okBtn.textContent = labelOk;
  okBtn.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');

  const newOk = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOk, okBtn);
  newOk.addEventListener('click', () => {
    closeConfirm();
    onOk();
  });

  $('confirm-cancel').onclick = closeConfirm;
  $('confirm-modal').classList.add('visible');
}

function closeConfirm() {
  $('confirm-modal').classList.remove('visible');
}

// ======================================================================
// INIT
// ======================================================================

(async function init() {
  try {
    const res = await fetch('/api/network');
    network = await res.json();
  } catch (e) { network = null; }

  // Après un F5 : reprendre directement la partie en cours
  const savedCode = localStorage.getItem(STORAGE_KEY);
  await poll();
  if (S && savedCode === S.code) { started = true; render(); }
  pollTimer = setInterval(poll, 1000);
})();
