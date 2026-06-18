import { useEffect, useMemo, useState } from "react";
import { useCandidatosDoDia } from "@/hooks/useSupabaseData";
import { autenticar, type Usuario } from "@/lib/usuarioData";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CheckCircle2, XCircle, Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { Candidato } from "@/lib/supabaseData";
import { cn } from "@/lib/utils";

interface Resultado {
  nome: string;
  decisao: string;
  motivo?: string;
}

function getResultados(c: Candidato): Resultado[] {
  if (!c.observacoes) return [];
  return c.observacoes.split("|")
    .filter(p => p.startsWith("resultado:"))
    .map(p => {
      const parts = p.split(":");
      return {
        nome: parts[1] || "",
        decisao: parts[2] || "",
        motivo: parts.slice(3).join(":") || undefined,
      };
    });
}

function buildObservacoes(c: Candidato, novosResultados: Resultado[]): string {
  const others = (c.observacoes || "").split("|").filter(p => !p.startsWith("resultado:"));
  const resParts = novosResultados.map(r => {
    let s = `resultado:${r.nome}:${r.decisao}`;
    if (r.motivo) s += `:${r.motivo}`;
    return s;
  });
  return [...resParts, ...others].filter(Boolean).join("|");
}

export default function RevisarReprovados() {
  const { candidatos, refresh } = useCandidatosDoDia();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [motivoDialog, setMotivoDialog] = useState<Candidato | null>(null);
  const [motivoNovo, setMotivoNovo] = useState("");

  const paraRevisar = useMemo(() => {
    return candidatos
      .filter(c => {
        const resultados = getResultados(c);
        const temReprovacao = resultados.some(r => r.decisao === "reprovado");
        const temPreAprovado = resultados.some(r => r.decisao === "pre_aprovado");

        if (!temReprovacao && !temPreAprovado) return false;

        if (usuario) {
          const jaRevisou = resultados.some(r =>
            ["mauricio", "sonia", "luciano"].includes(r.nome.toLowerCase()) &&
            r.nome.toLowerCase() === usuario.nome.toLowerCase()
          );
          if (jaRevisou) return false;
        }

        return true;
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [candidatos, usuario]);

  // Auto-login via ?user= (link curto sem expor senha)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userParam = params.get("user");
    if (userParam && !usuario) {
      setLogin(userParam);
    }
  }, [usuario]);

  const handleLogin = async () => {
    if (!login.trim() || !senha.trim()) {
      toast.error("Informe usuário e senha.");
      return;
    }
    setLoading(true);
    const u = await autenticar(login.trim(), senha.trim());
    setLoading(false);
    if (!u) {
      toast.error("Usuário ou senha inválidos.");
      return;
    }
    const allowed = u.perfil === "admin" || ["mauricio", "sonia", "luciano"].includes(u.login.toLowerCase());
    if (!allowed) {
      toast.error("Acesso restrito a Maurício, Sônia ou Luciano.");
      return;
    }
    setUsuario(u);
    toast.success(`Bem-vindo(a), ${u.nome}!`);
  };

  const aplicarDecisao = async (c: Candidato, decisao: "aprovado" | "reprovado", motivo?: string) => {
    if (!usuario) return;
    if (decisao === "reprovado" && !motivo?.trim()) {
      toast.error("Informe o motivo da reprovação.");
      return;
    }

    const resultados = getResultados(c).filter(r => r.nome.toLowerCase() !== usuario.nome.toLowerCase());
    resultados.push({
      nome: usuario.nome,
      decisao,
      motivo: motivo?.trim() || undefined,
    });

    const newObs = buildObservacoes(c, resultados);
    const novoStatus = decisao;

    const { error } = await supabase.from("candidatos").update({
      observacoes: newObs,
      status: novoStatus,
      ...(decisao === "reprovado" ? { motivo_reprovacao: `${usuario.nome}: ${motivo!.trim()}` } : {}),
    }).eq("id", c.id);

    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }

    supabase.from("historico").insert({
      candidato_id: c.id,
      usuario: usuario.login,
      data: new Date().toISOString().split("T")[0],
      hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      status_anterior: c.status,
      novo_status: novoStatus,
      observacao: `Revisado por ${usuario.nome}: ${decisao === "aprovado" ? "APROVADO" : `REPROVADO — ${motivo}`}`,
    });

    toast.success(`${c.nome} — ${decisao === "aprovado" ? "APROVADO" : "REPROVADO"}`);
    setMotivoDialog(null);
    setMotivoNovo("");
    refresh();
  };

  const hoje = new Date().toLocaleDateString("pt-BR");

  if (!usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" /> Revisão de Reprovados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Acesso restrito. Informe seu usuário e senha para revisar os candidatos reprovados de hoje ({hoje}).
            </p>
            <div className="space-y-2">
              <Label>Usuário</Label>
              <Input value={login} onChange={e => setLogin(e.target.value)} placeholder="Ex: mauricio" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input type="password" value={senha} onChange={e => setSenha(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()} />
            </div>
            <Button className="w-full" onClick={handleLogin} disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-muted/30 p-4">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" /> Candidatos para Revisão — {hoje}
              </h1>
              <p className="text-sm text-muted-foreground">
                Logado como: <strong>{usuario.nome}</strong> • Reprovados e Pré-Aprovados aguardando decisão.
              </p>
            </div>
            <Button variant="outline" onClick={() => { setUsuario(null); setSenha(""); }}>Sair</Button>
          </div>

          <Dialog open={!!motivoDialog} onOpenChange={open => { if (!open) { setMotivoDialog(null); setMotivoNovo(""); } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Decisão — {motivoDialog?.nome}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Informe o motivo:</p>
                <Textarea value={motivoNovo} onChange={e => setMotivoNovo(e.target.value)} className="min-h-[100px]" />
                <div className="flex gap-2">
                  <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => motivoDialog && aplicarDecisao(motivoDialog, "aprovado", motivoNovo)}>
                    Confirmar Aprovação
                  </Button>
                  <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => motivoDialog && aplicarDecisao(motivoDialog, "reprovado", motivoNovo)}>
                    Confirmar Reprovação
                  </Button>
                  <Button variant="outline" onClick={() => { setMotivoDialog(null); setMotivoNovo(""); }}>Cancelar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {paraRevisar.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhum candidato para revisar hoje.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {paraRevisar.map(c => {
                const resultados = getResultados(c);
                const reprovacoes = resultados.filter(r => r.decisao === "reprovado");
                const preAprovacoes = resultados.filter(r => r.decisao === "pre_aprovado");
                const isPreAprovado = preAprovacoes.length > 0 && reprovacoes.length === 0;
                return (
                  <Card key={c.id} className={cn("border-l-4", isPreAprovado ? "border-l-amber-500" : "border-l-red-500")}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start gap-3 flex-wrap">
                        <div>
                          <p className="font-bold uppercase">{c.nome}</p>
                          <p className="text-xs text-muted-foreground">{c.setor} • {c.funcao}</p>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {isPreAprovado && <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">PRÉ-APROVADO</Badge>}
                            {reprovacoes.length > 0 && <Badge variant="destructive" className="text-[10px]">REPROVADO</Badge>}
                            {c.fretado && <Badge variant="outline" className="text-[10px]">🚌 {c.fretado}</Badge>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => {
                              const motivos = [...reprovacoes, ...preAprovacoes].map(r => `${r.nome}: ${r.motivo || "—"}`).join("; ");
                              setMotivoNovo(motivos);
                              setMotivoDialog(c);
                            }}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50"
                            onClick={() => {
                              // Mauricio precisa digitar o próprio motivo — não copiar dos especialistas
                              setMotivoNovo("");
                              setMotivoDialog(c);
                            }}>
                            <XCircle className="h-4 w-4 mr-1" /> Reprovar
                          </Button>
                        </div>
                      </div>
                      {(reprovacoes.length > 0 || preAprovacoes.length > 0) && (
                        <div className="border-t pt-2 space-y-2">
                          {reprovacoes.length > 0 && (
                            <>
                              <p className="text-xs font-semibold flex items-center gap-1 text-red-700 bg-red-50 p-1 rounded w-fit">
                                <AlertTriangle className="h-3 w-3" /> REPROVAÇÕES:
                              </p>
                              <div className="grid gap-2">
                                {reprovacoes.map((r, i) => (
                                  <div key={i} className="text-xs border border-red-100 rounded p-2 bg-white shadow-sm">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant="destructive" className="text-[10px] h-5">REPROVOU</Badge>
                                      <span className="font-bold text-red-900 uppercase">{r.nome}</span>
                                    </div>
                                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap pl-1 border-l-2 border-red-200">
                                      {r.motivo || "Motivo não especificado"}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                          {preAprovacoes.length > 0 && (
                            <>
                              <p className="text-xs font-semibold flex items-center gap-1 text-amber-700 bg-amber-50 p-1 rounded w-fit">
                                <AlertTriangle className="h-3 w-3" /> PRÉ-APROVAÇÕES:
                              </p>
                              <div className="grid gap-2">
                                {preAprovacoes.map((r, i) => (
                                  <div key={i} className="text-xs border border-amber-100 rounded p-2 bg-white shadow-sm">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge className="text-[10px] h-5 bg-amber-200 text-amber-900">PRÉ-APROVOU</Badge>
                                      <span className="font-bold text-amber-900 uppercase">{r.nome}</span>
                                    </div>
                                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap pl-1 border-l-2 border-amber-200">
                                      {r.motivo || "Sem observação"}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
