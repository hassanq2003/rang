import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { CARDS } from '../../cards';
import { SUITS, makeCard, rankLabel, teamOf, type Card, type PlayerView, type Seat, type Suit } from '../game/rang';
import { useGameSounds } from '../game/sounds';

interface RoomPayload {
  roomId: string;
  seat: Seat;
  players: { name: string; connected: boolean; bot: boolean }[];
  game: PlayerView | null;
  turnMsLeft: number | null;
  /** Local clock time when the current turn auto-plays (computed on receipt). */
  deadlineAt?: number | null;
}

const SUIT_SYMBOL: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const RANK_FILE: Record<number, string> = { 11: 'jack', 12: 'queen', 13: 'king', 14: 'ace' };
const IMAGE_BY_ID = new Map(CARDS.map((c) => [c.id, c.image]));
const imageFor = (card: Card) => IMAGE_BY_ID.get(`${RANK_FILE[card.rank] ?? card.rank}_of_${card.suit}`);

const LOCAL_PC_IP = '192.168.1.15';
/** Set at build time (eas.json / .env) to the hosted server, e.g. https://rang-server-production.up.railway.app */
const ONLINE_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? '';
const DEFAULT_URL = ONLINE_URL || (Platform.OS === 'web' ? 'http://localhost:3000' : `http://${LOCAL_PC_IP}:3000`);

const useNativeDriver = Platform.OS !== 'web';
const CW = 54;
const CH = 78;
/** How long a finished round stays on the table before the cards fly to a pile. */
const HOLD_MS = 1000;
const FLY_MS = 480;

export const ONLINE_SERVER_URL = DEFAULT_URL;
export const LAN_SERVER_URL = Platform.OS === 'web' ? 'http://localhost:3000' : `http://${LOCAL_PC_IP}:3000`;

/** Create/join a room on a server: online (hosted) or local (a PC on the same Wi-Fi). */
export function NetworkPlay({ initialUrl, editableUrl, title, onBack }: { initialUrl: string; editableUrl: boolean; title: string; onBack: () => void }) {
  const [serverUrl, setServerUrl] = useState(initialUrl);
  const [roomId, setRoomId] = useState('');
  const [name, setName] = useState('');
  const [room, setRoom] = useState<RoomPayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  /** Room we are in, so an automatic reconnect rejoins the same seat. */
  const roomIdRef = useRef<string | null>(null);

  useEffect(() => () => void socketRef.current?.disconnect(), []);

  const connect = (mode: 'join' | 'create') => {
    if (!name.trim()) return setMessage('Enter your name.');
    if (mode === 'join' && !roomId.trim()) return setMessage('Enter a room number, or create a room.');
    socketRef.current?.disconnect();
    roomIdRef.current = mode === 'join' ? roomId.trim() : null;
    setMessage('Connecting to server… (a sleeping free server can take ~30s)');
    const s = io(serverUrl, { transports: ['websocket', 'polling'], timeout: 40000, reconnectionDelayMax: 4000 });
    socketRef.current = s;
    s.on('connect', () => {
      setOnline(true);
      setMessage(null);
      if (roomIdRef.current) s.emit('join', { roomId: roomIdRef.current, name });
      else s.emit('create', { name });
    });
    s.on('disconnect', () => setOnline(false));
    s.on('connect_error', () => {
      setOnline(false);
      setMessage(`Can't reach server at ${serverUrl}. Retrying…`);
    });
    s.on('room', (payload: RoomPayload) => {
      roomIdRef.current = payload.roomId;
      setRoom({ ...payload, deadlineAt: payload.turnMsLeft === null ? null : Date.now() + payload.turnMsLeft });
      setMessage(null);
    });
    s.on('rejected', ({ reason }: { reason: string }) => setMessage(reason));
  };

  const emit = (event: string, payload: object) => socketRef.current?.emit(event, payload);

  const leave = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    roomIdRef.current = null;
    setRoom(null);
    setMessage(null);
  };

  if (!room) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.joinBox}>
          <Pressable onPress={onBack}><Text style={styles.backLink}>← Back</Text></Pressable>
          <Text style={styles.title}>{title}</Text>
          {editableUrl && (
            <>
              <Text style={styles.small}>Server running on a PC on this Wi-Fi (npm run server). Enter the PC&apos;s IP.</Text>
              <TextInput style={styles.input} value={serverUrl} onChangeText={setServerUrl} placeholder="http://192.168.x.x:3000" placeholderTextColor="#8aa" autoCapitalize="none" />
            </>
          )}
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#8aa" />
          <Pressable style={styles.button} onPress={() => connect('create')}>
            <Text style={styles.buttonText}>Create new room</Text>
          </Pressable>
          <Text style={styles.or}>— or join a friend —</Text>
          <TextInput style={styles.input} value={roomId} onChangeText={setRoomId} placeholder="Room number" placeholderTextColor="#8aa" keyboardType="number-pad" />
          <Pressable style={[styles.button, styles.buttonAlt]} onPress={() => connect('join')}>
            <Text style={[styles.buttonText, styles.buttonAltText]}>Join room</Text>
          </Pressable>
          {message && <Text style={styles.error}>{message}</Text>}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      {!online && <Text style={styles.offline}>Connection lost — reconnecting…</Text>}
      <Game room={room} message={message} emit={emit} onLeave={leave} />
    </SafeAreaView>
  );
}

