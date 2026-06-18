import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as db from "@/lib/supabaseData";
import type { Setor } from "@/lib/supabaseData";
import { buildIndicacao, type Origem } from "@/lib/utils";
import { toast } from "sonner";
import { UserPlus, Plus } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddCandidatoDialog({ open, onClose, onAdded }: Props) {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [saving, setSaving] = useState(false);
  const [novoSetor, setNovoSetor] = useState(false);
  const [form, setForm] = useState({
    nome: "", cpf: "", funcao: "", setor: "", turno: "Manhã",
    telefone: "", sexo: "", origem: "" as Origem | "", indicacao: "",
  });

  useEffect(() => {
    if (open) {
      db.getSetores().then(setSetores);
      setForm({ nome: "", cpf: "", funcao: "", setor: "", turno: "Manhã", telefone: "", sexo: "", origem: "", indicacao: "" });
      setNovoSetor(false);
    }
  }, [open]);

  const upd = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    const setorTrim = form.setor.trim().toUpperCase();
    if (!form.nome.trim()) { toast.error("Nome é obrigatório."); return; }
    if (!setorTrim) { toast.error("Setor é obrigatório."); return; }
    if (setorTrim.length > 60) { toast.error("Setor muito longo (máx. 60)."); return; }
    if (form.nome.length > 120) { toast.error("Nome muito longo (máx. 120)."); return; }
    setSaving(true);
    try {
      const exists = setores.some((s) => s.nome.toUpperCase() === setorTrim);
      if (!exists) await db.addSetor(setorTrim);
      const novo = await db.addCandidato({
        nome: form.nome.toUpperCase().trim(),
        cpf: form.cpf.trim(),
        funcao: form.funcao.toUpperCase().trim(),
        setor: setorTrim,
        turno: form.turno,
        telefone: form.telefone.trim(),
        sexo: form.sexo,
        indicacao: buildIndicacao((form.origem || null) as Origem, form.indicacao),
        status: "aguardando_presenca",
        dataImportacao: new Date().toISOString().split("T")[0],
        dataIntegracao: new Date().toISOString().split("T")[0],
      } as any);
      if (!novo) { toast.error("Erro ao adicionar candidato."); return; }
      toast.success(`${novo.nome} adicionado${!exists ? ` (novo setor "${setorTrim}" criado)` : ""}.`);
      onAdded();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" /> Adicionar Candidato Manualmente
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-2">
            <Label className="text-xs">Nome Completo *</Label>
            <Input value={form.nome} onChange={(e) => upd("nome", e.target.value)} className="uppercase" />
          </div>
          <div>
            <Label className="text-xs">CPF</Label>
            <Input value={form.cpf} onChange={(e) => upd("cpf", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Telefone</Label>
            <Input value={form.telefone} onChange={(e) => upd("telefone", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Função</Label>
            <Input value={form.funcao} onChange={(e) => upd("funcao", e.target.value)} className="uppercase" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Setor *</Label>
              <button
                type="button"
                onClick={() => { setNovoSetor((v) => !v); upd("setor", ""); }}
                className="text-[10px] text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                {novoSetor ? "Selecionar existente" : "Novo setor"}
              </button>
            </div>
            {novoSetor ? (
              <Input
                value={form.setor}
                onChange={(e) => upd("setor", e.target.value)}
                placeholder="Digite o nome do novo setor..."
                className="uppercase"
                maxLength={60}
              />
            ) : (
              <Select value={form.setor} onValueChange={(v) => upd("setor", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {setores.map((s) => <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label className="text-xs">Turno</Label>
            <Select value={form.turno} onValueChange={(v) => upd("turno", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Manhã">Manhã</SelectItem>
                <SelectItem value="Tarde">Tarde</SelectItem>
                <SelectItem value="Noite">Noite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Sexo</Label>
            <Select value={form.sexo} onValueChange={(v) => upd("sexo", v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Masculino</SelectItem>
                <SelectItem value="F">Feminino</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Origem *</Label>
            <Select value={form.origem} onValueChange={(v) => upd("origem", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agencia">Agência</SelectItem>
                <SelectItem value="direto">Direto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Nome do Indicador</Label>
            <Input value={form.indicacao} onChange={(e) => upd("indicacao", e.target.value)} placeholder="(opcional)" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Adicionar Candidato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
