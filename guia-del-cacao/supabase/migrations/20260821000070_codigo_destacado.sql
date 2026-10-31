-- El codigo «destacado» del vendedor.
--
-- Cada cuenta de ventas tiene ahora DOS codigos y elige cual darle a cada
-- negocio:
--
-- - `codigo` (LUCIA-7K2P): 15% de descuento en el primer pago, como siempre.
-- - `codigo_destacado` (TOP-LUCIA-7K2): sin descuento; el negocio sale en la
--   seccion «Destacados» de la portada durante `meses_de_destacado()` (tres)
--   desde que lo pone.
--
-- Con cualquiera de los dos el vendedor gana su 25% de cada cobro: la
-- comision no cambia, `registrar_comision` solo mira que haya un referido.
-- `referidos.tipo` dice cual se puso. Por eso `codigo_de_embajador_de`, que es
-- lo que le pone el cupon de Stripe al primer pago, solo devuelve los de
-- descuento.
--
-- **Destacado se deriva, no se guarda**: sale de `referidos.vinculado_en` mas
-- tres meses (`sucursales_destacadas()`). Una columna «destacada» habria que
-- apagarla al vencer, y el dia que fallara ese proceso el negocio seguiria
-- destacado gratis para siempre.
--
-- ¿Por que hace falta una seccion propia? Desde la migracion 000068 todos los
-- negocios —Gratis y Pro— salen en el banner, asi que «estar en el banner» ya
-- no distingue a nadie.

-- ---------------------------------------------------------------- el codigo
alter table public.embajadores
  add column if not exists codigo_destacado text;

create unique index if not exists embajadores_codigo_destacado_unico
  on public.embajadores (public.normalizar_codigo(codigo_destacado))
  where codigo_destacado is not null;

comment on column public.embajadores.codigo_destacado is
  'El segundo codigo del vendedor: sin descuento, deja al negocio en «Destacados» tres meses. Ver migracion 000070.';

-- Cuanto dura destacado. `lib/precios.ts` lo repite (`MESES_DE_DESTACADO`).
create or replace function public.meses_de_destacado()
returns integer language sql immutable set search_path = '' as $$ select 3; $$;

