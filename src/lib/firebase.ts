// src/lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, doc } from "firebase/firestore";

/**
 * Lê as variáveis do ambiente (Vercel/Vite)
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Evita inicializar duas vezes em hot reload
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Firestore
export const db = getFirestore(app);

/**
 * Coleção de tasks por workspace + dia
 * Estrutura: workspaces/{ws}/days/{yyyy-mm-dd}/tasks/*
 */
export function tasksCollection(workspaceId: string, ymd: string) {
  const ws = doc(collection(db, "workspaces"), workspaceId);
  const days = collection(ws, "days");
  const dayDoc = doc(days, ymd);
  return collection(dayDoc, "tasks");
}

/**
 * Documento onde guardamos configurações do workspace
 * (por ex.: lista de operações)
 * Caminho: workspaces/{ws}/meta/settings
 */
export function workspaceSettingsRef(workspaceId: string) {
  const ws = doc(collection(db, "workspaces"), workspaceId);
  const meta = collection(ws, "meta");
  return doc(meta, "settings");
}
