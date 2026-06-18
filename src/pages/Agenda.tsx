import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarIcon, UserPlus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MultiSelect } from "react-multi-select-component";

interface Agendamento {
  id: string;
  data: Date;
  colaborador: string;
  especialidades: string[];
}

const options = [
  { label: "ENFERMAGEM", value: "ENFERMAGEM" },
  { label: "MÉDICO", value: "MÉDICO" },
  { label: "FONO", value: "FONO" },
  { label: "PSICOLOGA", value: "PSICOLOGA" },
];

export default function Agenda() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [date, setDate] = useState<Date>(new Date());
  const [colaborador, setColaborador] = useState("");
  const [selectedSpecs, setSelectedSpecs] = useState<any[]>([]);

  const handleAdd = () => {
    if (!colaborador || selectedSpecs.length === 0 || !date) {
      toast.error("Preencha todos os campos");
      return;
    }
    const novo: Agendamento = {
      id: Math.random().toString(36).substring(7),
      data: date,
      colaborador: colaborador.toUpperCase(),
      especialidades: selectedSpecs.map(s => s.value),
    };
    
    // Salvar no localStorage para que outras telas vejam (exemplo simplificado)
    const current = JSON.parse(localStorage.getItem("agenda_diaria") || "[]");
    localStorage.setItem("agenda_diaria", JSON.stringify([novo, ...current]));
    window.dispatchEvent(new CustomEvent("agenda-updated"));

    setAgendamentos([novo, ...agendamentos]);
    setColaborador("");
    setSelectedSpecs([]);
    toast.success("Agendamento realizado!");
  };

  const handleRemove = (id: string) => {
    setAgendamentos(agendamentos.filter(a => a.id !== id));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold uppercase tracking-tight">Agenda de Atendimentos</h1>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">NOVO AGENDAMENTO</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4 items-end">
          <div className="space-y-2">
            <Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-2">
            <Label>Nome do Colaborador</Label>
            <Input 
              value={colaborador} 
              onChange={e => setColaborador(e.target.value)} 
              placeholder="NOME COMPLETO"
              className="uppercase"
            />
          </div>

          <div className="space-y-2">
            <Label>Especialidades</Label>
            <MultiSelect
              options={options}
              value={selectedSpecs}
              onChange={setSelectedSpecs}
              labelledBy="Selecione..."
              overrideStrings={{
                selectSomeItems: "Selecione...",
                allItemsAreSelected: "Todas selecionadas",
                selectAll: "Selecionar todas",
                search: "Buscar...",
              }}
              className="text-xs"
            />
          </div>

          <Button onClick={handleAdd} className="gap-2">
            <UserPlus className="h-4 w-4" /> AGENDAR
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {agendamentos.map((a) => (
          <Card key={a.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex gap-4 items-center">
                <div className="bg-primary/10 p-2 rounded text-primary">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-sm uppercase">{a.colaborador}</p>
                  <p className="text-xs text-muted-foreground uppercase">
                    {format(a.data, "dd/MM/yyyy")} • {a.especialidades.join(", ")}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleRemove(a.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {agendamentos.length === 0 && (
          <p className="text-center py-10 text-muted-foreground italic">Nenhum agendamento para exibir.</p>
        )}
      </div>
    </div>
  );
}