// Escolha da versão a enviar (multi-armed bandit com Thompson sampling).
// Regras:
// 1. Enquanto alguma versão ativa tiver menos de `minEnvios` envios, sorteia entre as que têm menos envios.
// 2. Depois disso, com probabilidade minParticipacao × nº de versões, sorteia uniforme
//    (garante pelo menos minParticipacao para cada versão).
// 3. No resto, Thompson sampling: amostra Beta(cliques+1, envios-cliques+1) e fica com a maior.

export type BraçoStats = { slug: string; envios: number; cliques: number };

function normal(rand: () => number): number {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Marsaglia–Tsang
function gamma(k: number, rand: () => number): number {
  if (k < 1) return gamma(k + 1, rand) * Math.pow(rand(), 1 / k);
  const d = k - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do {
      x = normal(rand);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rand();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function beta(a: number, b: number, rand: () => number = Math.random): number {
  const x = gamma(a, rand);
  const y = gamma(b, rand);
  return x / (x + y);
}

export function escolheVersao(
  bracos: BraçoStats[],
  opts: { minEnvios: number; minParticipacao: number },
  rand: () => number = Math.random,
): string {
  if (bracos.length === 0) throw new Error('Nenhuma versão ativa neste canal');
  if (bracos.length === 1) return bracos[0].slug;

  const poucos = bracos.filter((b) => b.envios < opts.minEnvios);
  if (poucos.length > 0) {
    const menor = Math.min(...poucos.map((b) => b.envios));
    const candidatos = poucos.filter((b) => b.envios === menor);
    return candidatos[Math.floor(rand() * candidatos.length)].slug;
  }

  const pExplora = Math.min(opts.minParticipacao * bracos.length, 0.5);
  if (rand() < pExplora) return bracos[Math.floor(rand() * bracos.length)].slug;

  let melhor = bracos[0].slug;
  let melhorValor = -1;
  for (const b of bracos) {
    const cliques = Math.min(b.cliques, b.envios);
    const valor = beta(cliques + 1, b.envios - cliques + 1, rand);
    if (valor > melhorValor) {
      melhorValor = valor;
      melhor = b.slug;
    }
  }
  return melhor;
}

// Probabilidade estimada de cada versão ser a melhor (para o painel).
export function chanceDeSerMelhor(bracos: BraçoStats[], amostras = 4000): Record<string, number> {
  const vitorias: Record<string, number> = Object.fromEntries(bracos.map((b) => [b.slug, 0]));
  if (bracos.length === 0) return vitorias;
  for (let i = 0; i < amostras; i++) {
    let melhor = '';
    let mv = -1;
    for (const b of bracos) {
      const c = Math.min(b.cliques, b.envios);
      const v = beta(c + 1, b.envios - c + 1);
      if (v > mv) { mv = v; melhor = b.slug; }
    }
    vitorias[melhor]++;
  }
  for (const k of Object.keys(vitorias)) vitorias[k] /= amostras;
  return vitorias;
}
