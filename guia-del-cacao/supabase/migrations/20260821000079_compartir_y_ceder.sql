-- Cuentas compartidas, fase 3: compartir un negocio, cederlo y dejarlo.
--
-- El dueño agrega administradores por su @usuario, los quita y puede ceder la
-- propiedad a otra cuenta (quedándose como administrador o saliéndose). Un
-- administrador puede dejar el negocio cuando quiera. Es lo que permite que
-- alguien —Jorge, un asesor— arme el negocio de otra persona y luego se lo
-- entregue.
--
-- Qué puede cada quien:
--
-- - **Administrador**: todo el contenido (micrositio, catálogo, sucursales,
--   eventos, ruleta, experiencias, cupones) y atender pedidos y solicitudes.
-- - **Solo el dueño**: pagar y cancelar el plan, publicar (abre una
--   suscripción), anotar la CLABE a la que le transfieren, borrar el negocio,
--   y compartir, quitar y ceder.
--
-- Lo que todavía es solo del dueño **sin haberlo decidido** (fase 3b): el buzón
-- del negocio y los avisos. Las conversaciones son entre cuentas (`para` es el
-- dueño) y los avisos tienen un destinatario; dárselos a todo el equipo pide
-- otra forma de guardarlos.

-- ---------------------------------------------------------------------------
-- 1. Las marcas: la editan sus administradores, la borra su dueño
-- ---------------------------------------------------------------------------

drop policy if exists marcas_lectura on public.marcas;
create policy marcas_lectura on public.marcas
  for select using (
    perfil_id = (select auth.uid())
    or public.posee_marca(id)
    or public.es_admin()
    or public.marca_con_micrositio_publicado(id)
  );

drop policy if exists marcas_edita_propia on public.marcas;
create policy marcas_edita_propia on public.marcas
  for update using (public.posee_marca(id) or public.es_admin())
  with check (public.posee_marca(id) or public.es_admin());

drop policy if exists marcas_borra_propia on public.marcas;
create policy marcas_borra_propia on public.marcas
  for delete using (public.es_dueno_de_marca(id) or public.es_admin());

/**
 * El dueño (`perfil_id`) solo cambia por `ceder_marca`. Con la política de
 * edición abierta a los administradores, sin esto cualquiera de ellos se
 * quedaría con el negocio escribiendo su propio id.
 */
create or replace function public.proteger_dueno_de_marca()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.perfil_id is distinct from old.perfil_id
     and coalesce(current_setting('guia.cediendo', true), '') <> 'si'
     and not public.es_admin()
     and (select auth.uid()) is not null then
    raise exception 'El dueño del negocio solo cambia al cederlo.';
  end if;
  return new;
end;
$$;

drop trigger if exists al_editar_proteger_dueno on public.marcas;
create trigger al_editar_proteger_dueno
  before update of perfil_id on public.marcas
  for each row execute function public.proteger_dueno_de_marca();

-- ---------------------------------------------------------------------------
-- 2. Lo que solo puede el dueño: el plan y la CLABE
-- ---------------------------------------------------------------------------

drop policy if exists suscripciones_crea on public.suscripciones;
create policy suscripciones_crea on public.suscripciones
  for insert with check (
    public.es_dueno_de_marca(coalesce(marca_id, public.marca_de_sucursal(sucursal_id)))
    or public.es_admin()
  );

drop policy if exists suscripciones_edita on public.suscripciones;
create policy suscripciones_edita on public.suscripciones
  for update using (
    public.es_dueno_de_marca(coalesce(marca_id, public.marca_de_sucursal(sucursal_id)))
    or public.es_admin()
  )
  with check (
    public.es_dueno_de_marca(coalesce(marca_id, public.marca_de_sucursal(sucursal_id)))
    or public.es_admin()
  );

drop policy if exists datos_de_pago_dueno_crea on public.datos_de_pago;
create policy datos_de_pago_dueno_crea on public.datos_de_pago
  for insert with check (public.es_dueno_de_marca(marca_id));

drop policy if exists datos_de_pago_dueno_edita on public.datos_de_pago;
create policy datos_de_pago_dueno_edita on public.datos_de_pago
  for update using (public.es_dueno_de_marca(marca_id))
  with check (public.es_dueno_de_marca(marca_id));

-- ---------------------------------------------------------------------------
-- 3. Pedidos y solicitudes: los atiende todo el equipo
-- ---------------------------------------------------------------------------

do $$
declare
  v_funcion text;
  v_def text;
begin
  foreach v_funcion in array array[
    'public.mis_pedidos(text, uuid)',
    'public.pedidos_por_atender()',
    'public.faltan_datos_de_pago()',
    'public.solicitudes_por_sucursal()'
  ] loop
    v_def := pg_get_functiondef(v_funcion::regprocedure);
    execute replace(v_def, 'm.perfil_id = (select auth.uid())', 'public.posee_marca(m.id)');
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Compartir, quitar, ceder y dejar
-- ---------------------------------------------------------------------------

