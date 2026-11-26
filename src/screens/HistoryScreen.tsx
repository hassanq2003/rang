import React from 'react';
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useHistory, type GameRecord } from '../game/history';
import { C, ThemedBackground, themed } from '../theme';

const SUIT: Record<string, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const MODE: Record<string, string> = { online: '🌐 Online', local: '📶 Local', ai: '🤖 vs AI' };
const OUTCOME = {
  win: { label: 'WIN', color: '#5fd16f' },
  loss: { label: 'LOSS', color: C.danger },
  draw: { label: 'DRAW', color: C.goldLight },
};

export default function HistoryScreen({ uid, onBack }: { uid: string; onBack: () => void }) {
  const { games, error } = useHistory(uid);
  const count = (o: GameRecord['outcome']) => games?.filter((g) => g.outcome === o).length ?? 0;
  const total = games?.length ?? 0;
  const wins = count('win');

  return (
    <ThemedBackground dim={0.8} blur={3}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <Pressable onPress={onBack}><Text style={styles.back}>← Back</Text></Pressable>
          <Text style={styles.title}>Game history</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={[themed.panel, styles.stats]}>
          <Stat label="Played" value={total} />
          <Stat label="Wins" value={wins} color={OUTCOME.win.color} />
          <Stat label="Losses" value={count('loss')} color={OUTCOME.loss.color} />
          <Stat label="Draws" value={count('draw')} color={OUTCOME.draw.color} />
          <Stat label="Win %" value={total ? Math.round((wins / total) * 100) : 0} />
        </View>

        {error ? (
          <Text style={styles.empty}>Couldn&apos;t load history: {error}</Text>
        ) : games === null ? (
          <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={games}
            keyExtractor={(g) => g.id ?? Math.random().toString()}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>No games yet. Finish a game and it will appear here.</Text>}
            renderItem={({ item }) => <Row g={item} />}
          />
        )}
      </SafeAreaView>
    </ThemedBackground>
  );
}

function Stat({ label, value, color = C.cream }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({ g }: { g: GameRecord }) {
  const o = OUTCOME[g.outcome];
  const date = g.playedAt?.toDate?.();
  return (
    <View style={[styles.row, { borderLeftColor: o.color }]}>
      <View style={styles.flex}>
        <View style={styles.rowTop}>
          <Text style={[styles.outcome, { color: o.color }]}>{o.label}</Text>
          <Text style={styles.score}>{g.ourScore} – {g.theirScore}</Text>
        </View>
        <Text style={styles.meta}>
          {MODE[g.mode] ?? g.mode}{g.mode !== 'ai' ? ` · Room ${g.roomId}` : ''}{g.rang ? ` · Rang ${SUIT[g.rang]}` : ''}
        </Text>
        <Text style={styles.meta}>With {g.partner || '—'} vs {g.opponents.filter(Boolean).join(' & ') || '—'}</Text>
      </View>
      <Text style={styles.date}>{date ? `${date.toLocaleDateString()}\n${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'saving…'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back: { color: C.gold, fontSize: 16, width: 50 },
  title: { color: C.goldLight, fontSize: 22, fontWeight: '900' },
  stats: { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 16, paddingVertical: 12 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { color: C.muted, fontSize: 11 },
  list: { padding: 16, gap: 10 },
  empty: { color: C.muted, textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
  row: {
    flexDirection: 'row', gap: 10, backgroundColor: C.panel, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', borderLeftWidth: 5,
  },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  outcome: { fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  score: { color: C.cream, fontWeight: '800', fontSize: 16 },
  meta: { color: C.muted, fontSize: 12, marginTop: 2 },
  date: { color: C.muted, fontSize: 11, textAlign: 'right' },
});
