// Busca de e-mails institucionais em páginas públicas de órgãos.
// Só lê páginas abertas, respeita robots.txt, fica no mesmo site e só aceita domínios públicos.

export type Achado = { email: string; nome: string | null; tipo: 'pessoal' | 'setor'; fonte: string };

const DOMINIOS_PADRAO = ['gov.br', 'jus.br', 'leg.br', 'mp.br', 'def.br', 'mil.br', 'tc.br'];

export function dominiosPermitidos(): string[] {
  const v = process.env.DOMINIOS_PERMITIDOS;
  return v ? v.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean) : DOMINIOS_PADRAO;
}

// Canais de atendimento ao cidadão e caixas técnicas: não são para recrutamento.
const BLOQUEADOS = /^(ouvidoria|sic|e-?sic|protocolo|imprensa|ascom|comunicacao|noreply|no-reply|naoresponda|nao-responda|denuncia|denuncias|licitac|pregao|cpl|suporte|helpdesk|servicedesk|webmaster|lgpd|encarregado|dpo|privacidade|atendimento|faleconosco|fale-conosco|sac|postmaster|abuse)/i;

const SETOR = /^(gabinete|gab|secretaria|sec|diretoria|dir|coordenacao|coord|gerencia|ger|assessoria|asses|chefia|nucleo|divisao|setor|departamento|depto|presidencia|superintendencia|cgu|rh|gestaopessoas|cgp|dgp|sgp|contato|geral|administracao|adm)[._-]?/i;

const PALAVRAS_LINK = /quem-?e-?quem|quem é quem|equipe|contato|contatos|organograma|composicao|composição|estrutura|unidades|servidores|diretoria|coordena|secretaria|gabinete|autoridades|lista-?telef|ramais/i;

export function decodificaHtml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í').replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú')
    .replace(/&atilde;/g, 'ã').replace(/&otilde;/g, 'õ').replace(/&ccedil;/g, 'ç').replace(/&acirc;/g, 'â').replace(/&ecirc;/g, 'ê').replace(/&ocirc;/g, 'ô');
}

function textoDaPagina(html: string): string {
  return decodificaHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<(br|p|div|li|tr|td|th|h\d)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s*(\[at\]|\(at\)|\[arroba\]|\(arroba\)|\sarroba\s)\s*/gi, '@')
    .replace(/\s*(\[dot\]|\(dot\)|\[ponto\]|\(ponto\))\s*/gi, '.')
    .replace(/[ \t]+/g, ' ');
}

const RE_EMAIL = /[a-z0-9][a-z0-9._%+-]*@[a-z0-9.-]+\.[a-z]{2,}/gi;
const RE_NOME = /([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:[ \t]+(?:d[aeo]s?[ \t]+)?[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+){1,5})/g;
const NAO_NOME = /^(Ministério|Secretaria|Coordenação|Diretoria|Gabinete|Assessoria|Departamento|Divisão|Telefone|Contato|Endereço|Esplanada|Bloco|Brasília|Setor|Gerência|Núcleo|Presidência|Superintendência|Chefe|Coordenador[a]?|Diretor[a]?|Secretári[oa]|Assessor[a]?|Substitut[oa]|Analista|Técnic[oa]|Gerente|Ministr[oa]|Presidente|Superintendente|Ouvidor[a]?|Agenda|Email|Mail|Fone|Sala|Andar)\b/;

function nomeProximo(trecho: string): string | null {
  const nomes = [...trecho.matchAll(RE_NOME)].map((m) => m[1]).filter((n) => !NAO_NOME.test(n));
  return nomes.length ? nomes[nomes.length - 1].trim() : null;
}

export function dominioAceito(email: string, dominios: string[]): boolean {
  const d = email.split('@')[1]?.toLowerCase() || '';
  return dominios.some((p) => d === p || d.endsWith('.' + p));
}

export function extraiEmails(html: string, fonte: string, dominios = dominiosPermitidos()): Achado[] {
  const achados = new Map<string, Achado>();
  const add = (emailBruto: string, nome: string | null) => {
    const email = emailBruto.toLowerCase().replace(/^mailto:/, '').replace(/[.,;:)]+$/, '').split('?')[0];
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email)) return;
    if (!dominioAceito(email, dominios)) return;
    const local = email.split('@')[0];
    if (BLOQUEADOS.test(local)) return;
    const tipo: Achado['tipo'] = SETOR.test(local) && !/[._]/.test(local.replace(SETOR, '')) ? 'setor' : 'pessoal';
    const atual = achados.get(email);
    if (!atual || (!atual.nome && nome)) achados.set(email, { email, nome: tipo === 'pessoal' ? nome : null, tipo, fonte });
  };

  // links mailto com o nome no texto do link
  for (const m of html.matchAll(/<a[^>]+href=["']mailto:([^"'?]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const textoLink = decodificaHtml(m[2].replace(/<[^>]+>/g, ' ')).trim();
    add(decodificaHtml(m[1]), textoLink.includes('@') ? null : nomeProximo(textoLink));
  }

  // e-mails no texto, com o nome mais próximo antes dele
  const texto = textoDaPagina(html);
  for (const m of texto.matchAll(RE_EMAIL)) {
    const antes = texto.slice(Math.max(0, (m.index || 0) - 160), m.index);
    add(m[0], nomeProximo(antes));
  }
  return [...achados.values()];
}

export function linksRelevantes(html: string, base: URL): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1];
    const texto = m[2].replace(/<[^>]+>/g, ' ');
    if (/^(mailto|tel|javascript):/i.test(href)) continue;
    if (/\.(pdf|docx?|xlsx?|zip|jpg|png|gif)(\?|$)/i.test(href)) continue;
    if (!PALAVRAS_LINK.test(href) && !PALAVRAS_LINK.test(texto)) continue;
    try {
      const u = new URL(href, base);
      if (u.host === base.host && /^https?:$/.test(u.protocol)) out.add(u.toString().split('#')[0]);
    } catch {}
  }
  return [...out];
}

