import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { autenticar } from "@/lib/usuarioData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface PasswordGateProps {
  children: React.ReactNode;
}

export default function PasswordGate({ children }: PasswordGateProps) {
  const { usuario } = useAuth();
  const storageKey = `pg_auth_${usuario?.login || ""}`;
  const [authenticated, setAuthenticated] = useState(() => {
    try { return sessionStorage.getItem(storageKey) === "1"; } catch { return false; }
  });
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (authenticated) {
    return <>{children}</>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senha.trim() || !usuario) return;

    setLoading(true);
    const result = await autenticar(usuario.login, senha);
    setLoading(false);

    if (result) {
      setAuthenticated(true);
      try { sessionStorage.setItem(storageKey, "1"); } catch {}
      setSenha("");
    } else {
      toast.error("Senha incorreta. Tente novamente.");
      setSenha("");
    }
  };

  return (
    <div className="flex items-center justify-center py-20">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-lg font-bold uppercase">Confirmação de Acesso</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Digite sua senha para visualizar o Resultado
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Usuário</p>
              <p className="font-bold uppercase text-sm">{usuario?.nome}</p>
            </div>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Digite sua senha..."
                value={senha}
                onChange={e => setSenha(e.target.value)}
                autoFocus
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button type="submit" className="w-full font-bold" disabled={loading || !senha.trim()}>
              {loading ? "Verificando..." : "ACESSAR RESULTADO"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
