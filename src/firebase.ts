import { Platform } from 'react-native';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase web-app config (public identifiers, not secrets). Set in .env.local / eas.json.
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = !!(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | null = null;
let auth: FirebaseAuth.Auth | null = null;
let db: Firestore | null = null;

if (firebaseConfigured) {
  app = getApps().length ? getApp() : initializeApp(config);
  if (Platform.OS === 'web') {
    auth = FirebaseAuth.getAuth(app);
  } else {
    // React Native build of firebase/auth exports this; keeps users signed in across app restarts.
    const { getReactNativePersistence } = FirebaseAuth as unknown as {
      getReactNativePersistence: (storage: typeof AsyncStorage) => FirebaseAuth.Persistence;
    };
    try {
      auth = FirebaseAuth.initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    } catch {
      auth = FirebaseAuth.getAuth(app); // already initialised (fast refresh)
    }
  }
  db = getFirestore(app);
}

export { auth, db };
