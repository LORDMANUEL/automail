'use client';
import {useState} from 'react';
import DownloadStatus from '../components/DownloadStatus';

const features=[
 ['✉','Programación','Elige fecha, hora y remitente desde Thunderbird.'],
 ['♧','Libretas y listas','Usa directamente tus contactos, sin registros duplicados.'],
 ['♢','Plantillas HTML','Personaliza felicitaciones, imágenes y comunicados.'],
 ['◎','Privacidad','Revisa Para, CC y CCO antes de programar.'],
 ['▣','Cumpleaños','Organiza felicitaciones a contactos y equipos.'],
 ['↻','Actualizaciones','Canal HTTPS preparado para distribuir próximas versiones.']
];
const steps=[
 ['01','Selecciona','Elige una persona o lista de tu agenda.'],
 ['02','Personaliza','Prepara la plantilla y escribe el mensaje.'],
 ['03','Programa','Revisa participantes, fecha y confirmación.']
];
const shots=[
 ['paso-1.svg','Destinatarios','Contactos, libretas y listas reutilizables.'],
 ['paso-2.svg','Plantillas','Texto, fotografías y datos personalizados.'],
 ['paso-3.svg','Confirmación','Verifica Para, CC y CCO antes de enviar.']
];
const repo='https://github.com/LORDMANUEL/automail';
const root='/automail';

