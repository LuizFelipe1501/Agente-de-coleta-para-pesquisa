import './estilo.css';

export const metadata = { title: 'Bot de recrutamento – Capital CJ' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
