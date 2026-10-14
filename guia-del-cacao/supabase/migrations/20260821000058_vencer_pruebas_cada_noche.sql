-- Las pruebas vencen solas, ahora que se puede pagar.
--
-- `vencer_pruebas()` existe desde la migracion 000051 pero no estaba
-- programada: sin pasarela nadie podia pagar, y correrla habria sacado del
-- directorio a todos al terminar su prueba. Desde la 000056 se cobra con
-- Stripe, asi que se programa cada noche.
--
-- Dos cosas mas, decididas el 13 de octubre de 2026 al pasar a cobro real:
--
-- 1. **Lo que se dio por pagado sin pagar** —suscripciones `activo` del cobro
--    simulado, sin `stripe_subscription_id` ni promocion— pasa a prueba de
--    quince dias desde hoy. Si en ese tiempo no paga con tarjeta, se oculta
--    como cualquier otra prueba. No se borra nada.
-- 2. `vencer_pruebas` tambien oculta a quien tenia un plan **gratis por una
--    promocion al 100%** cuando se le acaba lo que cubria: esas filas son
--    `activo` sin Stripe, y nadie iba a cobrarles nunca.

update public.suscripciones
   set estado = 'trial',
       fecha_fin_trial = now() + interval '15 days'
 where estado = 'activo'
   and stripe_subscription_id is null
   and pago_de_apertura is null;

create or replace function public.vencer_pruebas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vencida record;
  v_cuantas integer := 0;
begin
  for v_vencida in
    select id, sucursal_id
      from public.suscripciones
     where (
             -- Una prueba que se acabo.
             estado = 'trial'
             and fecha_fin_trial is not null
             and fecha_fin_trial <= now()
           )
        or (
             -- Lo que cubria una promocion al 100%, sin tarjeta detras.
             estado = 'activo'
             and stripe_subscription_id is null
             and pago_de_apertura is not null
             and fecha_proximo_cobro <= now()
           )
       for update
  loop
    update public.suscripciones set estado = 'pausado_por_pago' where id = v_vencida.id;

    update public.sucursales
       set estado = 'pausado'
     where id = v_vencida.sucursal_id and estado = 'publicado';

    v_cuantas := v_cuantas + 1;
  end loop;

  return v_cuantas;
end;
$$;

revoke all on function public.vencer_pruebas() from public, anon, authenticated;

comment on function public.vencer_pruebas() is
  'Oculta las sucursales cuya prueba, o cuya promocion al 100%, vencio sin pago. Corre cada noche (migracion 000058).';

-- Cada noche a las 00:15 del centro de Mexico (06:15 UTC).
create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule(jobid) from cron.job where jobname = 'vencer-pruebas';

select cron.schedule('vencer-pruebas', '15 6 * * *', $$select public.vencer_pruebas()$$);
