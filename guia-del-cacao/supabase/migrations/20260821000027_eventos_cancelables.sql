-- Un evento se puede cancelar.
--
-- Hasta ahora solo se podia borrar, y no es lo mismo: quien ya aparto la fecha
-- necesita enterarse de que se cayo. Un evento borrado desaparece sin decir
-- nada y deja a la gente presentandose en la puerta.
--
-- Los otros dos estados no se guardan porque **se deducen**: un evento esta
-- activo o ya paso segun su fecha, y guardarlo seria tener dos versiones de la
-- misma verdad — una que se actualiza sola y otra que habria que ir a corregir
-- todas las noches.

alter table public.eventos
  add column if not exists cancelado_en timestamptz;

comment on column public.eventos.cancelado_en is
  'Cuando se cancelo. Null = sigue en pie. Activo o pasado se deduce de fecha_evento.';

-- ---------------------------------------------------------------------------
-- El micrositio y la agenda siguen ensenando lo cancelado
-- ---------------------------------------------------------------------------

/*
  `agendaDe` esconde lo que ya paso, y un evento cancelado que todavia no llega
  seguiria saliendo — que es justo lo que se quiere: la gente tiene que ver el
  aviso de que se cayo, no encontrarse un hueco donde estaba.

  Se cambia solo el orden: lo cancelado baja, para que lo que sigue en pie se
  lea primero.
*/
create index if not exists eventos_cancelado_idx
  on public.eventos (sucursal_id, cancelado_en);
