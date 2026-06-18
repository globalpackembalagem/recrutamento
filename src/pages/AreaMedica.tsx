import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { useCandidatosDoDia, useCandidatos, useClosedDates } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import * as db from "@/lib/supabaseData";
import { getHojeBR } from "@/lib/supabaseData";
import ResultadoView from "@/components/ResultadoView";
import PasswordGate from "@/components/PasswordGate";
import type { Candidato } from "@/lib/supabaseData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Stethoscope, Users, CheckCircle2, PlayCircle, Monitor, Lock, XCircle, ListChecks, Volume2, Link, GripVertical, Pause, Play, FileSpreadsheet, Clock, ChevronDown, ChevronRight } from "lucide-react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn, formatIndicacao, parseOrigem } from "@/lib/utils";

const DiretoBadge = ({ indicacao }: { indicacao?: string }) => {
  const { origem } = parseOrigem(indicacao);
  if (origem !== "direto") return null;
  return (
    <span className="text-[8px] font-extrabold px-1 py-0 rounded bg-green-100 text-green-700 border border-green-300 shrink-0" title="DIRETO">D</span>
  );
};
import { Textarea } from "@/components/ui/textarea";
import { getUsuarios, type Usuario } from "@/lib/usuarioData";
import { getEspecialistasDoDiaConfig } from "@/pages/Especialistas";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

interface ProfissionalCadastro {
  nome: string;
  especialidade: string;
  sala: string;
  aprovar: boolean;
  painel: boolean;
}

// --- Observacoes helpers ---
interface Resultado {
  nome: string;
  decisao: string; // "aprovado" | "reprovado"
  motivo?: string;
}

function getResultados(c: Candidato): Resultado[] {
  if (!c.observacoes) return [];
  return c.observacoes.split('|')
    .filter(p => p.startsWith('resultado:'))
    .map(p => {
      const parts = p.split(':');
      return {
        nome: parts[1] || '',
        decisao: parts[2] || '',
        motivo: parts.slice(3).join(':') || undefined,
      };
    });
}

function getAtendente(c: Candidato): string | null {
  const match = c.observacoes?.match(/atendente:([^|]+)/);
  return match ? match[1].trim() : null;
}

function getHorasAtendimento(c: Candidato): Record<string, string> {
  if (!c.observacoes) return {};
  const result: Record<string, string> = {};
  c.observacoes.split('|')
    .filter(p => p.startsWith('hora_atend:'))
    .forEach(p => {
      const parts = p.split(':');
      // hora_atend:ProfName:HH:MM
      const nome = parts[1] || '';
      const hora = parts.slice(2).join(':') || '';
      if (nome) result[nome.toLowerCase()] = hora;
    });
  return result;
}

function buildObservacoes(resultados: Resultado[], atendente?: string, horasAtend?: Record<string, string>, ordem?: number | null, horasFimAtend?: Record<string, string>, ordensPorEspec?: Record<string, number>): string {
  const parts = resultados.map(r => {
    let s = `resultado:${r.nome}:${r.decisao}`;
    if (r.motivo) s += `:${r.motivo}`;
    return s;
  });
  if (horasAtend) {
    for (const [nome, hora] of Object.entries(horasAtend)) {
      parts.push(`hora_atend:${nome}:${hora}`);
    }
  }
  if (horasFimAtend) {
    for (const [nome, hora] of Object.entries(horasFimAtend)) {
      parts.push(`hora_fim:${nome}:${hora}`);
    }
  }
  if (ordensPorEspec) {
    for (const [espec, val] of Object.entries(ordensPorEspec)) {
      parts.push(`ordem_espec:${espec}:${val}`);
    }
  }
  if (atendente) parts.push(`atendente:${atendente}`);
  if (ordem !== undefined && ordem !== null) parts.push(`ordem:${ordem}`);
  return parts.join('|');
}

function preserveHorasFromObs(obs: string | null): Record<string, string> {
  if (!obs) return {};
  const result: Record<string, string> = {};
  obs.split('|')
    .filter(p => p.startsWith('hora_atend:'))
    .forEach(p => {
      const parts = p.split(':');
      const nome = parts[1] || '';
      const hora = parts.slice(2).join(':') || '';
      if (nome) result[nome] = hora;
    });
  return result;
}

function preserveHorasFimFromObs(obs: string | null): Record<string, string> {
  if (!obs) return {};
  const result: Record<string, string> = {};
  obs.split('|')
    .filter(p => p.startsWith('hora_fim:'))
    .forEach(p => {
      const parts = p.split(':');
      const nome = parts[1] || '';
      const hora = parts.slice(2).join(':') || '';
      if (nome) result[nome] = hora;
    });
  return result;
}

function preserveOrdensEspecFromObs(obs: string | null): Record<string, number> {
  if (!obs) return {};
  const result: Record<string, number> = {};
  obs.split('|')
    .filter(p => p.startsWith('ordem_espec:'))
    .forEach(p => {
      const parts = p.split(':');
      const espec = parts[1] || '';
      const val = Number(parts[2]);
      if (espec && !isNaN(val)) result[espec.toLowerCase()] = val;
    });
  return result;
}

