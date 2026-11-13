#!/usr/bin/env bash
# Instala a Evolution API numa VM Ubuntu da Oracle Cloud (Ampere A1, ARM).
# Uso: bash instalar.sh https://seu-bot.vercel.app <WEBHOOK_SECRET do bot>
set -euo pipefail

BOT_URL="${1:?Informe a URL do bot (ex.: https://seu-bot.vercel.app)}"
WEBHOOK_SECRET="${2:?Informe o WEBHOOK_SECRET configurado na Vercel}"
BOT_URL="${BOT_URL%/}"
cd "$(dirname "$0")"

echo "==> Instalando Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
fi

# Máquina pequena (VM.Standard.E2.1.Micro, 1 GB): cria 3 GB de swap e usa a configuração enxuta.
MEM_MB=$(free -m | awk '/^Mem:/{print $2}')
if [ "$MEM_MB" -lt 2000 ]; then
  echo "==> Pouca memória ($MEM_MB MB): criando swap de 3 GB e usando o modo enxuto"
  if [ ! -f /swapfile ]; then
    sudo fallocate -l 3G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
    echo 'vm.swappiness=20' | sudo tee /etc/sysctl.d/99-swap.conf >/dev/null && sudo sysctl -p /etc/sysctl.d/99-swap.conf >/dev/null
  fi
  COMPOSE_ARQ="docker-compose.micro.yml"
else
  COMPOSE_ARQ="docker-compose.yml"
fi

echo "==> Liberando portas 80 e 443 no firewall da VM"
# As imagens Ubuntu da Oracle vêm com regras iptables que bloqueiam tudo além do SSH.
for p in 80 443; do
  sudo iptables -C INPUT -p tcp --dport $p -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport $p -j ACCEPT
done
sudo apt-get install -y netfilter-persistent iptables-persistent >/dev/null 2>&1 || true
sudo netfilter-persistent save >/dev/null 2>&1 || true

IP=$(curl -fsS https://api.ipify.org)
DOMINIO="${IP//./-}.sslip.io"   # domínio gratuito que aponta para o IP da VM

if [ ! -f .env ]; then
  echo "==> Gerando .env"
  cat > .env <<EOT
DOMINIO=$DOMINIO
BOT_URL=$BOT_URL
WEBHOOK_SECRET=$WEBHOOK_SECRET
EVOLUTION_API_KEY=$(openssl rand -hex 24)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
EOT
fi
source .env

echo "==> Baixando a imagem da Evolution"
if ! sudo docker pull "${EVOLUTION_IMAGE:-evoapicloud/evolution-api:v2.3.7}"; then
  echo "Imagem pronta indisponível para ARM. Compilando a partir do código (leva uns 10 minutos)..."
  sudo apt-get install -y git >/dev/null
  rm -rf /tmp/evolution-src
  git clone --depth 1 --branch 2.3.7 https://github.com/EvolutionAPI/evolution-api.git /tmp/evolution-src
  sudo docker build -t evolution-local:2.3.7 /tmp/evolution-src
  echo "EVOLUTION_IMAGE=evolution-local:2.3.7" >> .env
fi

echo "==> Subindo os serviços"
sudo docker compose -f "$COMPOSE_ARQ" up -d

echo
echo "Pronto. Anote estes dados para a Vercel:"
echo "  EVOLUTION_URL=https://$DOMINIO"
echo "  EVOLUTION_API_KEY=$EVOLUTION_API_KEY"
echo
echo "Painel para criar as instâncias e ler os QR codes: https://$DOMINIO/manager"
echo "(entre com a URL https://$DOMINIO e a chave acima; o certificado HTTPS pode levar 1 minuto)"
