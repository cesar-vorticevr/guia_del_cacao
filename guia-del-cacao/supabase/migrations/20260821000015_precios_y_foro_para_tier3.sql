-- Guía del Cacao — precios nuevos y el foro abierto al Tier 3
--
-- Dos cambios que van juntos porque los dos vienen de lo mismo: que el plan
-- caro valga la pena.
--
--   * Los planes pasan a 199 / 299 / 399. La distancia entre uno y otro se
--     achica: antes el salto de 199 a 499 era un abismo y nadie lo daba.
--   * El Tier 3 puede abrir temas en el foro, hasta 3. Es la primera vez que un
--     negocio habla fuera de su micrositio, y es justo lo que hace distinto al
--     plan de arriba.
--
-- Para un cliente no cambia nada: sus temas los sigue desbloqueando el
-- pasaporte (50 monedas el primero, 100 para tener tres).

update public.tiers set precio_mensual = 199.00 where id = 1;
update public.tiers set precio_mensual = 299.00 where id = 2;
update public.tiers set precio_mensual = 399.00 where id = 3;

-- ---------------------------------------------------------------------------
-- Un negocio del plan de arriba
-- ---------------------------------------------------------------------------

-- Se pide "publicado" ademas de Tier 3: un micrositio en borrador no ha pagado
-- todavia, y abrir temas es parte de lo que se paga.
create or replace function public.negocio_de_tier3(p_perfil uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1
      from public.marcas m
      join public.sucursales s on s.marca_id = m.id
     where m.perfil_id = p_perfil
       and s.tier_id = 3
       and s.estado = 'publicado'
  );
$fn$;

-- ---------------------------------------------------------------------------
-- Cuantos temas le tocan a cada quien
-- ---------------------------------------------------------------------------

-- Antes solo habia clientes en el foro y bastaba con mirar las monedas. Ahora
-- hay dos caminos distintos al mismo derecho, asi que la pregunta cambia de
-- "cuantas monedas tienes" a "quien eres".
create or replace function public.temas_permitidos_de(p_autor uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $fn$
  select case
    when (select p.rol from public.perfiles p where p.id = p_autor) = 'negocio' then
      case when public.negocio_de_tier3(p_autor) then 3 else 0 end
    else
      public.temas_permitidos(public.monedas_de(p_autor))
  end;
$fn$;

create or replace function public.limitar_temas_por_autor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  es_negocio boolean :=
    (select p.rol from public.perfiles p where p.id = new.autor_id) = 'negocio';
  permitidos integer := public.temas_permitidos_de(new.autor_id);
  abiertos integer;
begin
  if permitidos = 0 then
    if es_negocio then
      raise exception 'Abrir temas en el foro viene con el plan Tier 3';
    else
      raise exception 'Hacen falta 50 monedas de chocolate para abrir un tema (llevas %)',
        public.monedas_de(new.autor_id);
    end if;
  end if;

  select count(*) into abiertos
    from public.temas_foro t
   where t.autor_id = new.autor_id
     and t.id <> new.id;

  if abiertos >= permitidos then
    raise exception 'Ya tienes % de los % temas que puedes abrir', abiertos, permitidos;
  end if;

  return new;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Politicas: quien participa en el foro
-- ---------------------------------------------------------------------------

drop policy temas_crea_propio on public.temas_foro;

create policy temas_crea_propio on public.temas_foro
  for insert with check (
    autor_id = (select auth.uid())
    and (public.es_cliente() or public.negocio_de_tier3((select auth.uid())))
  );

-- Un negocio que abre un tema tiene que poder contestar en el suyo; si no,
-- abre una conversacion en la que no puede estar.
drop policy comentarios_foro_crea on public.comentarios_foro;

create policy comentarios_foro_crea on public.comentarios_foro
  for insert with check (
    usuario_id = (select auth.uid())
    and (public.es_cliente() or public.negocio_de_tier3((select auth.uid())))
  );

-- Apoyar sigue siendo cosa de clientes, y no por descuido: la moneda sale del
-- pasaporte de quien apoya, y un negocio no tiene pasaporte.
