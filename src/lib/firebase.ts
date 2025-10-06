// src/lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  collectionGroup,
  doc,
} from "firebase/firestore";

// Lê as envs definidas na Vercel
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

// Inicializa 1x (evita duplicidade no HMR)
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Caminhos helpers
export const workspaceDoc = (ws: string) => doc(db, "workspaces", ws);
export const dayDoc = (ws: string, ymd: string) =>
  doc(db, "workspaces", ws, "days", ymd);
export const tasksCollection = (ws: string, ymd: string) =>
  collection(db, "workspaces", ws, "days", ymd, "tasks");

// Settings (operações salvas)
export const settingsDoc = (ws: string) =>
  doc(db, "workspaces", ws, "meta", "settings");

// Group query (todas as tasks de todos os dias)
export const tasksCollectionGroup = () => collectionGroup(db, "tasks");
