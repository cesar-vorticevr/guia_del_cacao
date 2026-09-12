/**
 * Lo que está encendido en la plataforma.
 *
 * Estas cuatro cosas están construidas, probadas y funcionando, y aun así se
 * apagan para el lanzamiento. El motivo está en el sondeo a chocolateras de
 * septiembre de 2026: de cinco negocios, ninguno tenía problema de clientes que
 * no vuelven —tres dijeron tener clientela fija— y dos señalaron las mazorcas
 * como la parte que no entendían. Cuatro de cinco eligieron visibilidad
 * (directorio, micrositio, agenda) cuando se les pidió quedarse con una sola
 * función.
 *
 * Apagado no es borrado. El código, las tablas y las migraciones siguen aquí:
 * el día que haya visitantes a quienes premiar, esto se vuelve a encender
 * cambiando un `false` por un `true`. Borrarlo obligaría a escribirlo otra vez.
 *
 * Quien apague o encienda algo aquí tiene que revisar tres sitios: la
 * navegación del cliente (`barra-inferior`), las pestañas del panel del negocio
 * (`pestanas-del-panel`) y la página de la función, que redirige cuando está
 * apagada.
 */
export const FUNCIONES = {
  /** Pedir y regalar mazorcas, el QR del mostrador y las solicitudes. */
  mazorcas: false,

  /** Cupones del negocio y sus canjes, que se pagaban con mazorcas. */
  cupones: false,

  /**
   * El muro de publicaciones con fotos y comentarios.
   *
   * Encendido. Ya no cuesta mazorcas: el tope es una publicación al día por
   * cuenta (migración 000044), que hace el mismo trabajo —que el muro no se
   * llene de ruido— sin pedirle nada a nadie.
   */
  comunidad: true,

  /** Los grados del cliente según lo que junta. Sin mazorcas no hay qué medir. */
  rangos: false,
} as const;

/**
 * Si nada de lo que se paga con mazorcas está encendido, la cuenta no las
 * muestra ni las cuenta.
 *
 * La comunidad **no** entra en esta cuenta aunque esté encendida: publicar
 * costaba una mazorca y ya no cuesta nada. Si siguiera aquí, encender el muro
 * traería de vuelta el marcador y la pastilla del pasaporte, que es justo lo
 * que se quitó.
 */
export const HAY_ECONOMIA_DE_MAZORCAS = FUNCIONES.mazorcas || FUNCIONES.cupones;
