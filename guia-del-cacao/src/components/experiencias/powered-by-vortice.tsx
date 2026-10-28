/* eslint-disable @next/next/no-img-element */
import { VORTICE_VR } from "@/lib/experiencias";

/**
 * «Powered by Vórtice VR», en español y en inglés, con la invitación a la
 * plataforma: va en todo lo que se edita de lo interactivo (la realidad
 * aumentada y la ruleta). La tecnología es de Vórtice VR y allá hay muchas más
 * experiencias (filtros, trivias, juegos, galerías en 3D) que la Guía no trae.
 */
export function PoweredByVortice({ compacto = false }: { compacto?: boolean }) {
  if (compacto) {
    return (
      <a
        href={VORTICE_VR.url}
        target="_blank"
        rel="noopener"
        className="inline-flex items-center gap-2 rounded-full bg-[#1c1236] px-4 py-2 text-xs font-bold text-crema/80 shadow-[0_0_18px_rgb(255_183_3/0.25)] ring-1 ring-mango/40 hover:text-crema"
      >
        <span>Powered by</span>
        <img src="/marca/vortice-vr-blanco.png" alt="Vórtice VR" className="h-4 w-auto" />
      </a>
    );
  }

  return (
    <aside
      aria-label="Powered by Vórtice VR"
      className="relative overflow-hidden rounded-3xl border-2 border-mango/40 p-6 text-crema shadow-[0_0_40px_rgb(255_183_3/0.18)]"
      style={{
        background:
          "radial-gradient(ellipse 80% 120% at 0% 0%, rgb(120 70 170 / 0.55), transparent 70%), linear-gradient(135deg, #1c1236 0%, #0f2a22 70%, #08150f 100%)",
      }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs font-bold uppercase tracking-[0.28em] text-mango">Powered by</span>
        <img src="/marca/vortice-vr-blanco.png" alt="Vórtice VR" className="h-7 w-auto drop-shadow-[0_0_10px_rgb(255_255_255/0.35)]" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <p className="text-sm leading-relaxed text-crema/90">
          La realidad aumentada y la ruleta de la Guía funcionan con la tecnología de{" "}
          <strong className="text-crema">Vórtice VR</strong>. En su plataforma hay muchas más
          experiencias para tu negocio: filtros para la cara, trivias, juegos, menús interactivos y
          galerías en 3D.
        </p>
        <p lang="en" className="text-sm leading-relaxed text-crema/70">
          The Guide&apos;s augmented reality and prize wheel run on <strong className="text-crema/90">Vórtice VR</strong>{" "}
          technology. Visit their platform for many more experiences: face filters, trivia, games,
          interactive menus and 3D galleries.
        </p>
      </div>

      <a
        href={VORTICE_VR.url}
        target="_blank"
        rel="noopener"
        className="boton-oro brillo mt-5 inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-bold text-ink"
      >
        Conoce más experiencias en vorticevr.mx
        <span aria-hidden="true">→</span>
      </a>
      <p lang="en" className="mt-2 text-xs text-crema/60">
        Discover more experiences at vorticevr.mx
      </p>
    </aside>
  );
}
