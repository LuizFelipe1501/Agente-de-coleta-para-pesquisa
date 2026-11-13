// Lê respostas que chegaram por e-mail e responde com o agente.
// O que for "escalar" fica marcado com estrela e como não lido, para uma pessoa responder.
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { db } from '@/lib/db';
import { config } from '@/lib/config';
import { cronAutorizado } from '@/lib/auth';
import { decide } from '@/lib/agente';
import { enviaEmail, remetente, MARCA_EMAIL } from '@/lib/envio';
import { registraOptout } from '@/lib/versoes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function ehAutomatica(h: Map<string, any>): boolean {
  const auto = String(h.get('auto-submitted') || '').toLowerCase();
  if (auto && auto !== 'no') return true;
  if (h.get('list-id') || h.get('x-autoreply') || h.get('x-autorespond')) return true;
  const prec = String(h.get('precedence') || '').toLowerCase();
  return ['bulk', 'auto_reply', 'list', 'junk'].includes(prec);
}

function semCitacao(texto: string): string {
  // corta o histórico citado ("Em ... escreveu:", linhas com ">")
  const linhas = texto.split('\n');
  const saida: string[] = [];
  for (const l of linhas) {
    if (/^(em|on) .+(escreveu|wrote):?\s*$/i.test(l.trim())) break;
    if (/^-{2,}\s*(mensagem original|original message)/i.test(l.trim())) break;
    if (l.trim().startsWith('>')) continue;
    saida.push(l);
  }
  return saida.join('\n').trim();
}

export async function GET(req: Request) {
  if (!cronAutorizado(req)) return new Response('não autorizado', { status: 401 });
  const log: string[] = [];
  const eu = remetente().email.toLowerCase();

  const imap = new ImapFlow({
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: Number(process.env.IMAP_PORT || 993),
    secure: true,
    auth: { user: process.env.SMTP_USER || '', pass: process.env.SMTP_PASS || '' },
    logger: false,
  });

  await imap.connect();
  const trava = await imap.getMailboxLock('INBOX');
  try {
    // Só respostas a e-mails enviados pelo bot. O resto da caixa não é tocado.
    const uids = (await imap.search({
      seen: false,
      or: [{ header: { 'in-reply-to': MARCA_EMAIL } }, { header: { references: MARCA_EMAIL } }],
    }, { uid: true })) || [];
    for (const uid of uids.slice(0, 15)) {
      const msg = await imap.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg || !msg.source) continue;
      const m = await simpleParser(msg.source);
      const de = m.from?.value?.[0]?.address?.toLowerCase() || '';
      const refs = [m.inReplyTo, ...(Array.isArray(m.references) ? m.references : m.references ? [m.references] : [])]
        .filter(Boolean).join(' ');
      if (!refs.includes(MARCA_EMAIL)) continue; // não é resposta ao bot: não mexe

      if (!de || de === eu || ehAutomatica(m.headers as any) || /mailer-daemon|postmaster|no-?reply/i.test(de)) {
        await imap.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
        log.push('ignorada (automática)');
        continue;
      }

      const corpo = semCitacao(m.text || '');
      const d = await decide(corpo, 'email');
      if (d.categoria !== 'outro' || d.acao === 'remover') {
        await db().from('objecoes').insert({ canal: 'email', categoria: d.categoria });
      }

      const responder = async (texto: string) => {
        const assunto = m.subject?.toLowerCase().startsWith('re:') ? m.subject : `Re: ${m.subject || 'Pesquisa FGV'}`;
        const refs = [...(Array.isArray(m.references) ? m.references : m.references ? [m.references] : []), m.messageId].filter(Boolean) as string[];
        await enviaEmail({ para: de, assunto, texto: `${texto}\n\nCapital Consultoria Júnior – FGV`, inReplyTo: m.messageId, references: refs });
      };

      if (d.acao === 'remover') {
        await registraOptout(de);
        if (d.resposta) await responder(d.resposta.replaceAll('{link}', config.surveyUrl));
        await imap.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
        log.push('removida da lista');
      } else if (d.acao === 'responder' && d.resposta) {
        await responder(d.resposta.replaceAll('{link}', config.surveyUrl));
        await imap.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
        log.push('respondida');
      } else if (d.acao === 'ignorar') {
        await imap.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
        log.push('ignorada');
      } else {
        // escalar: estrela e continua não lida
        await imap.messageFlagsAdd(String(uid), ['\\Flagged'], { uid: true });
        log.push('escalada para humano');
      }
    }
  } finally {
    trava.release();
    await imap.logout();
  }
  return Response.json({ ok: true, log });
}
