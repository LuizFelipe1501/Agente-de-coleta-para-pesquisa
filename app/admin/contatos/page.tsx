import { exige } from '@/lib/auth';
import { db, checa } from '@/lib/db';
import { config } from '@/lib/config';
import { listaNumeros, enviadosHojeNumero } from '@/lib/numeros';
import { importaContatos, limpaErros, salvaNumero, alternaNumero } from '../acoes';

export const dynamic = 'force-dynamic';

type F = { canal: string; enviado_em: string | null; erro: string | null; numero: string | null };

export default async function Contatos({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
  await exige('admin');
  const sp = await searchParams;
  const fila = checa(await db().from('fila').select('canal,enviado_em,erro,numero')) as F[];
  const numeros = await listaNumeros();
  const hoje = Object.fromEntries(await Promise.all(numeros.map(async (n) => [n.id, await enviadosHojeNumero(n.id)])));
  const conta = (c: string) => {
    const fc = fila.filter((f) => f.canal === c);
    return {
      aguardando: fc.filter((f) => !f.enviado_em && !f.erro).length,
      lembrete: fc.filter((f) => f.enviado_em).length,
      erro: fc.filter((f) => f.erro).length,
    };
  };
  const em = conta('email');
  const wp = conta('wpp');

  return (
    <>
      <h1>Contatos e filas</h1>
      <p className="sub">Os contatos ficam na fila só até o lembrete e depois são apagados. Quem pediu para sair é descartado automaticamente.</p>

      <h2>Números de WhatsApp</h2>
      <section>
        <p className="rot" style={{ marginTop: 0 }}>
          Modo atual: <strong>{config.wppModo === 'evolution' ? 'envio automático pela Evolution' : 'assistido (o time clica para enviar em /time/whatsapp)'}</strong>.
          Cada contato pertence a um número só.
        </p>
        {numeros.length > 0 ? (
          <table>
            <thead><tr><th>Pessoa</th><th>Instância</th><th className="n">Enviadas hoje</th><th className="n">Na fila</th><th className="n">Aguardando lembrete</th><th>Envio</th><th>Respostas automáticas</th></tr></thead>
            <tbody>
              {numeros.map((n) => {
                const fn = fila.filter((f) => f.numero === n.id);
                return (
                  <tr key={n.id}>
                    <td><strong>{n.nome}</strong><br /><span className="rot">{n.id}</span></td>
                    <td>{n.instancia}</td>
                    <td className="n">{hoje[n.id]} / {n.limite_dia}</td>
                    <td className="n">{fn.filter((f) => !f.enviado_em && !f.erro).length}</td>
                    <td className="n">{fn.filter((f) => f.enviado_em).length}</td>
                    <td>
                      <form action={alternaNumero}><input type="hidden" name="id" value={n.id} /><input type="hidden" name="campo" value="ativo" /><input type="hidden" name="valor" value={String(!n.ativo)} />
                        <button className={n.ativo ? 'sec' : ''}>{n.ativo ? 'Ativo · pausar' : 'Pausado · retomar'}</button></form>
                    </td>
                    <td>
                      <form action={alternaNumero}><input type="hidden" name="id" value={n.id} /><input type="hidden" name="campo" value="responder" /><input type="hidden" name="valor" value={String(!n.responder)} />
                        <button className="sec">{n.responder ? 'Ligadas · desligar' : 'Desligadas · ligar'}</button></form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p>Nenhum número cadastrado ainda.</p>
        )}

        {sp.novo ? (
          <form action={salvaNumero} className="grade" style={{ marginTop: 16 }}>
            <div><label className="rot">Id curto (sem espaço)</label><input type="text" name="id" placeholder="luiz" required /></div>
            <div><label className="rot">Dono do número</label><input type="text" name="nome" placeholder="Luiz Felipe" required /></div>
            <div><label className="rot">Instância na Evolution</label><input type="text" name="instancia" placeholder="luiz" required /></div>
            <div><label className="rot">Limite por dia</label><input type="number" name="limite_dia" defaultValue={40} min={1} max={100} /></div>
            <div className="linha" style={{ alignSelf: 'end' }}><button>Salvar número</button><a className="botao sec" href="/admin/contatos">Cancelar</a></div>
          </form>
        ) : (
          <a className="botao" href="/admin/contatos?novo=1" style={{ marginTop: 12 }}>Adicionar número</a>
        )}
      </section>

      <div className="duas">
        <section>
          <h3>Fila de e-mail</h3>
          <div className="contadores">
            <div><span className="num">{em.aguardando}</span><span className="rot">aguardando</span></div>
            <div><span className="num">{em.lembrete}</span><span className="rot">aguardando lembrete</span></div>
            <div><span className="num">{em.erro}</span><span className="rot">com erro</span></div>
          </div>
          <form action={importaContatos}>
            <input type="hidden" name="canal" value="email" />
            <label className="rot">Um por linha: e-mail;nome</label>
            <textarea name="lista" placeholder={'fulana@orgao.gov.br;Fulana Souza\nciclano@tjdft.jus.br;Ciclano Lima'} />
            <div className="linha" style={{ marginTop: 10 }}>
              <button>Adicionar à fila</button>
              <a className="botao sec" href="/admin/busca">Buscar e-mails em sites</a>
            </div>
          </form>
          {em.erro > 0 && (
            <form action={limpaErros} style={{ marginTop: 10 }}><input type="hidden" name="canal" value="email" /><button className="perigo">Apagar {em.erro} com erro</button></form>
          )}
          <p className="rot" style={{ marginBottom: 0 }}>Limite de {config.emailLimiteDia} e-mails por dia.</p>
        </section>

        <section>
          <h3>Fila de WhatsApp</h3>
          <div className="contadores">
            <div><span className="num">{wp.aguardando}</span><span className="rot">aguardando</span></div>
            <div><span className="num">{wp.lembrete}</span><span className="rot">aguardando lembrete</span></div>
            <div><span className="num">{wp.erro}</span><span className="rot">com erro</span></div>
          </div>
          {numeros.length === 0 ? (
            <p>Cadastre os números acima antes de adicionar contatos de WhatsApp.</p>
          ) : (
            <form action={importaContatos}>
              <input type="hidden" name="canal" value="wpp" />
              <label className="rot">De quem são estes contatos?</label>
              <select name="numero" required defaultValue="" style={{ marginBottom: 10 }}>
                <option value="" disabled>Escolha a pessoa</option>
                {numeros.map((n) => <option key={n.id} value={n.id}>{n.nome}</option>)}
              </select>
              <label className="rot">Um por linha: telefone;nome</label>
              <textarea name="lista" placeholder={'61999998888;Fulano\n61988887777;Beltrana'} />
              <div className="linha" style={{ marginTop: 10 }}>
                <button>Adicionar à fila</button>
              </div>
            </form>
          )}
          {wp.erro > 0 && (
            <form action={limpaErros} style={{ marginTop: 10 }}><input type="hidden" name="canal" value="wpp" /><button className="perigo">Apagar {wp.erro} com erro</button></form>
          )}
        </section>
      </div>
    </>
  );
}
