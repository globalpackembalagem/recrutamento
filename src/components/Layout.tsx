import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Building2,
  ClipboardCheck,
  FileSearch,
  Users,
  Upload,
  LayoutDashboard,
  Menu,
  X,
  Handshake,
  LogOut,
  Stethoscope,
  ChevronDown,
  ChevronRight,
  Settings,
  Lock,
  Edit2,
  CalendarCheck,
  Rocket,
  ListChecks,
  Pin,
  PinOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  path: string;
  label: string;
  icon: any;
  moduleKey?: string;
  children?: { path: string; label: string; icon: any }[];
}

import { FileCheck, Activity, Monitor } from "lucide-react";
import * as db from "@/lib/supabaseData";

const navItems: NavItem[] = [
  { path: "/", label: "DASHBOARD", icon: LayoutDashboard, moduleKey: "dashboard" },
  {
    path: "/portaria", label: "INTEGRAÇÃO", icon: Building2, moduleKey: "portaria",
    children: [
      { path: "/importacao", label: "IMPORTAÇÃO", icon: Upload },
      { path: "/portaria?view=integracao", label: "PORTARIA", icon: ClipboardCheck },
      { path: "/portaria?view=admissao", label: "ADMISSÃO", icon: CalendarCheck },
      { path: "/atendimento", label: "ATENDIMENTO INTEGRAÇÃO", icon: Stethoscope },
      { path: "/especialistas", label: "ESPECIALISTAS", icon: Users },
      { path: "/atendimento?view=resultado", label: "RESULTADO", icon: ListChecks },
      { path: "/real-parceria?view=geral", label: "REAL PARCERIA", icon: Handshake },
      { path: "/painel", label: "PAINEL", icon: Monitor },
    ],
  },
  { 
    path: "/atendimento-diario", label: "ATENDIMENTO DIÁRIO", icon: Activity, moduleKey: "atendimento_diario",
    children: [
      { path: "/agenda", label: "AGENDA", icon: CalendarCheck },
      { path: "/atendimento-diario/atendimento", label: "ATENDIMENTO DIÁRIO", icon: Stethoscope },
      { path: "/atendimento-diario/especialistas", label: "ESPECIALISTAS", icon: Users },
      { path: "/painel-diario", label: "PAINEL DIÁRIO", icon: Monitor },
    ]
  },
  {
    path: "/rh", label: "RH", icon: Users, moduleKey: "rh",
    children: [
      { path: "/rh?view=resultado", label: "RESULTADO", icon: ListChecks },
      { path: "/rh?view=admissao", label: "ADMISSÃO", icon: CalendarCheck },
      { path: "/rh?view=fechamento", label: "FECHAMENTO", icon: Lock },
      { path: "/rh?view=configuracoes", label: "CONFIGURAÇÕES", icon: Settings },
    ],
  },
];

