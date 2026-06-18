import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import GerenciarUsuarios from "@/pages/GerenciarUsuarios";
import { useCandidatos, useSetores, useClosedDates } from "@/hooks/useSupabaseData";
import * as db from "@/lib/supabaseData";
import { statusLabels, type Candidato, type Setor } from "@/lib/supabaseData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/StatusBadge";
import CandidatoDialog from "@/components/CandidatoDialog";
import { Search, CheckCircle, Lock, Edit2, CheckSquare, Trash2, CalendarCheck, Users, Plus, Stethoscope, Pencil, GripVertical, Settings, Download, Monitor, X, Activity } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatDate, cn, isSameDateKey, normalizeDateKey } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/lib/supabase";
import { getUsuariosAtendimento } from "@/lib/usuarioData";

import ResultadoView from "@/components/ResultadoView";
import PasswordGate from "@/components/PasswordGate";

export default function RH() {
  const { usuario } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<string>(searchParams.get("view") || "geral");
  const [configSubView, setConfigSubView] = useState<string>("operacoes");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Candidato | null>(null);
  const [admitting, setAdmitting] = useState<Candidato | null>(null);
  const [admissionDate, setAdmissionDate] = useState("");
  const [admissionSector, setAdmissionSector] = useState("");
  const [newSectorName, setNewSectorName] = useState("");
  const [showLimparDialog, setShowLimparDialog] = useState(false);
  const [limparDate, setLimparDate] = useState("");
  const [showLixeira, setShowLixeira] = useState(false);
  const [historicoLixeira, setHistoricoLixeira] = useState<any[]>([]);

  const { candidatos: allCandidatos, loading, refresh: refreshCandidatos } = useCandidatos();
  const { candidatos: allCandidatosIncClosed, loading: loadingAll, refresh: refreshAllCandidatos } = useCandidatos(true);
  const { setores, refresh: refreshSetores } = useSetores();
  const { closedDates, refresh: refreshClosedDates } = useClosedDates();

  const refresh = () => { refreshCandidatos(); refreshAllCandidatos(); refreshSetores(); refreshClosedDates(); };

  useEffect(() => {
    const v = searchParams.get("view") || "geral";
    setView(v);
  }, [searchParams]);

  const integrationGroups = useMemo(() => {
    if (view !== "fechamento" && !(view === "configuracoes" && configSubView === "fechamento")) return [];
    const closedSet = new Set(closedDates.map(normalizeDateKey));
    const groups: Record<string, { date: string, count: number, closed: boolean }> = {};
    allCandidatosIncClosed.forEach(c => {
      const dateKey = normalizeDateKey(c.dataIntegracao);
      if (dateKey) {
        if (!groups[dateKey]) {
          groups[dateKey] = { date: dateKey, count: 0, closed: closedSet.has(dateKey) };
        }
        groups[dateKey].count++;
      }
    });
    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  }, [allCandidatosIncClosed, view, closedDates, configSubView]);

  const candidatos = useMemo(() => {
    if (view === "fechamento") return allCandidatos.filter(c => c.status === "rh_concluido");
    if (view === "admissao") return allCandidatos.filter(c => c.status === "doc_ok" || c.status === "finalizado");
    if (view === "iniciando") return allCandidatos.filter(c => c.status === "iniciado");
    return allCandidatos.filter((c) =>
      ["aprovado", "rh_pendente", "rh_concluido", "doc_ok", "falta_doc", "aguardando_doc", "aguardando_rh_global", "presente", "aguardando_portaria"].includes(c.status)
    );
  }, [allCandidatos, view]);

  const filtered = useMemo(
    () => candidatos.filter((c) => !search || c.nome.toLowerCase().includes(search.toLowerCase())),
    [candidatos, search]
  );

  const handleTabChange = (val: string) => setSearchParams({ view: val });

  const [portariaBloqueada, setPortariaBloqueada] = useState(false);
  const [resultadoLiberado, setResultadoLiberado] = useState(false);
  // Módulo Diário is now per-user only
  // const [diarioEnabled, setDiarioEnabled] = useState(false);
  const [diarioUsers, setDiarioUsers] = useState<string[]>([]);

  useEffect(() => { 
    db.isPortariaBloqueada().then(setPortariaBloqueada); 
    db.isResultadoLiberado().then(setResultadoLiberado);
    // db.isDiarioGlobalEnabled().then(setDiarioEnabled);
    db.getDiarioAuthorizedUsers().then(setDiarioUsers);
  }, []);

  useEffect(() => {
    const unsub = db.subscribeToClosedDates(() => {
      db.isPortariaBloqueada().then(setPortariaBloqueada);
      db.isResultadoLiberado().then(setResultadoLiberado);
      // db.isDiarioGlobalEnabled().then(setDiarioEnabled);
      db.getDiarioAuthorizedUsers().then(setDiarioUsers);
    });
    return unsub;
  }, []);

  if (loading || loadingAll) return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>;

  const renderContent = () => {
    if (view === "usuarios" || (view === "configuracoes" && configSubView === "usuarios")) return <GerenciarUsuarios />;

    if (view === "resultado") {
      return (
        <PasswordGate>
          <ResultadoView 
            candidatos={allCandidatosIncClosed} 
            resultadoLiberado={resultadoLiberado}
            setResultadoLiberado={setResultadoLiberado}
            setSelected={setSelected}
            onRefresh={refresh}
            canEditDecisions={true}
            currentUserName={usuario?.nome || "RH"}
            currentUserLogin={usuario?.login || ""}
            closedDates={closedDates}
          />
        </PasswordGate>
      );
    }
    if (view === "fechamento" || (view === "configuracoes" && configSubView === "fechamento")) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2"><Lock className="h-5 w-5" /> FECHAMENTO POR DATA DE INTEGRAÇÃO</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px] font-bold">DATA DE INTEGRAÇÃO</TableHead>
                    <TableHead className="text-[11px] font-bold">CANDIDATOS</TableHead>
                    <TableHead className="text-[11px] font-bold">STATUS</TableHead>
             <TableHead className="text-right text-[11px] font-bold">AÇÃO</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {integrationGroups.length === 0 ? (
                     <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-xs">Nenhuma data encontrada.</TableCell></TableRow>
                   ) : integrationGroups.map((group) => (
                     <TableRow key={group.date} className={group.closed ? "bg-muted/30" : ""}>
                       <TableCell className="font-medium text-xs py-4">{formatDate(group.date)}</TableCell>
                       <TableCell className="text-xs py-4">{group.count} candidato(s)</TableCell>
                       <TableCell className="py-4">
                         {group.closed ? (
                           <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">FECHADO</Badge>
                         ) : (
                           <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">ABERTO</Badge>
                         )}
                       </TableCell>
                       <TableCell className="text-right py-4">
                         <div className="flex justify-end gap-2">
                            <Button size="sm" className={cn("h-8 text-[10px]", group.closed ? "bg-amber-600 hover:bg-amber-700" : "bg-primary hover:bg-primary/90")}
                              onClick={async () => {
                                const msg = group.closed
                                  ? `Reforçar fechamento da data ${formatDate(group.date)}? Isso finalizará candidatos pendentes desta data.`
                                  : `Deseja realizar o fechamento da data ${formatDate(group.date)}? Isso irá encerrar todas as atividades desta integração.`;
                                if (window.confirm(msg)) {
                                   const totalFinalizados = await db.closeIntegrationDate(group.date, usuario?.nome || "RH");
                                   toast.success(`Fechamento da data ${formatDate(group.date)} realizado! ${totalFinalizados} candidato(s) finalizado(s).`);
                                  refresh();
                                }
                              }}>
                              <Lock className="h-3.5 w-3.5 mr-1" /> {group.closed ? "REFORÇAR FECHAMENTO" : "REALIZAR FECHAMENTO"}
                            </Button>

                            <Button size="sm" variant="outline" className="h-8 text-[10px] bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                              onClick={() => {
                                // Clear search to ensure we see the candidates if they are filtered
                                setSearch("");
                                // Change view to resultado
                                setView("resultado");
                                // We can't easily auto-filter ResultadoView by date via URL yet, 
                                // but the user can find the date in the grouped list.
                                toast.info(`Visualizando resultados da integração ${formatDate(group.date)}`);
                              }}>
                              <Monitor className="h-3.5 w-3.5 mr-1" /> VISUALIZAR
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-[10px] bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                              onClick={async () => {
                                const candidatosDaData = allCandidatosIncClosed.filter(c => isSameDateKey(c.dataIntegracao, group.date));
                                if (candidatosDaData.length === 0) { toast.error("Nenhum candidato nesta data."); return; }
                                const XLSX = await import("xlsx");
                                const wsData = candidatosDaData.map(c => {
                                  const horasAtend: Record<string, string> = {};
                                  (c.observacoes || "").split("|").filter((p: string) => p.startsWith("hora_atend:")).forEach((p: string) => {
                                    const parts = p.split(":"); horasAtend[parts[1] || ""] = parts.slice(2).join(":") || "";
                                  });
                                  const horasStr = Object.entries(horasAtend).map(([n, h]) => `${n}: ${h}`).join(", ");
                                  return {
                                    "Nome": c.nome, "CPF": c.cpf, "Função": c.funcao, "Setor": c.setor,
                                    "Turno": c.turno, "Status": statusLabels[c.status] || c.status,
                                    "Data Integração": c.dataIntegracao || "",
                                    "Data Início": c.dataInicio || "",
                                    "Telefone": c.telefone || "", "Indicação": c.indicacao || "",
                                    "Horários Atendimento": horasStr,
                                    "Observações": c.observacoes || "",
                                  };
                                });
                                 const ws = XLSX.utils.json_to_sheet(wsData);
                                 const wb = XLSX.utils.book_new();
                                 XLSX.utils.book_append_sheet(wb, ws, "Histórico");

                                 // Estatísticas
                                 const convocados = candidatosDaData.length;
                                 const ausentes = candidatosDaData.filter(c => c.status === "ausente").length;
                                 const compareceram = convocados - ausentes;
                                 const reprovados = candidatosDaData.filter(c => c.status === "reprovado" || !!c.motivoReprovacao).length;
                                 const aprovados = compareceram - reprovados;
                                 const pct = (n: number) => convocados ? `${((n/convocados)*100).toFixed(1)}%` : "0%";
                                 const statsData = [
                                   { "Métrica": "Data Integração", "Quantidade": formatDate(group.date), "%": "" },
                                   { "Métrica": "Convocados", "Quantidade": convocados, "%": "100%" },
                                   { "Métrica": "Compareceram", "Quantidade": compareceram, "%": pct(compareceram) },
                                   { "Métrica": "Ausentes", "Quantidade": ausentes, "%": pct(ausentes) },
                                   { "Métrica": "Aprovados", "Quantidade": aprovados, "%": pct(aprovados) },
                                   { "Métrica": "Reprovados", "Quantidade": reprovados, "%": pct(reprovados) },
                                 ];

                                 const wsStats = XLSX.utils.json_to_sheet(statsData);
                                 XLSX.utils.book_append_sheet(wb, wsStats, "Estatísticas");

                                 XLSX.writeFile(wb, `historico_integracao_${group.date}.xlsx`);

                                toast.success(`Excel exportado para ${formatDate(group.date)}!`);
                              }}>
                              <Download className="h-3.5 w-3.5 mr-1" /> EXCEL
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-[10px] bg-red-600 text-white hover:bg-red-700 font-bold"
                              onClick={async () => {
                                if (window.confirm(`⚠️ ATENÇÃO: Deseja EXCLUIR todos os ${group.count} candidatos da integração ${formatDate(group.date)}? Esta ação não pode ser desfeita!`)) {
                                  try {
                                    const count = await db.deleteCandidatosByDate(group.date);
                                    toast.success(`${count} candidatos da data ${formatDate(group.date)} excluídos!`);
                                  } catch (e: any) {
                                    console.error('Erro ao excluir integração:', e);
                                    toast.error('Erro ao excluir: ' + (e?.message || 'verifique o console.'));
                                  }
                                  await refresh();
                                }
                              }}>
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> LIMPAR DADOS
                             </Button>
                          </div>
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      );
    }


    if (view === "setores" || (view === "configuracoes" && configSubView === "setores")) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2 uppercase"><Edit2 className="h-5 w-5" /> CADASTRO DE SETORES</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
               <div className="flex gap-2 max-w-md">
               <Input placeholder="Nome do novo setor" value={newSectorName} onChange={(e) => setNewSectorName(e.target.value)} className="text-xs h-9" />
               <Button size="sm" className="text-[10px] h-9" onClick={async () => {
                 if (!newSectorName.trim()) return;
                 await db.addSetor(newSectorName);
                 setNewSectorName("");
                 refreshSetores();
                 toast.success("Setor adicionado!");
               }}><Plus className="h-3 w-3 mr-1" /> ADICIONAR</Button>
               {newSectorName && (
                 <Button size="sm" variant="ghost" className="h-9 text-[10px] text-muted-foreground" onClick={() => setNewSectorName("")}>
                   <Trash2 className="h-3 w-3 mr-1" /> Limpar
                 </Button>
               )}
             </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-[10px] font-bold h-10">NOME DO SETOR</TableHead>
                    <TableHead className="text-right text-[10px] font-bold h-10">AÇÕES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {setores.length === 0 ? (
                    <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground text-xs">Nenhum setor cadastrado.</TableCell></TableRow>
                  ) : setores.map((s) => (
                    <TableRow key={s.id}>
                     <TableCell className="text-[10px] py-4 uppercase font-medium">{s.nome}</TableCell>
                       <TableCell className="text-right py-4">
                         <div className="flex justify-end gap-1">
                           <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                             onClick={() => {
                               const novoNome = prompt("Novo nome do setor:", s.nome);
                               if (novoNome && novoNome.trim() && novoNome.trim() !== s.nome) {
                                 db.updateSetor(s.id, novoNome.trim()).then(() => { toast.success("Setor renomeado!"); refreshSetores(); })
                                   .catch(() => toast.error("Erro ao renomear setor."));
                               }
                             }}><Pencil className="h-4 w-4" /></Button>
                           <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                             onClick={async () => {
                               if (window.confirm(`Deseja excluir o setor ${s.nome}?`)) {
                                 await db.deleteSetor(s.id);
                                 toast.success("Setor removido!");
                                 refreshSetores();
                               }
                             }}><Trash2 className="h-4 w-4" /></Button>
                         </div>
                       </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardHeader className="flex flex-col space-y-4 pb-2">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold">
              VISÃO RH {view === "admissao" ? "— ADMISSÃO" : view === "iniciando" ? "— INICIANDO" : ""}
            </CardTitle>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-2 flex-grow justify-end">
              {view === "geral" && (
                <>
                  <Button size="sm" variant="outline" className="h-8 text-[10px] bg-red-50 text-red-700 hover:bg-red-100 border-red-200" onClick={async () => { const { data } = await supabase.from("historico").select("*").eq("novo_status", "excluido").order("created_at", { ascending: false }); setHistoricoLixeira(data || []); setShowLixeira(true); }}> <Trash2 className="mr-1 h-3 w-3" /> VER EXCLUÍDOS </Button>
                  {usuario?.perfil === "admin" && (
                    <Button size="sm" className="h-8 text-[10px] bg-blue-600 hover:bg-blue-700"
                      onClick={() => {
                        const newC: Candidato = {
                          id: `man${Date.now()}`, nome: "NOVO CANDIDATO", cpf: "", funcao: "",
                          setor: "Não informado", turno: "Turno A", status: "aguardando_portaria",
                          dataImportacao: new Date().toISOString().split("T")[0],
                        };
                        setSelected(newC);
                      }}><Users className="mr-1 h-3 w-3" /> NOVO CANDIDATO</Button>
                  )}
                  <Button size="sm" variant="outline" className="h-8 text-[10px] bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300"
                    onClick={() => setSearchParams({ view: "setores" })}><Edit2 className="mr-1 h-3 w-3" /> CADASTRAR SETORES</Button>
                  <Button size="sm" variant="outline" className="h-8 text-[10px] bg-red-600 text-white hover:bg-red-700 border-red-200 font-bold"
                    onClick={() => setShowLimparDialog(true)}>
                    <Trash2 className="mr-1 h-3 w-3" /> LIMPAR DADOS</Button>
                  <Button size="sm" className="h-8 text-[10px] bg-green-600 hover:bg-green-700"
                    onClick={async () => {
                      const toRelease = allCandidatos.filter(c => c.status === "rh_concluido" || c.status === "doc_ok");
                      if (toRelease.length === 0) { toast.error("Nenhum candidato pronto."); return; }
                      for (const c of toRelease) {
                        await db.updateCandidatoStatus(c.id, "data_inicio_definida", "RH", "Liberado para Real Parceria");
                      }
                      toast.success(`${toRelease.length} candidatos liberados!`);
                      refresh();
                    }}><CheckSquare className="mr-1 h-3 w-3" /> LIBERAR APROVADOS PARA REAL PARCERIA</Button>
                </>
              )}
              <Button size="sm" variant="outline" className="h-8 text-[10px] bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={async () => {
                  const all = await db.getCandidatos(true);
                  const dataToExport = all.filter(c => c.status === "aprovado");
                  if (dataToExport.length === 0) { toast.error("Nenhum aprovado para exportar."); return; }
                  const XLSX = await import("xlsx");
                  const wsData = dataToExport.map(c => ({
                    "Nome": c.nome, "CPF": c.cpf, "Função": c.funcao, "Setor": c.setor,
                    "Turno": c.turno, "Data Integração": c.dataIntegracao || "",
                    "Telefone": c.telefone || "", "Indicação": c.indicacao || "",
                  }));
                  const ws = XLSX.utils.json_to_sheet(wsData);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "Aprovados");
                  XLSX.writeFile(wb, `aprovados_rh_${new Date().toISOString().split('T')[0]}.xlsx`);
                  toast.success("Excel de aprovados exportado!");
                }}>REAL EXPORTAR EXCEL</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="flex items-center gap-2">
             <Search className="h-4 w-4 text-muted-foreground" />
             <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm text-xs h-9" />
             {search && (
               <Button size="sm" variant="ghost" className="h-9 text-xs text-muted-foreground" onClick={() => setSearch("")}>
                 <Trash2 className="h-3 w-3 mr-1" /> Limpar
               </Button>
             )}
           </div>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] font-bold">NOME / FUNÇÃO</TableHead>
                  <TableHead className="text-[11px] font-bold">SETOR</TableHead>
                  <TableHead className="text-[11px] font-bold">DATA PREVISTA</TableHead>
                  <TableHead className="text-[11px] font-bold">SITUAÇÃO</TableHead>
                  <TableHead className="text-[11px] font-bold">STATUS</TableHead>
                  <TableHead className="text-right text-[11px] font-bold">AÇÃO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">Nenhum candidato.</TableCell></TableRow>
                ) : filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(c)}>
                    <TableCell className="font-medium text-[10px] py-2">
                      <div className="flex flex-col">
                        {c.nome}
                        <Badge variant="outline" className="text-[8px] h-4 w-fit px-1 bg-slate-50 text-slate-600 mt-1 uppercase font-semibold">{c.funcao}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-[10px] py-2 uppercase">{c.setor}</TableCell>
                    <TableCell className="text-[10px] py-2">
                      {c.dataInicio ? <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold">{formatDate(c.dataInicio)}</Badge> : "-"}
                    </TableCell>
                    <TableCell className="text-[10px] py-2 font-semibold text-blue-600 uppercase">{statusLabels[c.status]}</TableCell>
                    <TableCell className="py-2"><StatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-right py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        {view === "admissao" ? (
                          <Button size="sm" variant="outline" className="h-7 text-[10px] border-green-600 text-green-600 hover:bg-green-50 px-2"
                            onClick={() => { setAdmitting(c); setAdmissionDate(new Date().toISOString().split('T')[0]); setAdmissionSector(c.setor || ""); }}>ADMISSÃO</Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 text-[10px] border-primary text-primary hover:bg-primary/10 px-2"
                            onClick={() => { setAdmitting(c); setAdmissionDate(new Date().toISOString().split('T')[0]); }}
                            disabled={c.status === "rh_concluido"}>
                            <CheckCircle className="mr-1 h-3 w-3" /> Ação
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={async () => {
                            if (window.confirm(`Excluir ${c.nome}?`)) {
                              await db.deleteCandidato(c.id);
                              toast.success(`${c.nome} removido.`);
                              refresh();
                            }
                          }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  };


  const togglePortariaBlock = async () => {
    if (portariaBloqueada) {
      await db.desbloquearPortaria();
      setPortariaBloqueada(false);
      toast.success("Portaria DESBLOQUEADA — presença liberada.");
    } else {
      if (!window.confirm("Bloquear a Portaria? Todos que estão aguardando serão marcados como NÃO COMPARECEU.")) return;
      await db.bloquearPortaria();
      const count = await db.marcarAusentes();
      setPortariaBloqueada(true);
      toast.success(`Portaria BLOQUEADA. ${count} candidato(s) marcado(s) como ausente.`);
    }
  };

  return (
    <div className="space-y-6">

      {/* Config sub-tabs */}
      {view === "configuracoes" && (
        <div className="flex gap-2 flex-wrap items-center">
          <Button size="sm" variant={configSubView === "operacoes" ? "default" : "outline"} className="h-8 text-[10px]"
            onClick={() => setConfigSubView("operacoes")}>
            <Stethoscope className="h-3 w-3 mr-1" /> OPERAÇÕES DO DIA
          </Button>
          <Button size="sm" variant={configSubView === "portaria_config" ? "default" : "outline"} className="h-8 text-[10px]"
            onClick={() => setConfigSubView("portaria_config")}>
            <Lock className="h-3 w-3 mr-1" /> PORTARIA
          </Button>
          <Button size="sm" variant={configSubView === "fechamento" ? "default" : "outline"} className="h-8 text-[10px]"
            onClick={() => setConfigSubView("fechamento")}>
            <Lock className="h-3 w-3 mr-1" /> FECHAMENTO
          </Button>

          <div className="h-6 w-px bg-border mx-1" />
          <span className="text-[9px] font-bold text-muted-foreground uppercase">Cadastro:</span>

          <Button size="sm" variant={configSubView === "setores" ? "default" : "outline"} className="h-8 text-[10px]"
            onClick={() => setConfigSubView("setores")}>
            <Edit2 className="h-3 w-3 mr-1" /> SETORES
          </Button>
          <Button size="sm" variant={configSubView === "usuarios" ? "default" : "outline"} className="h-8 text-[10px]"
            onClick={() => setConfigSubView("usuarios")}>
            <Users className="h-3 w-3 mr-1" /> USUÁRIOS
          </Button>

          {(usuario?.perfil === "admin" || ["luciano", "mauricio", "sonia"].includes(usuario?.login?.toLowerCase() || "")) && (
            <>
              <div className="h-6 w-px bg-border mx-1" />
              <Button size="sm" variant={configSubView === "modulos" ? "default" : "outline"} className="h-8 text-[10px]"
                onClick={() => setConfigSubView("modulos")}>
                <Monitor className="h-3 w-3 mr-1" /> MÓDULOS
              </Button>
              <Button size="sm" variant={configSubView === "limpar" ? "destructive" : "outline"} className="h-8 text-[10px] bg-red-600 text-white hover:bg-red-700 font-bold"
                onClick={() => setConfigSubView("limpar")}>
                <Trash2 className="h-3 w-3 mr-1" /> LIMPAR DADOS
              </Button>
            </>
          )}
        </div>
      )}

      {/* Operações do Dia */}
      {view === "configuracoes" && configSubView === "operacoes" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold uppercase flex items-center gap-2">
              <Stethoscope className="h-5 w-5" /> Operações do Dia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">Ações rápidas para gerenciar o fluxo do dia. Nenhuma ação aqui exclui dados permanentemente.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Marcar como Atendido */}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/10 p-4 space-y-2">
                <p className="text-sm font-bold uppercase">Marcar como Já Atendido</p>
                <p className="text-[10px] text-muted-foreground">Marca candidato como "Atendido" sem passar pela fila. Atendentes não vão chamar esse candidato.</p>
                {(() => {
                  const hoje = new Date().toISOString().split("T")[0];
                  const naFila = allCandidatos.filter(c => (c.dataIntegracao === hoje || c.dataImportacao === hoje) && ["presente", "na_fila_atendimento"].includes(c.status));
                  if (naFila.length === 0) return <p className="text-[10px] text-muted-foreground italic">Nenhum candidato na fila.</p>;
                  return (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {naFila.map(c => (
                        <div key={c.id} className="flex items-center justify-between gap-2 rounded border border-emerald-200 bg-background px-2 py-1">
                          <span className="text-[11px] font-semibold truncate">{c.nome}</span>
                          <Button size="sm" variant="outline" className="h-6 text-[9px] border-emerald-300 text-emerald-700 hover:bg-emerald-100 shrink-0"
                            onClick={async () => {
                              if (!window.confirm(`Marcar ${c.nome} como já atendido?`)) return;
                              await db.updateCandidatoStatus(c.id, "atendido", usuario?.nome || "RH", "Marcado como atendido manualmente");
                              toast.success(`${c.nome} marcado como atendido!`);
                              refresh();
                            }}>
                            <CheckCircle className="h-3 w-3" /> ATENDIDO
                          </Button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Retornar para Portaria */}
              <div className="rounded-lg border border-cyan-200 bg-cyan-50/50 dark:bg-cyan-950/10 p-4 space-y-2">
                <p className="text-sm font-bold uppercase">Retornar para Portaria</p>
                <p className="text-[10px] text-muted-foreground">Volta candidato para "Aguardando Presença" — como se a portaria não tivesse dado presente.</p>
                {(() => {
                  const hoje = new Date().toISOString().split("T")[0];
                  const doDia = allCandidatos.filter(c => (c.dataIntegracao === hoje || c.dataImportacao === hoje) && c.status !== "aguardando_presenca" && c.status !== "ausente");
                  if (doDia.length === 0) return <p className="text-[10px] text-muted-foreground italic">Nenhum candidato disponível.</p>;
                  return (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {doDia.map(c => (
                        <div key={c.id} className="flex items-center justify-between gap-2 rounded border border-cyan-200 bg-background px-2 py-1">
                          <span className="text-[11px] font-semibold truncate">{c.nome}</span>
                          <Button size="sm" variant="outline" className="h-6 text-[9px] border-cyan-300 text-cyan-700 hover:bg-cyan-100 shrink-0"
                            onClick={async () => {
                              if (!window.confirm(`Retornar ${c.nome} para Aguardando Presença?`)) return;
                              const { error } = await supabase.from("candidatos").update({ status: "aguardando_presenca", observacoes: null, data_presenca: null, hora_presenca: null }).eq("id", c.id);
                              if (error) { toast.error("Erro: " + error.message); return; }
                              toast.success(`${c.nome} voltou para Aguardando Presença!`);
                              refresh();
                            }}>
                            <X className="h-3 w-3" /> RETORNAR
                          </Button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Limpar Atendimento */}
              <div className="rounded-lg border border-purple-200 bg-purple-50/50 dark:bg-purple-950/10 p-4 space-y-2">
                <p className="text-sm font-bold uppercase">Limpar Atendimento</p>
                <p className="text-[10px] text-muted-foreground">Todos os candidatos do dia voltam para "Presente", como se ninguém tivesse sido atendido.</p>
                <Button size="sm" variant="outline" className="h-8 text-[10px] border-purple-300 text-purple-700 hover:bg-purple-100"
                  onClick={async () => {
                    if (!window.confirm("⚠️ CONFIRMAR: Limpar todos os dados de atendimento do dia?\n\nTODOS voltarão para 'Presente'.")) return;
                    const hoje = new Date().toISOString().split("T")[0];
                    const statusToReset = ["na_fila_atendimento", "em_atendimento", "atendido", "aprovado", "reprovado", "presente", "em_analise", "rh_pendente", "rh_concluido", "finalizado"];
                    const { data: byInteg } = await supabase.from("candidatos").select("id, status").eq("data_integracao", hoje).in("status", statusToReset);
                    const { data: byImport } = await supabase.from("candidatos").select("id, status").eq("data_importacao", hoje).in("status", statusToReset);
                    const allIds = new Set<string>();
                    const allData: { id: string }[] = [];
                    for (const item of [...(byInteg || []), ...(byImport || [])]) {
                      if (!allIds.has(item.id)) { allIds.add(item.id); allData.push(item); }
                    }
                    if (allData.length === 0) { toast.info("Nenhum candidato para limpar."); return; }
                    let ok = 0;
                    for (const c of allData) {
                      const { error } = await supabase.from("candidatos").update({ status: "presente", observacoes: null }).eq("id", c.id);
                      if (!error) ok++;
                      else { console.error("Limpar erro:", error.message, c.id); toast.error("Erro: " + error.message); }
                    }
                    toast.success(`${ok} de ${allData.length} candidatos voltaram para 'Presente'!`);
                    refresh();
                  }}>
                  <Trash2 className="h-3 w-3 mr-1" /> LIMPAR ATENDIMENTO
                </Button>
              </div>

              {/* Liberar Especialistas Travados */}
              <div className="rounded-lg border border-orange-200 bg-orange-50/50 dark:bg-orange-950/10 p-4 space-y-2">
                <p className="text-sm font-bold uppercase">Liberar Especialistas Travados</p>
                <p className="text-[10px] text-muted-foreground">Encerra atendimentos em curso E remove marcações antigas de "atendente:" que travam o especialista.</p>
                {(() => {
                  // Inclui qualquer candidato com 'atendente:' nas observações OU em em_atendimento
                  const travados = allCandidatos.filter(c =>
                    c.status === "em_atendimento" || /atendente:/i.test(c.observacoes || "")
                  );
                  if (travados.length === 0) return <p className="text-[10px] text-muted-foreground italic">Nenhum atendimento ativo ou marcação travada.</p>;

                  const limparUm = async (c: any) => {
                    const obsClean = (c.observacoes || "").split("|").filter((p: string) => !p.startsWith("atendente:")).join("|") || null;
                    const novoStatus = c.status === "em_atendimento" ? "na_fila_atendimento" : c.status;
                    const { error } = await supabase.from("candidatos").update({ status: novoStatus, observacoes: obsClean }).eq("id", c.id);
                    if (error) { toast.error("Erro: " + error.message); return false; }
                    return true;
                  };

                  return (
                    <div className="space-y-1">
                      {travados.map(c => {
                        const m = (c.observacoes || "").match(/atendente:([^|]+)/i);
                        const atendente = m ? m[1].trim() : null;
                        return (
                          <div key={c.id} className="flex items-center justify-between gap-2 rounded border border-orange-200 bg-background px-2 py-1">
                            <span className="text-[11px] font-semibold truncate">
                              {c.nome}
                              {atendente && <span className="ml-1 text-[9px] text-orange-700">({atendente})</span>}
                              {c.status !== "em_atendimento" && atendente && <span className="ml-1 text-[9px] text-red-600">[travado]</span>}
                            </span>
                            <Button size="sm" variant="outline" className="h-6 text-[9px] border-orange-300 text-orange-700 hover:bg-orange-100 shrink-0"
                              onClick={async () => {
                                const ok = await limparUm(c);
                                if (ok) { toast.success(`${c.nome} liberado!`); refresh(); }
                              }}>
                              <X className="h-3 w-3" /> LIBERAR
                            </Button>
                          </div>
                        );
                      })}
                      {travados.length > 1 && (
                        <Button size="sm" variant="outline" className="h-7 text-[10px] border-orange-300 text-orange-700 hover:bg-orange-100 w-full mt-1"
                          onClick={async () => {
                            if (!window.confirm("⚠️ Liberar TODOS os atendimentos/travamentos?")) return;
                            let ok = 0;
                            for (const c of travados) { if (await limparUm(c)) ok++; }
                            toast.success(`${ok} atendimento(s) liberado(s)!`);
                            refresh();
                          }}>
                          <Monitor className="h-3 w-3 mr-1" /> LIBERAR TODOS
                        </Button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Limpar Portaria */}
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 p-4 space-y-2">
                <p className="text-sm font-bold uppercase">Limpar Portaria</p>
                <p className="text-[10px] text-muted-foreground">Reseta presença/ausência. Todos voltam para "Aguardando Presença".</p>
                <Button size="sm" variant="outline" className="h-8 text-[10px] border-amber-300 text-amber-700 hover:bg-amber-100"
                  onClick={async () => {
                    if (!window.confirm("⚠️ CONFIRMAR: Limpar todas as marcações de presença?")) return;
                    const hoje = new Date().toISOString().split("T")[0];
                    const { data } = await supabase.from("candidatos").select("id").or(`data_integracao.eq.${hoje},data_importacao.eq.${hoje}`).in("status", ["presente", "ausente"]);
                    if (!data || data.length === 0) { toast.info("Nenhum candidato para limpar."); return; }
                    for (const c of data) {
                      await supabase.from("candidatos").update({ status: "aguardando_presenca", data_presenca: null, hora_presenca: null }).eq("id", c.id);
                    }
                    toast.success(`${data.length} candidatos resetados!`);
                    refresh();
                  }}>
                  <Trash2 className="h-3 w-3 mr-1" /> LIMPAR PORTARIA
                </Button>
              </div>

              {/* Limpar Aprovados/Reprovados */}
              <div className="rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/10 p-4 space-y-2">
                <p className="text-sm font-bold uppercase">Limpar Aprovados/Reprovados</p>
                <p className="text-[10px] text-muted-foreground">Remove decisões finais. Voltam para "Presente".</p>
                <Button size="sm" variant="outline" className="h-8 text-[10px] border-green-300 text-green-700 hover:bg-green-100"
                  onClick={async () => {
                    if (!window.confirm("⚠️ CONFIRMAR: Limpar todos os aprovados e reprovados?")) return;
                    const { data } = await supabase.from("candidatos").select("id").in("status", ["aprovado", "reprovado", "atendido"]);
                    if (!data || data.length === 0) { toast.info("Nenhum candidato."); return; }
                    for (const c of data) {
                      await supabase.from("candidatos").update({ status: "presente", observacoes: null }).eq("id", c.id);
                    }
                    toast.success(`${data.length} candidatos limpos!`);
                    refresh();
                  }}>
                  <Trash2 className="h-3 w-3 mr-1" /> LIMPAR APROVADOS/REPROVADOS
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Portaria Config */}
      {view === "configuracoes" && configSubView === "portaria_config" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold uppercase flex items-center gap-2">
              <Lock className="h-5 w-5" /> Configurações da Portaria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Block control */}
            <div className={cn("rounded-lg border p-4 flex items-center justify-between flex-wrap gap-3", portariaBloqueada ? "border-destructive/50 bg-destructive/5" : "border-green-500/50 bg-green-50/50 dark:bg-green-950/10")}>
              <div className="flex items-center gap-3">
                <Lock className={cn("h-5 w-5", portariaBloqueada ? "text-destructive" : "text-green-600")} />
                <div>
                  <p className="text-sm font-bold uppercase">Status da Portaria</p>
                  <p className="text-xs text-muted-foreground">
                    {portariaBloqueada ? "BLOQUEADA — ninguém pode marcar presença" : "LIBERADA — marcação de presença ativa"}
                  </p>
                </div>
              </div>
              <Button onClick={togglePortariaBlock} variant={portariaBloqueada ? "default" : "destructive"} className="h-10 font-bold text-xs">
                <Lock className="h-4 w-4 mr-2" />
                {portariaBloqueada ? "DESBLOQUEAR PORTARIA" : "BLOQUEAR PORTARIA"}
              </Button>
            </div>

            {/* Layout config */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-bold uppercase">Colunas da Portaria</p>
                <p className="text-xs text-muted-foreground">Define quantas colunas exibir na tela da Portaria</p>
                <Button variant="outline" size="sm" className="h-10 font-bold text-xs w-full"
                  onClick={() => {
                    const current = localStorage.getItem("portaria_colunas") || "2";
                    const next = current === "2" ? "1" : "2";
                    localStorage.setItem("portaria_colunas", next);
                    toast.success(`Portaria configurada para ${next} coluna(s).`);
                  }}>
                  {(localStorage.getItem("portaria_colunas") || "2") === "2" ? "PORTARIA: 2 COLUNAS" : "PORTARIA: 1 COLUNA"}
                </Button>
              </div>
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-bold uppercase">Tempo do Painel (segundos)</p>
                <p className="text-xs text-muted-foreground">Intervalo de atualização do painel de atendimento</p>
                <Input
                  type="number" min={5} max={120}
                  className="h-10 w-full text-center font-bold text-xs"
                  defaultValue={localStorage.getItem("painel_tempo_segundos") || "15"}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (v >= 5 && v <= 120) {
                      localStorage.setItem("painel_tempo_segundos", String(v));
                      toast.success(`Tempo do painel: ${v} segundos`);
                    }
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Módulos Config */}
      {view === "configuracoes" && configSubView === "modulos" && (usuario?.perfil === "admin" || ["luciano", "mauricio", "sonia"].includes(usuario?.login?.toLowerCase() || "")) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold uppercase flex items-center gap-2">
              <Monitor className="h-5 w-5" /> Configurações de Módulos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border p-4 space-y-4 bg-blue-50/50">
              <div className="flex items-center justify-between border-b border-blue-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold uppercase flex items-center gap-2 text-blue-800">
                    <Activity className="h-4 w-4" /> Módulo Atendimento Diário
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">O acesso a este módulo agora é controlado individualmente por usuário.</p>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-[10px] text-muted-foreground italic">
                  O acesso individual aos usuários agora é gerenciado diretamente na tela de <strong>USUÁRIOS</strong>.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2 h-7 text-[9px] font-bold"
                  onClick={() => setConfigSubView("usuarios")}
                >
                  IR PARA GERENCIAR USUÁRIOS
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Limpar Dados - Master only (destructive) */}
      {view === "configuracoes" && configSubView === "limpar" && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-lg font-bold uppercase flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Limpar Dados (Permanente)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-destructive/80 font-semibold">⚠️ Estas ações excluem dados permanentemente e NÃO podem ser desfeitas.</p>

            <div className="rounded-lg border border-red-300 bg-red-50/50 dark:bg-red-950/10 p-4 space-y-2">
              <p className="text-sm font-bold uppercase text-destructive">Limpar Tudo</p>
              <p className="text-[10px] text-muted-foreground">Remove TODOS os dados: candidatos, histórico e datas fechadas.</p>
              <Button size="sm" variant="destructive" className="h-8 text-[10px]"
                onClick={async () => {
                  if (!window.confirm("🚨 ATENÇÃO MÁXIMA!\n\nDeseja EXCLUIR TODOS os dados do sistema?\n\n• Todos os candidatos\n• Todo o histórico\n• Todas as datas fechadas\n\nEsta ação NÃO PODE ser desfeita!")) return;
                  if (!window.confirm("Tem CERTEZA ABSOLUTA? Todos os dados serão perdidos permanentemente.")) return;
                  await db.resetData();
                  toast.success("Todos os dados foram excluídos!");
                  refresh();
                }}>
                <Trash2 className="h-3 w-3 mr-1" /> LIMPAR TUDO
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {renderContent()}

      <Dialog open={!!admitting} onOpenChange={(v) => !v && setAdmitting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-green-600" /> CONFIRMAR ADMISSÃO</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold">{admitting?.nome}</p>
              <p className="text-[10px] text-muted-foreground uppercase">{admitting?.funcao}</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="data-admissao" className="text-xs">Data de Admissão</Label>
                <Input id="data-admissao" type="date" value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} className="text-xs" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setor-admissao" className="text-xs">Setor</Label>
                <select id="setor-admissao"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={admissionSector} onChange={(e) => setAdmissionSector(e.target.value)}>
                  <option value="">Selecione um setor...</option>
                  {setores.map((s) => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAdmitting(null)} className="h-9 text-xs">CANCELAR</Button>
            <Button className="h-9 text-xs bg-green-600 hover:bg-green-700"
              onClick={async () => {
                if (admitting && admissionDate) {
                  await db.updateCandidato(admitting.id, { dataInicio: admissionDate, setor: admissionSector || admitting.setor });
                  await db.updateCandidatoStatus(admitting.id, "finalizado", "RH", `Admissão realizada para ${formatDate(admissionDate)} no setor ${admissionSector || admitting.setor}`);
                  toast.success(`Admissão de ${admitting.nome} realizada!`);
                  setAdmitting(null);
                  refresh();
                }
              }}>CONFIRMAR ADMISSÃO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CandidatoDialog candidato={selected} open={!!selected} onClose={() => setSelected(null)} onUpdated={() => { refresh(); setSelected(null); }} />

      {/* Dialog Limpar Dados por Data */}
      <Dialog open={showLimparDialog} onOpenChange={setShowLimparDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-5 w-5" /> LIMPAR DADOS POR DATA</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Selecione a data de integração para excluir todos os candidatos e histórico associados.</p>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Data de Integração</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={limparDate}
                onChange={(e) => setLimparDate(e.target.value)}
              >
                <option value="">Selecione uma data...</option>
                {(() => {
                  const dates = [...new Set(allCandidatosIncClosed.map(c => normalizeDateKey(c.dataIntegracao)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
                  return dates.map(d => {
                    const count = allCandidatosIncClosed.filter(c => isSameDateKey(c.dataIntegracao, d)).length;
                    return <option key={d} value={d}>{formatDate(d)} ({count} candidatos)</option>;
                  });
                })()}
              </select>
            </div>
            {limparDate && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs font-bold text-destructive">⚠️ ATENÇÃO</p>
                <p className="text-xs text-destructive/80 mt-1">
                  Todos os candidatos e históricos da data <strong>{formatDate(limparDate)}</strong> serão excluídos permanentemente.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowLimparDialog(false); setLimparDate(""); }} className="h-9 text-xs">CANCELAR</Button>
            <Button variant="destructive" className="h-9 text-xs" disabled={!limparDate}
              onClick={async () => {
                if (!limparDate) return;
                const count = await db.deleteCandidatosByDate(limparDate);
                toast.success(`${count} candidatos da data ${formatDate(limparDate)} excluídos!`);
                setShowLimparDialog(false);
                setLimparDate("");
                refresh();
              }}>
              <Trash2 className="h-3 w-3 mr-1" /> CONFIRMAR EXCLUSÃO
            </Button>
      {/* Dialog Lixeira */}
      <Dialog open={showLixeira} onOpenChange={setShowLixeira}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="h-5 w-5" /> CANDIDATOS EXCLUÍDOS (LIXEIRA)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Estes são os candidatos que foram excluídos. Você pode restaurá-los para a fila de espera se necessário.</p>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-[10px] font-bold">DADOS DO CANDIDATO</TableHead>
                    <TableHead className="text-[10px] font-bold">EXCLUÍDO POR / EM</TableHead>
                    <TableHead className="text-right text-[10px] font-bold">AÇÃO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicoLixeira.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground text-xs">Nenhum registro de exclusão encontrado.</TableCell></TableRow>
                  ) : historicoLixeira.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-[10px] py-4">
                        <p className="font-bold uppercase">{h.observacao.split("Nome: ")[1]?.split(",")[0] || "N/A"}</p>
                        <p className="text-muted-foreground mt-1 truncate max-w-xs">{h.observacao}</p>
                      </TableCell>
                      <TableCell className="text-[10px] py-4">
                        <p className="font-semibold">{h.usuario}</p>
                        <p className="text-muted-foreground">{formatDate(h.data)} às {h.hora}</p>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <Button size="sm" className="h-8 text-[10px] bg-green-600 hover:bg-green-700" onClick={async () => {
                          const obs = h.observacao;
                          const nome = obs.split("Nome: ")[1]?.split(",")[0] || "";
                          const cpf = obs.split("CPF: ")[1]?.split(",")[0] || "";
                          const funcao = obs.split("Função: ")[1]?.split(",")[0] || "";
                          const setor = obs.split("Setor: ")[1]?.split(",")[0] || "";
                          const dataIntegracao = obs.split("Data Integr.: ")[1]?.split(",")[0] || "";
                          
                          if (window.confirm(`Deseja restaurar ${nome} para a fila?`)) {
                            const novoC = {
                              nome, 
                              cpf, 
                              funcao, 
                              setor, 
                              turno: "GERAL",
                              status: "na_fila_atendimento" as any, 
                              dataIntegracao: new Date().toISOString().split("T")[0],
                              data_integracao: dataIntegracao !== "N/A" ? dataIntegracao : undefined,
                            };
                            await db.addCandidato(novoC as any);
                            await supabase.from("historico").delete().eq("id", h.id);
                            toast.success(`${nome} restaurado com sucesso!`);
                            setShowLixeira(false);
                            refresh();
                          }
                        }}>
                          RESTAURAR
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLixeira(false)} className="h-9 text-xs">FECHAR</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
