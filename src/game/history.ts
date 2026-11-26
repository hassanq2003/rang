import { useEffect, useState } from 'react';
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp, type Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { PlayerView, Seat, Suit } from './rang';

export type GameMode = 'online' | 'local' | 'ai';

export interface GameRecord {
  id?: string;
  mode: GameMode;
  roomId: string;
  outcome: 'win' | 'loss' | 'draw';
  ourScore: number;
  theirScore: number;
  rang: Suit | null;
  partner: string;
  opponents: string[];
  playedAt?: Timestamp | null;
}

/** Builds a history record from the finished game as seen by `seat`. */
export function recordFrom(game: PlayerView, seat: Seat, names: string[], mode: GameMode, roomId: string): GameRecord | null {
  if (!game.result) return null;
  const myTeam = seat % 2;
  const { winner, permanentCounts } = game.result;
  return {
    mode,
    roomId,
    outcome: winner === 'draw' ? 'draw' : winner === myTeam ? 'win' : 'loss',
    ourScore: permanentCounts[myTeam],
    theirScore: permanentCounts[1 - myTeam],
    rang: game.rang,
    partner: names[(seat + 2) % 4] ?? '',
    opponents: [names[(seat + 1) % 4] ?? '', names[(seat + 3) % 4] ?? ''],
  };
}

/** Saves to users/{uid}/games. Silently skipped for guests or when Firebase isn't configured. */
export async function saveGame(record: GameRecord): Promise<void> {
  const user = auth?.currentUser;
  if (!db || !user) return;
  await addDoc(collection(db, 'users', user.uid, 'games'), { ...record, playedAt: serverTimestamp() });
}

/** Live list of the signed-in user's most recent games. */
export function useHistory(uid: string | null) {
  const [games, setGames] = useState<GameRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!db || !uid) return;
    const q = query(collection(db, 'users', uid, 'games'), orderBy('playedAt', 'desc'), limit(100));
    return onSnapshot(
      q,
      (snap) => setGames(snap.docs.map((d) => ({ id: d.id, ...(d.data() as GameRecord) }))),
      (e) => setError(e.message),
    );
  }, [uid]);
  return { games, error };
}