// ------------------------------------------------------------ animation bits

type Pt = { x: number; y: number };
type Side = 'bottom' | 'left' | 'top' | 'right';
const SIDES: Side[] = ['bottom', 'left', 'top', 'right'];
const TILT: Record<Side, number> = { bottom: -3, left: 7, top: 4, right: -8 };
const topLeft = (p: Pt): Pt => ({ x: p.x - CW / 2, y: p.y - CH / 2 });

/** Returns `value`, but only after it has been stable for `ms`. */
function useDelayed<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function CardBackView({ w, h }: { w: number; h: number }) {
  return (
    <View style={[styles.back, { width: w, height: h }]}>
      <View style={styles.backInner}>
        <Text style={[styles.backSymbol, { fontSize: Math.max(10, w / 3) }]}>♦</Text>
      </View>
    </View>
  );
}

interface MoveProps {
  card: Card | null; // null = face down
  from: Pt;
  to: Pt;
  delay?: number;
  hold?: number;
  dest?: Pt;
  tilt?: number;
  highlight?: boolean;
}

/** A card that springs from `from` to `to`, optionally waits, then flies to `dest` and fades out. */
function MovingCard({ card, from, to, delay = 0, hold = 0, dest, tilt = 0, highlight }: MoveProps) {
  const [pos] = useState(() => new Animated.ValueXY(from));
  const [enter] = useState(() => new Animated.Value(from.x === to.x && from.y === to.y ? 1 : 0));
  const [leave] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const steps: Animated.CompositeAnimation[] = [
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(pos, { toValue: to, friction: 7, tension: 70, useNativeDriver }),
        Animated.timing(enter, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver }),
      ]),
    ];
    if (dest) {
      steps.push(
        Animated.delay(hold),
        Animated.parallel([
          Animated.timing(pos, { toValue: dest, duration: FLY_MS, easing: Easing.in(Easing.cubic), useNativeDriver }),
          Animated.timing(leave, { toValue: 1, duration: FLY_MS, useNativeDriver }),
        ]),
      );
    }
    const anim = Animated.sequence(steps);
    anim.start();
    return () => anim.stop();
    // Runs once per mount: each card instance animates a single journey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scale = Animated.multiply(
    enter.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }),
    leave.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
  );
  const rotate = Animated.add(enter, leave).interpolate({
    inputRange: [0, 1, 2],
    outputRange: [`${tilt * 4}deg`, `${tilt}deg`, `${tilt * 10}deg`],
  });
  const opacity = leave.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.moving,
        highlight && styles.winnerGlow,
        { opacity, transform: [{ translateX: pos.x }, { translateY: pos.y }, { rotate }, { scale }] },
      ]}
    >
      {card ? <Image source={imageFor(card)} style={styles.tableCard} resizeMode="contain" /> : <CardBackView w={CW} h={CH} />}
    </Animated.View>
  );
}

