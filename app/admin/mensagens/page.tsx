import { exige } from '@/lib/auth';
import { db, checa } from '@/lib/db';
import { CANAIS, NOME_CANAL, Canal } from '@/lib/config';
import { chanceDeSerMelhor } from '@/lib/bandit';
import { mudaStatus, editaVersao, geraSugestoes } from '../acoes';

export const dynamic = 'force-dynamic';

type Linha = { slug: string; canal: Canal; angulo: string; status: string; envios: number; cliques: number };
type V = { slug: string; texto: string; assunto: string | null };

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '–');

export default async function Mensagens({ searchParams }: { searchParams: Promise<{ canal?: string; editar?: string }> }) {
  await exige('admin');
  const sp = await searchParams;
  const canal = (CANAIS as readonly string[]).includes(sp.canal || '') ? (sp.canal as Canal) : 'direto';

  const S = checa(await db().from('stats_versoes').select('*').eq('canal', canal).order('slug')) as Linha[];
  const textos = new Map((checa(await db().from('versoes').select('slug,texto,assunto').eq('canal', canal)) as V[]).map((v) => [v.slug, v]));
  const ativas = S.filter((l) => l.status === 'ativa');
  const chance = chanceDeSerMelhor(ativas);
  const somaEnv = ativas.reduce((s, l) => s + l.envios, 0);
  const editando = sp.editar ? textos.get(sp.editar) : undefined;
  const pendentes = S.filter((l) => l.status === 'pendente').length;

  return (
    <>
      <h1>Mensagens</h1>
      <p className="sub">Cada canal testa suas versões. O bot manda mais as que geram mais cliques.</p>

      <div className="abas">
        {CANAIS.map((c) => (
          <a key={c} href={`/admin/mensagens?canal=${c}`} className={c === canal ? 'ativo' : ''}>{NOME_CANAL[c]}</a>
        ))}
      </div>

      {editando && (
        <section className="destaque">
          <div className="cabecalho">
            <h3>Editando {editando.slug}</h3>
            <a className="botao sec" href={`/admin/mensagens?canal=${canal}`}>Fechar</a>
          </div>
          <form action={editaVersao}>
            <input type="hidden" name="slug" value={editando.slug} />
            {canal === 'email' && (
              <>
                <label className="rot">Assunto</label>
                <input type="text" name="assunto" defaultValue={editando.assunto || ''} style={{ marginBottom: 10 }} />
              </>
            )}
            <label className="rot">Texto. Use {'{link}'} onde vai o link da pesquisa{canal === 'email' || canal === 'wpp' ? ' e {nome} para o primeiro nome' : ''}.</label>
            <textarea name="texto" defaultValue={editando.texto} style={{ minHeight: 220 }} />
            <div className="linha" style={{ marginTop: 10 }}>
              <button>Salvar texto</button>
              <a className="botao sec" href={`/admin/mensagens?canal=${canal}`}>Cancelar</a>
            </div>
          </form>
        </section>
      )}

      {pendentes > 0 && <div className="aviso">{pendentes} sugestão(ões) aguardando aprovação neste canal.</div>}

      <section>
        <table>
          <thead>
            <tr><th>Versão</th><th>Ângulo</th><th>Status</th><th className="n">Envios</th><th className="n">Cliques</th><th className="n">Taxa</th><th className="n">Chance de ser a melhor</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {S.map((l) => {
              const v = textos.get(l.slug)!;
              const provisoria = v.texto.includes('[COLE AQUI');
              return (
                <tr key={l.slug}>
                  <td><strong>{l.slug}</strong>{provisoria && <><br /><span className="tag pendente">sem texto</span></>}</td>
                  <td>{l.angulo}<div className="previa">{v.texto.slice(0, 110)}{v.texto.length > 110 ? '…' : ''}</div></td>
                  <td><span className={`tag ${l.status}`}>{l.status}</span></td>
                  <td className="n">{l.envios}</td>
                  <td className="n">{l.cliques}</td>
                  <td className="n">{pct(l.cliques, l.envios)}</td>
                  <td className="n">{l.status === 'ativa' && somaEnv > 0 ? `${Math.round(100 * (chance[l.slug] || 0))}%` : '–'}</td>
                  <td>
                    <div className="acoes">
                      <a className="botao" href={`/admin/mensagens?canal=${canal}&editar=${l.slug}`}>Editar</a>
                      {l.status !== 'ativa' && (
                        <form action={mudaStatus}><input type="hidden" name="slug" value={l.slug} /><input type="hidden" name="status" value="ativa" /><button className="sec">{l.status === 'pendente' ? 'Aprovar' : 'Ativar'}</button></form>
                      )}
                      {l.status === 'ativa' && (
                        <form action={mudaStatus}><input type="hidden" name="slug" value={l.slug} /><input type="hidden" name="status" value="pausada" /><button className="sec">Pausar</button></form>
                      )}
                      {l.status !== 'descartada' && (
                        <form action={mudaStatus}><input type="hidden" name="slug" value={l.slug} /><input type="hidden" name="status" value="descartada" /><button className="sec">Descartar</button></form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h3>Sugestões da IA</h3>
        <p className="rot">A IA lê os resultados e os motivos de recusa e escreve versões novas. Elas entram como pendentes e só rodam depois de aprovadas.</p>
        <form action={geraSugestoes} className="linha">
          <input type="hidden" name="canal" value={canal} />
          <select name="quantas" defaultValue="2" style={{ width: 140 }}>
            <option value="1">1 versão</option><option value="2">2 versões</option><option value="3">3 versões</option>
          </select>
          <button>Gerar sugestões</button>
        </form>
      </section>
    </>
  );
}
