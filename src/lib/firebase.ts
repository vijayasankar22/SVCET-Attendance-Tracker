
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

let db: Firestore;

if (getApps().length === 0) {
  const firebaseApp: FirebaseApp = initializeApp(firebaseConfig);
  db = getFirestore(firebaseApp);
} else {
  const firebaseApp: FirebaseApp = getApp();
  db = getFirestore(firebaseApp);
}

export { db };
