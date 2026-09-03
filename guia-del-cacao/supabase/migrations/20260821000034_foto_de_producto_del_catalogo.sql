-- La foto de un producto no se podia subir.
--
-- Desde la migracion 000022 el catalogo es de la marca y sus fotos van a
-- `catalogo/{marca_id}/…` — a proposito, para que borrar una sucursal no se
-- lleve por delante la foto de un producto que las demas siguen usando.
--
-- Lo que no se movio con ellas fue la politica del bucket, que sigue pidiendo
-- que la **primera carpeta sea el id de una sucursal suya**. Con la ruta nueva
-- la primera carpeta es la palabra "catalogo", que no es el id de nada, asi que
-- el storage rechazaba cada intento. En pantalla se veia como un "no se pudo
-- subir la foto" sin mas, y el producto se guardaba sin ella.
--
-- Aqui se acepta ademas la carpeta del catalogo, comprobando que la marca sea de
-- quien sube. Lo que ya funcionaba —logo, fondo, galeria, portadas de evento,
-- cupones, todo bajo `{sucursal_id}/…`— sigue igual.
create or replace function public.puede_escribir_en_micrositio(ruta text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    -- Lo de siempre: la primera carpeta es una sucursal suya.
    exists (
      select 1
        from public.sucursales s
        join public.marcas m on m.id = s.marca_id
       where m.perfil_id = (select auth.uid())
         and s.id::text = (storage.foldername(ruta))[1]
    )
    or
    -- El catalogo: `catalogo/{marca_id}/…`, con la marca suya. Se exige que la
    -- segunda carpeta sea un uuid valido antes de comparar, porque
    -- `'lo-que-sea'::uuid` revienta la consulta entera en vez de devolver falso.
    (
      (storage.foldername(ruta))[1] = 'catalogo'
      and (storage.foldername(ruta))[2] ~
          '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and exists (
        select 1
          from public.marcas m
         where m.perfil_id = (select auth.uid())
           and m.id::text = (storage.foldername(ruta))[2]
      )
    );
$$;

comment on function public.puede_escribir_en_micrositio(text) is
  'Quien puede escribir en el bucket `micrositios`: el dueno de la sucursal en `{sucursal_id}/…`, y el dueno de la marca en `catalogo/{marca_id}/…`. Las dos formas conviven desde que el catalogo paso a ser de la marca (000022).';
