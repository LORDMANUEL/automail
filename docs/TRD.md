# TRD — arquitectura AutoMail

Thunderbird 153+, MailExtension Manifest V3. Background JavaScript realiza programación con Alarms y envío con Compose API; dashboard HTML/CSS/JS gestiona interfaz. Contactos vCard y listas desde APIs nativas; fotografías locales dentro del perfil Thunderbird; almacenamiento local/IndexedDB. No se solicitan contraseñas SMTP adicionales.

**Canal de actualizaciones permanente:** https://lordmanuel.github.io/automail/updates.json ; ID del complemento correo-calendario@local.addon (no cambiar); paquete XPI versionado y SHA-256.

**Seguridad:** permisos mínimos, HTML sanitizado, no JavaScript remoto, tratamiento local de fotos/contactos, transparencia CC/CCO; controles de consentimiento cuando corresponda.

**Limitaciones:** el correo se envía solo mientras Thunderbird está en ejecución. El éxito de Compose indica entrega al agente SMTP, no a cada buzón final. El calendario permite exportación ICS, sin sincronización nativa bidireccional garantizada.