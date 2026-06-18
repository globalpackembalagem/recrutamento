const Index = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-card p-8 shadow-lg text-center border">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Supabase Externo</h1>
        <p className="text-muted-foreground">
          Configure seu projeto Supabase externo pelas variáveis de ambiente.
        </p>
        <div className="rounded-lg border bg-background/60 p-4 text-left text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Variáveis obrigatórias</p>
          <p>VITE_SUPABASE_URL</p>
          <p>VITE_SUPABASE_ANON_KEY</p>
        </div>
        <p className="text-xs text-muted-foreground">
          A tela permanece disponível para futuras integrações quando você decidir.
        </p>
      </div>
    </div>

  );
};

export default Index;
