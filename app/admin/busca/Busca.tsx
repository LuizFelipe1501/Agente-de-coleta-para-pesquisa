'use client';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { buscar, adicionarSelecionados, Resultado } from './acoes';

export default function Busca() {
  const [res, acao, buscando] = useActionState<Resultado, FormData>(buscar, null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState('');
  const [enviando, inicia] = useTransition();

  const disponiveis = (res?.achados || []).filter((a) => !a.jaNaFila && !a.optout);

  useEffect(() => {
    setMarcados(new Set(disponiveis.filter((a) => a.tipo === 'pessoal').map((a) => a.email)));
    setMsg('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res]);

  const alterna = (e: string) => {
    const n = new Set(marcados);
    n.has(e) ? n.delete(e) : n.add(e);
    setMarcados(n);
  };

  const adiciona = () =>
    inicia(async () => {
      const itens = disponiveis.filter((a) => marcados.has(a.email)).map((a) => ({ email: a.email, nome: a.nome }));
      const n = await adicionarSelecionados(itens);
      setMsg(`${n} contato(s) adicionados à fila de e-mail.`);
      setMarcados(new Set());
    });

  return (
    <>
      <form action={acao} className="caixa">
        <label className="rot">Endereços das páginas (um por linha, até 20)</label>
        <textarea
          name="urls"
          placeholder={'https://www.gov.br/orgao/pt-br/composicao/quem-e-quem\nhttps://www.tjdft.jus.br/institucional/...'}
        />
        <div className="linha" style={{ marginTop: 8 }}>
          <label className="linha" style={{ gap: 4 }}><input type="checkbox" name="seguir" defaultChecked /> seguir links de equipe, contato e organograma no mesmo site</label>
          <label className="linha" style={{ gap: 4 }}>até <input type="number" name="max" defaultValue={25} min={1} max={40} style={{ width: 70 }} /> páginas</label>
          <button disabled={buscando}>{buscando ? 'Buscando…' : 'Buscar'}</button>
        </div>
      </form>

      {res && (
        <section>
          <p style={{ marginTop: 0 }}>
            {res.achados.length} e-mail(s) em {res.paginas} página(s). {disponiveis.length} novos.
          </p>
          {res.achados.length > 0 && (
            <>
              <div className="linha" style={{ marginBottom: 8 }}>
                <button type="button" className="sec" onClick={() => setMarcados(new Set(disponiveis.map((a) => a.email)))}>Marcar todos</button>
                <button type="button" className="sec" onClick={() => setMarcados(new Set(disponiveis.filter((a) => a.tipo === 'pessoal').map((a) => a.email)))}>Só pessoais</button>
                <button type="button" className="sec" onClick={() => setMarcados(new Set())}>Desmarcar</button>
                <button type="button" onClick={adiciona} disabled={enviando || marcados.size === 0}>
                  {enviando ? 'Adicionando…' : `Adicionar ${marcados.size} à fila de e-mail`}
                </button>
              </div>
              {msg && <div className="aviso">{msg}</div>}
              <table>
                <thead><tr><th></th><th>E-mail</th><th>Nome</th><th>Tipo</th><th>Página</th></tr></thead>
                <tbody>
                  {res.achados.map((a) => {
                    const bloqueado = a.jaNaFila || a.optout;
                    return (
                      <tr key={a.email} style={{ opacity: bloqueado ? 0.5 : 1 }}>
                        <td><input type="checkbox" disabled={bloqueado} checked={marcados.has(a.email)} onChange={() => alterna(a.email)} /></td>
                        <td>{a.email}</td>
                        <td>{a.nome || '–'}</td>
                        <td>{a.optout ? 'pediu para sair' : a.jaNaFila ? 'já na fila' : a.tipo}</td>
                        <td><a href={a.fonte} target="_blank" rel="noreferrer">{new URL(a.fonte).pathname.slice(0, 40) || '/'}</a></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
          <details style={{ marginTop: 12 }}>
            <summary>registro da busca</summary>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{res.log.join('\n')}</pre>
          </details>
        </section>
      )}
    </>
  );
}
