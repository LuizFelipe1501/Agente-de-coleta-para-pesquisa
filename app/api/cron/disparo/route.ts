// Disparo automático. Chamado a cada 10 minutos pelo agendador (GitHub Actions).
// E-mail: uma fila só. WhatsApp (modo evolution): cada número dispara só os próprios contatos,
// com limite diário próprio, todos em paralelo.
// Em cada execução: lembretes vencidos primeiro, depois contatos novos.
import { db, checa } from '@/lib/db';
import { config } from '@/lib/config';
import { cronAutorizado } from '@/lib/auth';
import {
  criaAlocador, versao, renderiza, estaNoOptout, dentroDaJanela, enviadosHoje, linkDe,
} from '@/lib/versoes';
import { enviaEmail, enviaWhatsApp, espera } from '@/lib/envio';
import { LEMBRETE_EMAIL, LEMBRETE_WPP } from '@/lib/lembretes';
import { listaNumeros, enviadosHojeNumero, registraContatado, Numero } from '@/lib/numeros';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

type Linha = { id: number; canal: 'email' | 'wpp'; contato: string; nome: string | null; slug: string | null; enviado_em: string | null };

async function processa(canal: 'email' | 'wpp', log: string[], numero?: Numero) {
  const rotulo = numero ? `wpp/${numero.id}` : canal;
  const limite = numero ? numero.limite_dia : config.emailLimiteDia;
  const porExec = numero ? config.wppPorExecucao : config.emailPorExecucao;
  const hoje = numero ? await enviadosHojeNumero(numero.id) : await enviadosHoje('email');
  let vagas = Math.min(porExec, limite - hoje);
  if (vagas <= 0) { log.push(`${rotulo}: limite do dia atingido (${hoje})`); return; }

  const filtro = () => {
    let q = db().from('fila').select('*').eq('canal', canal);
    if (numero) q = q.eq('numero', numero.id);
    return q;
  };
  const enviar = async (l: Linha, texto: string, assunto?: string) => {
    if (canal === 'email') await enviaEmail({ para: l.contato, assunto: assunto || 'Pesquisa FGV', texto });
    else await enviaWhatsApp(l.contato, texto, numero!.instancia);
  };
  const pausa = () => (canal === 'wpp' ? espera(config.wppIntervaloSeg * 1000) : Promise.resolve());

  // 1. Lembretes
  const corte = new Date(Date.now() - config.diasLembrete * 86400000).toISOString();
  const lembretes = checa(
    await filtro().is('lembrete_em', null).not('enviado_em', 'is', null).lte('enviado_em', corte).limit(vagas),
  ) as Linha[];
  for (const l of lembretes) {
    if (vagas <= 0) break;
    if (await estaNoOptout(l.contato)) { await db().from('fila').delete().eq('id', l.id); continue; }
    try {
      const nome = (l.nome || '').split(/\s+/)[0];
      const link = linkDe(l.slug!);
      if (canal === 'email') await enviar(l, LEMBRETE_EMAIL(nome || 'servidor(a)', link), 'Lembrete: pesquisa FGV com servidores públicos');
      else await enviar(l, LEMBRETE_WPP(nome, link));
      await db().from('envios').insert({ slug: l.slug, tipo: 'lembrete', numero: numero?.id ?? null });
      await db().from('fila').delete().eq('id', l.id); // terminou o ciclo: some da fila
      vagas--;
      log.push(`${rotulo}: lembrete enviado`);
      await pausa();
    } catch (e: any) {
      await db().from('fila').update({ erro: String(e.message).slice(0, 300) }).eq('id', l.id);
      log.push(`${rotulo}: erro no lembrete – ${e.message}`);
    }
  }
  if (vagas <= 0) return;

  // 2. Novos
  const novos = checa(
    await filtro().is('enviado_em', null).is('erro', null).order('id').limit(vagas),
  ) as Linha[];
  if (novos.length === 0) { log.push(`${rotulo}: fila vazia`); return; }

  const aloc = await criaAlocador(canal);
  if (aloc.vazio) { log.push(`${rotulo}: nenhuma versão ativa`); return; }
  const cache = new Map<string, Awaited<ReturnType<typeof versao>>>();

  for (const l of novos) {
    if (await estaNoOptout(l.contato)) { await db().from('fila').delete().eq('id', l.id); continue; }
    const slug = aloc.proxima();
    if (!cache.has(slug)) cache.set(slug, await versao(slug));
    const v = cache.get(slug)!;
    if (v.texto.includes('[COLE AQUI')) { log.push(`${rotulo}: versão ${slug} ainda sem texto, pausando`); return; }
    const texto = renderiza(v.texto, slug, l.nome, canal === 'email' ? 'servidor(a)' : '');
    try {
      await enviar(l, texto, v.assunto || undefined);
      await db().from('fila').update({ slug, enviado_em: new Date().toISOString() }).eq('id', l.id);
      await db().from('envios').insert({ slug, tipo: 'primeiro', numero: numero?.id ?? null });
      if (numero) await registraContatado(l.contato, numero.id);
      log.push(`${rotulo}: enviado (${slug})`);
    } catch (e: any) {
      await db().from('fila').update({ erro: String(e.message).slice(0, 300) }).eq('id', l.id);
      log.push(`${rotulo}: erro – ${e.message}`);
    }
    await pausa();
  }
}

export async function GET(req: Request) {
  if (!cronAutorizado(req)) return new Response('não autorizado', { status: 401 });
  const forcar = new URL(req.url).searchParams.get('forcar') === '1';
  const log: string[] = [];

  // Limpeza: o que ficou na fila além do prazo é apagado.
  const limite = new Date(Date.now() - config.diasLimpeza * 86400000).toISOString();
  await db().from('fila').delete().lte('criado_em', limite);
  await db().from('msgs_bot').delete().lte('criado_em', new Date(Date.now() - 2 * 86400000).toISOString());

  if (!forcar && !dentroDaJanela()) return Response.json({ ok: true, log: ['fora da janela de envio'] });

  const tarefas: Promise<void>[] = [
    processa('email', log).catch((e) => { log.push(`email: falha geral – ${e.message}`); }),
  ];
  if (config.wppModo === 'evolution') {
    for (const n of await listaNumeros(true)) {
      tarefas.push(processa('wpp', log, n).catch((e) => { log.push(`wpp/${n.id}: falha geral – ${e.message}`); }));
    }
  }
  await Promise.all(tarefas);
  return Response.json({ ok: true, log });
}
