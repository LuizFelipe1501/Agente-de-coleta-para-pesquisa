// Todas as configurações vêm de variáveis de ambiente (veja .env.example).

function num(nome: string, padrao: number): number {
  const v = process.env[nome];
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : padrao;
}

export const config = {
  surveyUrl: process.env.SURVEY_URL || 'https://pt.surveymonkey.com/r/L3TQHL5',
  baseUrl: (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  meta: num('META_RESPOSTAS', 250),

  // Bandit
  minEnviosPorVersao: num('MIN_ENVIOS_POR_VERSAO', 100),
  minParticipacao: num('MIN_PARTICIPACAO', 0.1),

  // Janela de envio automático (horário de Brasília)
  diasEnvio: (process.env.DIAS_ENVIO || '1,2,3,4,5').split(',').map(Number), // 0 = domingo
  horaInicio: num('HORA_INICIO', 9),
  horaFim: num('HORA_FIM', 17),

  // E-mail
  emailLimiteDia: num('EMAIL_LIMITE_DIA', 200),
  emailPorExecucao: num('EMAIL_POR_EXECUCAO', 15),

  // WhatsApp automático
  wppPorExecucao: num('WPP_POR_EXECUCAO', 2),
  wppIntervaloSeg: num('WPP_INTERVALO_SEG', 20),

  diasLembrete: num('DIAS_LEMBRETE', 6),
  diasLimpeza: num('DIAS_LIMPEZA', 14),

  modelo: process.env.MODELO_IA || 'gemini-3.6-flash',

  // 'assistido' = time envia pelo link do WhatsApp (grátis); 'evolution' = envio automático pela Evolution API
  wppModo: (process.env.WPP_MODO || 'assistido') as 'assistido' | 'evolution',
  wppLotePorPessoa: num('WPP_LOTE_POR_PESSOA', 15),
};

export const CANAIS = ['direto', 'grupo', 'wpp', 'email'] as const;
export type Canal = (typeof CANAIS)[number];

export const NOME_CANAL: Record<Canal, string> = {
  direto: 'WhatsApp – envio pelo time',
  grupo: 'Grupos',
  wpp: 'WhatsApp – fila de contatos',
  email: 'E-mail automático',
};
