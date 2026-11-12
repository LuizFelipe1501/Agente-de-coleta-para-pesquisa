import { redirect } from 'next/navigation';
import { exige } from '@/lib/auth';
import { db } from '@/lib/db';
import { criaAlocador, versao, renderiza } from '@/lib/versoes';
import Copiar from './Copiar';

export const dynamic = 'force-dynamic';

export default async function Time({ searchParams }: { searchParams: Promise<{ canal?: string; ok?: string }> }) {
  await exige('time');
  const sp = await searchParams;
  const canal = sp.canal === 'grupo' ? 'grupo' : 'direto';

  const aloc = await criaAlocador(canal);
  const v = aloc.vazio ? null : await versao(aloc.proxima());
  const texto = v ? renderiza(v.texto, v.slug) : '';

  async function registra(fd: FormData) {
    'use server';
    await exige('time');
    const slug = String(fd.get('slug'));
    const qtd = Math.max(0, Math.min(200, Number(fd.get('qtd')) || 0));
    const c = String(fd.get('canal'));
    if (qtd > 0) await db().from('envios').insert({ slug, qtd, tipo: 'primeiro' });
    redirect(`/time?canal=${c}&ok=${qtd}`);
  }

  return (
    <>
      <h1>Mensagem do momento</h1>
      <p className="sub">Copie, troque o que está entre colchetes e envie. Depois registre quantas mandou.</p>
      <nav>
        <a href="/time?canal=direto" style={{ fontWeight: canal === 'direto' ? 700 : 400 }}>Para contatos</a>
        <a href="/time?canal=grupo" style={{ fontWeight: canal === 'grupo' ? 700 : 400 }}>Para grupos</a>
        <a href="/time/whatsapp">Fila de WhatsApp</a>
      </nav>

      {sp.ok && Number(sp.ok) > 0 && <div className="aviso">Registrado: {sp.ok} envio(s). Obrigado!</div>}

      {!v ? (
        <section>Nenhuma versão ativa para este canal. Fale com quem coordena o projeto.</section>
      ) : v.texto.includes('[COLE AQUI') ? (
        <section>A versão {v.slug} ainda não tem texto. Peça para quem coordena preencher no painel.</section>
      ) : (
        <section>
          <div className="msg">{texto}</div>
          <div className="linha" style={{ marginTop: 12 }}>
            <Copiar texto={texto} />
            <span className="rot">Versão {v.slug}. Use esta mesma mensagem para todos os envios desta rodada.</span>
          </div>

          <form action={registra} style={{ marginTop: 20 }}>
            <input type="hidden" name="slug" value={v.slug} />
            <input type="hidden" name="canal" value={canal} />
            <label className="rot">Quantas mensagens você enviou com esta versão?</label>
            <div className="linha">
              <input type="number" name="qtd" min={1} max={200} defaultValue={canal === 'grupo' ? 1 : 10} style={{ width: 120 }} />
              <button>Registrar e pegar a próxima</button>
            </div>
          </form>
        </section>
      )}

      <section>
        <h3 style={{ marginTop: 0 }}>Combinados</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {canal === 'direto' ? (
            <>
              <li>Só para quem você conhece e é servidor público. No máximo 15 por dia.</li>
              <li>Não ofereça nada em troca e não insista se a pessoa disser não.</li>
              <li>Dúvida que você não sabe responder: passe para quem coordena.</li>
            </>
          ) : (
            <>
              <li>Uma mensagem por grupo. Não repetir no mesmo grupo antes de 10 dias.</li>
              <li>Se o grupo tiver regra de divulgação, peça licença ao admin antes.</li>
            </>
          )}
        </ul>
      </section>
    </>
  );
}
