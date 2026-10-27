'use client';
import {useEffect,useState} from 'react';
const BASE='/automail/';
const ID='correo-calendario@local.addon';
export default function DownloadStatus(){
 const [state,setState]=useState({status:'checking'});
 useEffect(()=>{
  let cancelled=false;
  const check=async()=>{
   try{
    const res=await fetch(BASE+'updates.json',{cache:'no-store'});
    if(!res.ok) throw new Error('Manifiesto no accesible');
    const raw=await res.json();
    const versions=raw?.addons?.[ID]?.updates;
    if(!Array.isArray(versions)||versions.length===0){if(!cancelled)setState({status:'pending'});return;}
    const latest=versions.at(-1);
    if(!latest?.version||!latest?.update_link||
      !/^https:\/\/lordmanuel\.github\.io\/automail\/downloads\/correo-calendario-[0-9]+\.[0-9]+\.[0-9]+\.xpi$/.test(latest.update_link) ||
      !latest.update_link.endsWith('/correo-calendario-'+latest.version+'.xpi')){
      throw new Error('Registro de versión inconsistente');
    }
    const head=await fetch(latest.update_link,{method:'HEAD',cache:'no-store'});
    if(!head.ok)throw new Error('Instalador no disponible');
    if(!cancelled)setState({status:'ready',version:latest.version,url:latest.update_link});
   }catch(e){if(!cancelled)setState({status:'pending'});}
  };
  check();
  return()=>{cancelled=true};
 },[]);
 if(state.status==='ready')return <div className="download-live"><a className="btn primary" href={state.url}>↓ Descargar AutoMail {state.version}.xpi</a><p className="download-hint">Archivo oficial publicado en GitHub Pages. Instálalo desde Thunderbird → Complementos y temas.</p></div>;
 if(state.status==='checking')return <div aria-live="polite" className="warning">Comprobando instalador y canal de actualizaciones…</div>;
 return <div className="download-live"><p className="warning" role="status">● Instalador público pendiente: el XPI aún no está publicado en GitHub Pages.</p><a className="btn secondary" href="https://github.com/LORDMANUEL/automail/issues/2">Estado de la publicación ↗</a></div>;
}
