'use client';
import { useFormStatus } from 'react-dom';

// Botão que mostra "Disparando…" enquanto a rodada roda (pode levar até 1 minuto).
export default function BotaoEnviar({ texto, desligado, dica }: { texto: string; desligado?: boolean; dica?: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={desligado || pending} title={dica}>
      {pending ? 'Disparando… (até 1 min)' : texto}
    </button>
  );
}
