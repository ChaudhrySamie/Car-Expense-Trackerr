import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAYran1D1dEXlPd5Z7Ff-KUOsR9YmlYgDY",
  authDomain: "car-expense-tracker-6b0b2.firebaseapp.com",
  projectId: "car-expense-tracker-6b0b2",
  storageBucket: "car-expense-tracker-6b0b2.firebasestorage.app",
  messagingSenderId: "122623897969",
  appId: "1:122623897969:web:122501e4a48f3c29c146d0",
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

export { auth, db, storage };
export default firebase;
