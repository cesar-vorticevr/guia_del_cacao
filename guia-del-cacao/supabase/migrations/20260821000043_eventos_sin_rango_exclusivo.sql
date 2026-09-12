-- Los eventos dejan de poder ser exclusivos de un rango.
--
-- `eventos.rango_exclusivo` marcaba una cata como "solo para Maestros
-- cacaoteros": venia del sistema de rangos del cliente, que la spec v2 elimina
-- del producto junto con las mazorcas. Sin rangos, la columna prometia una
-- puerta que ya no existe, y el negocio que la usara dejaria su evento
-- invisible para todo el mundo sin entender por que.
--
-- Se **borra** y no se apaga con una bandera, a diferencia de las mazorcas: de
-- aquellas se conserva el codigo porque pueden volver el dia que haya
-- visitantes a quienes premiar. Los rangos no vuelven — no hay nada que medir
-- si no hay mazorcas que juntar—, y una columna que nadie va a leer nunca mas
-- solo es una trampa para quien lea la tabla dentro de un ano.

-- Ninguna politica, funcion ni vista la mira: se comprobo antes de borrarla, y
-- por eso el `drop` va sin `cascade`. Si algo apareciera dependiendo de ella,
-- esta migracion falla en vez de llevarselo por delante en silencio.
--
-- Los eventos que la tenian puesta quedan abiertos a todos, que es lo que ya
-- eran de hecho: sin rangos, nadie cumplia el requisito y no los veia nadie.
alter table public.eventos
  drop column if exists rango_exclusivo;
