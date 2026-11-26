import React, { useEffect, useState } from 'react';
import { Animated, Easing, ImageBackground, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

/** Palette taken from the Rang poster: black, smoky crimson, cream cards and gold. */
export const C = {
  bg: '#0b0404',
  panel: 'rgba(22, 6, 7, 0.88)',
  panelSolid: '#1a0708',
  felt: '#2a080b',
  feltEdge: '#7a5a1c',
  crimson: '#c4161f',
  ember: '#7a1016',
  gold: '#d4af37',
  goldLight: '#ffd98a',
  cream: '#f3e9dc',
  muted: '#c9b3a3',
  danger: '#ff8a7a',
};

export const POSTER = require('../assets/rang-poster.webp');
const useNativeDriver = Platform.OS !== 'web';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Poster backdrop with a dark veil and slowly drifting suit symbols. */
export function ThemedBackground({ children, dim = 0.55, blur = 0, style }: { children: React.ReactNode; dim?: number; blur?: number; style?: ViewStyle }) {
  return (
    <ImageBackground source={POSTER} resizeMode="cover" blurRadius={blur} style={[styles.fill, style]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(8,2,2,${dim})` }]} />
      <Embers />
      {children}
    </ImageBackground>
  );
}

const GLYPHS = [
  { ch: '♠', left: '8%', size: 46, dur: 9000, red: false },
  { ch: '♥', left: '78%', size: 40, dur: 11000, red: true },
  { ch: '♦', left: '45%', size: 34, dur: 13000, red: true },
  { ch: '♣', left: '22%', size: 38, dur: 12000, red: false },
] as const;

function Embers() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {GLYPHS.map((g, i) => (
        <Drift key={i} {...g} delay={i * 1500} />
      ))}
    </View>
  );
}

function Drift({ ch, left, size, dur, red, delay }: { ch: string; left: string; size: number; dur: number; red: boolean; delay: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([Animated.delay(delay), Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.linear, useNativeDriver }), Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver })]),
    );
    a.start();
    return () => a.stop();
  }, [v, dur, delay]);
  return (
    <Animated.Text
      style={{
        position: 'absolute',
        left: left as `${number}%`,
        bottom: -60,
        fontSize: size,
        color: red ? C.crimson : '#3b2a2a',
        opacity: v.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 0.35, 0.35, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -900] }) },
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['-15deg', '25deg'] }) },
        ],
      }}
    >
      {ch}
    </Animated.Text>
  );
}

/** Full-screen animated poster shown at launch; tap to skip. */
export function IntroSplash({ onDone }: { onDone: () => void }) {
  const [fade] = useState(() => new Animated.Value(0));
  const [zoom] = useState(() => new Animated.Value(1.12));

  useEffect(() => {
    const a = Animated.sequence([
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver }),
        Animated.timing(zoom, { toValue: 1, duration: 2200, easing: Easing.out(Easing.cubic), useNativeDriver }),
      ]),
      Animated.delay(500),
      Animated.timing(fade, { toValue: 0, duration: 450, useNativeDriver }),
    ]);
    a.start(({ finished }) => finished && onDone());
    return () => a.stop();
  }, [fade, zoom, onDone]);

  return (
    <Pressable style={[styles.fill, { backgroundColor: C.bg }]} onPress={onDone}>
      <Animated.Image
        source={POSTER}
        resizeMode="cover"
        onLoadEnd={() => SplashScreen.hideAsync().catch(() => {})}
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%', opacity: fade, transform: [{ scale: zoom }] }]}
      />
    </Pressable>
  );
}

export const themed = StyleSheet.create({
  panel: { backgroundColor: C.panel, borderColor: C.gold, borderWidth: 1.5, borderRadius: 16, padding: 16 },
  input: { backgroundColor: 'rgba(0,0,0,0.55)', color: C.cream, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.gold },
  button: {
    backgroundColor: C.crimson, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: C.goldLight,
    shadowColor: C.crimson, shadowOpacity: 0.7, shadowRadius: 12, elevation: 6,
  },
  buttonText: { color: C.cream, fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  ghostButton: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5, borderColor: C.gold, backgroundColor: 'rgba(0,0,0,0.45)' },
  ghostText: { color: C.goldLight, fontWeight: '800', fontSize: 16 },
});

const styles = StyleSheet.create({ fill: { flex: 1 } });
