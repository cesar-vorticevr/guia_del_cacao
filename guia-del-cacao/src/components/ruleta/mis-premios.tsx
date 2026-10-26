import Link from "next/link";
import { hoyEnMexico, misPremios } from "@/lib/datos/ruleta";

const FECHA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/**
 * «Mis premios»: lo que ganó quien mira en las ruletas, como vales que se van
 * guardando. Los vigentes arriba y grandes, con su código listo para
 * enseñarse; los ya canjeados o vencidos debajo, en chico, para el recuerdo.
 */
export async function MisPremios() {
  const premios = await misPremios();
  const hoy = hoyEnMexico();

  const vigentes = premios.filter((p) => !p.canjeadoEn && p.venceEn >= hoy);
  const pasados = premios.filter((p) => p.canjeadoEn || p.venceEn < hoy);

  return (
    <section className="grid gap-6">
      <div>
        <h2 className="font-display text-2xl">Mis premios</h2>
        <p className="mt-1 text-cacao">
          Lo que has ganado en las ruletas de los negocios. Enseña el código en
          el negocio antes de que venza.
        </p>
      </div>

      {premios.length === 0 ? (
        <div className="caja-vacia rounded-3xl bg-crema-2 p-6 text-cacao">
          Todavía no has ganado nada.{" "}
          <Link href="/directorio?ruleta=1" className="font-bold underline">
            Busca los negocios con 🎡 ruleta
          </Link>{" "}
          y gira la tuya.
        </div>
      ) : (
        <>
          {vigentes.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2">
              {vigentes.map((p) => (
                <li
                  key={p.codigo}
                  className="tarjeta-magica rounded-3xl border-2 border-mango/40 bg-white p-5 text-center"
                >
                  <p className="antetitulo">{p.marca}</p>
                  <p className="mt-2 font-display text-2xl font-semibold">{p.premio}</p>
                  <p className="mt-3 select-all font-mono text-2xl font-bold tracking-[0.15em] text-mango">
                    {p.codigo}
                  </p>
                  <p className="mt-2 text-sm text-cacao/70">
                    Vale hasta el {FECHA.format(new Date(`${p.venceEn}T00:00:00Z`))} ·{" "}
                    <Link href={`/marca/${p.slug}`} className="underline">
                      {p.sucursal}
                    </Link>
                  </p>
                </li>
              ))}
            </ul>
          )}

          {pasados.length > 0 && (
            <div>
              <h3 className="font-display text-lg">Ya usados o vencidos</h3>
              <ul className="mt-3 grid gap-2">
                {pasados.map((p) => (
                  <li
                    key={p.codigo}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-ink/10 bg-white px-4 py-3 text-sm"
                  >
                    <span>
                      <strong>{p.premio}</strong> · {p.marca}
                    </span>
                    <span className="text-cacao/70">{p.canjeadoEn ? "Canjeado" : "Venció"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
