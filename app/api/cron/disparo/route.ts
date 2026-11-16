// Disparo automático. Chamado a cada 10 minutos pelo agendador (GitHub Actions).
// A lógica fica em lib/disparo.ts (também usada pelo botão "Disparar agora" do painel).
import { cronAutorizado } from '@/lib/auth';
import { executaDisparo } from '@/lib/disparo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!cronAutorizado(req)) return new Response('não autorizado', { status: 401 });
  const forcar = new URL(req.url).searchParams.get('forcar') === '1';
  const log = await executaDisparo(forcar);
  return Response.json({ ok: true, log });
}
