-- Un solo plan de pago, y los Embajadores del Cacao.
--
-- 1. Precios (octubre de 2026). Queda el Gratis, que ahora dura quince dias, y
--    un solo plan de pago: el Pro, a $499 al mes o $4,990 al anio (diez
--    mensualidades, la regla de la 000055 no cambia). El Basico deja de
--    ofrecerse pero no se borra: quien ya lo paga lo conserva, con su precio,
--    porque `proteger_precio_de_suscripcion` no deja tocar una suscripcion
--    abierta. `tiers.se_ofrece` es lo que la pantalla lee para listar planes.
--
-- 2. Embajadores. Cualquier cuenta pide serlo y el administrador la aprueba;
--    al aprobarla nace su codigo. Un negocio que pone ese codigo recibe 20% de
--    descuento en su **primer** pago, y el embajador gana 20% de lo que ese
--    negocio pago de verdad. A fin de mes el administrador le transfiere lo
--    acumulado y lo anota aqui.
--
--    Tres tablas:
--    - `embajadores`: la solicitud, el codigo y la CLABE donde se le paga.
--    - `referidos`: que negocio llego con que codigo. Una fila por marca y para
--      siempre: el descuento es del primer pago, y una marca no tiene dos.
--      Nace al poner el codigo, sin monto; el monto y la comision se llenan
--      cuando Stripe confirma el cobro.
--    - `pagos_a_embajadores`: cada transferencia del administrador. Al
--      registrarla se le cuelgan las comisiones que cubre.
--
--    Nada de esto se escribe desde la aplicacion con permisos de usuario mas
--    alla de pedir ser embajador y anotar su CLABE: vincular un codigo,
--    registrar una comision, aprobar y pagar son funciones `security definer`
--    que comprueban quien llama.

-- ---------------------------------------------------------------------------
-- 1. Plan unico
-- ---------------------------------------------------------------------------

alter table public.tiers
  add column if not exists se_ofrece boolean not null default true;

comment on column public.tiers.se_ofrece is
  'Si se puede contratar hoy. Un plan que deja de ofrecerse se queda para quien ya lo paga. Ver migracion 000059.';

update public.tiers set precio_mensual = 499 where id = 3;
update public.tiers set se_ofrece = false where id = 2;

-- Cuanto dura el plan Gratis. `lib/precios.ts` lo repite (`DIAS_GRATIS`).
create or replace function public.dias_gratis()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 15;
$$;

-- No se abre una suscripcion nueva en un plan que ya no se ofrece. Las que ya
-- estaban no pasan por aqui: es un trigger de insert.
create or replace function public.exigir_plan_ofrecido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.tiers t where t.id = new.tier_id and t.se_ofrece) then
    -- Cambiar de plan cierra la fila vieja y abre otra con el mismo plan: eso
    -- no es contratar, es conservar lo que ya tenia.
    if exists (
      select 1 from public.suscripciones s
       where s.sucursal_id = new.sucursal_id and s.tier_id = new.tier_id
    ) then
      return new;
    end if;

    raise exception 'Ese plan ya no se ofrece. Elige otro.';
  end if;

  return new;
end;
$$;

drop trigger if exists al_abrir_plan_ofrecido on public.suscripciones;
create trigger al_abrir_plan_ofrecido
  before insert on public.suscripciones
  for each row execute function public.exigir_plan_ofrecido();

-- ---------------------------------------------------------------------------
-- 2. Embajadores
-- ---------------------------------------------------------------------------

-- El 20% de los dos lados. `lib/embajadores.ts` los repite para enseñarlos.
create or replace function public.descuento_de_embajador()
returns numeric language sql immutable set search_path = '' as $$ select 20::numeric; $$;

create or replace function public.comision_de_embajador()
returns numeric language sql immutable set search_path = '' as $$ select 20::numeric; $$;

create table if not exists public.embajadores (
  perfil_id     uuid primary key references public.perfiles (id) on delete cascade,
  estado        text not null default 'solicitado'
                check (estado in ('solicitado', 'activo', 'pausado', 'rechazado')),
  -- Se guarda como se ensena (CESAR-7K2P) y se compara normalizado.
  codigo        text,
  motivo        text check (char_length(motivo) <= 500),
  titular       text check (char_length(titular) <= 120),
  banco         text check (char_length(banco) <= 60),
  clabe         text check (clabe ~ '^[0-9]{18}$'),
  solicitado_en timestamptz not null default now(),
  aprobado_en   timestamptz
);

