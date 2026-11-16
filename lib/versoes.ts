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
  // versões ativas ainda com texto provisório ficam de fora (não travam o canal)
  const prontas = new Set(
    (checa(await db().from('versoes').select('slug,texto').eq('canal', canal).eq('status', 'ativa')) as { slug: string; texto: string }[])
      .filter((v) => prontaParaEnvio(v.texto, canal))
      .map((v) => v.slug),
  );
  const bracos: BraçoStats[] = stats.filter((s) => prontas.has(s.slug)).map((s) => ({ slug: s.slug, envios: s.envios, cliques: s.cliques }));
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

// Campos entre colchetes que sobraram de modelo ([Seu nome], [Instituição]...) ou o texto provisório.
// Versão com isso não é enviada.
// Nos canais do time (direto, grupo) os colchetes são de propósito: a pessoa completa antes de mandar.
export function camposAbertos(texto: string, canal?: string): string[] {
  if (texto.includes('[COLE AQUI')) return ['texto provisório'];
  if (canal === 'direto' || canal === 'grupo') return [];
  const campos = [...new Set(texto.match(/\[[^\[\]\n]{2,60}\]/g) || [])];
  const semCampos = texto.replace(/\[[^\[\]\n]{2,60}\]/g, '');
  if (/[\[\]]/.test(semCampos)) campos.push('colchetes [ ] sobrando');
  return campos;
}
export const prontaParaEnvio = (texto: string, canal?: string) => camposAbertos(texto, canal).length === 0;

// Ajusta jeitos comuns de escrever os campos: [Nome], {Nome}, [nome] -> {nome}; {{link}}, [link] -> {link}.
export function normalizaCampos(texto: string): string {
  return texto
    .replace(/\{\{\s*link\s*\}\}/gi, '{link}')
    .replace(/[\[{]\s*link\s*[\]}]/gi, '{link}')
    .replace(/[\[{]\s*(primeiro\s+)?nome(\s+do\s+destinat[aá]rio)?\s*[\]}]/gi, '{nome}');
}

export function linkDe(slug: string): string {
  return `${config.baseUrl}/p/${slug}`;
}

export function renderiza(texto: string, slug: string, nome?: string | null, padraoNome = ''): string {
  const n = (nome || '').trim().split(/\s+/)[0] || padraoNome;
  let t = texto.replaceAll('{link}', linkDe(slug));
  if (!n) t = t.replace(/,\s*\{nome\}/g, '').replace(/\{nome\},?\s*/g, '');
  return t.replaceAll('{nome}', n);
}

// Primeiro nome a partir de e-mails no formato nome.sobrenome@orgao.gov.br.
// Caixas genéricas (gabinete@, contato@...) e formatos sem ponto ficam sem nome.
const GENERICOS = new Set(['gab', 'gabinete', 'contato', 'secretaria', 'sec', 'ouvidoria', 'sic', 'protocolo', 'atendimento',
  'imprensa', 'comunicacao', 'ascom', 'dir', 'diretoria', 'coord', 'coordenacao', 'presidencia', 'adm', 'admin', 'rh',
  'gestao', 'suporte', 'faleconosco', 'institucional', 'geral', 'nao', 'no', 'reply', 'noreply', 'servidor', 'equipe']);
const ACENTOS: Record<string, string> = {
  joao: 'João', jose: 'José', antonio: 'Antônio', marcia: 'Márcia', lucia: 'Lúcia', sergio: 'Sérgio', fabio: 'Fábio',
  flavia: 'Flávia', claudia: 'Cláudia', patricia: 'Patrícia', leticia: 'Letícia', monica: 'Mônica', vinicius: 'Vinícius',
  julio: 'Júlio', rogerio: 'Rogério', marcio: 'Márcio', angela: 'Ângela', andrea: 'Andréa', valeria: 'Valéria',
  vitoria: 'Vitória', cecilia: 'Cecília', debora: 'Débora', barbara: 'Bárbara', tania: 'Tânia', vania: 'Vânia',
  simone: 'Simone', otavio: 'Otávio', flavio: 'Flávio', cassio: 'Cássio', helio: 'Hélio', tulio: 'Túlio', caio: 'Caio',
  luciana: 'Luciana', jessica: 'Jéssica', lais: 'Laís', luis: 'Luís', thais: 'Thaís', ines: 'Inês', rosangela: 'Rosângela',
};
export function nomeDoEmail(email: string): string | null {
  const local = (email.split('@')[0] || '').toLowerCase();
  const partes = local.split(/[._-]/).filter(Boolean);
  if (partes.length < 2) return null;
  const p = partes[0];
  if (!/^[a-z]{3,}$/.test(p) || GENERICOS.has(p)) return null;
  return ACENTOS[p] || p[0].toUpperCase() + p.slice(1);
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
