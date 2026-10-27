# AutoMail 0.7.2 — Persistencia, concurrencia y estrés

- ID y canal `update_url` iguales a V0.7.0 y V0.7.1.
- Escrituras serializadas de `scheduledMessages` para evitar pérdida por solicitudes paralelas.
- Inicio idempotente: varios eventos startup/onInstalled no reparan indebidamente un correo activo.
- Crear hasta 100 trabajos en una única solicitud, además de acumular trabajos sin límite fijo de 100 (dependiente del almacenamiento disponible).
- Despacho conservador: 5 envíos vencidos por alarma. Se mantiene el estado `review` ante cierre durante envío sin confirmar.
- Prueba de estrés reproducible: `tests/test-v072-stress-100.js`; ver `docs/QA_STRESS_V072.md`.

No incluye servicio en segundo plano cuando Thunderbird está cerrado. No valida que 100 mensajes fueran aceptados por un servidor SMTP real.
