import Link from "next/link";
import { Logotipo } from "@/components/marca";
import { BarraInferior } from "@/components/publico/barra-inferior";
import { EncabezadoQueVuelve } from "@/components/publico/encabezado-que-vuelve";
import { NavegacionLateral } from "@/components/publico/navegacion-lateral";
import { PastillaPasaporte } from "@/components/publico/pastilla-pasaporte";
import { PieDePagina } from "@/components/publico/pie-de-pagina";
import { destinoSegunRol, perfilActual } from "@/lib/auth/sesion";
import { pestanaDePerfil } from "@/lib/auth/navegacion";
import { pasaporteDe } from "@/lib/datos/puntos";

const SECCIONES = [
  { href: "/directorio", texto: "Explorar" },
  { href: "/eventos", texto: "Eventos" },
  { href: "/comunidad", texto: "Comunidad" },
];

/**
 * Armazón del sitio público, en dos columnas.
 *
 * En escritorio la navegación es una columna a la izquierda que se queda quieta
 * mientras el contenido pasa, y el contenido va al centro. Antes vivía solo en
 * el encabezado: en una lista de varias pantallas —el directorio lo es— cambiar
 * de sección obligaba a subir hasta arriba.
 *
 * **En celular no cambia nada**: la navegación sigue siendo la barra de abajo,
 * al alcance del pulgar, y el contenido ocupa todo el ancho. Una columna lateral
 * ahí solo quitaría sitio a lo que se vino a leer.
 *
 * El pasaporte se ve en las dos: pastilla en el encabezado y contador en la
 * barra de abajo. Es a propósito — ver el número subir es lo que hace que la
 * persona quiera seguir explorando.
 */
export default async function LayoutPublico({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await perfilActual();

  // Solo los clientes juntan monedas; un negocio o un administrador no tienen
  // pasaporte que enseñar.
  const esCliente = perfil?.rol === "cliente" && perfil.rol_confirmado;
  const pasaporte = esCliente ? await pasaporteDe(perfil.id) : null;

  const pestana = pestanaDePerfil(perfil);

  return (
    <>
      <EncabezadoQueVuelve>
      <header className="bg-selva py-3.5 text-crema">
        <div className="mx-auto flex w-[94vw] max-w-[1400px] items-center justify-between gap-4">
          <Logotipo />

          {/*
            Las secciones ya no van aquí en escritorio: viven en la columna de la
            izquierda. Se quedan en el encabezado solo en el tramo intermedio
            —tabletas—, donde la columna todavía no cabe pero la barra de abajo
            ya no se muestra.
          */}
          <nav className="hidden gap-1 sm:flex lg:hidden" aria-label="Secciones">
            {SECCIONES.map((seccion) => (
              <Link
                key={seccion.href}
                href={seccion.href}
                className="rounded-full px-3 py-2 font-bold transition-colors hover:bg-selva-2"
              >
                {seccion.texto}
              </Link>
            ))}
          </nav>

          {pasaporte ? (
            <PastillaPasaporte puntos={pasaporte.puntos} nivel={pasaporte.nivel} />
          ) : perfil ? (
            <Link
              href={destinoSegunRol(perfil)}
              className="min-h-10 rounded-full bg-mango px-4 py-2 text-sm font-bold text-ink"
            >
              Mi cuenta
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="px-2 py-2 text-sm font-bold">
                Entrar
              </Link>
              <Link
                href="/registro"
                className="min-h-10 rounded-full bg-mango px-4 py-2 text-sm font-bold text-ink"
              >
                Crear cuenta
              </Link>
            </div>
          )}
        </div>
      </header>
      </EncabezadoQueVuelve>

      <div className="mx-auto flex w-[94vw] max-w-[1400px] gap-8">
        {/*
          La columna de navegación aparece a partir de `lg`. Por debajo no hay
          ancho que darle sin comerse el contenido, y ahí ya está la barra de
          abajo (o las secciones del encabezado, en tabletas).
        */}
        <aside className="hidden w-56 shrink-0 py-8 lg:block">
          <NavegacionLateral />
        </aside>

        {/*
          `relative z-10` se queda aunque el fondo de cacao ya no cuelgue de aquí:
          sigue habiendo capas decorativas en z-0 dentro de las páginas, y sin un
          contexto de apilamiento propio el contenido se pintaría por debajo.

          `min-w-0` no es decorativo: sin él, una tabla o un texto largo estira
          la columna y empuja la navegación fuera de la pantalla.

          El respiro de abajo lo pone el pie, que es quien toca la barra fija del
          pulgar.
        */}
        <main className="relative z-10 min-w-0 flex-1 pb-10">{children}</main>
      </div>

      <PieDePagina />

      <BarraInferior
        monedas={pasaporte?.puntos ?? null}
        destinoPerfil={pestana.destino}
        etiquetaPerfil={pestana.etiqueta}
        iconoPerfil={pestana.icono}
      />
    </>
  );
}
