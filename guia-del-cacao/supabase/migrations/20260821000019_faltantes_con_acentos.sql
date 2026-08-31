-- Los pendientes de un micrositio, bien escritos.
--
-- El texto de `que_le_falta_al_micrositio` nacio sin acentos porque solo se leia
-- en un sitio, la pantalla de pago, y de pasada. Ahora el panel lo enseña como
-- lista desde que se crea la sucursal: es de lo primero que ve un negocio nuevo
-- y no puede decir "la descripcion" ni "catalogo".
--
-- Solo cambia como se nombra cada faltante. La regla —nombre, descripcion, logo
-- y al menos un producto— es la misma, y el trigger que la exige al publicar no
-- se toca.
create or replace function public.que_le_falta_al_micrositio(p_sucursal uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $fn$
  select string_agg(falta, ', ' order by orden)
    from (
      select 1 as orden, 'el nombre de la sucursal' as falta
        from public.sucursales s
       where s.id = p_sucursal and coalesce(btrim(s.nombre_sucursal), '') = ''
      union all
      select 2, 'la descripción (el "acerca de")'
        from public.sucursales s
       where s.id = p_sucursal and coalesce(btrim(s.acerca_de), '') = ''
      union all
      select 3, 'el logo'
        from public.sucursales s
       where s.id = p_sucursal and coalesce(btrim(s.logo), '') = ''
      union all
      select 4, 'al menos un producto en el catálogo'
       where not exists (
         select 1 from public.productos_servicios p where p.sucursal_id = p_sucursal
       )
    ) pendientes;
$fn$;
