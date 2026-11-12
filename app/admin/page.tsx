import { exige } from '@/lib/auth';
import { db, checa } from '@/lib/db';
import { config, CANAIS, NOME_CANAL, Canal } from '@/lib/config';
import { chanceDeSerMelhor } from '@/lib/bandit';
import { agoraBrasilia, dentroDaJanela } from '@/lib/versoes';
import {
  salvaRespostas, mudaStatus, editaVersao, importaContatos, limpaErros, geraSugestoes, salvaNumero, alternaNumero,
} from './acoes';
import { listaNumeros, enviadosHojeNumero } from '@/lib/numeros';

export const dynamic = 'force-dynamic';

type Linha = { slug: string; canal: Canal; angulo: string; status: string; envios: number; cliques: number };
type V = { slug: string; texto: string; assunto: string | null };

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '–');

export default async function Admin() {
  await exige('admin');

  const [stats, versoes, respostas, fila, obj, lembretes] = await Promise.all([
    db().from('stats_versoes').select('*').order('slug'),
    db().from('versoes').select('slug,texto,assunto'),
    db().from('respostas').select('*').order('dia', { ascending: false }).limit(10),
    db().from('fila').select('canal,enviado_em,erro,numero'),
    db().from('objecoes').select('categoria,canal').gte('criado_em', new Date(Date.now() - 7 * 86400000).toISOString()),
    db().from('envios').select('qtd').eq('tipo', 'lembrete'),
  ]);
  const S = checa(stats) as Linha[];
  const textos = new Map((checa(versoes) as V[]).map((v) => [v.slug, v]));
  const R = checa(respostas) as { dia: string; total: number }[];
  const F = checa(fila) as { canal: string; enviado_em: string | null; erro: string | null; numero: string | null }[];
  const numeros = await listaNumeros();
  const hojePorNumero = Object.fromEntries(await Promise.all(numeros.map(async (n) => [n.id, await enviadosHojeNumero(n.id)])));
  const O = checa(obj) as { categoria: string; canal: string }[];
  const totalLembretes = (checa(lembretes) as { qtd: number }[]).reduce((s, l) => s + l.qtd, 0);

  const totalResp = R[0]?.total ?? 0;
  const totalEnvios = S.reduce((s, l) => s + l.envios, 0);
  const totalCliques = S.reduce((s, l) => s + l.cliques, 0);
  const hoje = agoraBrasilia().data;

  const contaObj: Record<string, number> = {};
  for (const o of O) contaObj[o.categoria] = (contaObj[o.categoria] || 0) + 1;

  return (
    <>
      <h1>Painel do recrutamento</h1>
      <p className="sub">
        Pesquisa EPPG/FGV · disparo automático {dentroDaJanela() ? 'dentro' : 'fora'} da janela agora ·{' '}
        <a href="/time">página do time</a> · <a href="/admin/busca">buscar contatos</a> · <a href="/api/registro">baixar registro de versões (CSV)</a>
      </p>

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
        <h3 style={{ marginTop: 0 }}>Total de respostas informado pela mestranda</h3>
        <form action={salvaRespostas} className="linha">
          <input type="text" name="dia" defaultValue={hoje} style={{ width: 130 }} />
          <input type="number" name="total" min={0} placeholder="total acumulado" style={{ width: 160 }} required />
          <button>Salvar</button>
          <span className="rot">{R.slice(0, 5).map((r) => `${r.dia.slice(5)}: ${r.total}`).join(' · ')}</span>
        </form>
      </section>

      <h2>Números de WhatsApp</h2>
      <section>
        <p className="rot" style={{ marginTop: 0 }}>
          Modo atual: <strong>{config.wppModo === 'evolution' ? 'envio automático (Evolution)' : 'assistido (o time clica para enviar)'}</strong>.
          Cada contato pertence a um número só e só sai por ele.
        </p>
        {numeros.length > 0 && (
          <table>
            <thead><tr><th>Número</th><th>Instância</th><th className="n">Hoje</th><th className="n">Na fila</th><th className="n">Aguardando lembrete</th><th>Envio</th><th>Respostas automáticas</th></tr></thead>
            <tbody>
              {numeros.map((n) => {
                const fn = F.filter((f) => f.numero === n.id);
                return (
                  <tr key={n.id}>
                    <td><strong>{n.nome}</strong><br /><span className="rot">{n.id}</span></td>
                    <td>{n.instancia}</td>
                    <td className="n">{hojePorNumero[n.id]} / {n.limite_dia}</td>
                    <td className="n">{fn.filter((f) => !f.enviado_em && !f.erro).length}</td>
                    <td className="n">{fn.filter((f) => f.enviado_em).length}</td>
                    <td>
                      <form action={alternaNumero}><input type="hidden" name="id" value={n.id} /><input type="hidden" name="campo" value="ativo" /><input type="hidden" name="valor" value={String(!n.ativo)} />
                        <button className={n.ativo ? 'sec' : ''}>{n.ativo ? 'Pausar' : 'Retomar'}</button></form>
                    </td>
                    <td>
                      <form action={alternaNumero}><input type="hidden" name="id" value={n.id} /><input type="hidden" name="campo" value="responder" /><input type="hidden" name="valor" value={String(!n.responder)} />
                        <button className="sec">{n.responder ? 'Ligadas – desligar' : 'Desligadas – ligar'}</button></form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <details style={{ marginTop: 12 }}>
          <summary>Adicionar ou editar número</summary>
          <form action={salvaNumero} className="grade" style={{ marginTop: 8 }}>
            <div><label className="rot">Id (curto, sem espaço)</label><input type="text" name="id" placeholder="luiz" required /></div>
            <div><label className="rot">Dono do número</label><input type="text" name="nome" placeholder="Luiz Felipe" required /></div>
            <div><label className="rot">Nome da instância na Evolution</label><input type="text" name="instancia" placeholder="luiz" required /></div>
            <div><label className="rot">Limite por dia</label><input type="number" name="limite_dia" defaultValue={40} min={1} max={100} /></div>
            <div style={{ alignSelf: 'end' }}><button>Salvar número</button></div>
          </form>
        </details>
      </section>

      {CANAIS.map((canal) => {
        const linhas = S.filter((l) => l.canal === canal);
        const ativas = linhas.filter((l) => l.status === 'ativa');
        const chance = chanceDeSerMelhor(ativas);
        const somaEnv = ativas.reduce((s, l) => s + l.envios, 0);
        const auto = canal === 'email' || canal === 'wpp';
        const fc = F.filter((f) => f.canal === canal);
        return (
          <div key={canal}>
            <h2>{NOME_CANAL[canal]}</h2>
            <section>
              <table>
                <thead>
                  <tr><th>Versão</th><th>Ângulo</th><th>Status</th><th className="n">Envios</th><th className="n">Cliques</th><th className="n">Taxa</th><th className="n">Chance de ser a melhor</th><th></th></tr>
                </thead>
                <tbody>
                  {linhas.map((l) => {
                    const v = textos.get(l.slug)!;
                    return (
                      <tr key={l.slug}>
                        <td>
                          <strong>{l.slug}</strong>
                          <details>
                            <summary>texto</summary>
                            <form action={editaVersao} style={{ marginTop: 8, minWidth: 320 }}>
                              <input type="hidden" name="slug" value={l.slug} />
                              {canal === 'email' && <input type="text" name="assunto" defaultValue={v.assunto || ''} placeholder="Assunto" style={{ marginBottom: 6 }} />}
                              <textarea name="texto" defaultValue={v.texto} />
                              <button style={{ marginTop: 6 }}>Salvar texto</button>
                            </form>
                          </details>
                        </td>
                        <td>{l.angulo}</td>
                        <td><span className={`tag ${l.status}`}>{l.status}</span></td>
                        <td className="n">{l.envios}</td>
                        <td className="n">{l.cliques}</td>
                        <td className="n">{pct(l.cliques, l.envios)}</td>
                        <td className="n">{l.status === 'ativa' && somaEnv > 0 ? `${Math.round(100 * (chance[l.slug] || 0))}%` : '–'}</td>
                        <td>
                          <div className="linha">
                            {l.status !== 'ativa' && (
                              <form action={mudaStatus}><input type="hidden" name="slug" value={l.slug} /><input type="hidden" name="status" value="ativa" /><button>{l.status === 'pendente' ? 'Aprovar' : 'Ativar'}</button></form>
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
              <form action={geraSugestoes} className="linha" style={{ marginTop: 12 }}>
                <input type="hidden" name="canal" value={canal} />
                <select name="quantas" defaultValue="2" style={{ width: 80 }}><option>1</option><option>2</option><option>3</option></select>
                <button className="sec">Gerar sugestões de novas versões</button>
                <span className="rot">Entram como pendentes e só rodam depois de aprovadas.</span>
              </form>
            </section>

            {auto && (
              <section>
                <h3 style={{ marginTop: 0 }}>Fila de disparo</h3>
                <p className="rot" style={{ marginTop: 0 }}>
                  {fc.filter((f) => !f.enviado_em && !f.erro).length} aguardando · {fc.filter((f) => f.enviado_em).length} aguardando lembrete · {fc.filter((f) => f.erro).length} com erro ·
                  {canal === 'email' ? `limite ${config.emailLimiteDia}/dia` : 'limite por número (acima)'}
                </p>
                <form action={importaContatos}>
                  <input type="hidden" name="canal" value={canal} />
                  {canal === 'wpp' && (
                    <div style={{ marginBottom: 8 }}>
                      <label className="rot">Número dono destes contatos (os contatos devem ser da rede dessa pessoa)</label>
                      <select name="numero" required defaultValue="">
                        <option value="" disabled>Escolha</option>
                        {numeros.map((n) => <option key={n.id} value={n.id}>{n.nome} ({n.id})</option>)}
                      </select>
                    </div>
                  )}
                  <textarea name="lista" placeholder={canal === 'email' ? 'um por linha: email;nome\nfulana@orgao.gov.br;Fulana Souza' : 'um por linha: telefone;nome\n61999998888;Fulano'} />
                  <div className="linha" style={{ marginTop: 8 }}>
                    <button>Adicionar à fila</button>
                    <span className="rot">Contatos que pediram para sair são descartados. A fila é apagada depois do lembrete.</span>
                  </div>
                </form>
                {fc.some((f) => f.erro) && (
                  <form action={limpaErros} style={{ marginTop: 8 }}>
                    <input type="hidden" name="canal" value={canal} />
                    <button className="perigo">Apagar contatos com erro</button>
                  </form>
                )}
              </section>
            )}
          </div>
        );
      })}

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
