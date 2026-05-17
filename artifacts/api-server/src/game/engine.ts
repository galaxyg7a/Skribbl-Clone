import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { Room, Player, GameState, TurnScore } from './types';
import { getRandomWords, generateRoomCode } from './words';
import { logger } from '../lib/logger';

const rooms = new Map<string, Room>();
const playerRoomMap = new Map<string, string>();

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

function normalizeGuess(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, '');
}

function createWordMask(word: string): string[] {
  return word.split('').map(c => (/[a-zA-Z]/.test(c) ? '_' : c));
}

function getMaskDisplay(mask: string[]): string {
  return mask.join(' ');
}

function getRevealedMask(word: string, revealedIndices: number[]): string[] {
  const mask = createWordMask(word);
  for (const idx of revealedIndices) {
    if (idx < mask.length) {
      mask[idx] = word[idx];
    }
  }
  return mask;
}

function createRoom(settings: Room['settings'], isPublic: boolean): Room {
  let roomCode: string;
  do {
    roomCode = generateRoomCode();
  } while (rooms.has(roomCode));

  const room: Room = {
    roomCode,
    isPublic,
    settings,
    gameState: 'LOBBY',
    currentRound: 1,
    turnIndex: 0,
    drawerId: null,
    currentWord: '',
    wordOptions: [],
    timer: 0,
    timerId: null,
    wordSelectionTimerId: null,
    guessedCount: 0,
    players: [],
    revealedIndices: [],
    hintGiven75: false,
    hintGiven50: false,
    firstGuesserThisTurn: true,
    turnScores: [],
  };
  rooms.set(roomCode, room);
  return room;
}

function safeDeleteRoom(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;
  if (room.timerId) clearInterval(room.timerId);
  if (room.wordSelectionTimerId) clearTimeout(room.wordSelectionTimerId);
  rooms.delete(roomCode);
  logger.info({ roomCode }, 'Room deleted');
}

function getPublicPlayerList(room: Room) {
  return room.players.map(p => ({
    id: p.id,
    username: p.username,
    avatarColor: p.avatarColor,
    avatarData: p.avatarData,
    score: p.score,
    roundScore: p.roundScore,
    hasGuessed: p.hasGuessed,
    isHost: p.isHost,
    isDrawing: p.isDrawing,
    isConnected: p.isConnected,
  }));
}

function startWordSelection(io: SocketServer, room: Room) {
  room.gameState = 'WORD_SELECTION';
  room.wordOptions = getRandomWords(3);
  room.guessedCount = 0;
  room.revealedIndices = [];
  room.hintGiven75 = false;
  room.hintGiven50 = false;
  room.firstGuesserThisTurn = true;
  room.turnScores = [];
  room.currentWord = '';

  const drawer = room.players[room.turnIndex];
  if (!drawer) {
    logger.error({ roomCode: room.roomCode }, 'No drawer found at turnIndex');
    return;
  }

  room.drawerId = drawer.id;
  room.players.forEach(p => {
    p.hasGuessed = false;
    p.roundScore = 0;
    p.isDrawing = p.id === drawer.id;
  });

  io.to(room.roomCode).emit('game_state_change', {
    gameState: room.gameState,
    drawerId: drawer.id,
    drawerName: drawer.username,
  });

  io.to(room.roomCode).emit('player_list_update', getPublicPlayerList(room));

  io.to(drawer.id).emit('word_options', { words: room.wordOptions });
  io.to(room.roomCode).except(drawer.id).emit('word_choosing', {
    drawerName: drawer.username,
  });

  room.wordSelectionTimerId = setTimeout(() => {
    if (room.gameState === 'WORD_SELECTION' && room.wordOptions.length > 0) {
      const autoWord = room.wordOptions[Math.floor(Math.random() * room.wordOptions.length)];
      startDrawing(io, room, autoWord);
    }
  }, 15000);
}

