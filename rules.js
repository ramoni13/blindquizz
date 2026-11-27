// ======================================================================
// BLIND QUIZZ — diaporama des règles (plein écran)
// Principes : 1 idée par slide · peu de mots · mêmes couleurs partout
// (vert = points, or = cible/bonus, rouge = danger, bleu = jauge) ·
// l'animation montre la règle avant que le texte ne l'explique.
// ======================================================================

(function () {
  const $r = id => document.getElementById(id);
  const CANCEL = { cancelled: true };
  let idx = 0;
  let token = 0;
  let open = false;
  let track = { target: 25, max: 30 };

  // Attente annulable : si l'on change de slide, l'animation en cours s'arrête proprement
  function waiter(run) {
    return ms => new Promise((res, rej) => setTimeout(() => (run === token ? res() : rej(CANCEL)), ms));
  }

  const el = (i, html, cls = '') => `<div class="${cls}" style="--i:${i}">${html}</div>`;
  const head = (kicker, title) =>
    el(0, kicker, 'rl-kicker') + el(1, title, 'rl-title');

  // ---------- Piste + pions ----------

  function trackHtml(target, pawns) {
    const max = target + 5;
    track = { target, max };
    const major = target <= 25 ? 5 : 10;
    const tp = (target / max * 100).toFixed(3);
    let ticks = '';
    for (let k = 1; k < max; k++) ticks += `<span class="${k % major === 0 ? 'major' : ''}" style="left:${(k / max * 100).toFixed(3)}%"></span>`;
    let scale = '<span style="left:0%">0</span>';
    for (let k = major; k < max; k += major) {
      if (Math.abs(k - target) <= major / 2) continue;
      scale += `<span style="left:${(k / max * 100).toFixed(3)}%">${k}</span>`;
    }
    scale += `<span class="tgt" style="left:${tp}%">🎯 ${target}</span>`;
    const ph = pawns.map(p =>
      `<div class="rl-pawn notrans" id="rp-${p.id}" style="--b:${p.color || '#42a5f5'};bottom:${p.bottom || 74}px">`
      + `<span class="rl-pdot"></span><span>${p.label}</span><span class="rl-pnum" id="rpn-${p.id}">0</span></div>`).join('');
    return `<div class="rl-track" id="rl-track" style="--tp:${tp}%">${ph}`
      + `<div class="rl-bar"><div class="rl-ticks">${ticks}</div><div class="rl-tmark" style="left:${tp}%"></div></div>`
      + `<div class="rl-scale">${scale}</div></div>`;
  }

  function setPawn(id, val, instant) {
    const p = $r('rp-' + id);
    if (!p) return;
    const pos = Math.min(val, track.max) / track.max * 100;
    p.classList.toggle('notrans', !!instant);
    p.style.left = pos + '%';
    p.style.transform = `translateX(-${pos}%)`;
    p.style.setProperty('--ptr', pos + '%');
    $r('rpn-' + id).textContent = val;
    p.classList.toggle('over', val > track.target);
    p.classList.toggle('beyond', val > track.max);
  }

  function floatAt(val, text, red, bottom) {
    const t = $r('rl-track');
    if (!t) return;
    const f = document.createElement('div');
    f.className = 'rl-float' + (red ? ' red' : '');
    f.textContent = text;
    f.style.left = (Math.min(val, track.max) / track.max * 100) + '%';
    if (bottom) f.style.bottom = bottom + 'px';
    t.appendChild(f);
    setTimeout(() => f.remove(), 1600);
  }

  const on = (id, cls = 'on') => { const e = $r(id); if (e) e.classList.add(cls); };

  // ======================================================================
  // SLIDES
  // ======================================================================

  const SLIDES = [

    // 1 — Le principe
    {
      html: () => head('Blind Quizz', 'Approche la <span class="gold">cible</span>…<br>sans la <span class="red">dépasser</span> !')
        + el(2, trackHtml(25, [{ id: 'a', label: 'Votre équipe' }]))
        + el(3, 'Chaque bonne réponse fait <b>avancer votre jauge</b>', 'rl-caption'),
      async run(w) {
        setPawn('a', 0, true);
        await w(1100); setPawn('a', 9);
        await w(1300); setPawn('a', 17);
        await w(1300); setPawn('a', 24);
        await w(900); on('rp-a', 'locked');
      }
    },

    // 2 — Répondre
    {
      html: () => head('Étape 1', 'Une question.<br>Un chiffre de <span class="gold">0 à 9</span>.')
        + el(2, '<div class="rl-row">'
          + '<div class="rl-phone"><div class="rl-phone-q">Combien de pattes a une araignée ?</div>'
          + '<div class="rl-keypad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(k => `<div class="rl-key${k === 0 ? ' zero' : ''}" id="rk-${k}">${k}</div>`).join('') + '</div>'
          + '<div class="rl-phone-ok" id="rl-ok">✅ Valider « <span id="rl-okv">?</span> »</div></div>'
          + '<div class="rl-bignum">0–9<small>sur votre téléphone</small></div></div>')
        + el(3, 'Réfléchissez : <b>on ne vous dit pas</b> si vous avez juste', 'rl-caption'),
      async run(w) {
        await w(1500); on('rk-5', 'sel');
        await w(900); $r('rk-5').classList.remove('sel'); on('rk-8', 'sel'); $r('rl-okv').textContent = '8'; on('rl-ok', 'ready');
        await w(1200); $r('rl-ok').innerHTML = '✔ Réponse envoyée';
      }
    },

    // 3 — La jauge
    {
      html: () => head('Étape 2', 'La bonne réponse<br>fait <span class="gold">avancer la jauge</span>')
        + el(2, '<div class="rl-chips">'
          + [['Question 1', 7], ['Question 2', 4], ['Question 3', 9]].map((q, i) => `<div class="rl-chip" id="rc-${i}"><small>${q[0]}</small><b>+${q[1]}</b></div>`).join('') + '</div>')
        + el(3, trackHtml(25, [{ id: 'a', label: 'Votre équipe' }]))
        + el(4, 'La <b>valeur de la bonne réponse</b>… pour <b>tout le monde</b>', 'rl-caption'),
      async run(w) {
        setPawn('a', 0, true);
        const steps = [[7, 7], [4, 11], [9, 20]];
        await w(1300);
        for (let i = 0; i < steps.length; i++) {
          on('rc-' + i); setPawn('a', steps[i][1]); floatAt(steps[i][1], '+' + steps[i][0]);
          await w(1500);
        }
      }
    },

    // 4 — STOP
    {
      html: () => head('Étape 3', 'Tu peux dire <span class="red">STOP</span>')
        + el(2, '<div class="rl-row"><div class="rl-stopbtn" id="rl-stop">✋<span>STOP</span></div>'
          + trackHtml(25, [{ id: 'a', label: 'Vous', color: '#42a5f5', bottom: 74 }, { id: 'b', label: 'Eux', color: '#ffb74d', bottom: 128 }])
          + '</div>')
        + el(3, '<div class="rl-ghost" id="rl-ghost1">Vous gardez votre jauge…</div>')
        + el(4, 'STOP est <b>définitif</b> pour la manche', 'rl-caption'),
      async run(w) {
        setPawn('a', 0, true); setPawn('b', 0, true);
        await w(1000); setPawn('a', 8); setPawn('b', 8);
        await w(1400); setPawn('a', 18); setPawn('b', 18);
        await w(1500); on('rl-stop', 'pressed'); on('rp-a', 'locked');
        await w(600); on('rl-ghost1');
        await w(900); setPawn('b', 29);
        await w(1100);
        $r('rl-ghost1').textContent = 'Eux ont continué… et ont dépassé 💥';
      }
    },

    // 5 — Points par question
    {
      html: () => head('Étape 4', 'Les <span class="green">points</span> vs la <span class="gold">jauge</span>')
        + el(2, '<div class="rl-answer">Bonne réponse : <b>6</b></div>')
        + `<div class="rl-cells" style="--i:3">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => {
          const cls = n === 6 ? 'exact' : (n === 5 || n === 7) ? 'near' : '';
          const pts = n === 6 ? '9' : (n === 5 || n === 7) ? '7' : '0';
          return `<div class="rl-cell ${cls}" style="--k:${n}"><span class="n">${n}</span><span class="p">${pts} pts</span></div>`;
        }).join('')}</div>`
        + `<div class="rl-legend" style="--i:4">`
        + '<div class="rl-lg exact" style="--k:0">🎯 Exact : <b>valeur + 3</b></div>'
        + '<div class="rl-lg near" style="--k:1">± 1 : <b>valeur + 1</b></div>'
        + '<div class="rl-lg far" style="--k:2">Plus loin : <b>0 point</b></div></div>'
        + el(5, 'Plus ta réponse est <b>proche</b>, plus tu gagnes de <b>points</b>', 'rl-caption'),
      run: null
    },

    // 6 — Rapidité
    {
      html: () => head('Bonus', '<span class="gold">⚡ +1</span> pour la plus rapide')
        + el(2, '<div class="rl-race">'
          + [['Les Rapides', '2,4 s', 2400, 'win', '⚡ +1'], ['Les Tortues', '4,1 s', 4100, 'ok', '✔'], ['Les Rêveurs', '6,0 s', 6000, 'ok', '✔']].map(l =>
            `<div class="rl-lane"><div class="rl-lane-name">${l[0]}</div>`
            + `<div class="rl-lane-bar"><div class="rl-lane-fill" style="--ms:${l[2]}ms"></div></div>`
            + `<div class="rl-tag ${l[3]}" style="--ms:${l[2]}ms">${l[4]} <span style="font-weight:600;opacity:.8">${l[1]}</span></div></div>`).join('')
          + '</div>')
        + el(3, 'Parmi les <b>bonnes réponses exactes</b>', 'rl-caption'),
      run: null
    },

    // 7 — Dépassement
    {
      html: () => head('Attention !', 'Au-dessus de la cible :<br><span class="red">plus aucun point</span>')
        + el(2, trackHtml(25, [{ id: 'a', label: 'Votre équipe' }]))
        + el(3, 'Ni bonne réponse, ni précision, ni rapidité<span class="sub">La piste s\'arrête à la cible + 5 : au-delà, le nombre reste affiché</span>', 'rl-caption'),
      async run(w) {
        setPawn('a', 0, true);
        await w(1000); setPawn('a', 14); floatAt(14, '+14');
        await w(1500); setPawn('a', 21); floatAt(21, '+7');
        await w(1500); setPawn('a', 28); floatAt(28, '0 pt', true); on('rp-a', 'locked');
        await w(1700); setPawn('a', 34); floatAt(34, '0 pt', true);
      }
    },

    // 8 — Bilan
    {
      html: () => head('Fin de manche', 'Le <span class="gold">bilan</span> de la cible')
        + el(2, '<div class="rl-cards">'
          + '<div class="rl-card pile" style="--k:0"><h3>🎯 Pile</h3><div class="rl-gauge-ex">25 <span>/ 25</span></div><div class="rl-pts">+10</div><div class="rl-formula">Jackpot !</div></div>'
          + '<div class="rl-card under" style="--k:1"><h3>📉 En dessous</h3><div class="rl-gauge-ex">22 <span>/ 25</span></div><div class="rl-pts">+7</div><div class="rl-formula"><b>10 − 3</b> (écart)</div><div class="tiny">à 10 d\'écart ou plus : +0</div></div>'
          + '<div class="rl-card over" style="--k:2"><h3>💥 Au-dessus</h3><div class="rl-gauge-ex">28 <span>/ 25</span></div><div class="rl-pts">−3</div><div class="rl-formula">on perd le <b>dépassement</b></div></div>'
          + '</div>')
        + el(3, 'Plus tu es <b>près de la cible</b>, mieux c\'est', 'rl-caption'),
      run: null
    },

    // 9 — Classement
    {
      html: () => head('Le classement', 'Les points <span class="green">s\'ajoutent</span>,<br>les badges <span class="gold">bougent</span>')
        + el(2, '<div class="rl-board" id="rl-board"></div>')
        + el(3, 'On révèle équipe par équipe… <b>suspense !</b>', 'rl-caption'),
      async run(w) {
        const board = $r('rl-board');
        const H = 84;
        const teams = [
          { id: 'A', n: 'Alpha', s: 12 }, { id: 'B', n: 'Bravo', s: 10 },
          { id: 'C', n: 'Charlie', s: 8 }, { id: 'D', n: 'Delta', s: 6 }
        ];
        const gains = [['D', 10], ['C', 9], ['B', 5], ['A', -3]];
        let order = teams.map(t => t.id);
        const T = id => teams.find(t => t.id === id);
        board.innerHTML = teams.map((t, i) =>
          `<div class="rl-brow" id="rb-${t.id}" style="top:${i * H}px"><span class="rk" id="rbr-${t.id}">${i + 1}</span>`
          + `<span class="nm">${t.n}</span><span class="sc"><span id="rbs-${t.id}">${t.s}</span><span class="pl" id="rbp-${t.id}"></span></span></div>`).join('');
        await w(1400);
        for (const [id, g] of gains) {                                   // 1. +X sur les totaux
          const p = $r('rbp-' + id);
          p.textContent = (g > 0 ? '+' : '−') + Math.abs(g); p.className = 'pl ' + (g < 0 ? 'neg' : '') + ' show';
          await w(800);
        }
        await w(500);
        for (const [id, g] of gains) {                                   // 2. totaux mis à jour
          T(id).s += g;
          const s = $r('rbs-' + id); s.textContent = T(id).s;
          s.parentElement.classList.remove('bump'); void s.parentElement.offsetWidth; s.parentElement.classList.add('bump');
          const p = $r('rbp-' + id); p.classList.remove('show'); p.classList.add('hide');
          await w(250);
        }
        await w(800);
        const next = order.slice().sort((a, b) => T(b).s - T(a).s);      // 3. les badges glissent
        next.forEach((id, i) => {
          const row = $r('rb-' + id);
          if (order.indexOf(id) !== i) row.classList.add('moving');
          row.style.top = (i * H) + 'px';
          $r('rbr-' + id).textContent = i + 1;
        });
        order = next;
        await w(1200);
        document.querySelectorAll('.rl-brow.moving').forEach(r => r.classList.remove('moving'));
      }
    },

    // 10 — Les manches
    {
      html: () => head('C\'est parti !', '<span class="gold">4 manches</span>,<br>4 cibles de plus en plus hautes')
        + el(2, '<div class="rl-cards" style="width:min(1000px,92vw);gap:1.6vw">'
          + [25, 50, 75, 100].map((t, i) =>
            `<div class="rl-card pile" style="--k:${i};border-color:var(--y)"><h3>Manche ${i + 1}</h3><div class="rl-pts">🎯 ${t}</div></div>`).join('')
          + '</div>')
        + el(3, 'Dès la manche 2, des <b>bonus</b> s\'ajoutent (à découvrir)<span class="sub">L\'équipe avec le plus de points gagne 🏆</span>', 'rl-caption'),
      run: null
    }
  ];

  // ======================================================================
  // SLIDES DES BONUS (présentés avant les manches 2, 3, 4…)
  // ======================================================================

  const keypadHtml = (prefix, extra = '') =>
    '<div class="rl-keypad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(k =>
      `<div class="rl-key${k === 0 ? ' zero' : ''}" id="${prefix}-${k}">${k}</div>`).join('') + '</div>' + extra;

  const BONUS_SLIDES = {
    x2: [
      {
        html: () => head('Finale · nouveau bonus', 'Le <span class="gold">×2</span>')
          + el(2, '<div class="rl-row">'
            + '<div class="rl-phone"><div class="rl-phone-q">Combien de couleurs dans un sachet de M&amp;M\'s ?</div>'
            + '<div class="rl-bonusbar"><div class="rl-bbtn" id="bx-btn"><b>×2</b><small>points ×2</small></div></div>'
            + keypadHtml('bxk')
            + '<div class="rl-phone-ok" id="bx-ok">✅ Valider « <span id="bx-okv">?</span> »<span id="bx-okx"></span></div></div>'
            + '<div class="rl-bignum">×2<small>1 fois par manche</small></div></div>')
          + el(3, 'Sûrs de vous ? Touchez <b>×2</b> avant de <b>valider</b> votre réponse', 'rl-caption'),
        async run(w) {
          await w(1400); on('bxk-6', 'sel'); $r('bx-okv').textContent = '6';
          await w(1000); on('bx-btn', 'armed'); $r('bx-btn').querySelector('small').textContent = 'activé ✓';
          $r('bx-okx').textContent = ' avec ×2'; on('bx-ok', 'ready');
          await w(1300); $r('bx-ok').innerHTML = '✔ Réponse envoyée · ×2 joué';
        }
      },
      {
        html: () => head('Le ×2', 'Les <span class="green">points</span> de la question<br>sont <span class="gold">doublés</span>')
          + el(2, '<div class="rl-cards">'
            + '<div class="rl-card under" style="--k:0"><h3>🎯 Exact</h3><div class="rl-gauge-ex">6 <span>+ 3</span></div><div class="rl-pts">9 → 18</div><div class="rl-formula">jackpot !</div></div>'
            + '<div class="rl-card pile" style="--k:1"><h3>± 1</h3><div class="rl-gauge-ex">6 <span>+ 1</span></div><div class="rl-pts">7 → 14</div><div class="rl-formula">ça double aussi</div></div>'
            + '<div class="rl-card over" style="--k:2"><h3>❌ Raté</h3><div class="rl-gauge-ex">0 <span>pt</span></div><div class="rl-pts">0 × 2 = 0</div><div class="rl-formula">bonus <b>perdu</b></div></div>'
            + '</div>')
          + el(3, 'De quoi <b>renverser le classement</b> ! La jauge n\'est pas doublée · au-dessus de la cible : 0 × 2 = 0', 'rl-caption'),
        run: null
      }
    ],
    fifty: [
      {
        html: () => head('Nouveau bonus', 'Le <span class="gold">50-50</span>')
          + el(2, '<div class="rl-row">'
            + '<div class="rl-phone"><div class="rl-phone-q">Combien de pattes a une araignée ?</div>'
            + '<div class="rl-bonusbar"><div class="rl-bbtn" id="bf-btn"><b>50/50</b><small>demi-clavier</small></div></div>'
            + keypadHtml('bfk')
            + '</div>'
            + '<div class="rl-bignum">½<small>la moitié s\'éteint</small></div></div>')
          + el(3, 'Le clavier garde <b>0 à 4</b> ou <b>5 à 9</b> : la bonne réponse est <b>dans la moitié qui reste</b>', 'rl-caption'),
        async run(w) {
          await w(1500); on('bf-btn', 'active'); $r('bf-btn').querySelector('small').textContent = 'appliqué ✓';
          await w(500);
          for (const k of [0, 1, 2, 3, 4]) { on('bfk-' + k, 'off'); await w(120); }
          await w(900); on('bfk-8', 'sel');
        }
      },
      {
        html: () => head('Le 50-50', 'Instantané<br>et <span class="gold">bien caché</span>')
          + el(2, '<div class="rl-cards">'
            + '<div class="rl-card pile" style="--k:0"><h3>⚡ Immédiat</h3><div class="rl-pts">0 s</div><div class="rl-formula">le clavier s\'éteint <b>tout de suite</b></div></div>'
            + '<div class="rl-card under" style="--k:1"><h3>🤫 Discret</h3><div class="rl-pts">👀</div><div class="rl-formula">la moitié gardée n\'apparaît <b>que sur votre téléphone</b></div></div>'
            + '<div class="rl-card over" style="--k:2"><h3>☝️ Une fois</h3><div class="rl-pts">1 / manche</div><div class="rl-formula">même si vous ne répondez pas ensuite</div></div>'
            + '</div>')
          + el(3, 'Il <b>se combine</b> avec les bonus des manches suivantes 😈', 'rl-caption'),
        run: null
      }
    ],
    spy: [
      {
        html: () => head('Nouveau bonus', 'L\'<span class="gold">Espion</span> 🕵️')
          + el(2, '<div class="rl-row">'
            + '<div class="rl-phone"><div class="rl-phone-q">Combien de vies a un chat selon le dicton français ?</div>'
            + '<div class="rl-bonusbar"><div class="rl-bbtn" id="bs-btn"><b>🕵️</b><small>espionner</small></div></div>'
            + '<div class="rl-spybox" id="bs-box"><small>Réponses des autres équipes</small><div class="rl-spylist" id="bs-list"><b class="wait">…</b></div><span id="bs-sub">personne n\'a répondu</span></div>'
            + keypadHtml('bsk')
            + '</div>'
            + '<div class="rl-bignum">👀<small>les réponses adverses</small></div></div>')
          + el(3, 'Vous voyez <b>en direct</b> la réponse de chaque équipe… <b>dès qu\'elle a répondu</b>', 'rl-caption'),
        async run(w) {
          await w(1300); on('bs-btn', 'active'); $r('bs-btn').querySelector('small').textContent = 'en cours 👀'; on('bs-box');
          const list = $r('bs-list');
          const steps = [['Les Rapides', 9], ['Alpha', 7], ['Bravo', 7]];
          for (let i = 0; i < steps.length; i++) {
            await w(1200);
            if (i === 0) list.innerHTML = '';
            list.insertAdjacentHTML('beforeend', `<span class="rl-spychip">${steps[i][0]} <b>${steps[i][1]}</b></span>`);
            $r('bs-sub').textContent = `${i + 1} équipe(s) sur 3`;
          }
          await w(900); on('bsk-7', 'sel');
        }
      },
      {
        html: () => head('L\'Espion', 'Espionner…<br>ou <span class="red">se faire piéger</span> ?')
          + el(2, '<div class="rl-cards">'
            + '<div class="rl-card pile" style="--k:0"><h3>⏳ Patience</h3><div class="rl-pts">🐢</div><div class="rl-formula">plus vous attendez, plus vous voyez de <b>réponses</b>… mais <b>adieu la rapidité</b></div></div>'
            + '<div class="rl-card under" style="--k:1"><h3>📣 Démasqué</h3><div class="rl-pts">👀</div><div class="rl-formula">les équipes espionnées sont <b>prévenues</b> sur leur téléphone</div></div>'
            + '<div class="rl-card over" style="--k:2"><h3>🎭 Intox</h3><div class="rl-pts">🤥</div><div class="rl-formula">les autres peuvent se tromper… <b>ou bluffer</b> !</div></div>'
            + '</div>')
          + el(3, 'Copier le leader… ou <b>s\'en méfier</b> ? 😉', 'rl-caption'),
        run: null
      }
    ]
  };

  // Slides présentées avant une manche : le(s) nouveau(x) bonus, puis le récapitulatif
  function bonusDeck(bonuses, newIds) {
    const deck = [];
    newIds.forEach(id => (BONUS_SLIDES[id] || []).forEach(s => deck.push(s)));
    if (bonuses.length) {
      deck.push({
        html: () => head('Vos bonus pour cette manche', 'Chacun <span class="gold">1 fois</span> par manche')
          + el(2, '<div class="rl-cards">' + bonuses.map((b, i) =>
            `<div class="rl-card pile" style="--k:${i}"><h3>${b.name}</h3><div class="rl-pts">${b.icon}</div>`
            + `<div class="rl-formula">${b.short}</div>${newIds.includes(b.id) ? '<div class="tiny">NOUVEAU</div>' : ''}</div>`).join('') + '</div>')
          + el(3, 'Les bonus <b>se cumulent</b> d\'une manche à l\'autre', 'rl-caption'),
        run: null
      });
    }
    return deck;
  }

  // ======================================================================
  // NAVIGATION
  // ======================================================================

  let deck = SLIDES;

  function buildDots() {
    $r('rl-dots').innerHTML = deck.map((_, i) => `<span class="rl-dot" id="rl-dot-${i}"></span>`).join('');
  }

  function show(i) {
    idx = Math.max(0, Math.min(deck.length - 1, i));
    const run = ++token;
    const s = deck[idx];
    const stage = $r('rl-stage');
    stage.innerHTML = `<div class="rl-slide"><div class="rl-fit" id="rl-fit">${s.html()}</div></div>`;
    fitSlide();
    deck.forEach((_, k) => {
      const d = $r('rl-dot-' + k);
      d.className = 'rl-dot' + (k < idx ? ' done' : k === idx ? ' cur' : '');
    });
    $r('rl-count').textContent = `${idx + 1} / ${deck.length}`;
    $r('rl-back').hidden = idx === 0;
    const last = idx === deck.length - 1;
    $r('rl-next').textContent = last ? '✔ Terminer' : 'Suivant ▶';
    setTimeout(() => { if (run === token) fitSlide(); }, 1200);   // re-mesure une fois la slide posée
    if (s.run) s.run(waiter(run)).catch(e => { if (e !== CANCEL) console.error(e); });
  }

  // Ajuste la slide à la taille de l'écran : on réduit (jamais on n'agrandit) pour que tout reste visible
  function fitSlide() {
    const fit = $r('rl-fit'), stage = $r('rl-stage');
    if (!fit || !stage) return;
    fit.style.transform = 'none';
    const k = Math.min(1, (stage.clientHeight - 28) / fit.scrollHeight, (stage.clientWidth - 28) / fit.scrollWidth);
    fit.style.transform = k < 1 ? `scale(${k.toFixed(3)})` : 'none';
  }
  window.addEventListener('resize', () => { if (open) fitSlide(); });

  function rulesNext() {
    if (idx >= deck.length - 1) closeRules(); else show(idx + 1);
  }
  function rulesBack() { if (idx > 0) show(idx - 1); }

  function openRules() { openDeck(SLIDES); }

  // Présentation des bonus d'une manche. bonuses : [{ id, icon, name, short }], newIds : ids nouveaux
  function openBonuses(bonuses, newIds) {
    const d = bonusDeck(bonuses || [], newIds || []);
    if (d.length) openDeck(d);
  }

  function openDeck(d) {
    if (open) return;
    open = true;
    deck = d;
    buildDots();
    $r('rules-overlay').classList.add('visible');
    show(0);
    const root = document.documentElement;
    if (root.requestFullscreen && !document.fullscreenElement) root.requestFullscreen().catch(() => {});
  }

  function closeRules() {
    if (!open) return;
    open = false;
    token++;
    $r('rules-overlay').classList.remove('visible');
    $r('rl-stage').innerHTML = '';
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }

  document.addEventListener('keydown', e => {
    if (!open) return;
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter' || e.key === 'PageDown') { e.preventDefault(); rulesNext(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); rulesBack(); }
    else if (e.key === 'Escape') closeRules();
  });

  window.openRules = openRules;
  window.openBonuses = openBonuses;
  window.closeRules = closeRules;
  window.rulesNext = rulesNext;
  window.rulesBack = rulesBack;
})();
