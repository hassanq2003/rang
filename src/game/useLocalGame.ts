import { useEffect, useState } from 'react';
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
} from './rang';

const BOT_MS = 800;
const AFTER_TRICK_MS = 1800;
const ME: Seat = 0;

/** Offline game against 3 bots, run entirely on the device. Mirrors the server's room payload. */
export function useLocalGame(name: string) {
  const [game, setGame] = useState<GameState>(() => startGame());
  const [message, setMessage] = useState<string | null>(null);

  const apply = (move: (g: GameState) => Result<GameState>) =>
    setGame((g) => {
      const r = move(g);
      if (!r.ok) {
        setMessage(r.error);
        return g;
      }
      setMessage(null);
      return r.value;
    });

  // Bots act when it's their turn.
  useEffect(() => {
    if (game.phase === 'finished') return;
    const actor = game.phase === 'choosing' ? game.chooser : game.turn;
    if (actor === ME) return;
    const pause = game.trick.length === 0 && game.lastTrick ? AFTER_TRICK_MS : 0;
    const t = setTimeout(() => {
      if (game.phase === 'choosing') apply((g) => chooseRang(g, g.chooser, botChooseRang(g.hands[g.chooser])));
      else apply((g) => playCard(g, g.turn, botCard(g, g.turn).id));
    }, BOT_MS + pause);
    return () => clearTimeout(t);
  }, [game]);

  const emit = (event: string, payload: object) => {
    const p = payload as { suit?: Suit; cardId?: string };
    if (event === 'chooseRang') apply((g) => chooseRang(g, ME, p.suit as Suit));
    else if (event === 'playCard') apply((g) => playCard(g, ME, String(p.cardId)));
    else if (event === 'playAgain') setGame((g) => startGame(Math.random, ((g.chooser + 1) % 4) as Seat));
  };

  const room = {
    roomId: 'vs AI',
    seat: ME,
    players: [name || 'You', 'Bot West', 'Bot Partner', 'Bot East'].map((n, i) => ({ name: n, connected: true, bot: i > 0 })),
    game: viewFor(game, ME),
    turnMsLeft: null,
    deadlineAt: null,
  };
  return { room, message, emit };
}
