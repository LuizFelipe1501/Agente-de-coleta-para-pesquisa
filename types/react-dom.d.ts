// Tipagem mínima do que o painel usa de react-dom (o projeto não instala @types/react-dom).
declare module 'react-dom' {
  export function useFormStatus(): { pending: boolean; data: FormData | null; method: string | null; action: unknown };
}
