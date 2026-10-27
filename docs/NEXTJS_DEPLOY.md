# Next.js para AutoMail en GitHub Pages

AutoMail usa Next.js 16 y React 19 con App Router, `output: 'export'`, `basePath: '/automail'` y recursos estáticos. No necesita Node.js en producción.

## Desarrollo y compilación

```bash
cd web
npm install
npm run dev
npm run build
cd ..
python3 tools/ci_prepare_site.py
```

El contenido publicable está en `_site/` y se despliega con el workflow `.github/workflows/pages.yml`.

## Acción administrativa necesaria

En GitHub, abre **Settings → Pages → Build and deployment → Source** y cambia de **Deploy from a branch** (Jekyll) a **GitHub Actions**. De lo contrario Jekyll puede continuar publicando `/docs` y reemplazar lo generado por Next.js.

## Descargas y actualizaciones

El workflow publica `updates.json` vacío si aún no se ha incorporado el código del XPI y no anuncia descargas falsas. Al incorporar fuentes completas, el pipeline verifica el XPI y copia `site/downloads`. Se debe activar el enlace de descarga real solo cuando el binario exista por HTTPS y se haya validado su SHA-256.

Las capturas del sitio se presentan como **vistas ilustrativas**, no se hacen pasar por capturas reales de Thunderbird.
