-- Guía del Cacao — la solicitud de monedas cambia de forma
--
-- Antes el cliente marcaba que compro y el negocio decidia entre 1 y 3 monedas
-- a ojo. Ahora la solicitud lleva con que respaldarla, y cuanto vale queda
-- claro antes de que nadie decida:
--
--   1 moneda   por la compra
--   2 monedas  si ademas dejo resena
--   3 monedas  si el negocio quiere agregar una de su parte
--
-- La puerta de entrada sigue siendo el QR del negocio —a /monedas/{slug} no se
-- llega de otro modo—, y el comprobante con foto es opcional: ayuda a que le
-- crean, no es requisito.
--
-- El tope de 3 por persona, por marca y por dia (spec §5.4.6) no cambia, y es
-- el que hace que el maximo de una solicitud sean 3.

alter table public.solicitudes_puntos
  add column comprobante text,
  add column resena_id uuid references public.resenas (id) on delete set null;

comment on column public.solicitudes_puntos.comprobante is
  'Ruta en el bucket privado `comprobantes`. Opcional: es para que el negocio pueda verificar, no un requisito para pedir.';

comment on column public.solicitudes_puntos.resena_id is
  'La resena que se dejo junto con la solicitud, si se dejo. Es lo que justifica la segunda moneda. Queda en null si el cliente borra la resena: la solicitud ya resuelta no se toca.';

-- ---------------------------------------------------------------------------
-- Cuanto vale una solicitud
-- ---------------------------------------------------------------------------

-- Vive en la base y no solo en la pantalla porque la lee el panel del negocio
-- para sugerir el monto, y porque asi la regla se puede probar en SQL.
create or replace function public.monedas_sugeridas(p_solicitud uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $fn$
  select case when s.resena_id is not null then 2 else 1 end
    from public.solicitudes_puntos s
   where s.id = p_solicitud;
$fn$;

-- ---------------------------------------------------------------------------
-- El comprobante
-- ---------------------------------------------------------------------------

-- Bucket PRIVADO, a diferencia de los otros dos. Un ticket de compra puede
-- traer datos que no son de nadie mas: el nombre de quien pago, una tarjeta
-- terminada en, una direccion. Se ve con URL firmada y solo lo ven dos: quien
-- lo subio y el negocio al que se lo mando.
--
-- Convencion de rutas: `{usuario_id}/{sucursal_id}/{archivo}`. Las dos primeras
-- carpetas son la llave de permisos, una por cada lado del mostrador.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes',
  'comprobantes',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
);

create or replace function public.es_su_comprobante(ruta text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select (select auth.uid())::text = (storage.foldername(ruta))[1];
$fn$;

-- Compara como texto y luego convierte: si alguien inventa el nombre de la
-- carpeta, esto debe dar false, no reventar con un error de conversion.
create or replace function public.le_mandaron_el_comprobante(ruta text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  carpeta text := (storage.foldername(ruta))[2];
begin
  if carpeta !~ '^[0-9a-fA-F-]{36}$' then
    return false;
  end if;

  return public.posee_sucursal(carpeta::uuid);
end;
$fn$;

create policy "comprobantes lectura de los dos lados"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'comprobantes'
    and (
      public.es_su_comprobante(name)
      or public.le_mandaron_el_comprobante(name)
      or public.es_admin()
    )
  );

create policy "comprobantes alta del cliente"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comprobantes'
    and public.es_cliente()
    and public.es_su_comprobante(name)
  );

-- Borrar, solo quien lo subio: si se arrepintio de mandar su ticket, es suyo.
create policy "comprobantes borrado del cliente"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'comprobantes'
    and (public.es_su_comprobante(name) or public.es_admin())
  );
