import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { getRandomWords, generateRoomCode } from './words';
import { logger } from '../lib/logger';

// ─── Protocol event IDs (match real skribbl.io wire protocol) ─────────────────
const EV = {
  PLAYER_JOIN:  1,
  PLAYER_LEAVE: 2,
  VOTEKICK:     5,
  RATE:         8,
  AVATAR:       9,
  LOGIN:        10,
  GAME_STATE:   11,
  SETTINGS:     12,
  HINT:         13,
  TIMER:        14,
  GUESSED:      15,
  CLOSE_GUESS:  16,
  OWNER:        17,
  WORD_SELECT:  18,
  DRAW_BATCH:   19,
  DRAW_CLEAR:   20,
  DRAW_UNDO:    21,
  CHAT:         30,
  WARNING:      31,
  SPAM:         32,
  NAME_CHANGE:  90,
};

// Game states (G=0,K=1,F=2,V=3,j=4,Z=5,X=6,J=7 in minified game.js)
const ST = {
  WAITING:     0,
  STARTING:    1,
  ROUND_START: 2,
  WORD_SELECT: 3,
  DRAWING:     4,
  TURN_OVER:   5,
  ROUND_OVER:  6,
  LOBBY:       7,
};

// Turn-over reasons (B=0,U=1,H=2,_=5)
const REASON = { ALL_GUESSED: 0, TIME_UP: 1, DRAWER_LEFT: 2, SKIPPED: 5 };

// Settings slot indices
const SETI = { LANG: 0, SLOTS: 1, DRAWTIME: 2, ROUNDS: 3, WORDCOUNT: 4, HINTCOUNT: 5, WORDMODE: 6, CUSTOMONLY: 7 };

// Word modes
const WORDMODE = { NORMAL: 0, HIDDEN: 1, COMBINATION: 2 };

const FLAG_OWNER = 4;
const MAX_DRAW_CMDS = 8000;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Player {
  id: string;
  name: string;
  avatar: number[];
  score: number;
  guessed: boolean;
  isOwner: boolean;
  flags: number;
  muted: boolean;
  mutedBy: Set<string>;
  votekickVotes: Set<string>;
  spamCount: number;
  spamTimer: ReturnType<typeof setTimeout> | null;
  earnedThisTurn: number;
  reported: boolean;
}

interface Room {
  id: string;
  isPublic: boolean;
  settings: number[];
  customWords: string[];
  players: Player[];
  ownerId: string;
  state: number;
  currentRound: number;
  turnIndex: number;
  drawerId: string | null;
  currentWord: string;
  wordOptions: string[];
  timeLeft: number;
  hintReveals: Array<[number, string]>;
  nextHintTimes: number[];
  guessedCount: number;
  firstGuesser: boolean;
  turnReason: number;
  drawCmds: unknown[];
  usedWords: Set<string>;
  timerId: ReturnType<typeof setInterval> | null;
  wordSelTimer: ReturnType<typeof setTimeout> | null;
  transTimer: ReturnType<typeof setTimeout> | null;
  deleteTimer: ReturnType<typeof setTimeout> | null;
}

