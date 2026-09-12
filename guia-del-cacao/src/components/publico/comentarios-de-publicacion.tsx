import Link from "next/link";
import { Comentarios } from "@/components/publico/comentarios";
import { perfilActual } from "@/lib/auth/sesion";
import {
  comentariosDe,
  conElPropioArriba,
  cuantosSon,
  moderaLaPublicacion,
  participantesDe,
  TOPE_COMENTARIOS,
  type Contexto,
} from "@/lib/datos/comentarios";
import { haceCuanto } from "@/lib/tiempo";

const CUANDO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Los comentarios de un evento o una noticia, ya resueltos.
 *
 * Vive aparte de la página porque las dos —evento y noticia— necesitan
 * exactamente lo mismo: quién mira, qué le toca ver, si le queda cupo y si
 * modera. Repetirlo en las dos era la forma segura de que se despegaran.
 */
export async function ComentariosDePublicacion({
  contexto,
  referenciaId,
}: {
  contexto: Exclude<Contexto, "publicacion">;
  referenciaId: string;
}) {
  const perfil = await perfilActual();

  const [comentarios, modera] = await Promise.all([
    comentariosDe(contexto, referenciaId),
    moderaLaPublicacion(perfil, contexto, referenciaId),
  ]);

  const mios = cuantosSon(comentarios, perfil?.id);
  const esCliente = perfil?.rol === "cliente" && perfil.rol_confirmado;
  const leQueda = mios < TOPE_COMENTARIOS[contexto];

  const motivo = !perfil ? (
    <>
      <Link href="/login" className="font-bold text-selva underline">
        Inicia sesión
      </Link>{" "}
      para dejar tu comentario.
    </>
  ) : !esCliente ? (
    "Los comentarios son de las cuentas de cliente."
  ) : !leQueda ? (
    "Ya comentaste esto. Puedes editar lo que escribiste arriba."
  ) : null;

  return (
    <Comentarios
      contexto={contexto}
      referenciaId={referenciaId}
      comentarios={conElPropioArriba(comentarios, perfil?.id).map((comentario) => ({
        id: comentario.id,
        autor: comentario.perfiles_publicos?.nombre ?? "Visitante",
        texto: comentario.texto,
        hace: haceCuanto(comentario.fecha),
        fechaExacta: CUANDO.format(new Date(comentario.fecha)),
        editado: comentario.fecha_edicion !== null,
        oculto: comentario.oculto,
        esMio: comentario.usuario_id === perfil?.id,
        /*
          Sin corazon y sin hilo: aqui se comenta una vez, asi que no hay a
          que asentir ni a quien contestarle. La tabla de este lado
          -comentarios_publicacion- no tiene ni responde_a.
        */
        apoyos: 0,
        miApoyo: false,
      }))}
      puedeComentar={Boolean(esCliente && leQueda)}
      motivo={motivo}
      puedeOcultar={modera}
      /*
        Etiquetar si, porque el negocio y quien pregunta se hablan: quien
        participo aqui es quien comento. El autor no se pasa: la publicacion
        es de una sucursal, no de una persona con nombre que etiquetar.
      */
      participantes={participantesDe(comentarios)}
    />
  );
}
