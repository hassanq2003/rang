import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  beats,
  botCard,
  botChooseRang,
  chooseRang,
  computeResult,
  createDeck,
  makeCard as c,
  playCard,
  recordTrickWin,
  startGame,
  trickWinner,
  validatePlay,
  viewFor,
  type Card,
  type GameState,
  type PileState,
  type Seat,
} from './rang.ts';

const trick = (n: number): Card[] => [c(2, 'clubs'), c(3, 'clubs'), c(4, 'clubs'), c(5, 'clubs')].map((k) => ({ ...k, id: `${k.id}#${n}` }));
const emptyPiles = (): PileState => ({ tempPiles: [[], [], [], []], permanentPiles: [[], []], streak: null });
const tempCount = (p: PileState, s: Seat) => p.tempPiles[s].flat().length;

describe('ranking', () => {
  test('non-Rang suits rank A K Q J 10 … 2', () => {
    const order = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2] as const;
    for (let i = 0; i < order.length - 1; i++) {
      assert.ok(beats(c(order[i], 'hearts'), c(order[i + 1], 'hearts'), 'hearts', 'spades'));
      assert.ok(!beats(c(order[i + 1], 'hearts'), c(order[i], 'hearts'), 'hearts', 'spades'));
    }
  });
  test('any Rang card beats any non-Rang card', () => {
    assert.ok(beats(c(2, 'spades'), c(14, 'hearts'), 'hearts', 'spades'));
  });
  test('higher Rang beats lower Rang', () => {
    assert.ok(beats(c(14, 'spades'), c(13, 'spades'), 'hearts', 'spades'));
    assert.ok(!beats(c(3, 'spades'), c(10, 'spades'), 'hearts', 'spades'));
  });
  test('an off-suit non-Rang card never wins', () => {
    assert.ok(!beats(c(14, 'diamonds'), c(2, 'hearts'), 'hearts', 'spades'));
  });
  test('trickWinner picks highest led card, or highest Rang', () => {
    const plays = (cards: Card[]) => cards.map((card, i) => ({ seat: i as Seat, card }));
    assert.equal(trickWinner(plays([c(5, 'hearts'), c(14, 'diamonds'), c(12, 'hearts'), c(9, 'hearts')]), 'spades'), 2);
    assert.equal(trickWinner(plays([c(14, 'hearts'), c(2, 'spades'), c(13, 'hearts'), c(3, 'spades')]), 'spades'), 3);
    assert.equal(trickWinner(plays([c(14, 'spades'), c(2, 'hearts'), c(13, 'spades'), c(3, 'clubs')]), 'spades'), 0);
  });
  test('deck has 52 unique cards', () => {
    assert.equal(new Set(createDeck().map((k) => k.id)).size, 52);
  });
});

describe('follow-suit rule', () => {
  const hand = [c(5, 'hearts'), c(9, 'clubs'), c(3, 'spades')];
  test('must play led suit when holding it', () => {
    const r = validatePlay(hand, c(9, 'clubs'), 'hearts', 'spades');
    assert.equal(r.ok, false);
    assert.match((r as { error: string }).error, /follow suit/);
    assert.equal(validatePlay(hand, c(5, 'hearts'), 'hearts', 'spades').ok, true);
  });
  test('Rang can be thrown at any time, even when holding the led suit', () => {
    assert.equal(validatePlay(hand, c(3, 'spades'), 'hearts', 'spades').ok, true);
  });
  test('leader may lead anything, including Rang', () => {
    for (const k of hand) assert.equal(validatePlay(hand, k, null, 'spades').ok, true);
  });
  test('cannot play a card not in hand', () => {
    assert.equal(validatePlay(hand, c(14, 'hearts'), null, 'spades').ok, false);
  });
});

