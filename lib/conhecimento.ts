// Tudo que o agente pode dizer sobre a pesquisa. Edite aqui se a mestranda ajustar algo.
// Fonte: TCLE publicado na abertura do formulário.

export const FATOS = `
- Título: "Tomada de decisão, letramento digital e uso de Inteligência Artificial (IA)".
- É uma dissertação de mestrado do Laboratório Experimental de Políticas Públicas da Escola de Políticas Públicas e Governo (EPPG) da FGV, em Brasília. Coordenação do Prof. Dr. Benjamin Miranda Tabak.
- A Capital Consultoria Júnior (empresa júnior da FGV) apoia apenas a divulgação.
- Público: servidores públicos.
- Duração: cerca de 15 minutos.
- Participação voluntária; é possível desistir a qualquer momento, sem prejuízo.
- Riscos mínimos, como cansaço ou desconforto ao responder.
- Os dados não são identificados.
- Aprovada pelo Comitê de Ética da FGV. Contatos do coordenador, da pesquisadora e do comitê estão no início do formulário.
- Não há qualquer pagamento, sorteio, certificado ou benefício pela participação.
`;

// Respostas que ainda dependem da mestranda. Enquanto estiverem vazias, o agente escala.
export const FAQ_EXTRA = `
- Como conseguiram meu contato? ${process.env.FAQ_ORIGEM_CONTATO || '[sem resposta definida: escalar]'}
- Quem não é servidor pode responder? ${process.env.FAQ_QUEM_PODE || '[sem resposta definida: escalar]'}
`;

export const CATEGORIAS = ['sem_tempo', 'desconfianca', 'nao_e_servidor', 'nao_quer', 'ja_respondeu', 'duvida', 'outro'] as const;