function startDrawing(io: SocketServer, room: Room, word: string) {
  if (room.wordSelectionTimerId) {
    clearTimeout(room.wordSelectionTimerId);
    room.wordSelectionTimerId = null;
  }

  room.gameState = 'DRAWING';
  room.currentWord = word;
  room.timer = room.settings.drawTime;
  room.revealedIndices = [];
  room.hintGiven75 = false;
  room.hintGiven50 = false;

  const mask = createWordMask(word);

  io.to(room.roomCode).emit('game_state_change', {
    gameState: 'DRAWING',
    wordLength: word.length,
    wordDisplay: getMaskDisplay(mask),
    mask,
  });

  io.to(room.drawerId!).emit('drawer_info', { word });

  io.to(room.roomCode).emit('timer_tick', {
    timer: room.timer,
    total: room.settings.drawTime,
  });

  room.timerId = setInterval(() => tickDrawing(io, room), 1000);
}

function tickDrawing(io: SocketServer, room: Room) {
  room.timer--;

  io.to(room.roomCode).emit('timer_tick', {
    timer: room.timer,
    total: room.settings.drawTime,
  });

  const pct = room.timer / room.settings.drawTime;
  const word = room.currentWord;
  const mask = createWordMask(word);

  if (!room.hintGiven75 && pct <= 0.75) {
    room.hintGiven75 = true;
    const idx = 0;
    if (!room.revealedIndices.includes(idx) && /[a-zA-Z]/.test(word[idx])) {
      room.revealedIndices.push(idx);
      const currentMask = getRevealedMask(word, room.revealedIndices);
      io.to(room.roomCode).except(room.drawerId!).emit('hint_reveal', {
        index: idx,
        char: word[idx],
        maskDisplay: getMaskDisplay(currentMask),
        mask: currentMask,
      });
    }
  }

  if (!room.hintGiven50 && pct <= 0.5) {
    room.hintGiven50 = true;
    const letterIndices: number[] = [];
    for (let i = 0; i < word.length; i++) {
      if (/[a-zA-Z]/.test(word[i]) && !room.revealedIndices.includes(i)) {
        letterIndices.push(i);
      }
    }
    if (letterIndices.length > 0) {
      const idx = letterIndices[Math.floor(Math.random() * letterIndices.length)];
      room.revealedIndices.push(idx);
      const currentMask = getRevealedMask(word, room.revealedIndices);
      io.to(room.roomCode).except(room.drawerId!).emit('hint_reveal', {
        index: idx,
        char: word[idx],
        maskDisplay: getMaskDisplay(currentMask),
        mask: currentMask,
      });
    }
  }

  const nonDrawers = room.players.filter(p => p.id !== room.drawerId);
  const allGuessed = nonDrawers.length > 0 && room.guessedCount >= nonDrawers.length;

  if (room.timer <= 0 || allGuessed) {
    if (room.timerId) {
      clearInterval(room.timerId);
      room.timerId = null;
    }
    awardDrawerPoints(room);
    endTurn(io, room);
  }
}

function awardDrawerPoints(room: Room) {
  if (!room.drawerId) return;
  const drawer = room.players.find(p => p.id === room.drawerId);
  if (!drawer) return;
  const drawerPoints = Math.max(0, 50 * room.guessedCount);
  drawer.score += drawerPoints;
  if (drawerPoints > 0) {
    room.turnScores.push({
      playerId: drawer.id,
      username: drawer.username,
      pointsEarned: drawerPoints,
      totalScore: drawer.score,
    });
  }
}

function endTurn(io: SocketServer, room: Room) {
  room.gameState = 'TURN_OVER';

  io.to(room.roomCode).emit('game_state_change', { gameState: 'TURN_OVER' });
  io.to(room.roomCode).emit('turn_over', {
    word: room.currentWord,
    scores: room.turnScores,
    players: getPublicPlayerList(room),
  });

  setTimeout(() => {
    if (!rooms.has(room.roomCode)) return;
    advanceTurn(io, room);
  }, 5000);
}

function advanceTurn(io: SocketServer, room: Room) {
  const connectedPlayers = room.players.filter(p => p.isConnected);
  room.turnIndex++;

  if (room.turnIndex >= connectedPlayers.length) {
    room.turnIndex = 0;
    endRound(io, room);
  } else {
    startWordSelection(io, room);
  }
}

