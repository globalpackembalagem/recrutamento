import { supabase } from './supabase';

export type StatusEntrevista = 'nao_enviada' | 'link_gerado' | 'enviada' | 'respondida' | 'finalizada';
export type TipoDesligamento = 'pedido_demissao' | 'demitido';
export type Avaliacao = 'ruim' | 'regular' | 'bom';

export interface EntrevistaDesligamento {
  id: string;
  candidatoId?: string;
  nomeFuncionario: string;
  cpf: string;
  cargo?: string;
  empresaAgencia?: string;
  dataDesligamento?: string;
  tipoDesligamento?: TipoDesligamento;
  token: string;
  status: StatusEntrevista;
  dataEnvio?: string;
  dataResposta?: string;
  validade?: string;
  // Respostas
  motivosSaida?: string[];
  motivoOutro?: string;
  comentarioMotivo?: string;
  avaliacaoAmbiente?: Avaliacao;
  avaliacaoLideranca?: Avaliacao;
  avaliacaoSalario?: Avaliacao;
  avaliacaoBeneficios?: Avaliacao;
  avaliacaoCrescimento?: Avaliacao;
  avaliacaoComunicacao?: Avaliacao;
  valorizado?: string;
  valorizadoComentario?: string;
  relacaoGestor?: string;
  relacaoGestorComentario?: string;
  recomendaria?: string;
  continuarEmpresa?: string;
  sugestoesMelhoria?: string;
  createdAt?: string;
}

export const statusEntrevistaLabels: Record<StatusEntrevista, string> = {
  nao_enviada: 'Não Enviada',
  link_gerado: 'Link Gerado',
  enviada: 'Enviada',
  respondida: 'Respondida',
  finalizada: 'Finalizada',
};

export const statusEntrevistaColors: Record<StatusEntrevista, string> = {
  nao_enviada: 'bg-slate-100 text-slate-700 border-slate-200',
  link_gerado: 'bg-blue-50 text-blue-700 border-blue-200',
  enviada: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  respondida: 'bg-green-50 text-green-700 border-green-200',
  finalizada: 'bg-slate-800 text-white border-slate-900',
};

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '').substring(0, 24);
}

function dbToEntrevista(row: any): EntrevistaDesligamento {
  return {
    id: row.id,
    candidatoId: row.candidato_id || undefined,
    nomeFuncionario: row.nome_funcionario || '',
    cpf: row.cpf || '',
    cargo: row.cargo || undefined,
    empresaAgencia: row.empresa_agencia || undefined,
    dataDesligamento: row.data_desligamento || undefined,
    tipoDesligamento: row.tipo_desligamento || undefined,
    token: row.token,
    status: row.status || 'nao_enviada',
    dataEnvio: row.data_envio || undefined,
    dataResposta: row.data_resposta || undefined,
    validade: row.validade || undefined,
    motivosSaida: row.motivos_saida || undefined,
    motivoOutro: row.motivo_outro || undefined,
    comentarioMotivo: row.comentario_motivo || undefined,
    avaliacaoAmbiente: row.avaliacao_ambiente || undefined,
    avaliacaoLideranca: row.avaliacao_lideranca || undefined,
    avaliacaoSalario: row.avaliacao_salario || undefined,
    avaliacaoBeneficios: row.avaliacao_beneficios || undefined,
    avaliacaoCrescimento: row.avaliacao_crescimento || undefined,
    avaliacaoComunicacao: row.avaliacao_comunicacao || undefined,
    valorizado: row.valorizado || undefined,
    valorizadoComentario: row.valorizado_comentario || undefined,
    relacaoGestor: row.relacao_gestor || undefined,
    relacaoGestorComentario: row.relacao_gestor_comentario || undefined,
    recomendaria: row.recomendaria || undefined,
    continuarEmpresa: row.continuar_empresa || undefined,
    sugestoesMelhoria: row.sugestoes_melhoria || undefined,
    createdAt: row.created_at || undefined,
  };
}