-- TOP-, el primer nombre y tres caracteres sin los que se confunden al
-- dictarlos. El prefijo es lo que lo distingue a simple vista del de
-- descuento, que es NOMBRE-XXXX.
create or replace function public.inventar_codigo_destacado(p_nombre text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_base text;
  v_letras constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_codigo text;
  i int;
begin
  v_base := upper(translate(split_part(trim(coalesce(p_nombre, '')), ' ', 1),
                            'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'));
  v_base := left(regexp_replace(v_base, '[^A-Z]', '', 'g'), 8);
  if v_base = '' then v_base := 'CACAO'; end if;

  loop
    v_codigo := 'TOP-' || v_base || '-';
    for i in 1..3 loop
      v_codigo := v_codigo || substr(v_letras, 1 + floor(random() * length(v_letras))::int, 1);
    end loop;

    exit when not exists (
      select 1 from public.embajadores e
       where public.normalizar_codigo(e.codigo) = public.normalizar_codigo(v_codigo)
          or public.normalizar_codigo(e.codigo_destacado) = public.normalizar_codigo(v_codigo)
    ) and not exists (
      select 1 from public.convenios c
       where public.normalizar_codigo(c.codigo) = public.normalizar_codigo(v_codigo)
    );
  end loop;

  return v_codigo;
end;
$$;

revoke all on function public.inventar_codigo_destacado(text) from public, anon, authenticated;

-- Los vendedores de hoy estrenan el suyo.
update public.embajadores e
   set codigo_destacado = public.inventar_codigo_destacado(p.nombre)
  from public.perfiles p
 where p.id = e.perfil_id
   and e.codigo is not null
   and e.codigo_destacado is null;

-- Dar de alta tambien da el codigo destacado.
create or replace function public.asignar_embajador(p_perfil uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text;
  v_destacado text;
  v_nombre text;
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador da de alta cuentas de ventas.';
  end if;

  select p.nombre into v_nombre from public.perfiles p where p.id = p_perfil;

  if not found then
    raise exception 'Esa cuenta no existe.';
  end if;

  select e.codigo, e.codigo_destacado into v_codigo, v_destacado
    from public.embajadores e where e.perfil_id = p_perfil;

  if v_codigo is null then
    v_codigo := public.inventar_codigo_de_embajador(v_nombre);
  end if;

  if v_destacado is null then
    v_destacado := public.inventar_codigo_destacado(v_nombre);
  end if;

  insert into public.embajadores (perfil_id, estado, codigo, codigo_destacado, aprobado_en)
  values (p_perfil, 'activo', v_codigo, v_destacado, now())
  on conflict (perfil_id) do update
     set estado = 'activo',
         codigo = excluded.codigo,
         codigo_destacado = excluded.codigo_destacado,
         aprobado_en = coalesce(public.embajadores.aprobado_en, now());

  return v_codigo;
end;
$$;

-- El codigo destacado tampoco lo cambia el vendedor.
create or replace function public.proteger_embajador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.es_admin() or (select auth.uid()) is null then
    return new;
  end if;

  if new.estado is distinct from old.estado
     or new.codigo is distinct from old.codigo
     or new.codigo_destacado is distinct from old.codigo_destacado
     or new.aprobado_en is distinct from old.aprobado_en
     or new.perfil_id is distinct from old.perfil_id
     or new.solicitado_en is distinct from old.solicitado_en
     or new.comision_hasta is distinct from old.comision_hasta then
    raise exception 'Solo el administrador cambia el estado, el código o la vigencia de un vendedor.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------- el referido
alter table public.referidos
  add column if not exists tipo text not null default 'descuento'
  check (tipo in ('descuento', 'destacado'));

comment on column public.referidos.tipo is
  'Que codigo puso el negocio: el de descuento o el destacado. Ver migracion 000070.';

/**
 * De quien es un codigo y de que tipo. Solo consulta: lo usa «¿Tienes un
 * codigo?» para enseñar la oferta antes de contratar. Nada si no es de un
 * vendedor activo (entonces puede ser un convenio).
 */
create or replace function public.codigo_de_asesor(p_codigo text)
returns table (nombre text, tipo text)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p.nombre, 'un asesor'),
         case when public.normalizar_codigo(e.codigo_destacado) = public.normalizar_codigo(p_codigo)
              then 'destacado' else 'descuento' end
    from public.embajadores e
    join public.perfiles p on p.id = e.perfil_id
   where e.estado = 'activo'
     and (
       (e.codigo is not null
        and public.normalizar_codigo(e.codigo) = public.normalizar_codigo(p_codigo))
       or (e.codigo_destacado is not null
        and public.normalizar_codigo(e.codigo_destacado) = public.normalizar_codigo(p_codigo))
     )
   limit 1;
$$;

revoke all on function public.codigo_de_asesor(text) from public, anon;
grant execute on function public.codigo_de_asesor(text) to authenticated;

-- Igual que en la 000059, pero acepta los dos codigos y anota cual fue. Las
-- reglas no cambian: ni el propio, ni un segundo vendedor, ni una marca que
-- ya pago (el vendedor gana de cada cobro: quien ya pagaba no lo trajo el).
create or replace function public.vincular_embajador(p_marca uuid, p_codigo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_embajador uuid;
  v_nombre text;
  v_tipo text;
  v_actual uuid;
  v_tipo_actual text;
begin
  if not public.posee_marca(p_marca) then
    raise exception 'Ese negocio no es tuyo.';
  end if;

  select e.perfil_id, coalesce(p.nombre, 'un embajador'),
         case when public.normalizar_codigo(e.codigo_destacado) = public.normalizar_codigo(p_codigo)
              then 'destacado' else 'descuento' end
    into v_embajador, v_nombre, v_tipo
    from public.embajadores e
    join public.perfiles p on p.id = e.perfil_id
   where e.estado = 'activo'
     and (
       (e.codigo is not null
        and public.normalizar_codigo(e.codigo) = public.normalizar_codigo(p_codigo))
       or (e.codigo_destacado is not null
        and public.normalizar_codigo(e.codigo_destacado) = public.normalizar_codigo(p_codigo))
     );

  if v_embajador is null then
    return null;
  end if;

  if v_embajador = (select auth.uid()) then
    raise exception 'Es tu propio código de embajador: compártelo con otros negocios.';
  end if;

  select r.embajador_id, r.tipo into v_actual, v_tipo_actual
    from public.referidos r where r.marca_id = p_marca;

  if v_actual = v_embajador and v_tipo_actual = v_tipo then
    return v_nombre;
  elsif v_actual = v_embajador then
    raise exception 'Tu negocio ya tiene el otro código de este asesor. Es uno u otro: descuento o destacado.';
  elsif v_actual is not null then
    raise exception 'Tu negocio ya tiene un código de embajador.';
  end if;

  if public.marca_ya_pago(p_marca) then
    raise exception 'El código de embajador es para negocios que todavía no pagan, y tu negocio ya pagó antes.';
  end if;

  insert into public.referidos (marca_id, embajador_id, tipo) values (p_marca, v_embajador, v_tipo);
  return v_nombre;
end;
$$;

-- El cupon de Stripe es solo para quien puso el de descuento.
create or replace function public.codigo_de_embajador_de(p_marca uuid)
returns table (codigo text, embajador text, embajador_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select e.codigo, coalesce(p.nombre, 'un embajador'), e.perfil_id
    from public.referidos r
    join public.embajadores e on e.perfil_id = r.embajador_id
    join public.perfiles p on p.id = e.perfil_id
   where r.marca_id = p_marca
     and r.tipo = 'descuento'
     and r.monto_pagado is null
     and e.estado = 'activo'
     and (public.posee_marca(p_marca) or public.es_admin() or (select auth.uid()) is null);
$$;

-- ---------------------------------------------------------------- destacados
/**
 * Las sucursales publicadas cuya marca puso un codigo destacado hace menos de
 * tres meses, y hasta cuando les dura. Publica: es lo que pinta la portada.
 *
 * No mira si el vendedor sigue activo: lo destacado es del negocio, que ya lo
 * recibio, y pausar a un vendedor no se lo quita.
 */
create or replace function public.sucursales_destacadas()
returns table (sucursal_id uuid, hasta timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, r.vinculado_en + make_interval(months => public.meses_de_destacado())
    from public.referidos r
    join public.sucursales s on s.marca_id = r.marca_id
   where r.tipo = 'destacado'
     and s.estado = 'publicado'
     and r.vinculado_en + make_interval(months => public.meses_de_destacado()) > now()
   order by r.vinculado_en desc;
$$;

revoke all on function public.sucursales_destacadas() from public;
grant execute on function public.sucursales_destacadas() to anon, authenticated;

/** Hasta cuando esta destacada una marca, para su dueno. Null si no lo esta. */
create or replace function public.destacada_hasta(p_marca uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select r.vinculado_en + make_interval(months => public.meses_de_destacado())
    from public.referidos r
   where r.marca_id = p_marca
     and r.tipo = 'destacado'
     and r.vinculado_en + make_interval(months => public.meses_de_destacado()) > now()
     and (public.posee_marca(p_marca) or public.es_admin());
$$;

revoke all on function public.destacada_hasta(uuid) from public, anon;
grant execute on function public.destacada_hasta(uuid) to authenticated;

-- ---------------------------------------------------------------- el tablero
-- Lo mismo de la 000067 mas el tipo de codigo de cada negocio, para que el
-- vendedor vea a quien dio cual. Cambia lo que devuelve, asi que se recrea.
drop function if exists public.mis_referidos();

create function public.mis_referidos()
returns table (
  marca text,
  vinculado_en timestamptz,
  cobros integer,
  total_pagado numeric,
  total_comision numeric,
  por_cobrar numeric,
  ultimo_cobro timestamptz,
  sigue_pagando boolean,
  tipo text
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.nombre_comercial,
         r.vinculado_en,
         count(c.id)::integer,
         coalesce(sum(c.monto_pagado), 0),
         coalesce(sum(c.comision), 0),
         coalesce(sum(c.comision) filter (where c.pago_id is null), 0),
         max(c.cobrado_en),
         exists (
           select 1 from public.suscripciones su
             join public.sucursales s on s.id = su.sucursal_id
            where s.marca_id = r.marca_id and su.estado = 'activo' and su.monto_por_cobro > 0
         ),
         r.tipo
    from public.referidos r
    join public.marcas m on m.id = r.marca_id
    left join public.comisiones c on c.marca_id = r.marca_id and c.embajador_id = r.embajador_id
   where r.embajador_id = (select auth.uid())
   group by m.nombre_comercial, r.vinculado_en, r.marca_id, r.tipo
   order by r.vinculado_en desc;
$$;

revoke all on function public.mis_referidos() from public, anon;
grant execute on function public.mis_referidos() to authenticated;
