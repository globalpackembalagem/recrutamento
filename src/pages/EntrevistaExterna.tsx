import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getEntrevistaByToken, responderEntrevista, type Avaliacao } from "@/lib/entrevistaData";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle, ClipboardCheck, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";

const MOTIVOS_OPTIONS = [
  "Salário baixo",
  "Falta de benefícios",
  "Falta de crescimento profissional",
  "Problemas com liderança/gestão",
  "Ambiente de trabalho ruim",
  "Sobrecarga de trabalho",
  "Falta de reconhecimento",
  "Proposta melhor de outra empresa",
  "Problemas pessoais",
  "Outro",
];

const AVALIACAO_ITEMS = [
  { key: "avaliacaoAmbiente", label: "Ambiente de trabalho" },
  { key: "avaliacaoLideranca", label: "Liderança/gestão" },
  { key: "avaliacaoSalario", label: "Salário" },
  { key: "avaliacaoBeneficios", label: "Benefícios" },
  { key: "avaliacaoCrescimento", label: "Oportunidade de crescimento" },
  { key: "avaliacaoComunicacao", label: "Comunicação interna" },
] as const;

export default function EntrevistaExterna() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [entrevista, setEntrevista] = useState<any>(null);
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // CPF verification
  const [cpfVerificado, setCpfVerificado] = useState(false);
  const [cpfInput, setCpfInput] = useState("");
  const [cpfErro, setCpfErro] = useState("");

  // Form state
  const [motivosSaida, setMotivosSaida] = useState<string[]>([]);
  const [motivoOutro, setMotivoOutro] = useState("");
  const [comentarioMotivo, setComentarioMotivo] = useState("");
  const [avaliacoes, setAvaliacoes] = useState<Record<string, Avaliacao>>({});
  const [valorizado, setValorizado] = useState("");
  const [valorizadoComentario, setValorizadoComentario] = useState("");
  const [relacaoGestor, setRelacaoGestor] = useState("");
  const [relacaoGestorComentario, setRelacaoGestorComentario] = useState("");
  const [recomendaria, setRecomendaria] = useState("");
  const [continuarEmpresa, setContinuarEmpresa] = useState("");
  const [sugestoesMelhoria, setSugestoesMelhoria] = useState("");

  useEffect(() => {
    if (!token) return;
    getEntrevistaByToken(token).then((data) => {
      if (!data) {
        setError("Link inválido ou expirado.");
      } else if (data.status === "respondida" || data.status === "finalizada") {
        setError("Esta entrevista já foi respondida.");
      } else if (data.validade && new Date(data.validade) < new Date()) {
        setError("Este link expirou. Entre em contato com o RH.");
      } else {
        setEntrevista(data);
      }
      setLoading(false);
    });
  }, [token]);

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0,3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
    return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
  };

  const verificarCpf = () => {
    const cpfDigits = cpfInput.replace(/\D/g, '');
    if (cpfDigits.length !== 11) {
      setCpfErro("Digite um CPF válido com 11 dígitos.");
      return;
    }
    if (cpfDigits !== entrevista.cpf) {
      setCpfErro("CPF não corresponde ao cadastrado para esta entrevista.");
      return;
    }
    setCpfErro("");
    setCpfVerificado(true);
  };

  const toggleMotivo = (m: string) => {
    setMotivosSaida((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  };

  const handleSubmit = async () => {
    if (motivosSaida.length === 0) { alert("Selecione pelo menos um motivo de saída."); return; }
    if (!comentarioMotivo.trim()) { alert("O comentário sobre o motivo é obrigatório."); return; }
    if (AVALIACAO_ITEMS.some((a) => !avaliacoes[a.key])) { alert("Avalie todos os itens da pergunta 2."); return; }
    if (!valorizado) { alert("Responda se você se sentia valorizado(a)."); return; }
    if (!relacaoGestor) { alert("Responda sobre a relação com o gestor."); return; }
    if (!recomendaria) { alert("Responda se recomendaria a empresa."); return; }

    setSubmitting(true);
    const ok = await responderEntrevista(token!, {
      motivosSaida,
      motivoOutro: motivosSaida.includes("Outro") ? motivoOutro : undefined,
      comentarioMotivo,
      avaliacaoAmbiente: avaliacoes.avaliacaoAmbiente,
      avaliacaoLideranca: avaliacoes.avaliacaoLideranca,
      avaliacaoSalario: avaliacoes.avaliacaoSalario,
      avaliacaoBeneficios: avaliacoes.avaliacaoBeneficios,
      avaliacaoCrescimento: avaliacoes.avaliacaoCrescimento,
      avaliacaoComunicacao: avaliacoes.avaliacaoComunicacao,
      valorizado,
      valorizadoComentario: valorizadoComentario || undefined,
      relacaoGestor,
      relacaoGestorComentario: relacaoGestorComentario || undefined,
      recomendaria,
      continuarEmpresa: continuarEmpresa || undefined,
      sugestoesMelhoria: sugestoesMelhoria || undefined,
    });
    setSubmitting(false);
    if (ok) setEnviado(true);
    else alert("Erro ao enviar. Tente novamente.");
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-muted-foreground">Carregando...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
        <ClipboardCheck className="h-12 w-12 text-slate-400 mx-auto" />
        <h1 className="text-xl font-bold text-slate-800">Entrevista de Desligamento</h1>
        <p className="text-slate-500">{error}</p>
      </div>
    </div>
  );

  if (enviado) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
        <h1 className="text-xl font-bold text-slate-800">Entrevista Enviada com Sucesso!</h1>
        <p className="text-slate-500">Obrigado pelo seu feedback. Suas respostas foram registradas com segurança.</p>
      </div>
    </div>
  );

  // CPF verification screen
  if (!cpfVerificado) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center space-y-6">
        <ShieldCheck className="h-14 w-14 text-primary mx-auto" />
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-800">Verificação de Identidade</h1>
          <p className="text-sm text-slate-500">
            Para sua segurança, digite seu CPF para acessar a entrevista de desligamento.
          </p>
        </div>
        <div className="space-y-3 text-left">
          <Label className="text-xs font-semibold">CPF</Label>
          <Input
            value={cpfInput}
            onChange={(e) => { setCpfInput(formatCpf(e.target.value)); setCpfErro(""); }}
            placeholder="000.000.000-00"
            maxLength={14}
            className="text-center text-lg tracking-wider"
            onKeyDown={(e) => e.key === 'Enter' && verificarCpf()}
          />
          {cpfErro && <p className="text-xs text-red-500 text-center">{cpfErro}</p>}
        </div>
        <Button onClick={verificarCpf} className="w-full text-sm font-bold">
          Verificar e Continuar
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 text-center space-y-2">
          <ClipboardCheck className="h-10 w-10 text-primary mx-auto" />
          <h1 className="text-xl font-bold text-slate-800">Entrevista de Desligamento</h1>
          <p className="text-sm text-slate-500">
            Olá, <strong>{entrevista.nomeFuncionario}</strong>. Por favor, responda as perguntas abaixo com sinceridade. Suas respostas são confidenciais.
          </p>
          {entrevista.cargo && (
            <p className="text-xs text-slate-400">Cargo: {entrevista.cargo} {entrevista.dataDesligamento ? `• Desligamento: ${formatDate(entrevista.dataDesligamento)}` : ''}</p>
          )}
        </div>

        {/* Pergunta 1 */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-800">1. Qual foi o principal motivo da sua saída?</h2>
          <p className="text-xs text-slate-500">Selecione uma ou mais opções</p>
          <div className="flex flex-col gap-2">
            {MOTIVOS_OPTIONS.map((m) => (
              <label
                key={m}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all text-sm ${
                  motivosSaida.includes(m)
                    ? 'border-primary bg-primary/10 font-medium'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Checkbox checked={motivosSaida.includes(m)} onCheckedChange={() => toggleMotivo(m)} />
                {m}
              </label>
            ))}
          </div>
          {motivosSaida.includes("Outro") && (
            <div>
              <Label className="text-sm">Especifique:</Label>
              <Textarea value={motivoOutro} onChange={(e) => setMotivoOutro(e.target.value)} placeholder="Descreva..." className="text-sm" />
            </div>
          )}
          <div>
            <Label className="text-sm font-semibold">Faça um comentário sobre o motivo da saída *</Label>
            <Textarea value={comentarioMotivo} onChange={(e) => setComentarioMotivo(e.target.value)} placeholder="Comente..." className="text-sm" />
          </div>
        </div>

        {/* Pergunta 2 */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-800">2. Como você avalia os seguintes pontos?</h2>
          <div className="space-y-3">
            {AVALIACAO_ITEMS.map((item) => (
              <div key={item.key} className="p-3 rounded-lg border space-y-2">
                <span className="text-sm font-medium text-slate-700">{item.label}</span>
                <RadioGroup
                  value={avaliacoes[item.key] || ""}
                  onValueChange={(v) => setAvaliacoes((prev) => ({ ...prev, [item.key]: v as Avaliacao }))}
                  className="flex flex-col gap-2"
                >
                  {(["ruim", "regular", "bom"] as const).map((val) => (
                    <label
                      key={val}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border-2 cursor-pointer transition-all text-sm ${
                        avaliacoes[item.key] === val
                          ? val === 'bom' ? 'border-green-500 bg-green-50 font-medium' 
                            : val === 'regular' ? 'border-yellow-500 bg-yellow-50 font-medium' 
                            : 'border-red-500 bg-red-50 font-medium'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <RadioGroupItem value={val} />
                      {val.charAt(0).toUpperCase() + val.slice(1)}
                    </label>
                  ))}
                </RadioGroup>
              </div>
            ))}
          </div>
        </div>

        {/* Pergunta 3 */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-800">3. Você se sentia valorizado(a) na empresa?</h2>
          <RadioGroup value={valorizado} onValueChange={setValorizado} className="flex flex-col gap-2">
            {[{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }, { v: "as_vezes", l: "Às vezes" }].map((o) => (
              <label
                key={o.v}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all text-sm ${
                  valorizado === o.v ? 'border-primary bg-primary/10 font-medium' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <RadioGroupItem value={o.v} />{o.l}
              </label>
            ))}
          </RadioGroup>
          <div>
            <Label className="text-sm">Comentário (opcional)</Label>
            <Textarea value={valorizadoComentario} onChange={(e) => setValorizadoComentario(e.target.value)} className="text-sm" />
          </div>
        </div>

        {/* Pergunta 4 */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-800">4. Como era sua relação com seu gestor direto?</h2>
          <RadioGroup value={relacaoGestor} onValueChange={setRelacaoGestor} className="flex flex-col gap-2">
            {[{ v: "boa", l: "Boa" }, { v: "regular", l: "Regular" }, { v: "ruim", l: "Ruim" }].map((o) => (
              <label
                key={o.v}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all text-sm ${
                  relacaoGestor === o.v ? 'border-primary bg-primary/10 font-medium' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <RadioGroupItem value={o.v} />{o.l}
              </label>
            ))}
          </RadioGroup>
          <div>
            <Label className="text-sm">Comentário (opcional)</Label>
            <Textarea value={relacaoGestorComentario} onChange={(e) => setRelacaoGestorComentario(e.target.value)} className="text-sm" />
          </div>
        </div>

        {/* Pergunta 5 */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-800">5. Você recomendaria a empresa para trabalhar?</h2>
          <RadioGroup value={recomendaria} onValueChange={setRecomendaria} className="flex flex-col gap-2">
            {[{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }, { v: "talvez", l: "Talvez" }].map((o) => (
              <label
                key={o.v}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all text-sm ${
                  recomendaria === o.v ? 'border-primary bg-primary/10 font-medium' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <RadioGroupItem value={o.v} />{o.l}
              </label>
            ))}
          </RadioGroup>
        </div>

        {/* Pergunta 6 */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-800">6. O que poderia ter sido feito para você continuar na empresa?</h2>
          <Textarea value={continuarEmpresa} onChange={(e) => setContinuarEmpresa(e.target.value)} className="text-sm" placeholder="Descreva..." />
        </div>

        {/* Pergunta 7 */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-800">7. Sugestões de melhoria</h2>
          <Textarea value={sugestoesMelhoria} onChange={(e) => setSugestoesMelhoria(e.target.value)} className="text-sm" placeholder="Suas sugestões..." />
        </div>

        {/* Submit */}
        <div className="flex justify-center pb-8">
          <Button onClick={handleSubmit} disabled={submitting} size="lg" className="w-full max-w-sm text-sm font-bold">
            {submitting ? "Enviando..." : "Enviar Respostas"}
          </Button>
        </div>
      </div>
    </div>
  );
}
