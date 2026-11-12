-- Bot de recrutamento – pesquisa de mestrado EPPG/FGV
-- Rode este arquivo inteiro no SQL Editor do Supabase.

-- Números de WhatsApp conectados (um por pessoa do time). Cada contato da fila pertence a um número só.
create table if not exists numeros (
  id          text primary key,              -- ex.: luiz
  nome        text not null,                 -- dono do número
  instancia   text not null unique,          -- nome da instância na Evolution
  limite_dia  int  not null default 40,
  ativo       boolean not null default true,
  responder   boolean not null default true, -- respostas automáticas do agente neste número
  criado_em   timestamptz not null default now()
);

create table if not exists versoes (
  slug        text primary key,          -- vai no link: /p/<slug>
  canal       text not null check (canal in ('direto','grupo','email','wpp')),
  angulo      text not null,
  assunto     text,                      -- só e-mail
  texto       text not null,             -- use {link} e, no automático, {nome}
  status      text not null default 'ativa' check (status in ('ativa','pendente','pausada','descartada')),
  criada_em   timestamptz not null default now()
);

-- Cada clique no link curto. Não guarda IP, telefone, e-mail nem user agent.
create table if not exists cliques (
  id         bigint generated always as identity primary key,
  slug       text not null references versoes(slug),
  criado_em  timestamptz not null default now()
);

-- Envios: automáticos (1 por mensagem) ou informados pelo time (qtd).
create table if not exists envios (
  id         bigint generated always as identity primary key,
  slug       text not null references versoes(slug),
  qtd        int  not null default 1,
  numero     text references numeros(id),
  tipo       text not null default 'primeiro' check (tipo in ('primeiro','lembrete')),
  criado_em  timestamptz not null default now()
);

-- Fila temporária dos disparos automáticos. Cada linha é apagada depois do lembrete
-- (ou depois de DIAS_LIMPEZA dias). Não é base de contatos.
create table if not exists fila (
  id              bigint generated always as identity primary key,
  canal           text not null check (canal in ('email','wpp')),
  contato         text not null,          -- e-mail ou telefone só com dígitos (55DDXXXXXXXXX)
  nome            text,
  slug            text references versoes(slug),
  numero          text references numeros(id),   -- WhatsApp: número dono deste contato
  enviado_em      timestamptz,
  lembrete_em     timestamptz,
  reservado_em    timestamptz,            -- modo assistido: quem do time pegou o contato
  erro            text,
  criado_em       timestamptz not null default now(),
  unique (canal, contato)
);

-- Quem já recebeu mensagem de cada número (hash). Serve para o agente só responder
-- conversas da pesquisa e ignorar o resto do WhatsApp pessoal. Apagar no fim do projeto.
create table if not exists contatados (
  hash       text not null,
  numero     text not null references numeros(id),
  humano     boolean not null default false,   -- o dono já respondeu à mão: o bot para de responder
  criado_em  timestamptz not null default now(),
  primary key (hash, numero)
);

-- Ids das mensagens enviadas pelo bot (para distinguir do que o dono do número digitou).
create table if not exists msgs_bot (
  id         text primary key,
  criado_em  timestamptz not null default now()
);

-- Quem pediu para sair. Só o hash SHA-256 do contato, para não reenviar.
create table if not exists optout (
  hash       text primary key,
  criado_em  timestamptz not null default now()
);

-- Total de respostas completas informado pela mestranda.
create table if not exists respostas (
  dia    date primary key,
  total  int not null
);

-- Motivos de recusa, só a categoria.
create table if not exists objecoes (
  id         bigint generated always as identity primary key,
  canal      text not null,
  categoria  text not null,
  criado_em  timestamptz not null default now()
);

create or replace view stats_versoes as
select v.slug, v.canal, v.angulo, v.status, v.criada_em,
  coalesce((select sum(e.qtd) from envios e where e.slug = v.slug and e.tipo = 'primeiro'), 0)::int as envios,
  coalesce((select count(*) from cliques c where c.slug = v.slug), 0)::int as cliques
from versoes v;

alter table versoes  enable row level security;
alter table cliques  enable row level security;
alter table envios   enable row level security;
alter table fila     enable row level security;
alter table optout   enable row level security;
alter table respostas enable row level security;
alter table objecoes enable row level security;
alter table numeros  enable row level security;
alter table contatados enable row level security;
alter table msgs_bot enable row level security;
-- Sem policies: só a service role (usada pelo servidor) acessa.

-- Versões iniciais. A versão A é a mensagem que vocês já têm: troque o texto pelo painel antes de começar.
insert into versoes (slug, canal, angulo, assunto, texto) values
('a-direto','direto','Mensagem original',null,'[COLE AQUI A MENSAGEM PRONTA] {link}'),
('b-direto','direto','Contribuição para o serviço público',null,
'Oi, [nome]! Tudo bem? Sou [seu nome], da Capital Consultoria Júnior da FGV. Estamos apoiando uma pesquisa de mestrado da EPPG/FGV sobre como servidores públicos tomam decisões e usam ferramentas digitais e IA no trabalho. O resultado deve ajudar a pensar capacitação e uso de IA no setor público. São uns 15 minutos, anônimo e voluntário: {link}. Se puder, encaminhe também para colegas servidores. Obrigado!'),
('c-direto','direto','Pedido pessoal e direto',null,
'[Nome], posso te pedir uma ajuda rápida? Uma mestranda da FGV precisa de respostas de servidores públicos para a dissertação dela, sobre tomada de decisão e uso de IA no trabalho. Leva uns 15 minutos e não identifica ninguém: {link}. Se conhecer outros servidores que topariam, encaminhar já ajuda muito.'),
('d-direto','direto','Tema da IA',null,
'Oi, [nome]! Você usa ChatGPT ou outra IA no seu trabalho no serviço público? Ou nunca usou? As duas respostas interessam. Uma pesquisa de mestrado da EPPG/FGV está levantando isso com servidores. 15 minutos, anônima e voluntária: {link}. Obrigado desde já!'),

