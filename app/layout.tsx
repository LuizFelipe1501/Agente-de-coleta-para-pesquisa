import './estilo.css';
import { papelAtual } from '@/lib/auth';
import Menu from './Menu';

export const metadata = { title: 'Bot de recrutamento – Capital CJ' };
export const dynamic = 'force-dynamic';

const MENU_ADMIN = [
  { href: '/admin', rotulo: 'Visão geral' },
  { href: '/admin/mensagens', rotulo: 'Mensagens' },
  { href: '/admin/contatos', rotulo: 'Contatos e filas' },
  { href: '/admin/busca', rotulo: 'Buscar contatos' },
  { href: '/time', rotulo: 'Página do time' },
];
const MENU_TIME = [
  { href: '/time', rotulo: 'Mensagem do momento' },
  { href: '/time/whatsapp', rotulo: 'Fila de WhatsApp' },
];

export default async function Layout({ children }: { children: React.ReactNode }) {
  const papel = await papelAtual();
  const itens = papel === 'admin' ? MENU_ADMIN : papel === 'time' ? MENU_TIME : [];
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
        <meta name="theme-color" content="#45108A" />
      </head>
      <body>
        <header className="topo">
          <div className="dentro">
            <a href={papel === 'time' ? '/time' : '/admin'} className="marca">CAPITAL<span>.</span></a>
            <span className="sub">Recrutamento · Pesquisa EPPG/FGV</span>
            {papel && <a href="/sair" className="sair">Sair</a>}
          </div>
          {itens.length > 0 && <div className="dentro"><Menu itens={itens} /></div>}
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
