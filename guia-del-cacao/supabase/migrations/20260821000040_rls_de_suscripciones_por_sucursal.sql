-- Las politicas de `suscripciones` se quedaron mirando a la marca.
--
-- Desde la migracion 000039 las filas cuelgan de `sucursal_id` y traen
-- `marca_id` vacio, pero las tres politicas seguian preguntando solo por
-- `posee_marca(marca_id)`. Con eso, `posee_marca(null)` no es cierto para nadie
-- y el dueno de un negocio dejaba de ver, crear y editar sus propias
-- suscripciones: la pantalla de cuenta decia "todavia no tienes ningun
-- micrositio publicado" con tres publicados, y publicar uno nuevo habria
-- fallado al abrir la prueba.
--
-- Se aceptan las dos formas. Las filas viejas -las de marca- se siguen leyendo
-- por su marca; las nuevas, por su sucursal.

drop policy if exists suscripciones_propias on public.suscripciones;

create policy suscripciones_propias on public.suscripciones
  for select to authenticated
  using (
    public.posee_marca(marca_id)
    or public.posee_sucursal(sucursal_id)
    or public.es_admin()
  );

drop policy if exists suscripciones_crea on public.suscripciones;

create policy suscripciones_crea on public.suscripciones
  for insert to authenticated
  with check (
    public.posee_marca(marca_id)
    or public.posee_sucursal(sucursal_id)
    or public.es_admin()
  );

drop policy if exists suscripciones_edita on public.suscripciones;

create policy suscripciones_edita on public.suscripciones
  for update to authenticated
  using (
    public.posee_marca(marca_id)
    or public.posee_sucursal(sucursal_id)
    or public.es_admin()
  )
  with check (
    public.posee_marca(marca_id)
    or public.posee_sucursal(sucursal_id)
    or public.es_admin()
  );
