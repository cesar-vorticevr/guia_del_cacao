-- Guía del Cacao — almacenamiento de imágenes
--
-- Un solo bucket para las imágenes de los micrositios: logo, imagen de fondo y
-- fotos del catálogo. Es público de lectura porque el directorio las muestra a
-- cualquier visitante; lo que se controla es quién puede escribir.
--
-- Convención de rutas: `{sucursal_id}/{archivo}`. La primera carpeta es la
-- llave de permisos — solo el dueño de esa sucursal escribe dentro.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'micrositios',
  'micrositios',
  true,
  5242880, -- 5 MB: son fotos de negocio, no material de imprenta
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
);

-- Compara como texto y no como uuid a propósito: si alguien sube un archivo a
-- una carpeta con nombre inventado, esto debe dar `false`, no reventar con un
-- error de conversión.
create or replace function public.puede_escribir_en_micrositio(ruta text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1
      from public.sucursales s
      join public.marcas m on m.id = s.marca_id
     where m.perfil_id = (select auth.uid())
       and s.id::text = (storage.foldername(ruta))[1]
  );
$fn$;

create policy "micrositios lectura publica"
  on storage.objects for select
  using (bucket_id = 'micrositios');

create policy "micrositios alta del dueno"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'micrositios'
    and public.puede_escribir_en_micrositio(name)
  );

create policy "micrositios cambio del dueno"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'micrositios'
    and public.puede_escribir_en_micrositio(name)
  );

create policy "micrositios borrado del dueno"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'micrositios'
    and public.puede_escribir_en_micrositio(name)
  );
