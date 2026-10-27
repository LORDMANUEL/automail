# AutoMail V0.7.1 — Seguridad de actualización y trazabilidad

Fecha: 2026-10-26. Complemento Thunderbird 153+.

## Cambios

- Preserva el ID `correo-calendario@local.addon` y la URL `https://lordmanuel.github.io/automail/updates.json`, fundamentales para descubrir actualizaciones desde 0.7.0.
- Si Thunderbird devuelve `mode=sendLater` o un error, no marca el correo como enviado: pasa a «Revisar» para inspección humana.
- Guarda Para/CC/CCO en `recipientAudit` incluso en estados inciertos tras iniciar la preparación del envío.
- Evita reintentos automáticos en estados `sending` recuperados al arrancar: los pasa a `review`.
- Corrige los textos de ayuda de actualizaciones; la instalación la gestiona Thunderbird.
- Añade pruebas de migración de almacenamiento y de envíos inciertos sin duplicados.

## Pruebas automatizadas

`python3 tools/package_release.py --base-url https://lordmanuel.github.io/automail/`
`python3 tools/qa_v070.py`

Comprobado de forma simulada: 10 CCO en un correo, fotografía HTML Base64, vCard, identificación, migración de preferencias y trabajos, conservación de CCO cuando hay un error.

## Límites de validación

Los tests no representan entrega real a todos los buzones. La V0.7.0 → 0.7.1 requiere verificar la actualización desde Thunderbird 153/158 con instalaciones reales. La web aloja actualizaciones independientes de ATN: incluir `update_url` impide listar exactamente esa compilación en ATN; una distribución ATN debe removerlo y someterse a revisión.

## SHA-256

El empaquetado es reproducible; el SHA aparece en `release-info.json` y `updates.json` después de compilar. No reemplazar un XPI ya publicado bajo el mismo número de versión.
