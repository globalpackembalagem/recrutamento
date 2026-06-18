
import { supabase } from './src/lib/supabase';

async function updatePermissions() {
  console.log('Iniciando atualização de permissões...');

  // 1. Buscar todos os usuários
  const { data: users, error } = await supabase.from('usuarios').select('*');
  
  if (error) {
    console.error('Erro ao buscar usuários:', error);
    return;
  }

  for (const user of users) {
    const nome = (user.nome || '').toLowerCase();
    const login = (user.login || '').toLowerCase();
    
    // Silvana, Michelli, Luciano, Mauricio e Sonia devem ter acesso_aprovar
    const deveAprovar = 
      nome.includes('silvana') || 
      nome.includes('michelli') || 
      nome.includes('michele') || 
      nome.includes('micheli') ||
      ['luciano', 'mauricio', 'sonia'].includes(login) ||
      user.perfil === 'admin';

    if (user.acesso_aprovar !== deveAprovar) {
      console.log(`Atualizando ${user.nome}: acesso_aprovar -> ${deveAprovar}`);
      await supabase.from('usuarios').update({ acesso_aprovar: deveAprovar }).eq('id', user.id);
    }
  }

  console.log('Permissões atualizadas com sucesso.');
}

updatePermissions();
