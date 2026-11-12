import { redirect } from 'next/navigation';
import { entra } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string; para?: string }> }) {
  const sp = await searchParams;

  async function acao(fd: FormData) {
    'use server';
    const papel = await entra(String(fd.get('senha') || ''));
    if (!papel) redirect('/entrar?erro=1');
    redirect(papel === 'admin' ? '/admin' : '/time');
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto' }}>
      <h1>Bot de recrutamento</h1>
      <p className="sub">Pesquisa EPPG/FGV – Capital Consultoria Júnior</p>
      <form action={acao} className="caixa">
        <label className="rot">Senha</label>
        <input type="password" name="senha" autoFocus required />
        {sp.erro && <p style={{ color: 'var(--perigo)' }}>Senha incorreta.</p>}
        <div style={{ marginTop: 12 }}><button>Entrar</button></div>
      </form>
    </div>
  );
}
