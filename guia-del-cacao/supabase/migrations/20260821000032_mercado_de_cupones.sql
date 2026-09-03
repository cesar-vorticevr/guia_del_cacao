-- El mercado: cupones que un negocio cambia por mazorcas.
--
-- Es lo que le da a las mazorcas un sitio donde gastarse. Hasta ahora solo se
-- juntaban y se regalaban en la comunidad; aqui se cambian por algo real, que es
-- lo que cierra el circulo: visito, junto, canjeo, vuelvo.

create table public.cupones (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references public.sucursales(id) on delete cascade,
  nombre text not null,
  descripcion text not null,
  -- Cuantas mazorcas cuesta. Sin tope por arriba a proposito: el negocio sabe
  -- lo que vale lo suyo, y poner un maximo aqui seria decidirlo por el.
  costo_mazorcas smallint not null,
  -- Solo el dia: un cupon vale "hasta el 30 de septiembre", no "hasta las 18:04".
  vigencia date not null,
  imagen text,
  fecha_creacion timestamptz not null default now(),

  constraint cupones_nombre_check check (length(btrim(nombre)) between 3 and 80),
  constraint cupones_descripcion_check check (length(btrim(descripcion)) between 10 and 400),
  constraint cupones_costo_check check (costo_mazorcas between 1 and 999)
);

create index cupones_sucursal_idx on public.cupones (sucursal_id);
create index cupones_vigencia_idx on public.cupones (vigencia desc);

comment on table public.cupones is
  'Lo que un negocio ofrece a cambio de mazorcas. Se crean y se borran, nunca se editan: alguien pudo canjearlo ya, y cambiarle el precio o la letra chica despues seria cambiarle el trato a quien ya pago.';

comment on column public.cupones.vigencia is
  'El ultimo dia en que sirve. Que este caducado no se guarda: se compara con la fecha de hoy, para que no haya que ir apagandolos cada noche.';

alter table public.cupones enable row level security;

-- ------------------------------------------------------------- diez por marca
-- El tope es de la marca y no de la sucursal: son diez ofertas del negocio, no
-- diez por cada local, que en una cadena de veinte serian doscientas.
--
-- Los caducados no cuentan. Si contaran, un negocio con dos anos de historia no
-- podria publicar nunca mas sin ponerse a borrar lo viejo, que es justo lo que
-- no queremos que haga: el historial sirve para saber que se ofrecio.
create or replace function public.tope_de_cupones()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  vigentes integer;
begin
  select count(*) into vigentes
    from public.cupones c
    join public.sucursales s on s.id = c.sucursal_id
   where s.marca_id = public.marca_de_sucursal(new.sucursal_id)
     and c.vigencia >= (now() at time zone 'America/Mexico_City')::date;

  if vigentes >= 10 then
    raise exception 'Ya tienes 10 cupones vigentes. Espera a que caduque alguno o borra uno para publicar otro';
  end if;

  return new;
end;
$$;

create trigger tope_al_crear_cupon
  before insert on public.cupones
  for each row execute function public.tope_de_cupones();

-- ------------------------------------------------------------------ politicas
-- Los ve cualquiera: son una oferta publica, y el mercado no tendria sentido si
-- solo los viera quien ya entro. Pero solo de sucursales publicadas, como todo
-- lo demas de un micrositio en borrador.
create policy cupones_lectura on public.cupones
  for select
  using (
    public.sucursal_publicada(sucursal_id)
    or public.posee_sucursal(sucursal_id)
    or public.es_admin()
  );

create policy cupones_crea_propio on public.cupones
  for insert
  with check (public.posee_sucursal(sucursal_id) or public.es_admin());

create policy cupones_borra_propio on public.cupones
  for delete
  using (public.posee_sucursal(sucursal_id) or public.es_admin());

-- **No hay politica de UPDATE, y esa ausencia es la regla.** Un cupon no se
-- edita: puede haber alguien que ya lo canjeo pagando sus mazorcas, y cambiarle
-- el precio, la letra chica o la fecha despues seria cambiarle el trato a quien
-- ya pago. Se borra y se hace otro. Si algun dia alguien agrega la politica,
-- rompe esto sin darse cuenta.
