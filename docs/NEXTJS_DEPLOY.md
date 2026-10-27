# Despliegue web AutoMail — Next.js

## Flujo activo (dos modos de GitHub Pages compatibles)

El repositorio usa **Next.js 16 con exportación estática**, no un servidor Next.js en producción. `.github/workflows/pages.yml` hace:

1. Instalar dependencias Node 22, generar `package-lock.json`, compilar `web/out`.
2. Ejecutar `tools/ci_prepare_site.py` y verificar imágenes y manifiesto.
3. Copiar `_site/` a `docs/`, incluyendo `_next` y `.nojekyll`, y confirmar el resultado con `github-actions[bot]`.
4. Publicar directamente `_site/` con `actions/deploy-pages`.

Esto también permite que siga funcionando el origen anterior **Deploy from a branch → main /docs**, evitando que el Jekyll heredado sustituya la interfaz. GitHub recomienda cambiar Pages a **GitHub Actions**, pero la copia de `docs/` proporciona compatibilidad sin depender de un cambio manual.

## Comprobar la publicación

- Web pública: https://lordmanuel.github.io/automail/
- Acción: https://github.com/LORDMANUEL/automail/actions
- Galería Next: https://lordmanuel.github.io/automail/#pantallas
- Manifiesto: https://lordmanuel.github.io/automail/updates.json

Para que `_next/` (CSS/JS) sea público **es obligatorio** `docs/.nojekyll`.

## Entrega XPI y versionado

La web puede publicarse aunque falte el XPI: en ese caso, `updates.json` contiene `updates: []`. Es una protección deliberada. El código completo del complemento debe subirse al repositorio para que `tools/package_release.py` empaquete el binario. No anunciar `downloads/` antes de probar la URL y su SHA-256.

Una vez publicado el complemento, el canal de actualizaciones será `https://lordmanuel.github.io/automail/updates.json`. La primera prueba de actualización es V0.7.0 → V0.7.1 y debe verificarse en Thunderbird real.

## Observaciones

- No hay almacenamiento de credenciales SMTP en Pages.
- Next.js no usa SSR, rutas dinámicas ni optimizador de imágenes de servidor.
- Las imágenes del sitio son representaciones ilustrativas, no capturas verificadas del XPI.