('a-grupo','grupo','Mensagem original',null,'[COLE AQUI A MENSAGEM PRONTA] {link}'),
('b-grupo','grupo','Contribuição para o serviço público',null,
'Boa tarde, pessoal. Sou [seu nome], da Capital Consultoria Júnior da FGV. Peço licença para divulgar uma pesquisa de mestrado da EPPG/FGV com servidores públicos sobre tomada de decisão e uso de IA no trabalho. O resultado deve apoiar políticas de capacitação no setor público. Leva cerca de 15 minutos, é anônima e aprovada pelo comitê de ética da FGV: {link}. Obrigado a quem puder participar.'),
('c-grupo','grupo','Pedido pessoal e direto',null,
'Pessoal, um pedido rápido: uma mestranda da FGV precisa de respostas de servidores públicos para fechar a dissertação. São uns 15 minutos, anônimo, aprovado pelo comitê de ética: {link}. Quem puder responder ou repassar para colegas servidores já ajuda muito. Obrigado!'),
('d-grupo','grupo','Tema da IA',null,
'Pergunta para os servidores do grupo: vocês usam IA no trabalho? Usando ou não, a pesquisa de mestrado da EPPG/FGV quer ouvir vocês. Cerca de 15 minutos, anônima e aprovada pelo comitê de ética da FGV: {link}. Obrigado!'),

('a-wpp','wpp','Mensagem original',null,'[COLE AQUI A MENSAGEM PRONTA] {link}'),
('b-wpp','wpp','Contribuição para o serviço público',null,
'Olá, {nome}! Aqui é da Capital Consultoria Júnior da FGV. Estamos apoiando uma pesquisa de mestrado da EPPG/FGV sobre como servidores públicos tomam decisões e usam ferramentas digitais e IA no trabalho. O resultado deve ajudar a pensar capacitação e uso de IA no setor público. São uns 15 minutos, anônimo e voluntário: {link}

Se não quiser receber mensagens sobre isso, responda SAIR.'),
('c-wpp','wpp','Pedido pessoal e direto',null,
'Olá, {nome}! Podemos te pedir uma ajuda rápida? Uma mestranda da FGV precisa de respostas de servidores públicos para a dissertação dela, sobre tomada de decisão e uso de IA no trabalho. Leva uns 15 minutos e não identifica ninguém: {link}

Se não quiser receber mensagens sobre isso, responda SAIR.'),
('d-wpp','wpp','Tema da IA',null,
'Olá, {nome}! Você usa ChatGPT ou outra IA no seu trabalho no serviço público? Ou nunca usou? As duas respostas interessam. Uma pesquisa de mestrado da EPPG/FGV está levantando isso com servidores. 15 minutos, anônima e voluntária: {link}

Se não quiser receber mensagens sobre isso, responda SAIR.'),

('a-email','email','Mensagem original','[ASSUNTO]','[COLE AQUI A MENSAGEM PRONTA] {link}'),
('b-email','email','Contribuição para o serviço público','Pesquisa FGV com servidores públicos sobre uso de IA no trabalho',
'Prezado(a) {nome},

Escrevo pela Capital Consultoria Júnior da FGV, que apoia a coleta de uma pesquisa de mestrado da Escola de Políticas Públicas e Governo (EPPG/FGV). O estudo investiga tomada de decisão, letramento digital e uso de inteligência artificial no setor público, e deve apoiar ações de capacitação de servidores.

A participação leva cerca de 15 minutos, é voluntária e anônima, e a pesquisa foi aprovada pelo Comitê de Ética da FGV:
{link}

Se puder, compartilhe também com colegas do seu órgão.

Obrigado pela atenção,
Capital Consultoria Júnior – FGV

Se não quiser receber outro contato sobre esta pesquisa, responda "remover".'),
('c-email','email','Pedido pessoal e direto','Um pedido rápido de uma pesquisa de mestrado da FGV',
'Prezado(a) {nome},

Uma mestranda da EPPG/FGV precisa de respostas de servidores públicos para concluir a dissertação, sobre tomada de decisão e uso de IA no trabalho. Somos da Capital Consultoria Júnior da FGV e estamos ajudando na divulgação.

São cerca de 15 minutos, de forma anônima e voluntária, com aprovação do Comitê de Ética da FGV:
{link}

Se conhecer colegas que topariam participar, encaminhar já ajuda muito.

Obrigado,
Capital Consultoria Júnior – FGV

Se não quiser receber outro contato sobre esta pesquisa, responda "remover".'),
('d-email','email','Tema da IA','Você usa IA no seu trabalho no serviço público?',
'Prezado(a) {nome},

Você usa ChatGPT ou outra ferramenta de IA no trabalho? Ou nunca usou? As duas respostas interessam a uma pesquisa de mestrado da Escola de Políticas Públicas e Governo (EPPG/FGV) sobre tomada de decisão e uso de IA no setor público.

A participação leva cerca de 15 minutos, é anônima, voluntária e aprovada pelo Comitê de Ética da FGV:
{link}

Obrigado pela atenção,
Capital Consultoria Júnior – FGV

Se não quiser receber outro contato sobre esta pesquisa, responda "remover".')
on conflict (slug) do nothing;
