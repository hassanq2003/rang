import React, { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalGame } from '../game/useLocalGame';
import { playSound } from '../game/sounds';
import { Game, LAN_SERVER_URL, NetworkPlay, ONLINE_SERVER_URL } from './RangScreen';

type Mode = 'home' | 'online' | 'local' | 'ai';

export default function HomeScreen() {
  const [mode, setMode] = useState<Mode>('home');
  const [aiName, setAiName] = useState('');
  const [aiStarted, setAiStarted] = useState(false);
  const home = () => {
    setMode('home');
    setAiStarted(false);
  };
  const go = (m: Mode) => {
    playSound('play');
    setMode(m);
  };

  if (mode === 'online') return <NetworkPlay key="online" title="Online" initialUrl={ONLINE_SERVER_URL} editableUrl={false} onBack={home} />;
  if (mode === 'local') return <NetworkPlay key="local" title="Local room" initialUrl={LAN_SERVER_URL} editableUrl onBack={home} />;
  if (mode === 'ai' && aiStarted) return <AiGame name={aiName} onLeave={home} />;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.box}>
        <Text style={styles.title}>Rang</Text>
        <Text style={styles.subtitle}>4 players · 2 teams · 1 Rang</Text>
        {mode === 'ai' ? (
          <>
            <TextInput style={styles.input} value={aiName} onChangeText={setAiName} placeholder="Your name" placeholderTextColor="#8aa" />
            <Pressable style={styles.button} onPress={() => setAiStarted(true)}>
              <Text style={styles.buttonText}>Start vs AI</Text>
            </Pressable>
            <Pressable onPress={home}><Text style={styles.back}>← Back</Text></Pressable>
          </>
        ) : (
          <>
            <ModeButton icon="🌐" label="Online" hint="Create or join a room with friends anywhere" onPress={() => go('online')} />
            <ModeButton icon="📶" label="Local room" hint="Play on the same Wi-Fi via a PC server" onPress={() => go('local')} />
            <ModeButton icon="🤖" label="Against AI" hint="Offline, you + bot partner vs 2 bots" onPress={() => go('ai')} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function ModeButton({ icon, label, hint, onPress }: { icon: string; label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.mode, pressed && styles.modePressed]} onPress={onPress}>
      <Text style={styles.modeIcon}>{icon}</Text>
      <View style={styles.flex}>
        <Text style={styles.modeLabel}>{label}</Text>
        <Text style={styles.modeHint}>{hint}</Text>
      </View>
    </Pressable>
  );
}

function AiGame({ name, onLeave }: { name: string; onLeave: () => void }) {
  const { room, message, emit } = useLocalGame(name);
  return (
    <SafeAreaView style={styles.root}>
      <Game room={room} message={message} emit={emit} onLeave={onLeave} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#114a27' },
  flex: { flex: 1 },
  box: { flex: 1, justifyContent: 'center', padding: 16, gap: 12, maxWidth: 420, width: '100%', alignSelf: 'center' },
  title: { color: '#d4af37', fontSize: 52, fontWeight: '900', textAlign: 'center', letterSpacing: 4 },
  subtitle: { color: '#cde', textAlign: 'center', marginBottom: 16 },
  mode: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#0a2e18', borderColor: '#d4af37',
    borderWidth: 1.5, borderRadius: 14, padding: 16,
  },
  modePressed: { transform: [{ scale: 0.97 }], backgroundColor: '#165e33' },
  modeIcon: { fontSize: 30 },
  modeLabel: { color: '#d4af37', fontSize: 18, fontWeight: '800' },
  modeHint: { color: '#cde', fontSize: 12, marginTop: 2 },
  input: { backgroundColor: '#0a2e18', color: '#fff', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#d4af37' },
  button: { backgroundColor: '#d4af37', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#0a2e18', fontWeight: '700', fontSize: 16 },
  back: { color: '#d4af37', textAlign: 'center', marginTop: 8 },
});
