import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, firebaseConfigured } from '../firebase';
import { C, ThemedBackground, themed } from '../theme';

/** Current Firebase user; `undefined` while the saved session is loading. */
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(auth ? undefined : null);
  useEffect(() => (auth ? onAuthStateChanged(auth, setUser) : undefined), []);
  return user;
}

const FRIENDLY: Record<string, string> = {
  'auth/invalid-email': 'That email address looks wrong.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'No account with that email.',
  'auth/email-already-in-use': 'An account with that email already exists. Sign in instead.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Try again in a few minutes.',
  'auth/network-request-failed': 'No internet connection.',
};
const friendly = (e: unknown) => FRIENDLY[(e as { code?: string }).code ?? ''] ?? (e as Error).message ?? 'Something went wrong.';

export default function AuthScreen({ onGuest }: { onGuest: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);

  const submit = async () => {
    if (!auth) return;
    setMsg(null);
    if (mode === 'signup' && !name.trim()) return setMsg({ text: 'Enter a player name.' });
    setBusy(true);
    try {
      if (mode === 'signin') await signInWithEmailAndPassword(auth, email.trim(), password);
      else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: name.trim().slice(0, 20) });
      }
    } catch (e) {
      setMsg({ text: friendly(e) });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!auth) return;
    if (!email.trim()) return setMsg({ text: 'Enter your email first, then tap "Forgot password".' });
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMsg({ text: 'Password reset email sent. Check your inbox.', ok: true });
    } catch (e) {
      setMsg({ text: friendly(e) });
    }
  };

  return (
    <ThemedBackground dim={0.55} blur={1}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
          <View style={[themed.panel, styles.gap]}>
            <Text style={styles.heading}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>
            {!firebaseConfigured ? (
              <Text style={styles.error}>Accounts aren&apos;t set up in this build (Firebase config missing). You can still play as a guest.</Text>
            ) : (
              <>
                {mode === 'signup' && (
                  <TextInput style={themed.input} value={name} onChangeText={setName} placeholder="Player name" placeholderTextColor={C.muted} />
                )}
                <TextInput style={themed.input} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={C.muted} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
                <TextInput style={themed.input} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={C.muted} secureTextEntry autoComplete={mode === 'signin' ? 'password' : 'new-password'} />
                {msg && <Text style={msg.ok ? styles.ok : styles.error}>{msg.text}</Text>}
                <Pressable style={themed.button} onPress={submit} disabled={busy}>
                  {busy ? <ActivityIndicator color={C.cream} /> : <Text style={themed.buttonText}>{mode === 'signin' ? 'SIGN IN' : 'SIGN UP'}</Text>}
                </Pressable>
                <View style={styles.row}>
                  <Pressable onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMsg(null); }}>
                    <Text style={styles.link}>{mode === 'signin' ? 'New here? Create account' : 'Have an account? Sign in'}</Text>
                  </Pressable>
                  {mode === 'signin' && (
                    <Pressable onPress={reset}><Text style={styles.link}>Forgot password</Text></Pressable>
                  )}
                </View>
              </>
            )}
            <Pressable style={themed.ghostButton} onPress={onGuest}>
              <Text style={themed.ghostText}>Play as guest (no history)</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flex: 1, justifyContent: 'flex-end', padding: 16, paddingBottom: 28, maxWidth: 460, width: '100%', alignSelf: 'center' },
  gap: { gap: 10 },
  heading: { color: C.goldLight, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  link: { color: C.gold, textDecorationLine: 'underline' },
  error: { color: C.danger, textAlign: 'center' },
  ok: { color: '#9be29b', textAlign: 'center' },
});
