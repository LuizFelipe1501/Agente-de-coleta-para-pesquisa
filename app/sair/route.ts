import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  (await cookies()).delete('sessao');
  return Response.redirect(new URL('/entrar', req.url), 303);
}
