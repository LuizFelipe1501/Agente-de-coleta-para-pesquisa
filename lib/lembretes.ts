export const LEMBRETE_EMAIL = (nome: string, link: string) =>
  `Prezado(a) ${nome},

Passando só para lembrar da pesquisa de mestrado da EPPG/FGV com servidores públicos, sobre tomada de decisão e uso de IA. Leva cerca de 15 minutos e é anônima:
${link}

Se já respondeu, muito obrigado. Este é o último contato sobre o assunto.

Capital Consultoria Júnior – FGV`;

export const LEMBRETE_WPP = (nome: string, link: string) =>
  `Olá${nome ? ', ' + nome : ''}! Passando só para lembrar da pesquisa da FGV com servidores públicos: ${link}

Se já respondeu, muito obrigado. Não mandamos mais mensagens sobre isso.`;
