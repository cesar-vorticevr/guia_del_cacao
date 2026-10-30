\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- El Gratis trae todo lo del Pro por quince dias (migracion 000068): resenas,
-- eventos, banner, ruleta y experiencias. Vencido, nada de eso.
--
-- Dentro de una transaccion que se deshace.

begin;

create or replace function pg_temp.debe_ser(etiqueta text, valor boolean)
returns void language plpgsql as $$
begin
  if valor then
    raise notice 'OK     %', etiqueta;
  else
    raise notice 'FALLA  %', etiqueta;
  end if;
end $$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f2700000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'gratis-todo@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Gratis","rol":"negocio"}', now(), now());

update public.perfiles set correo_verificado_en = now() where id = 'f2700000-0000-0000-0000-000000000001';

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
select 'f2710000-0000-0000-0000-000000000001', 'f2700000-0000-0000-0000-000000000001', 'Cacao a prueba', c.id
  from public.categorias c where c.slug = 'chocolateria';

insert into public.productos_servicios (marca_id, nombre)
values ('f2710000-0000-0000-0000-000000000001', 'Barra');

insert into public.sucursales (id, marca_id, nombre_sucursal, slug, entidad, estado, acerca_de, logo, tier_id)
values ('f2720000-0000-0000-0000-000000000001', 'f2710000-0000-0000-0000-000000000001',
        'Centro', 'gratis-con-todo', 'Tabasco', 'publicado', 'Cacao', 'logo.png', 1);

insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, fecha_fin_trial)
values ('f2720000-0000-0000-0000-000000000001', 1, 0, 'trial', now() + interval '15 days', now() + interval '15 days');

insert into public.ruletas (sucursal_id, frecuencia) values ('f2720000-0000-0000-0000-000000000001', 'diaria');
insert into public.premios_ruleta (sucursal_id, orden, texto, probabilidad, es_premio)
values ('f2720000-0000-0000-0000-000000000001', 1, 'Trufa', 100, true);

-- ---------------------------------------------------------------- en sus quince dias
select pg_temp.debe_ser('el Gratis trae las mismas funciones que el Pro',
  (select row(g.permite_resenas, g.puede_publicar_contenido, g.en_banner_principal, g.permite_ruleta, g.experiencias_ra)
        = row(p.permite_resenas, p.puede_publicar_contenido, p.en_banner_principal, p.permite_ruleta, p.experiencias_ra)
     from public.tiers g, public.tiers p where g.id = 1 and p.id = 3));
select pg_temp.debe_ser('y sigue costando cero', (select precio_mensual from public.tiers where id = 1) = 0);

select pg_temp.debe_ser('en prueba acepta resenas',
  public.sucursal_acepta_resenas('f2720000-0000-0000-0000-000000000001'));
select pg_temp.debe_ser('en prueba publica eventos',
  public.marca_publica_contenido('f2720000-0000-0000-0000-000000000001'));
select pg_temp.debe_ser('en prueba su ruleta sale en publico',
  'f2720000-0000-0000-0000-000000000001'::uuid in (select * from public.sucursales_con_ruleta()));
select pg_temp.debe_ser('en prueba tiene tres experiencias',
  public.cupo_de_experiencias('f2710000-0000-0000-0000-000000000001') = 3);

-- ---------------------------------------------------------------- vencido
-- Lo que hace `vencer_pruebas()`: la suscripcion y la sucursal, en pausa.
update public.suscripciones set estado = 'pausado_por_pago', fecha_fin_trial = now() - interval '1 day'
 where sucursal_id = 'f2720000-0000-0000-0000-000000000001';

update public.sucursales set estado = 'pausado' where id = 'f2720000-0000-0000-0000-000000000001';

select pg_temp.debe_ser('vencido sale del directorio, y sus resenas con el',
  not public.sucursal_publicada('f2720000-0000-0000-0000-000000000001'));
select pg_temp.debe_ser('vencido ya no publica eventos',
  not coalesce(public.marca_publica_contenido('f2720000-0000-0000-0000-000000000001'), false));
select pg_temp.debe_ser('vencido su ruleta ya no sale',
  not ('f2720000-0000-0000-0000-000000000001'::uuid in (select * from public.sucursales_con_ruleta())));
select pg_temp.debe_ser('vencido ya no tiene experiencias',
  public.cupo_de_experiencias('f2710000-0000-0000-0000-000000000001') = 0);

rollback;
