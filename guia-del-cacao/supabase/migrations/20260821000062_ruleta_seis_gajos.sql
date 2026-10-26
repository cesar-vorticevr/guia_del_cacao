-- La ruleta pasa a seis gajos, con «Suerte para la próxima», y la giran
-- tambien los negocios.
--
-- 1. Seis gajos. El negocio llena hasta seis, cada uno con su probabilidad, y
--    cualquiera puede ser «Suerte para la próxima» (`es_premio = false`). Los
--    que deje vacios se llenan segun `ruletas.relleno`:
--    - `suerte`: con «Suerte para la próxima»; se reparten lo que le falte a
--      la suma para llegar a 100.
--    - `repetir`: repitiendo sus premios en orden; cada premio reparte su
--      probabilidad entre sus copias, asi que repetir no cambia el chance.
--    La rueda que se ve y el tiro salen de la misma funcion,
--    `gajos_de_ruleta`: la flecha cae en el gajo que la base eligio.
--
-- 2. «Suerte para la próxima» tambien cuenta como giro —para «una vez» y «una
--    al dia»— pero no deja codigo ni premio que canjear.
--
-- 3. Gira cualquiera con sesion y rol elegido, cliente o negocio, menos el
--    dueño de esa ruleta. Mas interaccion entre negocios.

alter table public.ruletas
  add column if not exists relleno text not null default 'suerte'
  check (relleno in ('suerte', 'repetir'));

-- Las ruletas que ya existian repetian sus premios en la rueda: lo siguen
-- haciendo. Con «suerte», una ruleta cuyos premios suman 100 enseñaria gajos
-- de suerte que nunca salen.
update public.ruletas set relleno = 'repetir';

alter table public.premios_ruleta
  add column if not exists es_premio boolean not null default true;

alter table public.premios_ruleta
  drop constraint if exists premios_ruleta_orden_check;
alter table public.premios_ruleta
  add constraint premios_ruleta_orden_check check (orden between 1 and 6);

alter table public.premios_ruleta
  drop constraint if exists premios_ruleta_probabilidad_check;
alter table public.premios_ruleta
  alter column probabilidad type numeric(5, 2);
alter table public.premios_ruleta
  add constraint premios_ruleta_probabilidad_check check (probabilidad > 0 and probabilidad <= 100);

-- Un giro de «suerte» no tiene codigo ni vencimiento.
alter table public.giros alter column codigo drop not null;
alter table public.giros alter column vence_en drop not null;

-- Los seis gajos de una ruleta, ya con su relleno. Es la unica fuente: la
-- pinta el micrositio y la usa `girar_ruleta` para tirar.
create or replace function public.gajos_de_ruleta(p_sucursal uuid)
returns table (gajo smallint, texto text, probabilidad numeric, es_premio boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_relleno text;
  v_puestos int;
  v_suma numeric;
  v_resto numeric;
  r record;
  v_copias int;
  i int;
begin
  select ru.relleno into v_relleno from public.ruletas ru where ru.sucursal_id = p_sucursal;
  if not found then return; end if;

  select count(*), coalesce(sum(p.probabilidad), 0) into v_puestos, v_suma
    from public.premios_ruleta p where p.sucursal_id = p_sucursal;
  if v_puestos = 0 then return; end if;

  if v_relleno = 'repetir' or v_puestos = 6 then
    -- Cada puesto sale en los gajos i, i+n, i+2n…; su probabilidad se reparte
    -- entre sus copias para que repetir no cambie el chance.
    for r in
      select row_number() over (order by p.orden) as n, p.texto, p.probabilidad, p.es_premio
        from public.premios_ruleta p where p.sucursal_id = p_sucursal order by p.orden
    loop
      v_copias := ceil((6 - r.n + 1)::numeric / v_puestos);
      i := r.n;
      while i <= 6 loop
        gajo := i; texto := r.texto; es_premio := r.es_premio;
        probabilidad := r.probabilidad / v_copias;
        return next;
        i := i + v_puestos;
      end loop;
    end loop;
    return;
  end if;

  -- Relleno con suerte: los puestos en sus gajos y la suerte en los demas, con
  -- lo que le falte a la suma para llegar a cien repartido entre ellos.
  v_resto := greatest(100 - v_suma, 0) / (6 - v_puestos);
  i := 0;
  for r in
    select p.texto, p.probabilidad, p.es_premio
      from public.premios_ruleta p where p.sucursal_id = p_sucursal order by p.orden
  loop
    i := i + 1;
    gajo := i; texto := r.texto; probabilidad := r.probabilidad; es_premio := r.es_premio;
    return next;
  end loop;
  while i < 6 loop
    i := i + 1;
    gajo := i; texto := 'Suerte para la próxima'; probabilidad := v_resto; es_premio := false;
    return next;
  end loop;
end;
$$;

-- Girar: cualquiera con su rol elegido, menos el dueño. El tiro va sobre los
-- seis gajos y devuelve en cual cayo, para que la rueda pare ahi.
drop function if exists public.girar_ruleta(uuid);
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

  if public.posee_sucursal(p_sucursal) then
    raise exception 'Es tu propia ruleta: gira la de otros negocios.';
  end if;

  select * into v_ruleta from public.ruletas r where r.sucursal_id = p_sucursal;
  if not found or not v_ruleta.activa
     or not exists (select 1 from public.sucursales s where s.id = p_sucursal and s.estado = 'publicado')
     or not public.sucursal_tiene_ruleta(p_sucursal) then
    raise exception 'Esta ruleta no está disponible ahora.';
  end if;

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

-- «Mis premios» y lo repartido son solo los premios de verdad, no la suerte.
create or replace function public.mis_premios()
returns table (
  codigo text, premio text, vence_en date, canjeado_en timestamptz, creado_en timestamptz,
  marca text, sucursal text, slug text
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.codigo, g.premio, g.vence_en, g.canjeado_en, g.creado_en,
         m.nombre_comercial, s.nombre_sucursal, s.slug
    from public.giros g
    join public.sucursales s on s.id = g.sucursal_id
    join public.marcas m on m.id = s.marca_id
   where g.usuario_id = (select auth.uid())
     and g.codigo is not null
   order by g.creado_en desc;
$$;

create or replace function public.premios_entregados(p_sucursal uuid)
returns table (
  codigo text, premio text, vence_en date, canjeado_en timestamptz, creado_en timestamptz,
  cliente text
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.codigo, g.premio, g.vence_en, g.canjeado_en, g.creado_en,
         coalesce(p.nombre, 'Un visitante')
    from public.giros g
    left join public.perfiles p on p.id = g.usuario_id
   where g.sucursal_id = p_sucursal
     and g.codigo is not null
     and (public.posee_sucursal(p_sucursal) or public.es_admin())
   order by g.creado_en desc
   limit 200;
$$;

revoke all on function public.girar_ruleta(uuid) from public, anon;
grant execute on function public.girar_ruleta(uuid) to authenticated;
grant execute on function public.gajos_de_ruleta(uuid) to anon, authenticated;
