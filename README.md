# Bot de recrutamento – pesquisa EPPG/FGV

Bot da Capital Consultoria Júnior para levar servidores públicos ao formulário da pesquisa de mestrado. Ele:

- dispara e-mail sozinho, em horário comercial e com limite por dia;
- monta a fila de WhatsApp com a mensagem pronta: o time só clica, envia e marca (grátis, sem servidor extra);
- escolhe qual versão da mensagem mandar com base nos cliques de cada uma (Thompson sampling);
- dá ao time a mensagem do momento para enviar dos próprios celulares e para grupos;
- conta cliques por versão sem identificar ninguém;
- responde por e-mail quem escreve de volta, só com o que está no TCLE, e passa para uma pessoa o que não souber;
- manda um lembrete único e apaga o contato da fila;
- sugere versões novas toda semana, que só entram no ar depois de aprovadas.

## Peças

| Peça | O que faz |
| --- | --- |
| `/p/<versao>` | Link curto: conta o clique e redireciona para o SurveyMonkey |
| `/admin` | Painel: meta, desempenho por versão, fila, aprovação de versões, registro em CSV |
| `/admin/busca` | Busca de e-mails institucionais em páginas públicas de órgãos |
| `/time` | Página do time: mensagem do momento + registro de quantas enviou |
| `/time/whatsapp` | Fila de WhatsApp: lote de contatos com link que abre o WhatsApp com a mensagem pronta |
| `/api/cron/disparo` | Disparo automático de e-mail (e de WhatsApp, se `WPP_MODO=evolution`), chamado a cada 10 min |
| `/api/cron/caixa` | Lê e responde e-mails recebidos, chamado a cada 10 min |
| `/api/whatsapp` | Webhook da Evolution API (só no modo `evolution`) |

## Como colocar no ar

1. **Supabase.** Crie um projeto e rode `supabase/schema.sql` no SQL Editor. Pegue a URL e a service role key.
2. **Vercel.** Suba esta pasta num repositório do GitHub e importe na Vercel. Cadastre as variáveis do `.env.example`.
3. **E-mail.** Use uma conta só para a pesquisa. No Gmail, ative a verificação em duas etapas e gere uma senha de app para `SMTP_PASS`. O IMAP precisa estar ligado.
4. **IA.** Em aistudio.google.com, crie uma chave da API do Gemini (plano gratuito) e coloque em `GEMINI_API_KEY`. O padrão é `gemini-3.6-flash`; se ele sair do plano gratuito, troque `MODELO_IA` por outro Flash gratuito listado no AI Studio.
5. **WhatsApp.** No modo padrão (`WPP_MODO=assistido`) não há nada a instalar. Para envio automático no futuro, veja a seção sobre a Evolution API.
6. **Agendador.** No GitHub, em Settings > Secrets > Actions, crie `BOT_URL` e `CRON_SECRET`. O arquivo `.github/workflows/agendador.yml` já chama o disparo e a caixa a cada 10 minutos. O cron do plano gratuito da Vercel só roda uma vez por dia, por isso o GitHub Actions.
7. **Textos.** Entre em `/admin`, abra a versão A de cada canal e cole a mensagem pronta (com `{link}`). Enquanto a A estiver com o texto provisório, o disparo daquele canal fica parado.
8. **Teste.** Coloque o seu e-mail e o seu número na fila. Para o e-mail, chame `https://seu-bot.vercel.app/api/cron/disparo?chave=<CRON_SECRET>&forcar=1`.

## Uso no dia a dia

