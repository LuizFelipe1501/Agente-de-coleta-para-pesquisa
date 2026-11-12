import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export type Papel = 'admin' | 'time';

function assina(papel: Papel) {
  const segredo = process.env.SESSION_SECRET || 'troque-isto';
  return `${papel}.${createHmac('sha256', segredo).update(papel).digest('hex')}`;
}

export function papelDoCookie(valor?: string): Papel | null {
  if (!valor) return null;
  for (const p of ['admin', 'time'] as Papel[]) {
    const esperado = Buffer.from(assina(p));
    const recebido = Buffer.from(valor);
    if (esperado.length === recebido.length && timingSafeEqual(esperado, recebido)) return p;
  }
  return null;
}

export async function papelAtual(): Promise<Papel | null> {
  return papelDoCookie((await cookies()).get('sessao')?.value);
}

export async function exige(papel: Papel) {
  const p = await papelAtual();
  if (p === 'admin') return; // admin acessa tudo
  if (p !== papel) redirect(`/entrar?para=${papel === 'admin' ? '/admin' : '/time'}`);
}

export async function entra(senha: string): Promise<Papel | null> {
  let papel: Papel | null = null;
  if (senha && senha === process.env.ADMIN_PASSWORD) papel = 'admin';
  else if (senha && senha === process.env.TEAM_PASSWORD) papel = 'time';
  if (papel) {
    (await cookies()).set('sessao', assina(papel), {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 40, path: '/',
    });
  }
  return papel;
}

export function cronAutorizado(req: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const h = req.headers.get('authorization') || '';
  const q = new URL(req.url).searchParams.get('chave') || '';
  return h === `Bearer ${segredo}` || q === segredo;
}
