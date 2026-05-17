export type GameState =
  | 'LOBBY'
  | 'WORD_SELECTION'
  | 'DRAWING'
  | 'TURN_OVER'
  | 'ROUND_OVER'
  | 'GAME_OVER';

export interface RoomSettings {
  maxPlayers: number;
  totalRounds: number;
  drawTime: number;
}

export interface Player {
  id: string;
  username: string;
  avatarColor: string;
  score: number;
  roundScore: number;
  hasGuessed: boolean;
  isHost: boolean;
  isDrawing: boolean;
  isConnected: boolean;
}

export interface TurnScore {
  playerId: string;
  username: string;
  pointsEarned: number;
  totalScore: number;
}

export interface Room {
  roomCode: string;
  isPublic: boolean;
  settings: RoomSettings;
  gameState: GameState;
  currentRound: number;
  turnIndex: number;
  drawerId: string | null;
  currentWord: string;
  wordOptions: string[];
  timer: number;
  timerId: ReturnType<typeof setInterval> | null;
  wordSelectionTimerId: ReturnType<typeof setTimeout> | null;
  guessedCount: number;
  players: Player[];
  revealedIndices: number[];
  hintGiven75: boolean;
  hintGiven50: boolean;
  firstGuesserThisTurn: boolean;
  turnScores: TurnScore[];
}

export interface DrawPacket {
  type: 'draw';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  size: number;
  tool: 'pencil' | 'eraser';
}

export interface FillPacket {
  type: 'fill';
  x: number;
  y: number;
  color: string;
}
