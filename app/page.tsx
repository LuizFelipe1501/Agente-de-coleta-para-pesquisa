import { redirect } from 'next/navigation';
import { papelAtual } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Inicio() {
  const p = await papelAtual();
  redirect(p === 'admin' ? '/admin' : p === 'time' ? '/time' : '/entrar');
}
