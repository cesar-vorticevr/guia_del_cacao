import { entrarConGoogle } from "@/lib/auth/acciones";
import { BotonEnviar } from "@/components/formulario";

function IconoGoogle() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.3z"
      />
      <path
        fill="#34A853"
        d="M24 46c6 0 11-2 14.5-5.2l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.8-12.3-9H4.3v5.7C7.8 41.1 15.3 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.7 28.4c-.4-1.3-.7-2.7-.7-4.4s.3-3.1.7-4.4v-5.7H4.3C2.8 16.9 2 20.3 2 24s.8 7.1 2.3 10.1l7.4-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.4c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 3.8 30 1.8 24 1.8 15.3 1.8 7.8 6.7 4.3 13.9l7.4 5.7c1.7-5.2 6.6-9.2 12.3-9.2z"
      />
    </svg>
  );
}

/**
 * Google resuelve la identidad, no el rol (spec §3.1). Por eso este botón es el
 * mismo en /login y en /registro: si la cuenta es nueva, después se pregunta si
 * es cliente o negocio.
 */
export function BotonGoogle({
  texto = "Continuar con Google",
  volver,
}: {
  texto?: string;
  /** A dónde devolver al terminar, si venía de una pantalla con sesión. */
  volver?: string | null;
}) {
  return (
    <form action={entrarConGoogle}>
      {volver && <input type="hidden" name="volver" value={volver} />}

      <BotonEnviar variante="secundario">
        <span className="flex items-center justify-center gap-2.5">
          <IconoGoogle />
          {texto}
        </span>
      </BotonEnviar>
    </form>
  );
}
