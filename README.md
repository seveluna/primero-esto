# Primero esto

Aplicación web para registrar alimentos del frigo, avisar antes de la fecha indicada y proponer recetas con los productos aún disponibles. Creada con Codex mediante instrucciones en lenguaje natural para el Hackathon de Vibe Coding, Máster en Inteligencia Artificial, Edición 7.

**Aplicación publicada:** https://primero-esto.seve-103.workers.dev

## Funciones

- Alta manual de alimentos con nombre, cantidad, unidad, fecha indicada y tipo de fecha.
- Edición posterior de los datos de cualquier alimento desde su fila en la despensa.
- Clasificación por secciones de supermercado (frutas y verduras, carnicería, pescadería, charcutería, lácteos y huevos, panadería, despensa, congelados, bebidas y otros), con agrupación y filtro en la lista.
- Registro e inicio de sesión con correo y contraseña. La cuenta conserva la despensa existente y permite abrirla en otros dispositivos. La página comprueba cambios cada 30 segundos mientras está abierta.
- Solo las personas con cuenta e inicio de sesión pueden añadir, editar o cambiar el estado de alimentos y productos de la compra. Las despensas compartidas mediante enlace secreto se pueden consultar sin cuenta, pero son de solo lectura.
- Lista de la compra con los alimentos agotados, agrupada por sección del supermercado. Permite apuntar productos manualmente, marcarlos como comprados y devolverlos al frigo con una nueva fecha.
- Avisos web push 3 días antes, 1 día antes y el mismo día de la fecha. Una tarea diaria a las 08:00 UTC revisa D1 y evita duplicados.
- Recetas de un catálogo local ordenadas según ingredientes disponibles y urgencia. Muestra ingredientes que faltan. Los productos consumidos, descartados o con fecha pasada no se usan para proponer recetas.
- Datos de ejemplo para que el jurado pueda probar la app desde una cuenta sin introducir alimentos reales.

## Arquitectura

- **Cloudflare Worker:** API y lógica de avisos.
- **Cloudflare D1:** alimentos, despensas, cuentas, sesiones, suscripciones push y registro de avisos enviados.
- **Assets estáticos y PWA:** interfaz HTML/CSS/JavaScript, manifest y service worker para recibir notificaciones.
- **Web Push con VAPID:** envía avisos incluso con la app cerrada, siempre que el navegador y el dispositivo permitan push y la persona haya concedido permiso.

Las contraseñas se derivan en dos pasadas de PBKDF2-SHA-256 de 100 000 iteraciones cada una, con sal aleatoria; no se guardan en texto claro. La sesión usa una cookie segura y HttpOnly de 30 días. Al registrar una despensa de invitado, su clave anterior se invalida. Quien tenga un nuevo enlace compartido puede acceder a esa despensa. Esta versión aún no verifica el correo ni ofrece recuperación de contraseña.

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
Para actualizar una base D1 creada antes de las cuentas, ejecutar `npx wrangler d1 execute primero-esto --remote --file=migrations/001_accounts.sql` antes del despliegue.
Para añadir las categorías a una base existente, ejecutar después `npx wrangler d1 execute primero-esto --remote --file=migrations/002_categories.sql`. Los alimentos antiguos comienzan en «Otros» y se pueden reclasificar al editarlos.
Para añadir la lista de la compra, ejecutar `npx wrangler d1 execute primero-esto --remote --file=migrations/003_shopping.sql`. La migración incorpora los alimentos ya marcados como agotados.

## Comprobaciones realizadas

- Sintaxis de Worker, interfaz y service worker.
- Alta, consulta y cambio de estado de alimentos en D1 local.
- Recorrido de alta en móvil y aparición de recetas.
- Acceso a la URL pública, alta y consulta en D1 remoto, clave pública de push.
- Registro con despensa existente, inicio de sesión en un segundo cliente, sincronización de datos, rechazo de contraseña incorrecta, cierre de sesión, enlaces compartidos y comprobación de origen de las solicitudes (en entorno local).
- Rechazo de escrituras anónimas, vista de invitado sin acciones de edición y protección frente a escrituras en una despensa ajena mediante su enlace compartido.
- Paso de agotados a la lista de la compra, reposición con nueva fecha y conservación del historial del producto antiguo.
- Se probó el reconocimiento de fotos durante el desarrollo. Al no leer de forma fiable productos ni etiquetas, se retiró de esta versión.

La incorporación mediante foto queda como posible función premium futura; no forma parte de la aplicación publicada.

**Pendiente de prueba en un dispositivo real:** aceptar notificaciones, enviar el aviso de prueba y comprobar la entrega programada. El navegador sin interfaz usado para las pruebas negó la suscripción push aunque tenía permiso de notificaciones; no sirve para validar la recepción real. En iPhone hay que añadir la web a la pantalla de inicio para recibir web push.

## Entrega del hackathon

Este repositorio debe publicarse en GitHub. Las bases exigen además una carpeta compartida de Google Drive con dos Google Docs separados (documentación técnica e historial de prompts), vídeo de demostración de hasta 5 minutos y la URL de la aplicación. La carpeta y archivos deben permitir ver a cualquiera con el enlace. No editar los entregables tras el cierre del 19 de octubre de 2026 a las 23:59, hora peninsular española.
