import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useCandidatos } from "@/hooks/useSupabaseData";
import * as db from "@/lib/supabaseData";
import type { Candidato } from "@/lib/supabaseData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import StatusBadge from "@/components/StatusBadge";
import CandidatoDialog from "@/components/CandidatoDialog";
import { Search, CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

export default function DataInicio() {
  const { candidatos: allCandidatos, loading, refresh } = useCandidatos();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Candidato | null>(null);
  const [definindo, setDefinindo] = useState<Candidato | null>(null);
  const [data, setData] = useState("");

  const candidatos = useMemo(
    () => allCandidatos.filter((c) => ["documentacao_ok", "data_inicio_definida"].includes(c.status)),
    [allCandidatos]
  );

  const filtered = useMemo(
    () => candidatos.filter((c) => !search || c.nome.toLowerCase().includes(search.toLowerCase()) || c.cpf.includes(search)),
    [candidatos, search]
  );

  const confirmar = async () => {
    if (!definindo || !data) { toast.error("Selecione a data de início."); return; }
    await db.updateCandidato(definindo.id, { dataInicio: data });
    await db.updateCandidatoStatus(definindo.id, "data_inicio_definida", "RH", `Data de início: ${data}`);
    toast.success(`${definindo.nome} — data de início definida!`);
    setDefinindo(null);
    setData("");
    refresh();
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Definição de Data de Início</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] font-bold">NOME / FUNÇÃO</TableHead>
                  <TableHead className="text-[10px] font-bold">CPF</TableHead>
                  <TableHead className="text-[10px] font-bold">STATUS</TableHead>
                  <TableHead className="hidden sm:table-cell text-[10px] font-bold">DATA INÍCIO</TableHead>
                  <TableHead className="text-right text-[10px] font-bold">AÇÃO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-[10px]">Nenhum candidato pronto.</TableCell></TableRow>
                ) : filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c)}>
                    <TableCell className="font-medium text-[10px] py-2">
                      <div className="flex flex-col">
                        {c.nome}
                        <Badge variant="outline" className="text-[8px] h-4 w-fit px-1 bg-slate-50 text-slate-600 mt-1 uppercase font-semibold">{c.funcao}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[9px] py-2">{c.cpf}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell className="hidden sm:table-cell text-[10px]">{formatDate(c.dataInicio)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => setDefinindo(c)} disabled={c.status === "data_inicio_definida"}>
                        <CalendarCheck className="mr-1 h-3.5 w-3.5" /> Definir Data
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!definindo} onOpenChange={(v) => !v && setDefinindo(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Definir data de início — {definindo?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Data de início</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div className="flex gap-2">
              <Button onClick={confirmar}>Confirmar</Button>
              <Button variant="outline" onClick={() => { setDefinindo(null); setData(""); }}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CandidatoDialog candidato={selected} open={!!selected} onClose={() => setSelected(null)} onUpdated={() => { refresh(); setSelected(null); }} />
    </div>
  );
}
