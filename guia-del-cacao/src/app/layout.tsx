import type { Metadata } from "next";
import { Fredoka, Nunito, Space_Mono } from "next/font/google";
import { IMAGEN_DE_RESPALDO } from "@/lib/compartir";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const nunito = Nunito({
  variable: "--font-nunito",
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
      className={`${fredoka.variable} ${nunito.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
