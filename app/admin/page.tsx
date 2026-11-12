import { exige } from '@/lib/auth';
import { db, checa } from '@/lib/db';
import { config, CANAIS, NOME_CANAL, Canal } from '@/lib/config';
import { agoraBrasilia, dentroDaJanela } from '@/lib/versoes';
import { listaNumeros } from '@/lib/numeros';
import { salvaRespostas } from './acoes';

export const dynamic = 'force-dynamic';

type Linha = { slug: string; canal: Canal; angulo: string; status: string; envios: number; cliques: number };

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '–');

export default async function VisaoGeral() {
  await exige('admin');

  const [stats, versoes, respostas, fila, obj, lembretes] = await Promise.all([
    db().from('stats_versoes').select('*').order('slug'),
    db().from('versoes').select('slug,texto,status'),
    db().from('respostas').select('*').order('dia', { ascending: false }).limit(7),
    db().from('fila').select('canal,enviado_em,erro'),
    db().from('objecoes').select('categoria').gte('criado_em', new Date(Date.now() - 7 * 86400000).toISOString()),
    db().from('envios').select('qtd').eq('tipo', 'lembrete'),
  ]);
  const S = checa(stats) as Linha[];
  const V = checa(versoes) as { slug: string; texto: string; status: string }[];
  const R = checa(respostas) as { dia: string; total: number }[];
  const F = checa(fila) as { canal: string; enviado_em: string | null; erro: string | null }[];
  const O = checa(obj) as { categoria: string }[];
  const totalLembretes = (checa(lembretes) as { qtd: number }[]).reduce((s, l) => s + l.qtd, 0);
  const numeros = await listaNumeros();

  const totalResp = R[0]?.total ?? 0;
  const totalEnvios = S.reduce((s, l) => s + l.envios, 0);
  const totalCliques = S.reduce((s, l) => s + l.cliques, 0);

  const contaObj: Record<string, number> = {};
  for (const o of O) contaObj[o.categoria] = (contaObj[o.categoria] || 0) + 1;

  // O que ainda impede o bot de rodar
  const pendencias: { texto: string; href: string; botao: string }[] = [];
  const semTexto = V.filter((v) => v.status === 'ativa' && v.texto.includes('[COLE AQUI'));
  if (semTexto.length) pendencias.push({ texto: `${semTexto.length} versão(ões) A ainda com texto provisório. O disparo desses canais fica parado.`, href: '/admin/mensagens', botao: 'Preencher mensagens' });
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) pendencias.push({ texto: 'E-mail não configurado (SMTP_USER e SMTP_PASS na Vercel).', href: 'https://vercel.com/dashboard', botao: 'Abrir Vercel' });
  if (!process.env.GEMINI_API_KEY) pendencias.push({ texto: 'Chave do Gemini não configurada: respostas automáticas e sugestões desligadas.', href: 'https://aistudio.google.com', botao: 'Criar chave' });
  if (numeros.length === 0) pendencias.push({ texto: 'Nenhum número de WhatsApp cadastrado.', href: '/admin/contatos', botao: 'Cadastrar números' });
  if (!F.length) pendencias.push({ texto: 'Filas vazias: nenhum contato para disparar.', href: '/admin/contatos', botao: 'Adicionar contatos' });

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Visão geral</h1>
          <p className="sub">Disparo automático {dentroDaJanela() ? 'liberado agora' : 'fora do horário agora'} ({config.horaInicio}h–{config.horaFim}h, dias úteis)</p>
        </div>
        <a className="botao sec" href="/api/registro">Baixar registro (CSV)</a>
      </div>

      {pendencias.length > 0 && (
        <section className="pendencias">
          <h3>Para o bot rodar</h3>
          {pendencias.map((p) => (
            <div key={p.texto} className="pendencia">
              <span>{p.texto}</span>
              <a className="botao" href={p.href} target={p.href.startsWith('http') ? '_blank' : undefined}>{p.botao}</a>
            </div>
          ))}
        </section>
      )}

      <div className="grade">
        <div className="caixa">
          <div className="rot">Respostas completas</div>
          <div className="num">{totalResp} / {config.meta}</div>
          <div className="barra"><div style={{ width: `${Math.min(100, (100 * totalResp) / config.meta)}%` }} /></div>
        </div>
        <div className="caixa"><div className="rot">Envios (primeiro contato)</div><div className="num">{totalEnvios}</div><div className="rot">+ {totalLembretes} lembretes</div></div>
        <div className="caixa"><div className="rot">Cliques no link</div><div className="num">{totalCliques}</div><div className="rot">{pct(totalCliques, totalEnvios)} dos envios</div></div>
        <div className="caixa"><div className="rot">Respostas por clique</div><div className="num">{pct(totalResp, totalCliques)}</div><div className="rot">abaixo de 30%: avisar a mestranda</div></div>
      </div>

      <section>
        <h3>Total de respostas informado pela mestranda</h3>
        <form action={salvaRespostas} className="linha">
          <input type="text" name="dia" defaultValue={agoraBrasilia().data} style={{ width: 140 }} />
          <input type="number" name="total" min={0} placeholder="Total acumulado" style={{ width: 180 }} required />
          <button>Salvar</button>
        </form>
        {R.length > 0 && <p className="rot" style={{ marginBottom: 0 }}>Últimos: {R.map((r) => `${r.dia.slice(8)}/${r.dia.slice(5, 7)} – ${r.total}`).join(' · ')}</p>}
      </section>

      <h2>Canais</h2>
      <div className="grade">
        {CANAIS.map((canal) => {
          const ls = S.filter((l) => l.canal === canal && l.status === 'ativa');
          const env = ls.reduce((s, l) => s + l.envios, 0);
          const cli = ls.reduce((s, l) => s + l.cliques, 0);
          const lider = [...ls].filter((l) => l.envios > 0).sort((a, b) => b.cliques / b.envios - a.cliques / a.envios)[0];
          const naFila = F.filter((f) => f.canal === canal && !f.enviado_em && !f.erro).length;
          return (
            <div className="caixa canal" key={canal}>
              <div className="rot">{NOME_CANAL[canal]}</div>
              <div className="num">{pct(cli, env)}</div>
              <div className="rot">{env} envios · {cli} cliques{canal === 'email' || canal === 'wpp' ? ` · ${naFila} na fila` : ''}</div>
              <div className="rot">Na frente: {lider ? `${lider.slug} (${pct(lider.cliques, lider.envios)})` : 'ainda sem dados'}</div>
              <a className="botao sec" href={`/admin/mensagens?canal=${canal}`}>Ver mensagens</a>
            </div>
          );
        })}
      </div>

      <h2>Motivos de recusa (últimos 7 dias)</h2>
      <section>
        {Object.keys(contaObj).length === 0 ? (
          <span className="rot">Nenhuma resposta classificada ainda.</span>
        ) : (
          <table>
            <tbody>
              {Object.entries(contaObj).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                <tr key={k}><td>{k.replaceAll('_', ' ')}</td><td className="n">{n}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
