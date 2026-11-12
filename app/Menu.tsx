'use client';
import { usePathname } from 'next/navigation';

type Item = { href: string; rotulo: string };

export default function Menu({ itens }: { itens: Item[] }) {
  const atual = usePathname();
  return (
    <nav className="menu">
      {itens.map((i) => {
        const ativo = i.href === atual || (i.href !== '/admin' && i.href !== '/time' && atual.startsWith(i.href));
        return (
          <a key={i.href} href={i.href} className={ativo ? 'ativo' : ''}>{i.rotulo}</a>
        );
      })}
    </nav>
  );
}
