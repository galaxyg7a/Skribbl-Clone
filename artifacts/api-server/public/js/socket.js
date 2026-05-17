/* ═══════════════════════════════════════════════════
   socket.js — Client-side Socket.io pipeline
═══════════════════════════════════════════════════ */

const socket = io({
  reconnectionAttempts: 8,
  reconnectionDelay: 1500,
  reconnectionDelayMax: 5000,
});

let myPlayerId = null;
let myRoomCode = null;
let isDrawer = false;
let _roomExpired = false;
let _disconnectTimer = null;

// ─── Connection Lifecycle ─────────────────────────────────────────────────────
socket.on('connect', () => {
  console.log('[socket] connected:', socket.id);

  // Clear any pending "Connection lost" message
  if (_disconnectTimer) { clearTimeout(_disconnectTimer); _disconnectTimer = null; }

  if (_roomExpired) return; // room was deleted — don't try to rejoin

  // Read room code from URL params first, then sessionStorage as fallback
  const urlParams  = new URLSearchParams(window.location.search);
  const urlRoom    = (urlParams.get('room') || '').toUpperCase().trim();
  const savedRoom  = urlRoom || (sessionStorage.getItem('skribbl_room') || '');

  if (savedRoom) {
    myRoomCode = savedRoom;
    let identity = {};
    try {
      const raw = sessionStorage.getItem('skribbl_identity');
      if (raw) identity = JSON.parse(raw);
    } catch (_) {}
    if (identity.username) {
      socket.emit('join_room', {
        roomCode: savedRoom,
        username: identity.username,
        avatarColor: identity.avatarColor || '#4CAF50',
        avatarData: identity.avatarData || undefined,
      });
    }
  }
});

socket.on('disconnect', () => {
  console.log('[socket] disconnected');
  if (_roomExpired) return;
  // Debounce: only show message if still disconnected after 2 s
  _disconnectTimer = setTimeout(() => {
    UI.appendSystemMessage('Connection lost. Reconnecting...', '#fc8181');
  }, 2000);
});

socket.on('connect_error', () => {
  if (!_roomExpired) UI.appendSystemMessage('Could not reach server.', '#fc8181');
});

socket.on('reconnect_failed', () => {
  sessionStorage.removeItem('skribbl_room');
  UI.appendSystemMessage('Could not reconnect. Returning to home...', '#fc8181');
  setTimeout(() => { window.location.href = '/'; }, 2500);
});

// ─── Room Bootstrap ───────────────────────────────────────────────────────────
socket.on('joined_room', (data) => {
  myPlayerId = data.playerId;
  myRoomCode = data.roomCode;
  sessionStorage.setItem('skribbl_room', data.roomCode);

  document.getElementById('room-code-badge').textContent = 'ROOM: ' + data.roomCode;
  document.getElementById('round-total').textContent = data.settings.totalRounds;
  document.getElementById('lobby-room-code').textContent = data.roomCode;
  document.getElementById('lobby-title').textContent = 'Waiting for players...';
  document.getElementById('lobby-subtitle').textContent = 'Share the room code with friends!';

  UI.updateSettingsDisplay(data.settings);
  UI.renderPlayerList(data.players);
  UI.updateHostBadge(data.players);
  UI.showOverlay('lobby');
  UI.updateInviteLink(data.roomCode);
});

socket.on('player_list_update', (players) => {
  UI.renderPlayerList(players);
  UI.updateHostBadge(players);
  const me = players.find(p => p.id === myPlayerId);
  if (me?.isHost) {
    document.getElementById('start-btn').classList.remove('hidden');
  } else {
    document.getElementById('start-btn').classList.add('hidden');
  }
  const count = players.length;
  document.getElementById('lobby-player-count').textContent = count + ' player' + (count !== 1 ? 's' : '') + ' in room';
});

socket.on('settings_update', (settings) => {
  document.getElementById('round-total').textContent = settings.totalRounds;
  UI.updateSettingsDisplay(settings);
});

socket.on('became_host', () => {
  document.getElementById('start-btn').classList.remove('hidden');
  UI.appendSystemMessage('You are now the host!', '#f6e05e');
});

socket.on('kicked', ({ message }) => {
  sessionStorage.removeItem('skribbl_room');
  alert(message);
  window.location.href = '/';
});

socket.on('error', ({ message }) => {
  UI.appendSystemMessage('Error: ' + message, '#fc8181');
  // Room not found on reconnect → stop looping, go home
  if (message && /room not found/i.test(message)) {
    _roomExpired = true;
    socket.disconnect();
    sessionStorage.removeItem('skribbl_room');
    UI.appendSystemMessage('Room has expired. Returning to home...', '#fc8181');
    setTimeout(() => { window.location.href = '/'; }, 2500);
  }
});

