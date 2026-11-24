// Authoritative Rang server. Local: npm run server   Hosted: node server/index.ts (PORT from env)
import { createServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import {
  botCard,
  botChooseRang,
  chooseRang,
  playCard,
  startGame,
  viewFor,
  type GameState,
  type Result,
  type Seat,
  type Suit,
} from '../src/game/rang.ts';

const PORT = Number(process.env.PORT ?? 3000);
const TURN_MS = 30_000; // auto-play for a human who doesn't move in time
const AWAY_MS = 8_000; // auto-play for a disconnected human
const BOT_MS = 800;
const AFTER_TRICK_MS = 1_800; // let clients finish the pickup animation
const ROOM_GRACE_MS = 120_000; // keep a room with nobody online this long

interface Player {
  name: string;
  socketId: string | null; // null while disconnected (or always, for bots)
  bot: boolean;
}

interface Room {
  id: string;
  players: Player[]; // index = seat
  game: GameState | null;
  timer: ReturnType<typeof setTimeout> | null;
  deadline: number | null;
}

const rooms = new Map<string, Room>();
const http = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  const commit = (process.env.RAILWAY_GIT_COMMIT_SHA ?? 'local').slice(0, 7);
  res.end(`Rang server OK - ${rooms.size} room(s) - build ${commit}`);
});
const io = new Server(http, { cors: { origin: '*' } });

const isOnline = (p: Player) => !!p.socketId && io.sockets.sockets.has(p.socketId);

function broadcast(room: Room) {
  const players = room.players.map((p) => ({ name: p.name, connected: p.bot || isOnline(p), bot: p.bot }));
  const turnMsLeft = room.deadline ? Math.max(0, room.deadline - Date.now()) : null;
  room.players.forEach((p, seat) => {
    if (!p.socketId) return;
    io.to(p.socketId).emit('room', {
      roomId: room.id,
      seat,
      players,
      turnMsLeft,
      game: room.game ? viewFor(room.game, seat as Seat) : null,
    });
  });
}

/** Applies a move, then broadcasts and arms the timer for whoever acts next. */
function apply(room: Room, move: (g: GameState) => Result<GameState>): string | null {
  if (!room.game) return 'The game has not started.';
  const res = move(room.game);
  if (!res.ok) return res.error;
  room.game = res.value;
  schedule(room);
  broadcast(room);
  return null;
}

function autoMove(room: Room) {
  const g = room.game;
  if (!g) return;
  if (g.phase === 'choosing') apply(room, (s) => chooseRang(s, s.chooser, botChooseRang(s.hands[s.chooser])));
  else if (g.phase === 'playing') apply(room, (s) => playCard(s, s.turn, botCard(s, s.turn).id));
}

function schedule(room: Room) {
  if (room.timer) clearTimeout(room.timer);
  room.timer = null;
  room.deadline = null;
  const g = room.game;
  if (!g || g.phase === 'finished') return;
  const actor = room.players[g.phase === 'choosing' ? g.chooser : g.turn];
  const pause = g.trick.length === 0 && g.lastTrick ? AFTER_TRICK_MS : 0;
  const ms = actor.bot ? BOT_MS + pause : (isOnline(actor) ? TURN_MS : AWAY_MS) + pause;
  if (!actor.bot) room.deadline = Date.now() + ms;
  room.timer = setTimeout(() => autoMove(room), ms);
}

function begin(room: Room, chooser?: Seat) {
  room.game = startGame(Math.random, chooser);
  schedule(room);
}

function newRoomId(): string {
  let id: string;
  do id = String(Math.floor(1000 + Math.random() * 9000));
  while (rooms.has(id));
  return id;
}

function cleanup(room: Room) {
  if (rooms.get(room.id) !== room || room.players.some((p) => !p.bot && isOnline(p))) return;
  if (room.timer) clearTimeout(room.timer);
  rooms.delete(room.id);
}

io.on('connection', (socket: Socket) => {
  let room: Room | null = null;
  const reject = (reason: string) => socket.emit('rejected', { reason });
  const mySeat = () => (room ? (room.players.findIndex((p) => p.socketId === socket.id) as Seat | -1) : -1);

  const enter = (roomId: string, rawName: unknown) => {
    const name = String(rawName ?? '').trim().slice(0, 20);
    if (!name) return reject('Enter a name.');
    if (room) return reject('You are already in a room.');
    if (!/^\d{1,8}$/.test(roomId)) return reject('Room number must be 1–8 digits.');
    let r = rooms.get(roomId);
    if (!r) {
      rooms.set(roomId, (r = { id: roomId, players: [], game: null, timer: null, deadline: null }));
    }
    const existing = r.players.find((p) => !p.bot && p.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (isOnline(existing)) return reject('That name is taken in this room.');
      existing.socketId = socket.id; // reconnect / rejoin
    } else {
      if (r.players.length >= 4) return reject(r.game ? 'Game in progress — rejoin with your original name.' : 'Room is full.');
      r.players.push({ name, socketId: socket.id, bot: false });
    }
    room = r;
    socket.join(r.id);
    if (!r.game && r.players.length === 4) begin(r);
    else if (r.game) schedule(r); // a returning player gets a full turn timer again
    broadcast(r);
  };

  socket.on('create', ({ name }: { name: string }) => enter(newRoomId(), name));
  socket.on('join', ({ roomId, name }: { roomId: string; name: string }) => enter(String(roomId ?? '').trim(), name));

  socket.on('addBot', () => {
    if (!room || mySeat() === -1) return reject('Join a room first.');
    if (room.game || room.players.length >= 4) return reject('The table is full.');
    let n = 1;
    while (room.players.some((p) => p.name === `Bot ${n}`)) n++;
    room.players.push({ name: `Bot ${n}`, socketId: null, bot: true });
    if (room.players.length === 4) begin(room);
    broadcast(room);
  });

  socket.on('chooseRang', ({ suit }: { suit: Suit }) => {
    if (!room) return reject('Join a room first.');
    const err = apply(room, (g) => chooseRang(g, mySeat() as Seat, suit));
    if (err) reject(err);
  });

  socket.on('playCard', ({ cardId }: { cardId: string }) => {
    if (!room) return reject('Join a room first.');
    const err = apply(room, (g) => playCard(g, mySeat() as Seat, String(cardId)));
    if (err) reject(err);
  });

  socket.on('playAgain', () => {
    if (!room?.game || room.game.phase !== 'finished') return reject('The game is not over yet.');
    begin(room, ((room.game.chooser + 1) % 4) as Seat); // Rang chooser rotates clockwise
    broadcast(room);
  });

  socket.on('disconnect', () => {
    if (!room) return;
    const seat = mySeat();
    if (seat === -1) return;
    if (!room.game) room.players.splice(seat, 1);
    else {
      room.players[seat].socketId = null;
      schedule(room); // shorten the absent player's timer
    }
    broadcast(room);
    const r = room;
    setTimeout(() => cleanup(r), ROOM_GRACE_MS); // allow time to reconnect before deleting an empty room
  });
});

http.listen(PORT, () => console.log(`Rang server listening on :${PORT}`));
