import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/StatusBadge";
import * as db from "@/lib/supabaseData";
import { statusLabels, type Candidato, type StatusEtapa, type HistoricoEntry } from "@/lib/supabaseData";
import { Pencil, History, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatIndicacao } from "@/lib/utils";
import type { Setor } from "@/lib/supabaseData";

interface Props {
  candidato: Candidato | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  portariaView?: "integracao" | "admissao";
}

export default function CandidatoDialog({ candidato, open, onClose, onUpdated, portariaView }: Props) {
  const location = useLocation();
  const isRH = location.pathname.includes("/rh");
  const isPortaria = location.pathname === "/portaria";
  const [tab, setTab] = useState("info");
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Candidato>>({});
  const [novoStatus, setNovoStatus] = useState<StatusEtapa | "">("");
  const [observacao, setObservacao] = useState("");
  const [historico, setHistorico] = useState<HistoricoEntry[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);

  useEffect(() => {
    if (candidato && open) {
      db.getHistorico(candidato.id).then(setHistorico);
      db.getSetores().then(setSetores);
    }
  }, [candidato, open]);

  if (!candidato) return null;

  const handleSaveEdit = async () => {
    const finalSetor = editData.setor ?? candidato.setor;
    if (!finalSetor || finalSetor.trim() === "" || finalSetor === "Não informado") {
      toast.error("O campo 'Setor' é obrigatório.");
      return;
    }
    await db.updateCandidato(candidato.id, editData);
    toast.success("Dados salvos com sucesso!");
    setEditing(false);
    setEditData({});
    onUpdated();
  };

  const handleChangeStatus = async () => {
    if (!novoStatus || !observacao.trim()) {
      toast.error("Preencha o novo status e a observação.");
      return;
    }
    await db.updateCandidatoStatus(candidato.id, novoStatus as StatusEtapa, "Usuário Atual", observacao);
    toast.success("Status alterado com sucesso!");
    setNovoStatus("");
    setObservacao("");
    onUpdated();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {candidato.nome}
            <StatusBadge status={candidato.status} />
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="info" className="flex-1 gap-1.5"><Pencil className="h-3.5 w-3.5" /> Dados</TabsTrigger>
            {!isPortaria && (
              <TabsTrigger value="status" className="flex-1 gap-1.5"><ArrowRightLeft className="h-3.5 w-3.5" /> Alterar Status</TabsTrigger>
            )}
            <TabsTrigger value="historico" className="flex-1 gap-1.5"><History className="h-3.5 w-3.5" /> Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome</Label>
                {editing ? (
                  <Input value={editData.nome ?? candidato.nome} onChange={(e) => setEditData({ ...editData, nome: e.target.value })} />
                ) : (
                  <p className="text-sm text-muted-foreground">{candidato.nome}</p>
                )}
              </div>
              
              {(!portariaView || portariaView === "admissao") && (
                <div>
                  <Label>Função</Label>
                  {editing ? (
                    <Input value={editData.funcao ?? candidato.funcao} onChange={(e) => setEditData({ ...editData, funcao: e.target.value })} />
                  ) : (
                    <p className="text-sm text-muted-foreground">{candidato.funcao}</p>
                  )}
                </div>
              )}

              {portariaView === "integracao" && (
                <>
                  <div><Label>Função</Label><p className="text-sm text-muted-foreground">{candidato.funcao}</p></div>
                  <div><Label>Data Integração</Label><p className="text-sm text-muted-foreground">{formatDate(candidato.dataIntegracao)}</p></div>
                </>
              )}

              {(isRH || (isPortaria && !portariaView)) && (
                <div><Label>CPF</Label><p className="font-mono text-sm text-muted-foreground">{candidato.cpf}</p></div>
              )}

              {(!portariaView || portariaView === "admissao") && (
                <div>
                  <Label>Setor</Label>
                  {editing ? (
                    <Select value={editData.setor ?? candidato.setor} onValueChange={(v) => setEditData({ ...editData, setor: v })}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {setores.map((s) => <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-muted-foreground">{candidato.setor}</p>
                  )}
                </div>
              )}

              {portariaView === "admissao" && (
                <div>
                  <Label>Status de Presença</Label>
                  <p className="text-sm font-medium">
                    {candidato.status === "presente" ? <span className="text-green-600">PRESENTE</span> : <span className="text-slate-500">AGUARDANDO</span>}
                  </p>
                </div>
              )}

              {!portariaView && (
                <>
                  <div>
                    <Label>E-mail</Label>
                    {editing ? <Input value={editData.email ?? candidato.email ?? ""} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
                     : <p className="text-sm text-muted-foreground">{candidato.email || "-"}</p>}
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    {editing ? <Input value={editData.telefone ?? candidato.telefone ?? ""} onChange={(e) => setEditData({ ...editData, telefone: e.target.value })} />
                     : <p className="text-sm text-muted-foreground">{candidato.telefone || "-"}</p>}
                  </div>
                  <div>
                    <Label>Data Nascimento</Label>
                    {editing ? <Input type="date" value={editData.dataNascimento ?? candidato.dataNascimento ?? ""} onChange={(e) => setEditData({ ...editData, dataNascimento: e.target.value })} />
                     : <p className="text-sm text-muted-foreground">{formatDate(candidato.dataNascimento)}</p>}
                  </div>
                  <div>
                    <Label>Sexo</Label>
                    {editing ? <Input value={editData.sexo ?? candidato.sexo ?? ""} onChange={(e) => setEditData({ ...editData, sexo: e.target.value })} />
                     : <p className="text-sm text-muted-foreground">{candidato.sexo || "-"}</p>}
                  </div>
                  <div>
                    <Label>Indicação</Label>
                    {editing ? <Input value={editData.indicacao ?? candidato.indicacao ?? ""} onChange={(e) => setEditData({ ...editData, indicacao: e.target.value })} />
                     : <p className="text-sm text-muted-foreground">{formatIndicacao(candidato.indicacao) || "-"}</p>}
                  </div>
                  <div>
                    <Label>Fretado</Label>
                    {editing ? <Input value={editData.fretado ?? candidato.fretado ?? ""} onChange={(e) => setEditData({ ...editData, fretado: e.target.value })} />
                     : <p className="text-sm text-muted-foreground">{candidato.fretado || "-"}</p>}
                  </div>
                  <div className="col-span-2">
                    <Label>Ponto de Referência</Label>
                    {editing ? <Input value={editData.pontoReferencia ?? candidato.pontoReferencia ?? ""} onChange={(e) => setEditData({ ...editData, pontoReferencia: e.target.value })} />
                     : <p className="text-sm text-muted-foreground">{candidato.pontoReferencia || "-"}</p>}
                  </div>
                  <div>
                    <Label>Camisa</Label>
                    {editing ? <Input value={editData.camisa ?? candidato.camisa ?? ""} onChange={(e) => setEditData({ ...editData, camisa: e.target.value })} />
                     : <p className="text-sm text-muted-foreground">{candidato.camisa || "-"}</p>}
                  </div>
                  <div>
                    <Label>Calça</Label>
                    {editing ? <Input value={editData.calca ?? candidato.calca ?? ""} onChange={(e) => setEditData({ ...editData, calca: e.target.value })} />
                     : <p className="text-sm text-muted-foreground">{candidato.calca || "-"}</p>}
                  </div>
                  <div>
                    <Label>Sapato</Label>
                    {editing ? <Input value={editData.sapato ?? candidato.sapato ?? ""} onChange={(e) => setEditData({ ...editData, sapato: e.target.value })} />
                     : <p className="text-sm text-muted-foreground">{candidato.sapato || "-"}</p>}
                  </div>
                  <div>
                    <Label>Óculos</Label>
                    {editing ? <Input value={editData.oculos ?? candidato.oculos ?? ""} onChange={(e) => setEditData({ ...editData, oculos: e.target.value })} />
                     : <p className="text-sm text-muted-foreground">{candidato.oculos || "-"}</p>}
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              {editing ? (
                <>
                  <Button onClick={handleSaveEdit}>Salvar</Button>
                  <Button variant="outline" onClick={() => { setEditing(false); setEditData({}); }}>Cancelar</Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="mr-2 h-4 w-4" /> Editar</Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="status" className="space-y-4 pt-4">
            <div><Label>Status atual</Label><div className="mt-1"><StatusBadge status={candidato.status} /></div></div>
            <div>
              <Label>Novo status</Label>
              <Select value={novoStatus} onValueChange={(v) => setNovoStatus(v as StatusEtapa)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observação (obrigatória)</Label>
              <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Motivo da alteração..." />
            </div>
            <Button onClick={handleChangeStatus}>Confirmar Alteração</Button>
          </TabsContent>

          <TabsContent value="historico" className="pt-4">
            {historico.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum registro de histórico.</p>
            ) : (
              <div className="space-y-3">
                {historico.map((h) => (
                  <div key={h.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{h.usuario}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(h.data)} às {h.hora}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <StatusBadge status={h.statusAnterior} /><span>→</span><StatusBadge status={h.novoStatus} />
                    </div>
                    {isRH && h.observacao && <p className="mt-2 text-xs text-muted-foreground">{h.observacao}</p>}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