function endRound(io: SocketServer, room: Room) {
  room.gameState = 'ROUND_OVER';

  io.to(room.roomCode).emit('game_state_change', { gameState: 'ROUND_OVER' });
  io.to(room.roomCode).emit('round_over', {
    round: room.currentRound,
    players: getPublicPlayerList(room),
  });

  setTimeout(() => {
    if (!rooms.has(room.roomCode)) return;
    if (room.currentRound >= room.settings.totalRounds) {
      endGame(io, room);
    } else {
      room.currentRound++;
      room.turnIndex = 0;
      startWordSelection(io, room);
    }
  }, 6000);
}

function endGame(io: SocketServer, room: Room) {
  room.gameState = 'GAME_OVER';

  const sorted = [...room.players].sort((a, b) => b.score - a.score);

  io.to(room.roomCode).emit('game_state_change', { gameState: 'GAME_OVER' });
  io.to(room.roomCode).emit('game_over', {
    players: sorted.map((p, i) => ({
      rank: i + 1,
      id: p.id,
      username: p.username,
      avatarColor: p.avatarColor,
      score: p.score,
    })),
  });

  setTimeout(() => {
    if (!rooms.has(room.roomCode)) return;
    room.gameState = 'LOBBY';
    room.currentRound = 1;
    room.turnIndex = 0;
    room.drawerId = null;
    room.currentWord = '';
    room.players.forEach(p => {
      p.score = 0;
      p.roundScore = 0;
      p.hasGuessed = false;
      p.isDrawing = false;
    });
    io.to(room.roomCode).emit('game_state_change', { gameState: 'LOBBY' });
    io.to(room.roomCode).emit('player_list_update', getPublicPlayerList(room));
  }, 15000);
}

