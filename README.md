# ✉️ AutoMail — Correo Calendario para Thunderbird

**V0.7.0 · Thunderbird 153+ · Proyecto en preparación de publicación**

AutoMail automatiza felicitaciones, comunicados y correos programados desde las cuentas existentes de Thunderbird. Permite un solo mensaje con múltiples destinatarios ocultos en CCO, o una felicitación a una persona con copia visible (CC) u oculta (CCO). Utiliza las libretas y listas nativas; RRHH y SAC son casos de uso, no módulos obligatorios.

## ¿Por qué existe?
El proyecto nació de una necesidad real: evitar fechas olvidadas, duplicaciones de contactos, composiciones manuales repetitivas y mensajes cuyos participantes no podían verificarse. Las versiones iniciales se probaron en Thunderbird y se corrigieron problemas de API de envío, fotos, plantillas, calendarios y listas.

## Visión y objetivos
Un complemento local, ligero, seguro, universal y fácil de usar. Su flujo ideal es **destinatarios → mensaje/plantilla → revisar y programar**. Debe permitir visualizar Para, CC y CCO antes de enviar, conservar el historial y publicar actualizaciones reproducibles por HTTPS.

## Documentación del proyecto
- [Origen, visión y objetivos](docs/ORIGEN_Y_VISION.md)
- [PRD — requisitos del producto](docs/PRD.md)
- [TRD — arquitectura técnica](docs/TRD.md)
- [App Flow](docs/APP_FLOW.md)
- [Roadmap y metas](docs/ROADMAP.md)
- [Política de privacidad](docs/PRIVACY.md)
- [Revisión preliminar Mozilla/ATN](docs/MOZILLA_REVIEW.md)
- [QA y pendientes](docs/QA.md)
- [Versiones y canal de actualizaciones](docs/RELEASE.md)
- [Historial de cambios](docs/CHANGELOG.md)

## GitHub Pages
La página informativa está en [docs/index.html](docs/index.html). Se puede publicar activando **Settings → Pages → Build and deployment → Deploy from a branch → main /docs**.

**Dirección prevista:** https://lordmanuel.github.io/automail/

**Canal previsto de actualizaciones:** https://lordmanuel.github.io/automail/updates.json

## Estado real de la V0.7.0
✅ Proyecto documentado y PR #1 fusionado.

✅ Artefactos locales generados: XPI, código fuente completo, paquete Pages y SHA-256.

✅ Pruebas de sintaxis, vCard, listas CCO e integridad en entorno local.

⚠️ El **XPI y los archivos de código completos todavía deben subirse a este repositorio** desde el paquete de entrega. El manifiesto público de actualizaciones permanece deliberadamente vacío; no anunciará descargas inexistentes.

⚠️ GitHub Pages no se ha verificado en vivo. Falta activar Pages y publicar el binario.

⚠️ Sin prueba SMTP real de V0.7.0 ni prueba de actualización 0.7.0→0.7.1. Sin revisión oficial Mozilla/ATN.

## Publicación del paquete completo
Clona este repositorio con GitHub Desktop, copia dentro de la carpeta clonada los archivos descomprimidos de `automail-0.7.0-codigo-completo.zip`, crea un commit y haz **Push**. Verifica que `site/downloads/correo-calendario-0.7.0.xpi` y `site/updates.json` aparezcan en GitHub. El paquete incluye un workflow GitHub Actions para validación y despliegue desde `site/`, que podrá usarse seleccionando **GitHub Actions** como origen de Pages.

Una vez publicada V0.7.0, las siguientes versiones deberán mantener el mismo ID `correo-calendario@local.addon`, aumentar versión y actualizar `updates.json` con el SHA-256 del XPI. Los usuarios de V0.6.x deben instalar la V0.7.0 manualmente una vez para adoptar el nuevo canal.

**Condición de funcionamiento:** Thunderbird abierto/minimizado y PC encendida. La aceptación SMTP no garantiza recepción final por cada buzón.

**Agradecimientos a Luis Manuel Fajardo.**