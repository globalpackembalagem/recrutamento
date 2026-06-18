import { useMemo, useState, useEffect, useCallback } from "react";
import { useCandidatos } from "@/hooks/useSupabaseData";
import { supabase } from "@/lib/supabase";
import * as db from "@/lib/supabaseData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Users, UserCheck, UserX, Clock, Stethoscope, PlayCircle, CheckCircle2, Flag, UserCog, Upload } from "lucide-react";
import type { Candidato } from "@/lib/supabaseData";
import { statusLabels } from "@/lib/supabaseData";
import { getUsuariosAtendimento, getUsuarios, type Usuario } from "@/lib/usuarioData";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

function getAtendente(c: Candidato): string | null {
  const match = c.observacoes?.match(/atendente:([^|]+)/);
  return match ? match[1].trim() : null;
}

function getResultados(c: Candidato): { nome: string; decisao: string }[] {
  if (!c.observacoes) return [];
  return c.observacoes.split('|')
    .filter(p => p.startsWith('resultado:'))
    .map(p => {
      const parts = p.split(':');
      return { nome: parts[1] || '', decisao: parts[2] || '' };
    });
}

export default function Dashboard() {
  const { candidatos: allCandidatos, loading } = useCandidatos(true);
  const { usuarioReal, impersonar, isImpersonando, usuario } = useAuth();
  const isMaster = ["luciano", "sonia"].includes(usuarioReal?.login?.toLowerCase() || "");
  const isAdmin = usuarioReal?.perfil === "admin";
  const [allUsers, setAllUsers] = useState<Usuario[]>([]);
  const [atendentes, setAtendentes] = useState<{ nome: string; sala: string }[]>([]);

  useEffect(() => {
    getUsuariosAtendimento().then(users => {
      setAtendentes(users.filter(u => u.acessoAtendimento).map(u => ({ nome: u.nome, sala: u.sala || '' })));
    });
    if (isAdmin || isMaster) {
      getUsuarios().then(users => setAllUsers(users.filter(u => u.ativo)));
    }
  }, [isAdmin, isMaster]);

  // Filtrar apenas a integração atual (data de integração mais recente)
  const candidatos = useMemo(() => {
    if (!allCandidatos.length) return [];
    const datas = allCandidatos
      .map(c => c.dataIntegracao)
      .filter((d): d is string => !!d)
      .sort();
    const ultimaData = datas[datas.length - 1];
    if (!ultimaData) return allCandidatos;
    return allCandidatos.filter(c => c.dataIntegracao === ultimaData);
  }, [allCandidatos]);

  const stats = useMemo(() => {
    const s = { total: 0, presentes: 0, ausentes: 0, aguardando: 0, naFila: 0, emAtendimento: 0, atendidos: 0, finalizados: 0,
      presM: 0, presF: 0, fretados: {} as Record<string, number> };
    candidatos.forEach(c => {
      s.total++;
      const isPresente = c.status === "presente" || c.status === "na_fila_atendimento" || c.status === "em_atendimento" || c.status === "atendido" || ["finalizado", "aprovado", "reprovado", "doc_ok"].includes(c.status);
      if (c.status === "presente") s.presentes++;
      else if (c.status === "ausente") s.ausentes++;
      else if (c.status === "aguardando_presenca" || c.status === "aguardando_portaria") s.aguardando++;
      else if (c.status === "na_fila_atendimento") { s.naFila++; s.presentes++; }
      else if (c.status === "em_atendimento") { s.emAtendimento++; s.presentes++; }
      else if (c.status === "atendido") { s.atendidos++; s.presentes++; }
      else if (["finalizado", "aprovado", "reprovado", "doc_ok"].includes(c.status)) { s.finalizados++; s.presentes++; }
      if (isPresente) {
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

  // Per-attendant stats
  const atendenteStats = useMemo(() => {
    return atendentes.map(at => {
      let atendendo = 0;
      let atendidos = 0;
      candidatos.forEach(c => {
        if (c.status === "em_atendimento" && getAtendente(c)?.toLowerCase() === at.nome.toLowerCase()) {
          atendendo++;
        }
        const resultados = getResultados(c);
        if (resultados.some(r => r.nome.toLowerCase() === at.nome.toLowerCase())) {
          atendidos++;
        }
      });
      return { ...at, atendendo, atendidos };
    });
  }, [atendentes, candidatos]);

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground text-lg">Carregando...</div>;

  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  const otherCards = [
    { label: "Total Importados", value: stats.total, icon: Users, color: "text-primary" },
    { label: "Ausentes", value: stats.ausentes, icon: UserX, color: "text-destructive" },
    { label: "Aguardando", value: stats.aguardando, icon: Clock, color: "text-amber-500" },
    { label: "Na Fila", value: stats.naFila, icon: Stethoscope, color: "text-blue-500" },
    { label: "Em Atendimento", value: stats.emAtendimento, icon: PlayCircle, color: "text-purple-500" },
    { label: "Atendidos", value: stats.atendidos, icon: CheckCircle2, color: "text-teal-500" },
    { label: "Resultado", value: stats.finalizados, icon: Flag, color: "text-slate-600" },
  ];

  const fretadosSorted = Object.entries(stats.fretados)
    .sort((a, b) => b[1] - a[1]);
  const fretadosTop = fretadosSorted.slice(0, 5);
  const fretadosRest = fretadosSorted.length > 5 ? fretadosSorted.length - 5 : 0;

  const getStatusColor = (status: string) => {
    if (status === "em_atendimento") return "bg-purple-100 text-purple-800";
    if (status === "presente" || status === "na_fila_atendimento" || status === "atendido") return "bg-green-100 text-green-800";
    if (status === "ausente") return "bg-red-100 text-red-800";
    if (status === "aprovado") return "bg-emerald-100 text-emerald-800";
    if (status === "reprovado") return "bg-red-100 text-red-800";
    if (status === "finalizado" || status === "doc_ok") return "bg-slate-200 text-slate-800";
    return "bg-amber-100 text-amber-800";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground capitalize mt-1">{hoje}</p>
        </div>
        {(isAdmin || isMaster || (usuario?.login || "").toLowerCase() === "sonia") && (
          <Button size="sm" onClick={() => window.location.href = "/importacao"} className="gap-2">
            <Upload className="h-4 w-4" /> IR PARA IMPORTAÇÃO
          </Button>
        )}
      </div>

      {(isMaster || isAdmin) && allUsers.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <UserCog className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-xs font-bold text-amber-700 uppercase shrink-0">Testar como:</span>
              <Button 
                size="sm" 
                variant={!isImpersonando ? "default" : "outline"} 
                className={cn("h-7 text-[10px] font-bold", !isImpersonando && "bg-amber-600 hover:bg-amber-700")} 
                onClick={() => impersonar(null)}
              >
                {usuarioReal?.nome?.toUpperCase() || "EU"} (ORIGINAL)
              </Button>
              {allUsers
                .filter(u => u.login !== usuarioReal?.login)
                .sort((a, b) => a.nome.localeCompare(b.nome))
                .map(u => (
                <Button 
                  key={u.id} 
                  size="sm" 
                  variant={usuario?.login === u.login ? "default" : "outline"} 
                  className={cn("h-7 text-[10px]", usuario?.login === u.login && "bg-amber-600 hover:bg-amber-700")} 
                  onClick={() => impersonar(u)}
                >
                  {u.nome.toUpperCase()}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Presentes card */}
        <Card className="border-green-200 bg-green-50/30 dark:bg-green-950/10 col-span-2 md:col-span-1">
          <CardContent className="p-3 flex items-center gap-3">
            <UserCheck className="h-7 w-7 text-green-600" />
            <div>
              <p className="text-xl font-bold text-green-600">{stats.presentes}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Presentes</p>
            </div>
            {stats.presentes > 0 && (
              <div className="flex flex-col items-end gap-0.5 ml-auto">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[9px] font-bold px-1 py-0">♂ {stats.presM}</Badge>
                <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-200 text-[9px] font-bold px-1 py-0">♀ {stats.presF}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Other cards */}
        {otherCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-3 flex items-center gap-3">
              <Icon className={`h-7 w-7 ${color}`} />
              <div>
                <p className="text-xl font-bold">{value}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
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

      {/* Per-attendant stats */}
      {atendenteStats.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {atendenteStats.map(at => (
            <Card key={at.nome} className={cn("border-t-4", at.atendendo > 0 ? "border-t-purple-500" : "border-t-primary")}>
              <CardContent className="p-4">
                <p className="text-[11px] font-bold uppercase text-primary">{at.sala || at.nome}</p>
                <p className="text-[10px] text-muted-foreground mb-2">{at.nome}</p>
                <div className="flex items-center gap-3">
                  {at.atendendo > 0 && (
                    <div className="flex items-center gap-1">
                      <PlayCircle className="h-3.5 w-3.5 text-purple-500" />
                      <span className="text-sm font-bold text-purple-600">{at.atendendo}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-sm font-bold">{at.atendidos}</span>
                    <span className="text-[9px] text-muted-foreground">atendidos</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Candidate list with status and attendant */}
      {candidatos.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left text-xs font-bold p-3 md:p-4 uppercase">Nome</th>
                    <th className="text-left text-xs font-bold p-3 md:p-4 uppercase hidden md:table-cell">Função</th>
                    <th className="text-left text-xs font-bold p-3 md:p-4 uppercase hidden md:table-cell">Setor</th>
                     <th className="text-left text-xs font-bold p-3 md:p-4 uppercase">Status</th>
                   </tr>
                 </thead>
                 <tbody>
                   {candidatos.sort((a, b) => a.nome.localeCompare(b.nome)).map(c => (
                     <tr key={c.id} className="border-b hover:bg-muted/30">
                       <td className="p-3 md:p-4 text-sm font-semibold uppercase">{c.nome}</td>
                       <td className="p-3 md:p-4 text-sm text-muted-foreground hidden md:table-cell">{c.funcao}</td>
                       <td className="p-3 md:p-4 text-sm text-muted-foreground uppercase hidden md:table-cell">{c.setor}</td>
                       <td className="p-3 md:p-4">
                         <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${getStatusColor(c.status)}`}>
                           {c.status === "em_atendimento"
                             ? `EM ATENDIMENTO COM ${(getAtendente(c) || "—").toUpperCase()}`
                             : (statusLabels[c.status] || c.status.replace(/_/g, " ").toUpperCase())}
                         </span>
                       </td>
                     </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Atendidos por todos os atendentes */}
      {atendentes.length > 0 && (() => {
        const nomesAtendentes = atendentes.map(a => a.nome.toLowerCase());
        const completos = candidatos.filter(c => {
          const nomesFeitos = new Set(getResultados(c).map(r => r.nome.toLowerCase()));
          return nomesAtendentes.every(n => nomesFeitos.has(n));
        }).sort((a, b) => a.nome.localeCompare(b.nome));

        return (
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-bold uppercase">
                Atendidos por Todos ({completos.length}) — {atendentes.length} atendentes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {completos.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground">Nenhum candidato foi atendido por todos os atendentes ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left text-xs font-bold p-3 uppercase">Nome</th>
                        <th className="text-left text-xs font-bold p-3 uppercase">Fretado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completos.map(c => (
                        <tr key={c.id} className="border-b hover:bg-muted/30">
                          <td className="p-3 text-sm font-semibold uppercase">{c.nome}</td>
                          <td className="p-3 text-sm uppercase">{c.fretado || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
