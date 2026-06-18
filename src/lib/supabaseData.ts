import { supabase } from './supabase';
import { isSameDateKey, normalizeDateKey } from './utils';

export type StatusEtapa =
  | "aguardando_presenca"
  | "presente"
  | "ausente"
  | "na_fila_atendimento"
  | "em_atendimento"
  | "atendido"
  | "finalizado"
  // Legacy statuses kept for compatibility
  | "aguardando_portaria"
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
  | "iniciado";

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
  presente: "PRESENTE",
  ausente: "AUSENTE",
  na_fila_atendimento: "NA FILA",
  em_atendimento: "EM ATENDIMENTO",
  atendido: "ATENDIDO",
  finalizado: "FINALIZADO",
  aguardando_portaria: "AGUARDANDO PRESENÇA",
  em_analise: "EM ANÁLISE",
  aprovado: "APROVADO",
  reprovado: "REPROVADO",
  rh_pendente: "RH PENDENTE",
  rh_concluido: "RH CONCLUÍDO",
  aguardando_doc: "AGUARDANDO DOC",
  aguardando_rh_global: "AGUARDANDO RH GLOBAL",
  doc_ok: "DOC OK",
  falta_doc: "FALTA DOC",
  aguardando: "AGUARDANDO",
  data_inicio_definida: "DATA INÍCIO DEFINIDA",
  iniciado: "INICIOU",
};

export const statusColors: Record<StatusEtapa, string> = {
  aguardando_presenca: "bg-amber-100 text-amber-800 border-amber-300",
  presente: "bg-green-100 text-green-800 border-green-300",
  ausente: "bg-red-100 text-red-800 border-red-300",
  na_fila_atendimento: "bg-blue-100 text-blue-800 border-blue-300",
  em_atendimento: "bg-purple-100 text-purple-800 border-purple-300",
  atendido: "bg-teal-100 text-teal-800 border-teal-300",
  finalizado: "bg-slate-800 text-white border-slate-900",
  aguardando_portaria: "bg-amber-100 text-amber-800 border-amber-300",
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
};

function dbToCandidato(row: any): Candidato {
  return {
    id: row.id,
    nome: row.nome || "",
    cpf: row.cpf || "",
    funcao: row.funcao || "",
    setor: row.setor || "",
    turno: row.turno || "",
    status: row.status || "aguardando_presenca",
    dataImportacao: row.data_importacao || "",
    dataPresenca: row.data_presenca || undefined,
    horaPresenca: row.hora_presenca || undefined,
    motivoReprovacao: row.motivo_reprovacao || undefined,
    dataInicio: row.data_inicio || undefined,
    observacoes: row.observacoes || undefined,
    dataIntegracao: row.data_integracao || undefined,
    indicacao: row.indicacao || undefined,
    telefone: row.telefone || undefined,
    porque: row.porque || undefined,
    dataNascimento: row.data_nascimento || undefined,
    sexo: row.sexo || undefined,
    fretado: row.fretado || undefined,
    pontoReferencia: row.ponto_referencia || undefined,
    camisa: row.camisa || undefined,
    calca: row.calca || undefined,
    sapato: row.sapato || undefined,
    oculos: row.oculos || undefined,
    email: row.email || undefined,
  };
}

