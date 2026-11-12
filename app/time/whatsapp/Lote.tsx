'use client';
import { useState, useTransition } from 'react';
import { marcarEnviados, marcarSair, marcarInvalido } from './acoes';

export type Item = { id: number; nome: string | null; contato: string; tipo: string; wa: string };

export default function Lote({ itens }: { itens: Item[] }) {
  const [lista, setLista] = useState(itens);
  const [abertos, setAbertos] = useState<Set<number>>(new Set());
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [qtd, setQtd] = useState(5);
  const [aviso, setAviso] = useState('');
  const [salvando, inicia] = useTransition();

  const naoAbertos = lista.filter((i) => !abertos.has(i.id));

  const abre = (alvo: Item[]) => {
    let bloqueados = 0;
    const novosAbertos = new Set(abertos);
    const novosMarcados = new Set(marcados);
    alvo.forEach((i) => {
      const janela = window.open(i.wa, '_blank');
      if (!janela) { bloqueados++; return; }
      novosAbertos.add(i.id);
      novosMarcados.add(i.id);
    });
    setAbertos(novosAbertos);
    setMarcados(novosMarcados);
    setAviso(
      bloqueados
        ? `O navegador bloqueou ${bloqueados} janela(s). Clique no ícone de pop-up bloqueado na barra de endereço, escolha "Sempre permitir" para este site e tente de novo.`
        : '',
    );
  };

  const alterna = (id: number) => {
    const n = new Set(marcados);
    n.has(id) ? n.delete(id) : n.add(id);
    setMarcados(n);
  };

  const confirmaEnviados = () =>
    inicia(async () => {
      const ids = [...marcados];
      const n = await marcarEnviados(ids);
      setLista(lista.filter((i) => !marcados.has(i.id)));
      setMarcados(new Set());
      setAviso(`${n} marcado(s) como enviado(s).`);
    });

  const remove = (id: number, acao: 'sair' | 'invalido') =>
    inicia(async () => {
      await (acao === 'sair' ? marcarSair(id) : marcarInvalido(id));
      setLista(lista.filter((i) => i.id !== id));
      const n = new Set(marcados); n.delete(id); setMarcados(n);
    });

  if (lista.length === 0) {
    return <div className="aviso">Lote concluído. Recarregue a página para pegar outro.</div>;
  }

  return (
    <section>
      <div className="linha" style={{ marginBottom: 12 }}>
        <button type="button" onClick={() => abre(naoAbertos.slice(0, 1))} disabled={!naoAbertos.length}>Abrir próximo</button>
        <span className="rot">ou abrir</span>
        <input type="number" min={1} max={lista.length} value={qtd} onChange={(e) => setQtd(Number(e.target.value) || 1)} style={{ width: 70 }} />
        <button type="button" onClick={() => abre(naoAbertos.slice(0, qtd))} disabled={!naoAbertos.length}>de uma vez</button>
        <button type="button" className="sec" onClick={() => abre(naoAbertos)} disabled={!naoAbertos.length}>Abrir todos ({naoAbertos.length})</button>
      </div>

      {aviso && <div className="aviso">{aviso}</div>}

      <table>
        <thead><tr><th>Enviado?</th><th>Contato</th><th>Tipo</th><th></th><th></th></tr></thead>
        <tbody>
          {lista.map((i) => (
            <tr key={i.id} style={{ background: abertos.has(i.id) ? '#f3f6f9' : undefined }}>
              <td><input type="checkbox" checked={marcados.has(i.id)} onChange={() => alterna(i.id)} /></td>
              <td>{i.nome || '–'}<br /><span className="rot">+{i.contato}</span></td>
              <td>{i.tipo}{abertos.has(i.id) && <><br /><span className="rot">aberto</span></>}</td>
              <td>
                <a href={i.wa} target="_blank" rel="noreferrer" onClick={() => { setAbertos(new Set(abertos).add(i.id)); setMarcados(new Set(marcados).add(i.id)); }}>
                  <button type="button" className="sec">Abrir</button>
                </a>
              </td>
              <td>
                <div className="linha">
                  <button type="button" className="sec" onClick={() => remove(i.id, 'sair')} disabled={salvando}>Pediu para sair</button>
                  <button type="button" className="sec" onClick={() => remove(i.id, 'invalido')} disabled={salvando}>Número inválido</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="linha" style={{ marginTop: 12 }}>
        <button type="button" onClick={confirmaEnviados} disabled={salvando || marcados.size === 0}>
          {salvando ? 'Salvando…' : `Confirmar ${marcados.size} como enviado(s)`}
        </button>
        <span className="rot">Ao abrir, o contato já vem marcado. Desmarque quem você não chegou a enviar antes de confirmar.</span>
      </div>
    </section>
  );
}
