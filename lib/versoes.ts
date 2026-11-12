import { createHash } from 'crypto';
import { db, checa } from './db';
import { config, Canal } from './config';
import { escolheVersao, BraçoStats } from './bandit';

export type Versao = {
  slug: string; canal: Canal; angulo: string; assunto: string | null;
  texto: string; status: string; criada_em: string;
};
export type Stats = { slug: string; canal: Canal; angulo: string; status: string; envios: number; cliques: number };

export async function statsAtivas(canal: Canal): Promise<Stats[]> {
  return checa(
    await db().from('stats_versoes').select('*').eq('canal', canal).eq('status', 'ativa'),
  ) as Stats[];
}

export async function versao(slug: string): Promise<Versao> {
  return checa(await db().from('versoes').select('*').eq('slug', slug).single()) as Versao;
}

// Alocador que mantém as contagens em memória durante um lote de envios.
export async function criaAlocador(canal: Canal) {
  const stats = await statsAtivas(canal);
  const bracos: BraçoStats[] = stats.map((s) => ({ slug: s.slug, envios: s.envios, cliques: s.cliques }));
  return {
    vazio: bracos.length === 0,
    proxima(): string {
      const slug = escolheVersao(bracos, {
        minEnvios: config.minEnviosPorVersao,
        minParticipacao: config.minParticipacao,
      });
      const b = bracos.find((x) => x.slug === slug)!;
      b.envios++;
      return slug;
    },
  };
}

export function linkDe(slug: string): string {
  return `${config.baseUrl}/p/${slug}`;
}

export function renderiza(texto: string, slug: string, nome?: string | null, padraoNome = ''): string {
  const n = (nome || '').trim().split(/\s+/)[0] || padraoNome;
  let t = texto.replaceAll('{link}', linkDe(slug));
  if (!n) t = t.replace(/,\s*\{nome\}/g, '');
  return t.replaceAll('{nome}', n);
}

export function hashContato(contato: string): string {
  return createHash('sha256').update(normalizaContato(contato)).digest('hex');
}

export function normalizaContato(c: string): string {
  const t = c.trim().toLowerCase();
  if (t.includes('@') && !t.endsWith('@s.whatsapp.net')) return t;
  let d = t.replace(/@.*$/, '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return d;
}

export async function estaNoOptout(contato: string): Promise<boolean> {
  const r = checa(await db().from('optout').select('hash').eq('hash', hashContato(contato)).maybeSingle());
  return !!r;
}

export async function registraOptout(contato: string) {
  await db().from('optout').upsert({ hash: hashContato(contato) });
  await db().from('fila').delete().eq('contato', normalizaContato(contato));
}

// Horário de Brasília
export function agoraBrasilia() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', weekday: 'short', hour: 'numeric', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map((x) => [x.type, x.value]));
  const dias: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { diaSemana: dias[p.weekday], hora: Number(p.hour) % 24, data: `${p.year}-${p.month}-${p.day}` };
}

export function dentroDaJanela(): boolean {
  const a = agoraBrasilia();
  return config.diasEnvio.includes(a.diaSemana) && a.hora >= config.horaInicio && a.hora < config.horaFim;
}

export function inicioDoDiaISO(): string {
  // meia-noite de Brasília (UTC-3) em ISO
  return new Date(`${agoraBrasilia().data}T00:00:00-03:00`).toISOString();
}

export async function enviadosHoje(canal: Canal): Promise<number> {
  const slugs = checa(await db().from('versoes').select('slug').eq('canal', canal)) as { slug: string }[];
  if (slugs.length === 0) return 0;
  const linhas = checa(
    await db().from('envios').select('qtd').in('slug', slugs.map((s) => s.slug)).gte('criado_em', inicioDoDiaISO()),
  ) as { qtd: number }[];
  return linhas.reduce((s, l) => s + l.qtd, 0);
}
