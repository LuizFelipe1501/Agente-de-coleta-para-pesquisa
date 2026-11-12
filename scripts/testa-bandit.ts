// Simulação: 4 versões com taxas reais de clique diferentes. O bandit deve concentrar envios na melhor.
import { escolheVersao } from '../lib/bandit.ts';

const real: Record<string, number> = { a: 0.04, b: 0.07, c: 0.12, d: 0.05 };
const bracos = Object.keys(real).map((slug) => ({ slug, envios: 0, cliques: 0 }));

for (let i = 0; i < 3000; i++) {
  const s = escolheVersao(bracos, { minEnvios: 100, minParticipacao: 0.1 });
  const b = bracos.find((x) => x.slug === s)!;
  b.envios++;
  if (Math.random() < real[s]) b.cliques++;
}

console.log('versão  taxa real  envios  cliques');
for (const b of bracos) console.log(`  ${b.slug}       ${(real[b.slug] * 100).toFixed(0)}%      ${String(b.envios).padStart(5)}  ${String(b.cliques).padStart(6)}`);
const melhor = bracos.reduce((m, b) => (b.envios > m.envios ? b : m));
const minimo = Math.min(...bracos.map((b) => b.envios));
if (melhor.slug !== 'c') { console.error('FALHOU: a melhor versão não recebeu mais envios'); process.exit(1); }
if (minimo < 3000 * 0.08) { console.error('FALHOU: alguma versão ficou abaixo da participação mínima'); process.exit(1); }
console.log('OK');
