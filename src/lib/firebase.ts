// src/lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, doc } from "firebase/firestore";

// Lê as variáveis definidas na Vercel (.env)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Evita inicializar duas vezes
const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

// Firestore
export const db = getFirestore(app);

// Coleção de tarefas do DIA: /workspaces/{ws}/days/{yyyy-mm-dd}/tasks/*
export function tasksCollection(workspaceId: string, ymd: string) {
  return collection(doc(collection(db, "workspaces"), workspaceId), "days", ymd, "tasks");
}

// Coleção de modelos recorrentes: /workspaces/{ws}/templates/*
export function templatesCollection(workspaceId: string) {
  return collection(doc(collection(db, "workspaces"), workspaceId), "templates");
}
