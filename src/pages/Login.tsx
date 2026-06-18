import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, LogIn, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const [loginInput, setLoginInput] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput.trim() || !senha.trim()) {
      toast.error("Preencha login e senha.");
      return;
    }
    setLoading(true);
    const ok = await login(loginInput.trim(), senha.trim());
    setLoading(false);
    if (!ok) toast.error("Login ou senha incorretos.");
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center space-y-2">
          <img src="/logo.png" alt="Logo" className="h-16 w-16 object-contain mx-auto" />
          <CardTitle className="text-lg">Recrutamento</CardTitle>
          <p className="text-xs text-muted-foreground">Faça login para acessar o sistema</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-xs">Login</Label>
              <Input
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                placeholder="Seu login"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs">Senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••"
                  className="pr-9"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full text-xs" disabled={loading}>
              <LogIn className="h-4 w-4 mr-1" />
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