// ─── Game State Changes ───────────────────────────────────────────────────────
socket.on('game_state_change', (data) => {
  const state = data.gameState;

  if (state === 'WORD_SELECTION') {
    isDrawer = data.drawerId === myPlayerId;
    Canvas.clearCanvas();
    UI.showOverlay('word-selection');

    if (isDrawer) {
      document.getElementById('word-choice-panel').classList.remove('hidden');
      document.getElementById('word-waiting-panel').classList.add('hidden');
    } else {
      document.getElementById('word-choice-panel').classList.add('hidden');
      document.getElementById('word-waiting-panel').classList.remove('hidden');
      document.getElementById('drawer-name-choosing').textContent = data.drawerName;
    }

    Canvas.setDrawerMode(false);
    document.getElementById('tool-belt').classList.add('hidden');
    document.getElementById('chat-input').disabled = false;
    document.getElementById('chat-input').placeholder = 'Type your guess here...';

  } else if (state === 'DRAWING') {
    UI.hideAllOverlays();
    document.getElementById('round-display').textContent = data.currentRound || document.getElementById('round-display').textContent;
    Sound.roundStart();

    if (isDrawer) {
      Canvas.setDrawerMode(true);
      document.getElementById('tool-belt').classList.remove('hidden');
      document.getElementById('chat-input').disabled = true;
      document.getElementById('chat-input').placeholder = 'Shh! You are drawing right now!';
      UI.setWordDisplay(data.word || '');
    } else {
      Canvas.setDrawerMode(false);
      document.getElementById('tool-belt').classList.add('hidden');
      document.getElementById('chat-input').disabled = false;
      document.getElementById('chat-input').placeholder = 'Type your guess here...';
      if (data.mask) UI.setMaskDisplay(data.mask);
    }

  } else if (state === 'TURN_OVER') {
    UI.showOverlay('turn-over');
    document.getElementById('tool-belt').classList.add('hidden');
    Canvas.setDrawerMode(false);
    Sound.turnOver();

  } else if (state === 'ROUND_OVER') {
    UI.showOverlay('round-over');

  } else if (state === 'GAME_OVER') {
    UI.showOverlay('game-over');
    document.getElementById('tool-belt').classList.add('hidden');

  } else if (state === 'LOBBY') {
    isDrawer = false;
    Canvas.clearCanvas();
    Canvas.setDrawerMode(false);
    document.getElementById('tool-belt').classList.add('hidden');
    document.getElementById('chat-input').disabled = false;
    document.getElementById('word-display').textContent = 'Waiting...';
    document.getElementById('round-display').textContent = '–';
    document.getElementById('timer-text').textContent = '–';
    UI.resetTimerRing();
    UI.showOverlay('lobby');
  }
});

// ─── Word Events ──────────────────────────────────────────────────────────────
socket.on('word_options', ({ words }) => {
  const container = document.getElementById('word-choices');
  container.innerHTML = '';
  words.forEach(word => {
    const btn = document.createElement('button');
    btn.className = 'word-choice-btn';
    btn.textContent = word;
    btn.onclick = () => {
      socket.emit('select_word', { word });
    };
    container.appendChild(btn);
  });
});

socket.on('word_choosing', ({ drawerName }) => {
  document.getElementById('drawer-name-choosing').textContent = drawerName;
});

socket.on('drawer_info', ({ word }) => {
  UI.setWordDisplay(word);
});

socket.on('hint_reveal', ({ mask, maskDisplay }) => {
  UI.setMaskDisplay(mask);
});

// ─── Timer ────────────────────────────────────────────────────────────────────
socket.on('timer_tick', ({ timer, total }) => {
  document.getElementById('timer-text').textContent = timer;
  UI.updateTimerRing(timer, total);
  if (timer <= 10 && timer > 0) Sound.timerTick();
});

// ─── Drawing Events ───────────────────────────────────────────────────────────
socket.on('draw_data', (packet) => {
  if (!isDrawer) Canvas.renderDrawPacket(packet);
});

socket.on('fill_data', ({ x, y, color }) => {
  if (!isDrawer) Canvas.floodFill(x, y, color);
});

socket.on('canvas_clear', () => {
  Canvas.clearCanvas();
});

socket.on('canvas_undo', ({ snapshot }) => {
  if (!isDrawer) Canvas.loadSnapshot(snapshot);
});

// ─── Chat Events ──────────────────────────────────────────────────────────────
socket.on('chat_message', ({ username, message, color, avatarColor, guessersOnly }) => {
  UI.appendChatMessage(username, message, color, avatarColor, guessersOnly);
});

socket.on('system_message', ({ message, color }) => {
  UI.appendSystemMessage(message, color);
});

socket.on('guess_close', ({ message }) => {
  UI.appendPrivateHint(message);
});

socket.on('guess_correct', ({ username, points }) => {
  UI.flashPlayerCard(username);
  UI.appendSystemMessage(`✓ ${username} guessed it! +${points} pts`, '#48bb78');
  Sound.correctGuess();
});

// ─── Turn/Round Events ────────────────────────────────────────────────────────
socket.on('turn_over', ({ word, scores, players }) => {
  document.getElementById('revealed-word').textContent = word;
  UI.renderTurnScores(scores, 'turn-scores-list');
  UI.renderPlayerList(players);
});

socket.on('round_over', ({ round, players }) => {
  document.getElementById('round-over-num').textContent = round;
  UI.renderPlayerList(players);
  const sorted = [...players].sort((a, b) => b.score - a.score);
  UI.renderTurnScores(sorted.map(p => ({
    username: p.username,
    pointsEarned: null,
    totalScore: p.score,
  })), 'round-scores-list');
});

socket.on('game_over', ({ players }) => {
  UI.renderGameOver(players);
});

// ─── Public Emitters ─────────────────────────────────────────────────────────
function startGame() {
  socket.emit('start_game');
}

function sendChat() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;
  socket.emit('chat_message', { message: msg });
  input.value = '';
}

function leaveGame() {
  sessionStorage.removeItem('skribbl_room');
  window.location.href = '/';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendChat();
  });
});
