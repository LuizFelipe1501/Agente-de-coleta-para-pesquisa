import nodemailer from 'nodemailer';

let transp: nodemailer.Transporter | null = null;

function transporte() {
  if (!transp) {
    transp = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transp;
}

export const MARCA_EMAIL = 'pesquisa-capital.bot';

export function remetente() {
  const email = process.env.EMAIL_REMETENTE || process.env.SMTP_USER || '';
  const nome = process.env.NOME_REMETENTE || 'Capital Consultoria Júnior – FGV';
  return { email, nome, formatado: `"${nome}" <${email}>` };
}

// Versão HTML do e-mail: o endereço do link fica escondido atrás de um texto clicável.
// A versão em texto puro continua indo junto (leitores que não mostram HTML).
const TEXTO_DO_LINK = 'Clique aqui para responder ao questionário';
const URL_RE = 'https?:\\/\\/[^\\s<]+[^\\s<.,;:!?)]';
const ehPesquisa = (url: string) => /\/p\/[a-z0-9-]+$/i.test(url) || /surveymonkey\.com/i.test(url);
const ancora = (url: string, rotulo: string) => `<a href="${url}" style="color:#45108A;font-weight:bold">${rotulo}</a>`;
export function emailHtml(texto: string): string {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const corpo = esc(texto)
    // "Acesse o questionário aqui: <link>"  ->  a própria frase vira o link
    .replace(new RegExp(`((?:Acesse|Acessar|Responda|Responder|Participe)[^\\n<]{0,60}?aqui):?[ \\t]*(${URL_RE})`, 'gi'),
      (tudo, frase: string, url: string) => (ehPesquisa(url) ? `${ancora(url, frase)}.` : tudo))
    // demais links da pesquisa viram texto clicável; outros links aparecem como estão
    .replace(new RegExp(`(?<!href=")${URL_RE}`, 'g'), (url) => (ehPesquisa(url) ? ancora(url, TEXTO_DO_LINK) : ancora(url, url)));
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#222">${corpo.replace(/\n/g, '<br>')}</div>`;
}

export async function enviaEmail(opts: {
  para: string; assunto: string; texto: string; inReplyTo?: string; references?: string[];
}) {
  const r = remetente();
  await transporte().sendMail({
    from: r.formatado,
    to: opts.para,
    subject: opts.assunto,
    text: opts.texto,
    html: emailHtml(opts.texto),
    inReplyTo: opts.inReplyTo,
    references: opts.references,
    // marca própria: a leitura da caixa só mexe em respostas a e-mails do bot
    messageId: `<${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 10)}@${MARCA_EMAIL}>`,
    headers: {
      'List-Unsubscribe': `<mailto:${r.email}?subject=remover>`,
    },
  });
}

// Evolution API v2 – POST /message/sendText/{instancia}
export async function enviaWhatsApp(numero: string, texto: string, instancia?: string) {
  const url = (process.env.EVOLUTION_URL || '').replace(/\/$/, '');
  const inst = instancia || process.env.EVOLUTION_INSTANCIA;
  const chave = process.env.EVOLUTION_API_KEY;
  if (!url || !inst || !chave) throw new Error('Evolution API não configurada');
  const r = await fetch(`${url}/message/sendText/${encodeURIComponent(inst)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: chave },
    body: JSON.stringify({ number: numero, text: texto, linkPreview: false }),
  });
  if (!r.ok) throw new Error(`Evolution ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json().catch(() => null);
  const id: string | undefined = j?.key?.id;
  // guarda o id para o webhook saber que esta mensagem foi do bot, não do dono do número
  if (id) {
    const { db } = await import('./db');
    await db().from('msgs_bot').insert({ id });
  }
  return id;
}

export const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