describe('Rang rule', () => {
  test('void in led suit with Rang in hand must play Rang', () => {
    const hand = [c(9, 'clubs'), c(3, 'spades')];
    const r = validatePlay(hand, c(9, 'clubs'), 'hearts', 'spades');
    assert.equal(r.ok, false);
    assert.match((r as { error: string }).error, /Rang/);
    assert.equal(validatePlay(hand, c(3, 'spades'), 'hearts', 'spades').ok, true);
  });
  test('void in led suit and Rang may play anything', () => {
    const hand = [c(9, 'clubs'), c(3, 'diamonds')];
    assert.equal(validatePlay(hand, c(9, 'clubs'), 'hearts', 'spades').ok, true);
    assert.equal(validatePlay(hand, c(3, 'diamonds'), 'hearts', 'spades').ok, true);
  });
});

describe('win-pile pairing', () => {
  test('specification example', () => {
    const A: Seat = 0;
    const B: Seat = 1;
    let p = emptyPiles();
    p = recordTrickWin(p, A, trick(1));
    assert.equal(tempCount(p, A), 4);
    assert.equal(p.permanentPiles[0].length, 0);
    p = recordTrickWin(p, A, trick(2));
    assert.equal(tempCount(p, A), 0);
    assert.equal(p.permanentPiles[0].length, 8);
    p = recordTrickWin(p, A, trick(3));
    assert.equal(tempCount(p, A), 4);
    assert.equal(p.permanentPiles[0].length, 8);
    p = recordTrickWin(p, A, trick(4));
    assert.equal(tempCount(p, A), 0);
    assert.equal(p.permanentPiles[0].length, 16);
    assert.deepEqual(p.permanentPiles[0].map((k) => k.id.split('#')[1]), ['1', '1', '1', '1', '2', '2', '2', '2', '3', '3', '3', '3', '4', '4', '4', '4']);
    p = recordTrickWin(p, B, trick(5));
    assert.equal(tempCount(p, B), 4);
    assert.equal(p.permanentPiles[1].length, 0);
    assert.deepEqual(p.streak, { seat: B, count: 1 });
  });
  test('teammate win breaks the streak', () => {
    let p = emptyPiles();
    p = recordTrickWin(p, 0, trick(1));
    p = recordTrickWin(p, 2, trick(2));
    assert.equal(p.permanentPiles[0].length, 0);
    assert.equal(tempCount(p, 0), 4);
    assert.equal(tempCount(p, 2), 4);
  });
  test('unpaired trick from an old streak stays temporary', () => {
    let p = emptyPiles();
    p = recordTrickWin(p, 0, trick(1));
    p = recordTrickWin(p, 1, trick(2));
    p = recordTrickWin(p, 0, trick(3));
    p = recordTrickWin(p, 0, trick(4));
    assert.equal(p.permanentPiles[0].length, 8);
    assert.deepEqual(p.permanentPiles[0].map((k) => k.id.split('#')[1]), ['3', '3', '3', '3', '4', '4', '4', '4']);
    assert.equal(tempCount(p, 0), 4, 'trick 1 is still in the temporary pile');
  });
});

describe('end-of-game count', () => {
  test('more permanent cards wins; temporary piles ignored', () => {
    assert.deepEqual(computeResult([trick(1).concat(trick(2)), trick(3)]), { permanentCounts: [8, 4], winner: 0 });
    assert.deepEqual(computeResult([[], trick(1)]), { permanentCounts: [0, 4], winner: 1 });
  });
  test('equal permanent piles is a draw', () => {
    assert.equal(computeResult([trick(1), trick(2)]).winner, 'draw');
    assert.equal(computeResult([[], []]).winner, 'draw');
  });
});

