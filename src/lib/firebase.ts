// src/lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, doc } from "firebase/firestore";

// Lê as variáveis da Vercel/Vite
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

// Helpers para coleção por workspace e dia (estrutura simples)
export function tasksCollection(workspaceId: string, ymd: string) {
  // workspaces/{ws}/days/{yyyy-mm-dd}/tasks/*
  return collection(doc(collection(db, "workspaces"), workspaceId), "days", ymd, "tasks");
}