/** El equipo de una marca, con nombre y @usuario. Lo ve quien la administra. */
create or replace function public.administradores_de(p_marca uuid)
returns table (perfil_id uuid, nombre text, usuario text, papel text, agregado_en timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.perfil_id, p.nombre, p.usuario, a.papel, a.agregado_en
    from public.administradores_marca a
    join public.perfiles p on p.id = a.perfil_id
   where a.marca_id = p_marca
     and (public.posee_marca(p_marca) or public.es_admin())
   order by a.papel = 'dueno' desc, a.agregado_en;
$$;

/** La cuenta de un @usuario, con o sin arroba. Null si no existe. */
create or replace function public.cuenta_de_usuario(p_usuario text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.perfiles p
   where p.usuario = lower(btrim(ltrim(btrim(coalesce(p_usuario, '')), '@')));
$$;

create or replace function public.compartir_marca(p_marca uuid, p_usuario text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil uuid;
begin
  if not public.es_dueno_de_marca(p_marca) then
    raise exception 'Solo el dueño del negocio comparte su administración.';
  end if;

  v_perfil := public.cuenta_de_usuario(p_usuario);
  if v_perfil is null then
    raise exception 'No hay ninguna cuenta con ese @usuario. Revisa cómo está escrito.';
  end if;

  if exists (select 1 from public.administradores_marca a where a.marca_id = p_marca and a.perfil_id = v_perfil) then
    raise exception 'Esa cuenta ya administra este negocio.';
  end if;

  insert into public.administradores_marca (marca_id, perfil_id, papel, agregado_por)
  values (p_marca, v_perfil, 'admin', (select auth.uid()));

  return v_perfil;
end;
$$;

create or replace function public.quitar_administrador(p_marca uuid, p_perfil uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_dueno_de_marca(p_marca) then
    raise exception 'Solo el dueño del negocio quita administradores.';
  end if;

  delete from public.administradores_marca a
   where a.marca_id = p_marca and a.perfil_id = p_perfil and a.papel = 'admin';

  if not found then
    raise exception 'Esa cuenta no es administradora de este negocio.';
  end if;
end;
$$;

/**
 * Cede la propiedad a otra cuenta. Si todavía no administraba el negocio, entra
 * directo como dueña. Quien cede se queda como administrador, o sale del todo
 * con `p_quedarme = false`.
 *
 * La tarjeta con la que se paga es del negocio (`marcas.stripe_customer_id`),
 * no de la persona: los cobros siguen con ella hasta que el nuevo dueño cambie
 * el método de pago desde su panel.
 */
create or replace function public.ceder_marca(p_marca uuid, p_usuario text, p_quedarme boolean default true)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_yo uuid := (select auth.uid());
  v_nuevo uuid;
begin
  if not public.es_dueno_de_marca(p_marca) then
    raise exception 'Solo el dueño del negocio lo puede ceder.';
  end if;

  v_nuevo := public.cuenta_de_usuario(p_usuario);
  if v_nuevo is null then
    raise exception 'No hay ninguna cuenta con ese @usuario. Revisa cómo está escrito.';
  end if;
  if v_nuevo = v_yo then
    raise exception 'Ese @usuario es el tuyo: ya eres el dueño.';
  end if;

  -- El trigger de la 000078 pasa al dueño anterior a administrador y anota al
  -- nuevo como dueño; `guia.cediendo` es lo que deja pasar el cambio.
  perform set_config('guia.cediendo', 'si', true);
  update public.marcas set perfil_id = v_nuevo where id = p_marca;
  perform set_config('guia.cediendo', '', true);

  if not p_quedarme then
    delete from public.administradores_marca a where a.marca_id = p_marca and a.perfil_id = v_yo;
  end if;

  return v_nuevo;
end;
$$;

create or replace function public.dejar_marca(p_marca uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.es_dueno_de_marca(p_marca) then
    raise exception 'Eres el dueño: para irte, primero cede el negocio a otra cuenta.';
  end if;

  delete from public.administradores_marca a
   where a.marca_id = p_marca and a.perfil_id = (select auth.uid());

  if not found then
    raise exception 'No administras este negocio.';
  end if;
end;
$$;

revoke all on function public.administradores_de(uuid) from public, anon;
revoke all on function public.cuenta_de_usuario(text) from public, anon;
revoke all on function public.compartir_marca(uuid, text) from public, anon;
revoke all on function public.quitar_administrador(uuid, uuid) from public, anon;
revoke all on function public.ceder_marca(uuid, text, boolean) from public, anon;
revoke all on function public.dejar_marca(uuid) from public, anon;
grant execute on function public.administradores_de(uuid) to authenticated;
grant execute on function public.cuenta_de_usuario(text) to authenticated;
grant execute on function public.compartir_marca(uuid, text) to authenticated;
grant execute on function public.quitar_administrador(uuid, uuid) to authenticated;
grant execute on function public.ceder_marca(uuid, text, boolean) to authenticated;
grant execute on function public.dejar_marca(uuid) to authenticated;
