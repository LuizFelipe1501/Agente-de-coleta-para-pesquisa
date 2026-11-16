'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { exige } from '@/lib/auth';
import { db, checa } from '@/lib/db';
import { CANAIS, Canal } from '@/lib/config';
import { sugereVersoes } from '@/lib/agente';
import { estaNoOptout, normalizaContato, versao, normalizaCampos } from '@/lib/versoes';

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
  revalidatePath('/admin', 'layout');
}

export async function mudaStatus(fd: FormData) {
  await exige('admin');
  const slug = String(fd.get('slug'));
  const status = String(fd.get('status'));
  if (!['ativa', 'pausada', 'descartada'].includes(status)) return;
  await db().from('versoes').update({ status }).eq('slug', slug);
  revalidatePath('/admin', 'layout');
}

// Deixa só esta versão ativa no canal; as outras ativas ficam pausadas.
export async function usaSo(fd: FormData) {
  await exige('admin');
  const slug = String(fd.get('slug'));
  const { data } = await db().from('versoes').select('canal').eq('slug', slug).single();
  if (!data) return;
  await db().from('versoes').update({ status: 'pausada' }).eq('canal', data.canal).eq('status', 'ativa').neq('slug', slug);
  await db().from('versoes').update({ status: 'ativa' }).eq('slug', slug);
  revalidatePath('/admin', 'layout');
}

export async function editaVersao(fd: FormData) {
  await exige('admin');
  const slug = String(fd.get('slug'));
  const { data: atual } = await db().from('versoes').select('canal').eq('slug', slug).single();
  // nos canais automáticos, [Nome] / {{link}} viram {nome} / {link}; nos do time os colchetes ficam
  const ajusta = (t: string) => (atual?.canal === 'email' || atual?.canal === 'wpp' ? normalizaCampos(t) : t.replace(/\{\{\s*link\s*\}\}/gi, '{link}'));
  let texto = ajusta(String(fd.get('texto') || '').trim());
  const assunto = fd.get('assunto') == null ? undefined : ajusta(String(fd.get('assunto')).trim());
  if (!texto) return;
  // link da pesquisa colado direto vira {link} (assim o clique é contado)
  texto = texto.replace(/https?:\/\/(pt\.|www\.)?surveymonkey\.com\/r\/[A-Za-z0-9]+/g, '{link}');
  // sem {link}, coloca no fim em vez de dar erro
  if (!texto.includes('{link}')) texto = `${texto}\n\n{link}`;
  await db().from('versoes').update({ texto, ...(assunto !== undefined ? { assunto } : {}) }).eq('slug', slug);
  revalidatePath('/admin', 'layout');
  const { data } = await db().from('versoes').select('canal').eq('slug', slug).single();
  redirect(`/admin/mensagens?canal=${data?.canal || 'direto'}`);
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
  revalidatePath('/admin', 'layout');
}

export async function limpaErros(fd: FormData) {
  await exige('admin');
  const canal = String(fd.get('canal'));
  await db().from('fila').delete().eq('canal', canal).not('erro', 'is', null);
  revalidatePath('/admin', 'layout');
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
  revalidatePath('/admin', 'layout');
}

