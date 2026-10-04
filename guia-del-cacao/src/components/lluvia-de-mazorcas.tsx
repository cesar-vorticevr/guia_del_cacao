/*
  Catorce mazorcas cayendo, colocadas a mano y no al azar: `Math.random()`
  durante el render daría una pintada distinta en el servidor y en el navegador.
  Cada una lleva su carril, su retraso y su tamaño para que la lluvia no se vea
  en fila.
*/
const LLUVIA = [
  { x: 6, tarda: 0.0, tam: 34 },
  { x: 14, tarda: 0.45, tam: 26 },
  { x: 22, tarda: 0.15, tam: 42 },
  { x: 30, tarda: 0.7, tam: 30 },
  { x: 38, tarda: 0.3, tam: 38 },
  { x: 46, tarda: 0.9, tam: 24 },
  { x: 54, tarda: 0.05, tam: 36 },
  { x: 62, tarda: 0.6, tam: 28 },
  { x: 70, tarda: 0.25, tam: 44 },
  { x: 78, tarda: 0.8, tam: 32 },
  { x: 86, tarda: 0.4, tam: 26 },
  { x: 94, tarda: 1.0, tam: 38 },
  { x: 18, tarda: 1.2, tam: 30 },
  { x: 74, tarda: 1.35, tam: 34 },
];

/**
 * La lluvia del festejo, para lo que se celebre.
 *
 * Vivía dentro del aviso de las mazorcas, que es donde nació. Salió de ahí en
 * cuanto hubo una segunda cosa que celebrar —haber publicado— porque las
 * catorce posiciones a mano no son algo que valga la pena escribir dos veces,
 * y porque las animaciones de marca ya viven juntas en `globals.css` con esa
 * misma intención escrita al lado: «si algún día se celebra otra cosa, se
 * celebra igual».
 *
 * `motion-reduce:hidden` no es un detalle: a quien pidió menos movimiento en su
 * sistema, catorce cosas girando en la pantalla le puede provocar mareo. El
 * festejo se entiende igual por lo que dice la tarjeta.
 */
export function LluviaDeMazorcas() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 motion-reduce:hidden"
    >
      {LLUVIA.map((mazorca, i) => (
        <span
          key={i}
          className="absolute top-0 animate-cae"
          style={{
            left: `${mazorca.x}%`,
            animationDelay: `${mazorca.tarda}s`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/marca/mazorca.png"
            alt=""
            style={{ width: `${mazorca.tam}px` }}
          />
        </span>
      ))}
    </div>
  );
}
