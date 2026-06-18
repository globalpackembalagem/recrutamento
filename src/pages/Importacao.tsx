import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, Check, AlertTriangle, Download } from "lucide-react";
import * as db from "@/lib/supabaseData";
import type { Candidato, Setor } from "@/lib/supabaseData";
import { toast } from "sonner";
import { cn, formatDate, buildIndicacao } from "@/lib/utils";

interface PreviewRow {
  nome: string; cpf: string; funcao: string; setor: string; turno: string;
  dataIntegracao?: string; indicacao?: string; telefone?: string;
  dataNascimento?: string; sexo?: string; fretado?: string; pontoReferencia?: string;
  camisa?: string; calca?: string; sapato?: string; oculos?: string; email?: string;
  valid: boolean; sectorWarning?: boolean; error?: string;
}

export default function Importacao() {
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [imported, setImported] = useState(false);
  const [setores, setSetores] = useState<Setor[]>([]);

  useEffect(() => { db.getSetores().then(setSetores); }, []);

  const updateRow = (index: number, data: Partial<PreviewRow>) => {
    const updated = [...preview];
    updated[index] = { ...updated[index], ...data };
    setPreview(updated);
  };

  const normalizeExcelDate = (val: any): string => {
    if (!val) return "";
    if (val instanceof Date && !isNaN(val.getTime())) {
      const day = String(val.getDate()).padStart(2, "0");
      const month = String(val.getMonth() + 1).padStart(2, "0");
      const year = val.getFullYear();
      const fullYear = year < 100 ? 2000 + year : year;
      return `${fullYear}-${month}-${day}`;
    }
    const str = String(val).trim();
    if (str.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
      const parts = str.split("/");
      // Padrão BR: DD/MM/AAAA
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      let year = parts[2];
      if (year.length === 2) year = "20" + year;
      return `${year}-${month}-${day}`;
    }
    if (str.includes("-")) {
      const parts = str.split("-");
      if (parts.length === 3) {
        if (parts[0].length === 4) return str;
        let year = parts[2];
        if (year.length === 2) year = "20" + year;
        return `${year}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
    }
    return str;
  };

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImported(false);

    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array', cellDates: true });
      
      const parseSheet = (sheet: any): any[] => {
        const aoa = XLSX.utils.sheet_to_json(sheet, { defval: "", header: 1, blankrows: false }) as any[][];
        if (!aoa.length) return [];
        let headerIdx = -1;
        for (let i = 0; i < Math.min(aoa.length, 15); i++) {
          const cells = (aoa[i] || []).map((c: any) => String(c || "").trim().toUpperCase());
          if (cells.includes("NOME") && (cells.includes("CPF") || cells.includes("FUNÇÃO") || cells.includes("FUNCAO") || cells.includes("TURNO"))) {
            headerIdx = i; break;
          }
        }
        if (headerIdx === -1) return XLSX.utils.sheet_to_json(sheet, { defval: "" });
        const headers = (aoa[headerIdx] || []).map((c: any) => String(c || "").trim());
        const out: any[] = [];
        for (let i = headerIdx + 1; i < aoa.length; i++) {
          const row = aoa[i] || [];
          const obj: any = {};
          let hasData = false;
          headers.forEach((h: string, j: number) => {
            if (!h) return;
            const v = row[j];
            obj[h] = v === undefined ? "" : v;
            if (v !== "" && v !== undefined && v !== null) hasData = true;
          });
          if (hasData) out.push(obj);
        }
        return out;
      };

      let ws = wb.Sheets[wb.SheetNames[0]];
      let rows: any[] = parseSheet(ws);
      for (let i = 1; i < wb.SheetNames.length; i++) {
        const sheet = wb.Sheets[wb.SheetNames[i]];
        const sheetRows = parseSheet(sheet);
        if (sheetRows.length > rows.length) { ws = sheet; rows = sheetRows; }
      }

      if (rows.length > 0) {
        const keys = Object.keys(rows[0]);
        if (keys.length === 1 && keys[0].includes(';')) {
          const raw = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false, header: 1 }) as any[][];
          const actualHeaders = (raw[0]?.[0] || "").toString().split(';');
          rows = raw.slice(1).map(row => {
            const obj: any = {};
            const values = (row[0] || "").toString().split(';');
            actualHeaders.forEach((h: string, i: number) => { obj[h] = values[i] || ""; });
            return obj;
          });
        }
      }

      if (rows.length === 0) { toast.error("Nenhuma linha encontrada."); return; }

      const currentSetores = await db.getSetores();
      const availableSetores = currentSetores.map(s => s.nome.toUpperCase());

      const parsed: PreviewRow[] = rows.map((row) => {
        const getVal = (keys: string[]) => {
          for (const k of keys) {
            if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k] instanceof Date ? row[k] : row[k].toString().trim();
          }
          const rowKeys = Object.keys(row);
          for (const k of rowKeys) {
            const cleanK = k.replace(/[";]/g, '').trim().toLowerCase();
            for (const searchKey of keys) {
              if (cleanK === searchKey.toLowerCase() || cleanK.includes(searchKey.toLowerCase())) return row[k] instanceof Date ? row[k] : row[k].toString().trim();
            }
          }
          return "";
        };

        const nome = String(getVal(["Nome", "nome", "NOME", "Nome Completo", "Candidato"]) || "");
        const cpf = String(getVal(["CPF", "cpf", "Cpf", "Documento"]) || "");
        const funcao = String(getVal(["Função", "funcao", "FUNÇÃO", "Cargo", "CARGO"]) || "");
        const turno = String(getVal(["Turno", "turno", "TURNO"]) || "");
        let setor = String(getVal(["Setor", "setor", "SETOR", "Área", "Area"]) || "");
        if (!setor && turno) setor = turno;
        const rawDate = getVal(["QTDE", "Data Integração", "Data Integracao", "dataIntegracao", "Data", "DATA", "Data de Integração"]);
        const dataIntegracao = normalizeExcelDate(rawDate);
        const rawIndicacao = String(getVal(["Indicação", "Indicacao", "indicacao", "INDICAÇÃO"]) || "").trim();
        const indicacao = rawIndicacao ? buildIndicacao("agencia", rawIndicacao) : buildIndicacao("direto", "");
        const telefone = String(getVal(["Telefone", "telefone", "TELEFONE", "Celular", "TEL", "CEL"]) || "");
        const rawNascimento = getVal(["Data Nascimento", "Data de Nascimento", "Nascimento", "DATA DE NASCIMENTO"]);
        const dataNascimento = normalizeExcelDate(rawNascimento);
        const sexo = String(getVal(["Sexo", "sexo", "SEXO", "Gênero"]) || "");
        const fretado = String(getVal(["Fretado", "fretado", "Transporte", "Residência", "RESIDÊNCIA"]) || "");
        const pontoReferencia = String(getVal(["Ponto de Referência", "Ponto de Referencia", "PONTO DE REFERÊNCIA", "Endereço"]) || "");
        const camisa = String(getVal(["Camisa", "camisa", "CAMISA"]) || "");
        const calca = String(getVal(["Calça", "Calca", "CALÇA", "calca"]) || "");
        const sapato = String(getVal(["Sapato", "sapato", "SAPATO"]) || "");
        const oculos = String(getVal(["Óculos", "Oculos", "OCULOS", "ÓCULOS"]) || "");
        const email = String(getVal(["E-mail", "Email", "email", "EMAIL", "E-MAIL"]) || "");

        const sectorWarning = setor ? !availableSetores.includes(setor.toUpperCase()) : false;

        return {
          nome, cpf, funcao, setor, turno, dataIntegracao, indicacao, telefone,
          dataNascimento, sexo, fretado, pontoReferencia, camisa, calca, sapato, oculos, email,
          valid: true, sectorWarning, error: "",
        };
      });

      setPreview(parsed);
      toast.success(`${parsed.length} linhas carregadas do arquivo.`);
    } catch (error) {
      console.error("Erro ao importar:", error);
      toast.error("Erro ao ler o arquivo.");
    }
  }, []);

  const handleImport = async () => {
    const validos = preview.filter((r) => r.valid);
    if (validos.length === 0) { toast.error("Nenhum registro para importar."); return; }

    const currentSetores = await db.getSetores();
    const availableSetores = currentSetores.map(s => s.nome.toUpperCase());

    for (const v of validos) {
      if (v.setor && !availableSetores.includes(v.setor.toUpperCase())) {
        await db.addSetor(v.setor);
        availableSetores.push(v.setor.toUpperCase());
      }
    }

    const novos: Omit<Candidato, "id">[] = validos.map((r) => ({
      nome: r.nome || "SEM NOME", cpf: r.cpf, funcao: r.funcao, setor: r.setor || "Não informado",
      dataIntegracao: r.dataIntegracao, indicacao: r.indicacao, telefone: r.telefone,
      dataNascimento: r.dataNascimento, sexo: r.sexo, fretado: r.fretado,
      pontoReferencia: r.pontoReferencia, camisa: r.camisa, calca: r.calca, sapato: r.sapato,
      oculos: r.oculos, email: r.email, status: "aguardando_presenca",
      dataImportacao: new Date().toISOString().split("T")[0], turno: r.turno || "Manhã",
    }));

    await db.addCandidatos(novos);

    // Nova importação = novo lote operacional. Limpa bloqueios residuais
    // (PORTARIA_BLOCK e ALTERACOES_BLOQUEADAS) para que a Portaria possa operar.
    try {
      await db.desbloquearPortaria();
      await db.desbloquearAlteracoes();
    } catch (err) {
      console.warn("Não foi possível limpar bloqueios após importação:", err);
    }

    setImported(true);
    toast.success(`${novos.length} candidatos importados com sucesso!`);
  };

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const XLSX = await import("xlsx");
      const templateData = [{
        "Data Integração": "26/03/2026", "Nome": "JOÃO SILVA", "Setor": "PRODUÇÃO",
        "Função": "OPERADOR DE PRODUÇÃO", "Telefone": "(11) 98888-7777", "CPF": "123.456.789-00",
        "Data Nascimento": "15/05/1990", "Sexo": "M", "Indicação": "N", "Fretado": "SIM",
        "Ponto de Referência": "PERTO DO MERCADO", "Camisa": "G", "Calça": "42",
        "Sapato": "41", "Óculos": "NÃO", "E-mail": "joao.silva@email.com"
      }];
      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Candidatos");
      XLSX.writeFile(wb, "modelo_importacao_candidatos.xlsx");
      toast.success("Modelo baixado!");
    } catch { toast.error("Erro ao gerar o modelo."); }
  }, []);

  const validCount = preview.filter((r) => r.valid).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
           <CardTitle className="flex items-center gap-2 text-lg">
             <Upload className="h-5 w-5 text-primary" /> Importar Planilha Excel
           </CardTitle>
         </CardHeader>
         <CardContent className="space-y-4">
           <p className="text-sm text-muted-foreground">Selecione um arquivo Excel (.xlsx / .xls) com as colunas do modelo.</p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <input type="file" accept=".xlsx,.xls,.csv" id="file-upload" className="sr-only" onChange={handleFile} />
              <Button asChild variant="outline" className="cursor-pointer gap-2 h-10 border-primary text-primary hover:bg-primary/10">
                <label htmlFor="file-upload" className="cursor-pointer flex items-center">
                  <FileSpreadsheet className="h-4 w-4" /> {fileName || "Escolher arquivo..."}
                </label>
              </Button>
            </div>
            <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2 h-10">
              <Download className="h-4 w-4" /> Baixar Modelo (.xlsx)
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
             <CardTitle className="flex items-center justify-between text-lg">
               <span>Prévia — {preview.length} registros</span>
               <span className="flex items-center gap-1 text-primary text-sm font-normal"><Check className="h-4 w-4" /> {validCount} prontos</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead className="text-xs font-bold whitespace-nowrap">DATA INT.</TableHead>
                     <TableHead className="text-xs font-bold">NOME</TableHead>
                     <TableHead className="text-xs font-bold">SETOR/TURNO</TableHead>
                     <TableHead className="text-xs font-bold">FUNÇÃO</TableHead>
                     <TableHead className="text-xs font-bold">TELEFONE</TableHead>
                     <TableHead className="text-xs font-bold">CPF</TableHead>
                     <TableHead className="text-xs font-bold whitespace-nowrap">DATA NASC.</TableHead>
                     <TableHead className="text-xs font-bold">SEXO</TableHead>
                     <TableHead className="text-xs font-bold">INDICAÇÃO</TableHead>
                     <TableHead className="text-xs font-bold">FRETADO</TableHead>
                     <TableHead className="text-xs font-bold whitespace-nowrap">PTO. REF.</TableHead>
                     <TableHead className="text-xs font-bold">CAMISA</TableHead>
                     <TableHead className="text-xs font-bold">CALÇA</TableHead>
                     <TableHead className="text-xs font-bold">SAPATO</TableHead>
                     <TableHead className="text-xs font-bold">ÓCULOS</TableHead>
                     <TableHead className="text-xs font-bold">E-MAIL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, i) => (
                    <TableRow key={i}>
                       <TableCell className="text-xs whitespace-nowrap py-3">{formatDate(row.dataIntegracao)}</TableCell>
                       <TableCell className="text-xs font-medium py-3">{row.nome || "—"}</TableCell>
                       <TableCell className="text-xs min-w-[120px] py-3">
                         <input type="text" value={row.setor || ""} onChange={(e) => updateRow(i, { setor: e.target.value })}
                           className={cn("text-xs w-full bg-transparent border-b border-transparent hover:border-muted-foreground/30 focus:border-primary outline-none uppercase", row.sectorWarning ? "text-amber-600 font-medium" : "")}
                           placeholder="Setor..." />
                         {row.sectorWarning && <span className="text-[9px] text-amber-500 flex items-center gap-0.5 mt-0.5"><AlertTriangle className="h-2.5 w-2.5" /> Novo setor</span>}
                       </TableCell>
                       <TableCell className="text-xs py-3">{row.funcao || "—"}</TableCell>
                       <TableCell className="text-xs py-3">{row.telefone || "—"}</TableCell>
                       <TableCell className="text-xs font-mono py-3">{row.cpf || "—"}</TableCell>
                       <TableCell className="text-xs whitespace-nowrap py-3">{formatDate(row.dataNascimento)}</TableCell>
                       <TableCell className="text-xs py-3">{row.sexo || "—"}</TableCell>
                       <TableCell className="text-xs py-3">{row.indicacao || "—"}</TableCell>
                       <TableCell className="text-xs py-3">{row.fretado || "—"}</TableCell>
                       <TableCell className="text-xs py-3 max-w-[120px] truncate">{row.pontoReferencia || "—"}</TableCell>
                       <TableCell className="text-xs py-3">{row.camisa || "—"}</TableCell>
                       <TableCell className="text-xs py-3">{row.calca || "—"}</TableCell>
                       <TableCell className="text-xs py-3">{row.sapato || "—"}</TableCell>
                       <TableCell className="text-xs py-3">{row.oculos || "—"}</TableCell>
                       <TableCell className="text-xs max-w-[150px] truncate py-3">{row.email || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex gap-3">
               <Button onClick={handleImport} disabled={imported || validCount === 0} className="h-10">
                 {imported ? "✓ Importado!" : `Importar ${validCount} candidatos`}
               </Button>
               {!imported && preview.length > 0 && (
                 <Button variant="outline" onClick={() => { if (window.confirm("Limpar todos os registros da prévia?")) { setPreview([]); setFileName(""); } }} className="h-10 text-destructive border-destructive/30 hover:bg-destructive/10">
                   <AlertTriangle className="h-4 w-4 mr-2" /> Limpar Prévia
                 </Button>
               )}
               {imported && <Button variant="outline" onClick={() => { setPreview([]); setFileName(""); setImported(false); }}>Nova importação</Button>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
