// Registro das versões usadas (texto, período, envios, cliques) para o método da dissertação.
import { papelAtual } from '@/lib/auth';
import { db, checa } from '@/lib/db';

export const dynamic = 'force-dynamic';

const csv = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;

export async function GET() {
  if ((await papelAtual()) !== 'admin') return new Response('não autorizado', { status: 401 });
  const versoes = checa(await db().from('versoes').select('*').order('slug')) as any[];
  const stats = new Map((checa(await db().from('stats_versoes').select('*')) as any[]).map((s) => [s.slug, s]));
  const envios = checa(await db().from('envios').select('slug,criado_em').order('criado_em')) as any[];
  const periodo = new Map<string, [string, string]>();
  for (const e of envios) {
    const p = periodo.get(e.slug);
    periodo.set(e.slug, p ? [p[0], e.criado_em] : [e.criado_em, e.criado_em]);
  }
  const cab = ['versao', 'canal', 'angulo', 'status', 'assunto', 'texto', 'primeiro_envio', 'ultimo_envio', 'envios', 'cliques'];
  const linhas = versoes.map((v) => {
    const s = stats.get(v.slug) || {};
    const p = periodo.get(v.slug) || ['', ''];
    return [v.slug, v.canal, v.angulo, v.status, v.assunto, v.texto, p[0], p[1], s.envios ?? 0, s.cliques ?? 0].map(csv).join(',');
  });
  return new Response('﻿' + [cab.join(','), ...linhas].join('\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="registro-versoes.csv"' },
  });
}
