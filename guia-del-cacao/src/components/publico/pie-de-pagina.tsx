import Link from "next/link";
import { perfilActual } from "@/lib/auth/sesion";
import {
  IconoFacebook,
  IconoInstagram,
  IconoTikTok,
  IconoWhatsApp,
} from "@/components/iconos";

/** A dónde escribe quien quiere hablar con la guía. */
export const CORREO_DE_CONTACTO = "vorticevr@gmail.com";

/**
 * Las redes de la guía, en un solo lugar.
 *
 * **Están vacías a propósito hasta que existan las cuentas.** Un icono que
 * lleva a un perfil que no es nuestro es peor que no tener icono, así que se
 * pinta solo lo que tenga `url`; con el arreglo vacío, la fila entera
 * desaparece sola. Para encenderlas basta poner aquí la dirección.
 */
const REDES: { nombre: string; url: string | null; Icono: (p: { className?: string }) => React.ReactElement }[] = [
  { nombre: "Facebook", url: null, Icono: IconoFacebook },
  { nombre: "Instagram", url: null, Icono: IconoInstagram },
  { nombre: "TikTok", url: null, Icono: IconoTikTok },
  { nombre: "WhatsApp", url: null, Icono: IconoWhatsApp },
];

const ENLACES = [
  { href: "/acerca", texto: "Acerca de nosotros" },
  { href: `mailto:${CORREO_DE_CONTACTO}`, texto: "Contáctanos", externo: true },
  // Pasa por el aviso: a un cliente le explica que su negocio va en otra cuenta,
  // y a quien no ha entrado lo manda derecho al alta sin estorbarle.
  { href: "/soy-negocio", texto: "Agregar mi negocio" },
  { href: "/terminos", texto: "Términos de Uso" },
  { href: "/privacidad", texto: "Privacidad y Cookies" },
];

/**
 * El cierre del sitio público: la invitación a sumarse y, debajo, el banner con
 * lo que se busca al final de una página —quiénes somos, cómo escribirles, cómo
 * salir en la guía y lo legal.
 *
 * La invitación va arriba y en su propio color porque es lo único del pie que
 * pide algo. El resto es información, y compite si se pinta igual de fuerte.
 */
export async function PieDePagina() {
  const redes = REDES.filter((red) => red.url);
  const perfil = await perfilActual();

  /*
    La invitación es para quien todavía no está dentro. A quien ya tiene cuenta
    se le ofrecía "crear mi cuenta" teniéndola ya, que es ruido y hace dudar
    de si se registró bien.

    Al cliente sí se le sigue ofreciendo dar de alta un negocio —mucha gente
    entra primero como visitante y luego pone su chocolatería—, pero llevándolo
    antes por una advertencia: eso pide una cuenta aparte.
  */
  const invitacion = !perfil
    ? {
        titulo: "Únete a la Guía del Cacao",
        texto:
          "Si produces, transformas o cuentas el cacao de Tabasco, este es tu lugar. Y si solo vienes a visitar, tu cuenta junta mazorcas todo el año.",
        botones: [
          { href: "/registro/negocio", texto: "Agregar mi negocio", principal: true },
          { href: "/registro/cliente", texto: "Crear mi cuenta", principal: false },
        ],
      }
    : perfil.rol === "cliente"
      ? {
          titulo: "¿Tienes un negocio de cacao?",
          texto:
            "Publica tu micrositio y aparece donde la gente ya está buscando. Se da de alta aparte de tu cuenta de visitante.",
          botones: [
            { href: "/soy-negocio", texto: "Agregar mi negocio", principal: true },
          ],
        }
      : null;

  return (
    <footer className="relative z-10 mt-16">
      {invitacion && (
        <div className="mx-auto w-[92vw] max-w-[1180px]">
          <section className="rounded-[2rem] border-2 border-ink/10 bg-mango px-6 py-9 text-center shadow-dura sm:px-10 sm:py-11">
            <h2 className="font-display text-2xl text-ink sm:text-3xl">
              {invitacion.titulo}
            </h2>

            <p className="mx-auto mt-3 max-w-xl text-pretty text-cacao">
              {invitacion.texto}
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {invitacion.botones.map((boton) => (
                <Link
                  key={boton.href}
                  href={boton.href}
                  className={`inline-flex min-h-12 items-center rounded-full px-6 py-3 font-bold shadow-dura-sm transition-transform active:translate-y-0.5 ${
                    boton.principal
                      ? "bg-selva text-crema"
                      : "border-2 border-ink/15 bg-crema text-selva-2"
                  }`}
                >
                  {boton.texto}
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}

      {/*
        La franja de información es lo último de la página y por eso va a ancho
        completo y en verde: cierra el sitio con el color del encabezado, de modo
        que el contenido queda entre los dos.

        El respiro de abajo en celular esquiva la barra fija del pulgar, que si
        no tapa la última línea.
      */}
      <div className={`bg-selva-2 py-10 text-crema ${invitacion ? "mt-12" : ""}`}>
        <div className="mx-auto w-[92vw] max-w-[1180px] pb-24 sm:pb-0">
          <nav aria-label="Información del sitio">
            <ul className="flex flex-wrap justify-center gap-x-7 gap-y-3 text-center font-bold">
              {ENLACES.map((enlace) => (
                <li key={enlace.href}>
                  <Link
                    href={enlace.href}
                    className="underline-offset-4 hover:underline"
                  >
                    {enlace.texto}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {redes.length > 0 && (
            <ul className="mt-7 flex justify-center gap-3">
              {redes.map((red) => (
                <li key={red.nombre}>
                  <a
                    href={red.url ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="grid size-11 place-items-center rounded-full bg-crema/10 transition-colors hover:bg-crema/20"
                  >
                    <span className="sr-only">{red.nombre}</span>
                    <red.Icono className="size-5" />
                  </a>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-8 text-center text-sm text-crema/70">
            Guía del Cacao · El cacao de Tabasco, en un solo lugar
          </p>
        </div>
      </div>
    </footer>
  );
}