/** A face-down pile whose height grows with the number of tricks; no numbers unless revealed. */
function PileStack({ count, w, h, label, reveal }: { count: number | null; w: number; h: number; label?: string; reveal?: boolean }) {
  const [bump] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!count) return;
    Animated.sequence([
      Animated.timing(bump, { toValue: 1.18, duration: 130, useNativeDriver }),
      Animated.spring(bump, { toValue: 1, friction: 4, useNativeDriver }),
    ]).start();
  }, [count, bump]);
  const layers = count === null ? 1 : Math.min(Math.ceil(count / 4), 7);
  return (
    <View style={styles.pile}>
      <Animated.View style={{ width: w + 8, height: h + 12, transform: [{ scale: bump }] }}>
        {count === 0 ? (
          <View style={[styles.emptyPile, { width: w, height: h, top: 10 }]} />
        ) : (
          Array.from({ length: layers }, (_, i) => (
            <View key={i} style={{ position: 'absolute', left: i, top: 10 - i * 1.6 }}>
              <CardBackView w={w} h={h} />
            </View>
          ))
        )}
        {count === null && <Text style={styles.qmark}>?</Text>}
      </Animated.View>
      {label && <Text style={styles.pileLabel}>{label}</Text>}
      {reveal && count !== null && <Text style={styles.pileCount}>{count}</Text>}
    </View>
  );
}

function TurnPulse() {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 650, useNativeDriver }),
        Animated.timing(v, { toValue: 0, duration: 650, useNativeDriver }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [v]);
  return (
    <Animated.View
      style={[
        styles.pulse,
        {
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.35] }) }],
        },
      ]}
    />
  );
}

/** Springs in on mount; used for banners, badges and toasts. */
function PopIn({ children, delay = 0, style, fadeAfter }: { children: React.ReactNode; delay?: number; style?: object; fadeAfter?: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const steps: Animated.CompositeAnimation[] = [Animated.delay(delay), Animated.spring(v, { toValue: 1, friction: 5, tension: 80, useNativeDriver })];
    if (fadeAfter) steps.push(Animated.delay(fadeAfter), Animated.timing(v, { toValue: 0, duration: 300, useNativeDriver }));
    const a = Animated.sequence(steps);
    a.start();
    return () => a.stop();
  }, [v, delay, fadeAfter]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]}>
      {children}
    </Animated.View>
  );
}

function ShakeText({ text }: { text: string }) {
  const [x] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.sequence(
      [10, -10, 7, -7, 3, 0].map((toValue) => Animated.timing(x, { toValue, duration: 50, useNativeDriver })),
    ).start();
  }, [x]);
  return <Animated.Text style={[styles.error, { transform: [{ translateX: x }] }]}>{text}</Animated.Text>;
}

function HandCard({ card, index, legal, myTurn, onPress }: { card: Card; index: number; legal: boolean; myTurn: boolean; onPress: () => void }) {
  const [enter] = useState(() => new Animated.Value(0));
  const [lift] = useState(() => new Animated.Value(0));
  const [press] = useState(() => new Animated.Value(1));

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 420, delay: index * 45, easing: Easing.out(Easing.back(1.5)), useNativeDriver }).start();
  }, [enter, index]);
  useEffect(() => {
    Animated.spring(lift, { toValue: myTurn && legal ? -12 : 0, friction: 5, useNativeDriver }).start();
  }, [lift, legal, myTurn]);

  const pressTo = (toValue: number) => Animated.spring(press, { toValue, friction: 5, useNativeDriver }).start();

  return (
    <Pressable onPress={onPress} onPressIn={() => pressTo(0.92)} onPressOut={() => pressTo(1)} accessibilityLabel={`${rankLabel(card.rank)} of ${card.suit}`}>
      <Animated.View
        style={[
          styles.handCard,
          myTurn && legal && styles.legal,
          myTurn && !legal && styles.faded,
          {
            opacity: enter,
            transform: [
              { translateY: Animated.add(enter.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }), lift) },
              { rotate: enter.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '0deg'] }) },
              { scale: press },
            ],
          },
        ]}
      >
        <Image source={imageFor(card)} style={styles.handImage} resizeMode="contain" />
      </Animated.View>
    </Pressable>
  );
}

