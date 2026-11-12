'use server';
import { revalidatePath } from 'next/cache';
import { exige } from '@/lib/auth';
import { db, checa } from '@/lib/db';
import { CANAIS, Canal } from '@/lib/config';
import { sugereVersoes } from '@/lib/agente';
import { estaNoOptout, normalizaContato, versao } from '@/lib/versoes';

const canalValido = (c: string): Canal => {
  if (!(CANAIS as readonly string[]).includes(c)) throw new Error('canal inválido');
  return c as Canal;
};

export async function salvaRespostas(fd: FormData) {
  await exige('admin');
  const total = Number(fd.get('total'));
  const dia = String(fd.get('dia'));
  if (!Number.isFinite(total) || total < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return;
  await db().from('respostas').upsert({ dia, total });
  revalidatePath('/admin');
}

export async function mudaStatus(fd: FormData) {
  await exige('admin');
  const slug = String(fd.get('slug'));
  const status = String(fd.get('status'));
  if (!['ativa', 'pausada', 'descartada'].includes(status)) return;
  await db().from('versoes').update({ status }).eq('slug', slug);
  revalidatePath('/admin');
}

export async function editaVersao(fd: FormData) {
  await exige('admin');
  const slug = String(fd.get('slug'));
  const texto = String(fd.get('texto') || '').trim();
  const assunto = fd.get('assunto') == null ? undefined : String(fd.get('assunto')).trim();
  if (!texto.includes('{link}')) throw new Error('O texto precisa ter {link}');
  await db().from('versoes').update({ texto, ...(assunto !== undefined ? { assunto } : {}) }).eq('slug', slug);
  revalidatePath('/admin');
}

export async function importaContatos(fd: FormData) {
  await exige('admin');
  const canal = String(fd.get('canal')) as 'email' | 'wpp';
  if (canal !== 'email' && canal !== 'wpp') return;
  const numero = canal === 'wpp' ? String(fd.get('numero') || '') : null;
  if (canal === 'wpp' && !numero) throw new Error('Escolha o número dono destes contatos');
  const linhas = String(fd.get('lista') || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const registros: { canal: string; contato: string; nome: string | null; numero: string | null }[] = [];
  const vistos = new Set<string>();
  for (const l of linhas) {
    const [bruto, ...resto] = l.split(/[;,\t]/);
    const contato = normalizaContato(bruto || '');
    const nome = resto.join(' ').trim() || null;
    const valido = canal === 'email' ? /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contato) : /^55\d{10,11}$/.test(contato);
    if (!valido || vistos.has(contato)) continue;
    if (await estaNoOptout(contato)) continue;
    vistos.add(contato);
    registros.push({ canal, contato, nome, numero });
  }
  for (let i = 0; i < registros.length; i += 500) {
    await db().from('fila').upsert(registros.slice(i, i + 500), { onConflict: 'canal,contato', ignoreDuplicates: true });
  }
  revalidatePath('/admin');
}

export async function limpaErros(fd: FormData) {
  await exige('admin');
  const canal = String(fd.get('canal'));
  await db().from('fila').delete().eq('canal', canal).not('erro', 'is', null);
  revalidatePath('/admin');
}

export async function geraSugestoes(fd: FormData) {
  await exige('admin');
  const canal = canalValido(String(fd.get('canal')));
  const quantas = Math.min(3, Math.max(1, Number(fd.get('quantas')) || 2));

  const stats = checa(await db().from('stats_versoes').select('*').eq('canal', canal).in('status', ['ativa', 'pausada'])) as any[];
  const comTexto = await Promise.all(stats.map(async (s) => ({ ...s, texto: (await versao(s.slug)).texto })));
  const desde = new Date(Date.now() - 7 * 86400000).toISOString();
  const obj = checa(await db().from('objecoes').select('categoria').gte('criado_em', desde)) as { categoria: string }[];
  const contagem: Record<string, number> = {};
  for (const o of obj) contagem[o.categoria] = (contagem[o.categoria] || 0) + 1;

  const sugestoes = await sugereVersoes({ canal, stats: comTexto, objecoes: contagem, quantas });

  const todas = checa(await db().from('versoes').select('slug').eq('canal', canal)) as { slug: string }[];
  let letra = Math.max(...todas.map((t) => t.slug.charCodeAt(0)), 'a'.charCodeAt(0));
  for (const s of sugestoes) {
    letra++;
    const slug = `${String.fromCharCode(letra)}-${canal}`;
    await db().from('versoes').insert({
      slug, canal, angulo: String(s.angulo || 'Sugestão').slice(0, 80),
      assunto: canal === 'email' ? s.assunto || null : null, texto: s.texto, status: 'pendente',
    });
  }
  revalidatePath('/admin');
}

export async function salvaNumero(fd: FormData) {
  await exige('admin');
  const id = String(fd.get('id') || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  const nome = String(fd.get('nome') || '').trim();
  const instancia = String(fd.get('instancia') || '').trim();
  const limite = Math.max(1, Math.min(100, Number(fd.get('limite_dia')) || 40));
  if (!id || !nome || !instancia) throw new Error('Preencha id, nome e instância');
  await db().from('numeros').upsert({ id, nome, instancia, limite_dia: limite }, { onConflict: 'id' });
  revalidatePath('/admin');
}

export async function alternaNumero(fd: FormData) {
  await exige('admin');
  const id = String(fd.get('id'));
  const campo = String(fd.get('campo'));
  if (campo !== 'ativo' && campo !== 'responder') return;
  const valor = String(fd.get('valor')) === 'true';
  await db().from('numeros').update({ [campo]: valor }).eq('id', id);
  revalidatePath('/admin');
}
