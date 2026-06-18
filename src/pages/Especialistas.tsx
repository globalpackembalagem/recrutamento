import { useEffect, useMemo, useState } from "react";
import { getUsuarios, atualizarUsuario, type Usuario } from "@/lib/usuarioData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Users, Save, RefreshCw, DoorOpen, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { getCandidatos } from "@/lib/supabaseData";


const STORAGE_KEY = "especialistas_do_dia";

interface EspecialistaDoDia {
  nome: string;
  nomeOriginal: string;
  especialidade: string;
  sala: string;
  ativo: boolean;
  aprovar: boolean; // New: If this specialist can approve/reject
  painel: boolean;  // New: If they should appear in the integration panel
}

function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function loadDoDia(): { date: string; lista: EspecialistaDoDia[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.date !== getTodayKey()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDoDia(lista: EspecialistaDoDia[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: getTodayKey(), lista }));
  window.dispatchEvent(new CustomEvent("especialistas-do-dia-updated"));
}

export function getEspecialistasDoDia(): string[] | null {
  const saved = loadDoDia();
  if (!saved) return null;
  return saved.lista.filter(e => e.ativo).map(e => e.nome);
}

export function getEspecialistasDoDiaConfig(): EspecialistaDoDia[] | null {
  const saved = loadDoDia();
  if (!saved) return null;
  return saved.lista;
}

export function getEspecialistasComSala(): { nome: string; sala: string }[] | null {
  const saved = loadDoDia();
  if (!saved) return null;
  return saved.lista.filter(e => e.ativo).map(e => ({ nome: e.nome, sala: e.sala }));
}

