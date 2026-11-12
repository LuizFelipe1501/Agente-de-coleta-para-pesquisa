// Webhook global da Evolution API (evento MESSAGES_UPSERT), para todos os números.
// Os números são WhatsApps pessoais do time, então o bot só mexe em conversas da pesquisa:
// contatos que receberam mensagem daquele número nos últimos 15 dias e a quem o dono ainda não
// respondeu à mão. Todo o resto é ignorado e nada é guardado.
import { db } from '@/lib/db';
import { config } from '@/lib/config';
import { decide } from '@/lib/agente';
import { enviaWhatsApp } from '@/lib/envio';
import { estaNoOptout, normalizaContato, registraOptout } from '@/lib/versoes';
import { numeroPorInstancia, podeResponder, marcaHumano } from '@/lib/numeros';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

function textoDa(msg: any): string {
  return msg?.conversation || msg?.extendedTextMessage?.text || msg?.imageMessage?.caption || msg?.videoMessage?.caption || '';
}

export async function POST(req: Request) {
  const segredo = process.env.WEBHOOK_SECRET;
  if (!segredo || new URL(req.url).searchParams.get('chave') !== segredo) {
    return new Response('não autorizado', { status: 401 });
  }

  const corpo = await req.json().catch(() => null);
  const evento = String(corpo?.event || '').toLowerCase().replace('_', '.');
  if (evento !== 'messages.upsert') return Response.json({ ok: true });

  const numero = await numeroPorInstancia(String(corpo?.instance || ''));
  if (!numero) return Response.json({ ok: true });

  const itens = Array.isArray(corpo.data) ? corpo.data : [corpo.data];
  for (const d of itens) {
    const jid: string = d?.key?.remoteJid || '';
    if (!jid || jid.endsWith('@g.us') || jid.endsWith('@broadcast') || jid.endsWith('@newsletter')) continue;
    const contato = normalizaContato(jid);

    // Mensagem saindo do número: se não foi o bot que mandou, foi o dono respondendo pelo celular.
    // A partir daí a conversa é dele e o bot não responde mais esse contato.
    if (d?.key?.fromMe) {
      await new Promise((r) => setTimeout(r, 3000)); // dá tempo de o envio do bot registrar o id
      const { data } = await db().from('msgs_bot').select('id').eq('id', String(d?.key?.id || '')).maybeSingle();
      if (!data) await marcaHumano(contato, numero.id);
      continue;
    }

    const texto = textoDa(d.message);
    if (!texto) continue;
    if (!(await podeResponder(contato, numero.id))) continue; // conversa pessoal: não é com o bot
    if (await estaNoOptout(contato)) continue;

    const dec = await decide(texto, 'wpp');
    if (dec.categoria !== 'outro' || dec.acao === 'remover') {
      await db().from('objecoes').insert({ canal: 'wpp', categoria: dec.categoria });
    }

    try {
      if (dec.acao === 'remover') {
        await registraOptout(contato);
        if (dec.resposta) await enviaWhatsApp(contato, dec.resposta, numero.instancia);
      } else if (!numero.responder) {
        continue; // respostas automáticas desligadas neste número: o dono responde
      } else if (dec.acao === 'responder' && dec.resposta) {
        await enviaWhatsApp(contato, dec.resposta.replaceAll('{link}', config.surveyUrl), numero.instancia);
      } else if (dec.acao === 'escalar') {
        // não responde: a mensagem já está no celular do dono do número, que responde à mão
        await marcaHumano(contato, numero.id);
      }
    } catch (e) {
      console.error('falha ao responder no WhatsApp', e);
    }
  }
  return Response.json({ ok: true });
}
