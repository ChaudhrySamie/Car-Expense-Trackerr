import Constants from 'expo-constants';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

const loadFirebaseConfig = () => {
  const expoExtra = (Constants.manifest?.extra || Constants.expoConfig?.extra) || {};
  const manifestConfig = expoExtra.firebase || {};

  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || manifestConfig.apiKey || '',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || manifestConfig.authDomain || '',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || manifestConfig.projectId || '',
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || manifestConfig.storageBucket || '',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || manifestConfig.messagingSenderId || '',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || manifestConfig.appId || '',
  };
};

const firebaseConfig = loadFirebaseConfig();

// Safe to leave temporarily while diagnosing release builds: it logs only
// whether each value exists, never the Firebase configuration itself.
console.info('[Firebase] configuration presence', {
  apiKey: Boolean(firebaseConfig.apiKey),
  authDomain: Boolean(firebaseConfig.authDomain),
  projectId: Boolean(firebaseConfig.projectId),
  storageBucket: Boolean(firebaseConfig.storageBucket),
  messagingSenderId: Boolean(firebaseConfig.messagingSenderId),
  appId: Boolean(firebaseConfig.appId),
});

const validateFirebaseConfig = (config: Record<string, string>) => {
  const missingKeys = Object.entries(config)
    .filter(([, value]) => !value || value.trim() === '')
    .map(([key]) => key);

  if (missingKeys.length) {
    throw new Error(
      `Firebase configuration is incomplete. Missing keys: ${missingKeys.join(', ')}. ` +
      `Set EXPO_PUBLIC_FIREBASE_* values or configure expo.extra.firebase in app.json.`
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
