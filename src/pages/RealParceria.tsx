import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useCandidatosDoDia } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import * as db from "@/lib/supabaseData";
import type { Candidato } from "@/lib/supabaseData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Handshake, Users, UserCheck, UserX, Clock, CheckCircle, XCircle, FileSpreadsheet, FileCheck, AlertCircle, CalendarCheck, Lock, Undo2 } from "lucide-react";
import { cn, formatIndicacao } from "@/lib/utils";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";

export default function RealParceria() {
  const { usuario } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") || "geral";
  const { candidatos, loading, refresh } = useCandidatosDoDia();
  const isFullAccess = usuario?.perfil === "admin" || usuario?.acessoRH;
  const effectiveView = isFullAccess ? view : "geral";
  const [search, setSearch] = useState("");
  const [docDialog, setDocDialog] = useState<Candidato | null>(null);
  const [admDialog, setAdmDialog] = useState<Candidato | null>(null);
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [resultadoLiberado, setResultadoLiberado] = useState(false);
  const [reprovadoDialog, setReprovadoDialog] = useState<Candidato | null>(null);

  useEffect(() => {
    db.isResultadoLiberado().then(setResultadoLiberado);
    const unsub = db.subscribeToClosedDates(() => { db.isResultadoLiberado().then(setResultadoLiberado); });
    return unsub;
  }, []);

  const handleViewChange = (val: string) => setSearchParams({ view: val });

  const stats = useMemo(() => {
    const s = { total: 0, presentes: 0, ausentes: 0, presM: 0, presF: 0, fretados: {} as Record<string, number> };
    candidatos.forEach(c => {
      s.total++;
      const isAusente = c.status === "ausente" || ["aguardando_presenca", "aguardando_portaria"].includes(c.status);
      if (isAusente) {
        s.ausentes++;
      } else {
        s.presentes++;
        const sexo = (c.sexo || "").toString().trim().toUpperCase();
        if (sexo === "M" || sexo === "MASCULINO") s.presM++;
        else if (sexo === "F" || sexo === "FEMININO") s.presF++;
        if (c.fretado && c.fretado.trim()) {
          const key = c.fretado.trim().toUpperCase();
          s.fretados[key] = (s.fretados[key] || 0) + 1;
        }
      }
    });
    return s;
  }, [candidatos]);

  const fretadosSorted = useMemo(() => Object.entries(stats.fretados).sort((a, b) => b[1] - a[1]), [stats.fretados]);
  const fretadosTop = fretadosSorted.slice(0, 5);
  const fretadosRest = fretadosSorted.length > 5 ? fretadosSorted.length - 5 : 0;

  const filtered = useMemo(() => {
    return candidatos
      .filter(c => !search || c.nome.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [candidatos, search]);

  // Aprovados/Reprovados - simple columns without approver info
  const aprovadosReprovados = useMemo(() => {
    const decisoes = candidatos.filter(c => ["aprovado", "reprovado"].includes(c.status));
    const aprovados = decisoes.filter(c => c.status === "aprovado").sort((a, b) => a.nome.localeCompare(b.nome));
    const reprovados = decisoes.filter(c => c.status === "reprovado").sort((a, b) => a.nome.localeCompare(b.nome));
    return { aprovados, reprovados };
  }, [candidatos]);

  // Documentos: only approved candidates
  const aprovadosParaDoc = useMemo(() => {
    return candidatos
      .filter(c => c.status === "aprovado" || c.status === "doc_ok")
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [candidatos]);

  // Admissão: doc_ok candidates needing start date
  const admissaoCandidatos = useMemo(() => {
    return candidatos
      .filter(c => c.status === "doc_ok")
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [candidatos]);

  // Candidatos with data_inicio already set
  const comDataInicio = useMemo(() => {
    return candidatos
      .filter(c => c.status === "data_inicio_definida" || (c.status === "doc_ok" && c.dataInicio))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [candidatos]);

  const exportAprovados = async () => {
    const aprovados = candidatos.filter(c => c.status === "aprovado");
    if (aprovados.length === 0) { toast.error("Nenhum aprovado para exportar."); return; }
    const XLSX = await import("xlsx");
    const wsData = aprovados.sort((a, b) => a.nome.localeCompare(b.nome)).map(c => ({
      "Nome": c.nome, "CPF": c.cpf, "Função": c.funcao, "Setor": c.setor,
      "Turno": c.turno, "Data Integração": c.dataIntegracao || "",
      "Telefone": c.telefone || "", "Indicação": c.indicacao || "",
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Aprovados");
    XLSX.writeFile(wb, `aprovados_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Excel de aprovados exportado!");
  };

  const handleDocOk = async (c: Candidato) => {
    await db.updateCandidatoStatus(c.id, "doc_ok", "Real Parceria", "Documentação verificada e aprovada");
    toast.success(`Documentação de ${c.nome} marcada como OK!`);
    setDocDialog(null);
    refresh();
  };

  const handleSetDataInicio = async () => {
    if (!admDialog || !dataInicio) return;
    const dateStr = format(dataInicio, "yyyy-MM-dd");
    await db.updateCandidato(admDialog.id, { dataInicio: dateStr });
    await db.updateCandidatoStatus(admDialog.id, "data_inicio_definida", "Real Parceria", `Data prevista para início: ${format(dataInicio, "dd/MM/yyyy")}`);
    toast.success(`Data de início de ${admDialog.nome} definida para ${format(dataInicio, "dd/MM/yyyy")}!`);
    setAdmDialog(null);
    setDataInicio(undefined);
    refresh();
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground text-lg">Carregando...</div>;

  const getStatusBadge = (c: Candidato) => {
    const isAusente = c.status === "ausente" || ["aguardando_presenca", "aguardando_portaria"].includes(c.status);
    const isPresente = !isAusente;

    if (isAusente) return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 text-xs">AUSENTE</Badge>;
    if (isPresente) return <Badge className="bg-green-600 text-white text-xs">PRESENTE</Badge>;
    return <Badge className="bg-green-600 text-white text-xs">PRESENTE</Badge>;
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tight flex items-center gap-3">
              <Handshake className="h-7 w-7 text-primary" /> Real Parceria
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Acompanhamento em tempo real — {new Date().toLocaleDateString("pt-BR")}</p>
          </div>
        </div>


        {effectiveView === "geral" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card><CardContent className="p-4 flex items-center gap-3">
                <Users className="h-7 w-7 text-primary" />
                <div><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground uppercase font-semibold">Total</p></div>
              </CardContent></Card>
              <Card className="border-green-200 bg-green-50/30 dark:bg-green-950/10">
                <CardContent className="p-4 flex items-center gap-3">
                  <UserCheck className="h-7 w-7 text-green-600" />
                  <div><p className="text-2xl font-bold text-green-600">{stats.presentes}</p><p className="text-xs text-muted-foreground uppercase font-semibold">Presentes</p></div>
                  {stats.presentes > 0 && (
                    <div className="flex items-center gap-1.5 ml-auto flex-wrap justify-end">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold px-1.5 py-0">♂ {stats.presM}</Badge>
                      <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-200 text-[10px] font-bold px-1.5 py-0">♀ {stats.presF}</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card><CardContent className="p-4 flex items-center gap-3">
                <UserX className="h-7 w-7 text-destructive" />
                <div><p className="text-2xl font-bold text-destructive">{stats.ausentes}</p><p className="text-xs text-muted-foreground uppercase font-semibold">Ausentes</p></div>
              </CardContent></Card>
            </div>

            {/* Fretados summary */}
            {fretadosTop.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">🚌 Fretados:</span>
                {fretadosTop.map(([nome, qtd]) => (
                  <Badge key={nome} variant="outline" className="text-[10px] font-bold px-2 py-0.5">
                    {nome}: {qtd}
                  </Badge>
                ))}
                {fretadosRest > 0 && (
                  <span className="text-[10px] text-muted-foreground">+{fretadosRest} outros</span>
                )}
              </div>
            )}

            {/* Search + Export */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Search className="h-5 w-5 text-muted-foreground" />
                  <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="text-base h-11" />
                  <Button size="sm" className="h-11 text-xs font-bold whitespace-nowrap" onClick={async () => {
                    const presentes = candidatos.filter(c => ["presente", "na_fila_atendimento", "em_atendimento", "atendido", "finalizado", "aprovado", "doc_ok"].includes(c.status));
                    const ausentes = candidatos.filter(c => c.status === "ausente");
                    if (presentes.length === 0 && ausentes.length === 0) { toast.error("Nenhum candidato presente ou ausente."); return; }
                    const XLSX = await import("xlsx");
                    const wb = XLSX.utils.book_new();
                    if (presentes.length > 0) {
                      const ws = XLSX.utils.json_to_sheet(presentes.sort((a, b) => a.nome.localeCompare(b.nome)).map(c => ({
                        "Nome": c.nome, "CPF": c.cpf, "Função": c.funcao, "Setor": c.setor,
                        "Turno": c.turno, "Telefone": c.telefone || "", "Indicação": c.indicacao || "",
                        "Hora Presença": c.horaPresenca || "",
                      })));
                      XLSX.utils.book_append_sheet(wb, ws, "Presentes");
                    }
                    if (ausentes.length > 0) {
                      const ws = XLSX.utils.json_to_sheet(ausentes.sort((a, b) => a.nome.localeCompare(b.nome)).map(c => ({
                        "Nome": c.nome, "CPF": c.cpf, "Função": c.funcao, "Setor": c.setor,
                        "Turno": c.turno, "Telefone": c.telefone || "", "Indicação": c.indicacao || "",
                      })));
                      XLSX.utils.book_append_sheet(wb, ws, "Ausentes");
                    }
                    XLSX.writeFile(wb, `presenca_${new Date().toISOString().split('T')[0]}.xlsx`);
                    toast.success("Excel exportado com presentes e ausentes!");
                  }}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" /> EXPORTAR EXCEL
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* List */}
            <div className="space-y-2">
              {filtered.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground text-base">Nenhum candidato encontrado.</CardContent></Card>
              ) : (
                filtered.map(c => {
                  const isPresente = ["presente", "na_fila_atendimento", "em_atendimento", "atendido", "finalizado", "aprovado"].includes(c.status);
                  const isAusente = c.status === "ausente";
                  return (
                    <Card key={c.id} className={cn(
                      "border-l-4 transition-all",
                      isPresente && "border-l-green-500 bg-green-50/50 dark:bg-green-950/20",
                      isAusente && "border-l-red-400 bg-red-50/30 dark:bg-red-950/10 opacity-60",
                      !isPresente && !isAusente && "border-l-amber-400",
                    )}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className={cn("text-base font-bold uppercase", isAusente && "line-through text-muted-foreground")}>{c.nome}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground">{c.funcao}</span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground uppercase">{c.setor}</span>
                            {c.indicacao && (
                              <>
                                <span className="text-xs text-muted-foreground">•</span>
                                <span className="text-xs text-blue-600 font-medium">Indicação: {formatIndicacao(c.indicacao)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.horaPresenca && isPresente && <span className="text-sm font-mono text-green-700">{c.horaPresenca}</span>}
                          {getStatusBadge(c)}
                          {isPresente && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={async () => {
                                    if (!confirm(`Desfazer presença de ${c.nome}?`)) return;
                                    await db.updateCandidatoStatus(c.id, "aguardando_presenca", "Real Parceria", "Presença desfeita");
                                    await db.updateCandidato(c.id, { horaPresenca: null, dataPresenca: null });
                                    toast.info(`Presença de ${c.nome} desfeita e horário limpo.`);
                                    refresh();
                                  }}
                                >
                                  <Undo2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Desfazer presença</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </>
        )}

        {effectiveView === "aprovados" && (
          <div className="space-y-6">
            {!resultadoLiberado ? (
              <Card>
                <CardContent className="p-12 text-center space-y-4">
                  <Lock className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                  <p className="text-lg font-bold text-muted-foreground">RESULTADO AINDA NÃO LIBERADO</p>
                  <p className="text-sm text-muted-foreground">Aguardando o RH liberar os resultados de aprovados e reprovados.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Card><CardContent className="p-4 flex items-center gap-3">
                    <CheckCircle className="h-7 w-7 text-green-600" />
                    <div><p className="text-2xl font-bold text-green-600">{aprovadosReprovados.aprovados.length}</p><p className="text-xs text-muted-foreground uppercase font-semibold">Aprovados</p></div>
                  </CardContent></Card>
                  <Card><CardContent className="p-4 flex items-center gap-3">
                    <XCircle className="h-7 w-7 text-destructive" />
                    <div><p className="text-2xl font-bold text-destructive">{aprovadosReprovados.reprovados.length}</p><p className="text-xs text-muted-foreground uppercase font-semibold">Reprovados</p></div>
                  </CardContent></Card>
                  <Card><CardContent className="p-4 flex items-center gap-3">
                    <Button size="sm" className="h-10 text-xs font-bold bg-green-600 hover:bg-green-700 w-full" onClick={exportAprovados}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" /> EXPORTAR APROVADOS (EXCEL)
                    </Button>
                  </CardContent></Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Coluna Aprovados */}
                  <Card className="flex flex-col">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold uppercase flex items-center gap-2 text-green-700">
                        <CheckCircle className="h-4 w-4" /> Aprovados ({aprovadosReprovados.aprovados.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1">
                      {aprovadosReprovados.aprovados.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Nenhum aprovado</p>
                      ) : (
                        <div className="space-y-1">
                          {aprovadosReprovados.aprovados.map(c => (
                            <div key={c.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                              <div>
                                <p className="text-xs font-bold uppercase">{c.nome}</p>
                                <p className="text-[10px] text-muted-foreground">{c.funcao} • {c.setor}</p>
                                {c.indicacao && <p className="text-[10px] text-blue-600">Indicação: {formatIndicacao(c.indicacao)}</p>}
                              </div>
                              <Badge className="bg-green-600 text-white text-[9px]">✓</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Coluna Reprovados */}
                  <Card className="flex flex-col">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold uppercase flex items-center gap-2 text-red-700">
                        <XCircle className="h-4 w-4" /> Reprovados ({aprovadosReprovados.reprovados.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1">
                      {aprovadosReprovados.reprovados.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Nenhum reprovado</p>
                      ) : (
                        <div className="space-y-1">
                          {aprovadosReprovados.reprovados.map(c => (
                            <div
                              key={c.id}
                              className="flex items-center justify-between py-1.5 px-2 rounded bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
                              onClick={() => setReprovadoDialog(c)}
                            >
                              <div>
                                <p className="text-xs font-bold uppercase">{c.nome}</p>
                                <p className="text-[10px] text-muted-foreground">{c.funcao} • {c.setor}</p>
                                {c.indicacao && <p className="text-[10px] text-blue-600">Indicação: {formatIndicacao(c.indicacao)}</p>}
                              </div>
                              <Badge className="bg-red-600 text-white text-[9px]">✗</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        )}

        {effectiveView === "documentos" && (
          <div className="space-y-4">
            {!resultadoLiberado ? (
              <Card>
                <CardContent className="p-12 text-center space-y-4">
                  <Lock className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                  <p className="text-lg font-bold text-muted-foreground">DOCUMENTOS BLOQUEADO</p>
                  <p className="text-sm text-muted-foreground">Aguardando o RH liberar os resultados primeiro.</p>
                </CardContent>
              </Card>
            ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-primary" /> VERIFICAÇÃO DE DOCUMENTOS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-4">Clique no candidato aprovado para confirmar que a documentação está OK.</p>

                {aprovadosParaDoc.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Nenhum candidato aprovado para verificar documentos.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {aprovadosParaDoc.map(c => {
                      const isDocOk = c.status === "doc_ok";
                      return (
                        <Card
                          key={c.id}
                          className={cn(
                            "border-l-4 cursor-pointer transition-all hover:shadow-md",
                            isDocOk
                              ? "border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                              : "border-l-amber-400 hover:border-l-primary",
                          )}
                          onClick={() => !isDocOk && setDocDialog(c)}
                        >
                          <CardContent className="p-4 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold uppercase">{c.nome}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">{c.funcao}</span>
                                <span className="text-xs text-muted-foreground">•</span>
                                <span className="text-xs text-muted-foreground uppercase">{c.setor}</span>
                              </div>
                              {c.indicacao && <p className="text-[10px] text-blue-600 mt-1">Indicação: {formatIndicacao(c.indicacao)}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              {isDocOk ? (
                                <Badge className="bg-emerald-600 text-white text-xs">
                                  <FileCheck className="h-3 w-3 mr-1" /> DOC OK
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                                  PENDENTE
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            )}
          </div>
        )}

        {effectiveView === "admissao" && (
          <div className="space-y-4">
          {!resultadoLiberado ? (
              <Card>
                <CardContent className="p-12 text-center space-y-4">
                  <Lock className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                  <p className="text-lg font-bold text-muted-foreground">ADMISSÃO BLOQUEADA</p>
                  <p className="text-sm text-muted-foreground">Aguardando o RH liberar os resultados primeiro.</p>
                </CardContent>
              </Card>
            ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <CalendarCheck className="h-5 w-5 text-primary" /> ADMISSÃO — DATA PREVISTA PARA INÍCIO
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-4">Clique no candidato com documento OK para definir a data prevista de início.</p>

                {admissaoCandidatos.length === 0 && comDataInicio.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Nenhum candidato com documento OK para definir data de início.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {admissaoCandidatos.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase text-amber-700 mb-2 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Aguardando data de início ({admissaoCandidatos.length})
                        </p>
                        <div className="space-y-2">
                          {admissaoCandidatos.map(c => (
                            <Card key={c.id}
                              className="border-l-4 border-l-amber-400 cursor-pointer transition-all hover:shadow-md hover:border-l-primary"
                              onClick={() => { setAdmDialog(c); setDataInicio(undefined); }}
                            >
                              <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-bold uppercase">{c.nome}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-muted-foreground">{c.funcao}</span>
                                    <span className="text-xs text-muted-foreground">•</span>
                                    <span className="text-xs text-muted-foreground uppercase">{c.setor}</span>
                                  </div>
                                </div>
                                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                                  DEFINIR DATA
                                </Badge>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {comDataInicio.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase text-green-700 mb-2 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Com data definida ({comDataInicio.length})
                        </p>
                        <div className="space-y-2">
                          {comDataInicio.map(c => (
                            <Card key={c.id} className="border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-950/20">
                              <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-bold uppercase">{c.nome}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-muted-foreground">{c.funcao}</span>
                                    <span className="text-xs text-muted-foreground">•</span>
                                    <span className="text-xs text-muted-foreground uppercase">{c.setor}</span>
                                  </div>
                                </div>
                                <Badge className="bg-green-600 text-white text-xs">
                                  <CalendarCheck className="h-3 w-3 mr-1" />
                                  {c.dataInicio ? format(new Date(c.dataInicio + "T12:00:00"), "dd/MM/yyyy") : "—"}
                                </Badge>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            )}
          </div>
        )}

        {/* Doc confirmation dialog */}
        <Dialog open={!!docDialog} onOpenChange={() => setDocDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary" /> Confirmar Documentação
              </DialogTitle>
            </DialogHeader>
            {docDialog && (
              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <p className="font-bold uppercase text-sm">{docDialog.nome}</p>
                  <p className="text-xs text-muted-foreground mt-1">{docDialog.funcao} • {docDialog.setor}</p>
                  <p className="text-xs text-muted-foreground">CPF: {docDialog.cpf}</p>
                </div>
                <p className="text-sm">A documentação deste candidato está completa e correta?</p>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDocDialog(null)}>Cancelar</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => docDialog && handleDocOk(docDialog)}>
                <FileCheck className="h-4 w-4 mr-1" /> DOCUMENTO OK
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Admissão date dialog */}
        <Dialog open={!!admDialog} onOpenChange={() => { setAdmDialog(null); setDataInicio(undefined); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-primary" /> Definir Data de Início
              </DialogTitle>
            </DialogHeader>
            {admDialog && (
              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <p className="font-bold uppercase text-sm">{admDialog.nome}</p>
                  <p className="text-xs text-muted-foreground mt-1">{admDialog.funcao} • {admDialog.setor}</p>
                  <p className="text-xs text-muted-foreground">CPF: {admDialog.cpf}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Data prevista para início:</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataInicio && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataInicio}
                        onSelect={setDataInicio}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setAdmDialog(null); setDataInicio(undefined); }}>Cancelar</Button>
              <Button disabled={!dataInicio} onClick={handleSetDataInicio}>
                <CalendarCheck className="h-4 w-4 mr-1" /> CONFIRMAR DATA
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reprovado motivo dialog */}
        <Dialog open={!!reprovadoDialog} onOpenChange={() => setReprovadoDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <XCircle className="h-5 w-5" /> Motivo da Reprovação
              </DialogTitle>
            </DialogHeader>
            {reprovadoDialog && (() => {
              // Parse individual decisions from observacoes
              const decisoesIndividuais: { profNome: string; decisao: string; motivo?: string }[] = [];
              if (reprovadoDialog.observacoes) {
                reprovadoDialog.observacoes.split('|')
                  .filter(p => p.startsWith('resultado:'))
                  .forEach(p => {
                    const parts = p.split(':');
                    const profNome = parts[1] || '';
                    const decisao = parts[2] || '';
                    const motivo = parts.slice(3).join(':') || undefined;
                    if (profNome && decisao) decisoesIndividuais.push({ profNome, decisao, motivo });
                  });
              }
              return (
                <div className="space-y-4">
                  <div className="rounded-lg border p-4">
                    <p className="font-bold uppercase text-sm">{reprovadoDialog.nome}</p>
                    <p className="text-xs text-muted-foreground mt-1">{reprovadoDialog.funcao} • {reprovadoDialog.setor}</p>
                    {reprovadoDialog.indicacao && <p className="text-xs text-blue-600 mt-1">Indicação: {formatIndicacao(reprovadoDialog.indicacao)}</p>}
                  </div>

                  {/* Individual decisions from Silvana, Michele, Sonia */}
                  {decisoesIndividuais.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase text-muted-foreground">Avaliação Individual:</p>
                      {decisoesIndividuais.map((d, i) => (
                        <div key={i} className={cn(
                          "rounded-lg border p-3",
                          d.decisao === "reprovado" ? "border-red-200 bg-red-50 dark:bg-red-950/20" : "border-green-200 bg-green-50 dark:bg-green-950/20"
                        )}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-bold uppercase">{d.profNome}</p>
                            <Badge className={cn("text-[9px]", d.decisao === "reprovado" ? "bg-red-600 text-white" : "bg-green-600 text-white")}>
                              {d.decisao === "reprovado" ? "✗ REPROVADO" : "✓ APROVADO"}
                            </Badge>
                          </div>
                          {d.motivo && <p className="text-xs text-muted-foreground">{d.motivo}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Final result */}
                  <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 p-4">
                    <p className="text-xs font-bold uppercase text-red-700 mb-2">Resultado Final:</p>
                    <p className="text-sm whitespace-pre-line">{reprovadoDialog.motivoReprovacao || "Motivo não informado"}</p>
                  </div>
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setReprovadoDialog(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
