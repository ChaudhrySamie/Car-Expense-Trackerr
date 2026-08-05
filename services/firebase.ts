import Constants from 'expo-constants';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import 'firebase/compat/messaging';

const loadFirebaseConfig = () => {
  try {
    // Try loading a local config file (services/firebaseConfig.ts). This file should be gitignored.
    // Create it by copying services/firebaseConfig.example.ts and filling your real values.
    return require('./firebaseConfig').default;
  } catch (e) {
    const expoExtra = (Constants.manifest?.extra || Constants.expoConfig?.extra) || {};
    return {
      apiKey: process.env.FIREBASE_API_KEY || expoExtra.FIREBASE_API_KEY || '',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || expoExtra.FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.FIREBASE_PROJECT_ID || expoExtra.FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || expoExtra.FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || expoExtra.FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.FIREBASE_APP_ID || expoExtra.FIREBASE_APP_ID || '',
    };
  }
};

const firebaseConfig = loadFirebaseConfig();

const validateFirebaseConfig = (config: Record<string, string>) => {
  const missingKeys = Object.entries(config)
    .filter(([, value]) => !value || value.trim() === '')
    .map(([key]) => key);

  if (missingKeys.length) {
    throw new Error(
      `Firebase configuration is incomplete. Missing keys: ${missingKeys.join(', ')}. ` +
      `Create services/firebaseConfig.ts from services/firebaseConfig.example.ts, ` +
      `or set these values in your Expo app manifest extra / runtime environment.`
    );
  }
};

validateFirebaseConfig(firebaseConfig);

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

export { auth, db, storage };
export default firebase;