create unique index if not exists embajadores_codigo_unico
  on public.embajadores (public.normalizar_codigo(codigo))
  where codigo is not null;

comment on table public.embajadores is
  'Embajadores del Cacao: la solicitud, el codigo y a donde se les paga. Ver migracion 000059.';

create table if not exists public.pagos_a_embajadores (
  id           uuid primary key default gen_random_uuid(),
  embajador_id uuid not null references public.embajadores (perfil_id) on delete restrict,
  monto        numeric(10, 2) not null check (monto > 0),
  referencia   text check (char_length(referencia) <= 120),
  pagado_en    timestamptz not null default now()
);

create index if not exists pagos_a_embajadores_embajador_idx
  on public.pagos_a_embajadores (embajador_id, pagado_en desc);

create table if not exists public.referidos (
  marca_id               uuid primary key references public.marcas (id) on delete cascade,
  embajador_id           uuid not null references public.embajadores (perfil_id) on delete restrict,
  vinculado_en           timestamptz not null default now(),
  -- Lo de abajo se llena cuando el negocio paga por primera vez.
  monto_pagado           numeric(10, 2) check (monto_pagado >= 0),
  comision               numeric(10, 2) check (comision >= 0),
  pagado_en              timestamptz,
  stripe_subscription_id text,
  -- La transferencia que la cubrio. Null: todavia se le debe.
  pago_id                uuid references public.pagos_a_embajadores (id) on delete set null
);

create index if not exists referidos_embajador_idx
  on public.referidos (embajador_id, pagado_en desc);

comment on table public.referidos is
  'Que negocio llego con que codigo de embajador, y la comision de su primer pago. Una fila por marca. Ver migracion 000059.';

alter table public.embajadores enable row level security;
alter table public.pagos_a_embajadores enable row level security;
alter table public.referidos enable row level security;

-- Cada quien ve lo suyo; el administrador, todo.
drop policy if exists embajadores_lectura on public.embajadores;
create policy embajadores_lectura on public.embajadores
  for select using (perfil_id = (select auth.uid()) or public.es_admin());

-- Pedir ser embajador: una fila propia, en `solicitado` y sin codigo.
drop policy if exists embajadores_solicita on public.embajadores;
create policy embajadores_solicita on public.embajadores
  for insert to authenticated
  with check (perfil_id = (select auth.uid()) and estado = 'solicitado' and codigo is null);

-- Su CLABE y su motivo los edita el propio embajador; lo demas lo protege el
-- trigger de abajo.
drop policy if exists embajadores_edita on public.embajadores;
create policy embajadores_edita on public.embajadores
  for update using (perfil_id = (select auth.uid()) or public.es_admin());

drop policy if exists pagos_embajador_lectura on public.pagos_a_embajadores;
create policy pagos_embajador_lectura on public.pagos_a_embajadores
  for select using (embajador_id = (select auth.uid()) or public.es_admin());

drop policy if exists referidos_lectura on public.referidos;
create policy referidos_lectura on public.referidos
  for select using (embajador_id = (select auth.uid()) or public.es_admin());

-- Sin politicas de escritura en `referidos` ni en `pagos_a_embajadores`: las
-- escriben solo las funciones de abajo. La ausencia es la regla.

-- Un embajador no se aprueba solo ni se inventa su codigo.
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
     or new.aprobado_en is distinct from old.aprobado_en
     or new.perfil_id is distinct from old.perfil_id
     or new.solicitado_en is distinct from old.solicitado_en then
    raise exception 'Solo el administrador cambia el estado o el código de un embajador.';
  end if;

  return new;
end;
$$;

drop trigger if exists al_editar_proteger_embajador on public.embajadores;
create trigger al_editar_proteger_embajador
  before update on public.embajadores
  for each row execute function public.proteger_embajador();

