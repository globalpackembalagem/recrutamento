import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useCandidatos } from "@/hooks/useSupabaseData";
import * as db from "@/lib/supabaseData";
import type { Candidato } from "@/lib/supabaseData";
import EntrevistaDesligamento from "@/pages/EntrevistaDesligamento";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import StatusBadge from "@/components/StatusBadge";
import CandidatoDialog from "@/components/CandidatoDialog";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default function Analise() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "integracao";
  const { candidatos: allCandidatos, loading, refresh } = useCandidatos();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Candidato | null>(null);
  const [reprovando, setReprovando] = useState<Candidato | null>(null);
  const [motivo, setMotivo] = useState("");

  const candidatos = useMemo(
    () => allCandidatos.filter((c) => ["presente", "em_analise", "reprovado", "aprovado"].includes(c.status)),
    [allCandidatos]
  );

  const filtered = useMemo(
    () => candidatos.filter((c) => !search || c.nome.toLowerCase().includes(search.toLowerCase()) || c.cpf.includes(search)),
    [candidatos, search]
  );

  if (view === "entrevista") return <EntrevistaDesligamento />;

  const aprovar = async (c: Candidato) => {
    await db.updateCandidatoStatus(c.id, "aprovado", "Análise", "Candidato aprovado na análise");
    toast.success(`${c.nome} aprovado!`);
    refresh();
  };

  const confirmarReprovacao = async () => {
    if (!reprovando || !motivo.trim()) { toast.error("Informe o motivo da reprovação."); return; }
    await db.updateCandidatoStatus(reprovando.id, "reprovado", "Análise", motivo);
    toast.success(`${reprovando.nome} reprovado.`);
    setReprovando(null);
    setMotivo("");
    refresh();
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Análise de Integração</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
            </div>
            {filtered.length > 0 && filtered.every(c => c.dataIntegracao === filtered[0].dataIntegracao) && filtered[0].dataIntegracao && (
              <Badge variant="secondary" className="bg-blue-600 text-white hover:bg-blue-700">
                DATA DE INTEGRAÇÃO: {formatDate(filtered[0].dataIntegracao)}
              </Badge>
            )}
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] font-bold">NOME / FUNÇÃO</TableHead>
                  <TableHead className="text-[10px] font-bold">SETOR</TableHead>
                  <TableHead className="text-[10px] font-bold">DATA INTEGRAÇÃO</TableHead>
                  <TableHead>STATUS</TableHead>
                  <TableHead className="text-right">AÇÕES</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum candidato para análise.</TableCell></TableRow>
                ) : filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c)}>
                    <TableCell className="font-medium text-[10px] py-2">
                      <div className="flex flex-col">
                        {c.nome}
                        <Badge variant="outline" className="text-[8px] h-4 w-fit px-1 bg-slate-50 text-slate-600 mt-1 uppercase font-semibold">{c.funcao}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-[10px] py-2">{c.setor}</TableCell>
                    <TableCell className="text-[10px] py-2">{formatDate(c.dataIntegracao)}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        {c.status === "reprovado" ? (
                          <Button size="sm" variant="outline" className="h-8 border-slate-600 text-slate-600 hover:bg-slate-50"
                            onClick={async () => { await db.updateCandidatoStatus(c.id, "presente", "Análise", "Retornado para análise após reprovação"); toast.info(`${c.nome} voltou para análise.`); refresh(); }}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Reverter Reprovação
                          </Button>
                        ) : c.status === "aprovado" ? (
                          <Button size="sm" variant="outline" className="h-8 border-slate-600 text-slate-600 hover:bg-slate-50"
                            onClick={async () => { await db.updateCandidatoStatus(c.id, "presente", "Análise", "Retornado para análise após aprovação"); toast.info(`${c.nome} voltou para análise.`); refresh(); }}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Reverter Aprovação
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" className="h-8 border-green-600 text-green-600 hover:bg-green-50" onClick={() => aprovar(c)}>
                              <CheckCircle className="h-4 w-4 mr-1" /> Aprovar
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 border-red-600 text-red-600 hover:bg-red-50" onClick={() => setReprovando(c)}>
                              <XCircle className="h-4 w-4 mr-1" /> Reprovar
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!reprovando} onOpenChange={(v) => !v && setReprovando(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reprovar {reprovando?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Motivo da reprovação (obrigatório)</Label>
              <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Descreva o motivo..." />
            </div>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={confirmarReprovacao}>Confirmar Reprovação</Button>
              <Button variant="outline" onClick={() => { setReprovando(null); setMotivo(""); }}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CandidatoDialog candidato={selected} open={!!selected} onClose={() => setSelected(null)} onUpdated={() => { refresh(); setSelected(null); }} />
    </div>
  );
}
