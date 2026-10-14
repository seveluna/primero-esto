# Documentación técnica — borrador para Google Docs

## Descripción

«Primero esto» ayuda a gestionar los alimentos del frigo. La persona registra cada producto y su fecha en un formulario, recibe avisos al aproximarse esa fecha y ve recetas basadas en los alimentos aún disponibles. También puede marcarlos como consumidos o descartados y probar la aplicación con datos de ejemplo.

## Plataforma utilizada

Codex para desarrollar el proyecto mediante instrucciones en lenguaje natural. Cloudflare se utiliza para alojamiento, base de datos, tarea programada y servicios de ejecución de la app.

## Arquitectura

Frontend PWA servido por Cloudflare Workers. API en el mismo Worker. D1 guarda `households`, `items`, `push_subscriptions` y `notification_events`. La tarea Cron revisa las fechas a diario y Web Push envía los avisos a los dispositivos suscritos. Las recetas se calculan en el navegador con un catálogo local y priorizan coincidencias completas e ingredientes próximos a su fecha.

## Casos de uso

1. Registrar un alimento con nombre, cantidad, unidad, fecha y tipo de fecha.
2. Ver alimentos próximos a su fecha y recibir un aviso push.
3. Marcar un producto como consumido o descartado, de modo que deje de sugerirse en recetas.
4. Consultar recetas completas o aquellas a las que les falta algún ingrediente.
5. Compartir una despensa mediante un enlace secreto.

## Proceso iterativo

Se definió primero el problema y el recorrido de la aplicación. Después se eligió Cloudflare por sus cuotas gratuitas. Codex generó la estructura del Worker, esquema D1, interfaz, catálogo de recetas y notificaciones. En pruebas de navegador se detectó que el formulario no se cerraba tras guardar; se corrigió conservando la referencia al formulario antes de la operación asíncrona. También se exploró el alta mediante fotos, pero las pruebas mostraron que no reconocía con fiabilidad productos ni textos de las etiquetas. A petición de la persona participante se retiró esa función del formulario, la API y la configuración de Cloudflare.

## Retos y soluciones

- **Precisión del registro:** el usuario introduce y comprueba los datos de la etiqueta en el formulario.
- **Avisos con la app cerrada:** service worker, suscripción Web Push, claves VAPID y tarea Cron diaria.
- **Coste:** el MVP utiliza Worker y D1, sin invocaciones de IA para fotos.
- **Prueba rápida por el jurado:** botón de datos de ejemplo.

La incorporación mediante foto se considera una posible función premium futura, pendiente de lograr una lectura fiable. No está incluida en esta versión.

## Capturas pendientes

Insertar capturas de la pantalla inicial, formulario manual, despensa con productos, recetas y aviso push probado en dispositivo real.
