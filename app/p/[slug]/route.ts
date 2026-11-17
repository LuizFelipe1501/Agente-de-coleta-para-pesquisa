import { db } from '@/lib/db';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

// Filtros de e-mail de órgãos públicos (Microsoft Defender, gateways de segurança etc.) abrem
// todos os links de cada mensagem que chega, e muitos se passam por navegador comum.
// Por isso o clique só é contado quando a página roda JavaScript e avisa o servidor (POST),
// o que os robôs quase nunca fazem. A pessoa é levada ao questionário na hora.
const ROBOS = /bot|crawl|spider|preview|whatsapp|facebookexternalhit|telegram|slack|discord|linkedin|skype|outlook|safelinks|proofpoint|mimecast|barracuda|google-?(read|image)|headless|curl|wget|python|node-fetch|axios/i;

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const destino = config.surveyUrl;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pesquisa FGV</title>
<noscript><meta http-equiv="refresh" content="0;url=${esc(destino)}"></noscript>
<style>body{font-family:Arial,sans-serif;color:#2A1155;background:#F7F3FC;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}a{color:#45108A}</style>
</head><body><p>Abrindo o questionário… <a href="${esc(destino)}">clique aqui se não abrir</a>.</p>
<script>
(function(){
  var ir=function(){location.replace(${JSON.stringify(destino)});};
  try{
    if(navigator.sendBeacon){navigator.sendBeacon(location.pathname,'');ir();}
    else{fetch(location.pathname,{method:'POST',keepalive:true}).finally(ir);setTimeout(ir,800);}
  }catch(e){ir();}
})();
</script></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

// Chamado pelo JavaScript da página acima: aqui é que o clique conta.
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const ua = req.headers.get('user-agent') || '';
  if (ua && !ROBOS.test(ua)) {
    try {
      const { data } = await db().from('versoes').select('slug').eq('slug', slug).maybeSingle();
      if (data) await db().from('cliques').insert({ slug });
    } catch (e) {
      console.error('falha ao registrar clique', e);
    }
  }
  return new Response(null, { status: 204 });
}

export async function HEAD() {
  return new Response(null, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