function candidatoToDb(c: Partial<Candidato>): Record<string, any> {
  const map: Record<string, any> = {};
  if (c.nome !== undefined) map.nome = c.nome;
  if (c.cpf !== undefined) map.cpf = c.cpf;
  if (c.funcao !== undefined) map.funcao = c.funcao;
  if (c.setor !== undefined) map.setor = c.setor;
  if (c.turno !== undefined) map.turno = c.turno;
  if (c.status !== undefined) map.status = c.status;
  if (c.dataImportacao !== undefined) map.data_importacao = c.dataImportacao;
  if (c.dataPresenca !== undefined) map.data_presenca = c.dataPresenca;
  if (c.horaPresenca !== undefined) map.hora_presenca = c.horaPresenca;
  if (c.motivoReprovacao !== undefined) map.motivo_reprovacao = c.motivoReprovacao;
  if (c.dataInicio !== undefined) map.data_inicio = c.dataInicio;
  if (c.observacoes !== undefined) map.observacoes = c.observacoes;
  if (c.dataIntegracao !== undefined) map.data_integracao = c.dataIntegracao;
  if (c.indicacao !== undefined) map.indicacao = c.indicacao;
  if (c.telefone !== undefined) map.telefone = c.telefone;
  if (c.porque !== undefined) map.porque = c.porque;
  if (c.dataNascimento !== undefined) map.data_nascimento = c.dataNascimento;
  if (c.sexo !== undefined) map.sexo = c.sexo;
  if (c.fretado !== undefined) map.fretado = c.fretado;
  if (c.pontoReferencia !== undefined) map.ponto_referencia = c.pontoReferencia;
  if (c.camisa !== undefined) map.camisa = c.camisa;
  if (c.calca !== undefined) map.calca = c.calca;
  if (c.sapato !== undefined) map.sapato = c.sapato;
  if (c.oculos !== undefined) map.oculos = c.oculos;
  if (c.email !== undefined) map.email = c.email;
  return map;
}

export async function getSetores(): Promise<Setor[]> {
  const { data, error } = await supabase.from('setores').select('*').order('nome');
  if (error) { console.error('getSetores error:', error); return []; }
  return (data || []).map(r => ({ id: r.id, nome: r.nome }));
}

export async function addSetor(nome: string): Promise<Setor | null> {
  const { data, error } = await supabase.from('setores').insert({ nome: nome.toUpperCase() }).select().single();
  if (error) { console.error('addSetor error:', error); return null; }
  return { id: data.id, nome: data.nome };
}

export async function deleteSetor(id: string): Promise<void> {
  await supabase.from('setores').delete().eq('id', id);
}

export async function updateSetor(id: string, nome: string): Promise<void> {
  await supabase.from('setores').update({ nome }).eq('id', id);
}

export async function clearSetores(): Promise<void> {
  await supabase.from('setores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

export async function getClosedDates(): Promise<string[]> {
  const { data } = await supabase.from('closed_dates').select('date');
  return (data || []).map(r => normalizeDateKey(r.date));
}

export async function closeDate(date: string): Promise<void> {
  await supabase.from('closed_dates').upsert({ date: normalizeDateKey(date) }, { onConflict: 'date' }).select();
  closedDatesCache = null;
}

function getDateVariants(date: string): string[] {
  const normalized = normalizeDateKey(date);
  const variants = new Set([date, normalized]);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split('-');
    variants.add(`${day}/${month}/${year}`);
  }
  return [...variants].filter(Boolean);
}

export async function closeIntegrationDate(date: string, usuario: string): Promise<number> {
  await closeDate(date);
  const normalized = normalizeDateKey(date);
  // Buscar TODOS candidatos não-finalizados e filtrar localmente pela data normalizada
  // (cobre formatos como YYYY-MM-DD, DD/MM/YYYY e timestamps com hora)
  const { data, error } = await supabase
    .from('candidatos')
    .select('id,status,data_integracao')
    .neq('status', 'finalizado');
  if (error) { console.error('closeIntegrationDate select error:', error); throw error; }
  const matches = (data || []).filter(row => isSameDateKey(row.data_integracao, normalized));
  if (matches.length === 0) return 0;

  const ids = matches.map(row => row.id);
  const { error: updateError } = await supabase.from('candidatos').update({ status: 'finalizado' }).in('id', ids);
  if (updateError) { console.error('closeIntegrationDate update error:', updateError); throw updateError; }

  const nowDate = new Date().toISOString().split("T")[0];
  const nowTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  await supabase.from('historico').insert(matches.map(row => ({
    candidato_id: row.id,
    usuario,
    data: nowDate,
    hora: nowTime,
    status_anterior: row.status,
    novo_status: 'finalizado',
    observacao: `Fechamento da integração ${date}`,
  })));
  return ids.length;
}

export async function reinforceClosedIntegrationDates(usuario: string): Promise<number> {
  const closed = (await getClosedDates()).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date));
  let total = 0;
  for (const date of closed) {
    total += await closeIntegrationDate(date, usuario);
  }
  return total;
}

