export type StatusEtapa =
  | "aguardando_presenca"
  | "aguardando_portaria"
  | "presente"
  | "ausente"
  | "na_fila_atendimento"
  | "em_atendimento"
  | "atendido"
  | "em_analise"
  | "aprovado"
  | "reprovado"
  | "rh_pendente"
  | "rh_concluido"
  | "aguardando_doc"
  | "aguardando_rh_global"
  | "doc_ok"
  | "falta_doc"
  | "aguardando"
  | "data_inicio_definida"
  | "iniciado"
  | "finalizado";

export interface Candidato {
  id: string;
  nome: string;
  cpf: string;
  funcao: string;
  setor: string;
  turno: string;
  status: StatusEtapa;
  dataImportacao: string;
  dataPresenca?: string;
  horaPresenca?: string;
  motivoReprovacao?: string;
  dataInicio?: string;
  observacoes?: string;
  dataIntegracao?: string;
  indicacao?: string;
  telefone?: string;
  porque?: string;
  dataNascimento?: string;
  sexo?: string;
  fretado?: string;
  pontoReferencia?: string;
  camisa?: string;
  calca?: string;
  sapato?: string;
  oculos?: string;
  email?: string;
}

export interface Setor {
  id: string;
  nome: string;
}


export interface HistoricoEntry {
  id: string;
  candidatoId: string;
  usuario: string;
  data: string;
  hora: string;
  statusAnterior: StatusEtapa;
  novoStatus: StatusEtapa;
  observacao: string;
}

export const statusLabels: Record<StatusEtapa, string> = {
  aguardando_presenca: "AGUARDANDO PRESENÇA",
  aguardando_portaria: "NÃO COMPARECEU",
  presente: "PRESENTE NA INTEGRAÇÃO",
  ausente: "AUSENTE",
  na_fila_atendimento: "NA FILA",
  em_atendimento: "EM ATENDIMENTO",
  atendido: "ATENDIDO",
  em_analise: "EM ANÁLISE",
  aprovado: "APROVADO",
  reprovado: "REPROVADO",
  rh_pendente: "RH PENDENTE",
  rh_concluido: "RH CONCLUÍDO",
  aguardando_doc: "AGUARDANDO DOC",
  aguardando_rh_global: "AGUARDANDO RH GLOBAL",
  doc_ok: "DOC OK",
  falta_doc: "FALTA DE DOC",
  aguardando: "AGUARDANDO",
  data_inicio_definida: "DATA DE INÍCIO DEFINIDA",
  iniciado: "INICIOU",
  finalizado: "FINALIZADO",
};

export const statusColors: Record<StatusEtapa, string> = {
  aguardando_presenca: "bg-amber-100 text-amber-800 border-amber-300",
  aguardando_portaria: "bg-slate-100 text-slate-700 border-slate-200",
  presente: "bg-blue-50 text-blue-700 border-blue-200",
  ausente: "bg-red-50 text-red-700 border-red-200",
  na_fila_atendimento: "bg-blue-100 text-blue-800 border-blue-300",
  em_atendimento: "bg-purple-100 text-purple-800 border-purple-300",
  atendido: "bg-teal-100 text-teal-800 border-teal-300",
  em_analise: "bg-blue-100 text-blue-800 border-blue-300",
  aprovado: "bg-blue-600 text-white border-blue-700",
  reprovado: "bg-slate-800 text-white border-slate-900",
  rh_pendente: "bg-slate-100 text-slate-600 border-slate-200",
  rh_concluido: "bg-blue-900 text-white border-blue-950",
  aguardando_doc: "bg-slate-50 text-slate-500 border-slate-100",
  aguardando_rh_global: "bg-orange-50 text-orange-700 border-orange-200",
  doc_ok: "bg-green-50 text-green-700 border-green-200",
  falta_doc: "bg-red-50 text-red-700 border-red-200",
  aguardando: "bg-slate-100 text-slate-700 border-slate-200",
  data_inicio_definida: "bg-blue-500 text-white border-blue-600",
  iniciado: "bg-green-600 text-white border-green-700",
  finalizado: "bg-slate-900 text-white border-black",
};

