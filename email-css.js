/* Correo Calendario 0.5.3 — núcleo CSS compartido.
 * 1) Vista previa: se admiten animaciones CSS no críticas, dentro de iframe aislado.
 * 2) Correo real: reglas estáticas convertidas a estilos inline; animaciones progresivas
 *    solo como mejora opcional. Debe seguir viéndose bien si se elimina <style>.
 * 3) Nunca se ejecuta JS recibido ni se descargan recursos CSS externos.
 */
const CCEmailCSS = (() => {
  'use strict';
  const MAX_CSS = 25000;
  const MAX_HTML = 140000;
  const allowed = new Set(`color background background-color font-family font-size font-weight font-style line-height letter-spacing text-align text-decoration text-transform vertical-align width max-width min-width height max-height min-height padding padding-top padding-right padding-bottom padding-left margin margin-top margin-right margin-bottom margin-left border border-top border-right border-bottom border-left border-color border-width border-style border-radius border-collapse border-spacing display opacity mso-line-height-rule`.split(' '));
  const previewOnly = new Set(['animation','animation-name','animation-duration','animation-delay','animation-iteration-count','animation-timing-function','transform','transition','transform-origin']);
  const voidTags = new Set(['img','br','hr','input','meta','link','source','wbr','area']);
  const tagBan = 'script,iframe,object,embed,form,input,button,textarea,select,link,meta,base,svg,math,video,audio,canvas,style';
  const attrBad = /url\s*\(|@import|expression\s*\(|(?:-moz-binding|behavior)\s*:|[<>\\]/i;
  function validateCss(css){
    const s=String(css||'');
    if(s.length>MAX_CSS)throw Error('CSS demasiado largo (máximo 25 KB).');
    if(/@import|@font-face|url\s*\(|expression\s*\(|javascript\s*:|[<>]|-moz-binding/i.test(s)) throw Error('CSS no permitido: elimina @import, URLs, etiquetas HTML o expresiones ejecutables.');
    if(/@(?!keyframes\b|media\b)/i.test(s.replace(/\/\*[\s\S]*?\*\//g,'')))throw Error('Solo se permite @keyframes y reglas CSS sencillas (sin @import).');
    return s;
  }
  function extract(html,css=''){
    const raw=String(html||'');
    if(raw.length>MAX_HTML)throw Error('HTML demasiado largo (máximo 140 KB).');
    const blocks=[];
    const without=raw.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi,(_,content)=>{blocks.push(content);return '';});
    return {html:without,css:validateCss(blocks.join('\n')+'\n'+String(css||''))};
  }
  function declarations(str, preview=false){
    const pairs=[];
    for(const raw of String(str||'').split(';')){
      const i=raw.indexOf(':');if(i<=0)continue;
      const property=raw.slice(0,i).trim().toLowerCase();const value=raw.slice(i+1).trim();
      if(!(allowed.has(property)||(preview&&previewOnly.has(property))))continue;
      if(!value||value.length>250||attrBad.test(value)||/[{}]/.test(value)||/!important/i.test(value))continue;
      // CSS custom properties and dangerous features are intentionally excluded.
      if(/(?:fixed|absolute|sticky|expression|var\(|calc\()/i.test(value))continue;
      pairs.push([property,value]);
    }
    return pairs;
  }
  function scan(css){
    // Parse top-level rule braces, supporting nested @keyframes / @media boundaries.
    const input=validateCss(css).replace(/\/\*[\s\S]*?\*\//g,'');
    const out=[];let pos=0;
    while(pos<input.length){
      const open=input.indexOf('{',pos);if(open<0)break;
      const head=input.slice(pos,open).trim();let depth=1,end=open+1;
      for(;end<input.length&&depth;end++){if(input[end]==='{')depth++;else if(input[end]==='}')depth--;}
      if(depth)throw Error('CSS inválido: falta una llave de cierre.');
      const body=input.slice(open+1,end-1);pos=end;
      if(head)out.push({selector:head,body});
    }
    return out;
  }
  function ruleCss(selector,decs){return `${selector}{${decs.map(([p,v])=>`${p}:${v}`).join(';')}}`;}
  function animationRules(css){
    const result=[];
    for(const rule of scan(css)){
      if(/^@keyframes\s+[a-z][\w-]*$/i.test(rule.selector)){
        const frames=[];
        for(const f of scan(rule.body)){
          if(!/^(?:from|to|\d{1,3}%)(?:\s*,\s*(?:from|to|\d{1,3}%))*$/i.test(f.selector))continue;
          const dec=declarations(f.body,true).filter(([p])=>['opacity','transform','color','background-color'].includes(p));
          if(dec.length)frames.push(ruleCss(f.selector,dec));
        }
        if(frames.length)result.push(`${rule.selector}{${frames.join('')}}`);
      }
    }
    return result.join('\n');
  }
  function cleanElement(el){
    for(const a of Array.from(el.attributes)){
      const key=a.name.toLowerCase(),value=a.value.trim();
      if(key.startsWith('on')||['srcdoc','formaction','contenteditable'].includes(key)){el.removeAttribute(a.name);continue;}
      if(key==='style'){
        const valid=declarations(value).map(([p,v])=>`${p}:${v}`).join(';');
        if(valid)el.setAttribute('style',valid);else el.removeAttribute('style');
      }
      if(['src','href','background'].includes(key)){
        if(key==='src'&&/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(value))continue;
        if(key==='href'&&/^https:\/\/[^\s"'<>]+$/i.test(value))continue;
        el.removeAttribute(a.name);
      }
    }
  }
  function selectSafe(selector){
    // Tags, IDs and classes only; no sibling combinators, attributes, pseudo-selectors or wildcard.
    return /^[a-z.#][\w.#\s>-]*(\s*,\s*[a-z.#][\w.#\s>-]*)*$/i.test(selector);
  }
  function compile(inputHTML,inputCSS='',opts={}){
    const {html,css}=extract(inputHTML,inputCSS);
    const doc=new DOMParser().parseFromString(html,'text/html');
    for(const e of Array.from(doc.querySelectorAll(tagBan)))e.remove();
    const elements=Array.from(doc.body.querySelectorAll('*'));
    elements.forEach(cleanElement);
    const originalInline=new Map(elements.map(el=>[el,new Map(declarations(el.getAttribute('style')||''))]));
    const accumulated=new Map();
    for(const rule of scan(css)){
      if(rule.selector.startsWith('@')||!selectSafe(rule.selector))continue;
      const valid=declarations(rule.body);
      if(!valid.length)continue;
      let matches=[];try{matches=doc.body.querySelectorAll(rule.selector);}catch{continue;}
      for(const el of matches){
        const styles=accumulated.get(el)||new Map();
        for(const [prop,value] of valid)styles.set(prop,value);
        accumulated.set(el,styles);
      }
    }
    for(const el of elements){
      const computed=new Map(accumulated.get(el)||[]);
      // El atributo style original siempre tiene preferencia sobre las reglas CSS.
      for(const [prop,value] of originalInline.get(el)||[])computed.set(prop,value);
      if(computed.size)el.setAttribute('style',[...computed].map(([prop,value])=>`${prop}:${value}`).join(';'));
    }
    const markup=doc.body.innerHTML;
    if(opts.progressive===false)return markup;
    // Feature enhancement only. Unsupported clients ignore this style block.
    const anim=animationRules(css);
    const selectors=[];
    if(anim){for(const rule of scan(css)){
      if(!selectSafe(rule.selector))continue;
      const a=declarations(rule.body,true).filter(([p])=>previewOnly.has(p));
      if(a.length)selectors.push(ruleCss(rule.selector,a));
    }}
    return anim?`<style type="text/css">${anim}\n${selectors.join('\n')}</style>${markup}`:markup;
  }
  function previewCSS(inputHTML,inputCSS=''){
    const {css}=extract(inputHTML,inputCSS);
    // Only sanitized declarations/classes, with optional keyframes; no CSS external fetch.
    const arr=[];for(const rule of scan(css)){
      if(!selectSafe(rule.selector))continue;
      const dec=declarations(rule.body,true);
      if(dec.length)arr.push(ruleCss(rule.selector,dec));
    }
    return `${animationRules(css)}\n${arr.join('\n')}`;
  }
  function analyze(inputHTML,inputCSS=''){
    const {css}=extract(inputHTML,inputCSS);
    const parsed=scan(css);
    let effects=0,ignored=0,accepted=0;
    for(const rule of parsed){if(rule.selector.startsWith('@')){effects++;continue;}
      const vals=String(rule.body).split(';').filter(x=>x.includes(':'));
      const valid=declarations(rule.body);accepted+=valid.length;ignored+=Math.max(0,vals.length-valid.length);
    }
    return {rules:parsed.length,accepted,ignored,effects,summary:`${accepted} declaraciones CSS para correo · ${effects} efectos de animación opcionales · ${ignored} declaraciones no compatibles omitidas.`};
  }
  function prettyHTML(html){
    const doc=new DOMParser().parseFromString(String(html||''),'text/html');
    const render=(node,depth=0)=>{
      const pad='  '.repeat(depth);
      if(node.nodeType===3){const txt=node.textContent.trim();return txt?pad+txt+'\n':'';}
      if(node.nodeType!==1)return '';
      const attrs=[...node.attributes].map(a=>` ${a.name}="${a.value.replace(/"/g,'&quot;')}"`).join('');
      const open=`${pad}<${node.tagName.toLowerCase()}${attrs}>`;
      if(voidTags.has(node.tagName.toLowerCase()))return open+'\n';
      if(node.childNodes.length===1&&node.firstChild.nodeType===3)return `${open}${node.textContent}</${node.tagName.toLowerCase()}>\n`;
      return `${open}\n${[...node.childNodes].map(n=>render(n,depth+1)).join('')}${pad}</${node.tagName.toLowerCase()}>\n`;
    };
    return [...doc.body.childNodes].map(n=>render(n)).join('').trim();
  }
  function prettyCSS(css){return validateCss(css).replace(/\s*\{\s*/g,' {\n  ').replace(/;\s*/g,';\n  ').replace(/\s*\}\s*/g,'\n}\n\n').replace(/\n\s*\n\s*\n/g,'\n\n').trim();}
  return {validateCss,extract,compile,previewCSS,analyze,prettyHTML,prettyCSS};
})();
globalThis.CCEmailCSS=CCEmailCSS;
