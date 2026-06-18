import { supabase } from './supabase';

export type PerfilUsuario = 'visualizar' | 'editar' | 'admin';

export interface Usuario {
  id: string;
  nome: string;
  login: string;
  senha: string;
  perfil: PerfilUsuario;
  ativo: boolean;
  verEntrevistas: boolean;
  acessoAtendimento: boolean;
  acessoAprovar: boolean;
  verAprovados: boolean;
  especialidade: string;
  sala: string;
  ordemAtendimento: number;
  acessoPortaria: boolean;
  acessoImportacao: boolean;
  acessoRH: boolean;
  acessoRealParceria: boolean;
  acessoDashboard: boolean;
  acessoDiario: boolean;
  autorizadoIp?: string;
  createdAt?: string;
}

function inferLegacyAccess(row: any): { portaria: boolean; realParceria: boolean; rh: boolean; dashboard: boolean; importacao: boolean } {
  const login = String(row.login || '').toLowerCase().trim();
  const nome = String(row.nome || '').toLowerCase().trim();
  const perfil = String(row.perfil || '').toLowerCase();
  const isAdmin = perfil === 'admin';
  return {
    portaria: login.includes('portaria') || nome.includes('portaria'),
    realParceria: login.includes('realparceria') || nome.includes('real parceria') || login === 'sonia',
    rh: isAdmin,
    dashboard: isAdmin,
    importacao: isAdmin,
  };
}

function dbToUsuario(row: any): Usuario {
  const hasNewColumns = Object.prototype.hasOwnProperty.call(row, 'acesso_portaria');
  const hasDiarioColumn = Object.prototype.hasOwnProperty.call(row, 'acesso_diario');
  const legacy = hasNewColumns ? null : inferLegacyAccess(row);

  return {
    id: row.id,
    nome: row.nome || '',
    login: row.login || '',
    senha: row.senha || '',
    perfil: row.perfil || 'visualizar',
    ativo: row.ativo ?? true,
    verEntrevistas: row.ver_entrevistas ?? false,
    acessoAtendimento: row.acesso_atendimento ?? false,
    acessoAprovar: row.acesso_aprovar ?? false,
    verAprovados: row.ver_aprovados ?? false,
    especialidade: row.especialidade || '',
    sala: row.sala || '',
    ordemAtendimento: row.ordem_atendimento ?? 999,
    acessoPortaria: hasNewColumns ? (row.acesso_portaria ?? false) : (legacy?.portaria ?? false),
    acessoImportacao: hasNewColumns ? (row.acesso_importacao ?? false) : (legacy?.importacao ?? false),
    acessoRH: hasNewColumns ? (row.acesso_rh ?? false) : (legacy?.rh ?? false),
    acessoRealParceria: hasNewColumns ? (row.acesso_real_parceria ?? false) : (legacy?.realParceria ?? false),
    acessoDashboard: hasNewColumns ? (row.acesso_dashboard ?? false) : (legacy?.dashboard ?? false),
    acessoDiario: hasDiarioColumn ? (row.acesso_diario ?? false) : false,
    autorizadoIp: row.autorizado_ip || undefined,
    createdAt: row.created_at || undefined,
  };
}

export async function getUsuarios(): Promise<Usuario[]> {
  const { data, error } = await supabase.from('usuarios').select('*').order('ordem_atendimento').order('nome');
  if (error) { console.error('getUsuarios error:', error); return []; }
  return (data || []).map(dbToUsuario);
}

export async function getUsuariosAtendimento(): Promise<Usuario[]> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('acesso_atendimento', true)
    .eq('ativo', true)
    .order('ordem_atendimento')
    .order('nome');
  if (error) { console.error('getUsuariosAtendimento error:', error); return []; }
  return (data || []).map(dbToUsuario);
}

export async function getUsuarioByLogin(login: string): Promise<Usuario | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('login', login.toLowerCase().trim())
    .eq('ativo', true)
    .single();
  if (error || !data) return null;
  return dbToUsuario(data);
}

