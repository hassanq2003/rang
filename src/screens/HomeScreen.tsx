import React, { useCallback, useState } from 'react';
import { Animated, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalGame } from '../game/useLocalGame';
import { playSound } from '../game/sounds';
import { C, IntroSplash, ThemedBackground, themed } from '../theme';
import { Game, LAN_SERVER_URL, NetworkPlay, ONLINE_SERVER_URL } from './RangScreen';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import AuthScreen, { useAuthUser } from './AuthScreen';
import HistoryScreen from './HistoryScreen';

type Mode = 'home' | 'online' | 'local' | 'ai' | 'history';

export default function HomeScreen() {
  const [intro, setIntro] = useState(true);
  const [mode, setMode] = useState<Mode>('home');
  const user = useAuthUser();
  const [guest, setGuest] = useState(false);
  const displayName = user?.displayName ?? '';
  const [aiName, setAiName] = useState('');
  const [aiStarted, setAiStarted] = useState(false);
  const endIntro = useCallback(() => setIntro(false), []);
  const home = () => {
    setMode('home');
    setAiStarted(false);
  };
  const go = (m: Mode) => {
    playSound('play');
    setMode(m);
  };

  let screen: React.ReactNode;
  if (intro || user === undefined) screen = <IntroSplash onDone={endIntro} />;
  else if (!user && !guest) screen = <AuthScreen onGuest={() => setGuest(true)} />;
  else if (mode === 'history' && user) screen = <HistoryScreen uid={user.uid} onBack={home} />;
  else if (mode === 'online') screen = <NetworkPlay key="online" title="Online" mode="online" defaultName={displayName} initialUrl={ONLINE_SERVER_URL} editableUrl={false} onBack={home} />;
  else if (mode === 'local') screen = <NetworkPlay key="local" title="Local room" mode="local" defaultName={displayName} initialUrl={LAN_SERVER_URL} editableUrl onBack={home} />;
  else if (mode === 'ai' && aiStarted) screen = <AiGame name={aiName || displayName} onLeave={home} />;
  else
    screen = (
      <ThemedBackground dim={0.2}>
        <SafeAreaView style={styles.flex}>
          <View style={styles.account}>
            <Text style={styles.accountText} numberOfLines={1}>{user ? `👤 ${displayName || user.email}` : '👤 Guest'}</Text>
            {user ? (
              <Pressable onPress={() => auth && signOut(auth)}><Text style={styles.accountLink}>Sign out</Text></Pressable>
            ) : (
              <Pressable onPress={() => setGuest(false)}><Text style={styles.accountLink}>Sign in</Text></Pressable>
            )}
          </View>
          <View style={styles.bottom}>
            <FadeUp>
              <View style={themed.panel}>
                {mode === 'ai' ? (
                  <View style={styles.gap}>
                    <Text style={styles.heading}>Against AI</Text>
                    <Text style={styles.hint}>You and a bot partner vs two bots. Works offline.</Text>
                    <TextInput style={themed.input} value={aiName} onChangeText={setAiName} placeholder={displayName || 'Your name'} placeholderTextColor={C.muted} />
                    <Pressable style={themed.button} onPress={() => setAiStarted(true)}>
                      <Text style={themed.buttonText}>DEAL THE CARDS</Text>
                    </Pressable>
                    <Pressable onPress={home}><Text style={styles.back}>← Back</Text></Pressable>
                  </View>
                ) : (
                  <View style={styles.gap}>
                    <ModeButton icon="🌐" label="Online" hint="Create or join a room with friends anywhere" onPress={() => go('online')} />
                    <ModeButton icon="📶" label="Local room" hint="Same Wi-Fi, server on a PC" onPress={() => go('local')} />
                    <ModeButton icon="🤖" label="Against AI" hint="Offline practice with bots" onPress={() => go('ai')} />
                    {user ? (
                      <ModeButton icon="📜" label="History" hint="Your past games and scores" onPress={() => go('history')} />
                    ) : (
                      <Text style={styles.hint}>Sign in to save your game history.</Text>
                    )}
                  </View>
                )}
              </View>
            </FadeUp>
          </View>
        </SafeAreaView>
      </ThemedBackground>
    );

  return (
    <View style={[styles.flex, { backgroundColor: C.bg }]}>
      <StatusBar style="light" />
      {screen}
    </View>
  );
}

function FadeUp({ children }: { children: React.ReactNode }) {
  const [v] = useState(() => new Animated.Value(0));
  React.useEffect(() => {
    Animated.spring(v, { toValue: 1, friction: 7, useNativeDriver: false }).start();
  }, [v]);
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

function ModeButton({ icon, label, hint, onPress }: { icon: string; label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.mode, pressed && styles.modePressed]} onPress={onPress}>
      <View style={styles.iconBadge}><Text style={styles.modeIcon}>{icon}</Text></View>
      <View style={styles.flex}>
        <Text style={styles.modeLabel}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function AiGame({ name, onLeave }: { name: string; onLeave: () => void }) {
  const { room, message, emit } = useLocalGame(name);
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: C.bg }]}>
      <Game room={room} message={message} emit={emit} onLeave={onLeave} mode="ai" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bottom: { flex: 1, justifyContent: 'flex-end', padding: 16, paddingBottom: 28, maxWidth: 460, width: '100%', alignSelf: 'center' },
  gap: { gap: 10 },
  heading: { color: C.goldLight, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  mode: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(0,0,0,0.5)', borderColor: 'rgba(212,175,55,0.6)',
    borderWidth: 1, borderRadius: 12, padding: 12,
  },
  modePressed: { transform: [{ scale: 0.97 }], backgroundColor: C.ember, borderColor: C.goldLight },
  iconBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.crimson, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.goldLight },
  modeIcon: { fontSize: 22 },
  modeLabel: { color: C.cream, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  hint: { color: C.muted, fontSize: 12, marginTop: 2 },
  chevron: { color: C.gold, fontSize: 30, fontWeight: '300' },
  back: { color: C.gold, textAlign: 'center', marginTop: 4 },
  account: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', margin: 12, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)',
  },
  accountText: { color: C.cream, flex: 1, marginRight: 8 },
  accountLink: { color: C.gold, fontWeight: '700' },
});
