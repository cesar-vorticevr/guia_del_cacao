"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { guardarExperiencia, type EstadoExperiencia } from "@/lib/negocio/experiencias";
import {
  BUCKET_EXPERIENCIAS,
  LIMITES,
  urlDeArchivo,
  type Botones,
  type Elemento,
  type Experiencia,
  type TipoDeElemento,
} from "@/lib/experiencias";
import { ENTRADAS, FONTS, FONT_CSS } from "@/lib/ra/escena.js";
import { bajarLienzo, dibujarQr } from "@/lib/ra/qr";
import { PoweredByVortice } from "@/components/experiencias/powered-by-vortice";

/**
 * El editor de una experiencia de realidad aumentada: el de vorticevr.mx/crear
 * con el diseño de la Guía.
 *
 * El lienzo 3D es el mismo motor de Vórtice VR (`lib/ra/editor-ra.js`, que
 * pinta con `lib/ra/escena.js`, gemelo del que usa el visor): lo que se acomoda
 * aquí es lo que se ve en el celular. Ese motor mueve los elementos
 * escribiendo directo en sus objetos, así que la lista vive en un `ref` y la
 * pantalla se vuelve a pintar con un contador.
 *
 * Los archivos se suben directo al bucket con la sesión del negocio (Vercel
 * corta los cuerpos en 4.5 MB) y a la acción solo viaja la lista.
 */

type EnEdicion = Elemento & { _file?: Blob; _url?: string; _fname?: string };

type MotorRA = {
  add: (it: EnEdicion) => Promise<unknown>;
  remove: (id: string) => void;
  update: (it: EnEdicion) => void;
  updateAll: () => void;
  stand: (id: string) => void;
  setImage: (url: string, w: number, h: number) => void;
  view: (v: "inicio" | "arriba") => void;
  play: () => void;
  select: (id: string | null) => void;
  setMode: (m: "mover" | "girar" | "escalar") => void;
};

type Compilador = {
  Compiler: new () => {
    compileImageTargets: (imgs: HTMLImageElement[], progreso: (p: number) => void) => Promise<unknown>;
    exportData: () => Promise<ArrayBuffer>;
    data?: CalidadDeDatos[];
  };
};

type CalidadDeDatos = {
  trackingData?: { points?: unknown[] }[];
  matchingData?: { width: number; height: number; maximaPoints?: unknown[]; minimaPoints?: unknown[] }[];
};

const MINDAR = "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js";

/** Un import que el empaquetador no toca: MindAR se baja del CDN, como en Vórtice. */
const importarDeFuera = new Function("u", "return import(u)") as (u: string) => Promise<Compilador>;

const uid = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

/*
  La calidad para reconocerse, de 1 a 5, como en Vórtice VR: puntos de
  seguimiento y densidad de rasgos cerca de 256 px. Calibrada allá con una
  tarjeta que se sigue muy bien y un cartel con detalle (5) y una imagen oscura
  sin detalles (1).
*/
function calidad(d?: CalidadDeDatos) {
  if (!d?.trackingData || !d.matchingData?.length) return 0;
  const T = d.trackingData.reduce((n, t) => n + (t.points?.length ?? 0), 0);
  const k = d.matchingData.reduce((b, x) =>
    Math.abs(Math.min(x.width, x.height) - 256) < Math.abs(Math.min(b.width, b.height) - 256) ? x : b,
  );
  const dens = (((k.maximaPoints?.length ?? 0) + (k.minimaPoints?.length ?? 0)) / (k.width * k.height)) * 65536;
  return Math.max(1, Math.min(5, Math.round((0.5 * Math.min(1, T / 80) + 0.5 * Math.min(1, dens / 180)) * 5)));
}

const TEXTO_CALIDAD = [
  "",
  "Muy baja: lo más probable es que tiemble o no se reconozca. Usa una imagen con más detalles, texto o textura, y sin fondos lisos.",
  "Baja: puede costar trabajo reconocerla y temblar. Una imagen con más detalles y contraste funcionará mejor.",
  "Aceptable: funciona, pero con más detalles y contraste se verá más firme.",
  "Muy buena: se va a reconocer bien.",
  "Excelente: se va a reconocer muy bien y el video se verá firme.",
];

const NOMBRE: Record<TipoDeElemento, string> = { video: "Video", image: "Imagen", text: "Texto" };
const ICONO: Record<TipoDeElemento, string> = { video: "▶", image: "▣", text: "T" };