export async function autenticar(login: string, senha: string): Promise<Usuario | null> {
  const usuario = await getUsuarioByLogin(login);
  if (!usuario) return null;
  if (usuario.senha !== senha) return null;
  return usuario;
}

export async function criarUsuario(dados: Partial<Usuario>): Promise<Usuario | null> {
  const insertData: Record<string, any> = {
    nome: dados.nome,
    login: dados.login?.toLowerCase().trim(),
    senha: dados.senha,
    perfil: dados.perfil,
    ver_entrevistas: dados.verEntrevistas ?? false,
    acesso_atendimento: dados.acessoAtendimento ?? false,
    acesso_aprovar: dados.acessoAprovar ?? false,
    ver_aprovados: dados.verAprovados ?? false,
    especialidade: dados.especialidade || '',
    sala: dados.sala || '',
    ordem_atendimento: dados.ordemAtendimento ?? 999,
    acesso_portaria: dados.acessoPortaria ?? false,
    acesso_importacao: dados.acessoImportacao ?? false,
    acesso_rh: dados.acessoRH ?? false,
    acesso_real_parceria: dados.acessoRealParceria ?? false,
    acesso_dashboard: dados.acessoDashboard ?? false,
    acesso_diario: dados.acessoDiario ?? false,
    autorizado_ip: dados.autorizadoIp || null,
  };

  const { data, error } = await supabase.from('usuarios').insert(insertData).select().single();
  if (error) {
    console.error('criarUsuario error:', error);
    return null;
  }
  return dbToUsuario(data);
}

export async function atualizarUsuario(id: string, dados: Partial<Usuario>): Promise<void> {
  const updates: Record<string, any> = {};
  if (dados.nome !== undefined) updates.nome = dados.nome;
  if (dados.login !== undefined) updates.login = dados.login.toLowerCase().trim();
  if (dados.senha !== undefined) updates.senha = dados.senha;
  if (dados.perfil !== undefined) updates.perfil = dados.perfil;
  if (dados.ativo !== undefined) updates.ativo = dados.ativo;
  if (dados.verEntrevistas !== undefined) updates.ver_entrevistas = dados.verEntrevistas;
  if (dados.acessoAtendimento !== undefined) updates.acesso_atendimento = dados.acessoAtendimento;
  if (dados.acessoAprovar !== undefined) updates.acesso_aprovar = dados.acessoAprovar;
  if (dados.verAprovados !== undefined) updates.ver_aprovados = dados.verAprovados;
  if (dados.especialidade !== undefined) updates.especialidade = dados.especialidade;
  if (dados.sala !== undefined) updates.sala = dados.sala;
  if (dados.ordemAtendimento !== undefined) updates.ordem_atendimento = dados.ordemAtendimento;
  if (dados.acessoPortaria !== undefined) updates.acesso_portaria = dados.acessoPortaria;
  if (dados.acessoImportacao !== undefined) updates.acesso_importacao = dados.acessoImportacao;
  if (dados.acessoRH !== undefined) updates.acesso_rh = dados.acessoRH;
  if (dados.acessoRealParceria !== undefined) updates.acesso_real_parceria = dados.acessoRealParceria;
  if (dados.acessoDashboard !== undefined) updates.acesso_dashboard = dados.acessoDashboard;
  if (dados.acessoDiario !== undefined) updates.acesso_diario = dados.acessoDiario;
  if (dados.autorizadoIp !== undefined) updates.autorizado_ip = dados.autorizadoIp || null;

  const { error } = await supabase.from('usuarios').update(updates).eq('id', id);
  if (error) {
    console.error('atualizarUsuario error:', error);
    throw error;
  }
}

export async function deletarUsuario(id: string): Promise<void> {
  await supabase.from('usuarios').delete().eq('id', id);
}

export const perfilLabels: Record<PerfilUsuario, string> = {
  visualizar: 'Visualizar',
  editar: 'Editar',
  admin: 'Admin',
};