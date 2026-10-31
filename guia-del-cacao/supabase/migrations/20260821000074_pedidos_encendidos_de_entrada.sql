-- Los pedidos vienen encendidos para todo negocio con plan pagado.
--
-- En la 000071 recibir pedidos esperaba a que el negocio anotara su CLABE, y
-- como ninguno lo habia hecho, el boton de pedir no salia en ningun lado: la
-- funcion existia y nadie la veia. Ahora vende quien tiene el plan pagado, y
-- los datos de pago se piden **al confirmar** el primer pedido
-- (`cambiar_estado_pedido` ya lo exigia). Quien no quiera vender lo apaga con
-- «Recibir pedidos» en su panel.
--
-- Lo que no cambia: el cliente no ve a donde pagar hasta que el negocio
-- confirma, y la prueba Gratis y los negocios de demostracion no venden.

create or replace function public.por_que_no_vende(p_sucursal uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s record;
begin
  select su.estado, su.marca_id, m.es_demo
    into s
    from public.sucursales su
    join public.marcas m on m.id = su.marca_id
   where su.id = p_sucursal;

  if not found then
    return 'Esa sucursal no existe.';
  end if;

  if s.es_demo then
    return 'Es un negocio de demostración.';
  end if;

  if s.estado <> 'publicado' then
    return 'La sucursal no está publicada.';
  end if;

  if not exists (
    select 1 from public.suscripciones x
      join public.tiers t on t.id = x.tier_id
     where x.sucursal_id = p_sucursal
       and x.estado = 'activo'
       and t.precio_mensual > 0
  ) then
    return 'Recibir pedidos es del plan Pro pagado: con el Gratis no se vende.';
  end if;

  -- Sin datos de pago todavia, recibe: los anota al confirmar. Solo un
  -- «Recibir pedidos» apagado a proposito lo detiene.
  if exists (
    select 1 from public.datos_de_pago d
     where d.marca_id = s.marca_id and not d.recibe_pedidos
  ) then
    return 'Apagaste «Recibir pedidos».';
  end if;

  return null;
end;
$$;

/**
 * Si el negocio de quien mira recibe pedidos pero todavia no anota a donde le
 * transfieren: el panel se lo recuerda arriba, para que no se entere hasta que
 * intente confirmar el primero.
 */
create or replace function public.faltan_datos_de_pago()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.marcas m
      join public.sucursales s on s.marca_id = m.id
     where m.perfil_id = (select auth.uid())
       and public.por_que_no_vende(s.id) is null
  ) and not exists (
    select 1 from public.datos_de_pago d
      join public.marcas m on m.id = d.marca_id
     where m.perfil_id = (select auth.uid())
  );
$$;

revoke all on function public.faltan_datos_de_pago() from public, anon;
grant execute on function public.faltan_datos_de_pago() to authenticated;
