# GitHub Actions: publicación y actualizaciones
## Workflows
- `pages.yml`: cada push a `main` valida la web y despliega GitHub Pages. Cuando aparezcan las fuentes completas del complemento, compila el XPI y genera un `updates.json` con SHA-256.
- `ci.yml`: QA de cambios en pull requests y ejecución manual.
- `release.yml`: publica el XPI como GitHub Release al crear una etiqueta `vX.Y.Z`, tras las pruebas y comparación de versión.
## Primera activación
Una vez, en **Settings → Pages → Build and deployment → Source: GitHub Actions**. Esta configuración requiere acceso de administrador al repositorio. Un workflow sin token administrativo no puede habilitar Pages por su cuenta.
## Estado inicial
Los archivos fuente de V0.7.0 todavía no están subidos a GitHub; mientras tanto, el despliegue publica la web y mantiene el manifiesto de actualizaciones vacío. No muestra descargas inexistentes.
## Canal de actualización
URL: `https://lordmanuel.github.io/automail/updates.json`.
No cambiar el ID `correo-calendario@local.addon`. Para demostrar que funciona, probar actualización V0.7.0 → V0.7.1 en Thunderbird real.
## Compatibilidad Mozilla
Una versión con `update_url` de alojamiento propio sirve como distribución independiente; no es apta para listado en ATN con dicha configuración. Para una distribución ATN, preparar un paquete/canal diferente sin `update_url` e iniciar revisión oficial.