export async function openDate(date: string): Promise<void> {
  const normalizedDate = normalizeDateKey(date);
  await supabase.from('closed_dates').delete().in('date', [date, normalizedDate]);
  closedDatesCache = null;
}

export async function isPortariaBloqueada(): Promise<boolean> {
  const { data } = await supabase.from('closed_dates').select('date').eq('date', 'PORTARIA_BLOCK');
  return (data || []).length > 0;
}

export async function bloquearPortaria(): Promise<void> {
  await supabase.from('closed_dates').upsert({ date: 'PORTARIA_BLOCK' }, { onConflict: 'date' });
}

export async function desbloquearPortaria(): Promise<void> {
  await supabase.from('closed_dates').delete().eq('date', 'PORTARIA_BLOCK');
}

export async function isResultadoLiberado(): Promise<boolean> {
  const { data } = await supabase.from('closed_dates').select('date').eq('date', 'RESULTADO_LIBERADO');
  return (data || []).length > 0;
}

export async function liberarResultado(): Promise<void> {
  await supabase.from('closed_dates').upsert({ date: 'RESULTADO_LIBERADO' }, { onConflict: 'date' });
}

export async function bloquearResultado(): Promise<void> {
  await supabase.from('closed_dates').delete().eq('date', 'RESULTADO_LIBERADO');
}

// Módulo Atendimento Diário
export async function isDiarioGlobalEnabled(): Promise<boolean> {
  const { data } = await supabase.from('closed_dates').select('date').eq('date', 'DIARIO_ENABLED');
  return (data || []).length > 0;
}

export async function setDiarioGlobalEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await supabase.from('closed_dates').upsert({ date: 'DIARIO_ENABLED' }, { onConflict: 'date' });
  } else {
    await supabase.from('closed_dates').delete().eq('date', 'DIARIO_ENABLED');
  }
}

export async function getDiarioAuthorizedUsers(): Promise<string[]> {
  const { data } = await supabase.from('closed_dates').select('date').like('date', 'DIARIO_USER:%');
  return (data || []).map(r => r.date.split(':')[1]);
}

export async function addDiarioUser(login: string): Promise<void> {
  await supabase.from('closed_dates').upsert({ date: `DIARIO_USER:${login.toLowerCase()}` }, { onConflict: 'date' });
}

export async function removeDiarioUser(login: string): Promise<void> {
  await supabase.from('closed_dates').delete().eq('date', `DIARIO_USER:${login.toLowerCase()}`);
}

// Bloqueio de alterações (atendentes e portaria)
export async function isAlteracoesBloqueadas(): Promise<boolean> {
  const { data } = await supabase.from('closed_dates').select('date').eq('date', 'ALTERACOES_BLOQUEADAS');
  return (data || []).length > 0;
}

export async function bloquearAlteracoes(): Promise<void> {
  await supabase.from('closed_dates').upsert({ date: 'ALTERACOES_BLOQUEADAS' }, { onConflict: 'date' });
}

export async function desbloquearAlteracoes(): Promise<void> {
  await supabase.from('closed_dates').delete().eq('date', 'ALTERACOES_BLOQUEADAS');
}

// Cache closed dates for 30 seconds to avoid repeated queries
let closedDatesCache: { dates: string[]; ts: number } | null = null;

