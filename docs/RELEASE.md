# Versiones y despliegue

**Canal oficial previsto:** https://lordmanuel.github.io/automail/updates.json
**ID permanente:** correo-calendario@local.addon
**V0.7.0:** primera versión con update_url en automail. Versiones antiguas apuntan a otra ruta; requiere actualización manual inicial.

Una actualización nativa requiere: XPI versionado en ruta pública HTTPS; updates.json con versión superior, update_link y hash SHA-256; gestor de complementos permitiendo actualizaciones; pruebas reales de migración.

No modificar un XPI publicado manteniendo su número de versión. La primera prueba completa será 0.7.0 → 0.7.1.