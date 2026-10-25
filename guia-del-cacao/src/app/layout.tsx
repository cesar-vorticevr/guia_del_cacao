import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans, Space_Mono } from "next/font/google";
import { MagiaAlAparecer } from "@/components/magia-al-aparecer";
import { PolvoDeHada } from "@/components/polvo-de-hada";
import { IMAGEN_DE_RESPALDO } from "@/lib/compartir";
import "./globals.css";

/*
  Fraunces para los títulos: una serif suave, de cuento ilustrado, con itálicas
  que se usan para la palabra que importa («el *cacao* de México»). Sustituyó
  a Fredoka, que con sus letras redondas hacía que la guía se leyera infantil.
  Los ejes SOFT y WONK son los que le dan ese aire de libro de cuentos.

  Plus Jakarta Sans para el texto: moderna y clara, sin el redondeo de Nunito.
*/
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const DESCRIPCION =
  "Directorio y agenda de los negocios del cacao en México: productoras, chocolaterías, museos y talleres.";

export const metadata: Metadata = {
  title: "Guía del Cacao",
  description: DESCRIPCION,
  /*
    De dónde cuelgan las rutas relativas de las tarjetas para compartir.

    Sin esto, `openGraph.url: "/marca/la-mazorca"` se manda tal cual y Facebook
    no sabe de qué dominio es: la tarjeta sale sin enlace o sin imagen. Y no se
    puede sacar de las cabeceras porque estos metadatos son estáticos, así que
    sale de la variable que ya se usa para la vuelta de Google.
  */
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  openGraph: {
    type: "website",
    title: "Guía del Cacao",
    description: DESCRIPCION,
    siteName: "Guía del Cacao",
    locale: "es_MX",
    images: [{ url: IMAGEN_DE_RESPALDO }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Guía del Cacao",
    description: DESCRIPCION,
    images: [IMAGEN_DE_RESPALDO],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${fraunces.variable} ${jakarta.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <PolvoDeHada />
        <MagiaAlAparecer />
      </body>
    </html>
  );
}
