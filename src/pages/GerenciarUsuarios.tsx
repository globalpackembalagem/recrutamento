import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, UserCheck, UserX, GripVertical, Eye, EyeOff, ChevronUp, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getUsuarios,
  criarUsuario,
  atualizarUsuario,
  deletarUsuario,
  perfilLabels,
  type Usuario,
  type PerfilUsuario,
} from "@/lib/usuarioData";
import { useAuth } from "@/contexts/AuthContext";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";

export default function GerenciarUsuarios() {
  const { usuario: currentUser } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);

  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [perfil, setPerfil] = useState<PerfilUsuario>("visualizar");
  const [especialidade, setEspecialidade] = useState("");
  const [sala, setSala] = useState("");
  const [acessoAtendimento, setAcessoAtendimento] = useState(false);
  const [acessoAprovar, setAcessoAprovar] = useState(false);
  const [verAprovados, setVerAprovados] = useState(false);
  const [acessoPortaria, setAcessoPortaria] = useState(false);
  const [acessoImportacao, setAcessoImportacao] = useState(false);
  const [acessoRH, setAcessoRH] = useState(false);
  const [acessoRealParceria, setAcessoRealParceria] = useState(false);
  const [acessoDashboard, setAcessoDashboard] = useState(false);
  const [acessoDiario, setAcessoDiario] = useState(false);
  const [autorizadoIp, setAutorizadoIp] = useState("");
  const [ativo, setAtivo] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    getUsuarios().then((data) => { setUsuarios(data); setLoading(false); });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const limparForm = () => {
    setNome(""); setLogin(""); setSenha(""); setPerfil("visualizar");
    setEspecialidade(""); setSala("");
    setAcessoAtendimento(false); setAcessoAprovar(false); setVerAprovados(false);
    setAcessoPortaria(false); setAcessoImportacao(false); setAcessoRH(false);
    setAcessoRealParceria(false); setAcessoDashboard(false); setAcessoDiario(false); 
    setAutorizadoIp(""); setAtivo(true);
    setEditando(null); setShowForm(false);
  };

  const abrirEditar = (u: Usuario) => {
    setEditando(u);
    setNome(u.nome);
    setLogin(u.login);
    setSenha("");
    setPerfil(u.perfil);
    setEspecialidade(u.especialidade);
    setSala(u.sala);
    setAcessoAtendimento(u.acessoAtendimento);
    setAcessoAprovar(u.acessoAprovar);
    setVerAprovados(u.verAprovados);
    setAcessoPortaria(u.acessoPortaria);
    setAcessoImportacao(u.acessoImportacao);
    setAcessoRH(u.acessoRH);
    setAcessoRealParceria(u.acessoRealParceria);
    setAcessoDashboard(u.acessoDashboard);
    setAcessoDiario(u.acessoDiario);
    setAutorizadoIp(u.autorizadoIp || "");
    setAtivo(u.ativo);
    setShowForm(true);
  };

  const handleSalvar = async () => {
    if (!nome.trim() || !login.trim()) { toast.error("Nome e login são obrigatórios."); return; }
    if (!editando && !senha.trim()) { toast.error("Senha é obrigatória para novo usuário."); return; }

    try {
      if (editando) {
        const updates: Partial<Usuario> = {
          nome: nome.trim(), login: login.trim(), perfil,
          especialidade: especialidade.trim(), sala: sala.trim(),
          acessoAtendimento, acessoAprovar, verAprovados,
          acessoPortaria, acessoImportacao, acessoRH, acessoRealParceria, acessoDashboard, acessoDiario,
          autorizadoIp: autorizadoIp.trim() || undefined,
          ativo,
        };
        if (senha.trim()) updates.senha = senha.trim();
        await atualizarUsuario(editando.id, updates);
        toast.success("Usuário atualizado!");
      } else {
        const maxOrdem = usuarios.length > 0 ? Math.max(...usuarios.map(u => u.ordemAtendimento)) : 0;
        const result = await criarUsuario({
          nome: nome.trim(), login: login.trim(), senha: senha.trim(), perfil,
          especialidade: especialidade.trim(), sala: sala.trim(),
          verEntrevistas: false, acessoAtendimento, acessoAprovar, verAprovados,
          ordemAtendimento: maxOrdem + 1,
          acessoPortaria, acessoImportacao, acessoRH, acessoRealParceria, acessoDashboard, acessoDiario,
          autorizadoIp: autorizadoIp.trim() || undefined,
        });
        if (!result) { toast.error("Erro ao criar. Login já pode estar em uso."); return; }
        toast.success("Usuário criado!");
      }
      limparForm();
      refresh();
    } catch (err: any) {
      console.error("Erro ao salvar usuário:", err);
      toast.error(`Erro ao salvar: ${err?.message || 'erro desconhecido'}`);
    }
  };

  const handleExcluir = async (u: Usuario) => {
    if (u.id === currentUser?.id) { toast.error("Você não pode excluir seu próprio usuário."); return; }
    if (!confirm(`Excluir o usuário ${u.nome}?`)) return;
    await deletarUsuario(u.id);
    toast.success("Usuário excluído.");
    refresh();
  };

  const toggleAtivo = async (u: Usuario) => {
    if (u.id === currentUser?.id) { toast.error("Você não pode desativar seu próprio usuário."); return; }
    await atualizarUsuario(u.id, { ativo: !u.ativo });
    toast.success(`${u.nome} ${u.ativo ? 'desativado' : 'ativado'}.`);
    refresh();
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;
    const items = Array.from(usuarios);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    setUsuarios(items);
    try {
      await Promise.all(
        items.map((u, i) =>
          u.ordemAtendimento !== i ? atualizarUsuario(u.id, { ordemAtendimento: i }) : Promise.resolve()
        )
      );
      toast.success("Ordem atualizada!");
      refresh();
    } catch (err: any) {
      console.error("Erro ao reordenar:", err);
      toast.error(`Erro ao salvar ordem: ${err?.message || 'erro desconhecido'}`);
      refresh();
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === usuarios.length ? new Set() : new Set(usuarios.map(u => u.id)));
  };

  const handleExcluirSelecionados = async () => {
    const ids = Array.from(selectedIds).filter(id => id !== currentUser?.id);
    if (ids.length === 0) { toast.error("Nenhum usuário selecionado (não pode incluir você mesmo)."); return; }
    if (!confirm(`Excluir ${ids.length} usuário(s) selecionado(s)?`)) return;
    try {
      await Promise.all(ids.map(id => deletarUsuario(id)));
      toast.success(`${ids.length} usuário(s) excluído(s).`);
      setSelectedIds(new Set());
      refresh();
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || 'erro desconhecido'}`);
    }
  };

  const moverSelecionados = async (direcao: 'cima' | 'baixo') => {
    if (selectedIds.size === 0) { toast.error("Selecione ao menos um usuário."); return; }
    const items = [...usuarios];
    const indices = items
      .map((u, i) => selectedIds.has(u.id) ? i : -1)
      .filter(i => i >= 0);
    if (direcao === 'cima') {
      for (const i of indices) {
        if (i === 0 || selectedIds.has(items[i - 1].id)) continue;
        [items[i - 1], items[i]] = [items[i], items[i - 1]];
      }
    } else {
      for (let k = indices.length - 1; k >= 0; k--) {
        const i = indices[k];
        if (i === items.length - 1 || selectedIds.has(items[i + 1].id)) continue;
        [items[i + 1], items[i]] = [items[i], items[i + 1]];
      }
    }
    setUsuarios(items);
    try {
      await Promise.all(
        items.map((u, i) => u.ordemAtendimento !== i ? atualizarUsuario(u.id, { ordemAtendimento: i }) : Promise.resolve())
      );
      toast.success("Ordem atualizada!");
      refresh();
    } catch (err: any) {
      toast.error(`Erro ao salvar ordem: ${err?.message || 'erro desconhecido'}`);
      refresh();
    }
  };

  const perfilColor: Record<PerfilUsuario, string> = {
    admin: "bg-red-50 text-red-700 border-red-200",
    editar: "bg-blue-50 text-blue-700 border-blue-200",
    visualizar: "bg-slate-100 text-slate-700 border-slate-200",
  };

  const moduleLabels: { key: string; label: string }[] = [
    { key: "portaria", label: "Portaria" },
    { key: "importacao", label: "Importação" },
    { key: "rh", label: "RH" },
    { key: "realParceria", label: "Real Parceria" },
    { key: "dashboard", label: "Dashboard" },
    { key: "diario", label: "Atendimento Diário" },
  ];

  const getModuleBadges = (u: Usuario) => {
    if (u.perfil === 'admin') return [{ label: "TUDO", color: "bg-red-50 text-red-700 border-red-200" }];
    const badges: { label: string; color: string }[] = [];
    if (u.acessoPortaria) badges.push({ label: "Portaria", color: "bg-orange-50 text-orange-700 border-orange-200" });
    if (u.acessoImportacao) badges.push({ label: "Import.", color: "bg-cyan-50 text-cyan-700 border-cyan-200" });
    if (u.acessoDashboard) badges.push({ label: "Dash", color: "bg-indigo-50 text-indigo-700 border-indigo-200" });
    if (u.acessoRH) badges.push({ label: "RH", color: "bg-emerald-50 text-emerald-700 border-emerald-200" });
    if (u.acessoRealParceria) badges.push({ label: "R.Parc.", color: "bg-amber-50 text-amber-700 border-amber-200" });
    if (u.acessoDiario) badges.push({ label: "Diário", color: "bg-blue-50 text-blue-700 border-blue-200" });
    return badges;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Cadastro de Usuários / Atendentes</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Arraste para definir a ordem de atendimento</p>
            </div>
            <Button size="sm" onClick={() => { limparForm(); setShowForm(true); }} className="text-sm">
              <Plus className="h-4 w-4 mr-1" /> Novo Usuário
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!loading && usuarios.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-3 p-2 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size > 0 && selectedIds.size === usuarios.length}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-xs font-semibold">
                  {selectedIds.size > 0 ? `${selectedIds.size} selecionado(s)` : "Selecionar todos"}
                </span>
              </div>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => moverSelecionados('cima')}>
                    <ChevronUp className="h-3.5 w-3.5 mr-1" /> Subir
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => moverSelecionados('baixo')}>
                    <ChevronDown className="h-3.5 w-3.5 mr-1" /> Descer
                  </Button>
                  <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleExcluirSelecionados}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
                    Limpar
                  </Button>
                </div>
              )}
            </div>
          )}
          {loading ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Carregando...</p>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="usuarios-list">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                    {usuarios.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground text-sm">Nenhum usuário cadastrado.</p>
                    ) : usuarios.map((u, idx) => (
                      <Draggable key={u.id} draggableId={u.id} index={idx}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={cn(
                              "rounded-lg border bg-card p-3 flex items-center gap-3 transition-shadow",
                              snapshot.isDragging && "shadow-lg ring-2 ring-primary/30",
                              !u.ativo && "opacity-50"
                            )}
                          >
                            <Checkbox
                              checked={selectedIds.has(u.id)}
                              onCheckedChange={() => toggleSelect(u.id)}
                            />
                            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                              <GripVertical className="h-5 w-5" />
                            </div>
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-sm font-bold min-w-[2rem] justify-center">
                              {idx + 1}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold uppercase">{u.nome}</p>
                                <Badge variant="outline" className={`text-[10px] ${perfilColor[u.perfil]}`}>
                                  {perfilLabels[u.perfil]}
                                </Badge>
                                {u.ativo ? (
                                  <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">Ativo</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">Inativo</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="text-xs text-muted-foreground">Login: {u.login}</span>
                                {u.especialidade && <span className="text-xs text-muted-foreground">• {u.especialidade}</span>}
                                {u.sala && <span className="text-xs text-muted-foreground">• Sala: {u.sala}</span>}
                                {u.autorizadoIp && <span className="text-xs text-amber-600 font-bold">• IP: {u.autorizadoIp}</span>}
                              </div>
                              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                {getModuleBadges(u).map((b, i) => (
                                  <Badge key={i} variant="outline" className={`text-[9px] px-1.5 py-0 ${b.color}`}>
                                    {b.label}
                                  </Badge>
                                ))}
                                {u.acessoAtendimento && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200">Painel</Badge>
                                )}
                                {u.acessoAprovar && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200">Aprova</Badge>
                                )}
                                {u.verAprovados && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200">Vê Aprov.</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => abrirEditar(u)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className={`h-8 w-8 p-0 ${u.ativo ? 'text-yellow-600' : 'text-green-600'}`} onClick={() => toggleAtivo(u)}>
                                {u.ativo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => handleExcluir(u)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={(v) => !v && limparForm()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">{editando ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-sm">Nome *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" className="text-sm" />
              </div>
              <div>
                <Label className="text-sm">Login *</Label>
                <Input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Ex: luciano" className="text-sm" />
              </div>
              <div>
                <Label className="text-sm">Senha {editando ? '(vazio = manter)' : '*'}</Label>
                <div className="relative">
                  <Input type={showPassword ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••" className="text-sm pr-9" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label className="text-sm">Especialidade</Label>
                <Input value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} placeholder="Ex: Fono, Médico..." className="text-sm" />
              </div>
              <div>
                <Label className="text-sm">Sala</Label>
                <Input value={sala} onChange={(e) => setSala(e.target.value)} placeholder="Ex: Sala 1" className="text-sm" />
              </div>
              <div className="col-span-2">
                <Label className="text-sm">IP Autorizado (opcional)</Label>
                <Input value={autorizadoIp} onChange={(e) => setAutorizadoIp(e.target.value)} placeholder="Ex: 177.100.200.50, 189.10.20.30" className="text-sm" />
                <p className="text-[10px] text-muted-foreground mt-1">Se preenchido, o usuário só poderá acessar destes endereços IP (separe por vírgula se for mais de um).</p>
              </div>
            </div>
              {editando && (
                <div className="flex items-center gap-3 p-3 rounded-lg border col-span-2">
                  <Switch checked={ativo} onCheckedChange={setAtivo} />
                  <div>
                    <Label className="text-sm font-semibold">{ativo ? "Ativo" : "Inativo"}</Label>
                    <p className="text-xs text-muted-foreground">Usuário {ativo ? "pode" : "não pode"} acessar o sistema</p>
                  </div>
                </div>
              )}
              <div>
                <Label className="text-sm">Perfil</Label>
              <Select value={perfil} onValueChange={(v) => setPerfil(v as PerfilUsuario)}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="visualizar">Visualizar — só pode ver dados</SelectItem>
                  <SelectItem value="editar">Editar — pode alterar dados</SelectItem>
                  <SelectItem value="admin">Admin — acesso total a tudo</SelectItem>
                </SelectContent>
              </Select>
              {perfil === 'admin' && (
                <p className="text-[10px] text-muted-foreground mt-1">Admin tem acesso a todos os módulos automaticamente.</p>
              )}
            </div>

            {perfil !== 'admin' && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-muted-foreground">Módulos que pode acessar</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 p-2 rounded-lg border">
                    <Switch checked={acessoDashboard} onCheckedChange={setAcessoDashboard} />
                    <Label className="text-xs font-semibold">Dashboard</Label>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg border">
                    <Switch checked={acessoPortaria} onCheckedChange={setAcessoPortaria} />
                    <Label className="text-xs font-semibold">Portaria</Label>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg border">
                    <Switch checked={acessoImportacao} onCheckedChange={setAcessoImportacao} />
                    <Label className="text-xs font-semibold">Importação</Label>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg border">
                    <Switch checked={acessoRH} onCheckedChange={setAcessoRH} />
                    <Label className="text-xs font-semibold">RH</Label>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg border">
                    <Switch checked={acessoRealParceria} onCheckedChange={setAcessoRealParceria} />
                    <Label className="text-xs font-semibold">Real Parceria</Label>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg border">
                    <Switch checked={acessoDiario} onCheckedChange={setAcessoDiario} />
                    <Label className="text-xs font-semibold">Atendimento Diário</Label>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-muted-foreground">Permissões de Atendimento</Label>
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <Switch checked={acessoAtendimento} onCheckedChange={setAcessoAtendimento} />
                <div>
                  <Label className="text-sm font-semibold">Aparece no Painel</Label>
                  <p className="text-xs text-muted-foreground">Usuário aparece como atendente no painel</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <Switch checked={acessoAprovar} onCheckedChange={setAcessoAprovar} />
                <div>
                  <Label className="text-sm font-semibold">Pode Aprovar / Reprovar</Label>
                  <p className="text-xs text-muted-foreground">Pode aprovar ou reprovar candidatos</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <Switch checked={verAprovados} onCheckedChange={setVerAprovados} />
                <div>
                  <Label className="text-sm font-semibold">Ver Aprovados</Label>
                  <p className="text-xs text-muted-foreground">Pode visualizar lista de aprovados</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSalvar} className="text-sm">{editando ? "Salvar Alterações" : "Criar Usuário"}</Button>
              <Button variant="outline" onClick={limparForm} className="text-sm">Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
