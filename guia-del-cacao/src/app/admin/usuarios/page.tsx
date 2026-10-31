import Link from "next/link";
import type { Metadata } from "next";
import { BotonEmbajador, BotonesRol } from "@/components/admin/formularios";
import { Buscador, enlaceDeLista, numeroDePagina, Paginacion } from "@/components/admin/listas";
import { perfilesPagina } from "@/lib/datos/admin";
import { abrirConversacion } from "@/lib/buzon/acciones";

export const metadata: Metadata = { title: "Personas · Guía del Cacao" };

const CUANDO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const ROLES = [
  { valor: undefined, texto: "Todas" },
  { valor: "cliente", texto: "Clientes" },
  { valor: "negocio", texto: "Negocios" },
  { valor: "admin", texto: "Administradores" },
  { valor: "embajador", texto: "Embajadores" },
];

export default async function Usuarios({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; rol?: string; pagina?: string }>;
}) {
  const { q = "", rol, pagina } = await searchParams;
  const resultado = await perfilesPagina(numeroDePagina(pagina), q, rol);

  return (
    <>
      <h1 className="font-display text-3xl">Personas</h1>
      <p className="mt-2 text-cacao">
        Esta es la única vía para nombrar a un administrador: el registro público
        nunca acepta ese rol, venga de donde venga.
      </p>

      <div className="mt-6 grid gap-3">
        <Buscador
          base="/admin/usuarios"
          busqueda={q}
          ayuda="Nombre o correo"
          ocultos={{ rol }}
        />

        <ul className="flex flex-wrap gap-2" aria-label="Filtrar por tipo de cuenta">
          {ROLES.map((opcion) => {
            const activo = (rol ?? undefined) === opcion.valor;
            return (
              <li key={opcion.texto}>
                <Link
                  href={enlaceDeLista("/admin/usuarios", { q, rol: opcion.valor })}
                  aria-current={activo ? "page" : undefined}
                  className={`flex min-h-10 items-center rounded-full border-2 px-4 text-sm font-bold ${
                    activo
                      ? "border-selva bg-selva text-crema"
                      : "border-selva/20 bg-white text-selva-2"
                  }`}
                >
                  {opcion.texto}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {resultado.filas.length === 0 ? (
        <p className="mt-6 rounded-3xl bg-crema-2 p-6 text-cacao">
          {q ? `Nadie coincide con «${q}».` : "No hay nadie con ese tipo de cuenta."}
        </p>
      ) : (
        <ul className="mt-6 grid gap-4">
          {resultado.filas.map((perfil) => (
            <li key={perfil.id} className="grid gap-3 rounded-3xl bg-crema-2 p-6">
              <div>
                <p className="font-display text-xl font-semibold text-selva-2">
                  {perfil.nombre}
                </p>
                <p className="font-mono text-xs text-cacao/70">{perfil.correo}</p>
                <p className="mt-1 text-sm text-cacao/70">
                  Desde {CUANDO.format(new Date(perfil.fecha_registro))}
                </p>
              </div>

              <BotonesRol perfilId={perfil.id} rolActual={perfil.rol} />
              {perfil.rol !== "admin" && (
                <BotonEmbajador perfilId={perfil.id} embajador={perfil.embajador} />
              )}

              {/* El administrador le escribe a cualquiera por el buzón (000069). */}
              <form action={abrirConversacion}>
                <input type="hidden" name="destino" value={perfil.id} />
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-mango/40 bg-white px-5 font-bold text-selva-2 hover:border-mango"
                >
                  ✉ Escribirle
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <Paginacion
        base="/admin/usuarios"
        pagina={resultado.pagina}
        paginas={resultado.paginas}
        total={resultado.total}
        parametros={{ q, rol }}
        nombre={resultado.total === 1 ? "persona" : "personas"}
      />
    </>
  );
}
