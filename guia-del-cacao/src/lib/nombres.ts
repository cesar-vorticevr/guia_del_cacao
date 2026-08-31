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
