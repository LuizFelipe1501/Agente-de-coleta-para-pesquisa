// Modo assistido do WhatsApp (grátis): o bot separa um lote de contatos da fila, escolhe a versão
// e monta o link do WhatsApp com a mensagem pronta. A pessoa do time só clica, envia e marca.
import { exige } from '@/lib/auth';
import { db, checa } from '@/lib/db';
import { config } from '@/lib/config';
import { criaAlocador, versao, renderiza, linkDe } from '@/lib/versoes';
import { LEMBRETE_WPP } from '@/lib/lembretes';
import Lote, { Item } from './Lote';
import { listaNumeros } from '@/lib/numeros';

export const dynamic = 'force-dynamic';

type Linha = { id: number; contato: string; nome: string | null; slug: string | null; enviado_em: string | null; reservado_em: string | null };

const RESERVA_HORAS = 2;

async function reservaLote(numero: string): Promise<Linha[]> {
  const livreAntes = new Date(Date.now() - RESERVA_HORAS * 3600000).toISOString();
  const corteLembrete = new Date(Date.now() - config.diasLembrete * 86400000).toISOString();
  const lote = config.wppLotePorPessoa;

  const lembretes = checa(
    await db().from('fila').select('*').eq('canal', 'wpp').eq('numero', numero).is('lembrete_em', null)
      .not('enviado_em', 'is', null).lte('enviado_em', corteLembrete)
      .or(`reservado_em.is.null,reservado_em.lt.${livreAntes}`).limit(lote),
  ) as Linha[];
  const novos = lembretes.length >= lote ? [] : (checa(
    await db().from('fila').select('*').eq('canal', 'wpp').eq('numero', numero).is('enviado_em', null).is('erro', null)
      .or(`reservado_em.is.null,reservado_em.lt.${livreAntes}`).order('id').limit(lote - lembretes.length),
  ) as Linha[]);

  const agora = new Date().toISOString();
  const aloc = novos.length ? await criaAlocador('wpp') : null;
  for (const l of lembretes) {
    await db().from('fila').update({ reservado_em: agora }).eq('id', l.id);
  }
  for (const l of novos) {
    const slug = aloc && !aloc.vazio ? aloc.proxima() : null;
    if (!slug) break;
    await db().from('fila').update({ reservado_em: agora, slug }).eq('id', l.id);
    l.slug = slug;
  }
  return [...lembretes, ...novos.filter((n) => n.slug)];
}

async function minhasReservas(numero: string): Promise<Linha[]> {
  const livreAntes = new Date(Date.now() - RESERVA_HORAS * 3600000).toISOString();
  return checa(
    await db().from('fila').select('*').eq('canal', 'wpp').eq('numero', numero).gte('reservado_em', livreAntes).order('id').limit(config.wppLotePorPessoa * 3),
  ) as Linha[];
}

export default async function FilaWhatsApp({ searchParams }: { searchParams: Promise<{ lote?: string; numero?: string }> }) {
  await exige('time');
  const sp = await searchParams;
  const numeros = await listaNumeros(true);
  const numero = numeros.find((n) => n.id === sp.numero);
  if (!numero) {
    return (
      <>
        <h1>Fila de WhatsApp</h1>
        <p className="sub">Escolha o seu número. Você só vê os contatos que são seus.</p>
        <section className="linha">
          {numeros.length === 0 && <span>Nenhum número cadastrado. Peça para quem coordena cadastrar no painel.</span>}
          {numeros.map((n) => <a key={n.id} href={`/time/whatsapp?numero=${n.id}`}><button type="button">{n.nome}</button></a>)}
        </section>
      </>
    );
  }
  const itens = sp.lote ? await minhasReservas(numero.id) : [];
  const ids = sp.lote ? sp.lote.split(',').map(Number) : [];
  const meus = itens.filter((i) => ids.includes(i.id));

  const textos = new Map<string, string>();
  for (const s of new Set(meus.map((m) => m.slug).filter(Boolean) as string[])) textos.set(s, (await versao(s)).texto);

  async function pegarLote(fd: FormData) {
    'use server';
    await exige('time');
    const n = String(fd.get('numero'));
    const l = await reservaLote(n);
    const { redirect } = await import('next/navigation');
    redirect(l.length ? `/time/whatsapp?numero=${n}&lote=${l.map((x) => x.id).join(',')}` : `/time/whatsapp?numero=${n}&lote=vazio`);
  }

  const pendentes = meus;

  return (
    <>
      <h1>Fila de WhatsApp – {numero.nome}</h1>
      <p className="sub">
        Abra as conversas uma a uma ou várias de uma vez, envie em cada aba e confirme no fim. Envie do seu WhatsApp,
        no máximo {config.wppLotePorPessoa} por lote e com calma entre um e outro.
      </p>

      {sp.lote === 'vazio' && <div className="aviso">A fila de WhatsApp está vazia agora.</div>}

      {pendentes.length === 0 ? (
        <form action={pegarLote}><input type="hidden" name="numero" value={numero.id} /><button>Pegar um lote de {config.wppLotePorPessoa} contatos</button></form>
      ) : (
        <Lote
          itens={pendentes.map((m): Item => {
            const lembrete = !!m.enviado_em;
            const nome = (m.nome || '').split(/\s+/)[0];
            const texto = lembrete
              ? LEMBRETE_WPP(nome, linkDe(m.slug!))
              : renderiza(textos.get(m.slug!) || '', m.slug!, m.nome);
            return {
              id: m.id, nome: m.nome, contato: m.contato,
              tipo: lembrete ? 'lembrete' : `versão ${m.slug}`,
              wa: `https://wa.me/${m.contato}?text=${encodeURIComponent(texto)}`,
            };
          })}
        />
      )}
    </>
  );
}
