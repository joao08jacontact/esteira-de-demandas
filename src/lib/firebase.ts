// src/lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  collectionGroup,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  query,
  where,
} from "firebase/firestore";

// Variáveis de ambiente (Vite)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Evita duplicar app no hot reload
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getFirestore(app);

// helpers de caminho
export const tasksCollection = (workspaceId: string, ymd: string) =>
  collection(db, "workspaces", workspaceId, "days", ymd, "tasks");

export const tasksCollectionGroup = () => collectionGroup(db, "tasks");

export const configDoc = (workspaceId: string) =>
  doc(db, "workspaces", workspaceId, "config", "meta");

// cria config se não existir
export async function ensureWorkspaceConfig(workspaceId: string) {
  const cdoc = configDoc(workspaceId);
  const snap = await getDoc(cdoc);
  if (!snap.exists()) {
    await setDoc(cdoc, {
      operations: ["FMU", "COGNA"],
      createdAt: new Date(),
    });
  }
}

// adiciona operação ao array (sem duplicar)
export async function addOperation(workspaceId: string, name: string) {
  const cdoc = configDoc(workspaceId);
  const snap = await getDoc(cdoc);
  if (!snap.exists()) {
    await setDoc(cdoc, { operations: [name] });
    return [name];
    }
  const data = snap.data() as { operations?: string[] };
  const ops = Array.from(new Set([...(data.operations ?? []), name])).sort();
  await updateDoc(cdoc, { operations: ops });
  return ops;
}

// salva uma única ocorrência (um dia)
export async function saveOccurrence(
  workspaceId: string,
  ymd: string,
  payload: any
) {
  await addDoc(tasksCollection(workspaceId, ymd), {
    ...payload,
    workspace: workspaceId, // para queries cross-coleção
    createdAt: new Date(),
  });
}

// remove uma ocorrência pelo caminho
export async function removeOccurrenceByPath(docPath: string) {
  await deleteDoc(doc(db, docPath));
}

// remove todas as ocorrências com mesmo seriesId para um workspace
export async function removeWholeSeries(
  workspaceId: string,
  seriesId: string
) {
  const q = query(
    tasksCollectionGroup(),
    where("workspace", "==", workspaceId),
    where("seriesId", "==", seriesId)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