/** Seconds until the server auto-plays the current turn; turns red for the last 10s. */
function Countdown({ at }: { at: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.ceil((at - now) / 1000));
  return <Text style={[styles.countdown, secs <= 10 && styles.countdownLow]}>⏱ {secs}s</Text>;
}

// ------------------------------------------------------------------- game

type Emit = (event: string, payload: object) => void;

export function Game({ room, message, emit, onLeave }: { room: RoomPayload; message: string | null; emit: Emit; onLeave: () => void }) {
  const { seat, players, game } = room;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const nameOf = (s: number) => players[s]?.name ?? `Seat ${s + 1}`;
  const myTeam = teamOf(seat);
  const sideOf = (s: Seat): Side => SIDES[(s - seat + 4) % 4];
  const seatAt = (side: Side) => ((seat + SIDES.indexOf(side)) % 4) as Seat;

  const sortedHand = useMemo(
    () => (game ? [...game.hand].sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || b.rank - a.rank) : []),
    [game],
  );

  // Pile visuals update only after the flying cards land.
  const collecting = !!game && game.trick.length === 0 && !!game.lastTrick && game.phase !== 'choosing';
  const pileKey = JSON.stringify(game ? [game.tempPileCounts, game.permanentCounts] : null);
  const shownPiles = JSON.parse(useDelayed(pileKey, collecting ? HOLD_MS + FLY_MS + 300 : 0)) as
    | [(number | null)[], (number | null)[]]
    | null;
  useGameSounds(game, seat, message, HOLD_MS);

  const header = (
    <View style={styles.header}>
      <Text style={styles.headerText}>Room {room.roomId}</Text>
      {game?.rang && (
        <PopIn style={styles.rangBadge}>
          <Text style={[styles.rangBadgeText, (game.rang === 'hearts' || game.rang === 'diamonds') && styles.red]}>
            Rang {SUIT_SYMBOL[game.rang]}
          </Text>
        </PopIn>
      )}
      <Pressable onPress={onLeave}><Text style={styles.leave}>Leave</Text></Pressable>
    </View>
  );

  if (!game) {
    return (
      <View style={styles.flex}>
        {header}
        <View style={styles.center}>
          <Text style={styles.small}>Room number — share it with friends</Text>
          <PopIn><Text style={styles.roomCode}>{room.roomId}</Text></PopIn>
          <Text style={styles.status}>Waiting for players ({players.length}/4)</Text>
          {players.map((p, i) => (
            <PopIn key={p.name} delay={i * 80}>
              <Text style={styles.playerLine}>
                Seat {i + 1}: {p.bot ? '🤖 ' : ''}{p.name}{i === seat ? ' (you)' : ''} · Team {i % 2 === 0 ? 'A' : 'B'}
              </Text>
            </PopIn>
          ))}
          <Pressable style={[styles.button, styles.smallButton]} onPress={() => emit('addBot', {})}>
            <Text style={styles.buttonText}>🤖 Add bot</Text>
          </Pressable>
          {message && <ShakeText key={message} text={message} />}
        </View>
      </View>
    );
  }

  // Geometry on the felt.
  const { w: W, h: H } = size;
  const cx = W / 2;
  const cy = H / 2;
  const slot: Record<Side, Pt> = {
    bottom: { x: cx, y: cy + 52 },
    top: { x: cx, y: cy - 52 },
    left: { x: cx - 60, y: cy },
    right: { x: cx + 60, y: cy },
  };
  const entry: Record<Side, Pt> = {
    bottom: { x: cx, y: H + 60 },
    top: { x: cx, y: -40 },
    left: { x: -40, y: cy },
    right: { x: W + 40, y: cy },
  };
  const tempPilePt: Record<Side, Pt> = {
    bottom: { x: cx + 70, y: H - 24 },
    top: { x: cx + 70, y: 30 },
    left: { x: 30, y: cy + 40 },
    right: { x: W - 30, y: cy + 40 },
  };
  const teamPilePt = (team: number): Pt => (team === myTeam ? { x: 32, y: H - 40 } : { x: W - 32, y: 40 });

  const finished = game.phase === 'finished' && !!game.result;
  const last = game.lastTrick;
  const myTurn = game.phase === 'playing' && game.turn === seat;

  const seatLabel = (side: Side) => {
    const s = seatAt(side);
    const tempCount = shownPiles?.[0][s] ?? null;
    return (
      <View style={[styles.seatLabel, styles[`label_${side}`]]} pointerEvents="none">
        <View style={styles.nameRow}>
          {game.phase === 'playing' && game.turn === s && <TurnPulse />}
          <Text style={[styles.seatName, teamOf(s) === myTeam && styles.allyName, game.turn === s && game.phase === 'playing' && styles.activeSeat]}>
            {nameOf(s)}{s === seat ? ' (you)' : ''}{s === game.chooser ? ' ★' : ''}{!players[s]?.connected ? ' ⚠' : ''}
          </Text>
        </View>
        <Text style={styles.small}>{game.handCounts[s]} in hand</Text>
        {tempCount !== null && <PileStack count={tempCount} w={22} h={32} reveal={finished} />}
      </View>
    );
  };

  let status: string;
  if (game.phase === 'choosing') {
    status = game.chooser === seat ? 'You are the Rang chooser. Pick Rang from your 5 cards.' : `${nameOf(game.chooser)} is choosing Rang…`;
  } else if (finished) {
    status = 'Game over';
  } else if (myTurn) {
    status = game.trick.length ? 'Your turn — follow suit or throw Rang.' : 'Your turn — lead any card.';
  } else {
    status = `Waiting for ${nameOf(game.turn)}…`;
  }
  if (collecting && last && !finished) status = `${nameOf(last.winner)} won the round. ${status}`;

  return (
    <View style={styles.flex}>
      {header}
      <View style={styles.teams}>
        <Text style={[styles.teamText, styles.allyName]}>You & {nameOf(seat + 2)}</Text>
        <Text style={styles.teamText}>vs</Text>
        <Text style={styles.teamText}>{nameOf((seat + 1) % 4)} & {nameOf((seat + 3) % 4)}</Text>
      </View>

      <View style={styles.table} onLayout={onLayout}>
        {W > 0 && (
          <>
            {SIDES.map((side) => <React.Fragment key={side}>{seatLabel(side)}</React.Fragment>)}

            <View style={[styles.teamPile, { left: 6, bottom: 6 }]} pointerEvents="none">
              <PileStack count={shownPiles?.[1][myTeam] ?? null} w={34} h={48} label="Our pile" reveal={finished} />
            </View>
            <View style={[styles.teamPile, { right: 6, top: 6 }]} pointerEvents="none">
              <PileStack count={shownPiles?.[1][1 - myTeam] ?? null} w={34} h={48} label="Their pile" reveal={finished} />
            </View>

            {game.trick.map(({ seat: s, card }) => (
              <MovingCard key={card.id} card={card} from={topLeft(entry[sideOf(s)])} to={topLeft(slot[sideOf(s)])} tilt={TILT[sideOf(s)]} />
            ))}

            {collecting && last && (
              <>
                {last.plays.map(({ seat: s, card }, i) => {
                  const side = sideOf(s);
                  const dest = last.banked !== null ? teamPilePt(last.banked) : tempPilePt[sideOf(last.winner)];
                  return (
                    <MovingCard
                      key={`${game.tricksPlayed}-${card.id}`}
                      card={card}
                      from={topLeft(i === last.plays.length - 1 ? entry[side] : slot[side])}
                      to={topLeft(slot[side])}
                      hold={HOLD_MS}
                      dest={topLeft(dest)}
                      tilt={TILT[side]}
                      highlight={s === last.winner}
                    />
                  );
                })}
                {last.banked !== null && (
                  <>
                    {/* The earlier round of the pair leaves the winner's temporary pile. */}
                    {[0, 1, 2, 3].map((i) => (
                      <MovingCard
                        key={`${game.tricksPlayed}-back-${i}`}
                        card={null}
                        from={topLeft(tempPilePt[sideOf(last.winner)])}
                        to={topLeft(tempPilePt[sideOf(last.winner)])}
                        hold={HOLD_MS + 250 + i * 60}
                        dest={topLeft(teamPilePt(last.banked as number))}
                        tilt={i * 5 - 8}
                      />
                    ))}
                    <PopIn key={`bank-${game.tricksPlayed}`} delay={HOLD_MS} fadeAfter={1400} style={styles.bankToast}>
                      <Text style={styles.bankText}>
                        ✨ {nameOf(last.winner)} won twice in a row — pair to {last.banked === myTeam ? 'our' : 'their'} pile!
                      </Text>
                    </PopIn>
                  </>
                )}
              </>
            )}
          </>
        )}

        {finished && game.result && (
          <PopIn delay={HOLD_MS + FLY_MS} style={styles.resultCard}>
            <Text style={styles.resultTitle}>
              {game.result.winner === 'draw' ? '🤝 Draw' : game.result.winner === myTeam ? '🏆 Your team wins!' : 'Opponents win'}
            </Text>
            <Text style={styles.resultLine}>Our pile: {game.result.permanentCounts[myTeam]} cards</Text>
            <Text style={styles.resultLine}>Their pile: {game.result.permanentCounts[1 - myTeam]} cards</Text>
            <Text style={styles.resultNote}>Temporary piles are discarded.</Text>
            <Pressable style={[styles.button, styles.smallButton]} onPress={() => emit('playAgain', {})}>
              <Text style={styles.buttonText}>Play again</Text>
            </Pressable>
          </PopIn>
        )}
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.status}>{status}</Text>
        {room.deadlineAt && !finished && <Countdown key={room.deadlineAt} at={room.deadlineAt} />}
      </View>
      {message && <ShakeText key={message} text={message} />}

      {game.phase === 'choosing' && game.chooser === seat && (
        <View style={styles.suitRow}>
          {SUITS.map((s, i) => (
            <PopIn key={s} delay={i * 90}>
              <Pressable style={styles.suitButton} onPress={() => emit('chooseRang', { suit: s })} accessibilityLabel={`Choose ${s} as Rang`}>
                <Image source={imageFor(makeCard(10, s))} style={styles.suitCard} resizeMode="contain" />
                <Text style={styles.suitName}>{s}</Text>
              </Pressable>
            </PopIn>
          ))}
        </View>
      )}

      <ScrollView horizontal style={styles.handScroll} contentContainerStyle={styles.hand}>
        {sortedHand.map((card, i) => (
          <HandCard
            key={card.id}
            card={card}
            index={i}
            myTurn={myTurn}
            legal={game.legalCardIds.includes(card.id)}
            onPress={() => emit('playCard', { cardId: card.id })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#114a27' },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  joinBox: { flex: 1, justifyContent: 'center', padding: 16, gap: 12, maxWidth: 420, width: '100%', alignSelf: 'center' },
  title: { color: '#d4af37', fontSize: 40, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  urlToggleRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 4 },
  chip: { backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: '#2f7a4c' },
  chipActive: { backgroundColor: '#1d733d', borderColor: '#d4af37' },
  chipText: { color: '#e5f5ea', fontSize: 12, fontWeight: '600' },
  input: { backgroundColor: '#0a2e18', color: '#fff', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#d4af37' },
  button: { backgroundColor: '#d4af37', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#0a2e18', fontWeight: '700', fontSize: 16 },
  error: { color: '#ffb4a8', textAlign: 'center', marginTop: 6, paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a2e18', padding: 12 },
  headerText: { color: '#d4af37', fontWeight: '700' },
  rangBadge: { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 3, borderWidth: 2, borderColor: '#d4af37' },
  rangBadgeText: { fontWeight: '800', color: '#000' },
  leave: { color: '#ffb4a8' },
  teams: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 6 },
  teamText: { color: '#cde', fontSize: 12 },
  table: {
    flex: 1, backgroundColor: '#165e33', margin: 8, borderRadius: 18, overflow: 'hidden',
    borderWidth: 3, borderColor: '#0d3d21',
  },
  seatLabel: { position: 'absolute', alignItems: 'center' },
  label_bottom: { bottom: 6, left: 0, right: 0 },
  label_top: { top: 6, left: 0, right: 0 },
  label_left: { left: 6, top: '38%' },
  label_right: { right: 6, top: '38%' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  seatName: { color: '#fff', fontWeight: '600' },
  allyName: { color: '#a6f0c0' },
  activeSeat: { color: '#d4af37' },
  pulse: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#d4af37' },
  small: { color: '#cde', fontSize: 11 },
  moving: { position: 'absolute', left: 0, top: 0, width: CW, height: CH, borderRadius: 6 },
  winnerGlow: { shadowColor: '#ffd84d', shadowOpacity: 1, shadowRadius: 12, elevation: 12, borderWidth: 2, borderColor: '#ffd84d' },
  tableCard: { width: CW, height: CH, borderRadius: 5, backgroundColor: '#fff' },
  back: { backgroundColor: '#8e1b1b', borderRadius: 4, borderWidth: 2, borderColor: '#fff', padding: 2 },
  backInner: { flex: 1, borderRadius: 2, borderWidth: 1, borderColor: '#d4af37', alignItems: 'center', justifyContent: 'center' },
  backSymbol: { color: '#d4af37' },
  pile: { alignItems: 'center' },
  emptyPile: { position: 'absolute', left: 0, borderRadius: 4, borderWidth: 1, borderStyle: 'dashed', borderColor: '#4f9a6c' },
  qmark: { position: 'absolute', top: 18, left: 0, right: 0, textAlign: 'center', color: '#fff', fontWeight: '800', fontSize: 18 },
  pileLabel: { color: '#cde', fontSize: 10, marginTop: 2 },
  pileCount: { color: '#d4af37', fontWeight: '800', fontSize: 13 },
  teamPile: { position: 'absolute' },
  bankToast: {
    position: 'absolute', alignSelf: 'center', top: '44%', backgroundColor: 'rgba(10,46,24,0.92)',
    borderColor: '#d4af37', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 16,
  },
  bankText: { color: '#ffe48a', fontWeight: '700', textAlign: 'center' },
  resultCard: {
    position: 'absolute', alignSelf: 'center', top: '28%', backgroundColor: '#0a2e18', borderColor: '#d4af37',
    borderWidth: 2, borderRadius: 16, padding: 20, alignItems: 'center', minWidth: 240,
  },
  resultTitle: { color: '#d4af37', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  resultLine: { color: '#fff', fontSize: 16, marginTop: 2 },
  resultNote: { color: '#9bb', fontSize: 11, marginTop: 8 },
  faded: { opacity: 0.45 },
  status: { color: '#fff', textAlign: 'center', paddingHorizontal: 16, paddingVertical: 4 },
  suitRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, padding: 8 },
  suitButton: { alignItems: 'center', padding: 4, borderRadius: 8, borderWidth: 2, borderColor: '#d4af37', backgroundColor: 'rgba(0,0,0,0.2)' },
  suitCard: { width: 62, height: 90, borderRadius: 5, backgroundColor: '#fff' },
  suitName: { color: '#ffe48a', fontSize: 11, fontWeight: '700', marginTop: 2, textTransform: 'capitalize' },
  backLink: { color: '#d4af37', fontSize: 16, marginBottom: 4 },
  red: { color: '#c0392b' },
  handScroll: { flexGrow: 0 },
  hand: { paddingHorizontal: 8, paddingTop: 18, paddingBottom: 8, gap: 4 },
  handCard: { borderRadius: 6, borderWidth: 2, borderColor: 'transparent' },
  legal: { borderColor: '#d4af37' },
  handImage: { width: 64, height: 92 },
  playerLine: { color: '#fff', marginTop: 4 },
  or: { color: '#9bb', textAlign: 'center' },
  buttonAlt: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#d4af37' },
  buttonAltText: { color: '#d4af37' },
  smallButton: { marginTop: 14, paddingVertical: 10, paddingHorizontal: 22 },
  offline: { backgroundColor: '#8e1b1b', color: '#fff', textAlign: 'center', padding: 4, fontSize: 12 },
  roomCode: { color: '#d4af37', fontSize: 48, fontWeight: '900', letterSpacing: 6, marginBottom: 8 },
  statusRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
  countdown: { color: '#ffe48a', fontWeight: '700' },
  countdownLow: { color: '#ff8a7a' },
});
