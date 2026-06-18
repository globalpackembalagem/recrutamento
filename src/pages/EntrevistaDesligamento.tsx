import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Copy, Eye, CheckCircle, Search, Trash2, Send, ClipboardList, MessageSquareText, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  getEntrevistas,
  criarEntrevista,
  atualizarStatusEntrevista,
  deletarEntrevista,
  statusEntrevistaLabels,
  statusEntrevistaColors,
  type EntrevistaDesligamento as Entrevista,
  type TipoDesligamento,
} from "@/lib/entrevistaData";

const AVALIACAO_LABELS: Record<string, string> = {
  ruim: "Ruim", regular: "Regular", bom: "Bom",
};
const VALORIZADO_LABELS: Record<string, string> = {
  sim: "Sim", nao: "Não", as_vezes: "Às vezes",
};
const RECOMENDARIA_LABELS: Record<string, string> = {
  sim: "Sim", nao: "Não", talvez: "Talvez",
};
const RELACAO_LABELS: Record<string, string> = {
  boa: "Boa", regular: "Regular", ruim: "Ruim",
};

const PERGUNTAS = [
  {
    numero: 1,
    titulo: "Qual foi o principal motivo da sua saída?",
    descricao: "Múltipla escolha + campo de comentário obrigatório",
    opcoes: ["Salário baixo", "Falta de benefícios", "Falta de crescimento profissional", "Problemas com liderança/gestão", "Ambiente de trabalho ruim", "Sobrecarga de trabalho", "Falta de reconhecimento", "Proposta melhor de outra empresa", "Problemas pessoais", "Outro"],
  },
  {
    numero: 2,
    titulo: "Como você avalia os seguintes pontos?",
    descricao: "Avaliação (Ruim / Regular / Bom) para cada item",
    opcoes: ["Ambiente de trabalho", "Liderança/gestão", "Salário", "Benefícios", "Oportunidade de crescimento", "Comunicação interna"],
  },
  {
    numero: 3,
    titulo: "Você se sentia valorizado(a) na empresa?",
    descricao: "Sim / Não / Às vezes + comentário opcional",
    opcoes: [],
  },
  {
    numero: 4,
    titulo: "Como era sua relação com seu gestor direto?",
    descricao: "Boa / Regular / Ruim + comentário opcional",
    opcoes: [],
  },
  {
    numero: 5,
    titulo: "Você recomendaria a empresa para trabalhar?",
    descricao: "Sim / Não / Talvez",
    opcoes: [],
  },
  {
    numero: 6,
    titulo: "O que poderia ter sido feito para você continuar na empresa?",
    descricao: "Campo de texto livre",
    opcoes: [],
  },
  {
    numero: 7,
    titulo: "Sugestões de melhoria",
    descricao: "Campo de texto livre",
    opcoes: [],
  },
];

