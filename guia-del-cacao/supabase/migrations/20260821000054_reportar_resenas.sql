-- Reportar una resena.
--
-- Cualquiera con sesion puede marcar una resena como ofensiva, falsa o spam, y
-- el administrador las ve juntas, arriba de todo en Moderacion, en vez de leer
-- todas las resenas de la plataforma para encontrar la mala. Sobre todo sirve
-- al negocio: es el primero en enterarse de una resena injusta y no puede
-- borrarla, solo responderla.
--
-- Un reporte por persona y resena. Lo ve quien lo hizo y el administrador;
-- nadie mas sabe quien reporto. Borrar la resena se lleva sus reportes; el
-- administrador tambien puede descartarlos y dejar la resena.
--
-- **`usuario_id` apunta a `auth.users`, no a `perfiles`, a proposito.** Con una
-- llave a perfiles habria un segundo camino de `resenas` a `perfiles_publicos`
-- (pasando por esta tabla) y PostgREST responderia PGRST201 a cada
-- `perfiles_publicos(nombre)` de las resenas: las listas saldrian vacias. Es el
-- tropiezo que AGENTS.md ya cuenta tres veces.

create table if not exists public.reportes_resena (
  resena_id  uuid not null references public.resenas (id) on delete cascade,
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  motivo     text not null check (motivo in ('ofensiva', 'falsa', 'spam', 'otro')),
  detalle    text check (char_length(detalle) <= 500),
  creado_en  timestamptz not null default now(),
  primary key (resena_id, usuario_id)
);

comment on table public.reportes_resena is
  'Reportes de resenas para el administrador. Uno por persona y resena. Ver migracion 000054.';

alter table public.reportes_resena enable row level security;

drop policy if exists reportes_lectura on public.reportes_resena;
create policy reportes_lectura on public.reportes_resena
  for select using (usuario_id = (select auth.uid()) or public.es_admin());

drop policy if exists reportes_crea_propio on public.reportes_resena;
create policy reportes_crea_propio on public.reportes_resena
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));

-- Descartar es del administrador. Quien reporto no lo retira: si se equivoco,
-- descartarlo cuesta un clic y evita que se use para ir y venir.
drop policy if exists reportes_descarta_admin on public.reportes_resena;
create policy reportes_descarta_admin on public.reportes_resena
  for delete using (public.es_admin());

-- Nadie se reporta a si mismo: si no le gusta su resena, la edita o la borra.
create or replace function public.no_reportar_lo_propio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.resenas r
     where r.id = new.resena_id and r.usuario_id = new.usuario_id
  ) then
    raise exception 'Es tu propia reseña: puedes editarla o borrarla.';
  end if;

  return new;
end;
$$;

drop trigger if exists al_reportar_no_lo_propio on public.reportes_resena;
create trigger al_reportar_no_lo_propio
  before insert on public.reportes_resena
  for each row execute function public.no_reportar_lo_propio();

-- Las resenas con reportes, para el administrador: cuantos, por que y cuando
-- llego el ultimo.
create or replace function public.resenas_reportadas()
returns table (
  resena_id uuid,
  reportes integer,
  motivos text[],
  detalles text[],
  ultimo timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador ve los reportes.';
  end if;

  return query
    select r.resena_id,
           count(*)::integer,
           array_agg(distinct r.motivo),
           array_remove(array_agg(r.detalle order by r.creado_en desc), null),
           max(r.creado_en)
      from public.reportes_resena r
     group by r.resena_id
     order by max(r.creado_en) desc;
end;
$$;

revoke all on function public.resenas_reportadas() from public, anon;
grant execute on function public.resenas_reportadas() to authenticated;
