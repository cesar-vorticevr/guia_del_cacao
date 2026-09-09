-- Las resenas dejan de estar en todos los micrositios.
--
-- Desde la spec v2 son la funcion del Tier 2: en un Tier 1 la seccion no
-- existe -ni el formulario ni el listado- y el visitante ve solo el catalogo y
-- el contacto.
--
-- La regla vive aqui y no en la pantalla, como todas las demas: esconder el
-- formulario no impide que alguien mande el insert por su cuenta.

create or replace function public.sucursal_acepta_resenas(p_sucursal uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(t.permite_resenas, false)
    from public.sucursales s
    left join public.tiers t on t.id = s.tier_id
   where s.id = p_sucursal;
$$;

comment on function public.sucursal_acepta_resenas(uuid) is
  'Si el plan de esa sucursal incluye resenas. Sale de `tiers.permite_resenas` y no de comparar `tier_id >= 2`: cual es el primer plan que las trae es un dato de la tabla.';

-- ---------------------------------------------------------------------------
-- Escribir
-- ---------------------------------------------------------------------------
drop policy if exists resenas_crea_propia on public.resenas;

create policy resenas_crea_propia on public.resenas
  for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and public.es_cliente()
    and public.sucursal_publicada(sucursal_id)
    and public.sucursal_acepta_resenas(sucursal_id)
  );

-- ---------------------------------------------------------------------------
-- Leer
-- ---------------------------------------------------------------------------
--
-- "Si una sucursal baja de Tier 2/3 a Tier 1, las resenas ya existentes deben
-- conservarse en la base de datos pero dejar de mostrarse publicamente hasta
-- que la sucursal vuelva a Tier 2 o 3. No se borran." (spec v2 §5.4)
--
-- Por eso la condicion va en la lectura publica y no en un borrado ni en una
-- columna `oculta`: la visibilidad se deriva del plan de hoy, asi que volver a
-- subir de plan las devuelve solas, sin nada que recordar ni que restaurar.
--
-- El dueno y quien modera las siguen viendo: para el negocio son la razon de
-- subir de plan -"esto es lo que estas escondiendo"-, y para moderacion, algo
-- que no se ve por el plan no deja de existir.
drop policy if exists resenas_lectura on public.resenas;

create policy resenas_lectura on public.resenas
  for select to anon, authenticated
  using (
    (
      public.sucursal_publicada(sucursal_id)
      and public.sucursal_acepta_resenas(sucursal_id)
    )
    or public.posee_sucursal(sucursal_id)
    or public.es_admin()
  );

-- Las calificaciones viajan con su resena: ensenar 4.8 estrellas en un
-- micrositio donde no se puede leer ni una opinion seria un promedio sin nada
-- detras. La misma regla, en la misma direccion.
drop policy if exists calificaciones_lectura on public.calificaciones;

create policy calificaciones_lectura on public.calificaciones
  for select to anon, authenticated
  using (
    (
      public.sucursal_publicada(sucursal_id)
      and public.sucursal_acepta_resenas(sucursal_id)
    )
    or public.posee_sucursal(sucursal_id)
    or public.es_admin()
  );

drop policy if exists calificaciones_crea_propia on public.calificaciones;

create policy calificaciones_crea_propia on public.calificaciones
  for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and public.es_cliente()
    and public.sucursal_publicada(sucursal_id)
    and public.sucursal_acepta_resenas(sucursal_id)
  );