describe('full game flow', () => {
  const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  test('chooser gets 5 cards, then everyone 13', () => {
    const s = startGame(seeded(7), 2);
    assert.equal(s.hands[2].length, 5);
    assert.deepEqual([s.hands[0].length, s.hands[1].length, s.hands[3].length], [0, 0, 0]);
    const first5 = s.hands[2].map((k) => k.id);
    assert.equal(chooseRang(s, 1, 'hearts').ok, false);
    const r = chooseRang(s, 2, 'hearts');
    assert.ok(r.ok);
    const g = r.value;
    assert.deepEqual(g.hands.map((h) => h.length), [13, 13, 13, 13]);
    assert.deepEqual(g.hands[2].slice(0, 5).map((k) => k.id), first5);
    assert.equal(new Set(g.hands.flat().map((k) => k.id)).size, 52);
    assert.equal(g.turn, 2);
  });

  test('rejects out-of-turn and illegal moves; plays to completion', () => {
    const r = chooseRang(startGame(seeded(42), 0), 0, 'spades');
    assert.ok(r.ok);
    let g: GameState = r.value;
    const wrong = playCard(g, 1, g.hands[1][0].id);
    assert.equal(wrong.ok, false);
    assert.match((wrong as { error: string }).error, /not your turn/);

    while (g.phase === 'playing') {
      const seat = g.turn;
      const led = g.trick[0]?.card.suit ?? null;
      const hand = g.hands[seat];
      const illegal = hand.find((k) => !validatePlay(hand, k, led, 'spades').ok);
      if (illegal) assert.equal(playCard(g, seat, illegal.id).ok, false);
      const legal = hand.find((k) => validatePlay(hand, k, led, 'spades').ok)!;
      const res = playCard(g, seat, legal.id);
      assert.ok(res.ok);
      g = res.value;
    }
    assert.equal(g.tricksPlayed, 13);
    const temp = g.tempPiles.flat(2).length;
    assert.equal(g.permanentPiles[0].length + g.permanentPiles[1].length + temp, 52);
    assert.ok(g.result);
    assert.equal(playCard(g, g.turn, 'x').ok, false);
    const v = viewFor(g, 1);
    assert.ok(v.permanentCounts.every((n) => n !== null), 'all piles revealed at the end');
  });

  test('lastTrick.banked marks a pair moving to the permanent pile', () => {
    let g = chooseRang(startGame(seeded(3), 0), 0, 'spades');
    assert.ok(g.ok);
    let s = g.value;
    const banks: (number | null)[] = [];
    while (s.phase === 'playing') {
      const hand = s.hands[s.turn];
      const led = s.trick[0]?.card.suit ?? null;
      const card = hand.find((k) => validatePlay(hand, k, led, 'spades').ok)!;
      const before = s.permanentPiles.map((p) => p.length);
      g = playCard(s, s.turn, card.id);
      assert.ok(g.ok);
      s = g.value;
      if (s.trick.length === 0 && s.lastTrick) {
        const grew = s.permanentPiles.findIndex((p, t) => p.length > before[t]);
        banks.push(s.lastTrick.banked);
        assert.equal(s.lastTrick.banked, grew === -1 ? null : grew);
      }
    }
    assert.equal(banks.length, 13);
  });
});

describe('bots', () => {
  test('bots always make legal moves through full games', () => {
    for (let seed = 1; seed <= 20; seed++) {
      let x = seed;
      const rng = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
      let s = startGame(rng);
      const r = chooseRang(s, s.chooser, botChooseRang(s.hands[s.chooser]));
      assert.ok(r.ok);
      s = r.value;
      while (s.phase === 'playing') {
        const res = playCard(s, s.turn, botCard(s, s.turn).id);
        assert.ok(res.ok, !res.ok ? res.error : '');
        s = res.value;
      }
      assert.ok(s.result);
    }
  });
  test('botChooseRang picks the longest suit', () => {
    assert.equal(botChooseRang([c(2, 'clubs'), c(3, 'clubs'), c(4, 'clubs'), c(14, 'hearts'), c(13, 'spades')]), 'clubs');
  });
});

describe('player view', () => {
  test('hides other hands and opponent piles mid-game', () => {
    const r = chooseRang(startGame(() => 0.5, 0), 0, 'hearts');
    assert.ok(r.ok);
    const g = { ...r.value, permanentPiles: [trick(1).concat(trick(2)), trick(3).concat(trick(4))] as [Card[], Card[]] };
    const v = viewFor(g, 0);
    assert.equal(v.hand.length, 13);
    assert.equal((v as unknown as { hands?: unknown }).hands, undefined);
    assert.deepEqual(v.permanentCounts, [8, null]);
    assert.deepEqual(v.tempPileCounts, [0, null, 0, null]);
    assert.deepEqual(viewFor(g, 1).permanentCounts, [null, 8]);
  });
});
