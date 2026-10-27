# AutoMail V0.7.2 — Prueba de estrés: 100 envíos programados

**Ámbito:** prueba automatizada del background Thunderbird mediante implementación simulada de `messenger` y `storage.local`; no constituye envío SMTP real ni prueba física de apagar/encender Thunderbird. Fecha: 2026-10-27.

## Objetivo

Demostrar que se pueden crear al menos 100 programaciones, que las escrituras concurrentes no borran otras y que, tras reiniciar el contexto de ejecución, las programaciones mantienen IDs, estados y destinatarios. Un mensaje en proceso al cerrar debe quedar para revisión manual, sin duplicarse.

## Procedimiento exacto

1. Simular una cuenta de Thunderbird, almacén de `storage.local` durable en el harness y alarmas con periodicidad de un minuto.
2. Crear **100 trabajos** en cuatro solicitudes simultáneas de 25 cada una; validar 100 IDs distintos y estado `pending`.
3. Simular **primer cierre y reapertura** del proceso con el mismo almacén; verificar que los 100 sigan intactos y que ningún envío futuro haya ocurrido.
4. Colocar a propósito una tarea en `sending` simulando un cierre abrupto durante SMTP y efectuar **segunda reapertura** después de la hora programada.
5. Confirmar que la tarea interrumpida pase a `review` sin reenvío y que el procesador libere como máximo **5 trabajos por pasada**; simular 22 alarmas espaciadas por el fin de cada pasada.
6. Verificar **99 aceptaciones SMTP simuladas**, 1 trabajo para revisar, **0 duplicados**, **0 pendientes sin resolver** y 100 IDs conservados.
7. Efectuar **tercera reapertura** y confirmar que los 99 ya procesados no se vuelvan a enviar.
8. Crear otros **100 trabajos de una sola operación** y comprobar la integridad y persistencia de los 200 acumulados.

## Riesgos corregidos

- Antes las llamadas simultáneas a `createBatch`, `updateJob`, `cancel` y el planificador podían escribir versiones antiguas de toda la colección `scheduledMessages` y perder trabajos. Se introdujo una **cola transaccional asíncrona** para serializar operaciones sobre esa colección.
- Los eventos de arranque simultáneos compartían un proceso de inicialización que podía convertir un trabajo `sending` activo en `review` sin reinicio real. La recuperación se realiza **una sola vez por proceso de background**.
- Límite de creación por operación ampliado a **100** sin variar el límite precautorio del despachador (`MAX_SEND_PER_TICK = 5`).

## Interpretación operacional

- Thunderbird **cerrado**: el complemento no funciona ni envía correos, pero los trabajos guardados en `storage.local` del mismo perfil permanecen. Al reabrir, la extensión revisa los pendientes y vuelve a programar su alarma.
- **100 envíos vencidos simultáneamente**: a una velocidad de 5 por alarma de un minuto pueden requerir aproximadamente 20 pasadas/20 minutos, más la latencia SMTP. No hay garantía de puntualidad para los últimos correos ni de aceptación ilimitada por el servidor.
- Si el perfil es eliminado, la extensión se desinstala con borrado de datos, o el disco pierde información, `storage.local` no equivale a un respaldo externo.
- Un resultado SMTP simulado positivo confirma únicamente el funcionamiento del código, no la entrega a cada destinatario. Un envío ambiguo queda en `review` para no duplicarlo.

## Ejecución

```bash
node tests/test-v072-stress-100.js
python3 tools/package_release.py --base-url https://lordmanuel.github.io/automail/
python3 tools/qa_v070.py
```

**Pendiente de prueba real:** cerrar Thunderbird con 100 pendientes, abrirlo en el mismo perfil, contrastar antes/después, comprobar recepción en buzones de prueba y límites de SMTP con autorización de la administración del correo.
