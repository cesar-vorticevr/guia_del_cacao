-- El plan Gratis trae todo lo del Pro, por quince dias.
--
-- Hasta aqui el Gratis era el micrositio con catalogo y contacto, sin
-- resenas, eventos, banner, ruleta ni realidad aumentada. Desde el 29 de
-- octubre de 2026 es la prueba del Pro: las mismas funciones, a $0 y por
-- `dias_gratis()` (quince). Al vencer, `vencer_pruebas()` lo oculta como
-- siempre y `plan_de_sucursal()` deja de devolverlo, asi que todo lo que se
-- deriva del plan (resenas, eventos, ruleta, experiencias) se apaga solo.
--
-- Se copian las banderas del Pro en vez de escribirlas: si el Pro gana una
-- funcion antes de esta migracion, el Gratis la trae tambien.

update public.tiers g
   set puede_dar_puntos         = p.puede_dar_puntos,
       puede_publicar_contenido = p.puede_publicar_contenido,
       en_banner_principal      = p.en_banner_principal,
       permite_resenas          = p.permite_resenas,
       permite_ruleta           = p.permite_ruleta,
       experiencias_ra          = p.experiencias_ra
  from public.tiers p
 where g.id = 1 and p.id = 3;
