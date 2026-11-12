import './estilo.css';

export const metadata = { title: 'Bot de recrutamento – Capital CJ' };

export default function Layout({ children }: { children: React.ReactNode }) {
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
            <span className="marca">CAPITAL<span>.</span></span>
            <span className="sub">Recrutamento · Pesquisa EPPG/FGV</span>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
