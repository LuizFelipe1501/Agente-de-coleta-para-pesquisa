import { exige } from '@/lib/auth';
import { db, checa } from '@/lib/db';
import { CANAIS, NOME_CANAL, Canal } from '@/lib/config';
import { chanceDeSerMelhor } from '@/lib/bandit';
import { mudaStatus, editaVersao, geraSugestoes, usaSo, enviaCorrecao } from '../acoes';
import BotaoEnviar from '../BotaoEnviar';
import { renderiza, camposAbertos } from '@/lib/versoes';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Linha = { slug: string; canal: Canal; angulo: string; status: string; envios: number; cliques: number };
type V = { slug: string; texto: string; assunto: string | null };

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '–');

export default async function Mensagens({ searchParams }: { searchParams: Promise<{ canal?: string; editar?: string; aviso?: string }> }) {
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
  // quantos já receberam cada versão e ainda estão na fila (podem receber correção)
  const naFila = new Map<string, number>();
  if (canal === 'email') {
    const F = checa(await db().from('fila').select('slug').eq('canal', 'email').not('enviado_em', 'is', null)) as { slug: string }[];
    for (const f of F) naFila.set(f.slug, (naFila.get(f.slug) || 0) + 1);
  }

  return (
    <>
      <h1>Mensagens</h1>
      <p className="sub">O bot só envia os textos ativos, exatamente como estão escritos. Com mais de uma versão ativa, ele reparte os envios e manda mais a que gera mais cliques. Para mandar só o seu texto, use "Usar só esta".</p>

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
            {camposAbertos(`${editando.assunto || ''}\n${editando.texto}`, canal).length > 0 && (
              <div className="aviso">
                Esta versão não é enviada enquanto tiver campos entre colchetes para preencher: <strong>{camposAbertos(`${editando.assunto || ''}\n${editando.texto}`, canal).join(', ')}</strong>. Escreva o conteúdo no lugar deles. Para o nome da pessoa use {'{nome}'} e para o link use {'{link}'}.
              </div>
            )}
            <div className="previa-envio">
              <label className="rot">Como sai hoje (texto salvo), para um contato chamado Maria:</label>
              {canal === 'email' && editando.assunto && <p><strong>Assunto:</strong> {renderiza(editando.assunto, editando.slug, 'Maria')}</p>}
              <pre>{renderiza(editando.texto, editando.slug, 'Maria')}</pre>
              {canal !== 'direto' && canal !== 'grupo' && (
                <>
                  <label className="rot">E para um contato sem nome:</label>
                  <pre>{renderiza(editando.texto, editando.slug, null)}</pre>
                </>
              )}
            </div>
            <div className="linha" style={{ marginTop: 10 }}>
              <button>Salvar texto</button>
              <a className="botao sec" href={`/admin/mensagens?canal=${canal}`}>Cancelar</a>
            </div>
          </form>
        </section>
      )}

      {sp.aviso && <div className="aviso">{sp.aviso}</div>}

      {pendentes > 0 && <div className="aviso">{pendentes} sugestão(ões) aguardando aprovação neste canal.</div>}

      <section>
        <table>
          <thead>
            <tr><th>Versão</th><th>Ângulo</th><th>Status</th><th className="n">Envios</th><th className="n">Cliques</th><th className="n">Taxa</th><th className="n">Chance de ser a melhor</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {S.map((l) => {
              const v = textos.get(l.slug)!;
              const abertos = camposAbertos(`${v.assunto || ''}\n${v.texto}`, canal);
              const provisoria = abertos.length > 0;
              return (
                <tr key={l.slug}>
                  <td><strong>{l.slug}</strong>{provisoria && <><br /><span className="tag pendente" title={abertos.join(', ')}>não envia: {abertos.slice(0, 2).join(', ')}</span></>}</td>
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
                      {!provisoria && l.status !== 'descartada' && (l.status !== 'ativa' || ativas.length > 1) ? (
                        <form action={usaSo}><input type="hidden" name="slug" value={l.slug} /><button className="sec">Usar só esta</button></form>
                      ) : null}
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

      {canal === 'email' && [...naFila.entries()].some(([, n]) => n > 0) && (
        <section>
          <h3>Reenviar com correção</h3>
          <p className="rot">Manda o texto atual da versão escolhida, com um pedido de desculpas no começo, para quem já recebeu essa versão. Vale como o lembrete: depois disso a pessoa não recebe mais nada. Até 15 por clique.</p>
          {[...naFila.entries()].filter(([, n]) => n > 0).map(([slug, n]) => (
            <form key={slug} action={enviaCorrecao} className="linha" style={{ marginBottom: 8 }}>
              <input type="hidden" name="slug" value={slug} />
              <label className="linha"><input type="checkbox" name="confirmo" value="sim" style={{ width: 'auto' }} /> Confirmo o reenvio para {n} pessoa(s) que receberam {slug}</label>
              <BotaoEnviar texto="Enviar correção" />
            </form>
          ))}
        </section>
      )}

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
