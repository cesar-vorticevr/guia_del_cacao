import Link from "next/link";
import type { MiGiro } from "@/lib/datos/ruleta";
import type { Frecuencia } from "@/lib/ruleta/textos";

const FECHA = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: "UTC" });

/**
 * La ruleta, encogida, para quien ya la giró y no le toca otra vez (000064).
 *
 * La rueda grande ocupa media pantalla, y a quien ya giró solo le estorba
 * para llegar al catálogo. Aquí queda un renglón con su icono y lo que ganó
 * —con su código, que es lo que viene a buscar si vuelve— o la suerte, y
 * cuándo puede volver a girar.
 */
export function RuletaYaGirada({
  giro,
  frecuencia,
  enlacePremios,
}: {
  giro: MiGiro;
  frecuencia: Frecuencia;
  enlacePremios: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-mango/30 bg-white px-5 py-4">
      <span
        aria-hidden
        className="grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ffe08a] via-[#ffb703] to-[#ff9f43] text-2xl shadow-[0_0_18px_rgb(255_183_3/0.45)]"
      >
        🎡
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold uppercase tracking-wider text-mango">
          Ya giraste la Ruleta Mágica
        </span>
        {giro.esPremio ? (
          <span className="block">
            Ganaste <strong>{giro.premio}</strong>
            {giro.codigo && (
              <>
                {" "}· código <strong className="select-all font-mono tracking-wider text-mango">{giro.codigo}</strong>
              </>
            )}
            <span className="block text-sm text-cacao/70">
              {giro.canjeadoEn
                ? "Ya lo canjeaste."
                : giro.venceEn
                  ? `Enséñalo en el negocio antes del ${FECHA.format(new Date(`${giro.venceEn}T00:00:00Z`))}.`
                  : null}
            </span>
          </span>
        ) : (
          <span className="block">
            Te tocó 🍀 <strong>Suerte para la próxima</strong>
          </span>
        )}
        {frecuencia === "diaria" && (
          <span className="block text-sm text-cacao/70">Mañana puedes volver a girar.</span>
        )}
      </span>

      {giro.esPremio && (
        <Link href={enlacePremios} className="shrink-0 text-sm font-bold text-mango underline-offset-4 hover:underline">
          Mis premios →
        </Link>
      )}
    </div>
  );
}