const generateMockCandidatos = (): Candidato[] => {
  return [
    {
      id: "1",
      nome: "JOÃO SILVA",
      cpf: "123.456.789-00",
      funcao: "OPERADOR DE PRODUÇÃO",
      setor: "PRODUÇÃO",
      turno: "TURNO A",
      status: "aguardando_portaria",
      dataImportacao: new Date().toISOString().split("T")[0],
      dataIntegracao: new Date().toISOString().split("T")[0],
    },
    {
      id: "2",
      nome: "MARIA OLIVEIRA",
      cpf: "234.567.890-11",
      funcao: "AUXILIAR DE LOGÍSTICA",
      setor: "LOGÍSTICA",
      turno: "TURNO B",
      status: "presente",
      dataImportacao: new Date().toISOString().split("T")[0],
      dataIntegracao: new Date().toISOString().split("T")[0],
    },
    {
      id: "3",
      nome: "CARLOS SOUZA",
      cpf: "345.678.901-22",
      funcao: "MECÂNICO DE MANUTENÇÃO",
      setor: "MANUTENÇÃO",
      turno: "TURNO C",
      status: "em_analise",
      dataImportacao: new Date().toISOString().split("T")[0],
      dataIntegracao: new Date().toISOString().split("T")[0],
    },
    {
      id: "4",
      nome: "ANA COSTA",
      cpf: "456.789.012-33",
      funcao: "ASSISTENTE ADMINISTRATIVO",
      setor: "ADMINISTRATIVO",
      turno: "TURNO A",
      status: "aprovado",
      dataImportacao: new Date().toISOString().split("T")[0],
      dataIntegracao: new Date().toISOString().split("T")[0],
    },
    {
      id: "5",
      nome: "PEDRO SANTOS",
      cpf: "567.890.123-44",
      funcao: "INSPETOR DE QUALIDADE",
      setor: "QUALIDADE",
      turno: "TURNO B",
      status: "rh_pendente",
      dataImportacao: new Date().toISOString().split("T")[0],
      dataIntegracao: new Date().toISOString().split("T")[0],
    },
    {
      id: "6",
      nome: "FERNANDA LIMA",
      cpf: "678.901.234-55",
      funcao: "OPERADOR DE EMPILHADEIRA",
      setor: "LOGÍSTICA",
      turno: "TURNO C",
      status: "finalizado",
      dataImportacao: new Date().toISOString().split("T")[0],
      dataIntegracao: new Date(Date.now() - 86400000).toISOString().split("T")[0], // Ontem
    }
  ];
};

const mockCandidatos: Candidato[] = generateMockCandidatos();


const mockHistorico: HistoricoEntry[] = [];

// In-memory store with localStorage persistence
const STORAGE_KEY = 'candidatos_data';
const HISTORY_KEY = 'historico_data';
const SECTORS_KEY = 'setores_data';
const CLOSED_DATES_KEY = 'closed_dates_data';

const loadFromStorage = (key: string, defaultValue: any) => {
  const stored = localStorage.getItem(key);
  if (!stored) return defaultValue;
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error(`Error loading ${key} from storage:`, e);
    return defaultValue;
  }
};

const saveToStorage = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

let candidatos: Candidato[] = loadFromStorage(STORAGE_KEY, []);
if (candidatos.length === 0 && mockCandidatos.length > 0) {
  candidatos = [...mockCandidatos];
  saveToStorage(STORAGE_KEY, candidatos);
}
let historico: HistoricoEntry[] = loadFromStorage(HISTORY_KEY, []);
let closedDates: string[] = loadFromStorage(CLOSED_DATES_KEY, []);
let setores: Setor[] = loadFromStorage(SECTORS_KEY, [
  { id: "s1", nome: "PRODUÇÃO" },
  { id: "s2", nome: "LOGÍSTICA" },
  { id: "s3", nome: "MANUTENÇÃO" },
  { id: "s4", nome: "ADMINISTRATIVO" },
  { id: "s5", nome: "QUALIDADE" },
]);

