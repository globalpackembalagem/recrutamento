import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatusBadge from "@/components/StatusBadge";
import type { Candidato } from "@/lib/mockData";
import { formatDate } from "@/lib/utils";

interface Props {
  candidatos: Candidato[];
  onSelect: (c: Candidato) => void;
}

export default function CandidatoTable({ candidatos, onSelect }: Props) {
  if (candidatos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">Nenhum candidato encontrado</p>
        <p className="text-sm">Ajuste os filtros ou importe novos candidatos.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>DATA INT.</TableHead>
            <TableHead>NOME</TableHead>
            <TableHead className="hidden md:table-cell">FUNÇÃO</TableHead>
            <TableHead className="hidden md:table-cell">SETOR</TableHead>
            <TableHead>STATUS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidatos.map((c) => (
            <TableRow
              key={c.id}
              className="cursor-pointer"
              onClick={() => onSelect(c)}
            >
              <TableCell className="font-medium">{formatDate(c.dataIntegracao)}</TableCell>
              <TableCell className="font-medium">{c.nome}</TableCell>
              <TableCell className="hidden md:table-cell">{c.funcao}</TableCell>
              <TableCell className="hidden md:table-cell">{c.setor}</TableCell>
              <TableCell><StatusBadge status={c.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
