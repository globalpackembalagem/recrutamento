
import { supabase } from './src/lib/supabase';
import { getHojeBR } from './src/lib/supabaseData';

async function testePainel() {
  const hoje = getHojeBR();
  console.log(`Iniciando teste de painel para a data: ${hoje}`);

  const nomeTeste = "CANDIDATO TESTE PAINEL";
  
  // 1. Criar candidato de teste
  const { data: candidato, error: createError } = await supabase
    .from('candidatos')
    .insert({
      nome: nomeTeste,
      cpf: "000.000.000-00",
      funcao: "TESTE",
      setor: "TESTE",
      status: "na_fila_atendimento",
      data_importacao: hoje,
      data_integracao: hoje
    })
    .select()
    .single();

  if (createError) {
    console.error('Erro ao criar candidato de teste:', createError);
    return;
  }

  console.log(`Candidato criado: ${candidato.nome} (ID: ${candidato.id})`);

  // 2. Chamar no painel (mudar status para em_atendimento com Silvana)
  const observacoes = "atendente:Silvana";
  const { error: updateError } = await supabase
    .from('candidatos')
    .update({ 
      status: "em_atendimento",
      observacoes: observacoes 
    })
    .eq('id', candidato.id);

  if (updateError) {
    console.error('Erro ao chamar no painel:', updateError);
  } else {
    console.log(`Candidato ${nomeTeste} chamado no painel com Silvana!`);
    console.log("O painel deve tocar o som e falar o nome agora.");
  }

  // 3. Aguardar 10 segundos e limpar
  console.log("Aguardando 10 segundos antes de remover o teste...");
  await new Promise(resolve => setTimeout(resolve, 10000));

  await supabase.from('candidatos').delete().eq('id', candidato.id);
  console.log("Teste finalizado e candidato removido.");
}

testePainel();
