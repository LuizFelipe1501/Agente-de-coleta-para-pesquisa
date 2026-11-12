'use server';
import { exige } from '@/lib/auth';
import { db } from '@/lib/db';
import { busca, Achado } from '@/lib/busca';
import { estaNoOptout, normalizaContato } from '@/lib/versoes';

export type Resultado = { achados: (Achado & { jaNaFila: boolean; optout: boolean })[]; paginas: number; log: string[] } | null;

export async function buscar(_: Resultado, fd: FormData): Promise<Resultado> {
  await exige('admin');
  const sementes = String(fd.get('urls') || '').split(/\s+/).filter((u) => /^https?:\/\//i.test(u)).slice(0, 20);
  if (sementes.length === 0) return { achados: [], paginas: 0, log: ['Informe pelo menos um endereço começando com http'] };
  const r = await busca(sementes, { seguirLinks: fd.get('seguir') === 'on', maxPaginas: Math.min(40, Number(fd.get('max')) || 25) });

  const emails = r.achados.map((a) => a.email);
  const naFila = new Set<string>();
  for (let i = 0; i < emails.length; i += 200) {
    const { data } = await db().from('fila').select('contato').eq('canal', 'email').in('contato', emails.slice(i, i + 200));
    (data || []).forEach((d: { contato: string }) => naFila.add(d.contato));
  }
  const achados = await Promise.all(
    r.achados.map(async (a) => ({ ...a, jaNaFila: naFila.has(a.email), optout: await estaNoOptout(a.email) })),
  );
  achados.sort((a, b) => (a.tipo === b.tipo ? a.email.localeCompare(b.email) : a.tipo === 'pessoal' ? -1 : 1));
  return { achados, paginas: r.paginas, log: r.log };
}

export async function adicionarSelecionados(itens: { email: string; nome: string | null }[]): Promise<number> {
  await exige('admin');
  const registros = [];
  for (const i of itens.slice(0, 2000)) {
    const contato = normalizaContato(i.email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contato) || (await estaNoOptout(contato))) continue;
    registros.push({ canal: 'email', contato, nome: i.nome });
  }
  if (registros.length) {
    const { error } = await db().from('fila').upsert(registros, { onConflict: 'canal,contato', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  return registros.length;
}