export function setupSocketIO(server: HttpServer) {
  const io = new SocketServer(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket: Socket) => {
    logger.info({ socketId: socket.id }, 'Socket connected');

    socket.on('create_room', ({ username, avatarColor, avatarData, settings, isPublic }) => {
      const safeSettings = {
        maxPlayers: Math.min(Math.max(Number(settings?.maxPlayers) || 8, 2), 20),
        totalRounds: Math.min(Math.max(Number(settings?.totalRounds) || 3, 1), 8),
        drawTime: Math.min(Math.max(Number(settings?.drawTime) || 80, 30), 180),
      };

      const room = createRoom(safeSettings, Boolean(isPublic));

      const player: Player = {
        id: socket.id,
        username: String(username || 'Player').slice(0, 20),
        avatarColor: String(avatarColor || '#FF5733'),
        avatarData: avatarData || undefined,
        score: 0,
        roundScore: 0,
        hasGuessed: false,
        isHost: true,
        isDrawing: false,
        isConnected: true,
      };

      room.players.push(player);
      playerRoomMap.set(socket.id, room.roomCode);
      socket.join(room.roomCode);

      socket.emit('joined_room', {
        roomCode: room.roomCode,
        playerId: socket.id,
        gameState: room.gameState,
        settings: room.settings,
        players: getPublicPlayerList(room),
      });

      logger.info({ roomCode: room.roomCode, username }, 'Room created');
    });

    socket.on('join_room', ({ roomCode, username, avatarColor, avatarData }) => {
      const code = String(roomCode || '').toUpperCase().trim();
      const room = rooms.get(code);

      if (!room) {
        socket.emit('error', { message: 'Room not found. Check the code and try again.' });
        return;
      }
      if (room.players.filter(p => p.isConnected).length >= room.settings.maxPlayers) {
        socket.emit('error', { message: 'This room is full.' });
        return;
      }
      if (room.gameState !== 'LOBBY') {
        socket.emit('error', { message: 'A game is already in progress.' });
        return;
      }

      const player: Player = {
        id: socket.id,
        username: String(username || 'Player').slice(0, 20),
        avatarColor: String(avatarColor || '#4CAF50'),
        avatarData: avatarData || undefined,
        score: 0,
        roundScore: 0,
        hasGuessed: false,
        isHost: false,
        isDrawing: false,
        isConnected: true,
      };

      room.players.push(player);
      playerRoomMap.set(socket.id, code);
      socket.join(code);

      socket.emit('joined_room', {
        roomCode: code,
        playerId: socket.id,
        gameState: room.gameState,
        settings: room.settings,
        players: getPublicPlayerList(room),
      });

      io.to(code).emit('player_list_update', getPublicPlayerList(room));
      io.to(code).emit('system_message', {
        message: `${player.username} joined the room!`,
        color: '#a0aec0',
      });

      logger.info({ roomCode: code, username }, 'Player joined room');
    });

    socket.on('start_game', () => {
      const roomCode = playerRoomMap.get(socket.id);
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room) return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player?.isHost) {
        socket.emit('error', { message: 'Only the host can start the game.' });
        return;
      }
      if (room.players.filter(p => p.isConnected).length < 2) {
        socket.emit('error', { message: 'Need at least 2 players to start.' });
        return;
      }
      if (room.gameState !== 'LOBBY') return;

      room.currentRound = 1;
      room.turnIndex = 0;
      room.players.forEach(p => { p.score = 0; p.roundScore = 0; });

      startWordSelection(io, room);
    });

    socket.on('select_word', ({ word }) => {
      const roomCode = playerRoomMap.get(socket.id);
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room) return;

      if (room.gameState !== 'WORD_SELECTION') return;
      if (socket.id !== room.drawerId) return;
      if (!room.wordOptions.includes(word)) return;

      startDrawing(io, room, word);
    });

    socket.on('chat_message', ({ message }) => {
      const roomCode = playerRoomMap.get(socket.id);
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room) return;

      const sender = room.players.find(p => p.id === socket.id);
      if (!sender) return;

      if (socket.id === room.drawerId && room.gameState === 'DRAWING') return;

      const rawMessage = String(message || '').slice(0, 120);

      if (room.gameState === 'DRAWING' && !sender.hasGuessed) {
        const normalized = normalizeGuess(rawMessage);
        const normalizedWord = normalizeGuess(room.currentWord);

        if (normalized === normalizedWord) {
          sender.hasGuessed = true;
          room.guessedCount++;

          const basePoints = Math.round((room.timer / room.settings.drawTime) * 500);
          const bonusPoints = room.firstGuesserThisTurn ? 100 : 0;
          const totalPoints = basePoints + bonusPoints;
          room.firstGuesserThisTurn = false;

          sender.score += totalPoints;
          sender.roundScore += totalPoints;

          room.turnScores.push({
            playerId: sender.id,
            username: sender.username,
            pointsEarned: totalPoints,
            totalScore: sender.score,
          });

          io.to(roomCode).emit('system_message', {
            message: `${sender.username} guessed the word!`,
            color: '#68d391',
          });

          io.to(roomCode).emit('guess_correct', {
            playerId: sender.id,
            username: sender.username,
            points: totalPoints,
          });

          io.to(roomCode).emit('player_list_update', getPublicPlayerList(room));
          return;
        }

        const dist = levenshtein(normalized, normalizeGuess(room.currentWord));
        if (dist === 1 || dist === 2) {
          socket.emit('guess_close', {
            message: 'Your guess is extremely close!',
          });
          return;
        }
      }

      if (sender.hasGuessed && room.gameState === 'DRAWING') {
        room.players.filter(p => p.hasGuessed).forEach(p => {
          io.to(p.id).emit('chat_message', {
            senderId: sender.id,
            username: sender.username,
            avatarColor: sender.avatarColor,
            message: rawMessage,
            color: '#68d391',
            guessersOnly: true,
          });
        });
        return;
      }

      io.to(roomCode).emit('chat_message', {
        senderId: sender.id,
        username: sender.username,
        avatarColor: sender.avatarColor,
        message: rawMessage,
        color: null,
        guessersOnly: false,
      });
    });

    socket.on('draw_data', (packet) => {
      const roomCode = playerRoomMap.get(socket.id);
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room || room.gameState !== 'DRAWING') return;
      if (socket.id !== room.drawerId) return;

      socket.to(roomCode).emit('draw_data', packet);
    });

    socket.on('fill_data', (packet) => {
      const roomCode = playerRoomMap.get(socket.id);
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room || room.gameState !== 'DRAWING') return;
      if (socket.id !== room.drawerId) return;

      socket.to(roomCode).emit('fill_data', packet);
    });

    socket.on('canvas_clear', () => {
      const roomCode = playerRoomMap.get(socket.id);
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room || room.gameState !== 'DRAWING') return;
      if (socket.id !== room.drawerId) return;

      socket.to(roomCode).emit('canvas_clear');
    });

    socket.on('canvas_undo', ({ snapshot }) => {
      const roomCode = playerRoomMap.get(socket.id);
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room || room.gameState !== 'DRAWING') return;
      if (socket.id !== room.drawerId) return;

      socket.to(roomCode).emit('canvas_undo', { snapshot });
    });

    socket.on('kick_player', ({ playerId }) => {
      const roomCode = playerRoomMap.get(socket.id);
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room) return;

      const kicker = room.players.find(p => p.id === socket.id);
      if (!kicker?.isHost) return;
      if (playerId === socket.id) return;

      const target = room.players.find(p => p.id === playerId);
      if (!target) return;

      io.to(playerId).emit('kicked', { message: 'You were kicked from the room.' });
      io.sockets.sockets.get(playerId)?.leave(roomCode);

      room.players = room.players.filter(p => p.id !== playerId);
      playerRoomMap.delete(playerId);

      io.to(roomCode).emit('player_list_update', getPublicPlayerList(room));
      io.to(roomCode).emit('system_message', {
        message: `${target.username} was kicked.`,
        color: '#fc8181',
      });
    });

    socket.on('change_settings', ({ settings }) => {
      const roomCode = playerRoomMap.get(socket.id);
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room || room.gameState !== 'LOBBY') return;

      const host = room.players.find(p => p.id === socket.id);
      if (!host?.isHost) return;

      room.settings = {
        maxPlayers: Math.min(Math.max(Number(settings?.maxPlayers) || 8, 2), 20),
        totalRounds: Math.min(Math.max(Number(settings?.totalRounds) || 3, 1), 8),
        drawTime: Math.min(Math.max(Number(settings?.drawTime) || 80, 30), 180),
      };

      io.to(roomCode).emit('settings_update', room.settings);
    });

    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id }, 'Socket disconnected');

      const roomCode = playerRoomMap.get(socket.id);
      if (!roomCode) return;

      const room = rooms.get(roomCode);
      if (!room) {
        playerRoomMap.delete(socket.id);
        return;
      }

      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.isConnected = false;
        io.to(roomCode).emit('system_message', {
          message: `${player.username} disconnected.`,
          color: '#fc8181',
        });
      }

      room.players = room.players.filter(p => p.id !== socket.id);
      playerRoomMap.delete(socket.id);

      if (room.players.length === 0) {
        safeDeleteRoom(roomCode);
        return;
      }

      if (player?.isHost) {
        const nextHost = room.players.find(p => p.isConnected) || room.players[0];
        if (nextHost) {
          nextHost.isHost = true;
          io.to(nextHost.id).emit('became_host');
          io.to(roomCode).emit('system_message', {
            message: `${nextHost.username} is now the host.`,
            color: '#f6e05e',
          });
        }
      }

      io.to(roomCode).emit('player_list_update', getPublicPlayerList(room));

      if (room.gameState === 'DRAWING' && socket.id === room.drawerId) {
        if (room.timerId) clearInterval(room.timerId);
        room.timerId = null;
        io.to(roomCode).emit('system_message', {
          message: 'Drawer disconnected — skipping turn.',
          color: '#fc8181',
        });
        io.to(roomCode).emit('turn_over', {
          word: room.currentWord,
          scores: room.turnScores,
          players: getPublicPlayerList(room),
        });
        io.to(roomCode).emit('game_state_change', { gameState: 'TURN_OVER' });
        setTimeout(() => {
          if (!rooms.has(roomCode)) return;
          advanceTurn(io, room);
        }, 4000);
      }
    });
  });

  return io;
}
