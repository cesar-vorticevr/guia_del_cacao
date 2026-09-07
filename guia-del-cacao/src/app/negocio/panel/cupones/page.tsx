import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { NuevoCupon, TarjetaCupon } from "@/components/negocio/cupones";
import { perfilActual } from "@/lib/auth/sesion";
import {
  canjesDeMisCupones,
  cuposLibres,
  misCupones,
  TOPE_CUPONES,
} from "@/lib/datos/cupones";
import { marcarCanjeUsado } from "@/lib/publico/canjes";
import { misSucursales } from "@/lib/datos/sucursales";
import { FUNCIONES } from "@/lib/funciones";
import { MONEDA } from "@/lib/vocabulario";

export const metadata: Metadata = { title: "Cupones · Guía del Cacao" };

/**
 * Los cupones del negocio: lo que ofrece a cambio de mazorcas.
 *
 * Es lo que le da a las mazorcas un sitio donde gastarse. Hasta ahora solo se
 * juntaban visitando y se regalaban en la comunidad; aquí se cambian por algo
 * real, que es lo que cierra el círculo: visito, junto, canjeo, vuelvo.
 */
export default async function Cupones() {
  // Apagados para el lanzamiento (lib/funciones.ts): sin mazorcas no hay
  // con que pagarlos.
  if (!FUNCIONES.cupones) redirect("/negocio/panel");

  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const sucursales = await misSucursales(perfil.id);

  // Un cupón cuelga de una sucursal publicada: en borrador no lo ve nadie, así
  // que ofrecerlo desde ahí sería publicar a un escaparate cerrado.
  const publicadas = sucursales.filter((s) => s.estado === "publicado");
  const [cupones, canjes] = await Promise.all([
    misCupones(sucursales.map((s) => s.id)),
    canjesDeMisCupones(sucursales.map((s) => s.id)),
  ]);

  // Los que todavía no se han entregado van arriba: es lo que hay que atender.
  const porEntregar = canjes.filter((canje) => !canje.usadoEn);

  const quedan = cuposLibres(cupones);
  const vigentes = cupones.filter((c) => !c.caducado);
  const caducados = cupones.filter((c) => c.caducado);

  // Hoy en Tabasco, para que el calendario no ofrezca ayer.
  const hoy = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Mexico_City",
  });

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-3xl">Cupones</h1>
        <p className="mt-2 max-w-prose text-cacao">
          Lo que ofreces a cambio de {MONEDA.plural}. Hasta {TOPE_CUPONES}{" "}
          cupones vigentes a la vez; los que caducan no ocupan lugar.
        </p>
      </div>

      {publicadas.length === 0 ? (
        <p className="max-w-2xl rounded-3xl bg-crema-2 p-6 text-cacao">
          Para ofrecer cupones necesitas al menos una sucursal publicada: en
          borrador no la ve nadie, así que tampoco vería el cupón.
        </p>
      ) : (
        <NuevoCupon sucursales={publicadas} quedan={quedan} hoy={hoy} />
      )}

      {porEntregar.length > 0 && (
        /*
          Quién canjeó qué. Sin esto el aviso «alguien canjeó un cupón» no dice
          a quién hay que entregarle nada, y quien atiende tendría que fiarse
          de lo que le enseñen en el celular.
        */
        <section className="grid gap-3 rounded-3xl border-2 border-mango/50 bg-mango/15 p-6">
          <h2 className="font-display text-2xl">
            Por entregar{" "}
            <span className="font-mono text-sm font-normal text-cacao/70">
              {porEntregar.length}
            </span>
          </h2>

          <ul className="grid gap-2">
            {porEntregar.map((canje) => (
              <li
                key={canje.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block font-bold text-selva-2">
                    {canje.cliente}
                  </span>
                  <span className="block text-cacao">
                    {canje.cupon}
                    {canje.sucursal && (
                      <span className="text-cacao/70"> · {canje.sucursal}</span>
                    )}
                  </span>
                  <span className="font-mono text-xs text-cacao/70">
                    {canje.fechaTexto}
                  </span>
                </span>

                <form action={marcarCanjeUsado}>
                  <input type="hidden" name="canje_id" value={canje.id} />
                  <button
                    type="submit"
                    className="min-h-11 rounded-full bg-selva px-5 text-sm font-bold text-crema"
                  >
                    Ya se lo di
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4">
        <h2 className="font-display text-2xl">
          Vigentes{" "}
          <span className="font-mono text-sm font-normal text-cacao/70">
            {vigentes.length} de {TOPE_CUPONES}
          </span>
        </h2>

        {vigentes.length === 0 ? (
          <p className="rounded-3xl bg-crema-2 p-6 text-cacao">
            Todavía no tienes ninguno en pie.
          </p>
        ) : (
          <ul className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {vigentes.map((cupon) => (
              <TarjetaCupon key={cupon.id} cupon={cupon} />
            ))}
          </ul>
        )}
      </section>

      {caducados.length > 0 && (
        /*
          Los caducados se quedan a la vista y no se borran solos: sirven para
          saber qué se ofreció y para volver a publicar lo que funcionó. Van
          abajo y en gris, que es donde se guarda lo que ya pasó.
        */
        <section className="grid gap-4 border-t-2 border-ink/10 pt-6">
          <h2 className="font-display text-2xl">
            Caducados{" "}
            <span className="font-mono text-sm font-normal text-cacao/70">
              {caducados.length}
            </span>
          </h2>

          <ul className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {caducados.map((cupon) => (
              <TarjetaCupon key={cupon.id} cupon={cupon} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