export const resetData = () => {
  candidatos = [...mockCandidatos];
  historico = [];
  closedDates = [];
  saveToStorage(STORAGE_KEY, candidatos);
  saveToStorage(HISTORY_KEY, historico);
  saveToStorage(CLOSED_DATES_KEY, closedDates);
};

export const getSetores = () => [...setores];

export const clearSetores = () => {
  setores = [];
  saveToStorage(SECTORS_KEY, setores);
};

export const addSetor = (nome: string) => {
  const newSetor = { id: `s${Date.now()}`, nome: nome.toUpperCase() };
  setores.push(newSetor);
  saveToStorage(SECTORS_KEY, setores);
  return newSetor;
};

export const updateSetor = (id: string, nome: string) => {
  const idx = setores.findIndex(s => s.id === id);
  if (idx >= 0) {
    setores[idx].nome = nome.toUpperCase();
    saveToStorage(SECTORS_KEY, setores);
  }
};

export const deleteSetor = (id: string) => {
  setores = setores.filter(s => s.id !== id);
  saveToStorage(SECTORS_KEY, setores);
};

export const getCandidatos = (includeClosed = false) => {
  if (includeClosed) return [...candidatos];
  return candidatos.filter(c => !c.dataIntegracao || !closedDates.includes(c.dataIntegracao));
};

export const getClosedDates = () => [...closedDates];

export const closeDate = (date: string) => {
  if (!closedDates.includes(date)) {
    closedDates.push(date);
    saveToStorage(CLOSED_DATES_KEY, closedDates);
  }
};

export const openDate = (date: string) => {
  closedDates = closedDates.filter(d => d !== date);
  saveToStorage(CLOSED_DATES_KEY, closedDates);
};

export const getHistorico = (candidatoId?: string) =>
  candidatoId ? historico.filter((h) => h.candidatoId === candidatoId) : [...historico];

export const updateCandidatoStatus = (
  id: string,
  novoStatus: StatusEtapa,
  usuario: string,
  observacao: string
) => {
  const candidato = candidatos.find((c) => c.id === id);
  if (!candidato) return;

  if (novoStatus === "presente" || novoStatus === "finalizado") {
    candidato.dataPresenca = new Date().toISOString().split("T")[0];
    candidato.horaPresenca = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  const entry: HistoricoEntry = {
    id: `h${Date.now()}`,
    candidatoId: id,
    usuario,
    data: new Date().toISOString().split("T")[0],
    hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    statusAnterior: candidato.status,
    novoStatus,
    observacao,
  };
  historico.push(entry);
  candidato.status = novoStatus;
  
  saveToStorage(STORAGE_KEY, candidatos);
  saveToStorage(HISTORY_KEY, historico);
};

export const updateCandidato = (id: string, data: Partial<Candidato>) => {
  const idx = candidatos.findIndex((c) => c.id === id);
  if (idx >= 0) {
    candidatos[idx] = { ...candidatos[idx], ...data };
    saveToStorage(STORAGE_KEY, candidatos);
  }
};

export const deleteCandidato = (id: string) => {
  candidatos = candidatos.filter((c) => c.id !== id);
  saveToStorage(STORAGE_KEY, candidatos);
};

export const addCandidatos = (novos: Omit<Candidato, "id">[]) => {
  const newOnes = novos.map((c, i) => ({ ...c, id: `imp${Date.now()}_${i}` }));
  candidatos = [...candidatos, ...newOnes];
  saveToStorage(STORAGE_KEY, candidatos);
  return newOnes;
};

export const addCandidato = (novo: Omit<Candidato, "id">) => {
  const newC = { ...novo, id: `man${Date.now()}` };
  candidatos = [...candidatos, newC];
  saveToStorage(STORAGE_KEY, candidatos);
  return newC;
};