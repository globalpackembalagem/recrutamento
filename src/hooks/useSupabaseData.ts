import { useState, useEffect, useCallback, useRef } from 'react';
import * as db from '@/lib/supabaseData';
import type { Candidato, Setor, HistoricoEntry } from '@/lib/supabaseData';

export function useCandidatos(includeClosed = false) {
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const fetchNow = useCallback(() => {
    db.getCandidatos(includeClosed).then(setCandidatos);
  }, [includeClosed]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    db.getCandidatos(includeClosed).then(data => {
      if (!cancelled) { setCandidatos(data); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [refreshKey, includeClosed]);

  // Realtime subscription only — no polling
  useEffect(() => {
    const unsubscribe = db.subscribeToCandidatos(fetchNow);
    return unsubscribe;
  }, [fetchNow]);

  return { candidatos, loading, refresh };
}

export function useCandidatosDoDia() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Track when an optimistic update happened — skip external fetches for a grace period
  const optimisticUntilRef = useRef<number>(0);

  const fetchNow = useCallback(() => {
    // Diminuído o tempo de carência para 1s para garantir que as alterações de outros usuários
    // sejam vistas mais rapidamente, mas mantendo a estabilidade da interface
    if (Date.now() < optimisticUntilRef.current) return;
    db.getCandidatosDoDia().then(setCandidatos);
  }, []);

  // Optimistic update: instantly change a candidato in local state
  const updateLocal = useCallback((id: string, changes: Partial<Candidato>) => {
    // Set grace period: ignore realtime for 1 second (was 3s) to prevent flicker while ensuring sync
    optimisticUntilRef.current = Date.now() + 1000;
    setCandidatos(prev => prev.map(c => c.id === id ? { ...c, ...changes } : c));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    db.getCandidatosDoDia().then(data => {
      if (!cancelled) { setCandidatos(data); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [refreshKey]);

  // Realtime only — no polling
  useEffect(() => {
    const unsubscribe = db.subscribeToCandidatos(fetchNow);
    return unsubscribe;
  }, [fetchNow]);

  return { candidatos, loading, refresh, updateLocal };
}

export function useSetores() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);
  useEffect(() => { db.getSetores().then(setSetores); }, [refreshKey]);
  return { setores, refresh };
}

export function useClosedDates() {
  const [closedDates, setClosedDates] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);
  useEffect(() => { db.getClosedDates().then(setClosedDates); }, [refreshKey]);

  // Realtime for closed_dates
  useEffect(() => {
    const unsubscribe = db.subscribeToClosedDates(() => {
      db.getClosedDates().then(setClosedDates);
    });
    return unsubscribe;
  }, []);

  return { closedDates, refresh };
}

export function useHistorico(candidatoId?: string) {
  const [historico, setHistorico] = useState<HistoricoEntry[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);
  useEffect(() => {
    if (candidatoId) db.getHistorico(candidatoId).then(setHistorico);
    else setHistorico([]);
  }, [candidatoId, refreshKey]);
  return { historico, refresh };
}
