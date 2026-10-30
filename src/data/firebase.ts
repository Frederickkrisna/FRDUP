/**
 * Firebase web client (modular SDK).
 *  - Firestore with persistent IndexedDB cache shared across tabs (offline-first).
 *  - Anonymous Auth, invisible to the user. `hostId === auth uid`.
 * Config comes from VITE_* variables (public client identifiers, not secrets).
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  type Auth,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

import { logger } from '@/core/utils/logger';

export class FirebaseConfigError extends Error {
  constructor(readonly missing: string[]) {
    super(`Missing Firebase config: ${missing.join(', ')}`);
    this.name = 'FirebaseConfigError';
  }
}

const REQUIRED = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

export const useEmulator = import.meta.env.VITE_USE_EMULATOR === '1';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
/** True when IndexedDB persistence could not be enabled (e.g. some private modes). */
export let persistenceDegraded = false;

function readConfig() {
  const env = import.meta.env;
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length > 0) throw new FirebaseConfigError([...missing]);
  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
}

/** Idempotent. Throws FirebaseConfigError when `.env.local` is not filled in. */
export function initFirebase(): { app: FirebaseApp; db: Firestore; auth: Auth } {
  if (app && db && auth) return { app, db, auth };

  app = getApps()[0] ?? initializeApp(readConfig());
  auth = getAuth(app);

  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
  } catch (error) {
    logger.warn('Persistent Firestore cache unavailable, falling back to memory', error);
    persistenceDegraded = true;
    db = initializeFirestore(app, { localCache: memoryLocalCache(), ignoreUndefinedProperties: true });
  }

  if (useEmulator) {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  }
  return { app, db, auth };
}

export function getDb(): Firestore {
  return initFirebase().db;
}

export function getFirebaseAuth(): Auth {
  return initFirebase().auth;
}

/**
 * Checks for an existing signed-in Firebase user (persisted across sessions).
 * Returns null if not signed in so user can enter username & password.
 */
export async function ensureSignedIn(): Promise<string | null> {
  const a = getFirebaseAuth();
  await a.authStateReady();
  if (a.currentUser && !a.currentUser.isAnonymous) return a.currentUser.uid;
  return null;
}

/**
 * Sign in using username (e.g. 'fred') and password (e.g. 'asdasd').
 * Automatically appends @frdup.app if needed and creates the account if missing.
 */
export async function signInWithCredentials(username: string, pass: string): Promise<string> {
  const a = getFirebaseAuth();
  const cleanUser = username.trim().toLowerCase();
  const email = cleanUser.includes('@') ? cleanUser : `${cleanUser}@frdup.app`;
  try {
    const cred = await signInWithEmailAndPassword(a, email, pass);
    return cred.user.uid;
  } catch (err: unknown) {
    const firebaseErr = err as { code?: string };
    if (firebaseErr?.code === 'auth/user-not-found' || firebaseErr?.code === 'auth/invalid-credential') {
      try {
        const cred = await createUserWithEmailAndPassword(a, email, pass);
        return cred.user.uid;
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

/** Signs out the current user on this device. */
export async function signOutDevice(): Promise<void> {
  await getFirebaseAuth().signOut();
}

export function currentUid(): string | null {
  return getFirebaseAuth().currentUser?.uid ?? null;
}
