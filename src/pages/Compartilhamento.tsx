import { useMemo, useState } from "react";
import { useCandidatos } from "@/hooks/useSupabaseData";
import * as db from "@/lib/supabaseData";
import type { Candidato } from "@/lib/supabaseData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/StatusBadge";
import CandidatoDialog from "@/components/CandidatoDialog";
import { Search, Share2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function Compartilhamento() {
  const { candidatos: allCandidatos, loading, refresh } = useCandidatos();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Candidato | null>(null);

  const candidatos = useMemo(
    () => allCandidatos.filter((c) => ["data_inicio_definida", "finalizado"].includes(c.status)),
    [allCandidatos]
  );

  const filtered = useMemo(
    () => candidatos.filter((c) => !search || c.nome.toLowerCase().includes(search.toLowerCase()) || c.cpf.includes(search)),
    [candidatos, search]
  );

  const finalizar = async (c: Candidato) => {
    await db.updateCandidatoStatus(c.id, "finalizado", "Sistema", "Compartilhado com Portaria e Seg. Trabalho");
    toast.success(`${c.nome} finalizado e compartilhado!`);
    refresh();
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Share2 className="h-5 w-5" /> Compartilhamento — Portaria e Segurança do Trabalho</CardTitle>
        </CardHeader>
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
                  <TableHead className="hidden sm:table-cell text-[10px] font-bold">DATA INÍCIO</TableHead>
                  <TableHead className="text-[10px] font-bold">STATUS</TableHead>
                  <TableHead className="text-right text-[10px] font-bold">AÇÃO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-[10px]">Nenhum candidato.</TableCell></TableRow>
                ) : filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c)}>
                    <TableCell className="font-medium text-[10px] py-2">
                      <div className="flex flex-col">
                        {c.nome}
                        <Badge variant="outline" className="text-[8px] h-4 w-fit px-1 bg-slate-50 text-slate-600 mt-1 uppercase font-semibold">{c.funcao}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[9px] py-2">{c.cpf}</TableCell>
                    <TableCell className="hidden sm:table-cell text-[10px] py-2">{formatDate(c.dataInicio)}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => finalizar(c)} disabled={c.status === "finalizado"}>
                        <CheckCircle className="mr-1 h-3.5 w-3.5" /> Finalizar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <CandidatoDialog candidato={selected} open={!!selected} onClose={() => setSelected(null)} onUpdated={() => { refresh(); setSelected(null); }} />
    </div>
  );
}
