# Documentación técnica — borrador para Google Docs

## Descripción

«Primero esto» ayuda a gestionar los alimentos del frigo. La persona fotografía el producto y su etiqueta, confirma nombre y fecha, recibe avisos al aproximarse esa fecha y ve recetas basadas en los alimentos aún disponibles. También puede añadir productos manualmente, marcarlos como consumidos o descartados y probar la aplicación con datos de ejemplo.

## Plataforma utilizada

Codex para desarrollar el proyecto mediante instrucciones en lenguaje natural. Cloudflare se utiliza para alojamiento, base de datos, tarea programada y servicios de ejecución de la app.

## Arquitectura

Frontend PWA servido por Cloudflare Workers. API en el mismo Worker. D1 guarda `households`, `items`, `push_subscriptions`, `notification_events` y `photo_usage`. Workers AI procesa temporalmente las fotos. La tarea Cron revisa las fechas a diario y Web Push envía los avisos a los dispositivos suscritos. Las recetas se calculan en el navegador con un catálogo local y priorizan coincidencias completas e ingredientes próximos a su fecha.

## Casos de uso

1. Registrar un alimento con nombre, cantidad, unidad, fecha y tipo de fecha.
2. Fotografiar el producto y/o la etiqueta para rellenar parte del formulario y confirmar la sugerencia.
3. Ver alimentos próximos a su fecha y recibir un aviso push.
4. Marcar un producto como consumido o descartado, de modo que deje de sugerirse en recetas.
5. Consultar recetas completas o aquellas a las que les falta algún ingrediente.
6. Compartir una despensa mediante un enlace secreto.

## Proceso iterativo

Se definió primero el problema y el recorrido de la aplicación. Después se eligió Cloudflare por sus cuotas gratuitas. Codex generó la estructura del Worker, esquema D1, interfaz, reconocimiento de fotos, catálogo de recetas y notificaciones. En pruebas de navegador se detectó que el formulario no se cerraba tras guardar; se corrigió conservando la referencia al formulario antes de la operación asíncrona. En pruebas con una etiqueta sintética se vio que el modelo a veces omitía la fecha o confundía el tipo de fecha; se reforzó la pregunta y se mantuvo la confirmación humana.

## Retos y soluciones

- **Fechas pequeñas en etiquetas:** el reconocimiento visual no es infalible. La app nunca guarda automáticamente el resultado de la foto; se exige confirmación en el formulario.
- **Avisos con la app cerrada:** service worker, suscripción Web Push, claves VAPID y tarea Cron diaria.
- **Coste:** las fotos no se almacenan y el análisis se limita a 30 llamadas al día.
- **Prueba rápida por el jurado:** botón de datos de ejemplo.

## Capturas pendientes

Insertar capturas de la pantalla inicial, formulario de foto, despensa con productos, recetas y aviso push probado en dispositivo real.
