-- Los dos estados de suscripcion que faltaban para el trial de la spec v2.
--
-- Van solos en su migracion a proposito. Postgres deja anadir valores a un enum
-- dentro de una transaccion, pero no deja **usarlos** hasta que esa transaccion
-- termina, y supabase corre cada archivo en una. Escribir aqui el indice que
-- los menciona reventaria con "unsafe use of new value of enum type"; por eso
-- todo lo que los usa vive en la migracion siguiente.
alter type public.estado_suscripcion add value if not exists 'trial';
alter type public.estado_suscripcion add value if not exists 'pausado_por_pago';
