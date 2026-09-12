-- Dar un corazón deja de mover una mazorca.
--
-- `apoyos` tenía un trigger, `mover_moneda_al_apoyar`, que le quitaba una
-- mazorca a quien apoyaba y se la daba a quien publicó: era la que devolvía lo
-- que costaba publicar, cuando publicar costaba una.
--
-- Con las mazorcas fuera del producto, ese trigger no tiene de dónde cobrar y
-- rechaza **todos** los corazones con "No tienes mazorcas de cacao para
-- apoyar". Se vio al probar el botón en el muro: fallaba siempre, y no por el
-- botón.
--
-- Es el mismo caso que el cobro al publicar de la migración 000044: una regla
-- que se quedó apuntando a una economía que ya no existe.
drop trigger if exists mover_moneda_al_apoyar on public.apoyos;

drop function if exists public.mover_moneda_de_apoyo();

comment on table public.apoyos is
  'Los corazones de una publicacion. Ya no mueven nada: costaban una mazorca al que apoyaba y se la daban al autor, y eso se fue con las mazorcas. La llave primaria compuesta impide dar dos veces el mismo.';
