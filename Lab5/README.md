# SANTI.AI

Chat sencillo con React, Vite y Gemini. La clave de Gemini se usa únicamente en el servidor Node; nunca se incluye en el código enviado al navegador.

## Inicio

1. Instala las dependencias con `npm install`.
2. Copia `.env.example` a `.env` y escribe tu clave en `GEMINI_API_KEY`.
3. Ejecuta `npm run dev` y abre `http://localhost:5173`.

Para producción: `npm run build` y después `npm run start`. El despliegue debe ejecutar el servidor Node; publicar solo `dist` no habilita `/api/chat`.

El historial de conversaciones se guarda localmente en el navegador. El icono superior abre el panel para recuperar o borrar chats y crear una nueva conversación.

La interfaz usa los componentes SideRays, CurvedInput, Shuffle y SlingButton de React Bits. Al enviar, el texto se anima desde el campo hasta la conversación antes de solicitar la respuesta de Gemini.

## Diagnosticar errores de Gemini

Si falla un mensaje, abre **Ver detalles técnicos** en el aviso del chat. Ahí aparecen el código HTTP, el estado y mensaje de Gemini, la cuota afectada y el tiempo de espera cuando Google los proporciona. El servidor también registra estos datos sin imprimir la clave. La aplicación hace **un solo intento por mensaje**; no reintenta automáticamente.

- `429`: límite de solicitudes, tokens o cuota. El detalle `Cuota afectada` ayuda a distinguir el límite; revisa también [los límites de tu proyecto en Google AI Studio](https://aistudio.google.com/rate-limit).
- `402`: créditos prepagados agotados.
- `400`, `401` o `403`: solicitud, clave o permisos; revisa el motivo específico.
- `404`: modelo no disponible.
- `503`: servicio temporalmente no disponible; no demuestra que se agotó la cuota.
- Timeout o error de conexión: no llegó una respuesta de Gemini, por lo que tampoco confirma el estado de la cuota.
