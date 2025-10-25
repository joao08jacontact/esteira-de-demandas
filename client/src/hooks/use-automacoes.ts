import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  doc,
  addDoc, 
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  deleteDoc
} from "firebase/firestore";
import type { Automacao, InsertAutomacao } from "@shared/schema";

export function useAutomacoes() {
  const [automacoes, setAutomacoes] = useState<Automacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    
    const automacoesCollection = collection(db, "automacoes");
    
    // Real-time listener for automações
    const unsubscribe = onSnapshot(
      query(automacoesCollection),
      (snapshot) => {
        try {
          const automacoesData = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate() ?? new Date(),
            } as Automacao;
          });
          
          setAutomacoes(automacoesData);
          setLoading(false);
        } catch (err) {
          setError(err as Error);
          setLoading(false);
        }
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { automacoes, loading, error };
}

export async function createAutomacao(data: InsertAutomacao): Promise<string> {
  const automacoesCollection = collection(db, "automacoes");
  
  const docRef = await addDoc(automacoesCollection, {
    nomeIntegracao: data.nomeIntegracao,
    recorrencia: data.recorrencia,
    dataHora: data.dataHora,
    repetirUmaHora: data.repetirUmaHora ?? false,
    nomeExecutavel: data.nomeExecutavel,
    pastaFimAtualizacao: data.pastaFimAtualizacao,
    createdAt: serverTimestamp(),
  });
  
  return docRef.id;
}

export async function deleteAutomacao(id: string): Promise<void> {
  const docRef = doc(db, "automacoes", id);
  await deleteDoc(docRef);
}
