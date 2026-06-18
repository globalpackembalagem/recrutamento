import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { CheckCircle, Lock, Download, ChevronDown, ChevronRight, X, Activity, Link as LinkIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDate } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import * as db from "@/lib/supabaseData";
import type { Candidato } from "@/lib/supabaseData";
import { getUsuarios } from "@/lib/usuarioData";
import * as XLSX from "xlsx";

interface DecisaoAprovador {
  profNome: string;
  decisao: "aprovado" | "reprovado" | "pre_aprovado";
  motivo?: string;
}

interface CandidatoComDecisoes {
  candidato: Candidato;
  decisoes: DecisaoAprovador[];
}

interface ResultadoViewProps {
  candidatos: Candidato[];
  resultadoLiberado: boolean;
  setResultadoLiberado: (v: boolean) => void;
  setSelected: (c: Candidato) => void;
  onRefresh: () => void;
  readOnly?: boolean;
  canEditDecisions?: boolean;
  currentUserName?: string;
  currentUserLogin?: string;
  closedDates?: string[];
}

export default function ResultadoView({ candidatos, resultadoLiberado, setResultadoLiberado, setSelected, onRefresh, readOnly = false, canEditDecisions = false, currentUserName = "", currentUserLogin = "", closedDates = [] }: ResultadoViewProps) {
  const [aprovadores, setAprovadores] = useState<string[]>([]);
  const [candidatosDecisoes, setCandidatosDecisoes] = useState<CandidatoComDecisoes[]>([]);
  const [loadingResult, setLoadingResult] = useState(true);
  const [alteracoesBloqueadas, setAlteracoesBloqueadas] = useState(false);
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const [reprovarDialog, setReprovarDialog] = useState<{ candidatoId: string; profNome: string; candidatoNome: string } | null>(null);
  const [reprovarMotivo, setReprovarMotivo] = useState("");
  const [editPreDialog, setEditPreDialog] = useState<{ candidatoId: string; profNome: string; candidatoNome: string; motivo: string } | null>(null);

  const getResultadoDate = (c: Candidato) => {
    const isValidIntegrationDate = (date?: string) => /^\d{4}-\d{2}-\d{2}$/.test(date || "") && Number(date?.slice(0, 4)) >= 2000;
    return isValidIntegrationDate(c.dataIntegracao) ? c.dataIntegracao! : (c.dataPresenca || c.dataImportacao || c.dataIntegracao || "sem-data");
  };

  useEffect(() => {
    db.isAlteracoesBloqueadas().then(setAlteracoesBloqueadas);
  }, []);

  // Sempre abertos por padrão (mostra aprovados e pré-aprovados expandidos)
  // O usuário pode recolher manualmente clicando no cabeçalho.

  useEffect(() => {
    async function load() {
      const users = await getUsuarios();
      const allowedResultAliases: Record<string, string[]> = {
        michelli: ["michelli", "michele", "micheli"],
        silvana: ["silvana"],
        mauricio: ["mauricio"],
      };
      const nomes = users
        .filter(u => u.ativo && u.acessoAprovar)
        .map(u => String(u.nome || "").trim())
        .filter(nome => {
          const normalized = nome.toLowerCase();
          return Object.values(allowedResultAliases).some(aliases => aliases.includes(normalized));
        });
      setAprovadores(nomes);

      const decididos = candidatos.filter(c =>
        ["presente", "na_fila_atendimento", "em_atendimento", "aprovado", "reprovado", "atendido", "finalizado", "doc_ok"].includes(c.status) ||
        !!c.dataPresenca ||
        (c.observacoes && c.observacoes.includes("resultado:"))
      ).sort((a, b) => a.nome.localeCompare(b.nome));

      if (decididos.length === 0) { setCandidatosDecisoes([]); setLoadingResult(false); return; }

      const result: CandidatoComDecisoes[] = decididos.map(c => {
        const decisoes: DecisaoAprovador[] = [];
        if (c.observacoes) {
          c.observacoes.split('|')
            .filter(p => p.startsWith('resultado:'))
            .forEach(p => {
              const parts = p.split(':');
              const profNome = parts[1] || '';
              const decisao = (parts[2] || '') as "aprovado" | "reprovado" | "pre_aprovado";
              const motivo = parts.slice(3).join(':') || undefined;
              if (profNome && decisao) {
                decisoes.push({ profNome, decisao, motivo });
              }
            });
        }
        return { candidato: c, decisoes };
      });

      // Auto-aplica Resultado Final baseado em Michelli+Silvana mesmo sem Mauricio avaliar.
      // Mauricio pode sobrescrever depois (decisão dele prevalece).
      for (const cd of result) {
        const c = cd.candidato;
        const michelliD = cd.decisoes.find(d => ["michelli", "michele", "micheli"].includes(d.profNome.toLowerCase().trim()));
        const silvanaD = cd.decisoes.find(d => d.profNome.toLowerCase().trim() === "silvana");
        const mauricioD = cd.decisoes.find(d => ["mauricio", "maurício", "luciano", "sonia", "sônia"].includes(d.profNome.toLowerCase().trim()));

        // Se Mauricio já avaliou, respeita decisão dele — não mexe
        if (mauricioD) continue;

        let novoStatus: string | null = null;
        let novoMotivo: string | null = null;
        let autoMauricioAprovado = false;
        if (michelliD?.decisao === "aprovado" && silvanaD?.decisao === "aprovado") {
          novoStatus = "aprovado";
          novoMotivo = null;
          autoMauricioAprovado = true;
        } else if (michelliD?.decisao === "reprovado" && silvanaD?.decisao === "reprovado") {
          novoStatus = "reprovado";
          novoMotivo = cd.decisoes.filter(d => d.decisao === "reprovado").map(d => `${d.profNome}: ${d.motivo || "sem motivo"}`).join("; ");
        } else if (
          (michelliD?.decisao === "reprovado" && silvanaD?.decisao === "aprovado") ||
          (michelliD?.decisao === "aprovado" && silvanaD?.decisao === "reprovado")
        ) {
          // Divergência: uma aprovou, outra reprovou → PENDENTE
          novoStatus = "atendido";
          novoMotivo = cd.decisoes.filter(d => d.decisao === "reprovado").map(d => `${d.profNome}: ${d.motivo || "sem motivo"}`).join("; ");
        }
        const updates: Record<string, any> = {};
        if (novoStatus && novoStatus !== c.status) {
          updates.status = novoStatus;
          updates.motivo_reprovacao = novoMotivo;
          c.status = novoStatus as any;
          c.motivoReprovacao = novoMotivo || undefined;
        }
        if (autoMauricioAprovado) {
          // Persist auto Mauricio approval so the column shows APROVADO (alterável)
          const novaObs = `${c.observacoes || ""}${c.observacoes ? "|" : ""}resultado:mauricio:aprovado:auto`;
          updates.observacoes = novaObs;
          c.observacoes = novaObs;
          cd.decisoes.push({ profNome: "mauricio", decisao: "aprovado", motivo: "auto" });
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from("candidatos").update(updates).eq("id", c.id);
        }
      }

      setCandidatosDecisoes(result);
      setLoadingResult(false);
    }
    load();
  }, [candidatos]);

  // Filter visible columns: master/sonia see all, others see only their own
  const isLuciano = currentUserLogin.toLowerCase() === "luciano";
  const isMaster = ["luciano", "mauricio", "sonia"].includes(currentUserLogin.toLowerCase());
  const isMasterOrMauricio = isMaster || ["mauricio"].includes(currentUserLogin.toLowerCase());
  const isMauricio = currentUserLogin.toLowerCase() === "mauricio" || currentUserName.toLowerCase() === "mauricio";
  const normalizeAllowedResultName = (name: string) => {
    const normalized = name.toLowerCase().trim();
    if (["michelli", "michele", "micheli"].includes(normalized)) return "michelli";
    if (normalized === "silvana") return "silvana";
    if (["mauricio", "maurício", "luciano", "sonia", "sônia"].includes(normalized)) return "mauricio";
    return normalized;
  };


  const visibleAprovadores = useMemo(() => {
    if (isMaster) {
      // Master sees all 3 columns
      return aprovadores.filter(p => ["michelli", "silvana", "mauricio"].includes(normalizeAllowedResultName(p)));
    }
    if (isMauricio) {
      // Mauricio sees michelli, silvana, mauricio
      return aprovadores.filter(p => ["michelli", "silvana", "mauricio"].includes(normalizeAllowedResultName(p)));
    }
    // Other users see only their own column (Mauricio column NOT visible to them)
    const currentNormalized = normalizeAllowedResultName(currentUserName);
    return aprovadores.filter(p => {
      const norm = normalizeAllowedResultName(p);
      return norm === currentNormalized && norm !== "mauricio";
    });
  }, [aprovadores, isMaster, isMauricio, currentUserName]);

  // For Sonia: determine which columns she can see per candidate (only after she voted)
  const soniaHasVoted = (decisoes: DecisaoAprovador[]) => {
    return decisoes.some(d => normalizeAllowedResultName(d.profNome) === "sonia");
  };

  // "Integração em vigor" = most recent dataImportacao among all candidates.
  // Stats no topo e por atendente devem refletir apenas esse lote ativo.
  const loteAtivo = useMemo(() => {
    const datas = candidatosDecisoes
      .map(c => c.candidato.dataImportacao)
      .filter(Boolean) as string[];
    if (datas.length === 0) return null;
    return datas.sort((a, b) => b.localeCompare(a))[0];
  }, [candidatosDecisoes]);

  const candidatosLoteAtivo = useMemo(() => {
    if (!loteAtivo) return candidatosDecisoes;
    return candidatosDecisoes.filter(c => c.candidato.dataImportacao === loteAtivo);
  }, [candidatosDecisoes, loteAtivo]);

  const candidatosAbertos = useMemo(
    () => candidatosDecisoes.filter(c => !closedDates.includes(getResultadoDate(c.candidato))),
    [candidatosDecisoes, closedDates]
  );
  // Integração ativa = data de integração aberta mais recente
  const integracaoAtiva = useMemo(() => {
    const datas = candidatosAbertos
      .map(c => getResultadoDate(c.candidato))
      .filter(d => d !== "sem-data" && !closedDates.includes(d));
    if (datas.length === 0) return null;
    return datas.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  }, [candidatosAbertos, closedDates]);
  const candidatosIntegracaoAtiva = useMemo(
    () => integracaoAtiva ? candidatosAbertos.filter(c => getResultadoDate(c.candidato) === integracaoAtiva) : candidatosAbertos,
    [candidatosAbertos, integracaoAtiva]
  );
  const totalAprovados = candidatosIntegracaoAtiva.filter(c => c.candidato.status === "aprovado").length;
  const totalReprovados = candidatosIntegracaoAtiva.filter(c => c.candidato.status === "reprovado").length;
  const totalPreAprovados = candidatosIntegracaoAtiva.filter(c => c.decisoes.some(d => d.decisao === "pre_aprovado")).length;
  const [showReprovadosDialog, setShowReprovadosDialog] = useState<{ items: CandidatoComDecisoes[]; label: string } | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showMotivosDialog, setShowMotivosDialog] = useState<{ items: CandidatoComDecisoes[]; label: string; kind: "aprovado" | "pre_aprovado" } | null>(null);
  const reprovadosList = useMemo(
    () => candidatosIntegracaoAtiva.filter(c => c.candidato.status === "reprovado"),
    [candidatosIntegracaoAtiva]
  );
  const preAprovadosList = useMemo(
    () => candidatosIntegracaoAtiva.filter(c => c.decisoes.some(d => d.decisao === "pre_aprovado")),
    [candidatosIntegracaoAtiva]
  );



  const statsPorAtendente = useMemo(() => {
    return visibleAprovadores.map(prof => {
      let aprovados = 0;
      let reprovados = 0;
      candidatosLoteAtivo.forEach(({ decisoes }) => {
        const d = decisoes.find(dec => dec.profNome.toLowerCase() === prof.toLowerCase());
        if (d?.decisao === "aprovado") aprovados++;
        if (d?.decisao === "reprovado") reprovados++;
      });
      return { nome: prof, aprovados, reprovados, total: aprovados + reprovados };
    });
  }, [visibleAprovadores, candidatosLoteAtivo]);

  // Group candidatos by integration date
  const groupedByDate = useMemo(() => {
    const groups: { date: string; label: string; closed: boolean; items: CandidatoComDecisoes[] }[] = [];
    const dateMap = new Map<string, CandidatoComDecisoes[]>();
    
    candidatosDecisoes.forEach(cd => {
      const date = getResultadoDate(cd.candidato);
      if (!dateMap.has(date)) dateMap.set(date, []);
      dateMap.get(date)!.push(cd);
    });
    
    const sortedDates = Array.from(dateMap.keys()).sort((a, b) => {
      if (a === "sem-data") return 1;
      if (b === "sem-data") return -1;
      return new Date(b).getTime() - new Date(a).getTime();
    });
    
    sortedDates.forEach(date => {
      groups.push({
        date,
        label: date === "sem-data" ? "Sem data de integração" : formatDate(date),
        closed: closedDates.includes(date),
        items: dateMap.get(date)!,
      });
    });
    
    return groups;
  }, [candidatosDecisoes, closedDates]);

  if (loadingResult) return <div className="flex items-center justify-center py-10 text-muted-foreground">Carregando resultados...</div>;

  const handleExportExcel = (onlyActiveLote = false) => {
    const listToExport = onlyActiveLote ? candidatosLoteAtivo : candidatosDecisoes;
    
    if (listToExport.length === 0) {
      toast.error("Não há dados para exportar.");
      return;
    }

    const rows = listToExport.map(({ candidato: c, decisoes }) => {
      const row: Record<string, string> = {
        "NOME": c.nome,
        "FUNÇÃO": c.funcao,
        "SETOR": c.setor,
      };
      aprovadores.forEach(prof => {
        const d = decisoes.find(dec => dec.profNome === prof);
        row[prof.toUpperCase()] = d ? (d.decisao === "aprovado" ? "APROVADO" : "REPROVADO") : "—";
        if (d?.motivo) row[`MOTIVO (${prof.toUpperCase()})`] = d.motivo;
      });
      row["RESULTADO FINAL"] = c.status === "aprovado" ? "APROVADO" : c.status === "reprovado" ? "REPROVADO" : "PENDENTE";
      if (c.motivoReprovacao) row["MOTIVO FINAL"] = c.motivoReprovacao;

      // Detect override: Sonia/Master changed final result diverging from Michelli+Silvana consensus
      const michelliD = decisoes.find(d => ["michelli", "michele", "micheli"].includes(d.profNome.toLowerCase().trim()));
      const silvanaD = decisoes.find(d => d.profNome.toLowerCase().trim() === "silvana");
      const consensoAprov = michelliD?.decisao === "aprovado" && silvanaD?.decisao === "aprovado";
      const consensoReprov = michelliD?.decisao === "reprovado" && silvanaD?.decisao === "reprovado";
      let alteradoPor = "";
      let motivoAlteracao = "";
      if (consensoAprov && c.status === "reprovado") {
        alteradoPor = "Sonia/RH";
        motivoAlteracao = c.motivoReprovacao || "";
      } else if (consensoReprov && c.status === "aprovado") {
        alteradoPor = "Sonia/RH";
        motivoAlteracao = "Alterado para APROVADO (ver histórico)";
      }
      row["ALTERADO POR"] = alteradoPor || "—";
      row["MOTIVO ALTERAÇÃO"] = motivoAlteracao || "—";
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resultado");
    const fileName = onlyActiveLote 
      ? `resultado_lote_ativo_${new Date().toISOString().split("T")[0]}.xlsx`
      : `resultado_geral_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success("Excel exportado!");
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg font-bold uppercase">Resultado</CardTitle>
              <div className="flex gap-2 items-center">
                {false && (
                  <></>
                )}
                {!readOnly && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-[10px] font-bold bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                      onClick={async () => {
                        try {
                          await supabase.channel('luciano-painel-recv').send({
                            type: 'broadcast',
                            event: 'audio-test',
                            payload: { message: "TESTE DE ÁUDIO NO PAINEL", timestamp: Date.now() }
                          });
                          toast.success("Comando de teste de áudio enviado ao painel!");
                        } catch (error) {
                          console.error("Erro ao enviar teste de áudio:", error);
                          toast.error("Erro ao enviar teste de áudio.");
                        }
                      }}
                    >
                      <Activity className="h-3 w-3 mr-1" /> TESTE ÁUDIO
                    </Button>
                    <Button
                      size="sm"
                      className={cn("h-8 text-[10px] font-bold", alteracoesBloqueadas ? "bg-green-600 hover:bg-green-700" : "bg-amber-600 hover:bg-amber-700")}
                      onClick={async () => {
                        if (alteracoesBloqueadas) {
                          await db.desbloquearAlteracoes();
                          setAlteracoesBloqueadas(false);
                          toast.info("Alterações liberadas para atendentes e portaria.");
                        } else {
                          await db.bloquearAlteracoes();
                          setAlteracoesBloqueadas(true);
                          toast.success("Alterações bloqueadas! Atendentes e portaria não podem mais alterar.");
                        }
                      }}
                    >
                      <Lock className="h-3 w-3 mr-1" />
                      {alteracoesBloqueadas ? "DESBLOQUEAR ALTERAÇÕES" : "BLOQUEAR ALTERAÇÕES"}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold bg-green-50 text-green-700 border-green-200 hover:bg-green-100" onClick={() => handleExportExcel(true)}>
                      <Download className="h-3 w-3 mr-1" /> EXCEL (LOTE ATIVO)
                    </Button>
                    {(() => {
                      const pendentesMauricio = candidatosDecisoes.filter(cd => {
                        const temReprovOuPre = cd.decisoes.some(d => d.decisao === "reprovado" || d.decisao === "pre_aprovado");
                        if (!temReprovOuPre) return false;
                        const mauricioJa = cd.decisoes.some(d => normalizeAllowedResultName(d.profNome) === "mauricio" && d.motivo !== "auto");
                        return !mauricioJa;
                      });
                      if (pendentesMauricio.length === 0) return null;
                      return (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-[10px] font-bold bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                          onClick={async () => {
                            const url = `${window.location.origin}/reprovados?user=mauricio`;
                            try {
                              await navigator.clipboard.writeText(url);
                              toast.success(`Link copiado! ${pendentesMauricio.length} candidato(s) aguardando decisão de Maurício.`);
                            } catch {
                              toast.error("Não foi possível copiar o link.");
                            }
                          }}
                        >
                          <LinkIcon className="h-3 w-3 mr-1" /> LINK MAURÍCIO ({pendentesMauricio.length})
                        </Button>
                      );
                    })()}
                    <Button
                      size="sm"
                      className={cn("h-8 text-[10px] font-bold", resultadoLiberado ? "bg-destructive hover:bg-destructive/90" : "bg-green-600 hover:bg-green-700")}
                      onClick={async () => {
                        if (resultadoLiberado) {
                          await db.bloquearResultado();
                          setResultadoLiberado(false);
                          toast.info("Resultado bloqueado para Real Parceria.");
                        } else {
                          await db.liberarResultado();
                          setResultadoLiberado(true);
                          toast.success("Resultado liberado para Real Parceria!");
                          
                          // Generate WhatsApp message with approved/reproved names
                          const aprovados = candidatosDecisoes
                            .filter(c => c.candidato.status === "aprovado")
                            .map(c => c.candidato.nome)
                            .sort();
                          const reprovados = candidatosDecisoes
                            .filter(c => c.candidato.status === "reprovado")
                            .map(c => c.candidato.nome)
                            .sort();
                          const pendentes = candidatosDecisoes
                            .filter(c => c.candidato.status === "atendido")
                            .map(c => c.candidato.nome)
                            .sort();
                          const resultLink = `${window.location.origin}/resultado`;
                          
                          let msg = "📋 *RESULTADO FINAL*\n\n";
                          if (aprovados.length > 0) {
                            msg += `✅ *APROVADOS (${aprovados.length}):*\n`;
                            aprovados.forEach(n => { msg += `• ${n}\n`; });
                            msg += "\n";
                          }
                          if (reprovados.length > 0) {
                            msg += `❌ *REPROVADOS (${reprovados.length}):*\n`;
                            reprovados.forEach(n => { msg += `• ${n}\n`; });
                            msg += "\n";
                          }
                          if (pendentes.length > 0) {
                            msg += `⏳ *PENDENTES (${pendentes.length}):*\n`;
                            pendentes.forEach(n => { msg += `• ${n}\n`; });
                            msg += "\n";
                          }
                          msg += `🔗 Link do resultado:\n${resultLink}`;
                          
                          // Copy to clipboard and show dialog
                          try {
                            await navigator.clipboard.writeText(msg);
                            toast.success("Mensagem para WhatsApp copiada! Cole no grupo.", { duration: 5000 });
                          } catch {
                            // Fallback: show in prompt
                            const textarea = document.createElement("textarea");
                            textarea.value = msg;
                            document.body.appendChild(textarea);
                            textarea.select();
                            document.execCommand("copy");
                            document.body.removeChild(textarea);
                            toast.success("Mensagem para WhatsApp copiada! Cole no grupo.", { duration: 5000 });
                          }
                        }
                      }}
                    >
                      {resultadoLiberado ? <><Lock className="h-3 w-3 mr-1" /> BLOQUEAR</> : <><CheckCircle className="h-3 w-3 mr-1" /> LIBERAR RESULTADO</>}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Per-attendant approval stats */}
        {statsPorAtendente.length > 0 && (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(statsPorAtendente.length, 5)}, 1fr)` }}>
            {statsPorAtendente.map(s => (
              <Card key={s.nome} className="border-t-2 border-t-primary/30">
                <CardContent className="p-3">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground truncate">{s.nome}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1">
                      <span className="text-lg font-bold text-green-600">{s.aprovados}</span>
                      <span className="text-[9px] text-muted-foreground">aprov.</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-lg font-bold text-red-600">{s.reprovados}</span>
                      <span className="text-[9px] text-muted-foreground">reprov.</span>
                    </div>
                    <div className="ml-auto text-[9px] text-muted-foreground">{s.total} total</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {candidatosDecisoes.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Nenhuma decisão registrada ainda.</CardContent></Card>
        ) : (
          groupedByDate.map(group => {
            const isDateClosed = group.closed;
            const groupReadOnly = readOnly || isDateClosed;
            const groupCanEdit = canEditDecisions && !isDateClosed;
            const isCollapsed = collapsedDates.has(group.date);

            const toggleCollapse = () => {
              setCollapsedDates(prev => {
                const next = new Set(prev);
                if (next.has(group.date)) next.delete(group.date);
                else next.add(group.date);
                return next;
              });
            };

            return (
              <Card key={group.date}>
                <CardHeader className="pb-2 pt-3 px-4 cursor-pointer select-none" onClick={toggleCollapse}>
                  <div className="flex items-center gap-3">
                    {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    <Badge variant="secondary" className={cn(
                      "text-xs font-bold px-3 py-1",
                      isDateClosed ? "bg-muted text-muted-foreground" : "bg-blue-600 text-white hover:bg-blue-700"
                    )}>
                      📅 INTEGRAÇÃO: {group.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{group.items.length} candidato(s)</span>
                    {(() => {
                      const gAprov = group.items.filter(i => i.candidato.status === "aprovado").length;
                      const gRevisarItems = group.items.filter(i =>
                        i.candidato.status === "reprovado" ||
                        i.decisoes.some(d => d.decisao === "reprovado" || d.decisao === "pre_aprovado")
                      );
                      const gRevisar = gRevisarItems.length;
                      const gPend = group.items.length - gAprov - gRevisar;
                      return (
                        <>
                          {gAprov > 0 && <Badge className="text-[9px] bg-green-100 text-green-800 border-green-300">{gAprov} aprov.</Badge>}
                          {gRevisar > 0 && (
                            <Badge
                              className="text-[9px] bg-red-100 text-red-800 border-red-300 cursor-pointer hover:bg-red-200"
                              onClick={(e) => { e.stopPropagation(); setShowReprovadosDialog({ items: gRevisarItems, label: group.label }); }}
                            >
                              {gRevisar} reprov./pré aprov.
                            </Badge>
                          )}
                          {gPend > 0 && <Badge className="text-[9px] bg-slate-100 text-slate-700 border-slate-300">{gPend} pendente(s)</Badge>}
                        </>
                      );
                    })()}
                    {isDateClosed && (
                      <Badge variant="outline" className="text-[9px] font-bold border-red-300 text-red-600 gap-1">
                        <Lock className="h-3 w-3" /> FECHADO
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                {!isCollapsed && (
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left text-[10px] font-bold p-3 uppercase whitespace-nowrap">Candidato</th>
                          {visibleAprovadores.map(prof => (
                            <th key={prof} className="text-center text-[10px] font-bold p-3 uppercase whitespace-nowrap">{prof}</th>
                          ))}
                          {isMasterOrMauricio && <th className="text-center text-[10px] font-bold p-3 uppercase whitespace-nowrap">Resultado Final</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map(({ candidato: c, decisoes }) => (
                          <tr key={c.id} className={cn("border-b hover:bg-muted/30", !groupReadOnly && "cursor-pointer", isDateClosed && "opacity-70")} onClick={() => !groupReadOnly && setSelected(c)}>
                            <td className="p-3">
                              {(() => {
                                const motivosReprovacao = decisoes
                                  .filter(d => d.decisao === "reprovado" && d.motivo)
                                  .map(d => `${d.profNome}: ${d.motivo}`);
                                const motivoFinal = c.motivoReprovacao ? `Final: ${c.motivoReprovacao}` : "";
                                const allMotivos = [...motivosReprovacao, motivoFinal].filter(Boolean).join("\n");
                                const isReprovado = c.status === "reprovado" || decisoes.some(d => d.decisao === "reprovado");
                                
                                if (isReprovado && allMotivos) {
                                  return (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <p className="text-[11px] font-bold uppercase truncate cursor-help text-red-700">{c.nome}</p>
                                      </TooltipTrigger>
                                      <TooltipContent side="right" className="max-w-xs whitespace-pre-line text-xs">
                                        <p className="font-bold mb-1">Motivo(s) da reprovação:</p>
                                        {allMotivos}
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                }
                                return <p className="text-[11px] font-bold uppercase truncate">{c.nome}</p>;
                              })()}
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                <Badge variant="outline" className="text-[9px] font-normal">{c.funcao}</Badge>
                                {c.setor && <Badge className="text-[8px] bg-blue-50 text-blue-700 border-blue-200">{c.setor}</Badge>}
                              </div>
                            </td>
                            {visibleAprovadores.map(prof => {
                              const d = decisoes.find(dec => normalizeAllowedResultName(dec.profNome) === normalizeAllowedResultName(prof));

                              const isOwnColumn = currentUserName.toLowerCase() === prof.toLowerCase();
                              const profNormalized = normalizeAllowedResultName(prof);
                              // Masters can edit any column; Sonia and others can edit their own
                              const canToggle = (isMaster || isOwnColumn) && !groupReadOnly && !isDateClosed && d;
                              // Masters can add any column; Sonia can add her own column
                              const canAddDecision = (isMaster || (isOwnColumn && isMauricio && profNormalized === "mauricio")) && !d && !groupReadOnly && !isDateClosed;
                              const handleToggle = canToggle ? async (e: React.MouseEvent) => {
                                e.stopPropagation();
                                const newDecisao = d.decisao === "aprovado" ? "reprovado" : "aprovado";
                                
                                // If changing to reprovado, require reason via dialog
                                if (newDecisao === "reprovado") {
                                  setReprovarDialog({ candidatoId: c.id, profNome: d.profNome, candidatoNome: c.nome });
                                  setReprovarMotivo("");
                                  return;
                                }
                                
                                // Changing from reprovado → aprovado: save with "Alterado" observation
                                const otherResults = (c.observacoes || "").split("|").filter(p =>
                                  !(p.startsWith(`resultado:${d.profNome}:`))
                                );
                                otherResults.push(`resultado:${d.profNome}:aprovado:Alterado`);
                                const newObs = otherResults.filter(Boolean).join("|");
                                
                                // If Michelli/Silvana changes to aprovado, also revert candidate status if it was reprovado by them
                                const updateData: Record<string, any> = { observacoes: newObs };
                                const rejectorNorm = normalizeAllowedResultName(d.profNome);
                                 if (["michelli", "silvana"].includes(rejectorNorm)) {
                                   const otherDec = decisoes.find(od => {
                                     const odNorm = normalizeAllowedResultName(od.profNome);
                                     return odNorm !== rejectorNorm && ["michelli", "silvana"].includes(odNorm);
                                   });
                                   const otherIsAproved = otherDec?.decisao === "aprovado";
                                   const otherIsReproved = otherDec?.decisao === "reprovado";

                                   if (otherIsAproved) {
                                     updateData.status = "aprovado";
                                     updateData.motivo_reprovacao = null;
                                   } else if (c.status === "reprovado" && !otherIsReproved) {
                                     updateData.status = "atendido";
                                     updateData.motivo_reprovacao = null;
                                   }
                                 }
                                
                                await supabase.from("candidatos").update(updateData).eq("id", c.id);
                                await supabase.from("historico").insert({
                                  candidato_id: c.id, usuario: currentUserName,
                                  data: new Date().toISOString().split("T")[0],
                                  hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                                  status_anterior: d.decisao, novo_status: newDecisao,
                                  observacao: `${currentUserName} alterou decisão de ${d.profNome} para APROVADO — Alterado`,
                                });
                                toast.success(`Decisão alterada para APROVADO`);
                                onRefresh();
                              } : undefined;

                              const handleAddDecision = canAddDecision ? async (e: React.MouseEvent, decisao: "aprovado" | "reprovado") => {
                                e.stopPropagation();
                                if (decisao === "reprovado") {
                                  setReprovarDialog({ candidatoId: c.id, profNome: prof, candidatoNome: c.nome });
                                  setReprovarMotivo("");
                                  return;
                                }
                                const currentObs = (c.observacoes || "").split("|").filter(Boolean);
                                currentObs.push(`resultado:${prof}:aprovado:Incluído por ${currentUserName}`);
                                const newObs = currentObs.join("|");
                                await supabase.from("candidatos").update({ observacoes: newObs }).eq("id", c.id);
                                await supabase.from("historico").insert({
                                  candidato_id: c.id, usuario: currentUserName,
                                  data: new Date().toISOString().split("T")[0],
                                  hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                                  status_anterior: c.status, novo_status: c.status,
                                  observacao: `${currentUserName} incluiu decisão APROVADO para ${prof}`,
                                });
                                toast.success(`Decisão APROVADO incluída para ${prof}`);
                                onRefresh();
                              } : undefined;

                              return (
                                <td key={prof} className="p-3 text-center">
                                  {d ? (
                                    <div className="flex flex-col items-center gap-1">
                                      {d.decisao === "reprovado" ? (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Badge className="text-[9px] font-bold cursor-help bg-red-100 text-red-800 border-red-300">
                                              ✗ REPROVADO
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-[300px]">
                                            <p className="text-xs font-bold">Motivo:</p>
                                            <p className="text-xs">{d.motivo || "Sem motivo informado"}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : d.decisao === "pre_aprovado" ? (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Badge className="text-[9px] font-bold cursor-help bg-amber-100 text-amber-800 border-amber-300">
                                              ⚡ PRÉ APROVADO
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-[300px]">
                                            <p className="text-xs font-bold">Motivo:</p>
                                            <p className="text-xs">{d.motivo || "Sem motivo informado"}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : (
                                        <Badge className="text-[9px] font-bold bg-green-100 text-green-800 border-green-300">
                                          ✓ APROVADO
                                        </Badge>
                                      )}
                                      {(() => {
                                        const profNorm = normalizeAllowedResultName(prof);
                                        const foiAlterado = (d.motivo || "").toLowerCase().includes("alterado");
                                        const viewerCanSee = ["luciano","mauricio"].includes(currentUserLogin.toLowerCase());
                                        if (foiAlterado && ["michelli","silvana"].includes(profNorm) && viewerCanSee) {
                                          return <span className="text-[10px] font-bold text-red-600" title="Decisão alterada">*</span>;
                                        }
                                        return null;
                                      })()}
                                      {d.decisao === "pre_aprovado" && isOwnColumn && !groupReadOnly && !isDateClosed ? (
                                        <Button size="sm" variant="ghost" className="h-5 text-[8px] text-amber-700 hover:text-amber-900 px-1"
                                          onClick={(e) => { e.stopPropagation(); setEditPreDialog({ candidatoId: c.id, profNome: d.profNome, candidatoNome: c.nome, motivo: d.motivo || "" }); }}>
                                          EDITAR MOTIVO
                                        </Button>
                                      ) : canToggle && d.decisao !== "pre_aprovado" && (
                                        <Button size="sm" variant="ghost" className="h-5 text-[8px] text-muted-foreground hover:text-primary px-1"
                                          onClick={handleToggle}>
                                          ALTERAR
                                        </Button>
                                      )}
                                    </div>
                                  ) : canAddDecision ? (
                                    <div className="flex gap-1 justify-center">
                                      <Button size="sm" className="h-5 text-[8px] bg-green-600 hover:bg-green-700 text-white px-2"
                                        onClick={(e) => handleAddDecision!(e, "aprovado")}>✓</Button>
                                      <Button size="sm" className="h-5 text-[8px] bg-red-600 hover:bg-red-700 text-white px-2"
                                        onClick={(e) => handleAddDecision!(e, "reprovado")}>✗</Button>
                                    </div>
                                  ) : isLuciano && prof.toLowerCase() === "mauricio" ? (
                                    <div className="flex gap-1 justify-center">
                                      <Button size="sm" className="h-5 text-[8px] bg-green-600 hover:bg-green-700 text-white px-2"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          setReprovarDialog({ candidatoId: c.id, profNome: "mauricio", candidatoNome: c.nome, type: "aprovado" } as any);
                                          setReprovarMotivo("");
                                        }}>✓</Button>
                                      <Button size="sm" className="h-5 text-[8px] bg-red-600 hover:bg-red-700 text-white px-2"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          setReprovarDialog({ candidatoId: c.id, profNome: "mauricio", candidatoNome: c.nome, type: "reprovado" } as any);
                                          setReprovarMotivo("");
                                        }}>✗</Button>
                                    </div>
                                  ) : (
                                    <span className="text-[9px] text-muted-foreground">—</span>
                                  )}
                                </td>
                              );
                            })}
                            {isMasterOrMauricio && (() => {
                              // Mauricio can always edit Resultado Final
                              const mauricioCanEdit = groupCanEdit;
                              // Regras Resultado Final:
                              // - M+S ambos aprov → APROVADO (auto)
                              // - M+S ambos reprov → REPROVADO (auto)
                              // - Divergência (uma reprov) → decisão do Mauricio prevalece
                              const michelliD = decisoes.find(d => ["michelli","michele","micheli"].includes(d.profNome.toLowerCase().trim()));
                              const silvanaD = decisoes.find(d => d.profNome.toLowerCase().trim() === "silvana");
                              const mauricioD = decisoes.find(d => ["mauricio","maurício","luciano","sonia","sônia"].includes(d.profNome.toLowerCase().trim()));
                              const bothAprov = michelliD?.decisao === "aprovado" && silvanaD?.decisao === "aprovado";
                              const bothReprov = michelliD?.decisao === "reprovado" && silvanaD?.decisao === "reprovado";
                              const divergencia = (michelliD?.decisao === "reprovado" && silvanaD?.decisao === "aprovado") ||
                                                  (michelliD?.decisao === "aprovado" && silvanaD?.decisao === "reprovado");
                              let effectiveStatus: string = c.status;
                              if (bothAprov) effectiveStatus = "aprovado";
                              else if (bothReprov) effectiveStatus = "reprovado";
                              else if (divergencia && mauricioD) effectiveStatus = mauricioD.decisao === "aprovado" ? "aprovado" : "reprovado";
                              else if (divergencia) effectiveStatus = "atendido";
                              return (
                            <td className="p-3 text-center">
                              {effectiveStatus === "aprovado" && mauricioCanEdit && isMasterOrMauricio ? (
                                <div className="flex flex-col items-center gap-1">
                                  <Badge className="text-[10px] font-bold bg-green-600 text-white">✓ APROVADO</Badge>
                                  <Button size="sm" variant="ghost" className="h-5 text-[8px] text-muted-foreground hover:text-red-600 px-1"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      setReprovarDialog({ candidatoId: c.id, profNome: "__FINAL__", candidatoNome: c.nome });
                                      setReprovarMotivo("");
                                    }}>ALTERAR P/ REPROVADO</Button>
                                </div>
                              ) : effectiveStatus === "aprovado" ? (
                                <Badge className="text-[10px] font-bold bg-green-600 text-white">✓ APROVADO</Badge>
                              ) : effectiveStatus === "reprovado" && mauricioCanEdit && isMasterOrMauricio ? (
                                <div className="flex flex-col items-center gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge className="text-[10px] font-bold bg-red-600 text-white cursor-help">✗ REPROVADO</Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[350px] whitespace-pre-line">
                                      <p className="text-xs font-bold mb-1">Motivo(s):</p>
                                      <p className="text-xs">{c.motivoReprovacao || decisoes.filter(d => d.decisao === "reprovado").map(d => `${d.profNome}: ${d.motivo || "sem motivo"}`).join("\n") || "Sem motivo informado"}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <Button size="sm" variant="ghost" className="h-5 text-[8px] text-muted-foreground hover:text-green-600 px-1"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      setReprovarDialog({ candidatoId: c.id, profNome: "__FINAL_APROVAR__", candidatoNome: c.nome });
                                      setReprovarMotivo("");
                                    }}>ALTERAR P/ APROVADO</Button>
                                </div>
                              ) : effectiveStatus === "reprovado" ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge className="text-[10px] font-bold bg-red-600 text-white cursor-help">✗ REPROVADO</Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[350px] whitespace-pre-line">
                                    <p className="text-xs font-bold mb-1">Motivo(s):</p>
                                    <p className="text-xs">{c.motivoReprovacao || decisoes.filter(d => d.decisao === "reprovado").map(d => `${d.profNome}: ${d.motivo || "sem motivo"}`).join("\n") || "Sem motivo informado"}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : c.status === "atendido" && decisoes.some(d => d.decisao === "reprovado") && !groupReadOnly ? (
                                <div className="flex gap-1 justify-center">
                                  <Button size="sm" className="h-6 text-[9px] bg-green-600 hover:bg-green-700 text-white px-2"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await supabase.from("candidatos").update({ status: "aprovado" }).eq("id", c.id);
                                      await supabase.from("historico").insert({
                                        candidato_id: c.id, usuario: currentUserName || "RH",
                                        data: new Date().toISOString().split("T")[0],
                                        hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                                        status_anterior: "atendido", novo_status: "aprovado",
                                        observacao: `Aprovado por ${currentUserName || "RH"} (resultado final)`,
                                      });
                                      toast.success(`${c.nome} APROVADO!`);
                                      onRefresh();
                                    }}>✓ APROVAR</Button>
                                  <Button size="sm" className="h-6 text-[9px] bg-red-600 hover:bg-red-700 text-white px-2"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                       const mMotivo = "MANTER A DECISÃO DO PROFISSIONAL";
                                       await supabase.from("candidatos").update({ status: "reprovado", motivo_reprovacao: mMotivo }).eq("id", c.id);
                                       await supabase.from("historico").insert({
                                         candidato_id: c.id, usuario: currentUserName || "RH",
                                         data: new Date().toISOString().split("T")[0],
                                         hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                                         status_anterior: "atendido", novo_status: "reprovado",
                                         observacao: `${mMotivo} - Por: ${currentUserName || "RH"}`,
                                       });
                                      toast.success(`${c.nome} REPROVADO.`);
                                      onRefresh();
                                    }}>✗ REPROVAR</Button>
                                </div>
                              ) : (
                                <Badge className={cn("text-[10px] font-bold",
                                  c.status === "atendido" && decisoes.some(d => d.decisao === "reprovado")
                                    ? "bg-amber-100 text-amber-800 border-amber-300"
                                    : "bg-muted text-muted-foreground"
                                )}>
                                  {c.status === "atendido" && decisoes.some(d => d.decisao === "reprovado") ? "PENDENTE" : "ATENDIDO"}
                                </Badge>
                              )}
                            </td>
                              );
                            })()}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={!!editPreDialog} onOpenChange={open => { if (!open) setEditPreDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar motivo do Pré-Aprovado — {editPreDialog?.candidatoNome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Atualize o motivo do pré-aprovado:</p>
            <Textarea value={editPreDialog?.motivo || ""} onChange={e => setEditPreDialog(prev => prev ? { ...prev, motivo: e.target.value } : prev)} placeholder="Descreva o motivo..." className="min-h-[100px]" />
            <div className="flex gap-2">
              <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold" onClick={async () => {
                if (!editPreDialog) return;
                if (!editPreDialog.motivo.trim()) { toast.error("Informe o motivo."); return; }
                const cd = candidatosDecisoes.find(x => x.candidato.id === editPreDialog.candidatoId);
                if (!cd) return;
                const obs = cd.candidato.observacoes || "";
                const parts = obs.split("|").filter(p => !(p.startsWith("resultado:") && p.split(":")[1] === editPreDialog.profNome));
                parts.push(`resultado:${editPreDialog.profNome}:pre_aprovado:${editPreDialog.motivo.trim()}`);
                const newObs = parts.filter(Boolean).join("|");
                await supabase.from("candidatos").update({ observacoes: newObs }).eq("id", editPreDialog.candidatoId);
                await supabase.from("historico").insert({
                  candidato_id: editPreDialog.candidatoId, usuario: currentUserName || "RH",
                  data: new Date().toISOString().split("T")[0],
                  hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                  status_anterior: cd.candidato.status, novo_status: cd.candidato.status,
                  observacao: `${currentUserName} editou motivo do PRÉ-APROVADO de ${editPreDialog.profNome}`,
                });
                toast.success("Motivo atualizado.");
                setEditPreDialog(null);
                onRefresh();
              }}>Salvar</Button>
              <Button variant="outline" onClick={() => setEditPreDialog(null)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reprovarDialog} onOpenChange={open => { if (!open) { setReprovarDialog(null); setReprovarMotivo(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reprovarDialog?.profNome === "__FINAL_APROVAR__"
                ? `Aprovar — ${reprovarDialog?.candidatoNome}`
                : `Reprovar — ${reprovarDialog?.candidatoNome}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {reprovarDialog?.profNome === "__FINAL_APROVAR__"
                ? "Informe a justificativa para aprovar este candidato (obrigatório):"
                : "Informe o motivo da reprovação (obrigatório):"}
            </p>
            <Textarea value={reprovarMotivo} onChange={e => setReprovarMotivo(e.target.value)} placeholder="Descreva o motivo..." className="min-h-[100px]" />
            <div className="flex gap-2">
              <Button className={cn("flex-1 font-bold text-white", (reprovarDialog?.profNome === "__FINAL_APROVAR__" || (reprovarDialog as any)?.type === "aprovado") ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")} onClick={async () => {
                const isAprovando = reprovarDialog?.profNome === "__FINAL_APROVAR__" || (reprovarDialog as any)?.type === "aprovado";
                if (!reprovarMotivo.trim() && isAprovando) {
                  toast.error("Informe a justificativa.");
                  return;
                }
                if (!reprovarMotivo.trim() && !isAprovando) {
                  toast.error("Informe o motivo da reprovação.");
                  return;
                }
                if (!reprovarDialog) return;

                // Handle final result APROVAR (Sonia/Master changing reprovado → aprovado with justification)
                if (reprovarDialog.profNome === "__FINAL_APROVAR__") {
                  const obsAlteracao = `[Resultado Final alterado para APROVADO por ${currentUserName}: ${reprovarMotivo.trim()}]`;
                  await supabase.from("candidatos").update({ status: "aprovado", motivo_reprovacao: obsAlteracao }).eq("id", reprovarDialog.candidatoId);
                  await supabase.from("historico").insert({
                    candidato_id: reprovarDialog.candidatoId, usuario: currentUserName || "RH",
                    data: new Date().toISOString().split("T")[0],
                    hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                    status_anterior: "reprovado", novo_status: "aprovado",
                    observacao: `Alterado para APROVADO por ${currentUserName}: ${reprovarMotivo.trim()}`,
                  });
                  toast.success(`${reprovarDialog.candidatoNome} alterado para APROVADO.`);
                  setReprovarDialog(null);
                  setReprovarMotivo("");
                  onRefresh();
                  return;
                }

                // Handle final result reprovação (master changing global status)
                if (reprovarDialog.profNome === "__FINAL__") {
                  await supabase.from("candidatos").update({ status: "reprovado", motivo_reprovacao: reprovarMotivo.trim() }).eq("id", reprovarDialog.candidatoId);
                  await supabase.from("historico").insert({
                    candidato_id: reprovarDialog.candidatoId, usuario: currentUserName || "RH",
                    data: new Date().toISOString().split("T")[0],
                    hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                    status_anterior: "aprovado", novo_status: "reprovado",
                    observacao: `Alterado para REPROVADO por ${currentUserName}: ${reprovarMotivo.trim()}`,
                  });
                  toast.success(`${reprovarDialog.candidatoNome} alterado para REPROVADO.`);
                  setReprovarDialog(null);
                  setReprovarMotivo("");
                  onRefresh();
                  return;
                }

                // Handle Luciano acting as Mauricio
                const isLucianoActing = isLuciano && reprovarDialog.profNome === "mauricio";
                const targetProf = reprovarDialog.profNome;
                const decisionType = (reprovarDialog as any).type || "reprovado";

                // Handle per-attendant decision change
                const cd = candidatosDecisoes.find(cd => cd.candidato.id === reprovarDialog.candidatoId);
                if (!cd) return;
                const c = cd.candidato;
                const otherResults = (c.observacoes || "").split("|").filter(p =>
                  !(p.startsWith(`resultado:${reprovarDialog.profNome}:`))
                );
                otherResults.push(`resultado:${targetProf}:${decisionType}:${reprovarMotivo.trim()}${isLucianoActing ? " (por Luciano)" : ""}`);
                const newObs = otherResults.filter(Boolean).join("|");
                const updateData: Record<string, any> = { observacoes: newObs };
                
                // Logic for Resultado Final
                const currentDecisoes = [...cd.decisoes.filter(d => d.profNome !== reprovarDialog.profNome), { profNome: reprovarDialog.profNome, decisao: "reprovado" as const, motivo: reprovarMotivo.trim() }];
                const michelliDec = currentDecisoes.find(d => ["michelli", "michele"].includes(normalizeAllowedResultName(d.profNome)))?.decisao;
                const silvanaDec = currentDecisoes.find(d => normalizeAllowedResultName(d.profNome) === "silvana")?.decisao;
                const soniaDec = currentDecisoes.find(d => normalizeAllowedResultName(d.profNome) === "sonia")?.decisao;

                // Regra: Sonia sempre prevalece
                if (soniaDec === "reprovado") {
                  updateData.status = "reprovado";
                  updateData.motivo_reprovacao = currentDecisoes.filter(d => d.decisao === "reprovado").map(d => `${d.profNome}: ${d.motivo}`).join("; ");
                } else if (soniaDec === "aprovado") {
                  updateData.status = "aprovado";
                  updateData.motivo_reprovacao = null;
                } else if (michelliDec === "aprovado" && silvanaDec === "aprovado") {
                  updateData.status = "aprovado";
                  updateData.motivo_reprovacao = null;
                } else if (michelliDec === "reprovado" || silvanaDec === "reprovado") {
                  // Uma das duas reprovou → PENDENTE
                  updateData.status = "atendido";
                  updateData.motivo_reprovacao = null;
                }

                await supabase.from("candidatos").update(updateData).eq("id", c.id);
                await supabase.from("historico").insert({
                  candidato_id: c.id, usuario: currentUserName,
                  data: new Date().toISOString().split("T")[0],
                  hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                  status_anterior: c.status, novo_status: updateData.status || c.status,
                  observacao: `${currentUserName} ${isLucianoActing ? "atuando como " + targetProf : ""} definiu decisão para ${decisionType.toUpperCase()}: ${reprovarMotivo.trim()}`,
                });
                toast.success(`Decisão de ${targetProf} definida para ${decisionType.toUpperCase()}`);
                setReprovarDialog(null);
                setReprovarMotivo("");
                onRefresh();
              }}>
                {reprovarDialog?.profNome === "__FINAL_APROVAR__" ? "Confirmar Aprovação" : "Confirmar Reprovação"}
              </Button>
              <Button variant="outline" onClick={() => { setReprovarDialog(null); setReprovarMotivo(""); }}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Dialog de Reprovados com avaliações individuais */}
      <Dialog open={!!showReprovadosDialog} onOpenChange={(o) => !o && setShowReprovadosDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">❌ Candidatos Reprovados — {showReprovadosDialog?.label} ({showReprovadosDialog?.items.length || 0})</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="space-y-3">
              {(showReprovadosDialog?.items || []).map(({ candidato: c, decisoes }) => {
                const negativas = decisoes.filter(d => d.decisao === "reprovado" || d.decisao === "pre_aprovado");
                const [open, setOpenRow] = [expandedRows.has(c.id), (v: boolean) => {
                  setExpandedRows(prev => { const n = new Set(prev); if (v) n.add(c.id); else n.delete(c.id); return n; });
                }];
                return (
                  <Card key={c.id} className="border-red-200">
                    <CardContent className="p-3 space-y-2">
                      <button type="button" className="w-full text-left flex items-center justify-between gap-2" onClick={() => setOpenRow(!open)}>
                        <p className="text-sm font-bold uppercase">{c.nome}</p>
                        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </button>
                      {open && (
                        <div className="space-y-1.5">
                          {negativas.length > 0 ? negativas.map((d, i) => {
                            const isPre = d.decisao === "pre_aprovado";
                            return (
                              <div key={i} className={cn("flex items-start gap-2 rounded p-2", isPre ? "bg-amber-50" : "bg-red-50")}>
                                <Badge className={cn("text-[8px] font-bold shrink-0", isPre ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-red-100 text-red-800 border-red-300")}>
                                  {isPre ? "⚡" : "✗"} {d.profNome} {isPre ? "(PRÉ)" : ""}
                                </Badge>
                                <p className="text-[10px] text-muted-foreground">{d.motivo || "Sem motivo informado"}</p>
                              </div>
                            );
                          }) : (
                            <p className="text-[10px] text-muted-foreground">
                              {c.motivoReprovacao || "Sem motivo informado"}
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {(showReprovadosDialog?.items.length || 0) === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum candidato reprovado ou pré-aprovado.</p>}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      {/* Dialog de Aprovados / Pré-Aprovados com motivos */}
      <Dialog open={!!showMotivosDialog} onOpenChange={(o) => !o && setShowMotivosDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {showMotivosDialog?.kind === "pre_aprovado" ? "⚡ Candidatos Pré-Aprovados" : "✓ Candidatos Aprovados"} — {showMotivosDialog?.label} ({showMotivosDialog?.items.length || 0})
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="space-y-3">
              {(showMotivosDialog?.items || []).map(({ candidato: c, decisoes }) => {
                const kind = showMotivosDialog!.kind;
                const decs = decisoes.filter(d => d.decisao === kind);
                const isPre = kind === "pre_aprovado";
                return (
                  <Card key={c.id} className={isPre ? "border-amber-200" : "border-green-200"}>
                    <CardContent className="p-3 space-y-2">
                      <p className="text-sm font-bold uppercase">{c.nome}</p>
                      <div className="space-y-1.5">
                        {decs.length > 0 ? decs.map((d, i) => (
                          <div key={i} className={cn("flex items-start gap-2 rounded p-2", isPre ? "bg-amber-50" : "bg-green-50")}>
                            <Badge className={cn("text-[8px] font-bold shrink-0", isPre ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-green-100 text-green-800 border-green-300")}>
                              {isPre ? "⚡" : "✓"} {d.profNome}
                            </Badge>
                            <p className="text-[10px] text-muted-foreground">{d.motivo || "Sem motivo informado"}</p>
                          </div>
                        )) : (
                          <p className="text-[10px] text-muted-foreground">Sem motivo informado</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {(showMotivosDialog?.items.length || 0) === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum candidato.</p>}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