export async function salvaNumero(fd: FormData) {
  await exige('admin');
  const id = String(fd.get('id') || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  const nome = String(fd.get('nome') || '').trim();
  const instancia = String(fd.get('instancia') || '').trim();
  const limite = Math.max(1, Math.min(100, Number(fd.get('limite_dia')) || 40));
  if (!id || !nome || !instancia) throw new Error('Preencha id, nome e instância');
  await db().from('numeros').upsert({ id, nome, instancia, limite_dia: limite }, { onConflict: 'id' });
  revalidatePath('/admin', 'layout');
  redirect('/admin/contatos');
}

export async function alternaNumero(fd: FormData) {
  await exige('admin');
  const id = String(fd.get('id'));
  const campo = String(fd.get('campo'));
  if (campo !== 'ativo' && campo !== 'responder') return;
  const valor = String(fd.get('valor')) === 'true';
  await db().from('numeros').update({ [campo]: valor }).eq('id', id);
  revalidatePath('/admin', 'layout');
}

// Botão "Disparar agora": roda uma rodada na hora, sem esperar o agendador.
export async function disparaAgora() {
  await exige('admin');
  const { executaDisparo } = await import('@/lib/disparo');
  const log = await executaDisparo(false);
  const enviados = log.filter((l) => l.includes('enviado') || l.includes('lembrete enviado')).length;
  const resumo = log.length === 0 ? 'Nada para enviar agora.' : `${enviados} envio(s). ${log.slice(0, 12).join(' · ')}`;
  revalidatePath('/admin', 'layout');
  redirect(`/admin?disparo=${encodeURIComponent(resumo.slice(0, 900))}`);
}

// Correção: reenvia o texto atual de uma versão de e-mail, com um pedido de desculpas no topo,
// para quem já recebeu essa versão e ainda não recebeu lembrete. Conta como o lembrete
// (o contato sai da fila depois), então a pessoa não recebe mais nada além disso.
export async function enviaCorrecao(fd: FormData) {
  await exige('admin');
  const slug = String(fd.get('slug'));
  if (fd.get('confirmo') !== 'sim') redirect(`/admin/mensagens?canal=email&aviso=${encodeURIComponent('Marque a confirmação antes de enviar a correção.')}`);
  const { renderiza, nomeDoEmail, prontaParaEnvio, versao: le } = await import('@/lib/versoes');
  const { enviaEmail } = await import('@/lib/envio');
  const v = await le(slug);
  if (v.canal !== 'email' || !prontaParaEnvio(v.texto, 'email')) redirect(`/admin/mensagens?canal=email&aviso=${encodeURIComponent('Corrija o texto desta versão antes de reenviar.')}`);
  const alvos = checa(
    await db().from('fila').select('id,contato,nome').eq('canal', 'email').eq('slug', slug).not('enviado_em', 'is', null).limit(15),
  ) as { id: number; contato: string; nome: string | null }[];
  let ok = 0; let falhas = 0;
  for (const l of alvos) {
    if (await estaNoOptout(l.contato)) { await db().from('fila').delete().eq('id', l.id); continue; }
    const nome = l.nome || nomeDoEmail(l.contato);
    const corpo = renderiza(v.texto, slug, nome).replace(/^\s*Prezad[oa]\(?a?\)?[^\n]*\n+/i, '');
    const saudacao = renderiza('Prezado(a) {nome},', slug, nome);
    const texto = `${saudacao}\n\nPeço desculpas: o convite que enviamos anteriormente saiu com erros de formatação. Segue abaixo a versão correta.\n\n${corpo}`;
    const assunto = `Correção: ${v.assunto ? renderiza(v.assunto, slug, nome) : 'convite para pesquisa de mestrado da FGV'}`;
    try {
      await enviaEmail({ para: l.contato, assunto, texto });
      await db().from('envios').insert({ slug, tipo: 'lembrete' });
      await db().from('fila').delete().eq('id', l.id);
      ok++;
    } catch (e: any) {
      await db().from('fila').update({ erro: String(e.message).slice(0, 300) }).eq('id', l.id);
      falhas++;
    }
  }
  revalidatePath('/admin', 'layout');
  const resto = (checa(await db().from('fila').select('id').eq('canal', 'email').eq('slug', slug).not('enviado_em', 'is', null)) as unknown[]).length;
  redirect(`/admin/mensagens?canal=email&aviso=${encodeURIComponent(`Correção enviada para ${ok} contato(s)${falhas ? `, ${falhas} com erro` : ''}.${resto ? ` Faltam ${resto}: clique de novo.` : ''}`)}`);
}
