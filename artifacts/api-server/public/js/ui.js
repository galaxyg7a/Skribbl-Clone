/* ═══════════════════════════════════════════════════
   ui.js — DOM manipulation engine
═══════════════════════════════════════════════════ */

const UI = (() => {
  const CIRCUMFERENCE = 2 * Math.PI * 23;

  // ─── Overlay Manager ───────────────────────────────────────────────────────
  const OVERLAY_IDS = {
    'lobby': 'overlay-lobby',
    'word-selection': 'overlay-word-selection',
    'turn-over': 'overlay-turn-over',
    'round-over': 'overlay-round-over',
    'game-over': 'overlay-game-over',
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
  }

  function hideAllOverlays() {
    Object.values(OVERLAY_IDS).forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.classList.add('hidden'); el.classList.remove('active'); }
    });
  }

  // ─── Player List ───────────────────────────────────────────────────────────
  function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    if (!list) return;
    list.innerHTML = '';
    const sorted = [...players].sort((a, b) => b.score - a.score);
    sorted.forEach(p => {
      const card = document.createElement('div');
      card.className = 'player-card' +
        (p.isDrawing ? ' is-drawing' : '') +
        (p.hasGuessed ? ' has-guessed' : '');
      card.id = 'player-card-' + p.id;

      const avatarInitial = (p.username || '?')[0].toUpperCase();
      const badges = [];
      if (p.isHost) badges.push('<span class="badge badge-host">HOST</span>');
      if (p.isDrawing) badges.push('<span class="badge badge-drawing">✏ Drawing</span>');
      if (p.hasGuessed) badges.push('<span class="badge badge-guessed">✓ Guessed</span>');

      card.innerHTML = `
        <div class="player-avatar" style="background:${p.avatarColor}">${escHtml(avatarInitial)}</div>
        <div class="player-info">
          <div class="player-name">${escHtml(p.username)}</div>
          <div class="player-score">${p.score} pts</div>
          ${badges.length ? '<div class="player-badges">' + badges.join('') + '</div>' : ''}
        </div>`;
      list.appendChild(card);
    });
  }

  function flashPlayerCard(username) {
    const cards = document.querySelectorAll('.player-card');
    cards.forEach(card => {
      const nameEl = card.querySelector('.player-name');
      if (nameEl && nameEl.textContent === username) {
        card.classList.add('flash-green');
        setTimeout(() => card.classList.remove('flash-green'), 700);
      }
    });
  }

  // ─── Word Display ──────────────────────────────────────────────────────────
  function setWordDisplay(word) {
    const el = document.getElementById('word-display');
    if (el) el.textContent = word;
  }

  function setMaskDisplay(mask) {
    const el = document.getElementById('word-display');
    if (!el) return;
    el.textContent = mask.join(' ');
  }

  // ─── Timer Ring ────────────────────────────────────────────────────────────
  function updateTimerRing(timer, total) {
    const ring = document.getElementById('timer-ring-fill');
    const text = document.getElementById('timer-text');
    if (!ring || !text) return;

    const pct = Math.max(0, timer / total);
    const offset = CIRCUMFERENCE * (1 - pct);
    ring.style.strokeDashoffset = offset;

    ring.classList.remove('warning', 'danger');
    if (pct <= 0.25) ring.classList.add('danger');
    else if (pct <= 0.5) ring.classList.add('warning');

    text.textContent = timer;
  }

  function resetTimerRing() {
    const ring = document.getElementById('timer-ring-fill');
    const text = document.getElementById('timer-text');
    if (ring) {
      ring.style.strokeDashoffset = 0;
      ring.classList.remove('warning', 'danger');
    }
    if (text) text.textContent = '–';
  }

  // ─── Chat ──────────────────────────────────────────────────────────────────
  function appendChatMessage(username, message, color, avatarColor) {
    const log = document.getElementById('chat-log');
    if (!log) return;

    const row = document.createElement('div');
    row.className = 'chat-message';

    const initial = (username || '?')[0].toUpperCase();
    const bg = avatarColor || '#7c6af7';
    const msgColor = color || 'inherit';

    row.innerHTML = `
      <div class="chat-avatar" style="background:${bg}">${escHtml(initial)}</div>
      <div class="chat-bubble">
        <div class="chat-sender" style="color:${bg}">${escHtml(username)}</div>
        <div class="chat-text" style="color:${msgColor}">${escHtml(message)}</div>
      </div>`;

    log.appendChild(row);
    scrollChatToBottom(log);
  }

  function appendSystemMessage(message, color) {
    const log = document.getElementById('chat-log');
    if (!log) return;

    const row = document.createElement('div');
    row.className = 'chat-message system-msg';
    row.style.color = color || '#a0aec0';
    row.textContent = message;

    log.appendChild(row);
    scrollChatToBottom(log);
  }

  function appendPrivateHint(message) {
    const log = document.getElementById('chat-log');
    if (!log) return;

    const row = document.createElement('div');
    row.className = 'chat-message system-msg';
    row.style.color = '#f6e05e';
    row.textContent = '💡 ' + message;

    log.appendChild(row);
    scrollChatToBottom(log);
  }

  function scrollChatToBottom(log) {
    requestAnimationFrame(() => {
      log.scrollTop = log.scrollHeight;
    });
  }

  // ─── Turn/Round Scores ─────────────────────────────────────────────────────
  function renderTurnScores(scores, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!scores || scores.length === 0) {
      const empty = document.createElement('p');
      empty.style.cssText = 'color:#718096;font-size:0.85rem;text-align:center';
      empty.textContent = 'No points earned this turn.';
      container.appendChild(empty);
      return;
    }

    scores.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'turn-score-row';
      const ptsHtml = (entry.pointsEarned !== null && entry.pointsEarned !== undefined)
        ? `<span class="turn-score-pts">+${entry.pointsEarned} pts</span>`
        : '';
      row.innerHTML = `
        <span class="turn-score-name">${escHtml(entry.username)}</span>
        ${ptsHtml}
        <span class="turn-score-total">${entry.totalScore} total</span>`;
      container.appendChild(row);
    });
  }

  // ─── Game Over Podium ──────────────────────────────────────────────────────
  function renderGameOver(players) {
    const podium = document.getElementById('podium');
    const finalScores = document.getElementById('final-scores');
    if (!podium || !finalScores) return;

    podium.innerHTML = '';
    finalScores.innerHTML = '';

    const podiumOrder = [
      { rank: 2, className: 'podium-2nd', trophy: '🥈' },
      { rank: 1, className: 'podium-1st', trophy: '🥇' },
      { rank: 3, className: 'podium-3rd', trophy: '🥉' },
    ];

    podiumOrder.forEach(({ rank, className, trophy }) => {
      const player = players.find(p => p.rank === rank);
      const place = document.createElement('div');
      place.className = 'podium-place ' + className;

      if (player) {
        const initial = (player.username || '?')[0].toUpperCase();
        place.innerHTML = `
          <div class="podium-avatar" style="background:${player.avatarColor}">${escHtml(initial)}</div>
          <div class="podium-name">${escHtml(player.username)}</div>
          <div class="podium-score">${player.score} pts</div>
          <div class="podium-block">${trophy}</div>`;
      } else {
        place.innerHTML = `<div class="podium-block" style="opacity:0.3">${trophy}</div>`;
      }

      podium.appendChild(place);
    });

    players.forEach(p => {
      const row = document.createElement('div');
      row.className = 'final-score-row';
      const initial = (p.username || '?')[0].toUpperCase();
      const medal = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : '#' + p.rank;
      row.innerHTML = `
        <span class="final-rank">${medal}</span>
        <div class="chat-avatar" style="background:${p.avatarColor};width:26px;height:26px;font-size:0.7rem">${escHtml(initial)}</div>
        <span class="final-name">${escHtml(p.username)}</span>
        <span class="final-pts">${p.score} pts</span>`;
      finalScores.appendChild(row);
    });
  }

  // ─── Settings Display ──────────────────────────────────────────────────────
  function updateSettingsDisplay(settings) {
    const el = document.getElementById('lobby-settings-display');
    if (el) {
      el.textContent = `${settings.maxPlayers} players · ${settings.totalRounds} rounds · ${settings.drawTime}s draw time`;
    }
  }

  // ─── Utility ───────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
  };
})();
