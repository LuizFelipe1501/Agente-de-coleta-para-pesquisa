'use server';
import { revalidatePath } from 'next/cache';
import { exige } from '@/lib/auth';
import { db, checa } from '@/lib/db';
import { registraOptout } from '@/lib/versoes';

type Linha = { id: number; contato: string; slug: string | null; enviado_em: string | null; numero: string | null };

export async function marcarEnviados(ids: number[]): Promise<number> {
  await exige('time');
  const linhas = checa(await db().from('fila').select('id,contato,slug,enviado_em,numero').in('id', ids.slice(0, 100))) as Linha[];
  const agora = new Date().toISOString();
  for (const l of linhas) {
    if (l.enviado_em) {
      await db().from('envios').insert({ slug: l.slug, tipo: 'lembrete', numero: l.numero });
      await db().from('fila').delete().eq('id', l.id);
    } else {
      await db().from('envios').insert({ slug: l.slug, tipo: 'primeiro', numero: l.numero });
      await db().from('fila').update({ enviado_em: agora, reservado_em: null }).eq('id', l.id);
    }
  }
  revalidatePath('/time/whatsapp');
  return linhas.length;
}

export async function marcarSair(id: number) {
  await exige('time');
  const l = checa(await db().from('fila').select('contato').eq('id', id).maybeSingle()) as { contato: string } | null;
  if (l) await registraOptout(l.contato);
  revalidatePath('/time/whatsapp');
}

export async function marcarInvalido(id: number) {
  await exige('time');
  await db().from('fila').delete().eq('id', id);
  revalidatePath('/time/whatsapp');
}
