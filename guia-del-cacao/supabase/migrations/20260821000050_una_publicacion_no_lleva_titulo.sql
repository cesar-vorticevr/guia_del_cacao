-- Una publicación de la comunidad deja de llevar título.
--
-- Lo llevaba porque nació como un **foro**, y en un foro el título es el hilo:
-- es lo que se lee en la lista antes de entrar. El muro de hoy no es eso. Es un
-- feed donde primero se ve la foto y debajo se lee lo que la acompaña, y ahí un
-- título es un renglón de más que nadie escribe con gusto: la gente ponía
-- "Noticia de ultima hora" y contaba lo suyo abajo.
--
-- **Los eventos sí lo conservan**, y no es incoherencia: un evento se anuncia,
-- se busca en la agenda y se comparte por su nombre. "Cata de origen" es el
-- evento. Una foto del secadero no se llama de ninguna manera.
--
-- La columna se queda —se vuelve opcional, no se borra— por lo que ya hay
-- escrito: catorce publicaciones tienen título y alguna dice algo que su texto
-- no repite. Borrarla perdería eso a cambio de nada.
alter table public.publicaciones
  alter column titulo drop not null;

-- El largo sigue valiendo para quien traiga título; lo que se permite ahora es
-- no traerlo. Sin tocar el check, un `null` lo violaría.
alter table public.publicaciones
  drop constraint if exists publicaciones_titulo_check;

alter table public.publicaciones
  add constraint publicaciones_titulo_check
  check (
    titulo is null
    or (length(btrim(titulo)) >= 5 and length(btrim(titulo)) <= 120)
  );

comment on column public.publicaciones.titulo is
  'Opcional desde la migracion 000050: el muro es un feed y una foto no se titula. Lo que queda escrito es de cuando esto era un foro. Donde hace falta un nombre —la pestana del navegador, la tarjeta al compartir— se saca de las primeras palabras del contenido.';
