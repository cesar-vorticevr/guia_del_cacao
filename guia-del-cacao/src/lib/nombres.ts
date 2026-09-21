/**
 * Cómo se nombra un negocio: primero la marca, luego la sucursal.
 *
 * La marca es lo que la gente reconoce —"Chocolates Grijalva"—; la sucursal es
 * la dirección. Enseñar solo "Matriz Villahermosa" no le dice nada a nadie.
 *
 * Vive aquí y no en `datos/publico.ts` porque es presentación pura, sin acceso
 * a la base: los componentes de cliente que la necesitan no pueden importar ese
 * módulo, que arrastra el cliente de Supabase de servidor y rompe la
 * compilación. `datos/publico.ts` la reexporta, así que los usos de allá siguen
 * funcionando igual.
 */
export function nombrarNegocio(
  sucursal: { nombre_sucursal: string; marcas: { nombre_comercial: string } | null } | null,
) {
  if (!sucursal) return { marca: null, sucursal: null };

  return {
    marca: sucursal.marcas?.nombre_comercial ?? sucursal.nombre_sucursal,
    // Si no hay marca, el nombre de la sucursal ya se usó arriba y repetirlo
    // debajo se vería como un error.
    sucursal: sucursal.marcas ? sucursal.nombre_sucursal : null,
  };
}

/**
 * Cómo se llama una publicación que no tiene título.
 *
 * Desde la migración 000050 el muro es un feed y una foto no se titula. Pero
 * quedan tres sitios que necesitan un nombre corto: la pestaña del navegador,
 * la tarjeta que sale al compartir el enlace, y el texto alternativo de la
 * foto para quien no la ve.
 *
 * Sale de las primeras palabras del contenido, **sin guardarse**: si mañana se
 * corrige el texto, el nombre se corrige solo. Guardarlo sería tener dos
 * versiones de la misma verdad, con una destinada a quedarse atrás.
 *
 * Lo que ya tiene título escrito lo conserva: son catorce publicaciones del
 * foro viejo, y alguna dice algo que su texto no repite.
 */
export function comoSeLlama(
  titulo: string | null | undefined,
  contenido: string,
) {
  const propio = titulo?.trim();
  if (propio) return propio;

  const seguido = contenido.replace(/\s+/g, " ").trim();
  if (seguido.length <= 70) return seguido;

  // Se corta en el último espacio para no partir una palabra por la mitad.
  const recorte = seguido.slice(0, 70);
  const hastaElEspacio = recorte.slice(0, recorte.lastIndexOf(" "));

  return `${(hastaElEspacio || recorte).trimEnd()}…`;
}
