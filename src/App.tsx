import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Importacao from "@/pages/Importacao";
import Portaria from "@/pages/Portaria";
import AreaMedica from "@/pages/AreaMedica";
import PainelAtendimento from "@/pages/PainelAtendimento";
import Especialistas from "@/pages/Especialistas";
import ResultadoDireto from "@/pages/ResultadoDireto";
import RevisarReprovados from "@/pages/RevisarReprovados";
import Agenda from "@/pages/Agenda";

import RH from "@/pages/RH";
import RealParceria from "@/pages/RealParceria";
import EntrevistaExterna from "@/pages/EntrevistaExterna";
import Compartilhamento from "@/pages/Compartilhamento";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { usuario, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </div>
    );
  }

  if (!usuario) {
    return <Login />;
  }

  const homeElement = usuario.perfil === "admin" || usuario.acessoDashboard || (usuario.login || "").toLowerCase() === "sonia"
    ? <Dashboard />
    : usuario.acessoPortaria
      ? <Navigate to="/portaria?view=integracao" replace />
      : usuario.acessoAtendimento
        ? <Navigate to="/atendimento" replace />
        : usuario.acessoRealParceria
          ? <Navigate to="/real-parceria?view=geral" replace />
          : usuario.acessoRH
            ? <Navigate to="/rh?view=resultado" replace />
            : usuario.acessoImportacao
              ? <Navigate to="/importacao" replace />
              : <Dashboard />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={homeElement} />
        <Route path="/importacao" element={<Importacao />} />
        <Route path="/portaria" element={<Portaria />} />
        <Route path="/atendimento" element={<AreaMedica />} />
        <Route path="/especialistas" element={<Especialistas />} />
        
        {/* Atendimento Diário */}
        <Route path="/agenda" element={usuario.perfil === "admin" || usuario.acessoDiario ? <Agenda /> : <Navigate to="/" replace />} />
        <Route path="/atendimento-diario/atendimento" element={usuario.perfil === "admin" || usuario.acessoDiario ? <AreaMedica /> : <Navigate to="/" replace />} />
        <Route path="/atendimento-diario/especialistas" element={usuario.perfil === "admin" || usuario.acessoDiario ? <Especialistas /> : <Navigate to="/" replace />} />
        <Route path="/atendimento-diario/resultado" element={usuario.perfil === "admin" || usuario.acessoDiario ? <AreaMedica /> : <Navigate to="/" replace />} />
        
        <Route path="/rh" element={<RH />} />
        <Route path="/real-parceria" element={<RealParceria />} />
        <Route path="/compartilhamento" element={<Compartilhamento />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes - no auth needed */}
            <Route path="/entrevista/:token" element={<EntrevistaExterna />} />
            <Route path="/painel" element={<PainelAtendimento />} />
            <Route path="/painel-diario" element={<PainelAtendimento />} />
            <Route path="/resultado" element={<ResultadoDireto />} />
            <Route path="/reprovados" element={<RevisarReprovados />} />
            {/* All other routes require auth */}
            <Route path="*" element={<AppRoutes />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
