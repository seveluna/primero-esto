# Primero esto

Aplicación web para registrar alimentos del frigo, avisar antes de la fecha indicada y proponer recetas con los productos aún disponibles. Creada con Codex mediante instrucciones en lenguaje natural para el Hackathon de Vibe Coding, Máster en Inteligencia Artificial, Edición 7.

**Aplicación publicada:** https://primero-esto.seve-103.workers.dev

## Funciones

- Alta manual de alimentos con nombre, cantidad, unidad, fecha indicada y tipo de fecha.
- Despensa compartible mediante enlace secreto, con estado disponible, consumido o descartado.
- Avisos web push 3 días antes, 1 día antes y el mismo día de la fecha. Una tarea diaria a las 08:00 UTC revisa D1 y evita duplicados.
- Recetas de un catálogo local ordenadas según ingredientes disponibles y urgencia. Muestra ingredientes que faltan. Los productos consumidos, descartados o con fecha pasada no se usan para proponer recetas.
- Datos de ejemplo para que el jurado pueda probar la app sin introducir información real.

## Arquitectura

- **Cloudflare Worker:** API y lógica de avisos.
- **Cloudflare D1:** alimentos, despensas, suscripciones push y registro de avisos enviados.
- **Assets estáticos y PWA:** interfaz HTML/CSS/JavaScript, manifest y service worker para recibir notificaciones.
- **Web Push con VAPID:** envía avisos incluso con la app cerrada, siempre que el navegador y el dispositivo permitan push y la persona haya concedido permiso.

La despensa se identifica con una clave aleatoria de 256 bits. El servidor guarda solo su hash SHA-256. Quien tenga el enlace compartido puede acceder a esa despensa; no hay cuentas ni contraseñas en esta versión.

## Desarrollo local

Requisitos: Node.js y una cuenta de Cloudflare conectada a Wrangler.

```bash
npm install
npm run db:local
cp .dev.vars.example .dev.vars
# Sustituir las claves VAPID por un par generado con: npx web-push generate-vapid-keys
npm run dev
```

La configuración de D1 está en `wrangler.jsonc`. `npm run db:remote` aplica `schema.sql` a la base remota. `npm run deploy` publica la app. Las tres variables VAPID se guardan como secretos de Cloudflare y `.dev.vars` queda fuera de Git.

## Comprobaciones realizadas

- Sintaxis de Worker, interfaz y service worker.
- Alta, consulta y cambio de estado de alimentos en D1 local.
- Recorrido de alta en móvil y aparición de recetas.
- Acceso a la URL pública, alta y consulta en D1 remoto, clave pública de push.
- Se probó el reconocimiento de fotos durante el desarrollo. Al no leer de forma fiable productos ni etiquetas, se retiró de esta versión.

La incorporación mediante foto queda como posible función premium futura; no forma parte de la aplicación publicada.

**Pendiente de prueba en un dispositivo real:** aceptar notificaciones, enviar el aviso de prueba y comprobar la entrega programada. El navegador sin interfaz usado para las pruebas negó la suscripción push aunque tenía permiso de notificaciones; no sirve para validar la recepción real. En iPhone hay que añadir la web a la pantalla de inicio para recibir web push.

## Entrega del hackathon

Este repositorio debe publicarse en GitHub. Las bases exigen además una carpeta compartida de Google Drive con dos Google Docs separados (documentación técnica e historial de prompts), vídeo de demostración de hasta 5 minutos y la URL de la aplicación. La carpeta y archivos deben permitir ver a cualquiera con el enlace. No editar los entregables tras el cierre del 19 de octubre de 2026 a las 23:59, hora peninsular española.