export function EditorDeExperiencia({
  experiencia,
  link,
  puedePublicar,
  hayLugar,
}: {
  experiencia: Experiencia;
  link: string;
  /** La marca tiene Pro: si no, se edita todo pero no se publica. */
  puedePublicar: boolean;
  /** Le queda cupo para publicar esta (o ya está publicada). */
  hayLugar: boolean;
}) {
  const carpeta = `${experiencia.marcaId}/${experiencia.id}`;
  const base = `${urlDeArchivo(carpeta)}/`;

  const [titulo, setTitulo] = useState(experiencia.titulo);
  const [botones, setBotones] = useState<Botones>(() => ({
    ...experiencia.botones,
    whatsapp: experiencia.botones.whatsapp?.replace(/^52/, ""),
  }));
  const [imagen, setImagen] = useState({
    ruta: experiencia.imagen,
    objetivo: experiencia.objetivo,
    ancho: experiencia.imagenAncho,
    alto: experiencia.imagenAlto,
    url: urlDeArchivo(experiencia.imagen),
  });
  const [preparando, setPreparando] = useState<number | null>(null);
  const [estrellas, setEstrellas] = useState(0);
  const [avisoImagen, setAvisoImagen] = useState<{ tono: "bien" | "mal" | ""; texto: string }>({ tono: "", texto: "" });
  const [avisoElementos, setAvisoElementos] = useState("");
  const [estado, setEstado] = useState(experiencia.estado);
  const [resultado, setResultado] = useState<EstadoExperiencia>({});
  const [guardando, setGuardando] = useState(false);
  const [sinGuardar, setSinGuardar] = useState(false);
  const [modo, setModo] = useState<"mover" | "girar" | "escalar">("mover");
  const [sel, setSel] = useState<string | null>(null);
  // `lista` es lo que se pinta; `elementos` es la misma lista para el motor,
  // que la lee y la mueve fuera de React. Cada cambio copia una a la otra.
  const [lista, setLista] = useState<EnEdicion[]>(() => experiencia.elementos.map((e) => ({ ...e })));
  const elementos = useRef<EnEdicion[]>(lista);
  const motor = useRef<MotorRA | null>(null);
  const escenario = useRef<HTMLDivElement>(null);
  const entradaArchivo = useRef<HTMLInputElement>(null);
  const qr = useRef<HTMLCanvasElement>(null);

  const repintar = useCallback(() => setLista([...elementos.current]), []);
  const cambio = useCallback(() => {
    setSinGuardar(true);
    repintar();
  }, [repintar]);

  // Las letras del texto se bajan una vez: el lienzo las necesita cargadas.
  useEffect(() => {
    if (document.getElementById("fuentes-ra")) return;
    document.head.appendChild(Object.assign(document.createElement("link"), { id: "fuentes-ra", rel: "stylesheet", href: FONT_CSS }));
  }, []);

  // Avisar antes de salir con cambios sin guardar.
  useEffect(() => {
    const alSalir = (e: BeforeUnloadEvent) => {
      if (sinGuardar) e.preventDefault();
    };
    addEventListener("beforeunload", alSalir);
    return () => removeEventListener("beforeunload", alSalir);
  }, [sinGuardar]);

  // El QR de prueba.
  useEffect(() => {
    if (qr.current) dibujarQr(qr.current, link, "Escanéalo para probarla en tu celular");
  }, [link]);

  // El motor 3D se arranca cuando ya hay imagen.
  const arrancado = useRef<Promise<MotorRA> | null>(null);
  const asegurarMotor = useCallback(() => {
    arrancado.current ??= (async () => {
      const { createEditor } = (await import("@/lib/ra/editor-ra.js")) as unknown as {
        createEditor: (box: HTMLElement, cb: object) => Promise<MotorRA>;
      };
      const ed = await createEditor(escenario.current!, {
        items: () => elementos.current,
        src: (it: EnEdicion) => ({ url: it._url ?? (it.file ? base + it.file : null) }),
        change: () => cambio(),
        select: (id: string | null) => setSel(id),
        loaded: () => repintar(),
      });
      motor.current = ed;
      return ed;
    })();
    return arrancado.current;
  }, [base, cambio, repintar]);

  useEffect(() => {
    if (!imagen.url || !imagen.ancho || !imagen.alto) return;
    let vivo = true;
    asegurarMotor().then(async (ed) => {
      if (!vivo) return;
      ed.setImage(imagen.url!, imagen.ancho!, imagen.alto!);
      for (const it of elementos.current) await ed.add(it).catch(() => null);
    });
    return () => {
      vivo = false;
    };
    // Solo al montar: después la imagen nueva se pone en `alElegirImagen`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const elegido = lista.find((e) => e.id === sel) ?? null;

  // ---------------------------------------------------------------- la imagen
  async function subir(nombre: string, blob: Blob, tipo: string) {
    const ruta = `${carpeta}/${nombre}`;
    const { error } = await crearClienteNavegador()
      .storage.from(BUCKET_EXPERIENCIAS)
      .upload(ruta, blob, { contentType: tipo, upsert: true });
    if (error) throw error;
    return ruta;
  }

  async function alElegirImagen(archivo: File | undefined) {
    if (!archivo) return;
    setEstrellas(0);
    if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) {
      setAvisoImagen({ tono: "mal", texto: "Usa una imagen JPG, PNG o WebP." });
      return;
    }
    const bmp = await createImageBitmap(archivo).catch(() => null);
    if (!bmp) return setAvisoImagen({ tono: "mal", texto: "No pude abrir esa imagen." });
    if (Math.min(bmp.width, bmp.height) < 300) {
      return setAvisoImagen({ tono: "mal", texto: "La imagen es muy pequeña. Usa una de al menos 600 px." });
    }

    const k = Math.min(1, LIMITES.imagenLado / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k);
    const h = Math.round(bmp.height * k);
    const lienzo = document.createElement("canvas");
    lienzo.width = w;
    lienzo.height = h;
    lienzo.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, "image/jpeg", 0.88));
    if (!blob) return setAvisoImagen({ tono: "mal", texto: "No pude preparar esa imagen." });

    const url = URL.createObjectURL(blob);
    (await asegurarMotor()).setImage(url, w, h);

    // Compilar: la huella que el celular busca con la cámara.
    setPreparando(2);
    setAvisoImagen({ tono: "", texto: "Preparando la imagen para la realidad aumentada…" });
    try {
      const { Compiler } = await importarDeFuera(MINDAR);
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = new Compiler();
      await c.compileImageTargets([img], (p) => setPreparando(Math.max(2, Math.round(p))));
      const objetivo = new Blob([await c.exportData()], { type: "application/octet-stream" });
      setEstrellas(calidad(c.data?.[0]));

      const marca = uid().slice(0, 6);
      const [ruta, rutaObjetivo] = await Promise.all([
        subir(`imagen-${marca}.jpg`, blob, "image/jpeg"),
        subir(`objetivo-${marca}.mind`, objetivo, "application/octet-stream"),
      ]);
      setImagen({ ruta, objetivo: rutaObjetivo, ancho: w, alto: h, url });
      setSinGuardar(true);
      setAvisoImagen({ tono: "bien", texto: "Imagen lista. Ahora agrega lo que va encima." });
    } catch (error) {
      console.error(error);
      setAvisoImagen({ tono: "mal", texto: "No pude preparar esta imagen. Prueba con otra con más detalles." });
    }
    setPreparando(null);
  }

  // ---------------------------------------------------------------- elementos
  function puedeAgregar(tipo: TipoDeElemento) {
    if (!imagen.ancho) return setAvisoElementos("Primero sube tu imagen (paso 1)."), false;
    if (elementos.current.length >= LIMITES.elementos) {
      return setAvisoElementos(`Puedes poner hasta ${LIMITES.elementos} elementos por experiencia.`), false;
    }
    if (tipo === "video" && elementos.current.filter((i) => i.type === "video").length >= LIMITES.videos) {
      return setAvisoElementos(`Puedes poner hasta ${LIMITES.videos} videos por experiencia.`), false;
    }
    setAvisoElementos("");
    return true;
  }

  async function agregar(p: Partial<EnEdicion> & { type: TipoDeElemento }) {
    const it: EnEdicion = { id: uid(), x: 0, y: 0, z: 0, s: 0.6, rx: 0, ry: 0, rz: 0, in: "aparecer", scene: 0, ...p };
    elementos.current.push(it);
    setSel(it.id);
    cambio();
    try {
      const ed = await asegurarMotor();
      await ed.add(it);
      ed.select(it.id);
    } catch (error) {
      console.error(error);
      quitar(it.id);
      setAvisoElementos("No pude abrir ese archivo.");
    }
  }

  function alPulsarAgregar(tipo: TipoDeElemento) {
    if (!puedeAgregar(tipo)) return;
    if (tipo === "text") {
      const alto = imagen.alto && imagen.ancho ? imagen.alto / imagen.ancho : 2 / 3;
      agregar({ type: "text", text: "Tu texto", font: "Bebas Neue", color: "#ffd166", stroke: "#4a2c1d", s: 0.6, y: Math.round((alto / 2 - 0.12) * 1000) / 1000 });
      return;
    }
    const entrada = entradaArchivo.current!;
    entrada.value = "";
    entrada.accept = tipo === "video" ? "video/mp4,video/webm,video/quicktime" : "image/png,image/jpeg,image/webp";
    entrada.onchange = () => desdeArchivo(tipo, entrada.files?.[0]);
    entrada.click();
  }

  async function desdeArchivo(tipo: TipoDeElemento, archivo: File | undefined) {
    if (!archivo) return;
    setAvisoElementos(`Abriendo ${archivo.name}…`);
    if (tipo === "video") {
      if (archivo.size > LIMITES.videoMB * 1048576) {
        return setAvisoElementos(`El video pesa ${(archivo.size / 1048576).toFixed(1)} MB. El máximo es ${LIMITES.videoMB} MB.`);
      }
      const url = URL.createObjectURL(archivo);
      const v = document.createElement("video");
      v.muted = true;
      v.preload = "metadata";
      v.src = url;
      const ok = await new Promise<boolean>((r) => {
        v.onloadedmetadata = () => r(Boolean(v.videoWidth));
        v.onerror = () => r(false);
      });
      if (!ok) return setAvisoElementos("No pude abrir ese video. Expórtalo como MP4 (H.264).");
      const ext = /quicktime/.test(archivo.type) ? "mov" : /webm/.test(archivo.type) ? "webm" : "mp4";
      setAvisoElementos("");
      // El video entra a lo ancho de la imagen; luego se acomoda.
      agregar({
        type: "video",
        name: archivo.name,
        w: v.videoWidth,
        h: v.videoHeight,
        s: 1,
        sound: !elementos.current.some((i) => i.type === "video" && i.sound),
        chroma: null,
        _file: archivo,
        _url: url,
        _fname: `video.${ext}`,
      });
    } else {
      if (!/^image\/(png|jpeg|webp)$/.test(archivo.type)) return setAvisoElementos("Usa una imagen PNG, JPG o WebP.");
      const bmp = await createImageBitmap(archivo).catch(() => null);
      if (!bmp) return setAvisoElementos("No pude abrir esa imagen.");
      const k = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
      const w = Math.round(bmp.width * k);
      const h = Math.round(bmp.height * k);
      const lienzo = document.createElement("canvas");
      lienzo.width = w;
      lienzo.height = h;
      lienzo.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
      let blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, "image/webp", 0.9));
      if (!blob || blob.type !== "image/webp") blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, "image/png"));
      if (!blob || blob.size > LIMITES.imagenMB * 1048576) return setAvisoElementos("La imagen es demasiado pesada.");
      setAvisoElementos("");
      agregar({
        type: "image",
        name: archivo.name,
        w,
        h,
        s: 0.4,
        _file: blob,
        _url: URL.createObjectURL(blob),
        _fname: `imagen.${blob.type === "image/webp" ? "webp" : "png"}`,
      });
    }
  }

  function quitar(id: string) {
    elementos.current = elementos.current.filter((i) => i.id !== id);
    motor.current?.remove(id);
    if (sel === id) setSel(null);
    // El primer video se queda con el sonido.
    if (!elementos.current.some((i) => i.type === "video" && i.sound)) {
      const v = elementos.current.find((i) => i.type === "video");
      if (v) v.sound = true;
    }
    cambio();
  }

  function mover(it: EnEdicion, d: number) {
    const nueva = [...elementos.current];
    const i = nueva.indexOf(it);
    const j = i + d;
    if (j < 0 || j >= nueva.length) return;
    [nueva[i], nueva[j]] = [nueva[j], nueva[i]];
    elementos.current = nueva;
    motor.current?.updateAll();
    cambio();
  }

  /** Solo un video suena: prender uno apaga los demás. */
  function ponerSonido(it: EnEdicion, con: boolean) {
    for (const o of elementos.current) if (o.type === "video") Object.assign(o, { sound: false });
    editar(it, { sound: con });
  }

  const reconstruir = useRef<number | undefined>(undefined);
  function editar(it: EnEdicion, cambios: Partial<EnEdicion>, rehacer = false) {
    Object.assign(it, cambios);
    if (rehacer) {
      clearTimeout(reconstruir.current);
      reconstruir.current = window.setTimeout(() => motor.current?.add(it), 250);
    } else {
      motor.current?.update(it);
    }
    cambio();
  }

  function elegirModo(m: typeof modo) {
    setModo(m);
    motor.current?.setMode(m);
  }

  // ---------------------------------------------------------------- guardar
  async function guardar(nuevo?: "borrador" | "publicada") {
    setGuardando(true);
    setResultado({});
    try {
      // Primero los archivos nuevos, directo al bucket.
      for (const it of elementos.current) {
        if (!it._file) continue;
        const nombre = `${it.id}-${it._fname ?? "archivo"}`;
        await subir(nombre, it._file, it._file.type || "application/octet-stream");
        // Los objetos los comparte el motor 3D: se cambian en su lugar.
        Object.assign(it, { file: nombre, bytes: it._file.size, _file: undefined });
      }

      const res = await guardarExperiencia(
        experiencia.id,
        {
          titulo,
          imagen: imagen.ruta,
          objetivo: imagen.objetivo,
          imagenAncho: imagen.ancho,
          imagenAlto: imagen.alto,
          elementos: elementos.current,
          botones,
        },
        nuevo,
      );
      setResultado(res);
      if (!res.error) {
        setSinGuardar(false);
        if (nuevo) setEstado(nuevo);
      }
    } catch (error) {
      console.error(error);
      setResultado({ error: "No se pudo subir un archivo. Revisa tu conexión e inténtalo de nuevo." });
    }
    setGuardando(false);
  }

  const listaParaPublicar = Boolean(imagen.objetivo) && lista.length > 0;
  const paso = (n: number, hecho: boolean) => (
    <span
      className={`mr-3 inline-grid size-9 place-items-center rounded-full text-base font-bold ${
        hecho ? "bg-lima text-selva-2" : "boton-oro text-ink"
      }`}
    >
      {hecho ? "✓" : n}
    </span>
  );

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/negocio/panel/experiencias" className="font-bold text-selva underline">
            ← Mis experiencias
          </Link>
          <h1 className="mt-3 font-display text-3xl">{titulo || "Nueva experiencia"}</h1>
          <p className="mt-1 text-sm text-cacao/80">
            {estado === "publicada" ? "Publicada" : "Borrador"} · <span className="font-mono">{link.replace(/^https?:\/\//, "")}</span>
          </p>
        </div>
        <PoweredByVortice compacto />
      </header>

      {/* 1. La imagen */}
      <section className="rounded-3xl border-2 border-ink/10 bg-white p-6">
        <h2 className="flex items-center font-display text-2xl">
          {paso(1, Boolean(imagen.objetivo))}Tu imagen
        </h2>
        <p className="mt-2 max-w-prose text-cacao">
          La que la gente va a enfocar: una tarjeta, un empaque, un cartel. Funciona mejor con muchos
          detalles y contraste; evita fondos lisos o repetitivos.
        </p>
        <label className="mt-4 flex cursor-pointer flex-wrap items-center gap-4 rounded-2xl border-2 border-dashed border-mango/60 bg-crema p-4 transition-shadow hover:shadow-[0_0_24px_rgb(255_183_3/0.3)]">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={preparando !== null}
            onChange={(e) => alElegirImagen(e.target.files?.[0])}
          />
          {imagen.url ? (
            <img src={imagen.url} alt="" className="h-24 w-auto rounded-xl shadow-[0_0_0_2px_rgb(255_183_3/0.6)]" />
          ) : (
            <span className="grid size-24 place-items-center rounded-xl bg-[#1c1236] text-3xl text-mango">✦</span>
          )}
          <span>
            <strong className="block">{imagen.url ? "Cambiar imagen" : "Elegir imagen"}</strong>
            <small className="text-cacao/70">JPG, PNG o WebP</small>
          </span>
        </label>
        {preparando !== null && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={preparando}>
            <div className="boton-oro h-full transition-[width]" style={{ width: `${preparando}%` }} />
          </div>
        )}
        {avisoImagen.texto && (
          <p
            className={`mt-3 text-sm font-bold ${
              avisoImagen.tono === "mal" ? "text-guayaba" : avisoImagen.tono === "bien" ? "text-selva-2" : "text-cacao"
            }`}
          >
            {avisoImagen.texto}
          </p>
        )}
        {estrellas > 0 && (
          <p className="mt-3 flex flex-wrap items-start gap-3 rounded-2xl bg-crema-2 p-3 text-sm">
            <span aria-label={`${estrellas} de 5 estrellas`} className="text-lg text-mango drop-shadow-[0_0_6px_rgb(255_183_3/0.6)]">
              {"★".repeat(estrellas)}
              <span className="text-ink/15">{"★".repeat(5 - estrellas)}</span>
            </span>
            <span className="max-w-prose">
              <strong className="block">Calidad para reconocerse</strong>
              {TEXTO_CALIDAD[estrellas]}
            </span>
          </p>
        )}
      </section>

      {/* 2. El contenido */}
      <section className="rounded-3xl border-2 border-ink/10 bg-white p-6">
        <h2 className="flex items-center font-display text-2xl">
          {paso(2, lista.length > 0)}Tu contenido
        </h2>
        <p className="mt-2 max-w-prose text-cacao">
          Agrega lo que aparecerá sobre tu imagen. Toca un elemento para moverlo, girarlo o cambiar su
          tamaño; arrastra el fondo para girar la vista.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-[auto_1fr_20rem]">
          <nav aria-label="Agregar" className="flex gap-2 lg:flex-col">
            {(["video", "image", "text"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => alPulsarAgregar(t)}
                className="grid min-h-16 min-w-20 place-items-center gap-1 rounded-2xl border-2 border-mango/50 bg-white px-3 py-2 text-sm font-bold text-selva-2 shadow-[0_0_14px_rgb(255_183_3/0.18)] transition-transform hover:-translate-y-px"
              >
                <span aria-hidden="true" className="text-lg text-mango">
                  {ICONO[t]}
                </span>
                {NOMBRE[t]}
              </button>
            ))}
          </nav>

          <div className="relative h-[60vh] min-h-80 overflow-hidden rounded-2xl bg-[#1a0d33] shadow-[inset_0_0_60px_rgb(0_0_0/0.5)]">
            <div ref={escenario} className="absolute inset-0 [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full" />
            {!imagen.ancho && (
              <p className="absolute inset-0 grid place-items-center p-6 text-center font-bold text-crema/70">
                Sube tu imagen (paso 1) para empezar.
              </p>
            )}
            {imagen.ancho && (
              <>
                <div className="absolute top-3 left-3 flex gap-1 rounded-full bg-[#1c1236]/80 p-1 backdrop-blur">
                  {(
                    [
                      ["mover", "Mover"],
                      ["girar", "Girar"],
                      ["escalar", "Tamaño"],
                    ] as const
                  ).map(([m, texto]) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={modo === m}
                      onClick={() => elegirModo(m)}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                        modo === m ? "boton-oro text-ink" : "text-crema"
                      }`}
                    >
                      {texto}
                    </button>
                  ))}
                </div>
                <div className="absolute top-3 right-3 flex gap-1 rounded-full bg-[#1c1236]/80 p-1 backdrop-blur">
                  <button type="button" onClick={() => motor.current?.view("inicio")} className="rounded-full px-3 py-1.5 text-xs font-bold text-crema">
                    Vista inicial
                  </button>
                  <button type="button" onClick={() => motor.current?.view("arriba")} className="rounded-full px-3 py-1.5 text-xs font-bold text-crema">
                    Desde arriba
                  </button>
                  <button type="button" onClick={() => motor.current?.play()} className="rounded-full px-3 py-1.5 text-xs font-bold text-mango">
                    ▶ Ver cómo aparecen
                  </button>
                </div>
              </>
            )}
          </div>

          <aside className="grid content-start gap-3">
            {avisoElementos && <p className="text-sm font-bold text-guayaba">{avisoElementos}</p>}
            <div className="flex items-baseline justify-between">
              <h3 className="font-bold">Elementos</h3>
              <span className="text-xs text-cacao/70">
                {lista.length} de {LIMITES.elementos}
              </span>
            </div>
            {lista.length === 0 ? (
              <p className="rounded-2xl bg-crema-2 p-4 text-sm text-cacao">
                Usa los botones para agregar un video, una imagen o un texto.
              </p>
            ) : (
              <ol className="grid gap-1.5" aria-label="Elementos (el de abajo se ve al frente)">
                {lista.map((it, i) => (
                  <li key={it.id}>
                    <div
                      className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm ${
                        sel === it.id ? "border-mango bg-mango/15 shadow-[0_0_14px_rgb(255_183_3/0.35)]" : "border-ink/10 bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => motor.current?.select(it.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left font-bold"
                      >
                        <span aria-hidden="true" className="text-mango">
                          {ICONO[it.type]}
                        </span>
                        <span className="truncate">
                          {it.type === "text" ? (it.text ?? "Texto").split("\n")[0] : (it.name ?? NOMBRE[it.type])}
                        </span>
                      </button>
                      <button type="button" aria-label="Más atrás" disabled={i === 0} onClick={() => mover(it, -1)} className="px-1 disabled:opacity-30">
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label="Más al frente"
                        disabled={i === lista.length - 1}
                        onClick={() => mover(it, 1)}
                        className="px-1 disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button type="button" aria-label="Quitar" onClick={() => quitar(it.id)} className="px-1 text-guayaba">
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {elegido && <Propiedades it={elegido} editar={editar} motor={motor} ponerSonido={ponerSonido} />}
          </aside>
        </div>
        <input ref={entradaArchivo} type="file" hidden />
        <p className="mt-4 text-xs text-cacao/70">
          Videos MP4 de hasta {LIMITES.videoMB} MB (para quitarles el fondo, grábalos con pantalla verde). Imágenes
          PNG con fondo transparente para logos.
        </p>
      </section>

      {/* 3. Datos y botones */}
      <section className="rounded-3xl border-2 border-ink/10 bg-white p-6">
        <h2 className="flex items-center font-display text-2xl">
          {paso(3, Boolean(titulo.trim()))}Datos y botones
        </h2>
        <label className="mt-4 grid gap-1.5">
          <span className="font-bold">Título de la experiencia</span>
          <input
            value={titulo}
            maxLength={80}
            onChange={(e) => {
              setTitulo(e.target.value);
              setSinGuardar(true);
            }}
            placeholder="Ej. Conoce cómo hacemos nuestro chocolate"
            className="min-h-12 rounded-2xl border-2 border-ink/15 px-4"
          />
        </label>
        <p className="mt-5 font-bold">Botones (opcionales)</p>
        <p className="text-sm text-cacao/70">Salen abajo mientras se ve la experiencia.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(
            [
              ["whatsapp", "WhatsApp", "993 123 4567"],
              ["instagram", "Instagram", "tu_usuario"],
              ["facebook", "Facebook", "tu-pagina"],
              ["tiktok", "TikTok", "tu_usuario"],
              ["web", "Sitio web", "tusitio.com"],
            ] as const
          ).map(([clave, texto, ejemplo]) => (
            <label key={clave} className="grid gap-1">
              <span className="text-sm font-bold">{texto}</span>
              <input
                value={botones[clave] ?? ""}
                inputMode={clave === "whatsapp" ? "tel" : "text"}
                placeholder={ejemplo}
                onChange={(e) => {
                  setBotones((b) => ({ ...b, [clave]: e.target.value }));
                  setSinGuardar(true);
                }}
                className="min-h-11 rounded-xl border-2 border-ink/15 px-3"
              />
            </label>
          ))}
        </div>
      </section>

      {/* 4. Publicar */}
      <section className="rounded-3xl border-2 border-mango/50 bg-white p-6 shadow-[0_0_30px_rgb(255_183_3/0.18)]">
        <h2 className="flex items-center font-display text-2xl">
          {paso(4, estado === "publicada")}Publicar
        </h2>

        <div className="mt-4 grid gap-6 md:grid-cols-[1fr_14rem]">
          <div className="grid content-start gap-3">
            {!puedePublicar ? (
              <div className="rounded-2xl bg-crema-2 p-4">
                <p className="antetitulo">Viene con el plan Pro</p>
                <p className="mt-2 text-cacao">
                  Tu experiencia se guarda y la puedes probar tú. Para que su link y su QR funcionen para
                  todos, pásate a <strong>Pro ($499/mes)</strong>: trae 3 experiencias publicadas.
                </p>
                <Link
                  href="/negocio/panel/cuenta"
                  className="boton-oro brillo mt-3 inline-flex min-h-12 items-center rounded-full px-6 font-bold text-ink"
                >
                  Pasarme a Pro
                </Link>
              </div>
            ) : !hayLugar && estado !== "publicada" ? (
              <div className="rounded-2xl bg-crema-2 p-4 text-cacao">
                Ya tienes publicadas todas las experiencias de tu plan. Suma una más por $499 (pago único)
                en <Link href="/negocio/panel/experiencias" className="font-bold text-selva underline">Mis experiencias</Link>{" "}
                o pasa otra a borrador.
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={guardando}
                onClick={() => guardar()}
                className="min-h-12 rounded-full border-2 border-mango/60 bg-white px-6 font-bold text-selva-2 shadow-[0_0_14px_rgb(255_183_3/0.2)] disabled:opacity-60"
              >
                {guardando ? "Guardando…" : "Guardar cambios"}
              </button>
              {estado === "publicada" ? (
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => guardar("borrador")}
                  className="min-h-12 rounded-full px-4 font-bold text-cacao underline disabled:opacity-60"
                >
                  Pasar a borrador
                </button>
              ) : (
                puedePublicar &&
                hayLugar && (
                  <button
                    type="button"
                    disabled={guardando || !listaParaPublicar}
                    onClick={() => guardar("publicada")}
                    className="boton-oro brillo inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-bold text-ink disabled:opacity-60"
                  >
                    ✦ Publicar mi experiencia
                  </button>
                )
              )}
            </div>
            {!listaParaPublicar && (
              <p className="text-sm text-cacao/70">Sube tu imagen y agrega al menos un elemento para publicarla.</p>
            )}
            {sinGuardar && !guardando && <p className="text-sm font-bold text-cacao">Tienes cambios sin guardar.</p>}
            {resultado.error && (
              <p role="alert" className="font-bold text-guayaba">
                {resultado.error}
              </p>
            )}
            {resultado.ok && (
              <p role="status" className="font-bold text-selva-2">
                {resultado.ok}
              </p>
            )}
            <p className="text-xs text-cacao/70">
              Al publicar confirmas que tienes derecho a usar la imagen y todo lo que le pongas. La Guía del
              Cacao puede retirar contenido inapropiado.
            </p>
          </div>

          <div className="grid justify-items-center gap-2 text-center">
            <canvas ref={qr} aria-label="QR para probarla" className="w-full rounded-2xl border border-ink/10" />
            <a href={link} target="_blank" rel="noopener" className="text-sm font-bold text-selva underline">
              Abrir el visor
            </a>
            <button
              type="button"
              onClick={() => qr.current && bajarLienzo(qr.current, `QR-${experiencia.codigo}.png`)}
              className="text-xs font-bold text-cacao/70 underline"
            >
              Descargar QR
            </button>
            {estado !== "publicada" && (
              <p className="text-xs text-cacao/70">Mientras sea borrador, solo tú la ves (con tu sesión abierta).</p>
            )}
          </div>
        </div>
      </section>

      <PoweredByVortice />
    </div>
  );
}

/** El panel del elemento elegido: lo esencial de cada tipo. */
function Propiedades({
  it,
  editar,
  motor,
  ponerSonido,
}: {
  it: EnEdicion;
  editar: (it: EnEdicion, cambios: Partial<EnEdicion>, rehacer?: boolean) => void;
  motor: React.RefObject<MotorRA | null>;
  ponerSonido: (it: EnEdicion, con: boolean) => void;
}) {
  const campo = "min-h-10 w-full rounded-xl border-2 border-ink/15 px-3";

  return (
    <div className="grid gap-3 rounded-2xl border-2 border-mango/40 bg-crema p-4 text-sm">
      <p className="antetitulo">{NOMBRE[it.type]}</p>

      {it.type === "text" && (
        <>
          <label className="grid gap-1">
            <span className="font-bold">Texto</span>
            <textarea
              rows={2}
              maxLength={200}
              value={it.text ?? ""}
              onChange={(e) => editar(it, { text: e.target.value }, true)}
              className={`${campo} py-2`}
            />
          </label>
          <label className="grid gap-1">
            <span className="font-bold">Letra</span>
            <select value={it.font ?? "Sora"} onChange={(e) => editar(it, { font: e.target.value }, true)} className={campo}>
              {(FONTS as string[]).map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <span className="font-bold">Color</span>
              <input type="color" value={it.color ?? "#ffffff"} onChange={(e) => editar(it, { color: e.target.value }, true)} />
            </label>
            <label className="flex items-center gap-2">
              <span className="font-bold">Contorno</span>
              <input
                type="checkbox"
                checked={Boolean(it.stroke)}
                onChange={(e) => editar(it, { stroke: e.target.checked ? "#4a2c1d" : undefined }, true)}
              />
              {it.stroke && <input type="color" value={it.stroke} onChange={(e) => editar(it, { stroke: e.target.value }, true)} />}
            </label>
          </div>
        </>
      )}

      {it.type === "video" && (
        <>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(it.sound)}
              onChange={(e) => ponerSonido(it, e.target.checked)}
            />
            <span className="font-bold">Con sonido</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(it.chroma)}
              onChange={(e) => editar(it, { chroma: e.target.checked ? { color: "#00ff00", tol: 0.3 } : null }, true)}
            />
            <span className="font-bold">Quitar el fondo verde</span>
          </label>
        </>
      )}

      <label className="grid gap-1">
        <span className="font-bold">Tamaño</span>
        <input
          type="range"
          min={0.05}
          max={2}
          step={0.01}
          value={it.s}
          onChange={(e) => editar(it, { s: Number(e.target.value) })}
          className="accent-[#ffb703]"
        />
      </label>

      <label className="grid gap-1">
        <span className="font-bold">Al aparecer</span>
        <select value={it.in} onChange={(e) => editar(it, { in: e.target.value })} className={campo}>
          {(ENTRADAS as [string, string][]).map(([valor, texto]) => (
            <option key={valor} value={valor}>
              {texto}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1">
        <span className="font-bold">Link al tocarlo (opcional)</span>
        <input
          value={it.link ?? ""}
          placeholder="https://… o WhatsApp a 10 dígitos"
          onChange={(e) => {
            const v = e.target.value.trim();
            const digitos = v.replace(/\D/g, "");
            editar(it, {
              link: !v ? undefined : /^\d[\d\s-]{9,}$/.test(v) && digitos.length >= 10 ? `https://wa.me/52${digitos.slice(-10)}` : v,
            });
          }}
          className={campo}
        />
      </label>

      <button
        type="button"
        onClick={() => motor.current?.stand(it.id)}
        className="justify-self-start rounded-full border-2 border-mango/50 bg-white px-4 py-1.5 font-bold text-selva-2"
      >
        Parar / acostar sobre la imagen
      </button>
    </div>
  );
}
