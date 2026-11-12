import { exige } from '@/lib/auth';
import { dominiosPermitidos } from '@/lib/busca';
import Busca from './Busca';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function PaginaBusca() {
  await exige('admin');
  return (
    <>
      <nav><a href="/admin">← Painel</a></nav>
      <h1>Buscar contatos</h1>
      <p className="sub">
        Lê páginas públicas de órgãos e extrai e-mails institucionais ({dominiosPermitidos().join(', ')}).
        Nada fica guardado até você adicionar à fila.
      </p>

      <section>
        <h3 style={{ marginTop: 0 }}>Onde procurar</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Páginas "Quem é quem" e "Composição" dos ministérios e autarquias no gov.br.</li>
          <li>Organogramas e listas de contatos de secretarias do GDF, estaduais e municipais.</li>
          <li>Páginas de unidades de tribunais, Câmara, Senado, TCU e Ministério Público.</li>
          <li>Escolas de governo (ENAP, escolas estaduais) e páginas de equipes de pesquisa de órgãos.</li>
        </ul>
        <p className="rot" style={{ marginBottom: 0 }}>
          Ouvidoria, SIC, protocolo, imprensa e e-mails pessoais (Gmail etc.) são descartados automaticamente. E-mails de setor
          (gabinete, coordenação) vêm desmarcados: use para pedir que divulguem internamente.
        </p>
      </section>

      <Busca />
    </>
  );
}
