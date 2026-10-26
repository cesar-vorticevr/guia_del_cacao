/**
 * Los sonidos de la ruleta, hechos con Web Audio en el momento: un «tic» por
 * gajo que pasa, una fanfarria al ganar y dos notas que bajan con la suerte.
 * Sin archivos de audio que descargar ni licencias que cuidar.
 *
 * El navegador no deja sonar nada hasta que la persona toca algo, así que el
 * contexto se crea en el primer giro, que ya es un toque. Si el navegador no
 * tiene Web Audio, todo esto calla sin romper nada.
 */

let contexto: AudioContext | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  try {
    contexto ??= new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (contexto.state === "suspended") void contexto.resume();
    return contexto;
  } catch {
    return null;
  }
}

/** Una nota corta: frecuencia, cuándo empieza, cuánto dura y qué tan fuerte. */
function nota(
  ctx: AudioContext,
  frecuencia: number,
  desde: number,
  dura: number,
  volumen: number,
  forma: OscillatorType = "triangle",
) {
  const osc = ctx.createOscillator();
  const gan = ctx.createGain();
  osc.type = forma;
  osc.frequency.setValueAtTime(frecuencia, desde);
  gan.gain.setValueAtTime(0.0001, desde);
  gan.gain.exponentialRampToValueAtTime(volumen, desde + 0.01);
  gan.gain.exponentialRampToValueAtTime(0.0001, desde + dura);
  osc.connect(gan).connect(ctx.destination);
  osc.start(desde);
  osc.stop(desde + dura + 0.02);
}

/** El «tic» de la flecha contra un clavo. Se va afinando un poco al frenar. */
export function tic(velocidad: number) {
  const ctx = audio();
  if (!ctx) return;
  nota(ctx, 900 + Math.min(velocidad, 1) * 500, ctx.currentTime, 0.045, 0.12, "square");
}

/** Fanfarria: un arpegio que sube y un brillo arriba. */
export function fanfarria() {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => nota(ctx, f, t + i * 0.11, 0.35, 0.22));
  [1567.98, 2093].forEach((f, i) => nota(ctx, f, t + 0.5 + i * 0.08, 0.5, 0.1, "sine"));
}

/** «Suerte para la próxima»: dos notas que bajan, sin drama. */
export function casi() {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime;
  nota(ctx, 392, t, 0.3, 0.18);
  nota(ctx, 293.66, t + 0.25, 0.5, 0.16);
}

/** Despertar el audio en el toque, antes de que llegue la respuesta. */
export function preparar() {
  audio();
}