// robots.txt simples: regras de "User-agent: *"
const cacheRobots = new Map<string, string[]>();
async function permitidoPeloRobots(u: URL): Promise<boolean> {
  if (!cacheRobots.has(u.origin)) {
    let regras: string[] = [];
    try {
      const r = await fetch(`${u.origin}/robots.txt`, { signal: AbortSignal.timeout(5000), headers: cabecalhos() });
      if (r.ok) {
        let ativo = false;
        for (const linha of (await r.text()).split(/\r?\n/)) {
          const [k, ...v] = linha.split(':');
          const chave = k.trim().toLowerCase();
          const valor = v.join(':').trim();
          if (chave === 'user-agent') ativo = valor === '*';
          else if (ativo && chave === 'disallow' && valor) regras.push(valor);
        }
      }
    } catch {}
    cacheRobots.set(u.origin, regras);
  }
  return !cacheRobots.get(u.origin)!.some((r) => u.pathname.startsWith(r.replace(/\*.*$/, '')));
}

function cabecalhos() {
  return {
    'User-Agent': `BuscaPesquisaFGV/1.0 (recrutamento de pesquisa academica; contato: ${process.env.EMAIL_REMETENTE || process.env.SMTP_USER || 'sem-contato'})`,
    Accept: 'text/html,application/xhtml+xml',
  };
}

async function baixa(url: string): Promise<string | null> {
  const u = new URL(url);
  if (!(await permitidoPeloRobots(u))) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000), headers: cabecalhos(), redirect: 'follow' });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('html')) return null;
    return (await r.text()).slice(0, 2_000_000);
  } catch {
    return null;
  }
}

export async function busca(sementes: string[], opts: { seguirLinks: boolean; maxPaginas: number }) {
  const dominios = dominiosPermitidos();
  const fila: string[] = [];
  const visitadas = new Set<string>();
  const achados = new Map<string, Achado>();
  const log: string[] = [];

  for (const s of sementes) {
    try {
      const u = new URL(s.trim());
      if (/^https?:$/.test(u.protocol)) fila.push(u.toString());
    } catch { log.push(`endereço inválido: ${s}`); }
  }

  while (fila.length && visitadas.size < opts.maxPaginas) {
    const lote = fila.splice(0, 4).filter((u) => !visitadas.has(u));
    lote.forEach((u) => visitadas.add(u));
    const paginas = await Promise.all(lote.map(async (u) => ({ u, html: await baixa(u) })));
    for (const { u, html } of paginas) {
      if (!html) { log.push(`não lida (bloqueada, fora do ar ou sem HTML): ${u}`); continue; }
      const novos = extraiEmails(html, u, dominios);
      for (const a of novos) if (!achados.has(a.email)) achados.set(a.email, a);
      log.push(`${novos.length} e-mail(s) em ${u}`);
      if (opts.seguirLinks && sementes.some((s) => new URL(s).host === new URL(u).host)) {
        for (const l of linksRelevantes(html, new URL(u))) if (!visitadas.has(l) && !fila.includes(l)) fila.push(l);
      }
    }
    if (fila.length) await new Promise((r) => setTimeout(r, 500)); // não sobrecarregar os sites
  }
  return { achados: [...achados.values()], paginas: visitadas.size, log };
}
