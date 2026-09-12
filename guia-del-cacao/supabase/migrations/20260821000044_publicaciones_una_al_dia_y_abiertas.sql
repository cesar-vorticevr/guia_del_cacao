-- Las publicaciones se abren: una al dia por persona, y comenta quien quiera.
--
-- Estaban construidas y apagadas, con tres reglas que ya no valen:
--
--   1. Publicar le costaba **una mazorca** a un cliente. Las mazorcas salieron
--      del producto, asi que el cobro no tenia de donde cobrar: el trigger
--      buscaba un saldo en una tabla que ya nadie alimenta y lo rechazaba todo.
--   2. Un negocio solo podia publicar con **plan Premier**. La publicacion deja
--      de ser una funcion de plan y pasa a ser de cualquiera.
--   3. Comentar pedia ser cliente o negocio de Tier 3.
--
-- Lo que entra en su lugar es un limite que no cuesta dinero y sirve para lo
-- mismo que el cobro: **una publicacion al dia**. El cobro existia para que el
-- muro no se llenara de ruido; un tope diario hace eso sin pedirle nada a nadie
-- y sin depender de un saldo.

-- ---------------------------------------------------------------------------
-- Se va el cobro
-- ---------------------------------------------------------------------------
drop trigger if exists cobrar_al_publicar on public.publicaciones;

drop function if exists public.cobrar_publicacion();

-- ---------------------------------------------------------------------------
-- Una al dia, por persona
-- ---------------------------------------------------------------------------
--
-- El dia se cuenta en hora de Mexico y no en UTC, igual que el resto de los
-- limites diarios del proyecto: en UTC el dia cambiaria a las seis de la tarde
-- y alguien que publica de noche tendria dos publicaciones el mismo dia.
--
-- Cuenta por **autor** y no por marca: si una cuenta de negocio tiene tres
-- sucursales, sigue siendo una persona publicando, y el tope es de la persona.
create or replace function public.una_publicacion_al_dia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  /*
    El dia de la publicacion que entra, no el de hoy. Casi siempre son el
    mismo -`fecha` vale `now()` por defecto- pero comparar contra hoy hacia que
    una fila con fecha de ayer se rechazara por una de hoy, y al contrario: en
    una importacion o en datos de prueba, el tope dejaba de ser "una al dia" y
    pasaba a ser "una mientras hayas publicado hoy".
  */
  dia date := (new.fecha at time zone 'America/Mexico_City')::date;
  ya integer;
begin
  -- Quien modera no tiene tope: retirar y reponer contenido es su trabajo.
  if public.es_admin() then
    return new;
  end if;

  select count(*) into ya
    from public.publicaciones p
   where p.autor_id = new.autor_id
     and (p.fecha at time zone 'America/Mexico_City')::date = dia;

  if ya >= 1 then
    raise exception 'Ya publicaste hoy. Puedes volver a publicar mañana.';
  end if;

  return new;
end;
$$;

comment on function public.una_publicacion_al_dia() is
  'Tope de una publicacion diaria por autor, contado en hora de Mexico. Sustituye al cobro de una mazorca, que hacia el mismo trabajo -que el muro no se llene de ruido- cobrandolo.';

drop trigger if exists una_al_dia_al_publicar on public.publicaciones;

create trigger una_al_dia_al_publicar
  before insert on public.publicaciones
  for each row execute function public.una_publicacion_al_dia();

-- ---------------------------------------------------------------------------
-- Publicar deja de ser del plan
-- ---------------------------------------------------------------------------
--
-- Cualquier cuenta puede publicar: un visitante como el mismo, un negocio
-- firmando con una de sus sucursales. Lo unico que se sigue comprobando es que
-- la sucursal con la que firma sea suya, para que nadie publique en nombre de
-- otro.
drop policy if exists publicaciones_crea_propia on public.publicaciones;

create policy publicaciones_crea_propia on public.publicaciones
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and (
      sucursal_id is null
      or public.posee_sucursal(sucursal_id)
      or public.es_admin()
    )
  );

-- ---------------------------------------------------------------------------
-- Comenta quien quiera
-- ---------------------------------------------------------------------------
drop policy if exists comentarios_foro_crea on public.comentarios;

create policy comentarios_foro_crea on public.comentarios
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));
