import Link from "next/link";
import type { Metadata } from "next";
import { FormularioTema } from "@/components/publico/foro";
import { MuroComunidad } from "@/components/publico/muro-comunidad";
import { perfilActual } from "@/lib/auth/sesion";
import { muroDeComunidad } from "@/lib/datos/comunidad";
import { miCupo } from "@/lib/datos/foro";
import { MONEDA, monedasParaAbrirTema } from "@/lib/vocabulario";

export const metadata: Metadata = { title: "Comunidad · Guía del Cacao" };

/**
 * El muro de la comunidad.
 *
 * Reemplazó a la pestaña de Noticias en la barra de abajo, y se quedó con lo
 * que había en tres pantallas sueltas: los temas del foro, los eventos que
 * vienen y las noticias de los negocios. Eventos conserva su propia pestaña
 * porque es lo único con fecha de caducidad: quien busca "qué hago el sábado"
 * no debería tener que filtrar para llegar.
 */
export default async function Comunidad() {
  const [entradas, perfil] = await Promise.all([muroDeComunidad(), perfilActual()]);

  const puedeParticipar =
    perfil?.rol_confirmado && (perfil.rol === "cliente" || perfil.rol === "negocio");

  const cupo = puedeParticipar ? await miCupo(perfil.id) : null;
  const puedeAbrir = cupo !== null && cupo.abiertos < cupo.permitidos;
  const esNegocio = perfil?.rol === "negocio";

  return (
    <>
      <h1 className="pt-8 font-display text-3xl">Comunidad</h1>
      <p className="mt-2 max-w-prose text-cacao">
        Lo que se está diciendo y lo que viene: temas de la gente, eventos y
        noticias de los negocios del cacao.
      </p>

      <div className="pt-5">
        {!perfil ? (
          <p className="rounded-3xl bg-crema-2 p-5 text-cacao">
            <Link href="/login?volver=/comunidad" className="font-bold text-selva underline">
              Inicia sesión
            </Link>{" "}
            para comentar y abrir temas.
          </p>
        ) : puedeAbrir ? (
          <FormularioTema />
        ) : cupo === null ? null : cupo.permitidos === 0 ? (
          // Decirle cuánto le falta es lo que convierte el "no" en una meta.
          esNegocio ? (
            <p className="rounded-3xl bg-crema-2 p-5 text-cacao">
              Abrir temas viene con el plan <strong>Barra</strong>. Comentar sí
              puedes desde cualquier plan.
            </p>
          ) : (
            <p className="rounded-3xl bg-crema-2 p-5 text-cacao">
              Te faltan{" "}
              <strong>
                {monedasParaAbrirTema(cupo.monedas)} {MONEDA.variasCortas}
              </strong>{" "}
              para abrir tu primer tema. Llevas {cupo.monedas}. Comentar es libre.
            </p>
          )
        ) : (
          <p className="rounded-3xl bg-crema-2 p-5 text-cacao">
            Ya tienes {cupo.abiertos} de {cupo.permitidos}{" "}
            {cupo.permitidos === 1 ? "tema" : "temas"}.{" "}
            {esNegocio
              ? "El plan Barra permite hasta tres."
              : `Con 100 ${MONEDA.plural} puedes tener hasta tres.`}
          </p>
        )}
      </div>

      <MuroComunidad entradas={entradas} />
    </>
  );
}
