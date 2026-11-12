// Testa a extração com um HTML no formato típico das páginas "Quem é quem" do gov.br.
import { extraiEmails, linksRelevantes } from '../lib/busca.ts';

const html = `
<html><body>
<nav><a href="/orgao/pt-br/composicao/quem-e-quem">Quem é quem</a> <a href="/orgao/pt-br/noticias">Notícias</a>
<a href="/orgao/pt-br/acesso-a-informacao/institucional/estrutura.pdf">Estrutura (PDF)</a></nav>
<h2>Secretaria de Gestão</h2>
<div class="pessoa"><strong>Maria Aparecida da Silva</strong><br>Secretária de Gestão<br>
Telefone: (61) 2020-1111<br>E-mail: <a href="mailto:maria.silva@gestao.gov.br">maria.silva@gestao.gov.br</a></div>
<div class="pessoa"><strong>João Pedro Santos</strong><br>Coordenador-Geral<br>joao.santos [at] gestao.gov.br</div>
<p>Gabinete: <a href="mailto:gabinete.sg@gestao.gov.br">gabinete.sg@gestao.gov.br</a></p>
<p>Ouvidoria: ouvidoria@gestao.gov.br · Imprensa: imprensa@gestao.gov.br</p>
<p>Ana Lúcia Ferreira – ana.ferreira&#64;tjdft.jus.br</p>
<p>Contato pessoal: fulano123@gmail.com</p>
<p>Carlos Eduardo dos Reis<br>carlos.reis@camara.leg.br</p>
</body></html>`;

const r = extraiEmails(html, 'https://www.gov.br/orgao/pt-br/composicao/quem-e-quem');
console.table(r.map(({ email, nome, tipo }) => ({ email, nome, tipo })));
const links = linksRelevantes(html, new URL('https://www.gov.br/orgao/pt-br'));
console.log(links);

const esperado: Record<string, { nome: string | null; tipo: string }> = {
  'maria.silva@gestao.gov.br': { nome: 'Maria Aparecida da Silva', tipo: 'pessoal' },
  'joao.santos@gestao.gov.br': { nome: 'João Pedro Santos', tipo: 'pessoal' },
  'gabinete.sg@gestao.gov.br': { nome: null, tipo: 'setor' },
  'ana.ferreira@tjdft.jus.br': { nome: 'Ana Lúcia Ferreira', tipo: 'pessoal' },
  'carlos.reis@camara.leg.br': { nome: 'Carlos Eduardo dos Reis', tipo: 'pessoal' },
};
let ok = r.length === Object.keys(esperado).length;
for (const a of r) {
  const e = esperado[a.email];
  if (!e || e.nome !== a.nome || e.tipo !== a.tipo) { ok = false; console.error('divergente:', a); }
}
if (links.length !== 1 || !links[0].includes('quem-e-quem')) { ok = false; console.error('links errados'); }
console.log(ok ? 'OK' : 'FALHOU');
if (!ok) process.exit(1);
