import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { statusLabels, type StatusEtapa } from "@/lib/supabaseData";
import * as db from "@/lib/supabaseData";
import type { Setor } from "@/lib/supabaseData";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  turnoFilter: string;
  onTurnoChange: (v: string) => void;
  setorFilter: string;
  onSetorChange: (v: string) => void;
}

export default function CandidatoFilters({
  search, onSearchChange, statusFilter, onStatusChange, turnoFilter, onTurnoChange,
  setorFilter, onSetorChange,
}: Props) {
  const [availableSetores, setAvailableSetores] = useState<Setor[]>([]);

  useEffect(() => {
    db.getSetores().then(setAvailableSetores);
  }, []);
  
  return (
    <div className="flex flex-wrap gap-3">
      <Input placeholder="BUSCAR POR NOME..." value={search} onChange={(e) => onSearchChange(e.target.value)} className="w-full sm:w-64 uppercase" />
      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Todos os status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os status</SelectItem>
          {Object.entries(statusLabels).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={turnoFilter} onValueChange={onTurnoChange}>
        <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Todos os turnos" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os turnos</SelectItem>
          <SelectItem value="Manhã">Manhã</SelectItem>
          <SelectItem value="Tarde">Tarde</SelectItem>
          <SelectItem value="Noite">Noite</SelectItem>
        </SelectContent>
      </Select>
      <Select value={setorFilter} onValueChange={onSetorChange}>
        <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Todos os setores" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os setores</SelectItem>
          {availableSetores.map((s) => <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
