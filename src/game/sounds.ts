import { useEffect, useRef } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import type { PlayerView, Seat } from './rang';

const SOURCES = {
  play: require('../../assets/sounds/play.wav'),
  collect: require('../../assets/sounds/collect.wav'),
  bank: require('../../assets/sounds/bank.wav'),
  turn: require('../../assets/sounds/turn.wav'),
  rang: require('../../assets/sounds/rang.wav'),
  win: require('../../assets/sounds/win.wav'),
  lose: require('../../assets/sounds/lose.wav'),
  error: require('../../assets/sounds/error.wav'),
};
export type SoundName = keyof typeof SOURCES;

let players: Partial<Record<SoundName, AudioPlayer>> | null = null;

function load() {
  if (players) return players;
  players = {};
  setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  for (const name of Object.keys(SOURCES) as SoundName[]) {
    try {
      players[name] = createAudioPlayer(SOURCES[name]);
    } catch {
      // sound is optional
    }
  }
  return players;
}

export function playSound(name: SoundName, delayMs = 0) {
  const run = () => {
    const p = load()[name];
    if (!p) return;
    try {
      p.seekTo(0);
      p.play();
    } catch {
      // ignore playback errors (e.g. web autoplay policy)
    }
  };
  if (delayMs) setTimeout(run, delayMs);
  else run();
}

/** Plays sound effects in response to changes in the player's view of the game. */
export function useGameSounds(game: PlayerView | null, seat: Seat, message: string | null, holdMs: number) {
  const prev = useRef<PlayerView | null>(null);

  useEffect(() => {
    const p = prev.current;
    prev.current = game;
    if (!game || !p) return;
    if (game.trick.length > p.trick.length) playSound('play');
    if (game.tricksPlayed > p.tricksPlayed) {
      playSound('play');
      playSound('collect', holdMs);
      if (game.lastTrick?.banked != null) playSound('bank', holdMs + 250);
    }
    if (!p.rang && game.rang) playSound('rang');
    if (game.phase === 'playing' && game.turn === seat && (p.turn !== seat || p.phase !== 'playing')) {
      playSound('turn', game.trick.length === 0 && game.tricksPlayed > 0 ? holdMs + 500 : 150);
    }
    if (game.phase === 'finished' && p.phase !== 'finished' && game.result) {
      const w = game.result.winner;
      playSound(w !== 'draw' && w === seat % 2 ? 'win' : 'lose', holdMs + 600);
    }
  }, [game, seat, holdMs]);

  useEffect(() => {
    if (message) playSound('error');
  }, [message]);
}