- **Buscar contatos:** em `/admin/busca`, cole endereços de páginas "Quem é quem", organogramas e listas de contatos de órgãos. O bot lê essas páginas e as páginas de equipe/contato do mesmo site (até 40), respeita o robots.txt e só aceita domínios públicos (`DOMINIOS_PERMITIDOS`). Ouvidoria, SIC, protocolo, imprensa e e-mails pessoais são descartados. Você revisa a lista e adiciona à fila os que quiser. E-mails de setor (gabinete, coordenação) vêm desmarcados: servem para pedir divulgação interna.
- **Fila:** no painel, cole os contatos (um por linha, `contato;nome`). Quem pediu para sair é descartado.
- **WhatsApp (modo assistido):** cada pessoa abre `/time/whatsapp`, escolhe o próprio número, pega um lote de 15, clica em "Abrir no WhatsApp", envia e marca "Enviado". O lote fica reservado por 2 horas para ninguém mandar em dobro. Os lembretes aparecem na mesma fila depois de 6 dias. Se alguém pedir para sair, clique em "Pediu para sair".
- **Respostas:** todo dia, lance o total que a mestranda informar. É o único número de respostas completas que o bot tem.
- **Revisão semanal:** clique em "Gerar sugestões", leia, edite se precisar e aprove ou descarte. Pause as versões que estão claramente atrás.
- **Escalados:** e-mails que o agente não sabe responder ficam com estrela e não lidos na caixa. No WhatsApp, o que o agente não sabe responder fica para o dono do número, que já vê a mensagem no celular.
- **Fim do projeto:** baixe o registro de versões (CSV) para o método da dissertação e apague o projeto do Supabase.

## Variáveis importantes

- `EMAIL_LIMITE_DIA`: teto de e-mails por dia.
- `WPP_LOTE_POR_PESSOA` (padrão 15): tamanho do lote da fila de WhatsApp.
- `MODELO_IA`: modelo do Gemini.
- `MIN_ENVIOS_POR_VERSAO` (padrão 100): envios antes de o bot começar a favorecer versões.
- `MIN_PARTICIPACAO` (padrão 0,1): fatia mínima de cada versão ativa.
- `FAQ_ORIGEM_CONTATO`, `FAQ_QUEM_PODE`: respostas que dependem da mestranda. Vazias, o agente passa a pergunta para uma pessoa.

## Privacidade

- A busca não guarda nada: só o que você adiciona à fila entra no banco, e sai depois do lembrete.
- O clique guarda só a versão e o horário. Não guarda IP, telefone nem e-mail.
- A fila guarda contato e nome apenas até o lembrete (ou até `DIAS_LIMPEZA` dias) e depois apaga.
- Quem pede para sair vira um hash SHA-256 numa lista de bloqueio, para nunca receber de novo.
- Das respostas recebidas, só fica a categoria do motivo (sem tempo, desconfiança etc.).
- Antes de ir para o Gemini, e-mails e telefones são trocados por [email] e [telefone]. No plano gratuito, o Google pode usar o conteúdo enviado para melhorar os produtos dele; por isso nada identificável vai junto.

## WhatsApp automático com vários números (Evolution API na Oracle)

Cada pessoa do time conecta o próprio WhatsApp. No painel, cada número é cadastrado com seu limite diário (padrão 40) e cada contato da fila pertence a um número só: ninguém recebe a mesma mensagem de dois números. Os contatos de cada número devem ser da rede da pessoa dona dele.

O passo a passo para subir a Evolution de graça na Oracle Cloud está em `infra/oracle/INSTALAR.md`. Depois, troque `WPP_MODO` para `evolution` na Vercel.

Nesse modo o bot também responde no WhatsApp, mas só nas conversas da pesquisa (quem recebeu mensagem daquele número nos últimos 15 dias), e para de responder quando o dono responde à mão. O servidor não guarda mensagens.

A Evolution usa o WhatsApp Web, não a API oficial. Mensagem em volume para quem não tem o número salvo pode levar ao bloqueio. Mantenha o limite baixo, use só contatos da rede de cada pessoa e respeite qualquer pedido de saída. Se um número for bloqueado, pause-o no painel; os outros e o e-mail seguem funcionando.

## Testes

`npm test` simula 3.000 envios com taxas de clique diferentes e confere que o bot concentra os envios na melhor versão sem deixar nenhuma abaixo da fatia mínima. Também testa a extração de e-mails e nomes da busca de contatos.
