# Primero esto — historial de prompts

**Plataforma utilizada:** Codex.  
**Proyecto:** Hackathon de Vibe Coding, edición 7.  
**Formato:** registro cronológico de las instrucciones dadas por el participante al agente, equivalente al historial solicitado en las bases. Se conserva la redacción original, incluidas erratas. Las respuestas del agente y los cambios de código pueden consultarse en la conversación de trabajo y en el historial del repositorio.

1. «https://campus.thebigschool.com/wp-content/uploads/2026/10/Bases-Hackaton-Vibecoding-E7.docx.pdf voy a participar en este hackaton»
2. «Voy solo y por ahora no tengo ninguna idea.»
3. «Pues me solucionaría un problema. Registramos la compra que añadamos al frigo con sus respectivas fechas de caducidad, la app nos manda notificaciones cuando vaya a llegar la fecha y nos proporciona recetas con lo que queda en el frigo si no lo hemos marcado como terminado.»
4. «La subida de alimentos podría hacerse mediante foto y como base de datos podríamos usar Firebase ya que también nos serviría para las notificaciones.»
5. Respuesta a la pregunta sobre qué fotografiar: «Productos y etiquetas».
6. «Existe alguna solución más económica que Firebase?»
7. «Pues vamos con Cloudflare».
8. Respuesta a la pregunta sobre la cuenta de Cloudflare: «Sí, ya tengo cuenta».
9. «El tema de subir la imagen lo vamos a quitar por ahora porque no reconoce la imagen ni los textos. A lo mejor lo ponemos como algo premiujm en un futuro».
10. «Necesito que haya alta de usuarios para que el usuario pueda abrir su despensa en cualquier dispositiva y esta se quede guardada y sioncronizada».
11. «Los productos deben poder editarse a posteriori también».
12. «Los alimentos podrán categorizarse como están en el supermercado».
13. «Debe de haber un lugar donde encontrar los productos agotados en el frigo que sirva como lista de la compra».
14. «Si un usuario no está registrado no debería de poder añadir alimentos».
15. «Como controlamos la fecha de caducidad de verduras y frutas? Podría haber un tiempo estimado de vida en el frigo según el alimento que sea».
16. «Como van a llegar los avisos en el smartphone?».
17. «Las ventanas modales en el smartphone cuando se abren se salen de la pantalla».
18. «Como se crean las recetas. Estaría bien poner un botón para crear lasrecetas con los alimentos que hay en la despensa en ese momento, a parte de las que te cree automaticamente al estar caducando los alimentos».
19. «Podemos añadir una opción para que el usuario pueda conectar a la app su IA preferida mediante una API?».
20. «Por ahora que cada usuario añada su IA. A un futuro podría ponerle una clave única y poner esta opción en la versión premium».
21. «Puedes subir el codigo a este repo https://github.com/seveluna/primero-esto.git y crearme los documentos para el hackthon?».
22. «Le he pegado una API key de OpenAI y no funciona para crearme recetas».
23. Respuesta a la pregunta por el mensaje de error: «No se pudo conectar con el proveedor de IA. Inténtelo de nuevo.»

## Respuestas adicionales que orientaron el producto

- A la pregunta sobre el canal de los avisos: «En el móvil o navegador (recomendado)».
- A la pregunta sobre el tipo de foto: «Productos y etiquetas».
- A la pregunta sobre si tenía cuenta Cloudflare: «Sí, ya tengo cuenta».

## Iteraciones resultantes

Las instrucciones 1–3 definieron el problema; 4–9 determinaron el alcance de la entrada de datos y la infraestructura; 10–17 añadieron persistencia, gestión diaria, fechas estimadas y mejoras móviles; 18–20 ampliaron las recetas y la conexión voluntaria a un proveedor de IA; 21 preparó la entrega; 22–23 motivaron la corrección de la llamada desde Cloudflare Workers a OpenAI. La función de foto y una clave de IA común para una versión premium quedan fuera del MVP.