function RespostaCard({ entrevista }: { entrevista: Entrevista }) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setAberto(!aberto)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <div>
            <p className="text-sm font-semibold">{entrevista.nomeFuncionario}</p>
            <p className="text-xs text-muted-foreground">
              {entrevista.cargo || "Sem cargo"} • {entrevista.tipoDesligamento === "pedido_demissao" ? "Pedido de demissão" : "Demitido"} • Respondido em: {entrevista.dataResposta ? formatDate(entrevista.dataResposta) : "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-xs ${statusEntrevistaColors[entrevista.status]}`}>
            {statusEntrevistaLabels[entrevista.status]}
          </Badge>
          {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {aberto && (
        <div className="border-t p-5 space-y-5 bg-slate-50/50">
          {/* Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-white rounded-lg border">
            <div><span className="text-xs font-bold text-muted-foreground">Cargo</span><p className="text-sm">{entrevista.cargo || "—"}</p></div>
            <div><span className="text-xs font-bold text-muted-foreground">Empresa</span><p className="text-sm">{entrevista.empresaAgencia || "—"}</p></div>
            <div><span className="text-xs font-bold text-muted-foreground">Desligamento</span><p className="text-sm">{formatDate(entrevista.dataDesligamento)}</p></div>
            <div><span className="text-xs font-bold text-muted-foreground">Tipo</span><p className="text-sm">{entrevista.tipoDesligamento === "pedido_demissao" ? "Pedido de demissão" : "Demitido"}</p></div>
          </div>

          {/* P1 */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold">1. Motivos da saída</h4>
            <div className="flex flex-wrap gap-1">
              {entrevista.motivosSaida?.map((m) => (
                <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
              ))}
            </div>
            {entrevista.motivoOutro && <p className="text-sm text-muted-foreground">Outro: {entrevista.motivoOutro}</p>}
            <div className="bg-white p-3 rounded-lg border">
              <span className="text-xs font-semibold text-muted-foreground">Comentário:</span>
              <p className="text-sm mt-1">{entrevista.comentarioMotivo}</p>
            </div>
          </div>

          {/* P2 */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold">2. Avaliações</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { label: "Ambiente", val: entrevista.avaliacaoAmbiente },
                { label: "Liderança", val: entrevista.avaliacaoLideranca },
                { label: "Salário", val: entrevista.avaliacaoSalario },
                { label: "Benefícios", val: entrevista.avaliacaoBeneficios },
                { label: "Crescimento", val: entrevista.avaliacaoCrescimento },
                { label: "Comunicação", val: entrevista.avaliacaoComunicacao },
              ].map((a) => (
                <div key={a.label} className="flex justify-between items-center p-2 bg-white rounded-lg border">
                  <span className="text-xs font-medium">{a.label}</span>
                  <Badge variant="outline" className={`text-xs ${a.val === 'bom' ? 'bg-green-50 text-green-700 border-green-200' : a.val === 'regular' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {AVALIACAO_LABELS[a.val || ''] || '—'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* P3 */}
          <div className="space-y-1">
            <h4 className="text-sm font-bold">3. Se sentia valorizado(a)?</h4>
            <p className="text-sm">{VALORIZADO_LABELS[entrevista.valorizado || ''] || '—'}</p>
            {entrevista.valorizadoComentario && <p className="text-sm bg-white p-2 rounded-lg border">{entrevista.valorizadoComentario}</p>}
          </div>

          {/* P4 */}
          <div className="space-y-1">
            <h4 className="text-sm font-bold">4. Relação com o gestor</h4>
            <p className="text-sm">{RELACAO_LABELS[entrevista.relacaoGestor || ''] || '—'}</p>
            {entrevista.relacaoGestorComentario && <p className="text-sm bg-white p-2 rounded-lg border">{entrevista.relacaoGestorComentario}</p>}
          </div>

          {/* P5 */}
          <div className="space-y-1">
            <h4 className="text-sm font-bold">5. Recomendaria a empresa?</h4>
            <p className="text-sm">{RECOMENDARIA_LABELS[entrevista.recomendaria || ''] || '—'}</p>
          </div>

          {/* P6 */}
          <div className="space-y-1">
            <h4 className="text-sm font-bold">6. O que poderia ter sido feito para continuar?</h4>
            <p className="text-sm bg-white p-2 rounded-lg border">{entrevista.continuarEmpresa || '—'}</p>
          </div>

          {/* P7 */}
          <div className="space-y-1">
            <h4 className="text-sm font-bold">7. Sugestões de melhoria</h4>
            <p className="text-sm bg-white p-2 rounded-lg border">{entrevista.sugestoesMelhoria || '—'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EntrevistaDesligamento() {
  const { usuario } = useAuth();
  const canViewResponses = usuario?.verEntrevistas ?? false;
  const [entrevistas, setEntrevistas] = useState<Entrevista[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchRespostas, setSearchRespostas] = useState("");
  const [showCriar, setShowCriar] = useState(false);

  // Form state
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [cargo, setCargo] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [dataDesligamento, setDataDesligamento] = useState("");
  const [tipoDesligamento, setTipoDesligamento] = useState<TipoDesligamento | "">("");

  const refresh = useCallback(() => {
    setLoading(true);
    getEntrevistas().then((data) => { setEntrevistas(data); setLoading(false); });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = entrevistas.filter((e) =>
    !search || e.nomeFuncionario.toLowerCase().includes(search.toLowerCase())
  );

  const respondidas = entrevistas
    .filter((e) => (e.status === "respondida" || e.status === "finalizada"))
    .filter((e) => !searchRespostas || e.nomeFuncionario.toLowerCase().includes(searchRespostas.toLowerCase()));

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0,3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
    return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
  };

  const handleCriar = async () => {
    if (!nome.trim()) { toast.error("Nome do funcionário é obrigatório."); return; }
    const cpfDigits = cpf.replace(/\D/g, '');
    if (cpfDigits.length !== 11) { toast.error("CPF deve ter 11 dígitos."); return; }
    const result = await criarEntrevista({
      nomeFuncionario: nome.trim(),
      cpf: cpfDigits,
      cargo: cargo.trim() || undefined,
      empresaAgencia: empresa.trim() || undefined,
      dataDesligamento: dataDesligamento || undefined,
      tipoDesligamento: tipoDesligamento as TipoDesligamento || undefined,
    });
    if (result) {
      toast.success("Entrevista criada e link gerado!");
      setShowCriar(false);
      setNome(""); setCpf(""); setCargo(""); setEmpresa(""); setDataDesligamento(""); setTipoDesligamento("");
      refresh();
    } else {
      toast.error("Erro ao criar entrevista.");
    }
  };

  const copiarLink = (token: string) => {
    const url = `${window.location.origin}/entrevista/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const marcarEnviada = async (e: Entrevista) => {
    await atualizarStatusEntrevista(e.id, "enviada");
    toast.success("Status atualizado para Enviada.");
    refresh();
  };

  const finalizar = async (e: Entrevista) => {
    await atualizarStatusEntrevista(e.id, "finalizada");
    toast.success("Entrevista finalizada.");
    refresh();
  };

  const excluir = async (e: Entrevista) => {
    if (!confirm(`Excluir entrevista de ${e.nomeFuncionario}?`)) return;
    await deletarEntrevista(e.id);
    toast.success("Entrevista excluída.");
    refresh();
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="entrevistas" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="entrevistas" className="text-sm">
            <ClipboardList className="h-4 w-4 mr-2" /> Entrevistas
          </TabsTrigger>
          <TabsTrigger value="perguntas" className="text-sm">
            <MessageSquareText className="h-4 w-4 mr-2" /> Perguntas
          </TabsTrigger>
          <TabsTrigger value="respostas" className="text-sm">
            <Eye className="h-4 w-4 mr-2" /> Respostas ({respondidas.length})
          </TabsTrigger>
        </TabsList>

        {/* ABA ENTREVISTAS */}
        <TabsContent value="entrevistas">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <CardTitle className="text-lg">Gerenciar Entrevistas</CardTitle>
                <Button size="sm" onClick={() => setShowCriar(true)} className="text-sm">
                  <Plus className="h-4 w-4 mr-1" /> Nova Entrevista
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm text-sm" />
              </div>

              {loading ? (
                <p className="text-center py-8 text-muted-foreground">Carregando...</p>
              ) : (
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs font-bold">FUNCIONÁRIO</TableHead>
                        <TableHead className="text-xs font-bold">CARGO</TableHead>
                        <TableHead className="text-xs font-bold">TIPO</TableHead>
                        <TableHead className="text-xs font-bold">DATA DESLIG.</TableHead>
                        <TableHead className="text-xs font-bold">STATUS</TableHead>
                        <TableHead className="text-xs font-bold text-right">AÇÕES</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma entrevista cadastrada.</TableCell></TableRow>
                      ) : filtered.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-sm font-medium py-3">{e.nomeFuncionario}</TableCell>
                          <TableCell className="text-sm py-3">{e.cargo || "—"}</TableCell>
                          <TableCell className="text-sm py-3">
                            {e.tipoDesligamento === "pedido_demissao" ? "Pedido de demissão" : e.tipoDesligamento === "demitido" ? "Demitido" : "—"}
                          </TableCell>
                          <TableCell className="text-sm py-3">{formatDate(e.dataDesligamento)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${statusEntrevistaColors[e.status]}`}>
                              {statusEntrevistaLabels[e.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1 flex-wrap">
                              <Button size="sm" variant="outline" className="h-8 text-xs px-2" onClick={() => copiarLink(e.token)}>
                                <Copy className="h-3.5 w-3.5 mr-1" /> Copiar Link
                              </Button>
                              <Button
                                size="sm" variant="outline"
                                className="h-8 text-xs px-2 border-green-500 text-green-600"
                                onClick={() => {
                                  const url = `${window.location.origin}/entrevista/${e.token}`;
                                  const msg = encodeURIComponent(`Olá ${e.nomeFuncionario}, segue o link para preencher a entrevista de desligamento:\n\n${url}\n\nPor favor, preencha com sinceridade. Suas respostas são confidenciais.`);
                                  window.open(`https://wa.me/?text=${msg}`, '_blank');
                                }}
                              >
                                <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
                              </Button>
                              {(e.status === "link_gerado") && (
                                <Button size="sm" variant="outline" className="h-8 text-xs px-2 border-yellow-500 text-yellow-600" onClick={() => marcarEnviada(e)}>
                                  <Send className="h-3.5 w-3.5 mr-1" /> Enviada
                                </Button>
                              )}
                              {e.status === "respondida" && (
                                <Button size="sm" variant="outline" className="h-8 text-xs px-2 border-slate-600 text-slate-600" onClick={() => finalizar(e)}>
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" /> Finalizar
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-8 text-xs px-2 border-red-500 text-red-500" onClick={() => excluir(e)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA PERGUNTAS */}
        <TabsContent value="perguntas">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Perguntas do Formulário</CardTitle>
              <p className="text-sm text-muted-foreground">Estas são as perguntas que o funcionário responde ao acessar o link da entrevista.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {PERGUNTAS.map((p) => (
                <div key={p.numero} className="border rounded-lg p-4 space-y-2">
                  <h3 className="text-sm font-bold">{p.numero}. {p.titulo}</h3>
                  <p className="text-sm text-muted-foreground">{p.descricao}</p>
                  {p.opcoes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {p.opcoes.map((op) => (
                        <Badge key={op} variant="outline" className="text-xs">{op}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA RESPOSTAS */}
        <TabsContent value="respostas">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Respostas por Funcionário</CardTitle>
              <p className="text-sm text-muted-foreground">
                {canViewResponses
                  ? `${respondidas.length} entrevista(s) respondida(s). Clique para expandir e ver as respostas.`
                  : "Você não tem permissão para visualizar as respostas das entrevistas."
                }
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canViewResponses ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Eye className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Acesso restrito. Apenas usuários autorizados podem ver as respostas.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar funcionário..." value={searchRespostas} onChange={(e) => setSearchRespostas(e.target.value)} className="max-w-sm text-sm" />
                  </div>
                  {respondidas.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Nenhuma entrevista respondida ainda.</p>
                  ) : (
                    <div className="space-y-3">
                      {respondidas.map((e) => (
                        <RespostaCard key={e.id} entrevista={e} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Criar */}
      <Dialog open={showCriar} onOpenChange={setShowCriar}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-base">Nova Entrevista de Desligamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Nome do Funcionário *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" className="text-sm" />
            </div>
            <div>
              <Label className="text-sm">CPF do Funcionário *</Label>
              <Input value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} placeholder="000.000.000-00" maxLength={14} className="text-sm" />
            </div>
            <div>
              <Label className="text-sm">Cargo</Label>
              <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex: Operador" className="text-sm" />
            </div>
            <div>
              <Label className="text-sm">Empresa / Agência</Label>
              <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Ex: Real Parceria" className="text-sm" />
            </div>
            <div>
              <Label className="text-sm">Data do Desligamento</Label>
              <Input type="date" value={dataDesligamento} onChange={(e) => setDataDesligamento(e.target.value)} className="text-sm" />
            </div>
            <div>
              <Label className="text-sm">Tipo de Desligamento</Label>
              <Select value={tipoDesligamento} onValueChange={(v) => setTipoDesligamento(v as TipoDesligamento)}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pedido_demissao">Pedido de demissão</SelectItem>
                  <SelectItem value="demitido">Demitido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCriar} className="text-sm">Criar e Gerar Link</Button>
              <Button variant="outline" onClick={() => setShowCriar(false)} className="text-sm">Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