async function getCachedClosedDates(): Promise<string[]> {
  if (closedDatesCache && Date.now() - closedDatesCache.ts < 30000) {
    return closedDatesCache.dates;
  }
  const dates = await getClosedDates();
  closedDatesCache = { dates, ts: Date.now() };
  return dates;
}

export async function getCandidatos(includeClosed = false): Promise<Candidato[]> {
  const query = supabase.from('candidatos').select('*').order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) { console.error('getCandidatos error:', error); return []; }

  let candidatos = (data || []).map(dbToCandidato);

  if (!includeClosed) {
    const closed = await getCachedClosedDates();
    const closedSet = new Set(closed.map(normalizeDateKey));
    candidatos = candidatos.filter(c => {
      const integrationDate = normalizeDateKey(c.dataIntegracao);
      return !integrationDate || !closedSet.has(integrationDate);
    });
  }

  return candidatos;
}

export function getHojeBR(): string {
  // Retorna YYYY-MM-DD no fuso de Brasília
  const date = new Date();
  const offset = -3; // Brasília é UTC-3
  const brDate = new Date(date.getTime() + (offset * 3600000) + (date.getTimezoneOffset() * 60000));
  return brDate.toISOString().split("T")[0];
}

export async function getCandidatosDoDia(): Promise<Candidato[]> {
  const hoje = getHojeBR();
  
  // Busca candidatos onde data_integracao OU data_importacao seja hoje
  let { data, error } = await supabase
    .from('candidatos')
    .select('*')
    .or(`data_integracao.eq.${hoje},data_importacao.eq.${hoje}`)
    .order('nome');

  if (error) {
    console.error('getCandidatosDoDia error:', error);
    // Fallback para getCandidatos geral se o filtro falhar
    return getCandidatos(false);
  }
  
  return (data || []).map(dbToCandidato);
}

export async function updateCandidato(id: string, updates: Partial<Candidato>): Promise<void> {
  const dbUpdates = candidatoToDb(updates);
  const { error } = await supabase.from('candidatos').update(dbUpdates).eq('id', id);
  if (error) console.error('updateCandidato error:', error);
}

