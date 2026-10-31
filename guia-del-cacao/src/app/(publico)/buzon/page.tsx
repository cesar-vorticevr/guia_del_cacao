import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { perfilActual } from "@/lib/auth/sesion";
import { abrirConversacion } from "@/lib/buzon/acciones";
import { tipoDeCuenta } from "@/lib/buzon/textos";
import { buscarDestinatarios, misConversaciones } from "@/lib/datos/buzon";
import { haceCuanto } from "@/lib/tiempo";

export const metadata: Metadata = { title: "Buzón · Guía del Cacao" };

/** De dónde vuelve cada quien: el buzón no es una sección de un solo panel. */
function volverA(rol: string) {
  if (rol === "negocio") return { href: "/negocio/panel", texto: "Volver a tu panel" };
  if (rol === "admin") return { href: "/admin", texto: "Volver a la administración" };
  return { href: "/cuenta", texto: "Volver a tu cuenta" };
}

/**
 * El buzón (migración 000069): las conversaciones de quien mira, la más
 * reciente arriba, y «Nuevo mensaje» para escribirle a alguien.
 *
 * Vive en el sitio público y no en cada panel porque es el mismo para las
 * cuatro clases de cuenta, como `/eventos` lo es para quien publica y quien
 * lee. Cada panel trae su entrada (el sobre del encabezado) y su vuelta.
 *
 * A quién se le puede escribir no lo decide esta pantalla: el buscador solo
 * devuelve lo que `buscar_destinatarios` deja, y `abrir_conversacion` lo
 * vuelve a revisar.
 */
export default async function Buzon({
  searchParams,
}: {
  searchParams: Promise<{ nuevo?: string; q?: string; error?: string }>;
}) {
  const { nuevo, q, error } = await searchParams;
  const perfil = await perfilActual();

  if (!perfil) redirect("/login?volver=/buzon");
  if (!perfil.rol_confirmado) redirect("/elegir-rol");

  const consulta = q?.trim().slice(0, 80) ?? "";
  const escribiendo = nuevo === "1" || consulta !== "";

  const [conversaciones, destinatarios] = await Promise.all([
    misConversaciones(),
    escribiendo ? buscarDestinatarios(consulta) : Promise.resolve([]),
  ]);

  const sinLeer = conversaciones.reduce((total, c) => total + c.sin_leer, 0);
  const vuelta = volverA(perfil.rol);

  return (
    <div className="mx-auto grid max-w-3xl gap-8 py-10">
      <header className="text-center">
        <p className="antetitulo">Tu buzón</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">
          Tus <em className="texto-oro">mensajes</em>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-crema/75">
          {sinLeer > 0
            ? `Tienes ${sinLeer === 1 ? "un mensaje" : `${sinLeer} mensajes`} sin leer.`
            : "Escríbele a un negocio, a tu asesor o a la Guía, y aquí te contestan."}
        </p>
        <p className="mt-3">
          <Link href={vuelta.href} className="text-sm font-bold text-mango underline underline-offset-4">
            ← {vuelta.texto}
          </Link>
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-2xl border-2 border-guayaba/40 bg-guayaba/10 px-4 py-3 font-bold text-cacao">
          {error}
        </p>
      )}

      <details open={escribiendo} className="group rounded-3xl border-2 border-mango/30 bg-white p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-display text-xl text-selva-2">
          <span>✉ Nuevo mensaje</span>
          <span aria-hidden="true" className="text-mango transition-transform group-open:rotate-45">＋</span>
        </summary>

        <form action="/buzon" className="mt-4 flex gap-2">
          <input type="hidden" name="nuevo" value="1" />
          <label className="min-w-0 flex-1">
            <span className="sr-only">¿A quién le escribes?</span>
            <input
              type="search"
              name="q"
              defaultValue={consulta}
              placeholder={perfil.rol === "admin" ? "Nombre, marca o correo" : "Nombre del negocio o del asesor"}
              className="min-h-12 w-full rounded-full border-2 border-selva/20 bg-white px-5 text-base text-ink focus:border-selva"
            />
          </label>
          <button type="submit" className="min-h-12 rounded-full border-2 border-mango/40 bg-white px-5 font-bold text-selva-2 hover:border-mango">
            Buscar
          </button>
        </form>

        {escribiendo && (
          <ul className="mt-4 grid gap-2">
            {destinatarios.map((d) => (
              <li key={d.id}>
                <form action={abrirConversacion} className="flex items-center justify-between gap-3 rounded-2xl bg-crema-2 px-4 py-3">
                  <input type="hidden" name="destino" value={d.id} />
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-selva-2">{d.nombre}</span>
                    <span className="block text-xs text-cacao/70">{tipoDeCuenta(d.tipo)}</span>
                  </span>
                  <button type="submit" className="boton-oro brillo min-h-10 shrink-0 rounded-full px-4 text-sm font-bold text-ink">
                    Escribir
                  </button>
                </form>
              </li>
            ))}
            {consulta && destinatarios.every((d) => d.tipo === "guia") && (
              <li className="px-1 text-sm text-cacao/70">
                No encontramos a nadie con «{consulta}» a quien escribirle.
              </li>
            )}
          </ul>
        )}

        <p className="mt-4 text-sm text-cacao/70">
          {perfil.rol === "admin"
            ? "Como administrador le escribes a cualquier cuenta."
            : "Le escribes a un negocio, a un asesor de la Guía o a la administración. A un visitante solo se le contesta cuando él escribe primero."}
        </p>
      </details>

      <section aria-label="Conversaciones" className="grid gap-3">
        {conversaciones.length === 0 ? (
          <p className="rounded-3xl bg-crema-2 p-6 text-center text-cacao">
            Todavía no tienes conversaciones. En el micrositio de cada negocio está
            «Escribir al negocio», o empieza una desde «Nuevo mensaje».
          </p>
        ) : (
          <ul className="grid gap-3">
            {conversaciones.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/buzon/${c.id}`}
                  className={`tarjeta-magica flex items-center gap-4 rounded-3xl border-2 bg-white p-4 transition-colors ${
                    c.sin_leer > 0 ? "border-mango" : "border-ink/10"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="grid size-12 shrink-0 place-items-center rounded-full bg-crema-2 font-display text-xl text-selva-2"
                  >
                    {c.otro_nombre.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-bold text-selva-2">{c.otro_nombre}</span>
                      <span className="shrink-0 font-mono text-xs text-cacao/60" title={new Date(c.ultimo_mensaje_en).toLocaleString("es-MX")}>
                        {haceCuanto(c.ultimo_mensaje_en)}
                      </span>
                    </span>
                    <span className="block text-xs text-cacao/60">{tipoDeCuenta(c.otro_tipo)}</span>
                    <span className={`mt-1 block truncate ${c.sin_leer > 0 ? "font-bold text-cacao" : "text-cacao/75"}`}>
                      {c.ultimo_es_mio && "Tú: "}
                      {c.ultimo_texto}
                    </span>
                  </span>
                  {c.sin_leer > 0 && (
                    <span className="grid min-w-7 shrink-0 place-items-center rounded-full bg-guayaba px-2 py-0.5 text-sm font-extrabold text-white">
                      {c.sin_leer}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
