-- Una resena sin estrellas no es una resena: es un comentario suelto.
--
-- `resenas` y `calificaciones` son dos tablas porque tienen reglas distintas
-- —el texto se corrige una vez al dia, la nota tambien desde la 000017— y eso
-- no cambia. Lo que faltaba era el amarre: nada obligaba a que existieran las
-- dos, asi que se podian guardar resenas huerfanas.
--
-- Por donde se colaban: el paso 3 de pedir mazorcas guardaba el texto y la nota
-- por separado, cada uno con su `if`. Quien escribia el comentario y no tocaba
-- las estrellas dejaba una resena sin calificar, y en el micrositio salia sin
-- estrellas al lado mientras el promedio la ignoraba. El formulario del
-- micrositio si las pedia juntas; el del QR no.

create or replace function public.exigir_calificacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
      from public.calificaciones c
     where c.usuario_id = new.usuario_id
       and c.sucursal_id = new.sucursal_id
  ) then
    raise exception 'Antes de escribir tu resena, ponle estrellas al negocio';
  end if;

  return new;
end;
$$;

comment on function public.exigir_calificacion() is
  'No deja escribir una resena sin haber calificado. Solo al insertar: corregir el texto de una resena vieja no puede quedar bloqueado por una regla que no existia cuando se escribio.';

drop trigger if exists exigir_calificacion_al_resenar on public.resenas;

create trigger exigir_calificacion_al_resenar
  before insert on public.resenas
  for each row execute function public.exigir_calificacion();

-- No se toca el UPDATE a proposito. Las nueve resenas que ya estaban sin nota
-- se escribieron cuando esto se permitia, y bloquear su edicion dejaria a su
-- autor sin poder ni corregir una falta de ortografia por algo que no hizo mal.
--
-- Borrar una calificacion tampoco puede dejar la resena huerfana: no hay
-- politica de DELETE en `calificaciones`, asi que nadie puede quitarla.
