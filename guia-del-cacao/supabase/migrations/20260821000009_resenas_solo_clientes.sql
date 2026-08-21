-- Guía del Cacao — reseñar es cosa de clientes
--
-- El spec §5.5 dice "cualquier Cliente puede dejar una reseña". La politica
-- anterior solo exigia que la resena fuera tuya y la sucursal estuviera
-- publicada, asi que un negocio podia reseniar a otro llamando al API directo.
--
-- La regla vale lo mismo que las demas, y por la misma razon vive aqui y no en
-- el frontend: la pantalla puede saltarse, la politica no.

create or replace function public.es_cliente()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.perfiles p
     where p.id = (select auth.uid())
       and p.rol = 'cliente'
  );
$fn$;

drop policy resenas_crea_propia on public.resenas;

create policy resenas_crea_propia on public.resenas
  for insert with check (
    usuario_id = (select auth.uid())
    and public.es_cliente()
    and public.sucursal_publicada(sucursal_id)
  );
