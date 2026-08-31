-- El aviso de reseña dice en qué sucursal fue.
--
-- Decia "Fulano te dejo una resena" y nada mas. Un negocio con cuatro locales
-- tenia que abrir el enlace para saber de cual le estaban hablando, y con varias
-- reseñas seguidas la lista era cuatro renglones iguales.
--
-- Tambien se corrigen los acentos: este texto se lee en el panel, no en un log.

create or replace function public.avisar_de_resena()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  duenio uuid;
  quien text;
  donde text;
  sucursal text;
begin
  select m.perfil_id, s.slug, s.nombre_sucursal
    into duenio, donde, sucursal
    from public.sucursales s
    join public.marcas m on m.id = s.marca_id
   where s.id = new.sucursal_id;

  if duenio is null then
    return new;
  end if;

  select p.nombre into quien from public.perfiles p where p.id = new.usuario_id;

  insert into public.notificaciones (perfil_id, tipo, titulo, detalle, enlace)
  values (
    duenio,
    'resena',
    coalesce(quien, 'Alguien') || ' dejó una reseña en ' || coalesce(sucursal, 'tu micrositio'),
    left(new.texto, 140),
    '/marca/' || donde
  );

  return new;
end;
$fn$;
