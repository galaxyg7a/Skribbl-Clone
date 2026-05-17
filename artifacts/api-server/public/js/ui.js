/* ═══════════════════════════════════════════════════════════════════
   ui.js — DOM manipulation engine (Skribbl-style redesign)
═══════════════════════════════════════════════════════════════════ */

const UI = (() => {
  const CIRCUMFERENCE = 2 * Math.PI * 23;

  /* ── Avatar drawing ────────────────────────────────────────────── */
  const BODY_SCHEMES = [
    { face: '#F4A261', body: '#E76F51' },
    { face: '#FFDDB3', body: '#d4a574' },
    { face: '#8D5524', body: '#6B3A1A' },
    { face: '#3498DB', body: '#2060a0' },
    { face: '#9B59B6', body: '#7D3C98' },
    { face: '#2ECC71', body: '#1a9950' },
    { face: '#E74C3C', body: '#c0392b' },
    { face: '#F39C12', body: '#d48010' },
    { face: '#1ABC9C', body: '#16a085' },
  ];

  function colorToSchemeIndex(color) {
    const normalized = (color || '').toLowerCase();
    const idx = BODY_SCHEMES.findIndex(s =>
      s.face.toLowerCase() === normalized || s.body.toLowerCase() === normalized
    );
    return idx >= 0 ? idx : Math.abs(
      (color || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    ) % BODY_SCHEMES.length;
  }

  function drawMiniAvatar(canvas, color) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const si = colorToSchemeIndex(color);
    const s = BODY_SCHEMES[si];

    // Body
    ctx.fillStyle = s.body;
    ctx.fillRect(0, H * 0.6, W, H * 0.4);

    // Face (pixel square)
    ctx.fillStyle = s.face;
    const fx = Math.floor(W * 0.12), fy = Math.floor(H * 0.06);
    const fw = Math.floor(W * 0.76), fh = Math.floor(H * 0.58);
    ctx.fillRect(fx, fy, fw, fh);

    // Eyes
    ctx.fillStyle = 'white';
    ctx.fillRect(Math.floor(W*0.22), Math.floor(H*0.28), Math.floor(W*0.22), Math.floor(H*0.18));
    ctx.fillRect(Math.floor(W*0.56), Math.floor(H*0.28), Math.floor(W*0.22), Math.floor(H*0.18));
    ctx.fillStyle = '#111';
    ctx.fillRect(Math.floor(W*0.27), Math.floor(H*0.31), Math.floor(W*0.12), Math.floor(H*0.12));
    ctx.fillRect(Math.floor(W*0.61), Math.floor(H*0.31), Math.floor(W*0.12), Math.floor(H*0.12));

    // Smile
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(Math.floor(W*0.24), Math.floor(H*0.54), Math.floor(W*0.52), Math.floor(H*0.12));
    ctx.fillStyle = 'white';
    ctx.fillRect(Math.floor(W*0.28), Math.floor(H*0.55), Math.floor(W*0.44), Math.floor(H*0.06));
  }

  /* ── Overlay Manager ───────────────────────────────────────────── */
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
      if (key === name) {
        el.classList.remove('hidden');
        el.classList.add('active');
      } else {
        el.classList.add('hidden');
        el.classList.remove('active');
      }
    });
    const status = document.getElementById('header-status');
    if (status) {
      const labels = {
        'lobby':          'WAITING',
        'word-selection': 'CHOOSING',
        'turn-over':      'TURN OVER',
        'round-over':     'ROUND OVER',
        'game-over':      'GAME OVER',
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

  /* ── Player List ───────────────────────────────────────────────── */
  let _selectedPlayerId = null;

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
      card.id = 'player-card-' + p.id;
      card.title = p.username;

      // Click to open player modal (don't open for self)
      card.addEventListener('click', () => {
        openPlayerModal(p);
      });

      // Rank
      const rankEl = document.createElement('span');
      rankEl.className = 'player-rank';
      rankEl.textContent = '#' + rank;

      // Crown / host icon
      const crownEl = document.createElement('span');
      crownEl.className = 'player-crown';
      crownEl.textContent = p.isHost ? '👑' : '';

      // Info block
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

      // Mini avatar canvas
      const avatarWrap = document.createElement('div');
      avatarWrap.className = 'player-card-avatar';
      const c = document.createElement('canvas');
      c.width = 36; c.height = 36;
      avatarWrap.appendChild(c);
      drawMiniAvatar(c, p.avatarColor || '#F4A261');

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

  /* ── Word Display ──────────────────────────────────────────────── */
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

  /* ── Timer Ring ────────────────────────────────────────────────── */
  function updateTimerRing(timer, total) {
    const ring = document.getElementById('timer-ring-fill');
    const text = document.getElementById('timer-text');
    if (!ring || !text) return;
    const pct = Math.max(0, timer / total);
    ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct);
    ring.classList.remove('warning', 'danger');
    if (pct <= 0.25) ring.classList.add('danger');
    else if (pct <= 0.5) ring.classList.add('warning');
    text.textContent = timer;
  }

  function resetTimerRing() {
    const ring = document.getElementById('timer-ring-fill');
    const text = document.getElementById('timer-text');
    if (ring) { ring.style.strokeDashoffset = 0; ring.classList.remove('warning','danger'); }
    if (text) text.textContent = '–';
  }

  /* ── Chat ──────────────────────────────────────────────────────── */
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
    drawMiniAvatar(c, avatarColor || '#F4A261');

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    const senderEl = document.createElement('div');
    senderEl.className = 'chat-sender';
    senderEl.style.color = avatarColor || '#3498DB';
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

  /* ── Turn/Round Scores ─────────────────────────────────────────── */
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

  /* ── Game Over Podium ──────────────────────────────────────────── */
  function renderGameOver(players) {
    const podium = document.getElementById('podium');
    const finalScores = document.getElementById('final-scores');
    if (!podium || !finalScores) return;

    podium.innerHTML = '';
    finalScores.innerHTML = '';

    const podiumOrder = [
      { rank: 2, cls: 'podium-2nd', trophy: '🥈' },
      { rank: 1, cls: 'podium-1st', trophy: '🥇' },
      { rank: 3, cls: 'podium-3rd', trophy: '🥉' },
    ];

    podiumOrder.forEach(({ rank, cls, trophy }) => {
      const player = players.find(p => p.rank === rank);
      const place = document.createElement('div');
      place.className = 'podium-place ' + cls;
      if (player) {
        const c = document.createElement('canvas');
        c.width = 40; c.height = 40;
        c.className = 'podium-avatar';
        drawMiniAvatar(c, player.avatarColor || '#F4A261');
        place.appendChild(c);
        const nameEl = document.createElement('div');
        nameEl.className = 'podium-name';
        nameEl.textContent = player.username;
        const scoreEl = document.createElement('div');
        scoreEl.className = 'podium-score';
        scoreEl.textContent = player.score + ' pts';
        const block = document.createElement('div');
        block.className = 'podium-block';
        block.textContent = trophy;
        place.appendChild(nameEl);
        place.appendChild(scoreEl);
        place.appendChild(block);
      } else {
        const block = document.createElement('div');
        block.className = 'podium-block';
        block.style.opacity = '0.3';
        block.textContent = trophy;
        place.appendChild(block);
      }
      podium.appendChild(place);
    });

    players.forEach(p => {
      const row = document.createElement('div');
      row.className = 'final-score-row';
      const medal = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : '#' + p.rank;
      const c = document.createElement('canvas');
      c.width = 24; c.height = 24;
      drawMiniAvatar(c, p.avatarColor || '#F4A261');
      row.innerHTML = `<span class="final-rank">${medal}</span>`;
      row.appendChild(c);
      const nameEl = document.createElement('span');
      nameEl.className = 'final-name';
      nameEl.textContent = p.username;
      const ptsEl = document.createElement('span');
      ptsEl.className = 'final-pts';
      ptsEl.textContent = p.score + ' pts';
      row.appendChild(nameEl);
      row.appendChild(ptsEl);
      finalScores.appendChild(row);
    });
  }

  /* ── Settings Display (lobby) ──────────────────────────────────── */
  function updateSettingsDisplay(settings) {
    // Update hidden compat element
    const el = document.getElementById('lobby-settings-display');
    if (el) el.textContent = `${settings.maxPlayers} players · ${settings.totalRounds} rounds · ${settings.drawTime}s`;
    // Sync lobby selects
    _setSelectVal('lset-players',   settings.maxPlayers);
    _setSelectVal('lset-drawtime',  settings.drawTime);
    _setSelectVal('lset-rounds',    settings.totalRounds);
  }

  function _setSelectVal(id, val) {
    const el = document.getElementById(id);
    if (!el || val == null) return;
    const opt = el.querySelector(`option[value="${val}"]`);
    if (opt) el.value = val;
  }

  /* ── Settings Modal ────────────────────────────────────────────── */
  function openSettingsModal() {
    const m = document.getElementById('modal-settings');
    if (m) m.classList.remove('hidden');
  }
  function closeSettingsModal() {
    const m = document.getElementById('modal-settings');
    if (m) m.classList.add('hidden');
  }
  function resetHotkeys() {
    const defaults = { 'hk-brush':'B', 'hk-fill':'F', 'hk-undo':'U', 'hk-clear':'C', 'hk-swap':'S' };
    Object.entries(defaults).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    });
  }

  /* ── Player Modal ──────────────────────────────────────────────── */
  let _modalTargetPlayerId = null;

  function openPlayerModal(player) {
    _modalTargetPlayerId = player.id;
    const m = document.getElementById('modal-player');
    const nameEl = document.getElementById('modal-player-name');
    const c = document.getElementById('modal-avatar-canvas');
    if (!m) return;
    if (nameEl) nameEl.textContent = player.username;
    if (c) drawMiniAvatar(c, player.avatarColor || '#F4A261');
    m.classList.remove('hidden');
  }

  function closePlayerModal() {
    const m = document.getElementById('modal-player');
    if (m) m.classList.add('hidden');
    _modalTargetPlayerId = null;
  }

  function votekickPlayer() {
    if (_modalTargetPlayerId && typeof socket !== 'undefined') {
      socket.emit('votekick', { targetId: _modalTargetPlayerId });
    }
    closePlayerModal();
  }

  function mutePlayer() {
    closePlayerModal();
  }

  function reportPlayer() {
    closePlayerModal();
  }

  /* ── Modal: close on backdrop click ───────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    ['modal-settings','modal-player'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', e => {
          if (e.target === el) {
            el.classList.add('hidden');
            _modalTargetPlayerId = null;
          }
        });
      }
    });
  });

  /* ── Utility ───────────────────────────────────────────────────── */
  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Invite Link ────────────────────────────────────────────────── */
  function updateInviteLink(roomCode) {
    const input   = document.getElementById('invite-link-input');
    const section = document.getElementById('invite-link-section');
    if (!input || !roomCode) return;
    const link = window.location.origin + '/?lobby=' + roomCode;
    input.value = link;
    if (section) section.style.display = '';
  }

  return {
    showOverlay,
    hideAllOverlays,
    renderPlayerList,
    flashPlayerCard,
    setWordDisplay,
    setMaskDisplay,
    updateTimerRing,
    resetTimerRing,
    appendChatMessage,
    appendSystemMessage,
    appendPrivateHint,
    renderTurnScores,
    renderGameOver,
    updateSettingsDisplay,
    openSettingsModal,
    closeSettingsModal,
    resetHotkeys,
    openPlayerModal,
    closePlayerModal,
    votekickPlayer,
    mutePlayer,
    reportPlayer,
    updateInviteLink,
  };
})();
