// Lembrete de e-mail: tom formal, mesmo padrão do convite. Sem nome, fica "Prezado(a),".
export const ASSUNTO_LEMBRETE_EMAIL = 'Lembrete: convite para pesquisa de mestrado da FGV com servidores públicos';
export const LEMBRETE_EMAIL = (nome: string, link: string) =>
  `Prezado(a)${nome ? ' ' + nome : ''},

Retomo o convite enviado há alguns dias para a pesquisa de mestrado da FGV Brasília sobre tomada de decisão, letramento digital e uso de Inteligência Artificial no setor público. O questionário leva cerca de 15 minutos, é anônimo e a participação é voluntária.

Acesse o questionário aqui: ${link}

Caso já tenha respondido, agradeço a colaboração. Este é o último contato sobre o assunto.

Atenciosamente,
Capital Consultoria Júnior – FGV`;

export const LEMBRETE_WPP = (nome: string, link: string) =>
  `Olá${nome ? ', ' + nome : ''}! Passando só para lembrar da pesquisa da FGV com servidores públicos: ${link}

Se já respondeu, muito obrigado. Não mandamos mais mensagens sobre isso.`;
