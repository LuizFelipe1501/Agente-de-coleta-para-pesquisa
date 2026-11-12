import { config, Canal } from './config';
import { FATOS, FAQ_EXTRA, CATEGORIAS } from './conhecimento';

export type Decisao = {
  acao: 'responder' | 'remover' | 'escalar' | 'ignorar';
  categoria: (typeof CATEGORIAS)[number];
  resposta: string;
};

const SAIR = /^\s*(sair|remover|remova|parar|pare|stop|descadastrar|cancelar)\b/i;

// Gemini API (REST). Plano gratuito: no AI Studio, crie a chave e escolha um modelo Flash.
async function gemini(opts: { sistema?: string; texto: string; modelo: string; maxTokens: number }): Promise<string> {
  const chave = process.env.GEMINI_API_KEY;
  if (!chave) throw new Error('Falta GEMINI_API_KEY');
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${opts.modelo}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
    body: JSON.stringify({
      ...(opts.sistema ? { systemInstruction: { parts: [{ text: opts.sistema }] } } : {}),
      contents: [{ role: 'user', parts: [{ text: opts.texto }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.4, maxOutputTokens: opts.maxTokens },
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return (j.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
}

// Tira e-mails e telefones antes de mandar o texto para a IA.
export function anonimiza(t: string): string {
  return t
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[email]')
    .replace(/(\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/g, '[telefone]');
}

function extraiJSON(t: string): any {
  const ini = t.indexOf('{');
  const fim = t.lastIndexOf('}');
  if (ini < 0 || fim < 0) throw new Error('Resposta sem JSON');
  return JSON.parse(t.slice(ini, fim + 1));
}

const REGRAS = `Você responde, em nome da Capital Consultoria Júnior da FGV, mensagens de pessoas que foram convidadas a responder uma pesquisa de mestrado.

FATOS (a única informação que você pode usar):
${FATOS}
${FAQ_EXTRA}

REGRAS
- Responda só com base nos FATOS. Se a pergunta não estiver coberta, ou se uma resposta estiver marcada como "escalar", use acao "escalar".
- Nunca ofereça benefício, pagamento, certificado, sorteio, nem diga que participar ajuda a pessoa.
- Nunca insista. Se a pessoa recusar, agradeça em uma frase e encerre.
- Se a pessoa pedir para não ser mais contatada, reclamar do contato ou citar LGPD, use acao "remover".
- Não comente nem explique perguntas do questionário, e não sugira respostas.
- Dúvidas éticas ou jurídicas além dos FATOS, irritação ou reclamação: acao "escalar" (e "remover" se pedir para sair).
- Mensagens automáticas (ausência, férias, confirmação de leitura) ou sem relação: acao "ignorar".
- Tom: cordial, curto, português do Brasil, sem emoji. Até 3 frases. Se fizer sentido, inclua o link {link}.
- Quando a acao for "escalar" ou "ignorar", resposta pode ser vazia.

Categorias possíveis: ${CATEGORIAS.join(', ')}.

Responda SÓ com JSON: {"acao": "...", "categoria": "...", "resposta": "..."}`;

export async function decide(mensagem: string, canal: Canal): Promise<Decisao> {
  const limpa = mensagem.trim().slice(0, 3000);
  if (!limpa) return { acao: 'ignorar', categoria: 'outro', resposta: '' };
  if (SAIR.test(limpa)) {
    return {
      acao: 'remover', categoria: 'nao_quer',
      resposta: 'Tudo certo, você não vai receber mais mensagens sobre esta pesquisa. Obrigado pela atenção.',
    };
  }
  try {
    const texto = await gemini({
      modelo: config.modelo,
      maxTokens: 2048,
      sistema: REGRAS,
      texto: `Canal: ${canal === 'email' ? 'e-mail' : 'WhatsApp'}\nMensagem recebida:\n"""${anonimiza(limpa)}"""`,
    });
    const j = extraiJSON(texto);
    const acao = ['responder', 'remover', 'escalar', 'ignorar'].includes(j.acao) ? j.acao : 'escalar';
    const categoria = (CATEGORIAS as readonly string[]).includes(j.categoria) ? j.categoria : 'outro';
    return { acao, categoria, resposta: String(j.resposta || '').trim() };
  } catch (e) {
    console.error('agente falhou', e);
    return { acao: 'escalar', categoria: 'outro', resposta: '' };
  }
}

export type Sugestao = { angulo: string; assunto?: string; texto: string };

export async function sugereVersoes(dados: {
  canal: Canal; stats: { slug: string; angulo: string; envios: number; cliques: number; texto: string }[];
  objecoes: Record<string, number>; quantas: number;
}): Promise<Sugestao[]> {
  const prompt = `Você ajuda a recrutar participantes para uma pesquisa de mestrado com servidores públicos.

FATOS que toda mensagem pode usar (e nada além deles):
${FATOS}

Canal: ${dados.canal}. Desempenho das versões atuais (cliques por envio):
${dados.stats.map((s) => `- ${s.slug} (${s.angulo}): ${s.envios} envios, ${s.cliques} cliques, taxa ${s.envios ? ((100 * s.cliques) / s.envios).toFixed(1) : '0'}%\n  Texto: ${s.texto}`).join('\n')}

Motivos de recusa da última semana (contagem): ${JSON.stringify(dados.objecoes)}

Escreva ${dados.quantas} versão(ões) nova(s) para testar contra as melhores. Regras:
- Use só os FATOS. Nada de benefício, pagamento, certificado, sorteio ou promessa.
- Mantenha o tom das melhores versões e tente responder às objeções mais frequentes.
- Inclua exatamente uma vez o marcador {link}.
- ${dados.canal === 'email' ? 'Inclua um assunto curto. Comece com "Prezado(a) {nome}," e termine com: Se não quiser receber outro contato sobre esta pesquisa, responda "remover".' : dados.canal === 'wpp' ? 'Comece com "Olá, {nome}!" e termine com a linha: Se não quiser receber mensagens sobre isso, responda SAIR.' : dados.canal === 'grupo' ? 'É para postar em grupo: comece dizendo quem posta, com [seu nome].' : 'O time envia do próprio celular: comece com "Oi, [nome]!" e se apresente com [seu nome].'}
- Português do Brasil, texto natural, sem emoji, até 90 palavras (e-mail até 150).

Responda SÓ com JSON: {"versoes": [{"angulo": "...", "assunto": "...", "texto": "..."}]}`;

  const texto = await gemini({ modelo: process.env.MODELO_SUGESTOES || config.modelo, maxTokens: 4096, texto: prompt });
  const j = extraiJSON(texto);
  return (j.versoes || [])
    .filter((v: any) => typeof v.texto === 'string' && v.texto.includes('{link}'))
    .slice(0, dados.quantas);
}