export default function Home(){
 const [selected,setSelected]=useState(0);
 return <>
  <div className="top-strip">AUTOMAIL · COMPLEMENTO PARA THUNDERBIRD 153+</div>
  <header className="nav shell">
   <a href={root+'/'} className="logo" aria-label="AutoMail inicio"><span className="brandmark">✉</span><span>AutoMail<small>Correo Calendario</small></span></a>
   <nav aria-label="Navegación principal"><a href="#funciones">Funciones</a><a href="#pantallas">Capturas</a><a href="#flujo">App Flow</a><a href="#descarga">Descarga</a><a href={repo} target="_blank" rel="noreferrer">GitHub ↗</a></nav>
  </header>
  <main>
   <section className="hero">
    <div className="shell hero-inner">
     <div className="hero-copy">
      <span className="eyebrow">TU COMUNICACIÓN, MEJOR ORGANIZADA</span>
      <h1>El mensaje ideal, <em>en el momento correcto.</em></h1>
      <p>Programa felicitaciones, comunicados y mensajes desde Thunderbird con tus contactos, listas y plantillas. Menos pasos. Más claridad.</p>
      <div className="actions"><a className="btn primary" href="#descarga">Conocer AutoMail ↗</a><a className="btn secondary" href="#pantallas">Ver la interfaz ↓</a></div>
      <div className="facts"><span>✓ Thunderbird 153+</span><span>✓ Sin servidor adicional</span><span>✓ CC y CCO</span></div>
     </div>
     <div className="hero-image">
      <div className="pill">● Flujo intuitivo</div>
      <img width="1200" height="740" src={root+'/previews/paso-2.svg'} alt="Vista ilustrativa del editor de plantillas de AutoMail" />
      <div className="image-foot">Diseñado para usuarios reales</div>
     </div>
    </div>
   </section>
   <div className="feature-ribbon"><span>CALENDARIO</span><span>AGENDA THUNDERBIRD</span><span>PLANTILLAS HTML</span><span>CORREOS CON PRIVACIDAD</span></div>
   <section className="section shell" id="funciones">
    <div className="section-heading center"><span className="eyebrow">UNA SOLA HERRAMIENTA</span><h2>Todo lo que necesitas <em>para comunicar mejor.</em></h2><p>Útil para cualquier persona. Especialmente práctico para felicitaciones, atención a clientes y comunicaciones internas.</p></div>
    <div className="grid features">{features.map((f,i)=><article className="feature" key={i}><span className="feature-icon">{f[0]}</span><small>0{i+1}</small><h3>{f[1]}</h3><p>{f[2]}</p></article>)}</div>
   </section>
   <section className="section showcase" id="pantallas">
    <div className="shell">
     <div className="section-heading"><span className="eyebrow">ASÍ FUNCIONA</span><h2>Una experiencia <em>más sencilla.</em></h2><p>Explora tres vistas ilustrativas del flujo de uso. Las imágenes no sustituyen capturas verificadas de Thunderbird.</p></div>
     <div className="tabs" role="tablist" aria-label="Demostración">
      {shots.map((s,i)=><button key={s[0]} className={selected===i?'active':''} role="tab" aria-selected={selected===i} aria-controls="screen-preview" onClick={()=>setSelected(i)}>0{i+1} · {s[1]}</button>)}
     </div>
     <div id="screen-preview" className="screen-preview" role="tabpanel"><img src={root+'/previews/'+shots[selected][0]} width="1200" height="740" alt={'Vista ilustrativa: '+shots[selected][1]} /><div className="screen-caption"><div><h3>{shots[selected][1]}</h3><p>{shots[selected][2]}</p></div><div className="slide-buttons"><button aria-label="Anterior" onClick={()=>setSelected((selected+2)%3)}>←</button><button aria-label="Siguiente" onClick={()=>setSelected((selected+1)%3)}>→</button></div></div></div>
    </div>
   </section>
   <section className="section shell evidence" id="capturas-reales">
     <div className="section-heading"><span className="eyebrow">EVIDENCIA DE LA INTERFAZ</span><h2>Capturas de las pruebas <em>de AutoMail.</em></h2><p>Imágenes de pruebas visuales de la extensión con contactos ficticios. Muestran las pantallas del complemento; la recepción SMTP se valida por separado.</p></div>
     <div className="evidence-grid">
       <figure><a className="evidence-image" href={root+'/screens/contactos.jpg'} target="_blank" rel="noopener noreferrer" aria-label="Ampliar captura de agenda y contactos"><img src={root+'/screens/contactos.jpg'} alt="Agenda de contactos Thunderbird en pruebas de AutoMail" width="1366" height="768" loading="lazy"/></a><figcaption>Agenda y búsqueda de contactos <span aria-hidden="true">↗</span></figcaption></figure>
       <figure><a className="evidence-image" href={root+'/screens/contacto-editar.jpg'} target="_blank" rel="noopener noreferrer" aria-label="Ampliar captura de edición de contactos y fotografía"><img src={root+'/screens/contacto-editar.jpg'} alt="Edición de datos y fotografía de contacto en pruebas" width="1366" height="768" loading="lazy"/></a><figcaption>Editar contacto y fotografía <span aria-hidden="true">↗</span></figcaption></figure>
       <figure><a className="evidence-image" href={root+'/screens/destinatarios.jpg'} target="_blank" rel="noopener noreferrer" aria-label="Ampliar captura de verificación de los destinatarios"><img src={root+'/screens/destinatarios.jpg'} alt="Verificación de diez destinatarios CCO en pruebas" width="1366" height="768" loading="lazy"/></a><figcaption>Revisión de participantes CC y CCO <span aria-hidden="true">↗</span></figcaption></figure>
     </div>
   </section>
   <section className="section shell" id="flujo"><div className="section-heading center"><span className="eyebrow">APP FLOW</span><h2>Tres pasos. <em>Sin complicaciones.</em></h2><p>Desde la agenda hasta el envío, con los controles importantes siempre visibles.</p></div><div className="grid steps">{steps.map(s=><article key={s[0]}><strong>{s[0]}</strong><h3>{s[1]}</h3><p>{s[2]}</p></article>)}</div></section>
   <section className="section shell privacy"><div><span className="eyebrow">PRIVACIDAD INTELIGENTE</span><h2>Tú decides quién puede ver a los participantes.</h2><p>Felicita a una persona con copia CC o CCO a su equipo, o envía un comunicado a toda una lista manteniendo ocultas las direcciones.</p><a href={repo+'/blob/main/docs/APP_FLOW.md'}>Leer el App Flow completo ↗</a></div><div className="address-card"><span>EJEMPLO DE ENVÍO</span><p><b>Para</b> Persona felicitada</p><p><b>CC</b> Equipo visible (opcional)</p><p><b>CCO</b> Grupo oculto (opcional)</p><small>Los participantes CCO no aparecen en los correos recibidos.</small></div></section>
   <section className="download-band" id="descarga"><div className="shell download-inner"><div><span className="eyebrow">PUBLICACIONES</span><h2>AutoMail <em>última versión</em></h2><p>Instala el complemento XPI y mantén tus contactos en Thunderbird. La descarga aparece automáticamente cuando GitHub Pages publica un archivo verificado y lo registra en el manifiesto de actualizaciones.</p><DownloadStatus /></div><div className="download-buttons"><a className="btn secondary" href={repo}>Código fuente y versiones ↗</a><a href={root+'/updates.json'} className="manifest-link">Comprobar manifiesto de actualizaciones ↗</a></div></div></section>
   <section className="section shell faq"><div className="section-heading"><span className="eyebrow">AYUDA</span><h2>Preguntas frecuentes</h2></div><details><summary>¿Funciona si Thunderbird está cerrado?</summary><p>No. Thunderbird debe permanecer abierto o minimizado y la computadora encendida.</p></details><details><summary>¿Se ven las personas en CCO?</summary><p>No. Las direcciones colocadas en CCO se ocultan a los destinatarios.</p></details><details><summary>¿Se actualiza automáticamente desde GitHub?</summary><p>El canal está configurado; falta publicar y comprobar el XPI y una actualización real a una versión posterior.</p></details><details><summary>¿Está aprobado oficialmente por Mozilla?</summary><p>La revisión oficial de Thunderbird Add-ons todavía está pendiente.</p></details></section>
  </main>
  <footer><div className="shell footer-grid"><div><strong>✉ AutoMail</strong><p>Mensajes mejor organizados.</p></div><div className="footer-links"><a href={repo}>Código fuente</a><a href={repo+'/blob/main/docs/PRD.md'}>PRD</a><a href={repo+'/blob/main/docs/TRD.md'}>TRD</a><a href={repo+'/blob/main/docs/PRIVACY.md'}>Privacidad</a></div><div className="footer-credit">Agradecimientos a <strong>Luis Manuel Fajardo</strong></div></div><div className="shell legal">Proyecto independiente no afiliado oficialmente a Mozilla ni Thunderbird.</div></footer>
 </>;
}
