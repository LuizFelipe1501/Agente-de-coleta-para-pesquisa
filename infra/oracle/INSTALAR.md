# WhatsApp automático na Oracle Cloud (grátis)

Resultado: uma máquina gratuita da Oracle, ligada o tempo todo, rodando a Evolution API com os 4 WhatsApps do time conectados. O bot na Vercel manda as mensagens por ela e recebe as respostas.

## 1. Criar a máquina (uma vez, ~20 min)

1. Crie a conta em cloud.oracle.com (pede cartão só para verificação). Região: **Brazil East (São Paulo)**.
2. Menu > Compute > Instances > **Create instance**.
   - Image: **Canonical Ubuntu 24.04**.
   - Shape: **Ampere > VM.Standard.A1.Flex**, **2 OCPUs e 12 GB** (é o limite do plano gratuito; passou disso, a Oracle desliga).
   - Em "Add SSH keys", baixe a chave privada.
3. Depois de criada, abra a instância > Subnet > Security List > **Add Ingress Rules**: origem `0.0.0.0/0`, TCP, portas `80,443`.
4. Se aparecer "Out of capacity", tente outro horário ou outra availability domain.

## 2. Instalar a Evolution (~10 min)

No seu computador:

```bash
ssh -i chave-baixada.key ubuntu@IP_DA_MAQUINA
```

Na máquina:

```bash
git clone <URL do repositório do bot> bot && cd bot/infra/oracle
bash instalar.sh https://seu-bot.vercel.app SEU_WEBHOOK_SECRET
```

O script instala o Docker, libera as portas, cria um endereço HTTPS gratuito (`IP.sslip.io`) e sobe tudo. No fim ele mostra `EVOLUTION_URL` e `EVOLUTION_API_KEY`: coloque os dois na Vercel e troque `WPP_MODO` para `evolution`.

## 3. Conectar os 4 WhatsApps

1. Abra `https://IP.sslip.io/manager`, entre com a URL e a chave.
2. Para cada pessoa: **Create instance**, nome curto (ex.: `luiz`), canal **Baileys**. Clique em **Connect** e a pessoa lê o QR code em WhatsApp > Aparelhos conectados.
3. No painel do bot (`/admin` > Números de WhatsApp), cadastre cada número com o **mesmo nome de instância**.
4. Suba os contatos de cada pessoa escolhendo o número dono deles.

## Como o bot trata os WhatsApps pessoais

- O servidor não guarda mensagens, contatos nem conversas (configurado no `docker-compose.yml`).
- O bot só responde quem recebeu mensagem da pesquisa por aquele número nos últimos 15 dias. Qualquer outra conversa é ignorada.
- Se a pessoa responder à mão pelo celular, o bot para de responder aquele contato.
- Dá para desligar as respostas automáticas de um número no painel e manter só o disparo.
- Ao fim do projeto: desconecte os aparelhos no WhatsApp, apague as instâncias e a máquina.

## Manutenção

```bash
cd ~/bot/infra/oracle
sudo docker compose ps          # ver se está tudo de pé
sudo docker compose logs -f evolution   # ver erros
sudo docker compose restart evolution   # reiniciar
```

Se um número desconectar (o celular ficou dias sem internet, por exemplo), abra o manager e leia o QR de novo.

A versão está fixada na 2.3.7 porque a 2.4 passou a exigir ativação de licença. Não atualize sem conferir isso.
