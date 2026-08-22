\set ON_ERROR_STOP on
set client_min_messages to notice;

\echo '--- una sola resena por persona y por negocio ---'
begin;
  set local role postgres;
  delete from public.resenas where usuario_id='11111111-1111-1111-1111-111111111111' and sucursal_id='55555555-5555-5555-5555-555555555555';

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  insert into public.resenas (usuario_id, sucursal_id, texto)
  values ('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555555','La primera.');

  do $$
  begin
    insert into public.resenas (usuario_id, sucursal_id, texto)
    values ('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555555','La segunda.');
    raise notice 'FALLA  dejo dos resenas del mismo negocio';
  exception when others then
    raise notice 'OK     bloqueado (una por negocio): %', sqlerrm;
  end $$;

  do $$
  begin
    update public.resenas set texto='La corregida.'
     where usuario_id='11111111-1111-1111-1111-111111111111' and sucursal_id='55555555-5555-5555-5555-555555555555';
    raise notice 'FALLA  la cambio el mismo dia que la escribio';
  exception when others then
    raise notice 'OK     bloqueado (un cambio al dia): %', sqlerrm;
  end $$;

  set local role postgres;
  update public.resenas set fecha = now() - interval '2 days', fecha_edicion = null
   where usuario_id='11111111-1111-1111-1111-111111111111' and sucursal_id='55555555-5555-5555-5555-555555555555';

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  do $$
  begin
    update public.resenas set texto='La corregida al otro dia.'
     where usuario_id='11111111-1111-1111-1111-111111111111' and sucursal_id='55555555-5555-5555-5555-555555555555';
    raise notice 'OK     al otro dia si la pudo cambiar';
  exception when others then
    raise notice 'FALLA  no la pudo cambiar al otro dia: %', sqlerrm;
  end $$;
rollback;

\echo '--- la calificacion ahora se corrige, pero una vez al dia ---'
begin;
  set local role postgres;
  delete from public.calificaciones where usuario_id='11111111-1111-1111-1111-111111111111' and sucursal_id='55555555-5555-5555-5555-555555555555';

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  insert into public.calificaciones (usuario_id, sucursal_id, estrellas)
  values ('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555555',2);

  do $$
  begin
    update public.calificaciones set estrellas=5
     where usuario_id='11111111-1111-1111-1111-111111111111' and sucursal_id='55555555-5555-5555-5555-555555555555';
    raise notice 'FALLA  la cambio el mismo dia';
  exception when others then
    raise notice 'OK     bloqueado (un cambio al dia): %', sqlerrm;
  end $$;

  set local role postgres;
  update public.calificaciones set fecha = now() - interval '2 days'
   where usuario_id='11111111-1111-1111-1111-111111111111' and sucursal_id='55555555-5555-5555-5555-555555555555';

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  do $$
  declare cuantas smallint;
  begin
    update public.calificaciones set estrellas=5
     where usuario_id='11111111-1111-1111-1111-111111111111' and sucursal_id='55555555-5555-5555-5555-555555555555';
    select estrellas into cuantas from public.calificaciones
     where usuario_id='11111111-1111-1111-1111-111111111111' and sucursal_id='55555555-5555-5555-5555-555555555555';
    if cuantas = 5 then
      raise notice 'OK     al otro dia corrigio su nota de 2 a 5';
    else
      raise notice 'FALLA  la nota quedo en %', cuantas;
    end if;
  exception when others then
    raise notice 'FALLA  no pudo corregir al otro dia: %', sqlerrm;
  end $$;
rollback;

\echo '--- los buckets aceptan video ---'
do $$
declare tope bigint; tipos text[];
begin
  select file_size_limit, allowed_mime_types into tope, tipos
    from storage.buckets where id = 'resenas';
  if tope = 20971520 and 'video/mp4' = any(tipos) then
    raise notice 'OK     el bucket de resenas acepta video de hasta 20 MB';
  else
    raise notice 'FALLA  tope % tipos %', tope, tipos;
  end if;
end $$;
