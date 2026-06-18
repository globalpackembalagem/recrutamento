import { useMemo, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useCandidatos, useClosedDates } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import * as db from "@/lib/supabaseData";
import type { Candidato } from "@/lib/supabaseData";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Search, Users, UserCheck, UserX, Clock, Lock, Undo2, CalendarCheck, ClipboardCheck, UserPlus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn, normalizeDateKey, parseOrigem } from "@/lib/utils";
import AddCandidatoDialog from "@/components/AddCandidatoDialog";
import CandidatoDialog from "@/components/CandidatoDialog";

const PORTARIA_INTEGRACAO_STATUS = [
  "aguardando_presenca",
  "aguardando_portaria",
  "presente",
  "ausente",
  "na_fila_atendimento",
  "em_atendimento",
  "atendido",
] as const;

export default function Portaria() {
  const { candidatos, loading, refresh } = useCandidatos();
  const { closedDates } = useClosedDates();
  const { usuario } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "admissao" ? "admissao" : "integracao";
  const [search, setSearch] = useState("");
  const [encerrado, setEncerrado] = useState(false);
  const [confirmCandidate, setConfirmCandidate] = useState<Candidato | null>(null);
  const [undoCandidate, setUndoCandidate] = useState<Candidato | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editCandidate, setEditCandidate] = useState<Candidato | null>(null);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const scrollRef = useMemo(() => ({ current: null as HTMLDivElement | null }), []);

  // Não fazer auto-scroll ao marcar presença — manter a posição atual do usuário


  const loginLower = usuario?.login?.toLowerCase() || "";
  const isMaster = usuario?.perfil === "admin" || ["luciano", "mauricio", "sonia"].includes(loginLower);
  const isSonia = loginLower === "sonia";
  const canAddManual = isMaster || isSonia;
  const canEditarPortaria = isMaster || !!usuario?.acessoPortaria;
  const handleChangeView = useCallback((nextView: "integracao" | "admissao") => {
    setSearchParams({ view: nextView });
  }, [setSearchParams]);

  const [alteracoesBloqueadas, setAlteracoesBloqueadas] = useState(false);

  useEffect(() => {
    db.isPortariaBloqueada().then(setEncerrado);
    db.isAlteracoesBloqueadas().then(setAlteracoesBloqueadas);
    const unsub = db.subscribeToClosedDates(() => {
      db.isPortariaBloqueada().then(setEncerrado);
      db.isAlteracoesBloqueadas().then(setAlteracoesBloqueadas);
      refresh();
    });
    return unsub;
  }, [refresh]);

  // INTEGRAÇÃO: candidates for daily presence check
  const closedDateSet = useMemo(() => new Set(closedDates.map(normalizeDateKey)), [closedDates]);

  const integracaoCandidatos = useMemo(() => {
    const abertos = candidatos
      .filter(c => PORTARIA_INTEGRACAO_STATUS.includes(c.status as typeof PORTARIA_INTEGRACAO_STATUS[number]))
      .filter(c => {
        const integrationDate = normalizeDateKey(c.dataIntegracao);
        return !!integrationDate && !closedDateSet.has(integrationDate);
      });
    const dataAtiva = abertos
      .map(c => normalizeDateKey(c.dataIntegracao))
      .sort((a, b) => b.localeCompare(a))[0];
    return abertos
      .filter(c => normalizeDateKey(c.dataIntegracao) === dataAtiva)
      .filter(c => !search || c.nome.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        // Mantenha o que acabou de ser marcado no topo se houver busca ou algo similar
        // Mas a regra principal é alfabética conforme pedido anteriormente
        return a.nome.localeCompare(b.nome);
      });
  }, [candidatos, search, closedDateSet]);

  // ADMISSÃO: candidates approved / with doc_ok / data_inicio_definida / iniciado
  const admissaoCandidatos = useMemo(() => {
    return candidatos
      .filter(c => ["aprovado", "doc_ok", "data_inicio_definida", "iniciado"].includes(c.status))
      .filter(c => !search || c.nome.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [candidatos, search]);

  const stats = useMemo(() => {
    const list = view === "integracao" ? integracaoCandidatos : admissaoCandidatos;
    if (view === "integracao") {
      const s = { total: 0, presentes: 0, ausentes: 0, aguardando: 0, masculino: 0, feminino: 0,
        presM: 0, presF: 0, presFretado: 0, presFretadoM: 0, presFretadoF: 0,
        fretados: {} as Record<string, number>,
        diretoTotal: 0, diretoVarzea: 0, diretoCampinas: 0, diretoOutros: 0 };
      list.forEach(c => {
        s.total++;
        const isPresente = c.status === "presente" || c.status === "na_fila_atendimento" || c.status === "em_atendimento" || c.status === "atendido";
        if (isPresente) s.presentes++;
        else if (c.status === "ausente") s.ausentes++;
        else if (c.status === "aguardando_presenca" || c.status === "aguardando_portaria") s.aguardando++;
        const sexo = (c.sexo || "").toString().trim().toUpperCase();
        const isM = sexo === "M" || sexo === "MASCULINO";
        const isF = sexo === "F" || sexo === "FEMININO";
        if (isM) { s.masculino++; if (isPresente) s.presM++; }
        else if (isF) { s.feminino++; if (isPresente) s.presF++; }
        if (isPresente && c.fretado && c.fretado.trim()) {
          s.presFretado++;
          if (isM) s.presFretadoM++;
          else if (isF) s.presFretadoF++;
          const key = c.fretado.trim().toUpperCase();
          s.fretados[key] = (s.fretados[key] || 0) + 1;
        }
        const { origem, nome } = parseOrigem(c.indicacao);
        if (origem === "direto") {
          s.diretoTotal++;
          const n = (nome || "").toUpperCase();
          if (n.includes("VARZEA") || n.includes("VÁRZEA")) s.diretoVarzea++;
          else if (n.includes("CAMPINAS")) s.diretoCampinas++;
          else s.diretoOutros++;
        }
      });
      return s;
    }
    return { total: list.length, presentes: 0, ausentes: 0, aguardando: 0, masculino: 0, feminino: 0,
      presM: 0, presF: 0, presFretado: 0, presFretadoM: 0, presFretadoF: 0,
      fretados: {} as Record<string, number>,
      diretoTotal: 0, diretoVarzea: 0, diretoCampinas: 0, diretoOutros: 0 };
  }, [view, integracaoCandidatos, admissaoCandidatos]);

  const handleClick = useCallback((c: Candidato) => {
    if (c.status === "presente" || c.status === "na_fila_atendimento" || c.status === "em_atendimento" || c.status === "atendido") return;
    if (c.status === "ausente") return;
    if ((encerrado || alteracoesBloqueadas) && !isMaster) { toast.error("Alterações bloqueadas pelo RH."); return; }
    setConfirmCandidate(c);
  }, [encerrado, alteracoesBloqueadas, isMaster]);

  const handleConfirmPresenca = useCallback(async () => {
    if (!confirmCandidate) return;
    const c = confirmCandidate;
    setConfirmCandidate(null);
    setLastSelectedId(c.id);
    try {
      await db.marcarPresenca(c.id);
      toast.success(`${c.nome} — PRESENTE ✓`);
      refresh();
      setTimeout(async () => {
        await db.enviarParaFila(c.id);
        refresh();
      }, 500);
    } catch (err) {
      console.error("Erro ao marcar presença:", err);
      toast.error("Erro ao marcar presença.");
    }
  }, [confirmCandidate, refresh]);

  const handleDesfazer = (c: Candidato, e: React.MouseEvent) => {
    e.stopPropagation();
    setUndoCandidate(c);
  };

  const handleConfirmDesfazer = useCallback(async () => {
    if (!undoCandidate) return;
    const c = undoCandidate;
    setUndoCandidate(null);
    await db.updateCandidatoStatus(c.id, "aguardando_presenca", "Portaria", "Presença desfeita");
    toast.info(`Presença de ${c.nome} desfeita.`);
    refresh();
  }, [undoCandidate, refresh]);

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground text-lg">Carregando...</div>;

  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  const renderIntegracaoCard = (c: Candidato) => {
    const isPresente = c.status === "presente" || c.status === "na_fila_atendimento" || c.status === "em_atendimento" || c.status === "atendido";
    const isAusente = c.status === "ausente";
    const isAguardando = c.status === "aguardando_presenca" || c.status === "aguardando_portaria";
    const canMark = isAguardando && (isMaster || canEditarPortaria || (!encerrado && !alteracoesBloqueadas));

    return (
      <Card
        key={c.id}
        id={`candidate-${c.id}`}
        onClick={() => canMark && handleClick(c)}
        className={cn(
          "transition-all duration-200 border-l-4",
          isPresente && "border-l-green-500 bg-green-50 dark:bg-green-950/30",
          isAusente && "border-l-red-400 bg-red-50/50 dark:bg-red-950/20 opacity-60",
          isAguardando && "border-l-amber-400 bg-background",
          canMark && "cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/20 hover:shadow-md active:scale-[0.99]",
          lastSelectedId === c.id && "ring-2 ring-primary ring-offset-2"
        )}
      >
        <CardContent className="p-2 flex items-center justify-between gap-1.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={cn("text-sm sm:text-base font-bold uppercase leading-tight break-words", isAusente && "line-through text-muted-foreground")}>{c.nome}</p>
              {(() => {
                const { origem } = parseOrigem(c.indicacao);
                if (!origem) return null;
                const isAg = origem === "agencia";
                const short = isAg ? "A" : "D";
                const full = isAg ? "AGÊNCIA" : "DIRETO";
                const color = isAg
                  ? "bg-blue-100 text-blue-700 border-blue-300"
                  : "bg-green-100 text-green-700 border-green-300";
                return (
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] font-bold px-1.5 py-0 shrink-0", color)}
                    title={full}
                  >
                    {isMaster ? full : short}
                  </Badge>
                );
              })()}
              {c.fretado && c.fretado.trim() !== "" && (
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 text-[10px] font-bold px-1.5 py-0 shrink-0">
                  🚌 {c.fretado}
                </Badge>
              )}
            </div>
            {c.dataIntegracao && (
              <p className="text-[10px] text-muted-foreground mt-0.5">Integração: {c.dataIntegracao || c.dataImportacao}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isPresente && c.horaPresenca && (
              <span className="text-xs font-mono font-bold text-green-700">{c.horaPresenca}</span>
            )}
            {isPresente && (
              <>
                <Badge className="bg-green-600 text-white text-[10px] font-bold px-2 py-0.5">PRESENTE</Badge>
                {(!encerrado || canEditarPortaria) && (
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={(e) => handleDesfazer(c, e)}>
                    <Undo2 className="h-3 w-3" />
                  </Button>
                )}
              </>
            )}
            {isAusente && (
              <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 text-[10px] font-bold px-2 py-0.5">AUSENTE</Badge>
            )}
            {isAguardando && (
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold px-2 py-0.5 animate-pulse">AGUARDANDO</Badge>
            )}
            {canAddManual && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                onClick={(e) => { e.stopPropagation(); setEditCandidate(c); }}
                title="Editar candidato"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderAdmissaoCard = (c: Candidato) => {
    const statusLabel: Record<string, string> = {
      aprovado: "APROVADO",
      doc_ok: "DOCUMENTOS OK",
      data_inicio_definida: "DATA DEFINIDA",
      iniciado: "INICIOU",
    };
    const statusColor: Record<string, string> = {
      aprovado: "bg-blue-100 text-blue-700 border-blue-300",
      doc_ok: "bg-green-100 text-green-700 border-green-300",
      data_inicio_definida: "bg-purple-100 text-purple-700 border-purple-300",
      iniciado: "bg-emerald-100 text-emerald-700 border-emerald-300",
    };

    return (
      <Card key={c.id} className="transition-all duration-200 border-l-4 border-l-blue-500">
        <CardContent className="p-3 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold uppercase truncate">{c.nome}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {c.funcao && <span className="text-[10px] text-muted-foreground">{c.funcao}</span>}
              {c.setor && <span className="text-[10px] text-muted-foreground">• {c.setor}</span>}
              {c.dataInicio && <span className="text-[10px] font-semibold text-primary">• Início: {c.dataInicio}</span>}
            </div>
          </div>
          <Badge variant="outline" className={`text-[10px] font-bold px-2 py-0.5 ${statusColor[c.status] || ""}`}>
            {statusLabel[c.status] || c.status.toUpperCase()}
          </Badge>
        </CardContent>
      </Card>
    );
  };

  const filtered = view === "integracao" ? integracaoCandidatos : admissaoCandidatos;

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] overflow-hidden">
      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmCandidate} onOpenChange={(open) => { if (!open) setConfirmCandidate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Presença</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Confirmar presença de <strong className="text-foreground">{confirmCandidate?.nome}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPresenca} className="bg-green-600 hover:bg-green-700">
              Sim, Presente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Undo Confirmation Dialog */}
      <AlertDialog open={!!undoCandidate} onOpenChange={(open) => { if (!open) setUndoCandidate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer Presença</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Deseja desfazer a presença de <strong className="text-foreground">{undoCandidate?.nome}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDesfazer} className="bg-destructive hover:bg-destructive/90">
              Sim, Desfazer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fixed Header */}
      <div className="shrink-0 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter text-primary">
              Portaria
            </h1>
            <p className="text-xs text-muted-foreground font-medium capitalize">{hoje}</p>
          </div>
          {canAddManual && (
            <Button size="sm" onClick={() => setAddOpen(true)} className="bg-primary font-bold gap-1 shadow-sm">
              <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">Adicionar</span>
            </Button>
          )}
        </div>

        {view === "integracao" && encerrado && (
          <div className="flex items-center gap-3">
            <Badge className="bg-destructive text-destructive-foreground text-sm px-4 py-2">
              <Lock className="mr-2 h-4 w-4" /> PRESENÇA BLOQUEADA PELO RH
            </Badge>
            {isMaster && (
              <Badge className="bg-primary text-primary-foreground text-xs px-3 py-1">
                MASTER — LIBERADO
              </Badge>
            )}
          </div>
        )}

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="pl-9 text-base h-10" 
            />
          </div>
        </div>

        {/* Dash */}
        {view === "integracao" ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* TOTAL */}
            <div className="rounded-lg border bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
                <Users className="h-3 w-3" /> Total
              </div>
              <div className="mt-0.5 text-2xl font-extrabold leading-none text-slate-800 dark:text-slate-100">{stats.total}</div>
              <div className="mt-1 text-[10px] text-slate-500 font-semibold">
                M: {stats.masculino} · F: {stats.feminino}
              </div>
            </div>

            {/* PRESENTES */}
            <div className="rounded-lg border border-green-200 bg-gradient-to-br from-green-50 to-emerald-100 p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-green-700">
                <UserCheck className="h-3 w-3" /> Presentes
              </div>
              <div className="mt-0.5 text-2xl font-extrabold leading-none text-green-800">{stats.presentes}</div>
              <div className="mt-1 flex gap-1 flex-wrap">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">M {stats.presM}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-pink-100 text-pink-700">F {stats.presF}</span>
              </div>
            </div>

            {/* AGUARDANDO */}
            <div className="rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-amber-700">
                <Clock className="h-3 w-3" /> Aguardando
              </div>
              <div className="mt-0.5 text-2xl font-extrabold leading-none text-amber-800">{stats.aguardando}</div>
              <div className="mt-1 text-[10px] text-amber-600 font-semibold">
                Ausentes: {stats.ausentes}
              </div>
            </div>

            {/* FRETADOS */}
            <div className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-sky-100 p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-blue-700">
                🚌 Fretados (pres.)
              </div>
              <div className="mt-0.5 text-2xl font-extrabold leading-none text-blue-800">{stats.presFretado}</div>
              <div className="mt-1 flex gap-1 flex-wrap">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">M {stats.presFretadoM}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-pink-100 text-pink-700">F {stats.presFretadoF}</span>
              </div>
            </div>

            {/* DIRETOS (full width) */}
            {stats.diretoTotal > 0 && (
              <div className="col-span-2 sm:col-span-4 rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase text-emerald-700">Direto</span>
                    <span className="text-lg font-extrabold text-emerald-800">{stats.diretoTotal}</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap text-[10px] font-bold uppercase">
                    {stats.diretoVarzea > 0 && (
                      <span className="px-2 py-1 rounded bg-white/70 border border-emerald-200 text-emerald-700">Várzea A+B: {stats.diretoVarzea}</span>
                    )}
                    {stats.diretoCampinas > 0 && (
                      <span className="px-2 py-1 rounded bg-white/70 border border-emerald-200 text-emerald-700">Campinas: {stats.diretoCampinas}</span>
                    )}
                    {stats.diretoOutros > 0 && (
                      <span className="px-2 py-1 rounded bg-white/70 border border-emerald-200 text-emerald-700">Outros: {stats.diretoOutros}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase">
            <div className="bg-muted px-2 py-1 rounded-md border flex items-center gap-1.5">
              <Users className="h-3 w-3" />
              <span>Total: {stats.total}</span>
            </div>
          </div>
        )}
      </div>

      {/* Scrollable List */}
      <div className="flex-1 overflow-y-auto mt-4 pr-1">
        {filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground text-base">
            {view === "integracao" ? "Nenhum candidato encontrado para integração." : "Nenhum candidato em processo de admissão."}
          </CardContent></Card>
        ) : view === "integracao" ? (
          <div className="space-y-2">{filtered.map(renderIntegracaoCard)}</div>
        ) : (
          <div className="space-y-2">{filtered.map(renderAdmissaoCard)}</div>
        )}
      </div>
      <AddCandidatoDialog open={addOpen} onClose={() => setAddOpen(false)} onAdded={refresh} />
      <CandidatoDialog
        candidato={editCandidate}
        open={!!editCandidate}
        onClose={() => setEditCandidate(null)}
        onUpdated={() => { refresh(); setEditCandidate(null); }}
        portariaView={view}
      />
    </div>
  );
}
