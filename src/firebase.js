import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue, remove } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ── Database helpers ──────────────────────────────────────────

const ROOT = "dublin-hunt";

export function dbRef(path) {
  return ref(db, `${ROOT}/${path}`);
}

export async function dbGet(path) {
  const snap = await get(dbRef(path));
  return snap.exists() ? snap.val() : null;
}

export async function dbSet(path, value) {
  await set(dbRef(path), value);
}

export async function dbRemove(path) {
  await remove(dbRef(path));
}

export function dbListen(path, callback) {
  return onValue(dbRef(path), (snap) => {
    callback(snap.exists() ? snap.val() : null);
  });
}

export { db };
