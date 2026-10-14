# Documentación técnica — borrador para Google Docs

## Descripción

«Primero esto» ayuda a gestionar los alimentos del frigo. Una persona registrada anota cada producto y su fecha en un formulario, recibe avisos al aproximarse esa fecha y ve recetas basadas en los alimentos aún disponibles. Puede sincronizar su despensa entre dispositivos y pasar los productos agotados a una lista de la compra.

## Plataforma utilizada

Codex para desarrollar el proyecto mediante instrucciones en lenguaje natural. Cloudflare se utiliza para alojamiento, base de datos, tarea programada y servicios de ejecución de la app.

## Arquitectura

Frontend PWA servido por Cloudflare Workers. API en el mismo Worker. D1 guarda despensas, alimentos, cuentas, sesiones, enlaces de invitación, suscripciones push y registro de notificaciones. Las contraseñas se derivan en dos pasadas de PBKDF2-SHA-256 de 100 000 iteraciones cada una, con sal aleatoria; las sesiones se guardan mediante el hash de un token aleatorio y se entregan en cookies Secure, HttpOnly y SameSite=Lax. Al registrar una despensa de invitado se invalida su clave anterior. La tarea Cron revisa las fechas a diario y Web Push envía los avisos a los dispositivos suscritos. Las recetas se calculan en el navegador con un catálogo local y priorizan coincidencias completas e ingredientes próximos a su fecha. La interfaz consulta cambios cada 30 segundos cuando está visible.

## Casos de uso

1. Registrar y editar un alimento con nombre, cantidad, sección de supermercado, unidad, fecha y tipo de fecha.
2. Ver alimentos próximos a su fecha y recibir un aviso push.
3. Marcar un producto como consumido o descartado, de modo que deje de sugerirse en recetas.
4. Consultar recetas completas o aquellas a las que les falta algún ingrediente.
5. Compartir una despensa mediante un enlace secreto.
6. Crear una cuenta con la despensa actual e iniciar sesión desde otro dispositivo para consultar los mismos alimentos.
7. Agrupar y filtrar los alimentos por la sección del supermercado.
8. Consultar los alimentos agotados en una lista de la compra, apuntar otros productos y reponerlos con una nueva fecha.
9. Consultar una despensa compartida sin cuenta; registrarse o iniciar sesión para poder modificar la propia.
10. Recibir una sugerencia de uso orientativo para fruta o verdura reconocida, basada en el día de entrada al frigorífico, y corregirla antes o después de guardar.

## Proceso iterativo

Se definió primero el problema y el recorrido de la aplicación. Después se eligió Cloudflare por sus cuotas gratuitas. Codex generó la estructura del Worker, esquema D1, interfaz, catálogo de recetas y notificaciones. En pruebas de navegador se detectó que el formulario no se cerraba tras guardar; se corrigió conservando la referencia al formulario antes de la operación asíncrona. También se exploró el alta mediante fotos, pero las pruebas mostraron que no reconocía con fiabilidad productos ni textos de las etiquetas. A petición de la persona participante se retiró esa función del formulario, la API y la configuración de Cloudflare.
Más tarde se añadió el registro de usuarios para abrir la misma despensa en cualquier dispositivo. La migración vincula la despensa de invitado a la cuenta y conserva alimentos y suscripciones de avisos. Se probaron registro, inicio de sesión en dos clientes, sincronización, cierre de sesión y enlaces compartidos. También se añadió la edición posterior de cada alimento. En la prueba de producción se descubrió que Workers limita PBKDF2 a 100 000 iteraciones por llamada; la derivación se dividió en dos pasadas consecutivas.
Después se añadieron categorías de supermercado, agrupación y filtro. La migración asigna «Otros» a los alimentos existentes sin alterar sus demás datos; el usuario puede cambiarlos desde «Editar».
La siguiente iteración añadió una lista de la compra: los alimentos agotados entran automáticamente y se pueden reponer en la despensa. El registro pasó a ser obligatorio para escribir. La API comprueba la sesión en cada operación de modificación; los enlaces compartidos dan acceso de solo lectura.
Después se añadieron estimaciones de conservación para productos frescos concretos. La referencia es la guía de conservación de la Universidad de Maine. La fecha de entrada se guarda en D1 y la fecha resultante tiene un tipo propio, «Fecha orientativa», para distinguirla de la caducidad del envase. Las estimaciones son de frescura y no indican seguridad alimentaria; el usuario puede corregirlas.

## Retos y soluciones

- **Precisión del registro:** el usuario introduce y comprueba los datos de la etiqueta en el formulario.
- **Avisos con la app cerrada:** service worker, suscripción Web Push, claves VAPID y tarea Cron diaria.
- **Coste:** el MVP utiliza Worker y D1, sin invocaciones de IA para fotos.
- **Prueba rápida por el jurado:** botón de datos de ejemplo.
- **Continuidad entre dispositivos:** correo y contraseña asociados a una despensa almacenada en D1.

Esta versión no verifica el correo ni ofrece recuperación de contraseña; la interfaz advierte al usuario antes del registro.

La incorporación mediante foto se considera una posible función premium futura, pendiente de lograr una lectura fiable. No está incluida en esta versión.

## Capturas pendientes

Insertar capturas de la pantalla inicial, registro e inicio de sesión, formulario manual, despensa con productos, recetas y aviso push probado en dispositivo real.