export default function Especialistas() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [lista, setLista] = useState<EspecialistaDoDia[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const { usuario } = useAuth();
  const canSeeTempos = !!usuario && ["luciano", "mauricio", "sonia"].includes((usuario.login || "").toLowerCase());
  const [temposMedios, setTemposMedios] = useState<Record<string, { avg: number; count: number }>>({});
  const [pendentes, setPendentes] = useState(0);
  const [atendidosHoje, setAtendidosHoje] = useState(0);

  useEffect(() => {
    if (!canSeeTempos) return;
    getCandidatos(true).then(cands => {
      const acc: Record<string, { total: number; count: number }> = {};
      for (const c of cands) {
        const obs = c.observacoes || "";
        const inicios: Record<string, string> = {};
        const fins: Record<string, string> = {};
        obs.split("||").forEach(p => {
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
    });
  }, [canSeeTempos]);


  useEffect(() => {
    getUsuarios().then(allUsers => {
      const users = allUsers.filter(u => u.acessoAtendimento || u.especialidade || u.sala);
      setUsuarios(users);
      const existing = loadDoDia();
      if (existing) {
        const merged = users.map(u => {
          const found = existing.lista.find(e => e.nomeOriginal?.toLowerCase() === u.nome.toLowerCase() || e.nome.toLowerCase() === u.nome.toLowerCase());
          return {
            nome: found ? found.nome : u.nome,
            nomeOriginal: u.nome,
            especialidade: u.especialidade || "",
            sala: found ? found.sala : (u.sala || ""),
            ativo: found ? found.ativo : true,
            aprovar: found?.aprovar !== undefined ? found.aprovar : u.acessoAprovar,
            painel: found?.painel !== undefined ? found.painel : u.acessoAtendimento,
          };
        });
        setLista(merged);
      } else {
        setLista(users.map(u => ({
          nome: u.nome,
          nomeOriginal: u.nome,
          especialidade: u.especialidade || "",
          sala: u.sala || "",
          ativo: true,
          aprovar: u.acessoAprovar,
          painel: u.acessoAtendimento,
        })));
      }
      setLoading(false);
    });
  }, []);

  const toggleEspecialista = (nomeOriginal: string) => {
    setLista(prev => prev.map(e => e.nomeOriginal === nomeOriginal ? { ...e, ativo: !e.ativo } : e));
    setSaved(false);
  };

  const toggleAprovar = (nomeOriginal: string) => {
    setLista(prev => prev.map(e => e.nomeOriginal === nomeOriginal ? { ...e, aprovar: !e.aprovar } : e));
    setSaved(false);
  };

  const togglePainel = (nomeOriginal: string) => {
    setLista(prev => prev.map(e => e.nomeOriginal === nomeOriginal ? { ...e, painel: !e.painel } : e));
    setSaved(false);
  };

  const updateSala = (nomeOriginal: string, sala: string) => {
    setLista(prev => prev.map(e => e.nomeOriginal === nomeOriginal ? { ...e, sala } : e));
    setSaved(false);
  };

  const updateNome = (nomeOriginal: string, nome: string) => {
    setLista(prev => prev.map(e => e.nomeOriginal === nomeOriginal ? { ...e, nome } : e));
    setSaved(false);
  };

  const handleSalvar = async () => {
    saveDoDia(lista);
    // Sync nome + sala to database for each specialist so Atendimento and Painel reflect changes
    for (const e of lista) {
      const user = usuarios.find(u => u.nome.toLowerCase() === e.nomeOriginal.toLowerCase());
      if (!user) continue;
      const updates: { nome?: string; sala?: string; acesso_aprovar?: boolean; acesso_atendimento?: boolean } = {};
      if (e.nome.trim() && e.nome.trim() !== user.nome) updates.nome = e.nome.trim();
      if (e.sala !== user.sala) updates.sala = e.sala;
      if (e.aprovar !== user.acessoAprovar) updates.acesso_aprovar = e.aprovar;
      if (e.painel !== user.acessoAtendimento) updates.acesso_atendimento = e.painel;
      
      if (Object.keys(updates).length > 0) {
        await atualizarUsuario(user.id, updates as any);
      }
    }
    // Notify other tabs/components to refresh user list
    window.dispatchEvent(new CustomEvent("usuarios-updated"));
    setSaved(true);
    toast.success("Especialistas do dia salvos! Atendimento e Painel atualizados.");
  };

  const handleReset = () => {
    setLista(prev => prev.map(e => ({ ...e, ativo: true })));
    setSaved(false);
  };

  const ativos = lista.filter(e => e.ativo).length;

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-tight flex items-center gap-3">
            <Users className="h-7 w-7 text-primary" /> Especialistas do Dia
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure especialistas e salas para hoje — {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleReset}>
            <RefreshCw className="h-4 w-4" /> Resetar
          </Button>
          <Button className="gap-2 font-bold" onClick={handleSalvar}>
            <Save className="h-4 w-4" /> Salvar ({ativos} ativos)
          </Button>
        </div>
      </div>

      {saved && (
        <div className="rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/20 p-3 text-sm text-green-700 dark:text-green-400 font-semibold">
          ✓ Configuração salva para hoje. Os especialistas e salas aparecerão no Atendimento.
        </div>
      )}

      {canSeeTempos && (() => {
        const ativosList = lista.filter(l => l.ativo && l.painel);
        const avgs = ativosList
          .map(l => (temposMedios[l.nome.toLowerCase()] || temposMedios[l.nomeOriginal.toLowerCase()])?.avg)
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
        // estimativa: pendentes * avg / nº especialistas ativos
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



      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map(e => (
          <Card key={e.nomeOriginal} className={cn(
            "transition-all",
            e.ativo ? "border-primary/30 bg-card" : "opacity-50 border-dashed"
          )}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Switch 
                  checked={e.ativo} 
                  onCheckedChange={() => toggleEspecialista(e.nomeOriginal)} 
                  title="Ativo hoje?"
                />
                <div className="flex-1 min-w-0">
                  <Input
                    value={e.nome}
                    onChange={(ev) => updateNome(e.nomeOriginal, ev.target.value)}
                    className="h-7 text-sm font-bold uppercase"
                    disabled={!e.ativo}
                  />
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {e.especialidade || "Geral"} {e.nome !== e.nomeOriginal && <span className="text-amber-500">(orig: {e.nomeOriginal})</span>}
                  </p>
                </div>
                <Badge variant={e.ativo ? "default" : "outline"} className="text-[10px] shrink-0">
                  {e.ativo ? "ATIVO" : "INATIVO"}
                </Badge>
              </div>

              {canSeeTempos && (() => {
                const t = temposMedios[(e.nome || "").toLowerCase()] || temposMedios[(e.nomeOriginal || "").toLowerCase()];
                if (!t) return (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground border border-dashed rounded-md p-2">
                    <Clock className="h-3 w-3" /> Sem dados de tempo médio
                  </div>
                );
                return (
                  <div className="flex items-center justify-between p-2 rounded-md bg-primary/5 border border-primary/20">
                    <span className="text-[10px] font-semibold uppercase flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Tempo médio
                    </span>
                    <span className="text-xs font-bold font-mono">
                      {t.avg.toFixed(1)} min <span className="text-[9px] text-muted-foreground">({t.count})</span>
                    </span>
                  </div>
                );
              })()}


              <div className="grid grid-cols-2 gap-2 py-1">
                <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-muted/50">
                  <span className="text-[10px] font-semibold uppercase">Pode Aprovar</span>
                  <Switch 
                    checked={e.aprovar} 
                    onCheckedChange={() => toggleAprovar(e.nomeOriginal)}
                    disabled={!e.ativo}
                    size="sm"
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-muted/50">
                  <span className="text-[10px] font-semibold uppercase">No Painel</span>
                  <Switch 
                    checked={e.painel} 
                    onCheckedChange={() => togglePainel(e.nomeOriginal)}
                    disabled={!e.ativo}
                    size="sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <DoorOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  value={e.sala}
                  onChange={(ev) => updateSala(e.nomeOriginal, ev.target.value)}
                  placeholder="Ex: Sala Médico, Sala 1..."
                  className="h-8 text-xs"
                  disabled={!e.ativo}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}