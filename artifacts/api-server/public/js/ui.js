/* ═══════════════════════════════════════════════════════════════════
   ui.js — DOM manipulation engine (Skribbl INKSHOT edition)
═══════════════════════════════════════════════════════════════════ */

const UI = (() => {
  const CIRCUMFERENCE = 2 * Math.PI * 23;

  /* ══════════════════════════════════════════════════════════════════
     ORGANIC SKRIBBL AVATAR ENGINE
  ══════════════════════════════════════════════════════════════════ */
  const BODY_COLORS = [
    '#E74C3C','#E91E63','#FF9800','#F1C40F','#2ECC71',
    '#1ABC9C','#3498DB','#9B59B6','#FF5722','#00BCD4',
    '#8BC34A','#FF4081','#795548','#607D8B','#FF6B6B',
    '#A855F7','#F97316','#06B6D4','#84CC16','#F43F5E',
  ];

  function _wCircle(ctx, cx, cy, r, seed) {
    ctx.beginPath();
    const N = 80;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const a = t * Math.PI * 2 - Math.PI / 2;
      const w = 1
        + Math.sin(t * 7 * Math.PI + seed) * 0.022
        + Math.sin(t * 13 * Math.PI + seed * 0.7) * 0.012;
      const x = cx + Math.cos(a) * r * w;
      const y = cy + Math.sin(a) * r * w;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function _drawEyes(ctx, cx, cy, r, idx, W) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const lw  = Math.max(1.5, W * 0.04);
    const ex  = r * 0.30;
    const ey  = cy - r * 0.14;
    const er  = r * 0.13;
    ctx.strokeStyle = '#1a1a1a'; ctx.fillStyle = '#1a1a1a'; ctx.lineWidth = lw;

    switch (idx % 10) {
      case 0: // Classic dots
        ctx.beginPath(); ctx.arc(cx - ex, ey, er * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + ex, ey, er * 0.55, 0, Math.PI * 2); ctx.fill();
        break;
      case 1: // Angry brows
        ctx.beginPath(); ctx.arc(cx - ex, ey, er * 0.50, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + ex, ey, er * 0.50, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = lw * 1.3;
        ctx.beginPath(); ctx.moveTo(cx - ex - er, ey - er * 1.4); ctx.lineTo(cx - ex + er * 0.4, ey - er * 0.7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + ex + er, ey - er * 1.4); ctx.lineTo(cx + ex - er * 0.4, ey - er * 0.7); ctx.stroke();
        break;
      case 2: // X eyes
        ctx.lineWidth = lw * 1.2;
        for (const s of [-1, 1]) {
          const ex2 = cx + s * ex;
          ctx.beginPath(); ctx.moveTo(ex2 - er, ey - er); ctx.lineTo(ex2 + er, ey + er); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(ex2 + er, ey - er); ctx.lineTo(ex2 - er, ey + er); ctx.stroke();
        }
        break;
      case 3: { // Sunglasses bar
        const sgW = ex * 2.5, sgH = er * 1.0;
        ctx.fillStyle = '#111';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(cx - sgW / 2, ey - sgH / 2, sgW, sgH, er * 0.35);
        else ctx.rect(cx - sgW / 2, ey - sgH / 2, sgW, sgH);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(cx - sgW * 0.45, ey - sgH * 0.28, er * 0.6, sgH * 0.38);
        ctx.fillRect(cx + er * 0.3,   ey - sgH * 0.28, er * 0.6, sgH * 0.38);
        break;
      }
      case 4: // Half-lidded sleepy
        for (const s of [-1, 1]) {
          const ex2 = cx + s * ex;
          ctx.fillStyle = 'white'; ctx.strokeStyle = '#333'; ctx.lineWidth = lw * 0.7;
          ctx.beginPath(); ctx.arc(ex2, ey, er, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(ex2 - er - 1, ey - er - 1, er * 2 + 2, er * 1.1);
          ctx.beginPath(); ctx.arc(ex2, ey + er * 0.1, er * 0.42, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = '#1a1a1a'; ctx.fillStyle = '#1a1a1a';
        break;
      case 5: // Anime glossy
        for (const s of [-1, 1]) {
          const ex2 = cx + s * ex;
          ctx.fillStyle = 'white'; ctx.strokeStyle = '#222'; ctx.lineWidth = lw * 0.8;
          ctx.beginPath(); ctx.ellipse(ex2, ey, er * 0.8, er * 1.05, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#111';
          ctx.beginPath(); ctx.arc(ex2, ey + er * 0.1, er * 0.50, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'white';
          ctx.beginPath(); ctx.arc(ex2 - er * 0.22, ey - er * 0.22, er * 0.20, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = '#1a1a1a'; ctx.fillStyle = '#1a1a1a';
        break;
      case 6: // Giant cyclops eye
        ctx.fillStyle = 'white'; ctx.strokeStyle = '#222'; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.ellipse(cx, ey, er * 1.25, er * 1.25, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(cx, ey, er * 0.65, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(cx - er * 0.28, ey - er * 0.28, er * 0.24, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1a1a1a'; ctx.fillStyle = '#1a1a1a';
        break;
      case 7: { // Crown + aviators
        const crY = ey - r * 0.50, crW = r * 0.72;
        ctx.fillStyle = '#FFD700'; ctx.strokeStyle = '#b8860b'; ctx.lineWidth = lw * 0.6;
        ctx.beginPath();
        ctx.moveTo(cx - crW / 2, crY + r * 0.12); ctx.lineTo(cx - crW / 2, crY);
        ctx.lineTo(cx - crW * 0.22, crY + r * 0.06); ctx.lineTo(cx, crY - r * 0.12);
        ctx.lineTo(cx + crW * 0.22, crY + r * 0.06); ctx.lineTo(cx + crW / 2, crY);
        ctx.lineTo(cx + crW / 2, crY + r * 0.12); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(80,160,255,0.55)'; ctx.strokeStyle = '#555'; ctx.lineWidth = lw * 0.75;
        ctx.beginPath(); ctx.ellipse(cx - ex, ey, er * 0.82, er * 0.72, -0.12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(cx + ex, ey, er * 0.82, er * 0.72, 0.12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#555'; ctx.lineWidth = lw * 0.55;
        ctx.beginPath(); ctx.moveTo(cx - ex + er * 0.65, ey); ctx.lineTo(cx + ex - er * 0.65, ey); ctx.stroke();
        ctx.strokeStyle = '#1a1a1a'; ctx.fillStyle = '#1a1a1a';
        break;
      }
      case 8: // Wide scared
        for (const s of [-1, 1]) {
          const ex2 = cx + s * ex;
          ctx.fillStyle = 'white'; ctx.strokeStyle = '#333'; ctx.lineWidth = lw;
          ctx.beginPath(); ctx.arc(ex2, ey, er * 0.95, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#111';
          ctx.beginPath(); ctx.arc(ex2, ey, er * 0.48, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'white';
          ctx.beginPath(); ctx.arc(ex2 - er * 0.18, ey - er * 0.18, er * 0.18, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = '#1a1a1a'; ctx.fillStyle = '#1a1a1a';
        break;
      case 9: // Heart eyes
        for (const s of [-1, 1]) {
          const ex2 = cx + s * ex;
          ctx.fillStyle = '#ff4466';
          ctx.beginPath();
          ctx.moveTo(ex2, ey + er * 0.55);
          ctx.bezierCurveTo(ex2 - er * 0.95, ey + er * 0.1,  ex2 - er * 0.95, ey - er * 0.5, ex2, ey - er * 0.15);
          ctx.bezierCurveTo(ex2 + er * 0.95, ey - er * 0.5,  ex2 + er * 0.95, ey + er * 0.1, ex2, ey + er * 0.55);
          ctx.closePath(); ctx.fill();
        }
        break;
    }
  }

  function _drawMouth(ctx, cx, cy, r, idx, W) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const lw = Math.max(1.5, W * 0.04);
    const my = cy + r * 0.30;
    const mw = r * 0.50;
    ctx.strokeStyle = '#1a1a1a'; ctx.fillStyle = '#1a1a1a'; ctx.lineWidth = lw * 1.1;

    switch (idx % 10) {
      case 0: // Squiggle
        ctx.beginPath();
        ctx.moveTo(cx - mw, my);
        ctx.bezierCurveTo(cx - mw * 0.35, my + r * 0.08, cx + mw * 0.35, my - r * 0.08, cx + mw, my);
        ctx.stroke();
        break;
      case 1: // Happy open smile
        ctx.fillStyle = '#c0392b';
        ctx.beginPath(); ctx.arc(cx, my - r * 0.05, mw, 0, Math.PI); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.arc(cx, my - r * 0.05, mw, 0, Math.PI); ctx.stroke();
        ctx.fillStyle = 'white';
        ctx.fillRect(cx - mw * 0.82, my - r * 0.05, mw * 1.64, r * 0.12);
        break;
      case 2: // Mustache
        ctx.fillStyle = '#1a1a1a';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx, my);
          ctx.bezierCurveTo(cx + s * mw * 0.28, my - r * 0.08, cx + s * mw * 0.88, my + r * 0.16, cx + s * mw * 1.08, my - r * 0.04);
          ctx.bezierCurveTo(cx + s * mw * 0.78, my - r * 0.20, cx + s * mw * 0.32, my - r * 0.05, cx, my);
          ctx.fill();
        }
        break;
      case 3: // Sad frown
        ctx.beginPath();
        ctx.moveTo(cx - mw, my);
        ctx.bezierCurveTo(cx - mw * 0.4, my + r * 0.22, cx + mw * 0.4, my + r * 0.22, cx + mw, my);
        ctx.stroke();
        break;
      case 4: // Stitched horror
        ctx.beginPath(); ctx.moveTo(cx - mw, my); ctx.lineTo(cx + mw, my); ctx.stroke();
        ctx.lineWidth = lw * 0.6;
        for (let i = 0; i < 5; i++) {
          const sx = cx - mw + (i + 0.5) * (mw * 2 / 5);
          ctx.beginPath(); ctx.moveTo(sx - r * 0.04, my - r * 0.08); ctx.lineTo(sx + r * 0.04, my + r * 0.08); ctx.stroke();
        }
        break;
      case 5: // Shocked O
        ctx.fillStyle = '#c0392b'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.ellipse(cx, my, mw * 0.45, mw * 0.62, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#7a0000';
        ctx.beginPath(); ctx.ellipse(cx, my, mw * 0.26, mw * 0.38, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1a1a1a';
        break;
      case 6: // Smirk
        ctx.beginPath();
        ctx.moveTo(cx - mw * 0.28, my + r * 0.05);
        ctx.bezierCurveTo(cx, my + r * 0.1, cx + mw * 0.5, my - r * 0.04, cx + mw * 0.78, my - r * 0.09);
        ctx.stroke();
        break;
      case 7: // Tongue out
        ctx.lineWidth = lw;
        ctx.beginPath(); ctx.arc(cx, my - r * 0.04, mw * 0.68, 0, Math.PI); ctx.stroke();
        ctx.fillStyle = '#ff6680'; ctx.strokeStyle = '#cc3355'; ctx.lineWidth = lw * 0.7;
        ctx.beginPath(); ctx.ellipse(cx, my + mw * 0.28, mw * 0.28, mw * 0.38, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#1a1a1a';
        break;
      case 8: // Zipper mouth
        ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(cx - mw, my); ctx.lineTo(cx + mw, my); ctx.stroke();
        ctx.fillStyle = '#888'; ctx.lineWidth = 0;
        for (let i = 0; i <= 6; i++) {
          const zx = cx - mw + i * (mw * 2 / 6);
          ctx.beginPath(); ctx.arc(zx, my, r * 0.048, 0, Math.PI * 2); ctx.fill();
        }
        break;
      case 9: // Cat mouth
        ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(cx, my - r * 0.04); ctx.lineTo(cx, my + r * 0.07); ctx.stroke();
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx, my + r * 0.07);
          ctx.bezierCurveTo(cx + s * mw * 0.18, my + r * 0.15, cx + s * mw * 0.65, my + r * 0.10, cx + s * mw * 0.88, my - r * 0.02);
          ctx.stroke();
        }
        break;
    }
  }

  function renderSkribblAvatar(canvas, features) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    const cx   = W * 0.5;
    const cy   = H * 0.48;
    const r    = Math.min(W, H) * 0.40;
    const bi   = (features && features.bodyIndex != null) ? features.bodyIndex : 0;
    const seed = bi * 1.618;
    const color = BODY_COLORS[bi % BODY_COLORS.length];

    _wCircle(ctx, cx, cy, r, seed);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.save();
    _wCircle(ctx, cx, cy, r, seed);
    ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.07)';
    ctx.lineWidth = Math.max(1, W * 0.018);
    const gap = Math.max(4, W * 0.1);
    for (let i = -r * 2; i < r * 4; i += gap) {
      ctx.beginPath();
      ctx.moveTo(cx - r * 2 + i, cy - r * 2);
      ctx.lineTo(cx + i,          cy + r * 2);
      ctx.stroke();
    }
    ctx.restore();

    _wCircle(ctx, cx, cy, r, seed);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = Math.max(2, W * 0.045);
    ctx.stroke();

    const ei = (features && features.eyeIndex   != null) ? features.eyeIndex   : 0;
    const mi = (features && features.mouthIndex != null) ? features.mouthIndex : 0;
    _drawEyes(ctx, cx, cy, r, ei, W);
    _drawMouth(ctx, cx, cy, r, mi, W);
  }

  function getAvatarFeatures(playerIdOrName, avatarColor, avatarData) {
    if (avatarData && avatarData.bodyIndex != null) return avatarData;
    const colorIdx = BODY_COLORS.findIndex(c => c.toLowerCase() === (avatarColor || '').toLowerCase());
    let hash = 0;
    for (const c of (playerIdOrName || '')) { hash = ((hash << 5) - hash) + c.charCodeAt(0); hash |= 0; }
    return {
      bodyIndex:  colorIdx >= 0 ? colorIdx : Math.abs(hash) % BODY_COLORS.length,
      eyeIndex:   Math.abs(hash >> 3) % 10,
      mouthIndex: Math.abs(hash >> 6) % 10,
    };
  }

  /* ══════════════════════════════════════════════════════════════════
     OVERLAY MANAGER
  ══════════════════════════════════════════════════════════════════ */
  const OVERLAY_IDS = {
    'lobby':          'overlay-lobby',
    'word-selection': 'overlay-word-selection',
    'turn-over':      'overlay-turn-over',
    'round-over':     'overlay-round-over',
    'game-over':      'overlay-game-over',
  };

  function showOverlay(name) {
    Object.entries(OVERLAY_IDS).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (key === name) { el.classList.remove('hidden'); el.classList.add('active'); }
      else              { el.classList.add('hidden');    el.classList.remove('active'); }
    });
    const status = document.getElementById('header-status');
    if (status) {
      const labels = {
        'lobby':'WAITING','word-selection':'CHOOSING',
        'turn-over':'TURN OVER','round-over':'ROUND OVER','game-over':'GAME OVER',
      };
      status.textContent = labels[name] || 'WAITING';
    }
  }

  function hideAllOverlays() {
    Object.values(OVERLAY_IDS).forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.classList.add('hidden'); el.classList.remove('active'); }
    });
    const status = document.getElementById('header-status');
    if (status) status.textContent = 'GUESS THIS';
  }

  /* ══════════════════════════════════════════════════════════════════
     PLAYER LIST
  ══════════════════════════════════════════════════════════════════ */
  function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    if (!list) return;
    list.innerHTML = '';
    const sorted = [...players].sort((a, b) => b.score - a.score);

    sorted.forEach((p, idx) => {
      const rank = idx + 1;
      const card = document.createElement('div');
      card.className = 'player-card' +
        (p.isDrawing  ? ' is-drawing'  : '') +
        (p.hasGuessed ? ' has-guessed' : '');
      card.id    = 'player-card-' + p.id;
      card.title = p.username;
      card.addEventListener('click', () => { openPlayerModal(p); });

      const rankEl = document.createElement('span');
      rankEl.className = 'player-rank';
      rankEl.textContent = '#' + rank;

      const crownEl = document.createElement('span');
      crownEl.className = 'player-crown';
      crownEl.textContent = p.isHost ? '👑' : '';

      const info = document.createElement('div');
      info.className = 'player-card-info';

      const nameEl = document.createElement('div');
      nameEl.className = 'player-card-name' + (p.isYou ? ' is-you' : '');
      const nameText = document.createElement('span');
      nameText.textContent = escHtml(p.username) + (p.isYou ? ' (You)' : '');
      nameEl.appendChild(nameText);
      if (p.isDrawing) {
        const pencil = document.createElement('span');
        pencil.className = 'drawing-pencil';
        pencil.textContent = '✏';
        nameEl.appendChild(pencil);
      }

      const scoreEl = document.createElement('div');
      scoreEl.className = 'player-card-score';
      scoreEl.textContent = p.score + ' points';

      info.appendChild(nameEl);
      info.appendChild(scoreEl);

      const avatarWrap = document.createElement('div');
      avatarWrap.className = 'player-card-avatar';
      const c = document.createElement('canvas');
      c.width = 36; c.height = 36;
      avatarWrap.appendChild(c);
      renderSkribblAvatar(c, getAvatarFeatures(p.id, p.avatarColor, p.avatarData));

      if (p.isHost) {
        const crownOverlay = document.createElement('span');
        crownOverlay.className = 'avatar-crown-overlay';
        crownOverlay.textContent = '👑';
        avatarWrap.appendChild(crownOverlay);
      }

      card.appendChild(rankEl);
      card.appendChild(crownEl);
      card.appendChild(info);
      card.appendChild(avatarWrap);
      list.appendChild(card);
    });
  }

  function flashPlayerCard(username) {
    const cards = document.querySelectorAll('.player-card');
    cards.forEach(card => {
      const nameEl = card.querySelector('.player-card-name span');
      if (nameEl && (nameEl.textContent === username || nameEl.textContent.startsWith(username + ' '))) {
        card.classList.add('flash-green');
        setTimeout(() => card.classList.remove('flash-green'), 700);
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     WORD DISPLAY
  ══════════════════════════════════════════════════════════════════ */
  function setWordDisplay(word) {
    const el = document.getElementById('word-display');
    if (el) el.textContent = word;
    const status = document.getElementById('header-status');
    if (status) status.textContent = 'DRAWING';
  }

  function setMaskDisplay(mask) {
    const el = document.getElementById('word-display');
    if (!el) return;
    el.textContent = mask.join(' ');
    const status = document.getElementById('header-status');
    if (status) status.textContent = 'GUESS THIS';
  }

  /* ══════════════════════════════════════════════════════════════════
     TIMER RING
  ══════════════════════════════════════════════════════════════════ */
  function updateTimerRing(timer, total) {
    const ring = document.getElementById('timer-ring-fill');
    const text = document.getElementById('timer-text');
    if (!ring || !text) return;
    const pct = Math.max(0, timer / total);
    ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct);
    ring.classList.remove('warning', 'danger');
    if      (pct <= 0.25) ring.classList.add('danger');
    else if (pct <= 0.5)  ring.classList.add('warning');
    text.textContent = timer;
  }

  function resetTimerRing() {
    const ring = document.getElementById('timer-ring-fill');
    const text = document.getElementById('timer-text');
    if (ring) { ring.style.strokeDashoffset = 0; ring.classList.remove('warning','danger'); }
    if (text) text.textContent = '–';
  }

  /* ══════════════════════════════════════════════════════════════════
     CHAT
  ══════════════════════════════════════════════════════════════════ */
  function appendChatMessage(username, message, color, avatarColor) {
    const log = document.getElementById('chat-log');
    if (!log) return;
    const row = document.createElement('div');
    row.className = 'chat-message';

    const avatarEl = document.createElement('div');
    avatarEl.className = 'chat-avatar';
    const c = document.createElement('canvas');
    c.width = 26; c.height = 26;
    avatarEl.appendChild(c);
    const features = getAvatarFeatures(username, avatarColor);
    renderSkribblAvatar(c, features);

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    const senderEl = document.createElement('div');
    senderEl.className = 'chat-sender';
    senderEl.style.color = BODY_COLORS[features.bodyIndex % BODY_COLORS.length];
    senderEl.textContent = username;

    const textEl = document.createElement('div');
    textEl.className = 'chat-text';
    textEl.style.color = color || '#1a1a2e';
    textEl.textContent = message;

    bubble.appendChild(senderEl);
    bubble.appendChild(textEl);
    row.appendChild(avatarEl);
    row.appendChild(bubble);
    log.appendChild(row);
    _scrollChat(log);
  }

  function appendSystemMessage(message, color) {
    const log = document.getElementById('chat-log');
    if (!log) return;
    const row = document.createElement('div');
    row.className = 'chat-message system-msg';
    row.style.color = color || '#555';
    row.textContent = message;
    log.appendChild(row);
    _scrollChat(log);
  }

  function appendPrivateHint(message) {
    const log = document.getElementById('chat-log');
    if (!log) return;
    const row = document.createElement('div');
    row.className = 'chat-message system-msg';
    row.style.color = '#e67e22';
    row.textContent = '💡 ' + message;
    log.appendChild(row);
    _scrollChat(log);
  }

  function _scrollChat(log) {
    requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
  }

  /* ══════════════════════════════════════════════════════════════════
     TURN/ROUND SCORES
  ══════════════════════════════════════════════════════════════════ */
  function renderTurnScores(scores, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (!scores || scores.length === 0) {
      const empty = document.createElement('p');
      empty.style.cssText = 'color:rgba(255,255,255,0.5);font-size:0.82rem;text-align:center;padding:8px';
      empty.textContent = 'No points earned this turn.';
      container.appendChild(empty);
      return;
    }
    scores.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'score-row';
      const ptsHtml = (entry.pointsEarned !== null && entry.pointsEarned !== undefined)
        ? `<span class="score-row-pts">+${entry.pointsEarned} pts</span>` : '';
      row.innerHTML =
        `<span class="score-row-name">${escHtml(entry.username)}</span>` +
        ptsHtml +
        `<span class="score-row-total">${entry.totalScore} total</span>`;
      container.appendChild(row);
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME OVER PODIUM
  ══════════════════════════════════════════════════════════════════ */
  function renderGameOver(players) {
    const podium      = document.getElementById('podium');
    const finalScores = document.getElementById('final-scores');
    if (!podium || !finalScores) return;
    podium.innerHTML = ''; finalScores.innerHTML = '';

    const podiumOrder = [
      { rank: 2, cls: 'podium-2nd', trophy: '🥈' },
      { rank: 1, cls: 'podium-1st', trophy: '🥇' },
      { rank: 3, cls: 'podium-3rd', trophy: '🥉' },
    ];

    podiumOrder.forEach(({ rank, cls, trophy }) => {
      const player = players.find(p => p.rank === rank);
      const place  = document.createElement('div');
      place.className = 'podium-place ' + cls;
      if (player) {
        const c = document.createElement('canvas');
        c.width = 40; c.height = 40; c.className = 'podium-avatar';
        renderSkribblAvatar(c, getAvatarFeatures(player.id, player.avatarColor, player.avatarData));
        const nameEl  = document.createElement('div'); nameEl.className  = 'podium-name';  nameEl.textContent  = player.username;
        const scoreEl = document.createElement('div'); scoreEl.className = 'podium-score'; scoreEl.textContent = player.score + ' pts';
        const block   = document.createElement('div'); block.className   = 'podium-block'; block.textContent   = trophy;
        place.appendChild(c); place.appendChild(nameEl); place.appendChild(scoreEl); place.appendChild(block);
      } else {
        const block = document.createElement('div'); block.className = 'podium-block'; block.style.opacity = '0.3'; block.textContent = trophy;
        place.appendChild(block);
      }
      podium.appendChild(place);
    });

    players.forEach(p => {
      const row    = document.createElement('div'); row.className = 'final-score-row';
      const medal  = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : '#' + p.rank;
      const c      = document.createElement('canvas'); c.width = 24; c.height = 24;
      renderSkribblAvatar(c, getAvatarFeatures(p.id, p.avatarColor, p.avatarData));
      row.innerHTML = `<span class="final-rank">${medal}</span>`;
      row.appendChild(c);
      const nameEl = document.createElement('span'); nameEl.className = 'final-name'; nameEl.textContent = p.username;
      const ptsEl  = document.createElement('span'); ptsEl.className  = 'final-pts';  ptsEl.textContent  = p.score + ' pts';
      row.appendChild(nameEl); row.appendChild(ptsEl);
      finalScores.appendChild(row);
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     SETTINGS DISPLAY (lobby)
  ══════════════════════════════════════════════════════════════════ */
  function updateSettingsDisplay(settings) {
    const el = document.getElementById('lobby-settings-display');
    if (el) el.textContent = `${settings.maxPlayers} players · ${settings.totalRounds} rounds · ${settings.drawTime}s`;
    _setSelectVal('lset-players',  settings.maxPlayers);
    _setSelectVal('lset-drawtime', settings.drawTime);
    _setSelectVal('lset-rounds',   settings.totalRounds);
  }

  function _setSelectVal(id, val) {
    const el = document.getElementById(id);
    if (!el || val == null) return;
    const opt = el.querySelector(`option[value="${val}"]`);
    if (opt) el.value = val;
  }

  /* ══════════════════════════════════════════════════════════════════
     SETTINGS MODAL
  ══════════════════════════════════════════════════════════════════ */
  function openSettingsModal()  { const m = document.getElementById('modal-settings'); if (m) m.classList.remove('hidden'); }
  function closeSettingsModal() { const m = document.getElementById('modal-settings'); if (m) m.classList.add('hidden'); }
  function resetHotkeys() {
    const defaults = { 'hk-brush':'B','hk-fill':'F','hk-undo':'U','hk-clear':'C','hk-swap':'S' };
    Object.entries(defaults).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val; });
  }

  /* ══════════════════════════════════════════════════════════════════
     PLAYER MODAL
  ══════════════════════════════════════════════════════════════════ */
  let _modalTargetPlayerId = null;

  function openPlayerModal(player) {
    _modalTargetPlayerId = player.id;
    const m      = document.getElementById('modal-player');
    const nameEl = document.getElementById('modal-player-name');
    const c      = document.getElementById('modal-avatar-canvas');
    if (!m) return;
    if (nameEl) nameEl.textContent = player.username;
    if (c) renderSkribblAvatar(c, getAvatarFeatures(player.id, player.avatarColor, player.avatarData));
    m.classList.remove('hidden');
  }

  function closePlayerModal() {
    const m = document.getElementById('modal-player');
    if (m) m.classList.add('hidden');
    _modalTargetPlayerId = null;
  }

  function votekickPlayer() {
    if (_modalTargetPlayerId && typeof socket !== 'undefined') socket.emit('votekick', { targetId: _modalTargetPlayerId });
    closePlayerModal();
  }
  function mutePlayer()   { closePlayerModal(); }
  function reportPlayer() { closePlayerModal(); }

  document.addEventListener('DOMContentLoaded', () => {
    ['modal-settings','modal-player'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', e => {
        if (e.target === el) { el.classList.add('hidden'); _modalTargetPlayerId = null; }
      });
    });
  });

  /* ══════════════════════════════════════════════════════════════════
     INVITE LINK
  ══════════════════════════════════════════════════════════════════ */
  function updateInviteLink(roomCode) {
    const input   = document.getElementById('invite-link-input');
    const section = document.getElementById('invite-link-section');
    if (!input || !roomCode) return;
    input.value = window.location.origin + '/?lobby=' + roomCode;
    if (section) section.style.display = '';
  }

  /* ══════════════════════════════════════════════════════════════════
     HOST BADGE
  ══════════════════════════════════════════════════════════════════ */
  function updateHostBadge(players) {
    const badge = document.getElementById('lobby-host-badge');
    if (!badge) return;
    const host = players.find(p => p.isHost);
    if (host) {
      badge.textContent = host.username + ' is now the room owner!';
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     UTILITY
  ══════════════════════════════════════════════════════════════════ */
  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return {
    showOverlay, hideAllOverlays,
    renderPlayerList, flashPlayerCard,
    setWordDisplay, setMaskDisplay,
    updateTimerRing, resetTimerRing,
    appendChatMessage, appendSystemMessage, appendPrivateHint,
    renderTurnScores,
    renderGameOver,
    updateSettingsDisplay,
    openSettingsModal, closeSettingsModal, resetHotkeys,
    openPlayerModal, closePlayerModal, votekickPlayer, mutePlayer, reportPlayer,
    updateInviteLink,
    updateHostBadge,
    BODY_COLORS,
    renderSkribblAvatar,
  };
})();
