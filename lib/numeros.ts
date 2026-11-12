import { db, checa } from './db';
import { hashContato, inicioDoDiaISO, normalizaContato } from './versoes';

export type Numero = {
  id: string; nome: string; instancia: string; limite_dia: number; ativo: boolean; responder: boolean;
};

export async function listaNumeros(soAtivos = false): Promise<Numero[]> {
  let q = db().from('numeros').select('*').order('id');
  if (soAtivos) q = q.eq('ativo', true);
  return checa(await q) as Numero[];
}

export async function numeroPorInstancia(instancia: string): Promise<Numero | null> {
  return checa(await db().from('numeros').select('*').eq('instancia', instancia).maybeSingle()) as Numero | null;
}

export async function enviadosHojeNumero(numero: string): Promise<number> {
  const linhas = checa(
    await db().from('envios').select('qtd').eq('numero', numero).gte('criado_em', inicioDoDiaISO()),
  ) as { qtd: number }[];
  return linhas.reduce((s, l) => s + l.qtd, 0);
}

export async function registraContatado(contato: string, numero: string) {
  await db().from('contatados').upsert(
    { hash: hashContato(contato), numero },
    { onConflict: 'hash,numero', ignoreDuplicates: true },
  );
}

const JANELA_RESPOSTA_DIAS = 15;

// Só responde conversas da pesquisa: contato recebeu mensagem deste número há menos de 15 dias
// e o dono do número ainda não respondeu à mão.
export async function podeResponder(contato: string, numero: string): Promise<boolean> {
  const r = checa(
    await db().from('contatados').select('humano,criado_em')
      .eq('hash', hashContato(contato)).eq('numero', numero).maybeSingle(),
  ) as { humano: boolean; criado_em: string } | null;
  if (!r || r.humano) return false;
  return Date.now() - new Date(r.criado_em).getTime() < JANELA_RESPOSTA_DIAS * 86400000;
}

export async function marcaHumano(contato: string, numero: string) {
  await db().from('contatados').update({ humano: true })
    .eq('hash', hashContato(normalizaContato(contato))).eq('numero', numero);
}