-- El codigo: el primer nombre, en mayusculas y sin acentos, y cuatro
-- caracteres al azar sin los que se confunden al dictarlo (0/O, 1/I/L).
create or replace function public.inventar_codigo_de_embajador(p_nombre text)
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
    v_codigo := v_base || '-';
    for i in 1..4 loop
      v_codigo := v_codigo || substr(v_letras, 1 + floor(random() * length(v_letras))::int, 1);
    end loop;

    -- Ni otro embajador ni un convenio pueden tener el mismo.
    exit when not exists (
      select 1 from public.embajadores e
       where public.normalizar_codigo(e.codigo) = public.normalizar_codigo(v_codigo)
    ) and not exists (
      select 1 from public.convenios c
       where public.normalizar_codigo(c.codigo) = public.normalizar_codigo(v_codigo)
    );
  end loop;

  return v_codigo;
end;
$$;

-- El administrador decide. Aprobar da codigo (si no tenia); pausar lo apaga
-- sin borrarlo; rechazar cierra la solicitud.
create or replace function public.decidir_embajador(p_perfil uuid, p_estado text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text;
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador decide quién es embajador.';
  end if;

  if p_estado not in ('activo', 'pausado', 'rechazado') then
    raise exception 'Estado de embajador desconocido.';
  end if;

  select e.codigo into v_codigo from public.embajadores e where e.perfil_id = p_perfil;
  if not found then
    raise exception 'Esa persona no ha pedido ser embajadora.';
  end if;

  if p_estado = 'activo' and v_codigo is null then
    select public.inventar_codigo_de_embajador(p.nombre) into v_codigo
      from public.perfiles p where p.id = p_perfil;
  end if;

  update public.embajadores
     set estado = p_estado,
         codigo = v_codigo,
         aprobado_en = case when p_estado = 'activo' then coalesce(aprobado_en, now()) else aprobado_en end
   where perfil_id = p_perfil;

  return v_codigo;
end;
$$;

-- ¿Es codigo de un embajador activo? Devuelve su nombre, o null si no lo es,
-- para que la aplicacion siga probando con los convenios. No aparta nada.
create or replace function public.embajador_del_codigo(p_codigo text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p.nombre, 'un embajador')
    from public.embajadores e
    join public.perfiles p on p.id = e.perfil_id
   where e.estado = 'activo'
     and e.codigo is not null
     and public.normalizar_codigo(e.codigo) = public.normalizar_codigo(p_codigo)
   limit 1;
$$;

-- La marca ya pago alguna vez: tiene cliente de Stripe o una suscripcion
-- pagada. El descuento de embajador es para el primer pago.
create or replace function public.marca_ya_pago(p_marca uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.marcas m where m.id = p_marca and m.stripe_customer_id is not null
  ) or exists (
    select 1
      from public.suscripciones s
      join public.sucursales su on su.id = s.sucursal_id
     where su.marca_id = p_marca
       and (s.stripe_subscription_id is not null or s.estado = 'activo')
  );
$$;

-- El negocio pone un codigo de embajador: su marca queda vinculada para su
-- primer pago. Devuelve el nombre del embajador; null si el codigo no es de
-- ningun embajador (entonces puede ser un convenio).
create or replace function public.vincular_embajador(p_marca uuid, p_codigo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_embajador uuid;
  v_nombre text;
  v_actual uuid;
begin
  if not public.posee_marca(p_marca) then
    raise exception 'Ese negocio no es tuyo.';
  end if;

  select e.perfil_id, coalesce(p.nombre, 'un embajador')
    into v_embajador, v_nombre
    from public.embajadores e
    join public.perfiles p on p.id = e.perfil_id
   where e.estado = 'activo'
     and e.codigo is not null
     and public.normalizar_codigo(e.codigo) = public.normalizar_codigo(p_codigo);

  if v_embajador is null then
    return null;
  end if;

  if v_embajador = (select auth.uid()) then
    raise exception 'Es tu propio código de embajador: compártelo con otros negocios.';
  end if;

  select r.embajador_id into v_actual from public.referidos r where r.marca_id = p_marca;

  if v_actual = v_embajador then
    return v_nombre;
  elsif v_actual is not null then
    raise exception 'Tu negocio ya tiene un código de embajador.';
  end if;

  if public.marca_ya_pago(p_marca) then
    raise exception 'El código de embajador es para el primer pago, y tu negocio ya pagó antes.';
  end if;

  insert into public.referidos (marca_id, embajador_id) values (p_marca, v_embajador);
  return v_nombre;
end;
$$;

-- El descuento que le toca a una marca en su siguiente pago: el codigo, si
-- tiene uno vinculado, sin usar y de un embajador activo.
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
     and r.monto_pagado is null
     and e.estado = 'activo'
     and (public.posee_marca(p_marca) or public.es_admin() or (select auth.uid()) is null);
$$;

-- Stripe confirmo el primer pago: se anota lo que se pago y la comision. Solo
-- la llama el webhook (llave de servicio) o el cobro simulado. Idempotente:
-- un aviso repetido no cobra dos veces.
create or replace function public.registrar_comision(p_marca uuid, p_monto numeric, p_stripe text)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comision numeric;
begin
  update public.referidos r
     set monto_pagado = p_monto,
         comision = round(p_monto * public.comision_de_embajador() / 100, 2),
         pagado_en = now(),
         stripe_subscription_id = p_stripe
   where r.marca_id = p_marca
     and r.monto_pagado is null
     and exists (
       select 1 from public.embajadores e
        where e.perfil_id = r.embajador_id and e.estado = 'activo'
     )
  returning r.comision into v_comision;

  return coalesce(v_comision, 0);
end;
$$;

revoke all on function public.registrar_comision(uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.registrar_comision(uuid, numeric, text) to service_role;

-- El administrador transfirio lo acumulado: se registra el pago y se le
-- cuelgan todas las comisiones que debia. Devuelve el monto.
create or replace function public.registrar_pago_a_embajador(p_embajador uuid, p_referencia text)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_monto numeric;
  v_pago uuid;
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador registra pagos a embajadores.';
  end if;

  select coalesce(sum(r.comision), 0) into v_monto
    from public.referidos r
   where r.embajador_id = p_embajador and r.comision is not null and r.pago_id is null;

  if v_monto <= 0 then
    raise exception 'No hay comisiones por pagar a este embajador.';
  end if;

  insert into public.pagos_a_embajadores (embajador_id, monto, referencia)
  values (p_embajador, v_monto, nullif(trim(p_referencia), ''))
  returning id into v_pago;

  update public.referidos
     set pago_id = v_pago
   where embajador_id = p_embajador and comision is not null and pago_id is null;

  return v_monto;
end;
$$;

-- Los negocios que trajo quien mira, con su nombre. El nombre de una marca solo
-- es publico mientras tiene micrositio publicado; el embajador lo ve siempre,
-- porque es su referido aunque este en pausa por no pagar.
create or replace function public.mis_referidos()
returns table (
  marca text,
  vinculado_en timestamptz,
  monto_pagado numeric,
  comision numeric,
  pagado_en timestamptz,
  cobrada boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.nombre_comercial, r.vinculado_en, r.monto_pagado, r.comision, r.pagado_en,
         r.pago_id is not null
    from public.referidos r
    join public.marcas m on m.id = r.marca_id
   where r.embajador_id = (select auth.uid())
   order by r.vinculado_en desc;
$$;

revoke all on function public.mis_referidos() from public, anon;
grant execute on function public.mis_referidos() to authenticated;

-- Postgres da EXECUTE a todo el mundo por omision. Se quita y se da solo a
-- quien la necesita: ninguna de estas es para visitantes sin sesion.
revoke all on function public.decidir_embajador(uuid, text) from public, anon;
revoke all on function public.embajador_del_codigo(text) from public, anon;
revoke all on function public.vincular_embajador(uuid, text) from public, anon;
revoke all on function public.codigo_de_embajador_de(uuid) from public, anon;
revoke all on function public.registrar_pago_a_embajador(uuid, text) from public, anon;
revoke all on function public.inventar_codigo_de_embajador(text) from public, anon, authenticated;
revoke all on function public.marca_ya_pago(uuid) from public, anon;

grant execute on function public.decidir_embajador(uuid, text) to authenticated;
grant execute on function public.embajador_del_codigo(text) to authenticated;
grant execute on function public.vincular_embajador(uuid, text) to authenticated;
grant execute on function public.codigo_de_embajador_de(uuid) to authenticated, service_role;
grant execute on function public.registrar_pago_a_embajador(uuid, text) to authenticated;
grant execute on function public.marca_ya_pago(uuid) to authenticated, service_role;
