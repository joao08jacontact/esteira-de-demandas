import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  doc,
  addDoc, 
  updateDoc, 
  getDocs,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  setDoc,
  deleteDoc
} from "firebase/firestore";
import type { BiWithBases, InsertBi, BaseOrigem } from "@shared/schema";

export function useBis() {
  const [bis, setBis] = useState<BiWithBases[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    console.log("[useBis] Initializing Firestore listener...");
    
    const bisCollection = collection(db, "bis");
    
    // Real-time listener for BIs
    const unsubscribe = onSnapshot(
      query(bisCollection),
      async (snapshot) => {
        try {
          console.log(`[useBis] Received ${snapshot.docs.length} BIs from Firestore`);
          
          const bisData = await Promise.all(
            snapshot.docs.map(async (biDoc) => {
              const biData = biDoc.data();
              console.log(`[useBis] Processing BI ${biDoc.id}:`, biData);
              
              // Fetch bases subcollection
              const basesSnapshot = await getDocs(
                collection(db, "bis", biDoc.id, "bases")
              );
              
              console.log(`[useBis] BI ${biDoc.id} has ${basesSnapshot.docs.length} bases`);
              
              const bases: BaseOrigem[] = basesSnapshot.docs.map((baseDoc) => ({
                id: baseDoc.id,
                biId: biDoc.id,
                ...baseDoc.data(),
              } as BaseOrigem));
              
              return {
                id: biDoc.id,
                ...biData,
                createdAt: biData.createdAt?.toDate() ?? new Date(),
                bases,
              } as BiWithBases;
            })
          );
          
          console.log("[useBis] Final BIs data:", bisData);
          setBis(bisData);
          setLoading(false);
        } catch (err) {
          console.error("[useBis] Error processing BIs:", err);
          setError(err as Error);
          setLoading(false);
        }
      },
      (err) => {
        console.error("[useBis] Firestore listener error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      console.log("[useBis] Cleaning up listener");
      unsubscribe();
    };
  }, []);

  return { bis, loading, error };
}

export async function createBi(data: { 
  bi: InsertBi; 
  bases: Omit<InsertBi & { nomeFerramenta: string; pastaOrigem: string; temApi: boolean }, "nome" | "dataInicio" | "dataFinal" | "responsavel" | "operacao">[] 
}): Promise<string> {
  const bisCollection = collection(db, "bis");
  
  const biDocRef = await addDoc(bisCollection, {
    nome: data.bi.nome,
    dataInicio: data.bi.dataInicio,
    dataFinal: data.bi.dataFinal,
    responsavel: data.bi.responsavel,
    operacao: data.bi.operacao,
    status: "em_aberto",
    inativo: false,
    createdAt: serverTimestamp(),
  });
  
  // Create bases subcollection
  const basesCollection = collection(db, "bis", biDocRef.id, "bases");
  
  for (const base of data.bases) {
    await addDoc(basesCollection, {
      biId: biDocRef.id,
      nomeFerramenta: base.nomeFerramenta,
      pastaOrigem: base.pastaOrigem,
      temApi: base.temApi ?? false,
      status: "aguardando",
      observacao: null,
    });
  }
  
  return biDocRef.id;
}

export async function updateBaseStatus(
  biId: string,
  baseId: string,
  status: string,
  observacao?: string
): Promise<void> {
  const baseRef = doc(db, "bis", biId, "bases", baseId);
  
  await updateDoc(baseRef, {
    status,
    observacao: observacao ?? null,
  });
  
  // Check if all bases are completed
  const basesSnapshot = await getDocs(collection(db, "bis", biId, "bases"));
  const allCompleted = basesSnapshot.docs.every(
    (doc) => doc.data().status === "concluido"
  );
  
  if (allCompleted && basesSnapshot.docs.length > 0) {
    const biRef = doc(db, "bis", biId);
    await updateDoc(biRef, {
      status: "concluido",
    });
  }
}

export async function updateBiInativo(biId: string, inativo: boolean): Promise<void> {
  const biRef = doc(db, "bis", biId);
  await updateDoc(biRef, {
    inativo,
  });
}

// Canvas operations
export async function getCanvas(): Promise<{ nodes: any[]; edges: any[] }> {
  const nodesSnapshot = await getDocs(collection(db, "canvas_nodes"));
  const edgesSnapshot = await getDocs(collection(db, "canvas_edges"));
  
  const nodes = nodesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  
  const edges = edgesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  
  return { nodes, edges };
}

export async function saveCanvas(data: { nodes: any[]; edges: any[] }): Promise<void> {
  // Delete existing nodes and edges
  const [nodesSnapshot, edgesSnapshot] = await Promise.all([
    getDocs(collection(db, "canvas_nodes")),
    getDocs(collection(db, "canvas_edges")),
  ]);
  
  await Promise.all([
    ...nodesSnapshot.docs.map((doc) => deleteDoc(doc.ref)),
    ...edgesSnapshot.docs.map((doc) => deleteDoc(doc.ref)),
  ]);
  
  // Add new nodes
  await Promise.all(
    data.nodes.map((node) =>
      setDoc(doc(db, "canvas_nodes", node.id), {
        type: node.type,
        positionX: node.positionX,
        positionY: node.positionY,
        data: node.data,
        width: node.width ?? null,
        height: node.height ?? null,
      })
    )
  );
  
  // Add new edges
  await Promise.all(
    data.edges.map((edge) =>
      setDoc(doc(db, "canvas_edges", edge.id), {
        source: edge.source,
        target: edge.target,
        type: edge.type,
        animated: edge.animated,
      })
    )
  );
}
