/**
 * El QR de una experiencia, como el de Vórtice VR (`assets/plataforma.js`,
 * `drawQR`) pero con la marca de la Guía: módulos de noche, la mazorca al
 * centro en su cuadro blanco, la indicación abajo y el logotipo.
 *
 * Corrección «H»: aguanta que el centro lo tape la mazorca. Solo navegador.
 */
export async function dibujarQr(canvas: HTMLCanvasElement, url: string, leyenda = "Escanea y apunta tu cámara a la imagen") {
  const [{ default: QRCode }, mazorca, logo] = await Promise.all([
    import("qrcode"),
    cargar("/marca/mazorca.png"),
    cargar("/marca/logotipo.png"),
  ]);

  const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const W = 1024;
  const M = 80;
  const celda = Math.floor((W - 2 * M) / n);
  const margen = Math.floor((W - celda * n) / 2);

  canvas.width = W;
  canvas.height = 1240;
  const x = canvas.getContext("2d")!;
  x.fillStyle = "#fff";
  x.fillRect(0, 0, canvas.width, canvas.height);

  x.fillStyle = "#1c1236";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) x.fillRect(margen + c * celda, margen + r * celda, celda, celda);
    }
  }

  if (mazorca) {
    const s = celda * n * 0.2;
    const p = (W - s) / 2;
    x.fillStyle = "#fff";
    x.beginPath();
    x.roundRect(p - 14, p - 14, s + 28, s + 28, 24);
    x.fill();
    const h = s;
    const w = (h * mazorca.naturalWidth) / mazorca.naturalHeight;
    x.drawImage(mazorca, (W - w) / 2, p, w, h);
  }

  x.fillStyle = "#4a2c1d";
  x.font = "600 34px 'Plus Jakarta Sans', system-ui, sans-serif";
  x.textAlign = "center";
  x.fillText(leyenda, W / 2, W + 10);

  if (logo) {
    const h = 170;
    const w = (h * logo.naturalWidth) / logo.naturalHeight;
    x.drawImage(logo, (W - w) / 2, W + 40, w, h);
  }
}

function cargar(src: string) {
  return new Promise<HTMLImageElement | null>((listo) => {
    const img = new Image();
    img.onload = () => listo(img);
    img.onerror = () => listo(null);
    img.src = src;
  });
}

/** Baja lo que tenga el lienzo como PNG. */
export function bajarLienzo(canvas: HTMLCanvasElement, nombre: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, "image/png");
}
