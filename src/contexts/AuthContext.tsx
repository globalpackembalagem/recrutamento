import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getUsuarioByLogin, autenticar, type Usuario } from '@/lib/usuarioData';
import { toast } from 'sonner';

interface AuthContextType {
  usuario: Usuario | null;
  usuarioReal: Usuario | null;
  loading: boolean;
  login: (loginStr: string, senha: string) => Promise<boolean>;
  logout: () => void;
  impersonar: (u: Usuario | null) => void;
  isImpersonando: boolean;
}

const AuthContext = createContext<AuthContextType>({
  usuario: null,
  usuarioReal: null,
  loading: true,
  login: async () => false,
  logout: () => {},
  impersonar: () => {},
  isImpersonando: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

async function getCurrentIp(): Promise<string> {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip || '';
  } catch (err) {
    console.error('Erro ao buscar IP:', err);
    return '';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuarioReal, setUsuarioReal] = useState<Usuario | null>(null);
  const [usuarioImpersonado, setUsuarioImpersonado] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  const usuario = usuarioImpersonado || usuarioReal;
  const isImpersonando = !!usuarioImpersonado;

  const checkIp = async (u: Usuario): Promise<boolean> => {
    if (!u.autorizadoIp) return true;
    
    // Suporte a múltiplos IPs separados por vírgula
    const authorizedIps = u.autorizadoIp.split(',').map(ip => ip.trim());
    const currentIp = await getCurrentIp();
    
    if (currentIp && !authorizedIps.includes(currentIp)) {
      toast.error(`Acesso negado: Seu IP (${currentIp}) não está na lista de IPs autorizados para este usuário.`);
      return false;
    }
    return true;
  };

  useEffect(() => {
    const init = async () => {
      const userParam = searchParams.get('user');
      if (userParam) {
        const u = await getUsuarioByLogin(userParam);
        if (u) {
          const ipOk = await checkIp(u);
          if (ipOk) {
            setUsuarioReal(u);
            sessionStorage.setItem('recrutamento_user', u.login);
          }
          setLoading(false);
          return;
        }
      }

      const saved = sessionStorage.getItem('recrutamento_user');
      if (saved) {
        const u = await getUsuarioByLogin(saved);
        if (u) {
          const ipOk = await checkIp(u);
          if (ipOk) {
            setUsuarioReal(u);
          } else {
            sessionStorage.removeItem('recrutamento_user');
          }
        } else {
          sessionStorage.removeItem('recrutamento_user');
        }
      }
      setLoading(false);
    };
    init();
  }, [searchParams]);

  const login = async (loginStr: string, senha: string): Promise<boolean> => {
    const u = await autenticar(loginStr, senha);
    if (u) {
      const ipOk = await checkIp(u);
      if (!ipOk) return false;
      
      setUsuarioReal(u);
      setUsuarioImpersonado(null);
      sessionStorage.setItem('recrutamento_user', u.login);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUsuarioReal(null);
    setUsuarioImpersonado(null);
    sessionStorage.removeItem('recrutamento_user');
  };

  const impersonar = (u: Usuario | null) => {
    setUsuarioImpersonado(u);
  };

  return (
    <AuthContext.Provider value={{ usuario, usuarioReal, loading, login, logout, impersonar, isImpersonando }}>
      {children}
    </AuthContext.Provider>
  );
}