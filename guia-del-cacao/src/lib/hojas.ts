/**
 * Una hoja (o un pétalo) dibujada en un canvas.
 *
 * La usan dos lienzos: la selva del escenario de la portada y el polvo de hada
 * que sale al hacer clic. Viven aquí para que las hojas sean las mismas en los
 * dos sitios.
 *
 * La hoja es dos curvas que se juntan en punta con su nervio al centro; el
 * pétalo, una gota redonda sin nervio. `tam` es la mitad del largo.
 */
export function pintarHoja(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tam: number,
  giro: number,
  color: string,
  petalo = false,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(giro);
  ctx.fillStyle = color;
  ctx.beginPath();
  if (petalo) {
    ctx.moveTo(0, -tam);
    ctx.bezierCurveTo(tam * 0.9, -tam * 0.4, tam * 0.7, tam, 0, tam);
    ctx.bezierCurveTo(-tam * 0.7, tam, -tam * 0.9, -tam * 0.4, 0, -tam);
    ctx.fill();
  } else {
    ctx.moveTo(0, -tam);
    ctx.quadraticCurveTo(tam * 0.75, 0, 0, tam);
    ctx.quadraticCurveTo(-tam * 0.75, 0, 0, -tam);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = Math.max(0.6, tam * 0.06);
    ctx.beginPath();
    ctx.moveTo(0, -tam * 0.85);
    ctx.lineTo(0, tam * 0.95);
    ctx.stroke();
  }
  ctx.restore();
}
