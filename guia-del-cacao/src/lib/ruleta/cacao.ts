import type { Gajo } from "@/components/ruleta/ruleta-magica";

/**
 * Los seis gajos de la ruleta de cacao (migración 000066): mazorcas, flores,
 * granos y el logo del negocio, ningún premio. La gira quien ya tiene su
 * premio, por diversión; vive aquí y no junto a la rueda porque la arma el
 * servidor del micrositio.
 */
export function gajosDeCacao(logo: string | null): Gajo[] {
  const imagenes = [
    "/marca/mazorca.png",
    logo ?? "/parallax/rama-una-mazorca.png",
    "/parallax/flores-de-cacao.png",
    "/parallax/granos-de-cacao.png",
    "/parallax/mazorca-amarilla.png",
    "/parallax/hoja.png",
  ];
  return imagenes.map((imagen, i) => ({ gajo: i + 1, texto: "", probabilidad: 1, esPremio: false, imagen }));
}
