-- Los negocios favoritos de cada cliente.
--
-- Es lo unico que la cuenta del cliente le pide a la plataforma desde que se
-- quitaron las mazorcas: una lista corta de "a estos quiero volver". No es un
-- programa de puntos ni cuesta nada, y por eso funciona para un turista que
-- pasa una vez y para alguien de aqui que vuelve cada mes.
--
-- Guarda la sucursal y no la marca: el favorito es el local al que se piensa
-- volver, y una marca con tres sucursales tiene tres direcciones distintas.

create table if not exists public.favoritos (
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  sucursal_id uuid not null references public.sucursales (id) on delete cascade,
  fecha timestamptz not null default now(),
  primary key (usuario_id, sucursal_id)
);

comment on table public.favoritos is
  'Negocios que un cliente guardo para volver. La llave primaria compuesta es la que impide guardar dos veces el mismo: no hace falta comprobarlo antes de insertar.';

-- El listado de la cuenta pide "los mios, los mas nuevos primero".
create index if not exists favoritos_del_usuario_idx
  on public.favoritos (usuario_id, fecha desc);

alter table public.favoritos enable row level security;

-- Los favoritos son privados. Nadie mas los lee: ni el negocio marcado, ni otro
-- cliente. Saber quien te guardo suena inofensivo hasta que se piensa en una
-- persona que no quiere que un local sepa que piensa volver.
create policy favoritos_propios on public.favoritos
  for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy favoritos_guarda on public.favoritos
  for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and public.es_cliente()
    and public.sucursal_publicada(sucursal_id)
  );

-- Quitar es solo suyo, y no depende de que la sucursal siga publicada: si un
-- negocio se sale del directorio, quien lo tenia guardado tiene que poder
-- soltarlo igual.
create policy favoritos_suelta on public.favoritos
  for delete to authenticated
  using (usuario_id = (select auth.uid()));

-- No hay politica de update a proposito: un favorito se pone o se quita, no se
-- edita. La ausencia es la regla.