function userHasModuleAccess(usuario: any, moduleKey: string): boolean {
  if (!usuario) return false;
  if (usuario.perfil === 'admin') return true;

  const loginLower = (usuario.login || "").toLowerCase();
  if (loginLower === "sonia") return true;
  const isSilviaOrEspecialist = ["silvia", "silvana", "michelli", "michele"].includes(loginLower);

  switch (moduleKey) {
    case 'dashboard': return usuario.acessoDashboard;
    case 'importacao': return usuario.acessoImportacao;
    case 'portaria': return usuario.acessoPortaria || isSilviaOrEspecialist;
    case 'atendimento_diario':
      return usuario.acessoDiario ?? false;
    case 'realParceria': return usuario.acessoRealParceria;
    case 'rh': return usuario.acessoRH;
    default: return false;
  }
}

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { usuario, usuarioReal, logout, impersonar, isImpersonando } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(() => {
    const saved = localStorage.getItem("sidebar-pinned");
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    "/rh": location.pathname === "/rh",
    "/real-parceria": location.pathname === "/real-parceria",
    "/portaria": location.pathname === "/portaria",
  });
  const [authorizedUsers, setAuthorizedUsers] = useState<string[]>([]);

  useEffect(() => {
    const fetchConfig = async () => {
      const authUsers = await db.getDiarioAuthorizedUsers();
      setAuthorizedUsers(authUsers);
    };
    fetchConfig();

    const unsub = db.subscribeToClosedDates(() => {
      fetchConfig();
    });
    return unsub;
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar-pinned", JSON.stringify(isPinned));
  }, [isPinned]);

  const toggleMenu = (path: string) => {
    setExpandedMenus(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const currentFullPath = location.pathname + location.search;

  const filteredNavItems = navItems.filter(item => {
    if (item.moduleKey) {
      return userHasModuleAccess(usuario, item.moduleKey);
    }
    return true;
  });

  return (
    <div className="flex min-h-screen bg-muted/30">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out",
          isPinned ? "lg:static lg:translate-x-0" : "lg:fixed lg:-translate-x-full lg:hover:translate-x-0 lg:z-50 shadow-xl lg:shadow-none lg:hover:shadow-2xl",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4 shrink-0">
          <img src="/logo.png" alt="Logo" className="h-8 w-8 object-contain" />
          <span className="text-base font-bold text-sidebar-foreground">Recrutamento</span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="ml-auto hidden lg:flex h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground" 
            onClick={() => setIsPinned(!isPinned)}
            title={isPinned ? "Desafixar menu" : "Fixar menu"}
          >
            {isPinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path;

            if (item.children) {
              return (
                <div key={item.path}>
                  <button
                    onClick={() => toggleMenu(item.path)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition-colors w-full",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                    <span className="ml-auto">
                      {expandedMenus[item.path] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                  </button>
                  {expandedMenus[item.path] && (
                    <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-sidebar-border pl-2">
                      {item.children
                        .filter((sub) => {
                          // Real Parceria: non-admin/non-RH users only see Geral
                          if (item.path === "/real-parceria" && usuario && usuario.perfil !== "admin" && !usuario.acessoRH) {
                            return sub.path === "/real-parceria?view=geral";
                          }
                          return true;
                        })
                        .map((sub) => {
                        const subActive = currentFullPath === sub.path || 
                          (sub.path === `${item.path}?view=geral` && location.pathname === item.path && !location.search);
                        return (
                          <Link
                            key={sub.path}
                            to={sub.path}
                            onClick={() => setSidebarOpen(false)}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-3 py-2 text-[10px] font-semibold transition-colors uppercase",
                              subActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                            )}
                          >
                            <sub.icon className="h-3.5 w-3.5" />
                            {sub.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        {isImpersonando && (
          <div className="bg-amber-500 text-white text-center py-1.5 px-4 text-xs font-bold flex items-center justify-center gap-3 z-50">
            <span>⚠ TESTANDO COMO: {usuario?.nome?.toUpperCase()}</span>
            <Button size="sm" variant="secondary" className="h-5 text-[10px] px-2 py-0" onClick={() => impersonar(null)}>
              VOLTAR PARA {usuarioReal?.nome?.toUpperCase()}
            </Button>
          </div>
        )}
        <header className="flex h-16 items-center gap-4 border-b bg-card/80 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-6">
          <Button variant="ghost" size="icon" className={cn("lg:hidden", !isPinned && "lg:flex")} onClick={() => { setSidebarOpen(true); if (!isPinned) setIsPinned(true); }}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h2 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-tight truncate">
              {(() => {
                const currentItem = navItems.flatMap(item => item.children ? [item, ...item.children] : [item])
                  .find(n => currentFullPath === n.path || location.pathname === n.path);
                return currentItem?.label ?? "Painel de Controle";
              })()}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest hidden sm:inline">
                {usuario?.nome || "Sistema"}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} className="h-7 text-xs text-muted-foreground">
              <LogOut className="h-3 w-3 mr-1" /> Sair
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="max-w-[1400px] mx-auto p-3 sm:p-4 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
