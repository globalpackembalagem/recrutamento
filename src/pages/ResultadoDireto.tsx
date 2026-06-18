import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { getUsuarioByLogin, type Usuario } from "@/lib/usuarioData";
import { useCandidatos, useClosedDates } from "@/hooks/useSupabaseData";
import ResultadoView from "@/components/ResultadoView";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function ResultadoDireto() {
  const [searchParams] = useSearchParams();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { candidatos, refresh: refreshCandidatos } = useCandidatos(true);
  const { closedDates, refresh: refreshClosedDates } = useClosedDates();
  const [resultadoLiberado, setResultadoLiberado] = useState(false);

  const refresh = () => { refreshCandidatos(); refreshClosedDates(); };

  useEffect(() => {
    const init = async () => {
      const userParam = searchParams.get("user");
      if (!userParam) {
        setError("Parâmetro ?user= não informado na URL.");
        setLoading(false);
        return;
      }
      const u = await getUsuarioByLogin(userParam);
      if (!u || !u.ativo) {
        setError("Usuário não encontrado ou inativo.");
        setLoading(false);
        return;
      }
      setUsuario(u);
      setLoading(false);
    };
    init();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </div>
    );
  }

  if (error || !usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-2">
          <p className="text-destructive font-bold text-lg">⚠️ Acesso Negado</p>
          <p className="text-muted-foreground text-sm">{error || "Usuário não autorizado."}</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-muted/30 p-4">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-foreground">📋 Resultado</h1>
              <span className="text-sm text-muted-foreground">Logado como: <strong>{usuario.nome}</strong></span>
            </div>
          </div>
          <ResultadoView
            candidatos={candidatos}
            resultadoLiberado={resultadoLiberado}
            setResultadoLiberado={setResultadoLiberado}
            setSelected={() => {}}
            onRefresh={refresh}
            canEditDecisions={true}
            currentUserName={usuario.nome}
            currentUserLogin={usuario.login}
            closedDates={closedDates}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
