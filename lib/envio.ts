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

export function remetente() {
  const email = process.env.EMAIL_REMETENTE || process.env.SMTP_USER || '';
  const nome = process.env.NOME_REMETENTE || 'Capital Consultoria Júnior – FGV';
  return { email, nome, formatado: `"${nome}" <${email}>` };
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
    inReplyTo: opts.inReplyTo,
    references: opts.references,
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
