-- La ruleta ya girada se encoge, y la de la demo gira sin guardar nada.
--
-- 1. `mi_giro_en(p_sucursal)` dice, para quien mira, su ultimo giro en esa
--    ruleta y si todavia puede girar hoy. El micrositio la usa para enseñar,
--    en vez de la rueda grande, un aviso chico con su premio cuando ya no le
--    toca girar.
--
-- 2. Un negocio de demostracion (`marcas.es_demo`) gira siempre, sin limite,
--    y **no guarda nada**: ni giro, ni premio, ni codigo que se pueda
--    canjear. Sirve para enseñar la ruleta las veces que haga falta sin
--    llenar «Mis premios» de vales de mentira.

create or replace function public.mi_giro_en(p_sucursal uuid)
returns table (premio text, es_premio boolean, codigo text, vence_en date,
               canjeado_en timestamptz, creado_en timestamptz, puede_girar boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with ruleta as (
    select r.frecuencia from public.ruletas r where r.sucursal_id = p_sucursal
  ),
  ultimo as (
    select g.* from public.giros g
     where g.sucursal_id = p_sucursal and g.usuario_id = (select auth.uid())
     order by g.creado_en desc
     limit 1
  )
  select u.premio, u.codigo is not null, u.codigo, u.vence_en, u.canjeado_en, u.creado_en,
         case
           when (select frecuencia from ruleta) = 'ilimitada' then true
           when (select frecuencia from ruleta) = 'una_vez' then false
           else (u.creado_en at time zone 'America/Mexico_City')::date
                <> (now() at time zone 'America/Mexico_City')::date
         end
    from ultimo u;
$$;

revoke all on function public.mi_giro_en(uuid) from public, anon;
grant execute on function public.mi_giro_en(uuid) to authenticated;

-- Girar: igual que en la 000062, salvo la demo, que gira siempre y no guarda.
create or replace function public.girar_ruleta(p_sucursal uuid)
returns table (gajo smallint, premio text, es_premio boolean, codigo text, vence_en date)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_ruleta public.ruletas%rowtype;
  v_demo boolean;
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
  v_total numeric;
  v_tiro numeric;
  v_gajo record;
  v_prefijo text;
  v_letras constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_codigo text;
  i int;
begin
  if v_usuario is null then
    raise exception 'Inicia sesión para girar la ruleta.';
  end if;

  if not exists (
    select 1 from public.perfiles p
     where p.id = v_usuario and p.rol_confirmado and p.rol in ('cliente', 'negocio')
  ) then
    raise exception 'Termina de crear tu cuenta para girar la ruleta.';
  end if;

  select coalesce(m.es_demo, false) into v_demo
    from public.sucursales s join public.marcas m on m.id = s.marca_id
   where s.id = p_sucursal;

  -- El dueño de la demo tambien la gira: es para enseñarla.
  if public.posee_sucursal(p_sucursal) and not v_demo then
    raise exception 'Es tu propia ruleta: gira la de otros negocios.';
  end if;

  select * into v_ruleta from public.ruletas r where r.sucursal_id = p_sucursal;
  if not found or not v_ruleta.activa
     or not exists (select 1 from public.sucursales s where s.id = p_sucursal and s.estado = 'publicado')
     or not public.sucursal_tiene_ruleta(p_sucursal) then
    raise exception 'Esta ruleta no está disponible ahora.';
  end if;

  if not v_demo then
    perform pg_advisory_xact_lock(hashtext(v_usuario::text || p_sucursal::text));

    if v_ruleta.frecuencia = 'una_vez' and exists (
      select 1 from public.giros g where g.sucursal_id = p_sucursal and g.usuario_id = v_usuario
    ) then
      raise exception 'Ya giraste esta ruleta: es una vez por persona.';
    end if;

    if v_ruleta.frecuencia = 'diaria' and exists (
      select 1 from public.giros g
       where g.sucursal_id = p_sucursal and g.usuario_id = v_usuario
         and (g.creado_en at time zone 'America/Mexico_City')::date = v_hoy
    ) then
      raise exception 'Ya giraste hoy. ¡Vuelve mañana por otro premio!';
    end if;
  end if;

  select coalesce(sum(g.probabilidad), 0) into v_total from public.gajos_de_ruleta(p_sucursal) g;
  if v_total <= 0 then
    raise exception 'Esta ruleta no está disponible ahora.';
  end if;

  v_tiro := random() * v_total;
  for v_gajo in
    select g.gajo, g.texto, g.probabilidad, g.es_premio
      from public.gajos_de_ruleta(p_sucursal) g order by g.gajo
  loop
    v_tiro := v_tiro - v_gajo.probabilidad;
    exit when v_tiro < 0;
  end loop;

  -- La demo contesta con un codigo de muestra que no existe en ningun lado.
  if v_demo then
    gajo := v_gajo.gajo;
    premio := v_gajo.texto;
    es_premio := v_gajo.es_premio;
    codigo := case when v_gajo.es_premio then 'DEMO-MUESTRA' end;
    vence_en := case when v_gajo.es_premio then v_hoy + v_ruleta.vigencia_dias end;
    return next;
    return;
  end if;

  if v_gajo.es_premio then
    select left(regexp_replace(upper(translate(coalesce(m.nombre_comercial, 'CACAO'),
             'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '[^A-Z]', '', 'g'), 3)
      into v_prefijo
      from public.sucursales s join public.marcas m on m.id = s.marca_id
     where s.id = p_sucursal;
    if coalesce(v_prefijo, '') = '' then v_prefijo := 'GDC'; end if;

    loop
      v_codigo := v_prefijo || '-';
      for i in 1..5 loop
        v_codigo := v_codigo || substr(v_letras, 1 + floor(random() * length(v_letras))::int, 1);
      end loop;
      exit when not exists (select 1 from public.giros g where g.codigo = v_codigo);
    end loop;
  end if;

  insert into public.giros (sucursal_id, usuario_id, orden, premio, codigo, vence_en)
  values (p_sucursal, v_usuario, v_gajo.gajo, v_gajo.texto, v_codigo,
          case when v_gajo.es_premio then v_hoy + v_ruleta.vigencia_dias end);

  gajo := v_gajo.gajo;
  premio := v_gajo.texto;
  es_premio := v_gajo.es_premio;
  codigo := v_codigo;
  vence_en := case when v_gajo.es_premio then v_hoy + v_ruleta.vigencia_dias end;
  return next;
end;
$$;

revoke all on function public.girar_ruleta(uuid) from public, anon;
grant execute on function public.girar_ruleta(uuid) to authenticated;

-- Lo que ya se habia girado en negocios de demostracion se borra: eran
-- pruebas, y no deben quedar como premios en la cuenta de nadie.
delete from public.giros g
 using public.sucursales s, public.marcas m
 where s.id = g.sucursal_id and m.id = s.marca_id and m.es_demo;