function getOrdem(c: Candidato): number | null {
  const m = c.observacoes?.match(/(?:^|\|)ordem:(-?\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

function setOrdemEspecInObs(obs: string | null | undefined, espec: string, ordem: number | null): string {
  const lowerEspec = espec.toLowerCase().trim();
  const parts = (obs || '').split('|').filter(p => p && !p.startsWith(`ordem_espec:${lowerEspec}:`));
  if (ordem !== null) parts.push(`ordem_espec:${lowerEspec}:${ordem}`);
  return parts.join('|');
}

function setOrdemInObs(obs: string | null | undefined, ordem: number | null): string {
  const parts = (obs || '').split('|').filter(p => p && !p.startsWith('ordem:'));
  if (ordem !== null) parts.push(`ordem:${ordem}`);
  return parts.join('|');
}

function sortByPriority(list: Candidato[], profNome?: string, medicoOrderBySilvana = false): Candidato[] {
  const lowerProf = profNome?.toLowerCase().trim();
  return [...list].sort((a, b) => {
    // 0. Ordem manual específica do especialista/coluna
    if (lowerProf) {
      const ordensA = preserveOrdensEspecFromObs(a.observacoes);
      const ordensB = preserveOrdensEspecFromObs(b.observacoes);
      const oaE = ordensA[lowerProf];
      const obE = ordensB[lowerProf];
      if (oaE !== undefined && obE !== undefined && oaE !== obE) return oaE - obE;
      if (oaE !== undefined && obE === undefined) return -1;
      if (oaE === undefined && obE !== undefined) return 1;
    }

    // 0.5. Para coluna de médico: respeita a ordem em que a Silvana atendeu (hora_atend:silvana)
    if (medicoOrderBySilvana) {
      const horasA = getHorasAtendimento(a);
      const horasB = getHorasAtendimento(b);
      const ha = horasA["silvana"];
      const hb = horasB["silvana"];
      if (ha && hb && ha !== hb) return ha.localeCompare(hb);
      if (ha && !hb) return -1;
      if (!ha && hb) return 1;
    }

    // 1. Ordem global antiga apenas como fallback
    const oa = getOrdem(a);
    const ob = getOrdem(b);
    if (oa !== null && ob !== null && oa !== ob) return oa - ob;
    if (oa !== null && ob === null) return -1;
    if (oa === null && ob !== null) return 1;

    // 2. Fretado: Várzea A ou B primeiro
    const aVarzea = a.fretado && /v[aá]rzea\s*[ab]/i.test(a.fretado);
    const bVarzea = b.fretado && /v[aá]rzea\s*[ab]/i.test(b.fretado);
    if (aVarzea && !bVarzea) return -1;
    if (!aVarzea && bVarzea) return 1;

    // 3. Outros Fretados (Louveira, Campinas, etc.)
    const aFretado = !!a.fretado;
    const bFretado = !!b.fretado;
    if (aFretado && !bFretado) return -1;
    if (!aFretado && bFretado) return 1;

    // 4. Ordem alfabética como critério final
    return a.nome.localeCompare(b.nome);
  });
}


const PAUSADOS_KEY = "especialistas_pausados";
function getTodayKey() { return new Date().toISOString().split("T")[0]; }
function loadPausados(): string[] {
  try {
    const raw = localStorage.getItem(PAUSADOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (parsed.date !== getTodayKey()) return [];
    return parsed.nomes || [];
  } catch { return []; }
}
function savePausados(nomes: string[]) {
  localStorage.setItem(PAUSADOS_KEY, JSON.stringify({ date: getTodayKey(), nomes }));
  window.dispatchEvent(new CustomEvent("especialistas-pausados-updated"));
}

export default function AreaMedica() {
  const location = useLocation();
  const isDiario = location.pathname === "/atendimento-diario/atendimento";
  const { candidatos: allCandidatos, loading, refresh, updateLocal } = useCandidatosDoDia();
  const { usuario, usuarioReal, impersonar } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const atendimentoView = (searchParams.get("view") === "resultado" && !isDiario) ? "resultado" : "atendimento";
  const [cadastro, setCadastro] = useState<ProfissionalCadastro[]>([]);
  const [allUsers, setAllUsers] = useState<Usuario[]>([]);
  useEffect(() => {
    const loadCadastro = () => {
      // Use getUsuarios (all users) so an active specialist isn't filtered out
      // just because their acesso_atendimento flag is off in the DB.
      getUsuarios().then(users => {
        setAllUsers(users);
        const doDiaConfig = getEspecialistasDoDiaConfig();
        
        // Inclui profissionais que estão ATENDENDO no momento, mesmo que marcados como inativos ou fora dos do dia
        const attendingNames = allCandidatos
          .filter(c => c.status === "em_atendimento")
          .map(c => getAtendente(c)?.toLowerCase())
          .filter(Boolean) as string[];

        const filtered = users.filter(u => {
          const configDoDia = doDiaConfig?.find(e =>
            e.nomeOriginal?.toLowerCase() === u.nome.toLowerCase() || e.nome.toLowerCase() === u.nome.toLowerCase()
          );
          const isAtivo = u.ativo;
          const isDoDia = doDiaConfig ? Boolean(configDoDia && configDoDia.ativo) : u.acessoAtendimento;
          const isAttendingNow = attendingNames.includes(u.nome.toLowerCase());
          
          const showInPanel = doDiaConfig ? (configDoDia?.painel ?? u.acessoAtendimento) : u.acessoAtendimento;

          return isAtivo ? ((isDoDia && showInPanel) || isAttendingNow) : isAttendingNow;
        });
        setCadastro(filtered.map(u => {
          const configDoDia = doDiaConfig?.find(e =>
            e.nomeOriginal?.toLowerCase() === u.nome.toLowerCase() || e.nome.toLowerCase() === u.nome.toLowerCase()
          );
          return {
            nome: u.nome,
            especialidade: u.especialidade || '',
            sala: u.sala || '',
            aprovar: configDoDia ? configDoDia.aprovar : u.acessoAprovar,
            painel: configDoDia ? configDoDia.painel : u.acessoAtendimento,
          };
        }));
      });
    };
    loadCadastro();
    const onUpdate = () => loadCadastro();
    window.addEventListener("especialistas-do-dia-updated", onUpdate);
    window.addEventListener("usuarios-updated", onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.removeEventListener("especialistas-do-dia-updated", onUpdate);
      window.removeEventListener("usuarios-updated", onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, [allCandidatos]);

  const { closedDates } = useClosedDates();
  const candidatosMedicos = useMemo(() => {
    return allCandidatos.filter(c =>
      ["presente", "na_fila_atendimento", "em_atendimento", "atendido", "aprovado", "reprovado"].includes(c.status)
      && (!c.dataIntegracao || !closedDates.includes(c.dataIntegracao))
    );
  }, [allCandidatos, closedDates]);

  // --- Cadeado por especialidade (Luciano) ---
  const cadeadoKey = (candidatoId: string, profNome: string) => `CADEADO:${candidatoId}:${profNome.toLowerCase().trim()}`;
  const isCadeado = useCallback((candidatoId: string, profNome: string) => {
    return closedDates.includes(cadeadoKey(candidatoId, profNome));
  }, [closedDates]);
  const getCadeadoIdInColumn = useCallback((profNome: string): string | null => {
    const lower = profNome.toLowerCase().trim();
    const found = closedDates.find(d => {
      if (!d.startsWith('CADEADO:')) return false;
      const parts = d.split(':');
      return (parts[2] || '').toLowerCase() === lower;
    });
    if (!found) return null;
    return found.split(':')[1] || null;
  }, [closedDates]);
  const toggleCadeado = useCallback(async (candidatoId: string, profNome: string) => {
    const key = cadeadoKey(candidatoId, profNome);
    const existingId = getCadeadoIdInColumn(profNome);
    if (existingId && existingId !== candidatoId) {
      await supabase.from('closed_dates').delete().eq('date', cadeadoKey(existingId, profNome));
    }
    if (isCadeado(candidatoId, profNome)) {
      await supabase.from('closed_dates').delete().eq('date', key);
      toast.success(`Cadeado removido de ${profNome}`);
    } else {
      await supabase.from('closed_dates').upsert({ date: key }, { onConflict: 'date' });
      toast.success(`Cadeado aplicado em ${profNome}`);
    }
  }, [isCadeado, getCadeadoIdInColumn]);

  const totalAtendidos = useMemo(() => candidatosMedicos.filter(c => ["atendido", "aprovado", "reprovado"].includes(c.status)).length, [candidatosMedicos]);
  const totalEmAtendimento = useMemo(() => candidatosMedicos.filter(c => c.status === "em_atendimento").length, [candidatosMedicos]);
  const totalNaFila = useMemo(() => candidatosMedicos.filter(c => c.status === "na_fila_atendimento").length, [candidatosMedicos]);

  // View toggle: atendimento vs resultado (driven by URL ?view=resultado)
  const { candidatos: allCandidatosInc } = useCandidatos(true);
  const [resultadoLiberado, setResultadoLiberado] = useState(false);
  useEffect(() => { db.isResultadoLiberado().then(setResultadoLiberado); }, []);
  useEffect(() => {
    const unsub = db.subscribeToClosedDates(() => { db.isResultadoLiberado().then(setResultadoLiberado); });
    return unsub;
  }, []);

  // Sistema de recarga forçada para todos os usuários quando houver mudanças externas
  const lastRefreshRef = useRef<number>(Date.now());
  useEffect(() => {
    const channel = supabase.channel('force-refresh')
      .on('broadcast', { event: 'force-update' }, (payload) => {
        // Evita loops infinitos e garante que o refresh só ocorra se não tivermos atualizado muito recentemente
        if (Date.now() - lastRefreshRef.current > 1500) {
          console.log("Recebido comando de atualização forçada");
          refresh();
          lastRefreshRef.current = Date.now();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  // Dialog states
  const [selectedCandidate, setSelectedCandidate] = useState<Candidato | null>(null);
  const [selectedProf, setSelectedProf] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"atender" | "encerrar" | "cancelar" | null>(null);
  const [encerrarStep, setEncerrarStep] = useState<"choose" | "reprovar" | "pre_aprovar">("choose");
  const [motivoReprovacao, setMotivoReprovacao] = useState("");

  const [showReprovedList, setShowReprovedList] = useState(false);
  const [showApprovedList, setShowApprovedList] = useState(false);
  const [showLucianoMessage, setShowLucianoMessage] = useState(false);
  const [lucianoMessage, setLucianoMessage] = useState("");
  const [expandedProfs, setExpandedProfs] = useState<string[]>([]);
  const [showSpecCols, setShowSpecCols] = useState(true);
  const canSeeTempos = !!usuario && ["luciano", "mauricio", "sonia"].includes((usuario.login || "").toLowerCase());
  const [temposMedios, setTemposMedios] = useState<Record<string, { avg: number; count: number }>>({});
  const [pendentes, setPendentes] = useState(0);
  const [atendidosHoje, setAtendidosHoje] = useState(0);

  useEffect(() => {
    if (!canSeeTempos) return;
    const cands = allCandidatosInc;
    const acc: Record<string, { total: number; count: number }> = {};
    for (const c of cands) {
      const obs = c.observacoes || "";
      const inicios: Record<string, string> = {};
      const fins: Record<string, string> = {};
      obs.split("|").forEach(p => {
        if (p.startsWith("hora_atend:")) {
          const parts = p.split(":");
          const nome = parts[1]?.toLowerCase();
          const hora = parts.slice(2).join(":");
          if (nome) inicios[nome] = hora;
        } else if (p.startsWith("hora_fim:")) {
          const parts = p.split(":");
          const nome = parts[1]?.toLowerCase();
          const hora = parts.slice(2).join(":");
          if (nome) fins[nome] = hora;
        }
      });
      for (const [nome, ini] of Object.entries(inicios)) {
        const fim = fins[nome];
        if (!fim) continue;
        const [h1, m1] = ini.split(":").map(Number);
        const [h2, m2] = fim.split(":").map(Number);
        if ([h1, m1, h2, m2].some(n => isNaN(n))) continue;
        let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (diff < 0) diff += 24 * 60;
        if (diff <= 0 || diff > 240) continue;
        if (!acc[nome]) acc[nome] = { total: 0, count: 0 };
        acc[nome].total += diff;
        acc[nome].count += 1;
      }
    }
    const out: Record<string, { avg: number; count: number }> = {};
    for (const [k, v] of Object.entries(acc)) out[k] = { avg: v.total / v.count, count: v.count };
    setTemposMedios(out);
    const pend = cands.filter(c => ["presente", "na_fila_atendimento", "em_atendimento"].includes(c.status)).length;
    const atend = cands.filter(c => ["atendido", "aprovado", "reprovado", "finalizado", "doc_ok"].includes(c.status)).length;
    setPendentes(pend);
    setAtendidosHoje(atend);
  }, [canSeeTempos, allCandidatosInc]);




  // Check if a candidate is being attended by anyone
  const isBeingAttended = useCallback((c: Candidato) => c.status === "em_atendimento", []);

  // Check if a professional already decided on a candidate
  const hasDecided = useCallback((c: Candidato, profNome: string) => {
    return getResultados(c).some(r => r.nome.toLowerCase() === profNome.toLowerCase());
  }, []);

  // Check if a professional is currently busy with someone
  const isProfBusy = useCallback((profNome: string) => {
    return candidatosMedicos.some(c =>
      c.status === "em_atendimento" && getAtendente(c)?.toLowerCase() === profNome.toLowerCase()
    );
  }, [candidatosMedicos]);

  const getCandidatoStatusForProf = useCallback((c: Candidato, profNome: string): "attending" | "decided" | "queue" | "busy" => {
    if (c.status === "em_atendimento" && getAtendente(c)?.toLowerCase() === profNome.toLowerCase()) return "attending";
    if (hasDecided(c, profNome)) return "decided";
    if (c.status === "em_atendimento") return "busy"; // busy with another prof
    return "queue"; // presente + na_fila_atendimento
  }, [hasDecided]);

  // Silvana atende primeiro: para qualquer especialista que NÃO seja a Silvana,
  // só exibir candidatos que já tenham decisão registrada pela Silvana.
  const silvanaJaAtendeu = useCallback((c: Candidato) => {
    if (isDiario) return true; // Na agenda diária não tem trava da Silvana
    return getResultados(c).some(r => r.nome.toLowerCase().trim() === "silvana");
  }, [isDiario]);

  // Enfermagem atende primeiro para Médicos: para qualquer especialista que seja MÉDICO(A),
  // só exibir candidatos que já tenham decisão registrada por alguém da ENFERMAGEM.
  const enfermagemJaAtendeu = useCallback((c: Candidato) => {
    if (isDiario) return true; // Na agenda diária não tem trava da enfermagem
    const resultados = getResultados(c);
    return resultados.some(r => {
      const prof = allUsers.find(u => u.nome.toLowerCase().trim() === r.nome.toLowerCase().trim());
      return prof?.especialidade?.toLowerCase().includes("enferm");
    });
  }, [allUsers, isDiario]);

  const [agendaDiaria, setAgendaDiaria] = useState<any[]>([]);
  useEffect(() => {
    if (isDiario) {
      const loadAgenda = () => {
        const data = JSON.parse(localStorage.getItem("agenda_diaria") || "[]");
        setAgendaDiaria(data);
      };
      loadAgenda();
      window.addEventListener("agenda-updated", loadAgenda);
      return () => window.removeEventListener("agenda-updated", loadAgenda);
    }
  }, [isDiario]);

  // Pausados (por dia, em localStorage)
  const [pausados, setPausados] = useState<string[]>(() => loadPausados());
  useEffect(() => {
    const onUpd = () => setPausados(loadPausados());
    window.addEventListener("especialistas-pausados-updated", onUpd);
    window.addEventListener("storage", onUpd);
    return () => {
      window.removeEventListener("especialistas-pausados-updated", onUpd);
      window.removeEventListener("storage", onUpd);
    };
  }, []);
  const isProfPausado = useCallback((nome: string) => pausados.some(n => n.toLowerCase() === nome.toLowerCase()), [pausados]);
  const isProfInativoNoDia = useCallback((nome: string) => {
    const config = getEspecialistasDoDiaConfig();
    const prof = config?.find(e =>
      e.nomeOriginal?.toLowerCase() === nome.toLowerCase() || e.nome.toLowerCase() === nome.toLowerCase()
    );
    return Boolean(prof && !prof.ativo);
  }, []);
  const togglePausa = (nome: string) => {
    const paused = isProfPausado(nome);
    const next = paused ? pausados.filter(n => n.toLowerCase() !== nome.toLowerCase()) : [...pausados, nome];
    savePausados(next);
    setPausados(next);
    toast.success(paused ? `${nome} reativado(a) — fila retomada` : `${nome} pausado(a) — novos candidatos não aparecerão`);
  };

  const isMasterEarly = usuario?.perfil === "admin" || ["luciano", "mauricio", "sonia"].includes(usuario?.login?.toLowerCase() || "") || usuarioReal?.perfil === "admin" || ["luciano", "mauricio", "sonia"].includes(usuarioReal?.login?.toLowerCase() || "");


  // Silvana atende primeiro para Médicos: nome só aparece para médica(o) depois que Silvana decidir
  const silvanaLiberouMedico = useCallback((c: Candidato) => {
    if (isDiario) return true;
    return silvanaJaAtendeu(c);
  }, [isDiario, silvanaJaAtendeu]);

  const isMedico = useCallback((profNome: string) => {
    const prof = allUsers.find(u => u.nome.toLowerCase().trim() === profNome.toLowerCase().trim());
    const spec = (prof?.especialidade || "").toLowerCase();
    return spec.includes("medic") || spec.includes("médic");
  }, [allUsers]);


  // Per-column sorted list: attending first, then queue (priority), then decided at bottom
  const getSortedForProf = useCallback((profNome: string, sourceList?: Candidato[]) => {
    const attending: Candidato[] = [];
    const queue: Candidato[] = [];
    const decided: Candidato[] = [];

    const lowerProf = profNome.toLowerCase().trim();
    const isSilvanaCol = lowerProf === "silvana";
    
    // Identifica se a coluna atual é de um médico
    const profAtual = allUsers.find(u => u.nome.toLowerCase().trim() === lowerProf);
    const isMedicoCol = profAtual?.especialidade?.toLowerCase().includes("medic") || profAtual?.especialidade?.toLowerCase().includes("médic");
    const specAtual = (profAtual?.especialidade || "").toUpperCase();

    // Filtra candidatos: se for diário, usa a agenda local; se for integração, usa os candidatos do banco
    const baseList = isDiario 
      ? agendaDiaria
          .filter(a => {
            // Normalização básica para comparação
            const normalizedSpecAtual = specAtual.trim().toUpperCase();
            return a.especialidades.some((s: string) => {
              const normalizedS = s.trim().toUpperCase();
              return normalizedS === normalizedSpecAtual || 
                     normalizedSpecAtual.includes(normalizedS) || 
                     normalizedS.includes(normalizedSpecAtual);
            });
          })
          .map(a => ({ id: a.id, nome: a.colaborador, status: "na_fila_atendimento", setor: "AGENDA", funcao: specAtual })) as any[]
      : (sourceList ?? candidatosMedicos);

    for (const c of baseList) {
      const s = getCandidatoStatusForProf(c, profNome);
      if (s === "attending") attending.push(c);
      else if (s === "decided") decided.push(c);
      else queue.push(c); // queue + busy
    }

    // Se a coluna está pausada/inativa no dia, ocultar a fila nova (mantém atendendo + decididos)
    if (isProfPausado(profNome) || isProfInativoNoDia(profNome)) {
      return [...attending, ...decided];
    }

    const queued = sortByPriority(queue, profNome, isMedicoCol);

    // Cadeado: candidato cadeado fica como próximo a ser atendido (topo da fila)
    const cadeadosFirst = [
      ...queued.filter(c => isCadeado(c.id, profNome)),
      ...queued.filter(c => !isCadeado(c.id, profNome)),
    ];

    return [...attending, ...cadeadosFirst, ...decided];
  }, [candidatosMedicos, getCandidatoStatusForProf, silvanaLiberouMedico, isProfPausado, isProfInativoNoDia, allUsers, isDiario, agendaDiaria, isMasterEarly, hasDecided, isCadeado]);

  const isMaster = usuario?.perfil === "admin" || ["luciano", "mauricio", "sonia"].includes(usuario?.login?.toLowerCase() || "") || usuarioReal?.perfil === "admin" || ["luciano", "mauricio", "sonia"].includes(usuarioReal?.login?.toLowerCase() || "");
  const isLucianoMauricio = ["luciano", "mauricio", "sonia"].includes(usuario?.login?.toLowerCase() || "") || ["luciano", "mauricio", "sonia"].includes(usuarioReal?.login?.toLowerCase() || "");
  const podeVerDetalheResultadoNoAtendimento = ["luciano", "mauricio", "sonia"].includes(usuario?.login?.toLowerCase() || "");


  const isMauricio = usuario?.login?.toLowerCase() === "mauricio" || usuario?.login?.toLowerCase() === "sonia";
  
  // Painel button visibility for Sonia
  const canShowPainel = isMaster || usuario?.login?.toLowerCase() === "sonia";

  // Check if RH locked changes
  const [alteracoesBloqueadas, setAlteracoesBloqueadas] = useState(false);
  useEffect(() => {
    db.isAlteracoesBloqueadas().then(setAlteracoesBloqueadas);
    const unsub = db.subscribeToClosedDates(() => { db.isAlteracoesBloqueadas().then(setAlteracoesBloqueadas); });
    return unsub;
  }, []);

  const handleClickCandidate = async (c: Candidato, profNome: string) => {
    // Only the column owner, Master, or Silvana can interact
    const isSilvana = ["silvana", "silvana mello", "silvana melo"].includes(usuario?.login?.toLowerCase() || "");
    const isMichelli = ["michelli", "michele", "micheli"].includes(usuario?.login?.toLowerCase() || "");
    const isMasterUser = usuario?.perfil === "admin" || ["luciano", "mauricio", "sonia"].includes(usuario?.login?.toLowerCase() || "");
    
    if (!isMasterUser && !isSilvana && !isMichelli && usuario?.nome?.toLowerCase() !== profNome.toLowerCase()) {
      toast.error(`Somente ${profNome} pode operar nesta coluna.`);
      return;
    }

    // If RH locked changes, block non-master users
    if (alteracoesBloqueadas && !isMaster) {
      toast.error("Alterações bloqueadas pelo RH.");
      return;
    }

    // Already decided and locked? Allow change only if not blocked
    if (hasDecided(c, profNome) && !alteracoesBloqueadas) {
      // Allow re-decision: remove old decision and re-attend
      setSelectedCandidate(c);
      setSelectedProf(profNome);
      setActionType("encerrar");
      setEncerrarStep("choose");
      setMotivoReprovacao("");
      return;
    }
    if (hasDecided(c, profNome) && alteracoesBloqueadas) return;

    // Allow starting attendance for candidates in queue (including those already decided by OTHER professionals)
    const canStartAttendance = ["presente", "na_fila_atendimento", "atendido", "aprovado", "reprovado"].includes(c.status);
    if (canStartAttendance && c.status !== "em_atendimento") {
      // Atendentes podem pular a ordem e escolher qualquer candidato da fila.
      // A ordem permanece como sugestão visual (sortByPriority), mas não é mais obrigatória.
      
      // Regra: Médico só pode atender após Silvana decidir
      if (!isMaster && isMedico(profNome) && !silvanaJaAtendeu(c)) {
        toast.error(`Aguarde a liberação da Silvana para atender ${c.nome}.`);
        return;
      }

      // Regra: Cadeado — se houver candidato com cadeado nesta coluna, só ele pode ser atendido
      const lockedId = getCadeadoIdInColumn(profNome);
      if (lockedId && lockedId !== c.id) {
        toast.error(`Há um candidato com cadeado em ${profNome}. Atenda-o primeiro.`);
        return;
      }

      if (isProfBusy(profNome)) {
        toast.error(`${profNome} já está atendendo. Encerre o atendimento atual primeiro.`);
        return;
      }

      if (isBeingAttended(c)) {
        toast.error(`${c.nome} já está em atendimento com ${getAtendente(c)}.`);
        return;
      }
      setSelectedCandidate(c);
      setSelectedProf(profNome);
      setActionType("atender");
    } else if (c.status === "em_atendimento" && getAtendente(c)?.toLowerCase() === profNome.toLowerCase()) {
        setSelectedCandidate(c);
        setSelectedProf(profNome);
        setActionType("encerrar");
        setEncerrarStep("choose");
        
        // Auto-fill reason if already rejected by others
        const results = getResultados(c);
        const rejected = results.filter(r => r.decisao === "reprovado" && r.motivo);
        if (rejected.length > 0) {
          const combinedReasons = rejected.map(r => `${r.nome}: ${r.motivo}`).join("; ");
          setMotivoReprovacao(combinedReasons);
        } else {
          setMotivoReprovacao("");
        }
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !isMaster) return;

    const { draggableId, destination, source } = result;
    const [candidatoId, currentProf] = draggableId.split("::");
    const targetProf = destination.droppableId;

      // Same column → reorder apenas este especialista/coluna
    if (currentProf === targetProf) {
      if (source.index === destination.index) return;

      const fresh = (await db.getCandidatosDoDia()).filter(cand =>
        ["presente", "na_fila_atendimento", "em_atendimento", "atendido", "aprovado", "reprovado"].includes(cand.status)
      );
      const freshMoving = fresh.find(cand => cand.id === candidatoId);
      if (!freshMoving) return;

      if (freshMoving.status === "em_atendimento") {
        toast.error("Não é possível mover candidatos em atendimento.");
        return;
      }

      // Fila visível na coluna alvo (para localizar o candidato de referência no destino)
      const queueOnly = getSortedForProf(targetProf, fresh).filter(cand => {
        const s = getCandidatoStatusForProf(cand, targetProf);
        return s === "queue" || s === "busy";
      });

      const toIdxLocal = Math.max(0, Math.min(destination.index, queueOnly.length - 1));
      const refCand = queueOnly[toIdxLocal];
      if (!refCand || refCand.id === freshMoving.id) return;

      // Lista ordenada da fila na visão deste especialista
      const especQueue = sortByPriority(fresh, targetProf).filter(cand => {
        const s = getCandidatoStatusForProf(cand, targetProf);
        return s === "queue" || s === "busy";
      });
      const fromEspec = especQueue.findIndex(x => x.id === freshMoving.id);
      if (fromEspec === -1) return;

      const reordered = [...especQueue];
      reordered.splice(fromEspec, 1);
      const refEspec = reordered.findIndex(x => x.id === refCand.id);
      if (refEspec === -1) return;
      const movingDown = source.index < destination.index;
      reordered.splice(movingDown ? refEspec + 1 : refEspec, 0, freshMoving);

      // Reatribui ordem sequencial somente para este especialista
      toast.info(`Aplicando nova ordem...`);
      await Promise.all(reordered.map((cand, i) => {
        const novaOrdem = (i + 1) * 10;
        const ordensEspec = preserveOrdensEspecFromObs(cand.observacoes);
        if (ordensEspec[targetProf.toLowerCase().trim()] === novaOrdem) return Promise.resolve();
        const newObs = setOrdemEspecInObs(cand.observacoes, targetProf, novaOrdem);
        updateLocal(cand.id, { observacoes: newObs });
        return supabase.from("candidatos").update({ observacoes: newObs }).eq("id", cand.id);
      }));
      toast.success(`Ordem aplicada somente em ${targetProf}.`);
      
      // Notifica outros usuários para atualizarem
      supabase.channel('force-refresh').send({
        type: 'broadcast',
        event: 'force-update',
        payload: { userId: usuario?.id }
      });
      
      refresh();
      return;
    }

    const c = candidatosMedicos.find(cand => cand.id === candidatoId);
    if (!c) return;

    if (c.status === "em_atendimento") {
      toast.error("Não é possível mover candidatos em atendimento.");
      return;
    }

    if (hasDecided(c, targetProf)) {
      toast.error(`${c.nome} já possui decisão de ${targetProf}.`);
      return;
    }

    // Cross-column drop → triggers "atender"
    setSelectedCandidate(c);
    setSelectedProf(targetProf);
    setActionType("atender");
  };

  const handleCopyReviewLink = (c: Candidato) => {
    const url = `${window.location.origin}/reprovados`;
    navigator.clipboard.writeText(url);
    toast.success(`Link de revisão copiado! Envie para Maurício.`);
  };

  useEffect(() => {
    const reviewId = searchParams.get("review");
    if (reviewId && candidatosMedicos.length > 0) {
      const c = candidatosMedicos.find(cand => cand.id === reviewId);
      if (c) {
        // Find if this candidate is already in "em_atendimento"
        const atendente = getAtendente(c);
        
        // If the user is Master or the current atendente, or if it's not being attended, open dialog
        const profName = atendente || (isMaster ? (cadastro[0]?.nome || "Mauricio") : (usuario?.nome || "Sistema"));
        
        setSelectedCandidate(c);
        setSelectedProf(profName);
        setActionType("encerrar");
        setEncerrarStep("choose");
        
        const results = getResultados(c);
        const rejected = results.filter(r => r.decisao === "reprovado" && r.motivo);
        if (rejected.length > 0) {
          const combinedReasons = rejected.map(r => `${r.nome}: ${r.motivo}`).join("; ");
          setMotivoReprovacao(combinedReasons);
        }
        
        // Remove 'review' from search params to avoid re-opening on next render
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("review");
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [searchParams, candidatosMedicos, isMaster, cadastro, usuario, setSearchParams]);

  const handleAtender = async () => {
    if (!selectedCandidate || !selectedProf) return;

    // Re-check from DB
    const { data: busyCheck } = await supabase
      .from("candidatos")
      .select("id")
      .eq("status", "em_atendimento")
      .like("observacoes", `%atendente:${selectedProf}%`)
      .limit(1);

    if (busyCheck && busyCheck.length > 0) {
      toast.error(`${selectedProf} já está atendendo outro candidato.`);
      closeDialogs();
      refresh();
      return;
    }

    const existingResults = getResultados(selectedCandidate);
    const existingHoras = preserveHorasFromObs(selectedCandidate.observacoes);
    const horaAgora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    existingHoras[selectedProf] = horaAgora;
    const existingHorasFim = preserveHorasFimFromObs(selectedCandidate.observacoes);
    const newObs = buildObservacoes(existingResults, selectedProf, existingHoras, getOrdem(selectedCandidate), existingHorasFim);

    const previousStatus = selectedCandidate.status;

    // Optimistic local update — instant UI feedback
    updateLocal(selectedCandidate.id, { status: "em_atendimento", observacoes: newObs });
    
    // Notifica outros usuários para atualizarem
    supabase.channel('force-refresh').send({
      type: 'broadcast',
      event: 'force-update',
      payload: { userId: usuario?.id }
    });

    // Accept "presente", "na_fila_atendimento", and also "atendido"/"aprovado" for re-attendance
    const { data: updated, error } = await supabase
      .from("candidatos")
      .update({ observacoes: newObs, status: "em_atendimento" })
      .eq("id", selectedCandidate.id)
      .select();

    // Notificar painel via canal broadcast (opcional mas garante se realtime falhar)
    try {
      await supabase.channel('painel-chamadas').send({
        type: 'broadcast',
        event: 'novo-atendimento',
        payload: { id: selectedCandidate.id, nome: selectedCandidate.nome, atendente: selectedProf }
      });
    } catch (err) { console.warn("Broadcast erro:", err); }

    if (error) {
      console.error('[handleAtender] DB error:', error);
      toast.error(`Erro ao iniciar atendimento: ${error.message}`);
      closeDialogs();
      refresh();
      return;
    }
    if (!updated?.length) {
      console.error('[handleAtender] No rows updated for id:', selectedCandidate.id);
      toast.error(`${selectedCandidate.nome} não pôde ser atendido.`);
      closeDialogs();
      refresh();
      return;
    }

    supabase.from("historico").insert({
      candidato_id: selectedCandidate.id,
      usuario: usuario?.login || "Sistema",
      data: new Date().toISOString().split("T")[0],
      hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      status_anterior: previousStatus,
      novo_status: "em_atendimento",
      observacao: `Atendimento iniciado por ${selectedProf}`,
    });

    // Remove cadeado dessa coluna após iniciar atendimento
    if (isCadeado(selectedCandidate.id, selectedProf)) {
      await supabase.from('closed_dates').delete().eq('date', cadeadoKey(selectedCandidate.id, selectedProf));
    }

    toast.success(`${selectedCandidate.nome} em atendimento com ${selectedProf}`);
    closeDialogs();
  };

  const finishAttendance = async (decisao: "aprovado" | "reprovado" | "pre_aprovado", motivo?: string) => {
    if (!selectedCandidate || !selectedProf) return;
    if (decisao === "reprovado" && !motivo?.trim()) {
      toast.error("Informe o motivo da reprovação.");
      return;
    }

    const { data: freshRow, error: freshError } = await supabase
      .from("candidatos")
      .select("status, observacoes, motivo_reprovacao")
      .eq("id", selectedCandidate.id)
      .single();

    if (freshError || !freshRow) {
      toast.error("Não foi possível atualizar o candidato. Tente novamente.");
      refresh();
      return;
    }

    const freshCandidate: Candidato = {
      ...selectedCandidate,
      status: freshRow.status,
      observacoes: freshRow.observacoes || undefined,
      motivoReprovacao: freshRow.motivo_reprovacao || undefined,
    };

    const normalizedProf = selectedProf.toLowerCase().trim();
    const existingResults = getResultados(freshCandidate).filter(r => r.nome.toLowerCase().trim() !== normalizedProf);
    const newResult: Resultado = {
      nome: selectedProf,
      decisao,
      motivo: motivo?.trim() || undefined,
    };
    const allResults = [...existingResults, newResult];

    // Check if all professionals with 'aprovar' have now decided
    const approvers = cadastro.filter(p => p.aprovar);
    const allApproversDecided = approvers.every(p =>
      allResults.some(r => r.nome.toLowerCase() === p.nome.toLowerCase())
    );

    // Check if all professionals (regardless of aprovar) have attended
    const allProfessionalsDecided = cadastro.every(p =>
      allResults.some(r => r.nome.toLowerCase() === p.nome.toLowerCase())
    );

    // Logic for Resultado Final
    const michelliDec = allResults.find(r => ["michelli", "michele", "micheli"].includes(r.nome.toLowerCase().trim()))?.decisao;
    const silvanaDec = allResults.find(r => ["silvana", "silvana mello", "silvana melo"].includes(r.nome.toLowerCase().trim()))?.decisao;
    const soniaDec = allResults.find(r => r.nome.toLowerCase().trim() === "sonia")?.decisao;
    
    let newStatus: string;
    const isSilvanaOrMichelli = ["silvana", "michelli", "michele", "micheli"].includes(selectedProf.toLowerCase().trim());
    const isMichelliProf = ["michelli", "michele", "micheli"].includes(selectedProf.toLowerCase().trim());
    const isMasterReviewer = ["mauricio", "luciano", "sonia"].includes(selectedProf.toLowerCase().trim());

    if (soniaDec === "reprovado") {
      newStatus = "reprovado";
    } else if (soniaDec === "aprovado") {
      newStatus = "aprovado";
    } else if (isSilvanaOrMichelli) {
      if (decisao === "aprovado") {
        newStatus = "aprovado";
      } else if (isMichelliProf) {
        // Michelli: reprovado/pré-aprovado NÃO bloqueia outros especialistas
        // (resultado final fica reprovado apenas no display, atendimento continua)
        newStatus = "atendido";
      } else {
        newStatus = "reprovado";
      }
    } else {
      // Para os demais especialistas (Ex: médicos), eles apenas "atendem" 
      // mas o status final depende da Silvana/Sonia
      if (isMasterReviewer) {
        newStatus = decisao === "pre_aprovado" ? "atendido" : decisao; // Master pode forçar status
      } else {
        const alguemJaAprovou = allResults.some(r => r.decisao === "aprovado" && ["silvana", "michelli", "michele", "micheli", "sonia"].includes(r.nome.toLowerCase().trim()));
        
        if (decisao === "reprovado" || silvanaDec === "reprovado") {
          newStatus = "reprovado";
        } else if (alguemJaAprovou) {
          newStatus = "aprovado";
        } else {
          newStatus = "atendido";
        }
      }
    }

    const existingHoras = preserveHorasFromObs(freshCandidate.observacoes);
    const existingHorasFim = preserveHorasFimFromObs(freshCandidate.observacoes);
    const horaFimAgora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    existingHorasFim[selectedProf] = horaFimAgora;
    const newObs = buildObservacoes(allResults, undefined, existingHoras, getOrdem(freshCandidate), existingHorasFim);

    // Regra: Se for Maurício, Luciano ou Sônia, o motivo_reprovacao final deve ser APENAS a decisão deles,
    // sem copiar a justificativa da Michelli e da Silvana.
    let finalMotivo = allResults
      .filter(r => r.decisao === "reprovado")
      .map(r => `${r.nome}: ${r.motivo}`)
      .join('; ');

    if (isMasterReviewer && decisao === "reprovado") {
      finalMotivo = `${selectedProf}: ${motivo}`;
    }

    const updatePayload: any = {
      observacoes: newObs,
      status: newStatus,
      ...(newStatus === "reprovado" ? { motivo_reprovacao: finalMotivo } : {}),
    };


    // Optimistic local update — instant UI feedback
    updateLocal(selectedCandidate.id, updatePayload);
    
    // Notifica outros usuários
    supabase.channel('force-refresh').send({
      type: 'broadcast',
      event: 'force-update',
      payload: { userId: usuario?.id }
    });

    const { error: updateError } = await supabase.from("candidatos").update(updatePayload).eq("id", selectedCandidate.id);
    if (updateError) {
      console.error('[finishAttendance] update error:', updateError);
      toast.error("Erro ao salvar decisão. A fila será atualizada.");
      refresh();
      return;
    }

    await supabase.from("historico").insert({
      candidato_id: selectedCandidate.id,
      usuario: usuario?.login || "Sistema",
      data: new Date().toISOString().split("T")[0],
      hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      status_anterior: freshCandidate.status,
      novo_status: decisao,
      observacao: decisao === "aprovado"
        ? `Aprovado por ${selectedProf}`
        : `Reprovado por ${selectedProf}: ${motivo}`,
    });

    const statusMsg = "ATENDIDO";
    toast.success(`${selectedCandidate.nome} — ${statusMsg} por ${selectedProf}`);
    closeDialogs();
    refresh();
  };

  const handleCancelarAtendimento = async () => {
    if (!selectedCandidate || !selectedProf) return;
    const previousStatus = "na_fila_atendimento";
    const existingHoras = preserveHorasFromObs(selectedCandidate.observacoes);
    const existingResults = getResultados(selectedCandidate);
    const newObs = buildObservacoes(existingResults, undefined, existingHoras, getOrdem(selectedCandidate));
    updateLocal(selectedCandidate.id, { status: previousStatus, observacoes: newObs });
    
    // Notifica outros usuários
    supabase.channel('force-refresh').send({
      type: 'broadcast',
      event: 'force-update',
      payload: { userId: usuario?.id }
    });
    const { error } = await supabase.from("candidatos").update({ status: previousStatus, observacoes: newObs }).eq("id", selectedCandidate.id);
    if (error) { toast.error("Erro ao cancelar atendimento."); refresh(); }
    else {
      toast.success("Atendimento cancelado. O candidato voltou para a fila.");
      supabase.from("historico").insert({
        candidato_id: selectedCandidate.id,
        usuario: usuario?.login || "Sistema",
        data: new Date().toISOString().split("T")[0],
        hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        status_anterior: "em_atendimento",
        novo_status: previousStatus,
        observacao: `Atendimento cancelado por ${selectedProf}`,
      });
    }
    closeDialogs();
  };

  const handleRechamar = async (c: Candidato, profNome: string) => {
    const existingResults = getResultados(c);
    const existingHoras = preserveHorasFromObs(c.observacoes);
    const existingHorasFim = preserveHorasFimFromObs(c.observacoes);
    const ordensEspec = preserveOrdensEspecFromObs(c.observacoes);
    // Adiciona um timestamp para forçar a detecção de mudança no painel (re-call)
    const newObs = buildObservacoes(existingResults, profNome, existingHoras, getOrdem(c), existingHorasFim, ordensEspec) + `|recall:${Date.now()}`;
    updateLocal(c.id, { observacoes: newObs, status: "em_atendimento" });
    toast.success(`${c.nome} rechamado no painel por ${profNome}`);
    supabase.from("candidatos").update({
      observacoes: newObs,
      status: "em_atendimento",
    }).eq("id", c.id);
    supabase.from("historico").insert({
      candidato_id: c.id,
      usuario: usuario?.login || "Sistema",
      data: new Date().toISOString().split("T")[0],
      hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      status_anterior: c.status,
      novo_status: "em_atendimento",
      observacao: `Rechamado no painel por ${profNome}`,
    });
  };

  const closeDialogs = () => {
    setSelectedCandidate(null);
    setSelectedProf(null);
    setActionType(null);
    setEncerrarStep("choose");
    setMotivoReprovacao("");
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground text-lg">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Atender Dialog */}
      <AlertDialog open={actionType === "atender" && !!selectedCandidate} onOpenChange={open => { if (!open) closeDialogs(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Iniciar Atendimento</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Iniciar atendimento de <strong className="text-foreground">{selectedCandidate?.nome}</strong> com{" "}
              <strong className="text-foreground">{selectedProf}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-9">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAtender} className="bg-purple-600 hover:bg-purple-700 text-xs h-9">
              <PlayCircle className="h-4 w-4 mr-2" /> Atender
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Cancelar Atendimento Dialog */}
      <AlertDialog open={actionType === "cancelar" && !!selectedCandidate} onOpenChange={open => { if (!open) closeDialogs(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base text-red-600 font-bold">CANCELAR ATENDIMENTO</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Deseja cancelar o atendimento de <strong className="text-foreground">{selectedCandidate?.nome}</strong>? 
              Ele voltará para a fila de espera.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-9">VOLTAR</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelarAtendimento} className="bg-red-600 hover:bg-red-700 text-xs h-9 font-bold">
              CONFIRMAR CANCELAMENTO
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Encerrar Dialog */}
      <Dialog open={actionType === "encerrar" && !!selectedCandidate} onOpenChange={open => { if (!open) closeDialogs(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar Atendimento — {selectedCandidate?.nome}</DialogTitle>
          </DialogHeader>
          {(() => {
            const prof = cadastro.find(p => p.nome === selectedProf);
            const isSoniaProf = selectedProf?.toLowerCase() === "sonia";
            const isSilvana = selectedProf?.toLowerCase() === "silvana";
            const isMichelli = ["michelli", "michele", "micheli"].includes(selectedProf?.toLowerCase() || "");
            const canApprove = (prof?.aprovar || isSoniaProf || isSilvana || isMichelli) && !isLucianoMauricio;

            if (!canApprove) {
              // Diário or non-approver professional: just "Encerrar Atendimento"
              return (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Encerrar atendimento de <strong className="text-foreground">{selectedCandidate?.nome}</strong>?
                  </p>
                  <div className="flex gap-2">
                    <Button className="flex-1 h-10 text-xs font-bold bg-green-600 hover:bg-green-700 text-white" onClick={() => finishAttendance("aprovado")}>
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Encerrar Atendimento
                    </Button>
                    <Button variant="ghost" className="h-10 text-xs" onClick={closeDialogs}>Cancelar</Button>
                  </div>
                </div>
              );
            }

            if (encerrarStep === "choose") {
              return (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {isSoniaProf ? "Resultado da Pesquisa do RH:" : "O candidato foi aprovado ou não aprovado?"}
                  </p>
                  <div className={cn("flex gap-3", isMichelli && "flex-col sm:flex-row")}>
                    <Button className="flex-1 h-12 text-sm font-bold bg-green-600 hover:bg-green-700 text-white" onClick={() => finishAttendance("aprovado")}>
                      <CheckCircle2 className="h-5 w-5 mr-2" /> APROVADO
                    </Button>
                    {isMichelli && (
                      <Button className="flex-1 h-12 text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white" onClick={() => { setMotivoReprovacao(""); setEncerrarStep("pre_aprovar"); }}>
                        <CheckCircle2 className="h-5 w-5 mr-2" /> PRÉ APROVADO
                      </Button>
                    )}
                    <Button className="flex-1 h-12 text-sm font-bold bg-red-600 hover:bg-red-700 text-white" onClick={() => {
                      if (isSoniaProf) {
                        setMotivoReprovacao("Pesquisa do RH");
                      }
                      setEncerrarStep("reprovar");
                    }}>
                      <XCircle className="h-5 w-5 mr-2" /> {isMichelli ? "REPROVADO" : "NÃO APROVADO"}
                    </Button>
                  </div>
                  <Button variant="ghost" className="w-full" onClick={closeDialogs}>Cancelar</Button>
                </div>
              );
            }

            if (encerrarStep === "pre_aprovar") {
              return (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Informe o motivo do pré-aprovado (obrigatório):</p>
                  <Textarea value={motivoReprovacao} onChange={e => setMotivoReprovacao(e.target.value)} placeholder="Descreva o motivo..." className="min-h-[100px]" />
                  <div className="flex gap-2">
                    <Button className="flex-1 h-10 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs" onClick={() => finishAttendance("pre_aprovado", motivoReprovacao)}>
                      Confirmar Pré-Aprovado
                    </Button>
                    <Button variant="outline" className="h-10 text-xs" onClick={() => setEncerrarStep("choose")}>Voltar</Button>
                  </div>
                </div>
              );
            }

            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {isSoniaProf ? "Motivo da reprovação (Pesquisa do RH):" : "Informe o motivo da reprovação (obrigatório):"}
                </p>
                <Textarea value={motivoReprovacao} onChange={e => setMotivoReprovacao(e.target.value)} placeholder="Descreva o motivo..." className="min-h-[100px]" />
                <div className="flex gap-2">
                  <Button className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white font-bold text-xs" onClick={() => finishAttendance("reprovado", motivoReprovacao)}>
                    Confirmar Reprovação
                  </Button>
                  <Button variant="outline" className="h-10 text-xs" onClick={() => setEncerrarStep("choose")}>Voltar</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Lista de Reprovados Modal */}
      <Dialog open={showReprovedList} onOpenChange={setShowReprovedList}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 text-red-600">
              <span className="flex items-center gap-2"><XCircle className="h-5 w-5" /> Candidatos Reprovados</span>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/reprovados`);
                toast.success("Link copiado! Envie para Maurício ou Sônia.");
              }}>
                <Link className="h-4 w-4" /> Copiar Link
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {candidatosMedicos.filter(c => c.status === "reprovado").length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Nenhum candidato reprovado no momento.</p>
            ) : (
              <div className="grid gap-3">
                {candidatosMedicos.filter(c => c.status === "reprovado").map(c => {
                  const resultados = getResultados(c);
                  const reprovacoes = resultados.filter(r => r.decisao === "reprovado");
                  return (
                    <div key={c.id} className="border rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-red-50/30">
                      <div className="space-y-1 flex-1">
                        <p className="font-bold uppercase text-sm">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">{c.setor} • {c.funcao}</p>
                        <div className="mt-2 space-y-1">
                          {reprovacoes.map((r, idx) => (
                            <p key={idx} className="text-xs">
                              <span className="font-semibold text-red-600">{r.nome}:</span> {r.motivo || "Sem motivo especificado"}
                            </p>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2 border-primary text-primary hover:bg-primary/10"
                          onClick={() => handleCopyReviewLink(c)}
                        >
                          <Link className="h-4 w-4" /> Enviar para Maurício/Sônia
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Lista de Aprovados Modal */}
      <Dialog open={showApprovedList} onOpenChange={setShowApprovedList}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 text-green-600">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> Candidatos Aprovados</span>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => {
                setSearchParams({ view: "resultado" });
                setShowApprovedList(false);
              }}>
                <ListChecks className="h-4 w-4" /> Ver Todos Resultados
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            {candidatosMedicos.filter(c => c.status === "aprovado").length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                <p className="text-muted-foreground font-medium">Nenhum candidato aprovado no momento.</p>
              </div>
            ) : (
              <div className="grid gap-3 pb-4">
                {candidatosMedicos.filter(c => c.status === "aprovado").map(c => {
                  return (
                    <div key={c.id} className="border rounded-lg p-4 flex justify-between items-center gap-4 bg-green-50/40 hover:bg-green-50/60 transition-colors shadow-sm">
                      <div className="space-y-1 flex-1">
                        <p className="font-bold uppercase text-sm text-green-900">{c.nome}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                          <span>{c.setor}</span>
                          <span className="text-muted-foreground/30">•</span>
                          <span>{c.funcao}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-[10px] font-bold text-green-700 border-green-200 bg-green-100/50">
                            APROVADO FINAL
                          </Badge>
                          {c.indicacao && (
                            <span className="text-[10px] text-muted-foreground bg-white px-2 py-0.5 rounded border border-gray-100">
                              Ind: {formatIndicacao(c.indicacao)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="font-bold text-xs h-9 px-4 shadow-sm"
                          onClick={() => {
                            setSearchParams({ view: "resultado", search: c.nome });
                            setShowApprovedList(false);
                          }}
                        >
                          Detalhes
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-tight flex items-center gap-2 sm:gap-3">
            <Stethoscope className="h-5 w-5 sm:h-7 sm:w-7 text-primary" /> {location.pathname === "/atendimento-diario/atendimento" ? "ATENDIMENTO DIÁRIO" : "ATENDIMENTO INTEGRAÇÃO"}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Gestão de atendimento — {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            className={cn(
              "gap-2 font-bold text-[10px]",
              !showSpecCols ? "bg-primary text-primary-foreground" : "border-blue-300 text-blue-700"
            )}
            onClick={() => setShowSpecCols(!showSpecCols)}
          >
            {showSpecCols ? <><Pause className="h-3 w-3" /> RECOLHER ESPECIALISTAS</> : <><Play className="h-3 w-3" /> MOSTRAR ESPECIALISTAS</>}
          </Button>

          <Button variant="outline" className="gap-2 font-bold text-[10px]" onClick={() => window.open(location.pathname === "/atendimento-diario/atendimento" ? "/painel-diario" : "/painel", "_blank")}>
            <Monitor className="h-3 w-3" /> {location.pathname === "/atendimento-diario/atendimento" ? "PAINEL DIÁRIO" : "PAINEL"}
          </Button>

          {(isMaster || usuario?.login?.toLowerCase() === "sonia") && (
            <div className="flex gap-2">
              <Button 
                variant="outline"
                className="gap-2 font-bold text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
                onClick={async () => {
                  // Teste local
                  const msg = new SpeechSynthesisUtterance(`Teste de áudio local`);
                  msg.lang = 'pt-BR';
                  window.speechSynthesis.speak(msg);
                  
                  // Teste no painel (TV)
                  try {
                    await supabase.channel('luciano-painel-recv').send({
                      type: 'broadcast',
                      event: 'audio-test',
                      payload: { message: "TESTE DE ÁUDIO NO PAINEL", timestamp: Date.now() }
                    });
                    toast.success("Teste de áudio iniciado (Local e Painel)");
                  } catch (err) {
                    toast.success("Teste de áudio local iniciado");
                    console.error("Erro ao enviar teste para o painel:", err);
                  }
                }}
              >
                <Volume2 className="h-3 w-3" /> TESTE ÁUDIO
              </Button>
              <Button 
                variant="outline"
                className="gap-2 font-bold text-[10px] bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                onClick={() => setShowLucianoMessage(true)}
              >
                MENSAGEM PAINEL
              </Button>
              {usuario !== usuarioReal && (
                <Button 
                  variant="destructive"
                  className="gap-2 font-bold text-[10px]"
                  onClick={() => {
                    impersonar(null);
                    toast.success("Voltando para seu perfil original");
                  }}
                >
                  SAIR TESTE
                </Button>
              )}
            </div>
          )}

          {canShowPainel && (
            <Button 
              variant="outline" 
              className="gap-2 font-bold text-[10px] border-green-300 text-green-700 hover:bg-green-50" 
              onClick={async () => {
                toast.loading("Gerando Excel...");
                try {
                  const XLSX = await import("xlsx");
                  const wb = XLSX.utils.book_new();

                  const dataToExport = candidatosMedicos.map(c => {
                    const resultados = getResultados(c);
                    const horas = getHorasAtendimento(c);
                    const horasFim = preserveHorasFimFromObs(c.observacoes);
                    
                    const row: any = {
                      "Nome": c.nome,
                      "CPF": c.cpf || "—",
                      "Setor": c.setor || "—",
                      "Função": c.funcao || "—",
                      "Status Geral": c.status.toUpperCase(),
                      "Data": c.dataIntegracao || new Date().toLocaleDateString('pt-BR'),
                    };

                    // Adiciona colunas para cada especialista que atendeu
                    resultados.forEach(r => {
                      row[`Resultado ${r.nome}`] = r.decisao.toUpperCase();
                      if (r.motivo) row[`Motivo ${r.nome}`] = r.motivo;
                      if (horas[r.nome.toLowerCase()]) row[`Início ${r.nome}`] = horas[r.nome.toLowerCase()];
                      if (horasFim[r.nome]) row[`Término ${r.nome}`] = horasFim[r.nome];
                    });

                    return row;
                  });

                  const ws = XLSX.utils.json_to_sheet(dataToExport);
                  XLSX.utils.book_append_sheet(wb, ws, "Geral");

                  // Create specialty tabs
                  const specs = [...new Set(cadastro.map(p => p.especialidade || "Geral"))];
                  specs.forEach(spec => {
                    const specData = candidatosMedicos.filter(c => {
                      const resultados = getResultados(c);
                      return resultados.some(r => {
                        const prof = cadastro.find(p => p.nome.toLowerCase() === r.nome.toLowerCase());
                        return (prof?.especialidade || "Geral") === spec;
                      });
                    }).map(c => {
                      const resultados = getResultados(c);
                      const horas = getHorasAtendimento(c);
                      const horasFim = preserveHorasFimFromObs(c.observacoes);
                      const r = resultados.find(res => {
                        const prof = cadastro.find(p => p.nome.toLowerCase() === res.nome.toLowerCase());
                        return (prof?.especialidade || "Geral") === spec;
                      });
                      
                      return {
                        "Nome": c.nome,
                        "CPF": c.cpf || "—",
                        "Setor": c.setor || "—",
                        "Função": c.funcao || "—",
                        "Especialista": r?.nome || "—",
                        "Resultado": r?.decisao?.toUpperCase() || "—",
                        "Motivo": r?.motivo || "—",
                        "Início": r ? (horas[r.nome.toLowerCase()] || "—") : "—",
                        "Término": r ? (horasFim[r.nome] || "—") : "—",
                        "Status Geral": c.status.toUpperCase()
                      };
                    });
                    
                    if (specData.length > 0) {
                      const specWs = XLSX.utils.json_to_sheet(specData);
                      // Sheet names must be <= 31 chars and unique
                      const safeName = spec.substring(0, 31).replace(/[\[\]\*\?\/\\]/g, '');
                      XLSX.utils.book_append_sheet(wb, specWs, safeName);
                    }
                  });

                  XLSX.writeFile(wb, `relatorio_integracao_${new Date().toISOString().split('T')[0]}.xlsx`);
                  toast.dismiss();
                  toast.success("Excel gerado com sucesso!");
                } catch (error) {
                  console.error(error);
                  toast.dismiss();
                  toast.error("Erro ao gerar Excel.");
                }
              }}
            >
              <FileSpreadsheet className="h-3 w-3" /> EXPORTAR EXCEL
            </Button>
          )}
        </div>
      </div>

      {atendimentoView === "resultado" ? (
        <PasswordGate>
          <ResultadoView
            candidatos={allCandidatosInc}
            resultadoLiberado={resultadoLiberado}
            setResultadoLiberado={setResultadoLiberado}
            setSelected={() => {}}
            onRefresh={refresh}
            readOnly={!isMaster && !["silvana", "michelli", "michele", "mauricio"].includes(usuario?.login?.toLowerCase() || "")}
            canEditDecisions={isMaster || isMauricio}
            currentUserName={usuario?.nome || ""}
            currentUserLogin={usuario?.login || ""}
            closedDates={closedDates}
          />
        </PasswordGate>
      ) : (
      <>
      {!isDiario && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-1">
              <Card><CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">{candidatosMedicos.length}</div>
                <div><p className="text-xs text-muted-foreground uppercase font-semibold">Total</p></div>
              </CardContent></Card>
              <Card><CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">{totalNaFila}</div>
                <div><p className="text-xs text-muted-foreground uppercase font-semibold">Na Fila</p></div>
              </CardContent></Card>
              <Card><CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-lg">{totalEmAtendimento}</div>
                <div><p className="text-xs text-muted-foreground uppercase font-semibold">Em Atend.</p></div>
              </CardContent></Card>
            </div>
            
            {isMaster && (
              <div className="flex items-center gap-2">
                <input type="file" accept=".xlsx,.xls" id="excel-import" className="sr-only" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  toast.loading("Processando arquivo...");
                  try {
                    const XLSX = await import("xlsx");
                    const data = await file.arrayBuffer();
                    const wb = XLSX.read(data, { type: 'array', cellDates: true });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

                    if (rows.length === 0) {
                      toast.dismiss();
                      toast.error("Nenhuma linha encontrada.");
                      return;
                    }

                    const novos: any[] = rows.map(r => ({
                      nome: (r["Nome"] || r["nome"] || r["NOME"] || "SEM NOME").toString().trim(),
                      cpf: (r["CPF"] || r["cpf"] || r["Cpf"] || "").toString().trim(),
                      funcao: (r["Função"] || r["funcao"] || r["FUNÇÃO"] || "").toString().trim(),
                      setor: (r["Setor"] || r["setor"] || r["SETOR"] || "Não informado").toString().trim(),
                      status: "aguardando_presenca",
                      dataImportacao: new Date().toISOString().split("T")[0],
                      turno: (r["Turno"] || r["turno"] || r["TURNO"] || "Manhã").toString().trim(),
                    }));

                    const { error } = await supabase.from("candidatos").insert(novos);
                    if (error) throw error;
                    
                    toast.dismiss();
                    toast.success(`${novos.length} candidatos importados!`);
                    refresh();
                  } catch (err) {
                    toast.dismiss();
                    console.error(err);
                    toast.error("Erro ao importar Excel.");
                  }
                }} />
                <Button asChild size="sm" variant="outline" className="h-10 border-green-600 text-green-600 hover:bg-green-50 gap-2 cursor-pointer font-bold">
                  <label htmlFor="excel-import">
                    <FileSpreadsheet className="h-4 w-4" /> IMPORTAR EXCEL DO DIA
                  </label>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {canSeeTempos && (() => {
        const ativosList = cadastro.filter(l => l.painel !== false);
        const avgs = ativosList
          .map(l => temposMedios[l.nome.toLowerCase()]?.avg)
          .filter((v): v is number => typeof v === "number" && v > 0);
        if (avgs.length === 0 || pendentes === 0) {
          return (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm flex flex-wrap gap-4 items-center">
              <Clock className="h-4 w-4 text-primary" />
              <span><b>{atendidosHoje}</b> atendidos · <b>{pendentes}</b> pendentes</span>
              <span className="text-muted-foreground">Sem dados suficientes para prever término.</span>
            </div>
          );
        }
        const avgGlobal = avgs.reduce((a, b) => a + b, 0) / avgs.length;
        const minutosRestantes = Math.round((pendentes * avgGlobal) / ativosList.length);
        const eta = new Date(Date.now() + minutosRestantes * 60000);
        const etaStr = eta.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        return (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm flex flex-wrap gap-4 items-center">
            <Clock className="h-4 w-4 text-primary" />
            <span><b>{atendidosHoje}</b> atendidos · <b>{pendentes}</b> pendentes</span>
            <span>Média geral: <b>{avgGlobal.toFixed(1)} min</b></span>
            <span>Previsão de término: <b className="text-primary text-base">{etaStr}</b> <span className="text-muted-foreground">(~{minutosRestantes} min)</span></span>
          </div>
        );
      })()}

      {/* Professional Columns */}
      {cadastro.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Nenhum profissional cadastrado. Configure no RH → Configurações → Usuários (marque "Aparece no Painel").
        </CardContent></Card>
      ) : showSpecCols && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {cadastro.map((prof) => {
              const profSorted = getSortedForProf(prof.nome);
              const isAttending = profSorted.some(c => getCandidatoStatusForProf(c, prof.nome) === "attending");
              const naFila = profSorted.filter(c => getCandidatoStatusForProf(c, prof.nome) === "queue" || getCandidatoStatusForProf(c, prof.nome) === "busy").length;
              const queueIndexById = new Map(
                profSorted
                  .filter(c => {
                    const status = getCandidatoStatusForProf(c, prof.nome);
                    return status === "queue" || status === "busy";
                  })
                  .map((c, i) => [c.id, i])
              );

              const inativoNoDia = isProfInativoNoDia(prof.nome);
              const pausado = isProfPausado(prof.nome) || inativoNoDia;
              const canTogglePausa = isMaster || usuario?.nome?.toLowerCase() === prof.nome.toLowerCase() || usuario?.login?.toLowerCase() === "silvana";

              return (
                <Card key={prof.nome} className={cn("border-t-4", pausado ? "border-t-amber-500 opacity-80" : isAttending ? "border-t-purple-500" : "border-t-blue-500")}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold uppercase flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("flex items-center gap-1 text-[13px]", pausado ? "text-amber-600" : isAttending ? "text-purple-600" : "text-blue-600")}>
                          {prof.sala || `SALA DE ${prof.nome}`}
                          {pausado && <Badge variant="outline" className="ml-1 text-[9px] border-amber-500 text-amber-600">{inativoNoDia ? "INATIVO" : "PAUSADO"}</Badge>}
                        </span>
                        {canTogglePausa && (
                          <Button
                            size="sm"
                            variant={pausado ? "default" : "outline"}
                            className={cn("h-6 px-2 text-[9px] font-bold", pausado && "bg-amber-500 hover:bg-amber-600 text-white")}
                            onClick={(e) => { e.stopPropagation(); togglePausa(prof.nome); }}
                            title={pausado ? "Reativar atendimento" : "Pausar atendimento"}
                          >
                            {pausado ? <><Play className="h-3 w-3 mr-1" />ATIVAR</> : <><Pause className="h-3 w-3 mr-1" />PAUSAR</>}
                          </Button>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-normal flex items-center gap-2 flex-wrap">
                        <span>{prof.especialidade || "Geral"} • {pausado ? "fila pausada" : `${naFila} na fila`}</span>
                        {canSeeTempos && (() => {
                          const t = temposMedios[prof.nome.toLowerCase()];
                          return (
                            <span className={cn(
                              "inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded",
                              t ? "text-primary bg-primary/10" : "text-muted-foreground border border-dashed"
                            )}>
                              <Clock className="h-3 w-3" />
                              {t ? `${t.avg.toFixed(1)} min (${t.count})` : "sem dados"}
                            </span>
                          );
                        })()}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <Droppable droppableId={prof.nome}>
                    {(provided, snapshot) => (
                      <CardContent 
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "p-2 space-y-2 min-h-[150px] transition-colors",
                          snapshot.isDraggingOver && "bg-accent/50 rounded-b-lg"
                        )}
                      >
                        {profSorted.map((c, index) => {
                          const status = getCandidatoStatusForProf(c, prof.nome);
                          const isDraggable = isMaster && status !== "attending" && status !== "decided";

                          if (status === "attending") {
                            const horas = getHorasAtendimento(c);
                            const horaInicio = horas[prof.nome.toLowerCase()] || "";
                            return (
                              <div key={c.id}
                                onClick={() => handleClickCandidate(c, prof.nome)}
                                className="rounded-lg border-2 border-purple-400 bg-purple-50 dark:bg-purple-950/30 p-1.5 text-[10px] min-h-[95px] animate-pulse cursor-pointer hover:shadow-md flex flex-col gap-1 overflow-hidden">
                                  <div className="flex items-center gap-1">
                                    <p className="font-bold uppercase text-[10px] truncate">{c.nome}</p>
                                    <DiretoBadge indicacao={c.indicacao} />
                                    {c.fretado && c.fretado.trim() !== "" && (
                                      <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 text-[7px] font-bold px-1 py-0 shrink-0">🚌 {c.fretado}</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between gap-1">
                                    <p className="text-muted-foreground text-[9px] truncate">{c.setor}</p>
                                    {horaInicio && podeVerDetalheResultadoNoAtendimento && <span className="text-[8px] font-black text-purple-600">INÍCIO: {horaInicio}</span>}
                                  </div>
                                   <Badge className="bg-purple-600 text-white text-[7px] px-1 py-0 rounded-sm self-start">EM ATENDIMENTO</Badge>
                                   <div className="grid grid-cols-2 gap-1 w-full">

                                      <Button size="sm" variant="outline" className="h-5 px-1.5 text-[8px] font-bold border-purple-400 text-purple-600 hover:bg-purple-100"
                                        onClick={(e) => { e.stopPropagation(); handleRechamar(c, prof.nome); }}>
                                        <Volume2 className="h-2.5 w-2.5 mr-1" /> RECHAMAR
                                      </Button>
                                      <Button size="sm" className="h-5 px-1.5 text-[8px] font-bold bg-green-600 hover:bg-green-700 text-white border-green-600"
                                        onClick={(e) => { e.stopPropagation(); handleClickCandidate(c, prof.nome); }}>
                                        <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> ENCERRAR
                                      </Button>
                                      <Button size="sm" variant="outline" className="h-5 px-1.5 text-[8px] font-bold border-destructive text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); setSelectedCandidate(c); setSelectedProf(prof.nome); setActionType("cancelar"); }}> <XCircle className="h-2.5 w-2.5 mr-1" /> CANCELAR </Button>
                                      {isMaster && (
                                        <Button size="sm" variant="destructive" className="h-5 px-1.5 text-[8px] font-bold" onClick={async (e) => {
                                          e.stopPropagation();
                                          const motivoRemocao = prompt(`EXCLUIR ${c.nome} da fila de ${prof.nome}? Digite o motivo:`, "Removido por Administrador Master");
                                          if (motivoRemocao === null) return;
                                          const { data: freshRow, error: freshError } = await supabase.from("candidatos").select("status, observacoes, motivo_reprovacao").eq("id", c.id).single();
                                          if (freshError || !freshRow) { toast.error("Erro ao buscar candidato atualizado."); return; }
                                          const fresh: Candidato = { ...c, status: freshRow.status, observacoes: freshRow.observacoes || undefined, motivoReprovacao: freshRow.motivo_reprovacao || undefined };
                                          const resultados = getResultados(fresh).filter(r => r.nome.toLowerCase().trim() !== prof.nome.toLowerCase().trim());
                                          const newResult: Resultado = { nome: prof.nome, decisao: "reprovado", motivo: `NÃO SERÁ ATENDIDO: ${motivoRemocao}` };
                                          const allResults = [...resultados, newResult];
                                          const newObs = buildObservacoes(allResults, undefined, preserveHorasFromObs(fresh.observacoes), getOrdem(fresh));
                                          updateLocal(c.id, { observacoes: newObs, status: "na_fila_atendimento" });
                                          const { error: upErr } = await supabase.from("candidatos").update({ observacoes: newObs, status: "na_fila_atendimento" }).eq("id", c.id);
                                          if (upErr) { toast.error("Erro ao excluir: " + upErr.message); refresh(); return; }
                                          await supabase.from("historico").insert({
                                            candidato_id: c.id,
                                            usuario: usuario?.login || "Sistema",
                                            data: new Date().toISOString().split("T")[0],
                                            hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                                            status_anterior: fresh.status,
                                            novo_status: "na_fila_atendimento",
                                            observacao: `EXCLUÍDO da fila de ${prof.nome} por ${usuario?.login}: ${motivoRemocao}`,
                                          });
                                          toast.success(`${c.nome} excluído da fila de ${prof.nome}.`);
                                          refresh();
                                        }}> <XCircle className="h-2.5 w-2.5 mr-1" /> EXCLUIR </Button>
                                      )}
                                   </div>
                               </div>

                            );
                          }

                          if (status === "decided") {
                            const canRecall = isMaster || usuario?.nome?.toLowerCase() === prof.nome.toLowerCase();
                            const horas = getHorasAtendimento(c);
                            const horaInicio = horas[prof.nome.toLowerCase()] || "";
                            return (
                              <Tooltip key={c.id}>
                                <TooltipTrigger asChild>
                                   <div className="rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/30 p-1.5 text-[10px] h-[75px] flex flex-col justify-between">
                                     <div className="flex items-center gap-1">
                                       <p className="font-bold uppercase text-[10px] truncate text-green-700">{c.nome}</p>
                                       <DiretoBadge indicacao={c.indicacao} />
                                       {c.fretado && c.fretado.trim() !== "" && (
                                         <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 text-[7px] font-bold px-1 py-0 shrink-0">🚌 {c.fretado}</Badge>
                                       )}
                                     </div>
                                     <div className="flex items-center justify-between gap-1 leading-none">
                                       <p className="text-green-600/80 text-[9px] truncate font-medium">{c.setor}</p>
                                    {horaInicio && podeVerDetalheResultadoNoAtendimento && (
                                      <div className="flex flex-col gap-0 items-end">
                                        <span className="text-[8px] font-black text-blue-600">INÍCIO: {horaInicio}</span>
                                        {preserveHorasFimFromObs(c.observacoes)[prof.nome] && (
                                          <span className="text-[8px] font-black text-purple-600">FIM: {preserveHorasFimFromObs(c.observacoes)[prof.nome]}</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between mt-auto">
                                       {podeVerDetalheResultadoNoAtendimento && (
                                         <div className="flex items-center gap-1">
                                           <Badge variant="outline" className="bg-green-600 text-white border-green-600 text-[7px] px-1 py-0 rounded-sm">CONCLUÍDO</Badge>
                                           <Button 
                                             size="icon" 
                                             variant="ghost" 
                                             className="h-5 w-5 p-0 text-green-600 hover:text-green-700 hover:bg-green-100" 
                                             onClick={(e) => { 
                                               e.stopPropagation(); 
                                               const url = `${window.location.origin}/area-medica?review=${c.id}`;
                                               navigator.clipboard.writeText(url);
                                               toast.success(`Link de revisão de ${c.nome} copiado!`);
                                             }}
                                             title="Copiar link para Maurício"
                                           >
                                             <Link className="h-2.5 w-2.5" />
                                           </Button>
                                         </div>
                                       )}
                                      {canRecall && (
                                        <Button size="sm" variant="outline" className="h-5 px-1.5 text-[8px] font-bold border-orange-400 text-orange-600 hover:bg-orange-100"
                                          onClick={(e) => { e.stopPropagation(); handleRechamar(c, prof.nome); }}>
                                          <Volume2 className="h-2.5 w-2.5 mr-1" /> RECHAMAR
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Atendimento finalizado</p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          }

                          // queue or busy
                          const isBusy = status === "busy";
                          
                          return (
                            <Draggable 
                              key={`${c.id}::${prof.nome}`} 
                              draggableId={`${c.id}::${prof.nome}`} 
                              index={queueIndexById.get(c.id) ?? index}
                              isDragDisabled={!isDraggable}
                            >
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  onClick={() => !isBusy && handleClickCandidate(c, prof.nome)}
                                  className={cn(
                                    "rounded-lg border bg-card p-1.5 text-[10px] transition-all group relative flex flex-col h-[75px] justify-between",
                                    (isBusy || (isMedico(prof.nome) && !silvanaJaAtendeu(c)))
                                      ? "opacity-60 border-dashed"
                                      : "cursor-pointer hover:bg-accent hover:shadow-sm",
                                    isCadeado(c.id, prof.nome) && "ring-2 ring-amber-500 border-amber-500 bg-amber-50 dark:bg-amber-950/30",
                                    dragSnapshot.isDragging && "shadow-2xl ring-2 ring-primary/20 rotate-1 scale-105 z-50 bg-background"
                                  )}

                                >
                                  {isMaster && !isBusy && (
                                    <Button
                                      size="icon"
                                      variant={isCadeado(c.id, prof.nome) ? "default" : "outline"}
                                      className={cn(
                                        "absolute -top-2 -left-2 h-7 w-7 rounded-full z-20 shadow-lg border-2",
                                        isCadeado(c.id, prof.nome)
                                          ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600 animate-pulse"
                                          : "bg-white hover:bg-amber-50 border-amber-400 text-amber-600"
                                      )}
                                      onClick={(e) => { e.stopPropagation(); toggleCadeado(c.id, prof.nome); }}
                                      title={isCadeado(c.id, prof.nome) ? "Remover cadeado" : "Cadear (este será o próximo a ser atendido)"}
                                    >
                                      <Lock className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  {isMaster && !isBusy && (
                                    <Button 
                                      size="icon" 
                                      variant="destructive" 
                                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const motivoRemocao = prompt(`Deseja remover ${c.nome} da fila de ${prof.nome}? Digite o motivo:`, "Removido por Administrador Master");
                                        if (motivoRemocao === null) return;

                                        // Refetch fresh para não sobrescrever decisões de outros especialistas
                                        const { data: freshRow, error: freshError } = await supabase
                                          .from("candidatos")
                                          .select("status, observacoes, motivo_reprovacao")
                                          .eq("id", c.id)
                                          .single();
                                        if (freshError || !freshRow) {
                                          toast.error("Erro ao buscar candidato atualizado.");
                                          return;
                                        }
                                        const fresh: Candidato = { ...c, status: freshRow.status, observacoes: freshRow.observacoes || undefined, motivoReprovacao: freshRow.motivo_reprovacao || undefined };
                                        const resultados = getResultados(fresh).filter(r => r.nome.toLowerCase().trim() !== prof.nome.toLowerCase().trim());
                                        const newResult: Resultado = { nome: prof.nome, decisao: "reprovado", motivo: `NÃO SERÁ ATENDIDO: ${motivoRemocao}` };
                                        const allResults = [...resultados, newResult];
                                        const newObs = buildObservacoes(allResults, undefined, preserveHorasFromObs(fresh.observacoes), getOrdem(fresh));

                                        updateLocal(c.id, { observacoes: newObs });
                                        const { error: upErr } = await supabase.from("candidatos").update({ observacoes: newObs }).eq("id", c.id);
                                        if (upErr) {
                                          console.error("[Master Remove] update error:", upErr);
                                          toast.error("Erro ao remover: " + upErr.message);
                                          refresh();
                                          return;
                                        }
                                        await supabase.from("historico").insert({
                                          candidato_id: c.id,
                                          usuario: usuario?.login || "Sistema",
                                          data: new Date().toISOString().split("T")[0],
                                          hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                                          status_anterior: fresh.status,
                                          novo_status: fresh.status,
                                          observacao: `Removido da fila de ${prof.nome} por administrador master`,
                                        });
                                        toast.success(`${c.nome} removido da fila de ${prof.nome}.`);
                                        refresh();
                                      }}
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <div className="flex items-center gap-1 justify-between">
                                    <div className="flex items-center gap-1 min-w-0">
                                      {isDraggable && <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />}
                                      <p className="font-bold uppercase text-[10px] truncate">{c.nome}</p>
                                      <DiretoBadge indicacao={c.indicacao} />
                                    </div>
                                    {c.fretado && c.fretado.trim() !== "" && (
                                      <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 text-[7px] font-bold px-1 py-0 shrink-0">🚌 {c.fretado}</Badge>
                                    )}
                                  </div>
                                  <p className="text-muted-foreground text-[9px] truncate font-medium">{c.setor}</p>
                                  <div className="flex-1">
                                    {/* Indicação removida dos cards conforme solicitado para manter alinhamento */}
                                  </div>
                                  
                                  {isMedico(prof.nome) && (
                                    <div className="mt-auto pt-1">
                                      {silvanaJaAtendeu(c) ? (
                                        <Badge className="bg-green-600 text-white text-[8px] font-bold px-1 py-0.5 rounded-sm animate-pulse w-full justify-center">
                                          LIBERADO
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-300 text-[8px] font-bold px-1 py-0.5 rounded-sm w-full justify-center">
                                          AGUARDANDO
                                        </Badge>
                                      )}
                                    </div>
                                  )}

                                  {isBusy && (
                                    <div className="mt-auto pt-1">
                                      <Badge variant="outline" className="text-[8px] border-purple-300 text-purple-500 w-full justify-center">
                                        Com {getAtendente(c)}
                                      </Badge>
                                    </div>
                                  )}

                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                        {profSorted.length === 0 && (
                          <p className="text-center text-muted-foreground text-[10px] py-6 uppercase font-medium">Nenhum candidato na fila</p>
                        )}
                      </CardContent>
                    )}
                  </Droppable>
                </Card>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {false && !isLucianoMauricio && candidatosMedicos.length > 0 && (
        <Card className="border-t-4 border-t-primary shadow-lg">
          <CardHeader className="pb-4 bg-muted/20">
            <CardTitle className="text-base font-black uppercase flex items-center gap-3 text-primary">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <ListChecks className="h-5 w-5" />
              </div>
              ACOMPANHAMENTO POR ESPECIALIDADE ({candidatosMedicos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cadastro.map(prof => {
                const isExpanded = expandedProfs.includes(prof.nome);
                const atendidos = candidatosMedicos.filter(c => getResultados(c).some(r => r.nome.toLowerCase() === prof.nome.toLowerCase()));
                const pendentes = candidatosMedicos.filter(c => !getResultados(c).some(r => r.nome.toLowerCase() === prof.nome.toLowerCase()));
                
                return (
                  <div key={prof.nome} className="flex flex-col border rounded-xl overflow-hidden shadow-sm bg-card hover:shadow-md transition-all border-slate-200 h-full">
                    <div 
                      className={cn(
                        "p-3 flex items-center justify-between cursor-pointer select-none transition-colors h-[60px] shrink-0",
                        isExpanded ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted"
                      )}
                      onClick={() => {
                        setExpandedProfs(prev => 
                          prev.includes(prof.nome) ? prev.filter(p => p !== prof.nome) : [...prev, prof.nome]
                        );
                      }}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-black uppercase leading-tight truncate">{prof.especialidade || "GERAL"}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className="bg-white/20 text-current border-none h-5 px-1 text-[9px] font-black">
                          {atendidos.length}/{candidatosMedicos.length}
                        </Badge>
                        {isExpanded ? <ChevronDown className="h-4 w-4 opacity-70" /> : <ChevronRight className="h-4 w-4 opacity-70" />}
                      </div>
                    </div>

                    <div className={cn(
                      "flex-1 transition-all duration-200 overflow-hidden",
                      isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                    )}>
                      <div className="p-2 space-y-3 h-full overflow-y-auto bg-slate-50/50">
                        {/* Atendidos */}
                        <div className="space-y-1.5">
                          <p className="text-[8px] font-black text-green-600 uppercase ml-1 flex items-center gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5" /> CONCLUÍDOS ({atendidos.length})
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {atendidos.length > 0 ? atendidos.map(c => (
                              <Badge 
                                key={c.id} 
                                variant="outline" 
                                className="bg-green-100 text-green-700 border-green-200 text-[8px] font-bold py-0.5 px-1.5 uppercase shadow-sm whitespace-nowrap"
                              >
                                {c.nome.split(' ')[0]} {c.nome.split(' ')[1] || ''}
                              </Badge>
                            )) : (
                              <span className="text-[8px] text-muted-foreground italic ml-1">Nenhum</span>
                            )}
                          </div>
                        </div>

                        {/* Pendentes */}
                        <div className="space-y-1.5">
                          <p className="text-[8px] font-black text-red-600 uppercase ml-1 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" /> PENDENTES ({pendentes.length})
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {pendentes.length > 0 ? pendentes.map(c => (
                              <Badge 
                                key={c.id} 
                                variant="outline" 
                                className="bg-red-50 text-red-600 border-red-200 text-[8px] font-bold py-0.5 px-1.5 uppercase shadow-sm whitespace-nowrap"
                              >
                                {c.nome.split(' ')[0]} {c.nome.split(' ')[1] || ''}
                              </Badge>
                            )) : (
                              <span className="text-[8px] text-muted-foreground italic ml-1">Nenhum</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      </>
      )}
    </div>
  );
}

function ResultadoBadges({ resultados }: { resultados: Resultado[] }) {
  if (resultados.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {resultados.map((r, i) => (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <span className={cn(
              "inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold border",
              r.decisao === "aprovado"
                ? "bg-green-100 text-green-700 border-green-300"
                : "bg-red-100 text-red-700 border-red-300"
            )}>
              {r.decisao === "aprovado" ? "✓" : "✗"}
            </span>
          </TooltipTrigger>
          <TooltipContent><p className="text-xs max-w-[200px]">{r.nome}{r.motivo ? `: ${r.motivo}` : ''}</p></TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

/* ========== Mauricio Simplified Approval View ========== */
function MauricioApprovalView({
  candidatos,
  usuario,
  updateLocal,
  refresh,
  showLucianoMessage,
  setShowLucianoMessage,
  lucianoMessage,
  setLucianoMessage
}: {
  candidatos: Candidato[];
  usuario: any;
  updateLocal: (id: string, changes: Partial<Candidato>) => void;
  refresh: () => void;
  showLucianoMessage: boolean;
  setShowLucianoMessage: (v: boolean) => void;
  lucianoMessage: string;
  setLucianoMessage: (v: string) => void;
}) {

  const [motivoDialog, setMotivoDialog] = useState<Candidato | null>(null);
  const [motivo, setMotivo] = useState("");

  const mauricioNome = usuario?.nome || "Mauricio";

  // Separate: pending (not yet decided by Mauricio) vs decided
  const pending = candidatos.filter(c => {
    const results = getResultados(c);
    return !results.some(r => r.nome.toLowerCase() === mauricioNome.toLowerCase());
  });

  const decided = candidatos.filter(c => {
    const results = getResultados(c);
    return results.some(r => r.nome.toLowerCase() === mauricioNome.toLowerCase());
  });

  const handleAprovar = async (c: Candidato) => {
    const isMasterReviewer = ["mauricio", "luciano", "sonia"].includes(mauricioNome.toLowerCase().trim());
    const existingResults = getResultados(c);
    const newResult: Resultado = { nome: mauricioNome, decisao: "aprovado", motivo: isMasterReviewer ? "" : undefined };
    const allResults = [...existingResults, newResult];
    const newObs = buildObservacoes(allResults, undefined, preserveHorasFromObs(c.observacoes), getOrdem(c));

    // Sonia's approval is final
    updateLocal(c.id, { observacoes: newObs, status: "aprovado" });
    toast.success(`${c.nome} — APROVADO por ${mauricioNome}`);
    
    supabase.from("candidatos").update({ observacoes: newObs, status: "aprovado" }).eq("id", c.id);
    supabase.from("historico").insert({
      candidato_id: c.id,
      usuario: usuario?.login || "mauricio",
      data: new Date().toISOString().split("T")[0],
      hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      status_anterior: c.status,
      novo_status: "aprovado",
      observacao: `Aprovado por ${mauricioNome}`,
    });
  };

  const handleReprovar = async (c: Candidato, motivoText: string) => {
    if (!motivoText.trim()) {
      toast.error("Informe o motivo da reprovação.");
      return;
    }
    const existingResults = getResultados(c);
    const newResult: Resultado = { nome: mauricioNome, decisao: "reprovado", motivo: motivoText.trim() };
    const allResults = [...existingResults, newResult];
    const newObs = buildObservacoes(allResults, undefined, preserveHorasFromObs(c.observacoes), getOrdem(c));

    // Sonia's reproval is final
    updateLocal(c.id, { observacoes: newObs, status: "reprovado" });
    toast.success(`${c.nome} — NÃO APROVADO por ${mauricioNome}`);
    setMotivoDialog(null);
    setMotivo("");

    supabase.from("candidatos").update({ 
      observacoes: newObs, 
      status: "reprovado",
      motivo_reprovacao: `${mauricioNome}: ${motivoText.trim()}`
    }).eq("id", c.id);
    supabase.from("historico").insert({
      candidato_id: c.id,
      usuario: usuario?.login || "mauricio",
      data: new Date().toISOString().split("T")[0],
      hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      status_anterior: c.status,
      novo_status: "reprovado",
      observacao: `Reprovado por ${mauricioNome}: ${motivoText.trim()}`,
    });
  };

  return (
    <>
      {/* Luciano Panel Message Dialog */}
      <Dialog open={showLucianoMessage} onOpenChange={setShowLucianoMessage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mensagem para o Painel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">O que você escrever abaixo aparecerá na tela da TV:</p>
            <Textarea 
              value={lucianoMessage} 
              onChange={e => setLucianoMessage(e.target.value)} 
              placeholder="Digite sua mensagem aqui..." 
              className="min-h-[100px]" 
            />
            <div className="flex gap-2">
              <Button 
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold" 
                onClick={async () => {
                  if (!lucianoMessage.trim()) {
                    toast.error("Escreva uma mensagem primeiro.");
                    return;
                  }
                  toast.loading("Enviando para o painel...");
                  try {
                    await supabase.channel('luciano-painel-recv').send({
                      type: 'broadcast',
                      event: 'mensagem-luciano',
                      payload: { message: lucianoMessage.trim(), audio: true }
                    });
                    toast.dismiss();
                    toast.success("Mensagem enviada com sucesso!");
                    setShowLucianoMessage(false);
                    setLucianoMessage("");
                  } catch (err) {
                    toast.dismiss();
                    toast.error("Erro ao enviar mensagem.");
                  }
                }}
              >
                Enviar para TV
              </Button>
              <Button variant="outline" onClick={() => setShowLucianoMessage(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Motivo reprovação dialog */}
      <Dialog open={!!motivoDialog} onOpenChange={open => { if (!open) { setMotivoDialog(null); setMotivo(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar — {motivoDialog?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Informe o motivo da reprovação (obrigatório):</p>
            <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Descreva o motivo..." className="min-h-[100px]" />
            <div className="flex gap-2">
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold" onClick={() => motivoDialog && handleReprovar(motivoDialog, motivo)}>
                Confirmar Reprovação
              </Button>
              <Button variant="outline" onClick={() => { setMotivoDialog(null); setMotivo(""); }}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pending list */}
      <Card className="border-t-4 border-t-primary">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold uppercase flex items-center gap-2">
            <Users className="h-4 w-4" /> Aguardando Aprovação ({pending.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-3">
          {pending.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-6">Nenhum candidato pendente</p>
          )}
          {pending.map(c => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border bg-card p-4 gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold uppercase text-sm truncate">{c.nome}</p>
                <p className="text-xs text-muted-foreground truncate">{c.setor} • {c.funcao}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button className="h-10 px-5 font-bold bg-green-600 hover:bg-green-700 text-white text-sm"
                  onClick={() => handleAprovar(c)}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> SIM
                </Button>
                <Button className="h-10 px-5 font-bold bg-red-600 hover:bg-red-700 text-white text-sm"
                  onClick={() => setMotivoDialog(c)}>
                  <XCircle className="h-4 w-4 mr-1" /> NÃO
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Decided list */}
      {decided.length > 0 && (
        <Card className="border-t-4 border-t-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Já Avaliados ({decided.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-2">
              {decided.map(c => {
                const result = getResultados(c).find(r => r.nome.toLowerCase() === mauricioNome.toLowerCase());
                const approved = result?.decisao === "aprovado";
                return (
                  <div key={c.id} className="flex items-center gap-1">
                    <Badge variant="outline" className={cn(
                      "text-xs font-bold py-1 px-3",
                      approved
                        ? "bg-green-50 text-green-700 border-green-300"
                        : "bg-red-50 text-red-700 border-red-300"
                    )}>
                      {approved ? "✓" : "✗"} {c.nome}
                    </Badge>
                    {!approved && (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-primary" 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          const url = `${window.location.origin}/area-medica?review=${c.id}`;
                          navigator.clipboard.writeText(url);
                          toast.success(`Link de revisão de ${c.nome} copiado!`);
                        }}
                        title="Copiar link para Maurício"
                      >
                        <Link className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
