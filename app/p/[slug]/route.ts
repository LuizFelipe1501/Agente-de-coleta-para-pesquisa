import { db } from '@/lib/db';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

// Pré-visualizações de link e scanners de e-mail abrem o link sozinhos; não contam como clique.
const ROBOS = /bot|crawl|spider|preview|whatsapp|facebookexternalhit|telegram|slack|discord|linkedin|skype|outlook|safelinks|proofpoint|mimecast|barracuda|google-?(read|image)|headless|curl|wget|python|node-fetch|axios/i;

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const ua = req.headers.get('user-agent') || '';
  const metodoHead = req.method === 'HEAD';

  if (!metodoHead && ua && !ROBOS.test(ua)) {
    try {
      const { data } = await db().from('versoes').select('slug').eq('slug', slug).maybeSingle();
      if (data) await db().from('cliques').insert({ slug });
    } catch (e) {
      console.error('falha ao registrar clique', e);
    }
  }
  return Response.redirect(config.surveyUrl, 302);
}

export const HEAD = GET;