export async function updateCandidatoStatus(
  id: string,
  novoStatus: StatusEtapa,
  usuario: string,
  observacao: string
): Promise<void> {
  const { data: current } = await supabase.from('candidatos').select('status').eq('id', id).single();
  if (!current) return;

  const updates: Record<string, any> = { status: novoStatus };
  if (novoStatus === "presente") {
    updates.data_presenca = new Date().toISOString().split("T")[0];
    updates.hora_presenca = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  await supabase.from('candidatos').update(updates).eq('id', id);

  await supabase.from('historico').insert({
    candidato_id: id,
    usuario,
    data: new Date().toISOString().split("T")[0],
    hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    status_anterior: current.status,
    novo_status: novoStatus,
    observacao,
  });
}

export async function marcarPresenca(id: string): Promise<void> {
  await updateCandidatoStatus(id, "presente", "Portaria", "Presença marcada na Portaria");
}

export async function marcarAusentes(): Promise<number> {
  const hoje = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from('candidatos')
    .select('id')
    .or(`data_integracao.eq.${hoje},data_importacao.eq.${hoje}`)
    .in('status', ['aguardando_presenca', 'aguardando_portaria']);
  
  if (!data || data.length === 0) return 0;
  
  for (const row of data) {
    await updateCandidatoStatus(row.id, "ausente", "Sistema", "Encerramento automático às 09:01");
  }
  return data.length;
}

export async function enviarParaFila(id: string): Promise<void> {
  await supabase.from('candidatos').update({ observacoes: "" }).eq('id', id);
  await updateCandidatoStatus(id, "na_fila_atendimento", "Sistema", "Enviado para fila de atendimento");
}

export async function deleteCandidato(id: string, deletedBy: string = "Sistema"): Promise<void> {
  const { data: c } = await supabase.from('candidatos').select('*').eq('id', id).single();
  if (c) {
    // Add to "lixeira" (soft delete simulation via history/notes or custom field if table existed)
    // Since we cannot create a new table, we will use the history table to mark the deletion details
    await supabase.from('historico').insert({
      candidato_id: id,
      usuario: deletedBy,
      data: new Date().toISOString().split("T")[0],
      hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      status_anterior: c.status,
      novo_status: "excluido" as any,
      observacao: `Candidato EXCLUÍDO por ${deletedBy}. Dados preservados no histórico. Nome: ${c.nome}, CPF: ${c.cpf}, Função: ${c.funcao}, Setor: ${c.setor}, Data Integr.: ${c.data_integracao || 'N/A'}`,
    });
  }
  await supabase.from('candidatos').delete().eq('id', id);
}

export async function deleteCandidatosByDate(date: string): Promise<number> {
  const { data, error: selErr } = await supabase.from('candidatos').select('id').eq('data_integracao', date);
  if (selErr) { console.error('deleteCandidatosByDate select error:', selErr); throw selErr; }
  if (!data || data.length === 0) return 0;
  const ids = data.map(c => c.id);
  const { error: histErr } = await supabase.from('historico').delete().in('candidato_id', ids);
  if (histErr) console.error('deleteCandidatosByDate histórico error:', histErr);
  const { error: delErr, count } = await supabase.from('candidatos').delete({ count: 'exact' }).in('id', ids);
  if (delErr) { console.error('deleteCandidatosByDate delete error:', delErr); throw delErr; }
  // Also remove closed_dates entry if exists + invalidate cache
  await supabase.from('closed_dates').delete().eq('date', date);
  closedDatesCache = null;
  return count ?? ids.length;
}

export async function addCandidatos(novos: Omit<Candidato, "id">[]): Promise<Candidato[]> {
  const dbRows = novos.map(c => candidatoToDb(c));
  const { data, error } = await supabase.from('candidatos').insert(dbRows).select();
  if (error) { console.error('addCandidatos error:', error); return []; }
  return (data || []).map(dbToCandidato);
}

export async function addCandidato(novo: Omit<Candidato, "id">): Promise<Candidato | null> {
  const dbRow = candidatoToDb(novo);
  const { data, error } = await supabase.from('candidatos').insert(dbRow).select().single();
  if (error) { console.error('addCandidato error:', error); return null; }
  return dbToCandidato(data);
}

export async function getHistorico(candidatoId?: string): Promise<HistoricoEntry[]> {
  let query = supabase.from('historico').select('*').order('created_at', { ascending: false });
  if (candidatoId) query = query.eq('candidato_id', candidatoId);
  const { data, error } = await query;
  if (error) { console.error('getHistorico error:', error); return []; }
  return (data || []).map(r => ({
    id: r.id,
    candidatoId: r.candidato_id,
    usuario: r.usuario,
    data: r.data,
    hora: r.hora,
    statusAnterior: r.status_anterior,
    novoStatus: r.novo_status,
    observacao: r.observacao,
  }));
}

export async function resetData(): Promise<void> {
  await supabase.from('historico').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('candidatos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('closed_dates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

// Supabase Realtime subscription
let channelCounter = 0;

export function subscribeToCandidatos(callback: () => void) {
  const channelName = `candidatos-realtime-${++channelCounter}-${Date.now()}`;
  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'candidatos' }, () => {
      console.log('[Realtime] candidatos changed — refetching');
      callback();
    })
    .subscribe((status) => {
      console.log('[Realtime] candidatos channel status:', status);
    });

  return () => { supabase.removeChannel(channel); };
}

export function subscribeToClosedDates(callback: () => void) {
  const channelName = `closed-dates-realtime-${++channelCounter}-${Date.now()}`;
  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'closed_dates' }, () => {
      closedDatesCache = null;
      callback();
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