export async function getEntrevistas(): Promise<EntrevistaDesligamento[]> {
  const { data, error } = await supabase
    .from('entrevistas_desligamento')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('getEntrevistas error:', error); return []; }
  return (data || []).map(dbToEntrevista);
}

export async function getEntrevistaByToken(token: string): Promise<EntrevistaDesligamento | null> {
  const { data, error } = await supabase
    .from('entrevistas_desligamento')
    .select('*')
    .eq('token', token)
    .single();
  if (error || !data) return null;
  return dbToEntrevista(data);
}

export async function criarEntrevista(params: {
  candidatoId?: string;
  nomeFuncionario: string;
  cpf: string;
  cargo?: string;
  empresaAgencia?: string;
  dataDesligamento?: string;
  tipoDesligamento?: TipoDesligamento;
}): Promise<EntrevistaDesligamento | null> {
  const token = generateToken();
  const validade = new Date();
  validade.setDate(validade.getDate() + 15); // 15 dias de validade

  const { data, error } = await supabase
    .from('entrevistas_desligamento')
    .insert({
      candidato_id: params.candidatoId || null,
      nome_funcionario: params.nomeFuncionario,
      cpf: params.cpf,
      cargo: params.cargo || null,
      empresa_agencia: params.empresaAgencia || null,
      data_desligamento: params.dataDesligamento || null,
      tipo_desligamento: params.tipoDesligamento || null,
      token,
      status: 'link_gerado',
      validade: validade.toISOString(),
    })
    .select()
    .single();
  if (error) { console.error('criarEntrevista error:', error); return null; }
  return dbToEntrevista(data);
}

export async function responderEntrevista(token: string, respostas: {
  motivosSaida: string[];
  motivoOutro?: string;
  comentarioMotivo: string;
  avaliacaoAmbiente: Avaliacao;
  avaliacaoLideranca: Avaliacao;
  avaliacaoSalario: Avaliacao;
  avaliacaoBeneficios: Avaliacao;
  avaliacaoCrescimento: Avaliacao;
  avaliacaoComunicacao: Avaliacao;
  valorizado: string;
  valorizadoComentario?: string;
  relacaoGestor: string;
  relacaoGestorComentario?: string;
  recomendaria: string;
  continuarEmpresa?: string;
  sugestoesMelhoria?: string;
}): Promise<boolean> {
  const { error } = await supabase
    .from('entrevistas_desligamento')
    .update({
      motivos_saida: respostas.motivosSaida,
      motivo_outro: respostas.motivoOutro || null,
      comentario_motivo: respostas.comentarioMotivo,
      avaliacao_ambiente: respostas.avaliacaoAmbiente,
      avaliacao_lideranca: respostas.avaliacaoLideranca,
      avaliacao_salario: respostas.avaliacaoSalario,
      avaliacao_beneficios: respostas.avaliacaoBeneficios,
      avaliacao_crescimento: respostas.avaliacaoCrescimento,
      avaliacao_comunicacao: respostas.avaliacaoComunicacao,
      valorizado: respostas.valorizado,
      valorizado_comentario: respostas.valorizadoComentario || null,
      relacao_gestor: respostas.relacaoGestor,
      relacao_gestor_comentario: respostas.relacaoGestorComentario || null,
      recomendaria: respostas.recomendaria,
      continuar_empresa: respostas.continuarEmpresa || null,
      sugestoes_melhoria: respostas.sugestoesMelhoria || null,
      status: 'respondida',
      data_resposta: new Date().toISOString(),
    })
    .eq('token', token);
  if (error) { console.error('responderEntrevista error:', error); return false; }
  return true;
}

export async function atualizarStatusEntrevista(id: string, status: StatusEntrevista): Promise<void> {
  const updates: Record<string, any> = { status };
  if (status === 'enviada') updates.data_envio = new Date().toISOString();
  await supabase.from('entrevistas_desligamento').update(updates).eq('id', id);
}

export async function deletarEntrevista(id: string): Promise<void> {
  await supabase.from('entrevistas_desligamento').delete().eq('id', id);
}
