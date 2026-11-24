// Rang rules engine. Pure TypeScript with no imports so it can run in the
// Expo client, the Node server (native type stripping) and node:test.

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export const SUITS: readonly Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

/** 2..10 face value, 11 = J, 12 = Q, 13 = K, 14 = A. */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export interface Card {
  id: string; // e.g. "14_hearts"
  suit: Suit;
  rank: Rank;
}

export type Seat = 0 | 1 | 2 | 3;
export type Team = 0 | 1;
export const PLAYER_COUNT = 4;
export const HAND_SIZE = 13;
export const CHOOSER_FIRST_DEAL = 5;

export interface Play {
  seat: Seat;
  card: Card;
}

export type Phase = 'choosing' | 'playing' | 'finished';

/** Outcome when the game ends. If both permanent piles are equal the game is a draw. */
export interface GameResult {
  permanentCounts: [number, number];
  winner: Team | 'draw';
}

export interface StreakState {
  seat: Seat;
  count: number; // consecutive tricks won by `seat` in the current streak
}

export interface LastTrick {
  plays: Play[];
  winner: Seat;
  banked: Team | null;
}

export interface GameState {
  phase: Phase;
  chooser: Seat;
  rang: Suit | null;
  hands: [Card[], Card[], Card[], Card[]];
  /** Undealt cards (only non-empty while the chooser is picking Rang). */
  stock: Card[];
  turn: Seat;
  trick: Play[];
  /** `banked` is the team whose permanent pile received a pair of tricks on this trick, if any. */
  lastTrick: LastTrick | null;
  tricksPlayed: number;
  /** Per-player temporary piles, stored trick by trick. */
  tempPiles: [Card[][], Card[][], Card[][], Card[][]];
  /** Per-team permanent piles. */
  permanentPiles: [Card[], Card[]];
  streak: StreakState | null;
  result: GameResult | null;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(error: string): Result<T> => ({ ok: false, error });

// ---------------------------------------------------------------- basics

export function makeCard(rank: Rank, suit: Suit): Card {
  return { id: `${rank}_${suit}`, rank, suit };
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push(makeCard(rank, suit));
  return deck;
}

export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const teamOf = (seat: Seat): Team => (seat % 2) as Team;
export const partnerOf = (seat: Seat): Seat => ((seat + 2) % 4) as Seat;
/** Clockwise: seat 0 → 1 → 2 → 3 → 0. Partners (0/2, 1/3) sit opposite. */
export const nextSeat = (seat: Seat): Seat => ((seat + 1) % 4) as Seat;

const RANK_LABEL: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
export const rankLabel = (rank: Rank): string => RANK_LABEL[rank] ?? String(rank);
export const cardLabel = (card: Card): string => `${rankLabel(card.rank)} of ${card.suit}`;

// --------------------------------------------------------------- ranking

/**
 * Strength of a card within a trick. Rang beats everything; then the led
 * suit; any other suit cannot win. Within a group, A high … 2 low.
 */
export function cardStrength(card: Card, ledSuit: Suit, rang: Suit): number {
  if (card.suit === rang) return 200 + card.rank;
  if (card.suit === ledSuit) return 100 + card.rank;
  return 0;
}

/** True if `a` beats `b` given the led suit and Rang. */
export function beats(a: Card, b: Card, ledSuit: Suit, rang: Suit): boolean {
  return cardStrength(a, ledSuit, rang) > cardStrength(b, ledSuit, rang);
}

export function trickWinner(plays: readonly Play[], rang: Suit): Seat {
  if (plays.length === 0) throw new Error('Empty trick');
  const led = plays[0].card.suit;
  let best = plays[0];
  for (const p of plays.slice(1)) if (beats(p.card, best.card, led, rang)) best = p;
  return best.seat;
}

// ----------------------------------------------------------- legal plays

/**
 * Checks a single play against the follow rules:
 * - Rang can be thrown at any time, even when holding the led suit.
 * 1. Otherwise follow the led suit if possible.
 * 2. With no led suit, a Rang card must be played if held.
 * 3. With neither, anything.
 * The leader may lead any card, including Rang.
 */
export function validatePlay(
  hand: readonly Card[],
  card: Card,
  ledSuit: Suit | null,
  rang: Suit,
): Result<true> {
  if (!hand.some((c) => c.id === card.id)) return fail('That card is not in your hand.');
  if (ledSuit === null || card.suit === rang) return ok(true);
  const hasLed = hand.some((c) => c.suit === ledSuit);
  if (hasLed && card.suit !== ledSuit) {
    return fail(`You must follow suit (or throw Rang): ${ledSuit} was led and you have ${ledSuit}.`);
  }
  if (!hasLed) {
    const hasRang = hand.some((c) => c.suit === rang);
    if (hasRang && card.suit !== rang) {
      return fail(`You have no ${ledSuit}, so you must play a Rang card (${rang}).`);
    }
  }
  return ok(true);
}

export function legalCards(hand: readonly Card[], ledSuit: Suit | null, rang: Suit): Card[] {
  return hand.filter((c) => validatePlay(hand, c, ledSuit, rang).ok);
}

// ------------------------------------------------------------- win piles

export interface PileState {
  tempPiles: Card[][][]; // per seat, list of tricks
  permanentPiles: Card[][]; // per team
  streak: StreakState | null;
}

/**
 * Records a trick win. A trick goes to the winner's temporary pile; every
 * second consecutive win by the same player moves that pair of tricks to the
 * team's permanent pile. A win by anyone else (teammate included) ends the
 * streak and starts a new one.
 */
export function recordTrickWin<P extends PileState>(piles: P, winner: Seat, trickCards: Card[]): P {
  const tempPiles = piles.tempPiles.map((p) => p.slice());
  const permanentPiles = piles.permanentPiles.map((p) => p.slice());
  const count = piles.streak && piles.streak.seat === winner ? piles.streak.count + 1 : 1;

  if (count % 2 === 0) {
    const previous = tempPiles[winner].pop() ?? [];
    permanentPiles[teamOf(winner)].push(...previous, ...trickCards);
  } else {
    tempPiles[winner].push(trickCards.slice());
  }
  return { ...piles, tempPiles, permanentPiles, streak: { seat: winner, count } } as P;
}

export function computeResult(permanentPiles: readonly Card[][]): GameResult {
  const counts: [number, number] = [permanentPiles[0].length, permanentPiles[1].length];
  const winner: GameResult['winner'] = counts[0] === counts[1] ? 'draw' : counts[0] > counts[1] ? 0 : 1;
  return { permanentCounts: counts, winner };
}

// ------------------------------------------------------------ game flow

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Shuffles, picks a random chooser and deals them their first 5 cards. */
export function startGame(rng: Rng = Math.random, chooser?: Seat): GameState {
  const deck = shuffle(createDeck(), rng);
  const who: Seat = chooser ?? (Math.floor(rng() * PLAYER_COUNT) as Seat);
  const hands: GameState['hands'] = [[], [], [], []];
  hands[who] = deck.slice(0, CHOOSER_FIRST_DEAL);
  return {
    phase: 'choosing',
    chooser: who,
    rang: null,
    hands,
    stock: deck.slice(CHOOSER_FIRST_DEAL),
    turn: who,
    trick: [],
    lastTrick: null,
    tricksPlayed: 0,
    tempPiles: [[], [], [], []],
    permanentPiles: [[], []],
    streak: null,
    result: null,
  };
}

/** The chooser names Rang; the rest of the deck is dealt to 13 cards each. */
export function chooseRang(state: GameState, seat: Seat, suit: Suit): Result<GameState> {
  if (state.phase !== 'choosing') return fail('Rang has already been chosen.');
  if (seat !== state.chooser) return fail('Only the Rang chooser can pick Rang.');
  if (!SUITS.includes(suit)) return fail(`"${suit}" is not a suit.`);
  const next = clone(state);
  next.rang = suit;
  let s: Seat = state.chooser;
  for (let i = 0; i < PLAYER_COUNT; i++) {
    const need = HAND_SIZE - next.hands[s].length;
    next.hands[s].push(...next.stock.splice(0, need));
    s = nextSeat(s);
  }
  next.phase = 'playing';
  next.turn = state.chooser;
  return ok(next);
}

export function playCard(state: GameState, seat: Seat, cardId: string): Result<GameState> {
  if (state.phase === 'choosing') return fail('Wait for Rang to be chosen.');
  if (state.phase === 'finished') return fail('The game is over.');
  if (seat !== state.turn) return fail("It's not your turn.");
  const rang = state.rang as Suit;
  const hand = state.hands[seat];
  const card = hand.find((c) => c.id === cardId);
  if (!card) return fail('That card is not in your hand.');
  const led = state.trick.length ? state.trick[0].card.suit : null;
  const check = validatePlay(hand, card, led, rang);
  if (!check.ok) return fail(check.error);

  let next = clone(state);
  next.hands[seat] = next.hands[seat].filter((c) => c.id !== cardId);
  next.trick.push({ seat, card });

  if (next.trick.length < PLAYER_COUNT) {
    next.turn = nextSeat(seat);
    return ok(next);
  }

  const winner = trickWinner(next.trick, rang);
  next = recordTrickWin(next, winner, next.trick.map((p) => p.card));
  const banked = next.streak && next.streak.count % 2 === 0 ? teamOf(winner) : null;
  next.lastTrick = { plays: next.trick, winner, banked };
  next.trick = [];
  next.tricksPlayed += 1;
  next.turn = winner;
  if (next.hands.every((h) => h.length === 0)) {
    next.phase = 'finished';
    next.result = computeResult(next.permanentPiles);
  }
  return ok(next);
}

// ------------------------------------------------------------------ bots

/** Picks the suit with the most (and strongest) cards. */
export function botChooseRang(hand: readonly Card[]): Suit {
  let best: Suit = SUITS[0];
  let bestScore = -1;
  for (const suit of SUITS) {
    const score = hand.filter((c) => c.suit === suit).reduce((n, c) => n + 20 + c.rank, 0);
    if (score > bestScore) [best, bestScore] = [suit, score];
  }
  return best;
}

const cheapness = (c: Card, rang: Suit) => (c.suit === rang ? 100 : 0) + c.rank;
const cheapest = (cards: Card[], rang: Suit) => cards.reduce((a, b) => (cheapness(b, rang) < cheapness(a, rang) ? b : a));

/** A simple legal move: win cheaply if the opponents are winning, otherwise dump the lowest card. */
export function botCard(state: GameState, seat: Seat): Card {
  const hand = state.hands[seat];
  const rang = state.rang as Suit;
  const led = state.trick.length ? state.trick[0].card.suit : null;
  const legal = legalCards(hand, led, rang);
  if (led === null) {
    const plain = legal.filter((c) => c.suit !== rang);
    const pool = plain.length ? plain : legal;
    return pool.reduce((a, b) => (b.rank > a.rank ? b : a));
  }
  const winSeat = trickWinner(state.trick, rang);
  if (teamOf(winSeat) !== teamOf(seat)) {
    const best = state.trick.find((p) => p.seat === winSeat)!.card;
    const winners = legal.filter((c) => beats(c, best, led, rang));
    if (winners.length) return winners.reduce((a, b) => (cardStrength(b, led, rang) < cardStrength(a, led, rang) ? b : a));
  }
  return cheapest(legal, rang);
}

// ----------------------------------------------------------- player view

export interface PlayerView {
  seat: Seat;
  phase: Phase;
  chooser: Seat;
  rang: Suit | null;
  hand: Card[];
  legalCardIds: string[];
  handCounts: number[];
  turn: Seat;
  trick: Play[];
  lastTrick: GameState['lastTrick'];
  tricksPlayed: number;
  /** Pile sizes are only sent for the viewer's own team until the game ends (null = hidden). */
  tempPileCounts: (number | null)[];
  permanentCounts: [number | null, number | null];
  streak: StreakState | null;
  result: GameResult | null;
}

/**
 * What one player may see: their own hand, the current trick, and their own
 * team's pile sizes. Opponents' piles are revealed only when the game ends.
 */
export function viewFor(state: GameState, seat: Seat): PlayerView {
  const myTeam = teamOf(seat);
  const finished = state.phase === 'finished';
  const visible = (team: Team) => finished || team === myTeam;
  const hand = state.hands[seat];
  const led = state.trick.length ? state.trick[0].card.suit : null;
  const myTurn = state.phase === 'playing' && state.turn === seat && state.rang;
  return {
    seat,
    phase: state.phase,
    chooser: state.chooser,
    rang: state.rang,
    hand,
    legalCardIds: myTurn ? legalCards(hand, led, state.rang as Suit).map((c) => c.id) : [],
    handCounts: state.hands.map((h) => h.length),
    turn: state.turn,
    trick: state.trick,
    lastTrick: state.lastTrick,
    tricksPlayed: state.tricksPlayed,
    tempPileCounts: state.tempPiles.map((p, s) => (visible(teamOf(s as Seat)) ? p.reduce((n, t) => n + t.length, 0) : null)),
    permanentCounts: [
      visible(0) ? state.permanentPiles[0].length : null,
      visible(1) ? state.permanentPiles[1].length : null,
    ],
    streak: state.streak,
    result: state.result,
  };
}