const rooms = new Map<string, Room>();
const socketRoom = new Map<string, string>();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function send(io: SocketServer, roomId: string, evId: number, data?: unknown) {
  io.to(roomId).emit('data', { id: evId, data });
}
function sendTo(socket: Socket, evId: number, data?: unknown) {
  socket.emit('data', { id: evId, data });
}
function playerObj(p: Player) {
  return {
    id: p.id,
    flags: p.flags,
    name: p.name,
    avatar: p.avatar,
    score: p.score,
    guessed: p.guessed,
    muted: p.muted,
    reported: p.reported,
  };
}
function defaultSettings(): number[] {
  // [lang, slots, drawtime, rounds, wordcount, hintcount, wordmode, customonly]
  return [0, 8, 80, 3, 3, 2, 0, 0];
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_: unknown, i: number) =>
    Array.from({ length: n + 1 }, (_2: unknown, j: number) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function newRoom(code: string, isPublic: boolean): Room {
  return {
    id: code, isPublic, settings: defaultSettings(), customWords: [],
    players: [], ownerId: '', state: ST.LOBBY, currentRound: 0,
    turnIndex: 0, drawerId: null, currentWord: '', wordOptions: [],
    timeLeft: 0, hintReveals: [], nextHintTimes: [], guessedCount: 0,
    firstGuesser: true, turnReason: REASON.TIME_UP, drawCmds: [],
    usedWords: new Set(),
    timerId: null, wordSelTimer: null, transTimer: null, deleteTimer: null,
  };
}

function clearTimers(room: Room) {
  if (room.timerId)     { clearInterval(room.timerId);  room.timerId = null; }
  if (room.wordSelTimer){ clearTimeout(room.wordSelTimer); room.wordSelTimer = null; }
  if (room.transTimer)  { clearTimeout(room.transTimer);  room.transTimer = null; }
}

function deleteRoom(code: string) {
  const room = rooms.get(code);
  if (!room) return;
  clearTimers(room);
  if (room.deleteTimer) clearTimeout(room.deleteTimer);
  rooms.delete(code);
}

function scheduleDelete(code: string) {
  const room = rooms.get(code);
  if (!room) return;
  if (room.deleteTimer) clearTimeout(room.deleteTimer);
  room.deleteTimer = setTimeout(() => {
    const r = rooms.get(code);
    if (r && r.players.length === 0) deleteRoom(code);
  }, 10_000);
}

// ─── State building ───────────────────────────────────────────────────────────
function wordLengths(word: string): number[] {
  return word.split(' ').map(w => w.length);
}

/** For HIDDEN word mode: return blank lengths (guessers see only dash count) */
function wordDisplay(room: Room, forPlayer: string): number[] | null {
  const mode = room.settings[SETI.WORDMODE] ?? WORDMODE.NORMAL;
  if (mode === WORDMODE.HIDDEN) return null;
  return wordLengths(room.currentWord);
}

function buildScoresFlat(room: Room): unknown[] {
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const flat: unknown[] = [];
  sorted.forEach((p, rank) => flat.push(p.id, p.earnedThisTurn, rank));
  return flat;
}

function buildRanksArray(room: Room): unknown[] {
  return [...room.players]
    .sort((a, b) => b.score - a.score)
    .map((p, rank) => [p.id, rank, 0]);
}

function buildState(room: Room, forPlayer?: string): unknown {
  const base = { id: room.state, time: room.timeLeft };
  switch (room.state) {
    case ST.LOBBY:       return { ...base, data: { id: room.ownerId } };
    case ST.WAITING:
    case ST.STARTING:    return { ...base, data: 0 };
    case ST.ROUND_START: return { ...base, data: room.currentRound };
    case ST.WORD_SELECT:
      if (forPlayer === room.drawerId)
        return { ...base, data: { id: room.drawerId, words: room.wordOptions } };
      return { ...base, data: { id: room.drawerId } };
    case ST.DRAWING: {
      const isDrawer = forPlayer === room.drawerId;
      return {
        ...base, data: {
          id: room.drawerId,
          word: isDrawer ? room.currentWord : wordDisplay(room, forPlayer ?? ''),
          hints: room.hintReveals,
          drawCommands: room.drawCmds,
        },
      };
    }
    case ST.TURN_OVER:
      return { ...base, data: { word: room.currentWord, reason: room.turnReason, scores: buildScoresFlat(room) } };
    case ST.ROUND_OVER:
      return { ...base, data: buildRanksArray(room) };
    default:
      return { ...base, data: 0 };
  }
}

function broadcastState(io: SocketServer, room: Room) {
  room.players.forEach(p =>
    io.to(p.id).emit('data', { id: EV.GAME_STATE, data: buildState(room, p.id) })
  );
}

function broadcastTimer(io: SocketServer, room: Room) {
  send(io, room.id, EV.TIMER, room.timeLeft);
}

// ─── Word pool ────────────────────────────────────────────────────────────────
function buildWordPool(room: Room, needed: number): string[] {
  const mode = room.settings[SETI.WORDMODE] ?? WORDMODE.NORMAL;
  const useCustomOnly = !!room.settings[SETI.CUSTOMONLY] && room.customWords.length >= needed;
  const hasCustom = room.customWords.length > 0;

  let pool: string[];

  if (useCustomOnly) {
    pool = [...room.customWords];
  } else if (mode === WORDMODE.COMBINATION && hasCustom) {
    // Mix: half custom, half default
    const customShuffled = [...room.customWords].sort(() => Math.random() - 0.5);
    const defaultWords = getRandomWords(needed * 4);
    pool = [...customShuffled, ...defaultWords];
  } else {
    pool = [...room.customWords, ...getRandomWords(needed * 4)];
  }

  // Prefer words not already used this game
  const unused = pool.filter(w => !room.usedWords.has(w));
  const finalPool = unused.length >= needed ? unused : pool;
  return finalPool.sort(() => Math.random() - 0.5);
}

// ─── Game flow ────────────────────────────────────────────────────────────────
function startGame(io: SocketServer, room: Room) {
  clearTimers(room);
  room.players.forEach(p => { p.score = 0; p.guessed = false; p.earnedThisTurn = 0; });
  room.currentRound = 0;
  room.turnIndex = 0;
  room.usedWords.clear();
  room.state = ST.STARTING;
  room.timeLeft = 3;
  broadcastState(io, room);
  room.transTimer = setTimeout(() => startRound(io, room), 3000);
}

function startRound(io: SocketServer, room: Room) {
  room.currentRound++;
  room.state = ST.ROUND_START;
  room.timeLeft = 3;
  broadcastState(io, room);
  room.transTimer = setTimeout(() => nextTurn(io, room), 3000);
}

function nextTurn(io: SocketServer, room: Room) {
  clearTimers(room);
  if (room.players.length === 0) return;

  if (room.turnIndex >= room.players.length) {
    const totalRounds = room.settings[SETI.ROUNDS] || 3;
    if (room.currentRound >= totalRounds) endGame(io, room);
    else endRound(io, room);
    return;
  }

  const drawer = room.players[room.turnIndex];
  room.drawerId = drawer.id;
  room.guessedCount = 0;
  room.firstGuesser = true;
  room.hintReveals = [];
  room.nextHintTimes = [];
  room.currentWord = '';
  room.drawCmds = [];
  room.players.forEach(p => { p.guessed = false; p.earnedThisTurn = 0; p.votekickVotes.clear(); });

  const wordCount = Math.max(1, room.settings[SETI.WORDCOUNT] || 3);
  const pool = buildWordPool(room, wordCount);
  room.wordOptions = pool.slice(0, wordCount);

  room.state = ST.WORD_SELECT;
  room.timeLeft = 15;
  broadcastState(io, room);

  let selTime = 14;
  room.timerId = setInterval(() => {
    if (room.state !== ST.WORD_SELECT) { clearInterval(room.timerId!); room.timerId = null; return; }
    room.timeLeft = Math.max(0, selTime--);
    broadcastTimer(io, room);
  }, 1000);

  room.wordSelTimer = setTimeout(() => {
    if (room.state === ST.WORD_SELECT) {
      const auto = room.wordOptions[Math.floor(Math.random() * room.wordOptions.length)];
      startDrawing(io, room, auto);
    }
  }, 15_000);
}

function startDrawing(io: SocketServer, room: Room, word: string) {
  clearTimers(room);
  room.currentWord = word;
  room.usedWords.add(word);
  room.state = ST.DRAWING;
  const drawTime = room.settings[SETI.DRAWTIME] || 80;
  room.timeLeft = drawTime;
  room.drawCmds = [];

  // Schedule progressive hint reveals
  const hintCount = Math.min(room.settings[SETI.HINTCOUNT] ?? 2, 5);
  const letters = [...word].filter(c => /[a-zA-Z]/.test(c));
  const revealable = Math.min(hintCount, Math.max(0, Math.floor(letters.length / 2)));
  room.nextHintTimes = [];
  for (let i = 1; i <= revealable; i++) {
    room.nextHintTimes.push(Math.floor(drawTime * (1 - i / (revealable + 1))));
  }

  broadcastState(io, room);
  room.timerId = setInterval(() => tickDrawing(io, room), 1000);
}

function tickDrawing(io: SocketServer, room: Room) {
  room.timeLeft = Math.max(0, room.timeLeft - 1);
  broadcastTimer(io, room);

  // Trigger any due hints
  while (room.nextHintTimes.length > 0 && room.timeLeft <= room.nextHintTimes[0]) {
    room.nextHintTimes.shift();
    revealHint(io, room);
  }

  const nonDrawers = room.players.filter(p => p.id !== room.drawerId);
  const allGuessed = nonDrawers.length > 0 && room.guessedCount >= nonDrawers.length;

  if (room.timeLeft <= 0 || allGuessed) {
    clearTimers(room);
    // Award drawer points
    if (room.drawerId) {
      const drawer = room.players.find(p => p.id === room.drawerId);
      if (drawer && room.guessedCount > 0) {
        const pts = Math.min(50 * room.guessedCount, 200);
        drawer.score += pts;
        drawer.earnedThisTurn = pts;
      }
    }
    room.turnReason = allGuessed ? REASON.ALL_GUESSED : REASON.TIME_UP;
    endTurn(io, room);
  }
}

function revealHint(io: SocketServer, room: Room) {
  const word = room.currentWord;
  const revealed = new Set(room.hintReveals.map(h => h[0]));
  const candidates: number[] = [];
  for (let i = 0; i < word.length; i++) {
    if (/[a-zA-Z]/.test(word[i]) && !revealed.has(i)) candidates.push(i);
  }
  if (candidates.length === 0) return;

  const idx = candidates[Math.floor(Math.random() * candidates.length)];
  const reveal: [number, string] = [idx, word[idx]];
  room.hintReveals.push(reveal);

  // Only send hint to non-drawers who haven't guessed yet
  room.players.forEach(p => {
    if (p.id !== room.drawerId && !p.guessed)
      io.to(p.id).emit('data', { id: EV.HINT, data: [reveal] });
  });
}

function endTurn(io: SocketServer, room: Room) {
  room.state = ST.TURN_OVER;
  room.timeLeft = 5;
  broadcastState(io, room);
  room.transTimer = setTimeout(() => {
    if (!rooms.has(room.id)) return;
    room.turnIndex++;
    const totalRounds = room.settings[SETI.ROUNDS] || 3;
    if (room.turnIndex >= room.players.length) {
      if (room.currentRound >= totalRounds) endGame(io, room);
      else endRound(io, room);
    } else {
      nextTurn(io, room);
    }
  }, 5000);
}

function endRound(io: SocketServer, room: Room) {
  room.state = ST.ROUND_OVER;
  room.timeLeft = 8;
  broadcastState(io, room);
  room.transTimer = setTimeout(() => {
    if (!rooms.has(room.id)) return;
    room.turnIndex = 0;
    startRound(io, room);
  }, 8000);
}

function endGame(io: SocketServer, room: Room) {
  room.state = ST.ROUND_OVER;
  room.timeLeft = 15;
  broadcastState(io, room);
  room.transTimer = setTimeout(() => {
    if (!rooms.has(room.id)) return;
    clearTimers(room);
    room.state = ST.LOBBY;
    room.timeLeft = 0;
    room.drawerId = null;
    room.currentRound = 0;
    room.turnIndex = 0;
    room.currentWord = '';
    room.usedWords.clear();
    room.players.forEach(p => { p.score = 0; p.guessed = false; p.earnedThisTurn = 0; });
    broadcastState(io, room);
    send(io, room.id, EV.OWNER, room.ownerId);
  }, 15_000);
}

function handleDrawerLeft(io: SocketServer, room: Room) {
  clearTimers(room);
  room.turnReason = REASON.DRAWER_LEFT;
  endTurn(io, room);
}

function resetToLobby(io: SocketServer, room: Room) {
  clearTimers(room);
  room.state = ST.LOBBY;
  room.timeLeft = 0;
  room.drawerId = null;
  room.currentWord = '';
  room.players.forEach(p => { p.score = 0; p.guessed = false; p.earnedThisTurn = 0; });
  broadcastState(io, room);
  send(io, room.id, EV.OWNER, room.ownerId);
}

// ─── Socket setup ─────────────────────────────────────────────────────────────
export function setupSocketIO(server: HttpServer) {
  const io = new SocketServer(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 60_000,
    pingInterval: 25_000,
  });

  function findOrCreatePublic(): Room {
    for (const room of rooms.values()) {
      if (room.isPublic && room.state === ST.LOBBY && room.players.length < room.settings[SETI.SLOTS])
        return room;
    }
    let code: string;
    do { code = generateRoomCode(); } while (rooms.has(code));
    const r = newRoom(code, true);
    rooms.set(code, r);
    return r;
  }

  function createPrivate(): Room {
    let code: string;
    do { code = generateRoomCode(); } while (rooms.has(code));
    const r = newRoom(code, false);
    rooms.set(code, r);
    return r;
  }

  io.on('connection', (socket: Socket) => {
    logger.info({ socketId: socket.id }, 'Socket connected');

    // ── Login / join room ────────────────────────────────────────────────────
    socket.on('login', (loginData: unknown) => {
      try {
        const d = loginData as Record<string, unknown>;
        const playerName = String(d.name || 'Anon').slice(0, 21).trim() || 'Anon';
        const playerAvatar = Array.isArray(d.avatar) ? (d.avatar as number[]) : [28, 57, 51];
        const lang = typeof d.lang !== 'undefined' ? Number(d.lang) : 0;

        const joinCode = (() => {
          const j = d.join;
          const c = d.code;
          if (j && typeof j === 'string' && j.trim()) return j.trim().toUpperCase();
          if (c && typeof c === 'string' && c.trim()) return c.trim().toUpperCase();
          return '';
        })();

        let room: Room | null = null;

        if (d.create === 1) {
          room = createPrivate();
        } else if (joinCode) {
          room = rooms.get(joinCode) ?? null;
          if (!room)                                              { socket.emit('joinerr', 1); return; }
          if (room.players.length >= room.settings[SETI.SLOTS]) { socket.emit('joinerr', 2); return; }
        } else {
          room = findOrCreatePublic();
        }

        if (room.deleteTimer) { clearTimeout(room.deleteTimer); room.deleteTimer = null; }

        const isOwner = room.players.length === 0;
        const player: Player = {
          id: socket.id, name: playerName, avatar: playerAvatar,
          score: 0, guessed: false, isOwner, flags: isOwner ? FLAG_OWNER : 0,
          muted: false, mutedBy: new Set(), votekickVotes: new Set(),
          spamCount: 0, spamTimer: null, earnedThisTurn: 0, reported: false,
        };
        if (isOwner) room.ownerId = socket.id;
        room.settings[SETI.LANG] = lang;
        room.players.push(player);
        socketRoom.set(socket.id, room.id);
        socket.join(room.id);

        // Send full login state to this player
        sendTo(socket, EV.LOGIN, {
          me: socket.id,
          type: room.isPublic ? 0 : 1,
          id: room.id,
          settings: room.settings,
          users: room.players.map(playerObj),
          round: room.currentRound,
          owner: room.ownerId,
          state: buildState(room, socket.id),
        });

        // Notify others in room
        if (room.players.length > 1) {
          socket.to(room.id).emit('data', { id: EV.PLAYER_JOIN, data: playerObj(player) });
        }

        // If joining mid-draw, send canvas history
        if (room.state === ST.DRAWING && room.drawCmds.length > 0) {
          sendTo(socket, EV.DRAW_BATCH, room.drawCmds);
        }

        logger.info({ roomCode: room.id, name: playerName }, 'Player joined');
      } catch (e) {
        logger.error(e, 'Error in login handler');
      }
    });

    // ── Data packet handler ──────────────────────────────────────────────────
    socket.on('data', (packet: unknown) => {
      try {
        const roomCode = socketRoom.get(socket.id);
        if (!roomCode) return;
        const room = rooms.get(roomCode);
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        const pkt = packet as Record<string, unknown>;
        const evId = pkt.id as number;
        const data = pkt.data;

        switch (evId) {

          // ── Start game (id=22) ─────────────────────────────────────────────
          case 22: {
            if (!player.isOwner)           { sendTo(socket, EV.WARNING, { id: 0 }); return; }
            if (room.state !== ST.LOBBY)   return;
            if (typeof data === 'string' && data.trim()) {
              room.customWords = data.split(',')
                .map(w => w.trim())
                .filter(w => w.length >= 1 && w.length <= 32);
            }
            startGame(io, room);
            break;
          }

          // ── Word selection (id=18) ─────────────────────────────────────────
          case 18: {
            if (room.state !== ST.WORD_SELECT) return;
            if (socket.id !== room.drawerId)   return;
            const word = typeof data === 'string' ? data
              : (Array.isArray(data) ? room.wordOptions[Number((data as number[])[0])] ?? '' : '');
            if (!word || !room.wordOptions.includes(word)) return;
            startDrawing(io, room, word);
            break;
          }

          // ── Chat / guess (id=30) ───────────────────────────────────────────
          case 30: {
            if (room.state !== ST.DRAWING && room.state !== ST.LOBBY && room.state !== ST.WORD_SELECT) return;
            if (socket.id === room.drawerId) return;

            const msg = String(data ?? '').slice(0, 100).trim();
            if (!msg) return;

            // Spam throttle
            player.spamCount++;
            if (player.spamCount > 10) { sendTo(socket, EV.SPAM); return; }
            if (!player.spamTimer) {
              player.spamTimer = setTimeout(() => { player.spamCount = 0; player.spamTimer = null; }, 4000);
            }

            if (room.state === ST.DRAWING && !player.guessed) {
              const norm    = msg.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
              const wordNorm = room.currentWord.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

              // Correct guess
              if (norm === wordNorm) {
                player.guessed = true;
                room.guessedCount++;

                const drawTime = room.settings[SETI.DRAWTIME] || 80;
                const ratio    = Math.max(0, room.timeLeft) / drawTime;
                const base     = Math.round(200 + 300 * ratio);
                const bonus    = room.firstGuesser ? 100 : 0;
                const total    = base + bonus;
                room.firstGuesser = false;
                player.score += total;
                player.earnedThisTurn = total;

                // Broadcast correct-guess event (hides the word from reveal)
                send(io, room.id, EV.GUESSED, { id: socket.id });

                // Only guessers + drawer can see the actual guessed message
                room.players
                  .filter(p => p.guessed || p.id === room.drawerId)
                  .forEach(p => io.to(p.id).emit('data', { id: EV.CHAT, data: { id: socket.id, msg } }));
                return;
              }

              // Close guess — private hint, no broadcast
              const dist = levenshtein(norm, wordNorm);
              const threshold = wordNorm.length <= 4 ? 1 : 2;
              if (dist <= threshold) {
                sendTo(socket, EV.CLOSE_GUESS, player.name);
                return;
              }
            }

            // Regular chat: during drawing, guessed players only talk to each other
            if (player.guessed && room.state === ST.DRAWING) {
              room.players
                .filter(p => p.guessed || p.id === room.drawerId)
                .forEach(p => io.to(p.id).emit('data', { id: EV.CHAT, data: { id: socket.id, msg } }));
            } else {
              // Respect mutes — don't send to players who muted this player
              room.players.forEach(p => {
                if (!p.mutedBy.has(socket.id))
                  io.to(p.id).emit('data', { id: EV.CHAT, data: { id: socket.id, msg } });
              });
            }
            break;
          }

          // ── Draw: batch commands (id=19) ───────────────────────────────────
          case 19: {
            if (room.state !== ST.DRAWING || socket.id !== room.drawerId) return;
            if (Array.isArray(data)) {
              room.drawCmds.push(...data);
              if (room.drawCmds.length > MAX_DRAW_CMDS)
                room.drawCmds = room.drawCmds.slice(-MAX_DRAW_CMDS);
            }
            socket.to(room.id).emit('data', { id: EV.DRAW_BATCH, data });
            break;
          }

          // ── Draw: clear canvas (id=20) ─────────────────────────────────────
          case 20: {
            if (room.state !== ST.DRAWING || socket.id !== room.drawerId) return;
            room.drawCmds = [];
            socket.to(room.id).emit('data', { id: EV.DRAW_CLEAR, data: null });
            break;
          }

          // ── Draw: undo to length N (id=21) ─────────────────────────────────
          case 21: {
            if (room.state !== ST.DRAWING || socket.id !== room.drawerId) return;
            const newLen = typeof data === 'number' ? Math.max(0, data) : 0;
            room.drawCmds = room.drawCmds.slice(0, newLen);
            socket.to(room.id).emit('data', { id: EV.DRAW_UNDO, data });
            break;
          }

          // ── Settings change (id=0 or 12) ───────────────────────────────────
          case 0:
          case 12: {
            if (!player.isOwner || room.state !== ST.LOBBY) return;
            const s = data as Record<string, unknown>;
            const settingId = Number(s?.id);
            const val = Number(s?.val);
            if (settingId >= 0 && settingId <= 7 && !Number.isNaN(val)) {
              room.settings[settingId] = val;
              send(io, room.id, EV.SETTINGS, { id: settingId, val });
            }
            break;
          }

          // ── Rate drawing (id=8) ────────────────────────────────────────────
          case 8: {
            if (room.state !== ST.DRAWING || socket.id === room.drawerId) return;
            send(io, room.id, EV.RATE, { id: socket.id, vote: data });
            break;
          }

          // ── Avatar update (id=9) ───────────────────────────────────────────
          case 9: {
            if (!Array.isArray(data)) return;
            player.avatar = (data as number[]).slice(0, 4);
            send(io, room.id, EV.AVATAR, { id: socket.id, avatar: player.avatar });
            break;
          }

          // ── Name change (id=90) ────────────────────────────────────────────
          case 90: {
            const newName = String(data ?? '').slice(0, 21).trim();
            if (!newName) return;
            player.name = newName;
            send(io, room.id, EV.NAME_CHANGE, { id: socket.id, name: newName });
            break;
          }

          // ── Votekick (id=5) ────────────────────────────────────────────────
          case 5: {
            if (room.state === ST.LOBBY) return;
            const targetId = String(data);
            const target = room.players.find(p => p.id === targetId);
            if (!target || target.isOwner || targetId === socket.id) return;

            target.votekickVotes.add(socket.id);
            const needed = Math.ceil((room.players.length - 1) * 0.51);
            if (target.votekickVotes.size >= needed) {
              socket.to(room.id).emit('data', { id: EV.PLAYER_LEAVE, data: { id: targetId, reason: 3 } });
              io.to(targetId).emit('reason', 3);
              setTimeout(() => io.sockets.sockets.get(targetId)?.disconnect(), 200);
            } else {
              // Let everyone know there's a votekick in progress
              send(io, room.id, EV.VOTEKICK, { id: targetId, votes: target.votekickVotes.size, needed });
            }
            break;
          }

          // ── Kick (id=3) ────────────────────────────────────────────────────
          case 3: {
            if (!player.isOwner) return;
            const tid = String(data);
            const tgt = room.players.find(p => p.id === tid);
            if (!tgt || tgt.isOwner) return;
            io.to(tid).emit('reason', 1);
            setTimeout(() => io.sockets.sockets.get(tid)?.disconnect(), 200);
            break;
          }

          // ── Ban (id=4) ─────────────────────────────────────────────────────
          case 4: {
            if (!player.isOwner) return;
            const tid = String(data);
            const tgt = room.players.find(p => p.id === tid);
            if (!tgt || tgt.isOwner) return;
            io.to(tid).emit('reason', 2);
            setTimeout(() => io.sockets.sockets.get(tid)?.disconnect(), 200);
            break;
          }

          // ── Mute / unmute (id=7) ───────────────────────────────────────────
          case 7: {
            const mutedId = String(data);
            const mutedPlayer = room.players.find(p => p.id === mutedId);
            if (!mutedPlayer || mutedId === socket.id) return;

            if (player.mutedBy.has(mutedId)) {
              // Toggle off
              player.mutedBy.delete(mutedId);
            } else {
              player.mutedBy.add(mutedId);
            }
            // Confirm back to requester with current mute state
            sendTo(socket, EV.CHAT, { id: mutedId, muted: player.mutedBy.has(mutedId) });
            break;
          }

          // ── Report (id=6) ──────────────────────────────────────────────────
          case 6: {
            const reportData = data as Record<string, unknown>;
            const reportedId = String(reportData?.id ?? '');
            const target = room.players.find(p => p.id === reportedId);
            if (target) target.reported = true;
            logger.info({ reporter: socket.id, reported: reportedId }, 'Player reported');
            break;
          }

          default:
            break;
        }
      } catch (e) {
        logger.error(e, 'Error handling data packet');
      }
    });

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const roomCode = socketRoom.get(socket.id);
      socketRoom.delete(socket.id);
      if (!roomCode) return;

      const room = rooms.get(roomCode);
      if (!room) return;

      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx === -1) return;

      const leavingPlayer = room.players[idx];
      const wasDrawer = socket.id === room.drawerId;
      const wasOwner  = leavingPlayer.isOwner;

      // Clean up spam timer
      if (leavingPlayer.spamTimer) clearTimeout(leavingPlayer.spamTimer);

      room.players.splice(idx, 1);

      if (room.players.length === 0) {
        scheduleDelete(roomCode);
        return;
      }

      // Notify remaining players
      send(io, room.id, EV.PLAYER_LEAVE, { id: socket.id, reason: 0 });

      // Owner migration
      if (wasOwner) {
        const newOwner = room.players[0];
        newOwner.isOwner = true;
        newOwner.flags |= FLAG_OWNER;
        room.ownerId = newOwner.id;
        send(io, room.id, EV.OWNER, newOwner.id);
      }

      // Drawer disconnected during drawing → abort turn
      if (wasDrawer && room.state === ST.DRAWING) {
        handleDrawerLeft(io, room);
        return;
      }

      // Drawer disconnected during word selection → skip to next
      if (wasDrawer && room.state === ST.WORD_SELECT) {
        clearTimers(room);
        room.turnIndex++;
        nextTurn(io, room);
        return;
      }

      // Too few players to continue → return to lobby
      if (room.state !== ST.LOBBY && room.players.length < 2) {
        send(io, room.id, EV.WARNING, { id: 0 });
        resetToLobby(io, room);
        return;
      }

      logger.info({ socketId: socket.id, roomCode }, 'Player left');
    });
  });

  return io;
}
