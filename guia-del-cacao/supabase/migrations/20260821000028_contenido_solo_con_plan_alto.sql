-- Eventos y noticias son del plan que los incluye, y dejan de verse si se baja.
--
-- Hasta ahora `tiers.puede_publicar_contenido` no lo comprobaba nadie: la
-- politica de escritura solo pedia ser dueno de la sucursal, asi que un plan
-- Basico podia publicar los mismos eventos que uno Premier. Aqui se cierra.
--
-- Lo que se ve NO se copia a una columna "oculto": se deriva del plan que la
-- marca tiene *hoy*. Con una columna habria que acordarse de apagarla al bajar
-- de plan y de encenderla al volver, y el dia que alguien olvide una de las dos
-- quedan eventos visibles sin plan o eventos pagados sin ver. Derivandolo, bajar
-- oculta y volver a subir devuelve, sin proceso que mantener.

-- Si la marca de esta sucursal tiene hoy plan con derecho a publicar.
create or replace function public.marca_publica_contenido(p_sucursal uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(t.puede_publicar_contenido, false)
    from public.tiers t
   where t.id = public.plan_de_marca(public.marca_de_sucursal(p_sucursal));
$$;

comment on function public.marca_publica_contenido(uuid) is
  'Si el plan activo de la marca incluye publicar eventos y noticias. Lo que se publico con un plan que lo permitia deja de verse al bajar, y vuelve a verse al subir: no se borra nada.';

-- Lo publico ahora exige, ademas de sucursal publicada, plan con derecho. El
-- dueno lo sigue viendo: por eso `posee_sucursal` sigue en el OR, y es lo que
-- hace que en su panel pueda verlo marcado como oculto en vez de perderlo.
drop policy if exists eventos_lectura on public.eventos;

create policy eventos_lectura on public.eventos
  for select
  using (
    (public.sucursal_publicada(sucursal_id) and public.marca_publica_contenido(sucursal_id))
    or public.posee_sucursal(sucursal_id)
    or public.es_admin()
  );

drop policy if exists noticias_lectura on public.noticias;

create policy noticias_lectura on public.noticias
  for select
  using (
    (public.sucursal_publicada(sucursal_id) and public.marca_publica_contenido(sucursal_id))
    or public.posee_sucursal(sucursal_id)
    or public.es_admin()
  );

-- Y crear o editar exige el plan. Va en un trigger y no solo en el WITH CHECK de
-- la politica porque asi se puede explicar el motivo: un WITH CHECK que falla
-- llega al negocio como "new row violates row-level security policy", que no
-- dice que le falta un plan.
create or replace function public.exigir_plan_de_contenido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- El administrador entra igual: sacar del directorio algo que no debia estar
  -- es su trabajo, y no puede depender de lo que pague el negocio.
  if public.es_admin() then
    return new;
  end if;

  if not public.marca_publica_contenido(new.sucursal_id) then
    raise exception 'Tu plan no incluye publicar eventos ni noticias. Lo que ya publicaste sigue guardado y vuelve a verse en cuanto subas de plan.';
  end if;

  return new;
end;
$$;

drop trigger if exists exigir_plan_al_publicar_evento on public.eventos;

create trigger exigir_plan_al_publicar_evento
  before insert or update on public.eventos
  for each row execute function public.exigir_plan_de_contenido();

drop trigger if exists exigir_plan_al_publicar_noticia on public.noticias;

create trigger exigir_plan_al_publicar_noticia
  before insert or update on public.noticias
  for each row execute function public.exigir_plan_de_contenido();

-- Borrar sigue siendo suyo aunque haya bajado de plan: son sus eventos, y
-- obligarle a pagar para poder tirar algo que ya no se ve seria cobrarle por
-- limpiar. Por eso el trigger es solo de insert y update.
