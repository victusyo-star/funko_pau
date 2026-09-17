/* Funko Pau V5 — local-only editing. No credentials, remote writes or dependencies.
   Published data, draft data and exported data have separate lifecycles. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const clone = value => JSON.parse(JSON.stringify(value));
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const t = (en, es) => document.documentElement.lang === 'es' ? es : en;
  const key = 'funko-pau-v5-draft';
  const published = clone({people:window.POP_PEOPLE, collection:window.POP_COLLECTION});
  const catalog = new Map(window.POP_CATALOG.map(item => [item.id, item]));
  const canonical = value => JSON.stringify(value, function(k, v) {
    return v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(name => [name,v[name]])) : v;
  });
  const equal = (a,b) => canonical(a) === canonical(b);
  const stamp = data => { let h=2166136261; for(const c of canonical(data)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0'); };
  const asset = path => !path || (typeof path === 'string' && /^assets\/[A-Za-z0-9_./-]+$/.test(path) && !path.includes('..'));
  let draft = clone(published), base = clone(published), active=false, stored=false, storageOK=true, corrupt=false;
  let externalConflict=false;
  let undo=[], pendingPackage=null, lastTrigger=null, detailId=null, toastTimer;
  // A source check catches publication while this tab is open. file:// uses snapshots on reopening.
  async function readSources(){
    if(!/^https?:$/.test(location.protocol))return null;
    const texts=await Promise.all(['people.js','collection.js'].map(async file=>{
      const response=await fetch(file+'?pau-check='+Date.now(),{cache:'no-store'});
      if(!response.ok)throw new Error('source');return response.text();
    }));return texts;
  }
  const sourceAtOpen = readSources().catch(()=>null);
  const button = (label, action, primary=false, disabled=false) => `<button type="button" class="pau-editor-button${primary?' primary':''}" data-pau="${action}"${disabled?' disabled':''}>${escape(label)}</button>`;
  const toggle=document.createElement('button');toggle.id='pau-editor-toggle';toggle.type='button';toggle.textContent='✧';toggle.setAttribute('aria-pressed','false');
  $('#language').after(toggle);
  const bar=document.createElement('aside');bar.className='pau-editor-bar';bar.hidden=true;$('main').prepend(bar);
  const dialog=document.createElement('dialog');dialog.className='pau-editor-dialog';dialog.setAttribute('aria-labelledby','pau-editor-title');document.body.append(dialog);
  const notice=document.createElement('div');notice.className='pau-editor-toast';notice.hidden=true;notice.setAttribute('role','status');document.body.append(notice);
  function toast(message){notice.textContent=message;notice.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>notice.hidden=true,6000);}
  function open(title, content){
    if(!dialog.open)lastTrigger=document.activeElement;
    dialog.innerHTML=`<button class="pau-editor-close" type="button" data-pau="close" aria-label="${t('Close','Cerrar')}">×</button><h2 id="pau-editor-title">${escape(title)}</h2>${content}<p class="pau-editor-error" role="alert" id="pau-editor-error"></p>`;
    if(!dialog.open)dialog.showModal();
    dialog.querySelector('input,select,textarea,button:not(.pau-editor-close)')?.focus();
  }
  function error(message){$('#pau-editor-error').textContent=message;}
  dialog.addEventListener('close',()=>{if(lastTrigger?.isConnected)lastTrigger.focus({preventScroll:true});});
  function dirty(){return !equal(draft,base);}
  function stale(){return !equal(base,published);}
  function save(){
    stored=true;
    try{localStorage.setItem(key,JSON.stringify({format:'funko-pau-draft',version:1,base,data:draft,savedAt:new Date().toISOString()}));storageOK=true;}
    catch{storageOK=false;}
  }
  function validate(data){
    if(!data || !data.people || !Array.isArray(data.people.contributors) || !Array.isArray(data.collection))throw new Error('shape');
    if(data.collection.length>10000 || data.people.contributors.length>1000)throw new Error('size');
    if(!equal(data.people.owner,published.people.owner))throw new Error('owner');
    const ids=new Set();
    for(const person of data.people.contributors){
      if(typeof person.id!=='string'||!/^[a-z0-9_-]{1,80}$/.test(person.id)||ids.has(person.id)||typeof person.name!=='string'||!person.name.trim()||person.name.length>80||!asset(person.image))throw new Error('person');
      ids.add(person.id);
    }
    const records=new Set();
    for(const record of data.collection){
      if(!catalog.has(record.catalogId)||records.has(record.catalogId)||!['owned','wishlist'].includes(record.status)||!['Bought','Gifted','Traded','Other',null].includes(record.acquisition??null))throw new Error('record');
      if(record.giftedBy && (!ids.has(record.giftedBy)||record.acquisition!=='Gifted'))throw new Error('gift');
      if(record.notes!=null&&(typeof record.notes!=='string'||record.notes.length>2000))throw new Error('notes');
      if(record.acquiredAt && (!/^\d{4}-\d{2}-\d{2}$/.test(record.acquiredAt)||Number.isNaN(Date.parse(record.acquiredAt))||new Date(record.acquiredAt).toISOString().slice(0,10)!==record.acquiredAt))throw new Error('date');
      records.add(record.catalogId);
    }
    if(JSON.stringify(data).includes('"__proto__"'))throw new Error('keys');
  }
  function load(){
    try{
      const raw=localStorage.getItem(key);if(!raw)return;
      const parsed=JSON.parse(raw);validate(parsed.data);validate(parsed.base);
      if(parsed.format!=='funko-pau-draft'||parsed.version!==1)throw new Error('format');
      draft=parsed.data;base=parsed.base;stored=true;
    }catch{corrupt=true;}
  }
  load();
  function changes(){
    const result=[];
    for(const row of draft.collection){const old=base.collection.find(x=>x.catalogId===row.catalogId);if(!equal(old,row))result.push({kind:'figure',label:catalog.get(row.catalogId)?.name||row.catalogId,id:row.catalogId,before:old,after:row});}
    for(const person of draft.people.contributors){const old=base.people.contributors.find(x=>x.id===person.id);if(!equal(old,person))result.push({kind:'contributor',label:person.name,id:person.id,before:old,after:person});}
    return result;
  }
  function updateBar(){
    toggle.title=toggle.ariaLabel=t('Collection editor','Editor de la colección');toggle.setAttribute('aria-pressed',String(active));bar.hidden=!active;
    if(!active)return;
    const count=changes().length;
    bar.innerHTML=`<div><strong>${t('Editing your draft','Editando tu borrador')}</strong><p role="status">${storageOK?t('Saved on this device · Not published','Guardado en este dispositivo · Sin publicar'):t('Browser saving unavailable · Download a backup before leaving','No se puede guardar en el navegador · Descarga una copia antes de salir')} · ${count} ${t('changed entries','entradas modificadas')}</p>${stale()?`<p>${t('A newer published version exists. Review before exporting.','Hay una versión publicada más reciente. Revísala antes de exportar.')}</p>`:''}</div><div class="pau-editor-actions">${button(t('Contributors','Colaboradores'),'people')}${button(t('Undo','Deshacer'),'undo',false,!undo.length)}${button(t('Backup / restore','Copia / restaurar'),'backup')}${button(t('Finish','Terminar'),'review',true)}${button(t('Exit','Salir'),'exit')}</div>`;
  }
  function preview(){window.PauView.replaceData(active?clone(draft):clone(published));updateBar();}
  function commit(next){if(corrupt)throw new Error('restore or reset the unreadable draft first');if(externalConflict)throw new Error('tab conflict');validate(next);undo.push(clone(draft));if(undo.length>50)undo.shift();draft=next;save();preview();}
  function enter(){
    active=true;preview();dialog.close();
    if(corrupt)open(t('Check your saved draft','Revisa tu borrador guardado'),`<p>${t('The saved draft could not be read. It has not been deleted. Restore a backup or explicitly start again.','No se ha podido leer el borrador. No se ha eliminado. Restaura una copia o empieza de nuevo explícitamente.')}</p><div class="pau-editor-actions">${button(t('Backup / restore','Copia / restaurar'),'backup')}${button(t('Start again','Empezar de nuevo'),'reset')}</div>`);
    else if(stale())reconcile();
    else if(stored)toast(t('Your saved draft is ready.','Tu borrador guardado está listo.'));
  }
  toggle.addEventListener('click',()=>{
    if(active){review();return;}
    open(t('Pau’s editing mode','Modo de edición de Pau'),`<p>${t('Changes stay on this device until you download and send an update.','Los cambios se quedan en este dispositivo hasta que descargues y envíes una actualización.')}</p><form id="pau-pin-form" class="pau-editor-form"><label>PIN<input name="pin" type="password" inputmode="numeric" autocomplete="off" required maxlength="32"></label><button class="pau-editor-button primary" type="submit">${t('Enter','Entrar')}</button></form>`);
    $('#pau-pin-form').onsubmit=event=>{event.preventDefault();if(new FormData(event.target).get('pin')===String(window.PAU_EDITOR_CONFIG?.pin||'2026'))enter();else error(t('Incorrect PIN. Try again.','PIN incorrecto. Inténtalo de nuevo.'));};
  });
  // Both entry points use the same draft and commit path; no duplicate associations.
  function decorateLinks(){
    document.querySelectorAll('.pau-editor-link').forEach(node=>node.remove());
    if(!active)return;
    document.querySelectorAll('#grid [data-product]').forEach(card=>{
      const link=document.createElement('button');link.type='button';
      link.className='pau-editor-button pau-editor-link';
      link.textContent=t('Link contributor','Vincular colaborador');
      link.onclick=()=>editFigure(card.dataset.product,true);
      card.parentElement.append(link);
    });
    document.querySelectorAll('[data-edit-contributor]').forEach(card=>{
      const link=document.createElement('button');link.type='button';
      link.className='pau-editor-button pau-editor-link';
      link.textContent=t('Link figures','Vincular figuras');
      link.onclick=()=>assignFigures(card.dataset.editContributor);
      card.querySelector('.contributor-copy').append(link);
    });
  }
  function decorateDetail(){
    dialogDetailCleanup();if(!active||!detailId)return;
    const node=document.createElement('div');node.className='pau-editor-detail';node.innerHTML=button(t('Edit collection details','Editar datos de la colección'),'edit-figure',true);
    $('#detail-content .detail-copy')?.append(node);
    node.querySelector('button').onclick=()=>editFigure(detailId);
  }
  function dialogDetailCleanup(){document.querySelectorAll('.pau-editor-detail').forEach(node=>node.remove());}
  document.addEventListener('pau:detail',event=>{detailId=event.detail.id;decorateDetail();});
  document.addEventListener('pau:render',()=>{updateBar();decorateLinks();});
  $('#language').addEventListener('click',()=>{updateBar();decorateDetail();});
  function field(label,name,value,type='text',max=80){return `<label>${escape(label)}<input name="${name}" type="${type}" value="${escape(value||'')}" maxlength="${max}"></label>`;}
  function option(value,label,selected){return `<option value="${escape(value)}"${value===selected?' selected':''}>${escape(label)}</option>`;}
  function editFigure(id,linkMode=false){
    const row=draft.collection.find(x=>x.catalogId===id);if(!row)return;
    const figure=catalog.get(id);
    open(`${figure.name}${figure.number?' · '+figure.number:''}`,`<form class="pau-editor-form" id="pau-figure-form"><label>${t('Acquisition','Adquisición')}<select name="acquisition">${[['',t('Not recorded','Sin registrar')],['Gifted',t('Gift','Regalo')],['Bought',t('Purchase','Compra')],['Traded',t('Trade','Intercambio')],['Other',t('Other','Otro')]].map(([v,l])=>option(v,l,row.acquisition||'')).join('')}</select></label><label id="pau-giver-label">${t('Gifted by','Regalado por')}<select name="giftedBy">${option('',t('Not recorded','Sin registrar'),row.giftedBy||'')}${draft.people.contributors.map(p=>option(p.id,p.name,row.giftedBy)).join('')}</select></label>${field(t('Acquisition date (optional)','Fecha de adquisición (opcional)'),'acquiredAt',row.acquiredAt,'date')}<label>${t('Notes (optional; visible after publication)','Notas (opcionales; visibles tras publicar)')}<textarea name="notes" maxlength="2000">${escape(row.notes||'')}</textarea></label><div class="pau-editor-actions"><button class="pau-editor-button primary" type="submit">${t('Save changes','Guardar cambios')}</button>${button(t('Cancel','Cancelar'),'close')}</div></form>`);
    const form=$('#pau-figure-form');
    if(linkMode)form.elements.acquisition.value='Gifted';
    function sync(){const gifted=form.elements.acquisition.value==='Gifted';$('#pau-giver-label').hidden=!gifted;form.elements.giftedBy.disabled=!gifted;}
    form.elements.acquisition.onchange=sync;sync();
    form.onsubmit=event=>{
      event.preventDefault();const values=new FormData(form),next=clone(draft),target=next.collection.find(x=>x.catalogId===id);
      target.acquisition=values.get('acquisition')||null;target.giftedBy=target.acquisition==='Gifted'?(values.get('giftedBy')||null):null;target.acquiredAt=values.get('acquiredAt')||null;target.notes=values.get('notes').trim()||null;
      try{commit(next);dialog.close();$('#detail').close();toast(t('Draft updated. Not published.','Borrador actualizado. Sin publicar.'));}catch{error(t('Check the date and contributor.','Revisa la fecha y el colaborador.'));}
    };
  }
  function avatar(person){return `<span class="pau-editor-avatar">${escape(person.name.trim().slice(0,1).toUpperCase())}${person.image?`<img src="${escape(person.image)}" alt="" hidden>`:''}</span>`;}
  function bindAvatars(){dialog.querySelectorAll('.pau-editor-avatar img').forEach(img=>{const loaded=()=>{img.hidden=false;img.parentNode.firstChild.textContent='';};img.onload=loaded;img.onerror=()=>img.remove();if(img.complete&&img.naturalWidth)loaded();});}
  function people(){
    open(t('Manage contributors','Gestionar colaboradores'),`<p>${t('Use a display name. Contributor IDs and gift links are handled automatically.','Usa un nombre visible. Los identificadores y enlaces se gestionan automáticamente.')}</p>${button(t('Add contributor','Añadir colaborador'),'add-person',true)}<div class="pau-editor-list">${draft.people.contributors.map(p=>`<div class="pau-editor-person">${avatar(p)}<strong>${escape(p.name)}</strong><button type="button" class="pau-editor-button" data-person-id="${escape(p.id)}">${t('Edit','Editar')}</button><button type="button" class="pau-editor-button primary" data-assign-person="${escape(p.id)}">${t('Link figures','Vincular figuras')}</button></div>`).join('')}</div>`);bindAvatars();
    dialog.querySelectorAll('[data-person-id]').forEach(b=>b.onclick=()=>editPerson(b.dataset.personId));
    dialog.querySelectorAll('[data-assign-person]').forEach(b=>b.onclick=()=>assignFigures(b.dataset.assignPerson));
  }
  function assignFigures(id){
    const person=draft.people.contributors.find(p=>p.id===id);if(!person)return;
    const rows=draft.collection.filter(row=>row.status==='owned');
    open(`${t('Link figures','Vincular figuras')} · ${person.name}`,`<p>${t('Select the figures gifted by this person. Saving a figure linked to someone else reassigns its contributor. Unchecking a selected figure removes this person’s link.','Selecciona las figuras regaladas por esta persona. Al guardar una figura vinculada a otra persona, se reasigna el colaborador. Desmarcar una figura elimina el vínculo con esta persona.')}</p><form id="pau-assign-form" class="pau-editor-form"><label>${t('Find a figure','Buscar una figura')}<input type="search" name="query" autocomplete="off"></label><div class="pau-assignment-list">${rows.map(row=>{
      const figure=catalog.get(row.catalogId),giver=draft.people.contributors.find(p=>p.id===row.giftedBy);
      return `<label class="pau-assignment-row" data-assignment-row><input type="checkbox" data-assignment="${escape(row.catalogId)}"${row.giftedBy===id?' checked':''}><span>${escape(figure.name)}${figure.number?' · '+escape(figure.number):''}<small>${escape(figure.franchise)} · ${giver?escape(giver.name):t('No contributor linked','Sin colaborador vinculado')}</small></span></label>`;
    }).join('')}</div><div class="pau-editor-actions"><button type="submit" class="pau-editor-button primary">${t('Save links','Guardar vínculos')}</button>${button(t('Cancel','Cancelar'),'close')}</div></form>`);
    const form=$('#pau-assign-form');
    form.elements.query.oninput=()=>{const query=form.elements.query.value.trim().toLocaleLowerCase();form.querySelectorAll('[data-assignment-row]').forEach(row=>row.hidden=!row.textContent.toLocaleLowerCase().includes(query));};
    form.onsubmit=event=>{
      event.preventDefault();const next=clone(draft);
      // Include hidden search results so filtering never silently unlinks a gift.
      form.querySelectorAll('[data-assignment]').forEach(input=>{
        const row=next.collection.find(item=>item.catalogId===input.dataset.assignment);
        if(input.checked){row.giftedBy=id;row.acquisition='Gifted';}
        else if(row.giftedBy===id)row.giftedBy=null;
      });
      try{commit(next);dialog.close();toast(t('Contributor links saved in your draft.','Vínculos guardados en tu borrador.'));}
      catch{error(t('Could not save. Resolve any draft warning and try again.','No se pudo guardar. Resuelve los avisos del borrador e inténtalo de nuevo.'));}
    };
  }
  function editPerson(id){
    const person=draft.people.contributors.find(p=>p.id===id)||{name:'',image:''};
    open(id?t('Edit contributor','Editar colaborador'):t('New contributor','Nuevo colaborador'),`<form class="pau-editor-form" id="pau-person-form">${field(t('Display name','Nombre visible'),'name',person.name)}${field(t('Avatar path (optional)','Ruta del avatar (opcional)'),'image',person.image,'text',240)}<p>${t('Example: assets/gift-givers/lehky.webp. You can leave this empty; initials appear until an image is supplied. Images are added separately by the publisher.','Ejemplo: assets/gift-givers/lehky.webp. Puedes dejarlo vacío; aparecerán las iniciales hasta añadir una imagen. El responsable de publicar añade las imágenes por separado.')}</p><div class="pau-editor-actions"><button class="pau-editor-button primary" type="submit">${t('Save contributor','Guardar colaborador')}</button>${button(t('Back','Volver'),'people')}</div></form>`);
    const form=$('#pau-person-form');form.elements.name.required=true;
    form.onsubmit=event=>{
      event.preventDefault();const values=new FormData(form),name=values.get('name').trim(),image=values.get('image').trim();
      if(!name||!asset(image)){error(t('Enter a name and a relative assets/ path without ..','Introduce un nombre y una ruta relativa assets/ sin ..'));return;}
      if(draft.people.contributors.some(p=>p.id!==id&&p.name.toLocaleLowerCase()===name.toLocaleLowerCase())){error(t('That contributor already exists. Edit their existing entry.','Ese colaborador ya existe. Edita su entrada actual.'));return;}
      const next=clone(draft);
      if(id)Object.assign(next.people.contributors.find(p=>p.id===id),{name,image});
      else{let slug=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,65)||'contributor';let newId=slug,n=2;while(next.people.contributors.some(p=>p.id===newId))newId=slug+'-'+n++;next.people.contributors.push({id:newId,name,image});}
      try{commit(next);people();}catch{error(t('Unable to save this contributor. Check the fields.','No se puede guardar. Revisa los campos.'));}
    };
  }
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  function recovery(){return JSON.stringify({format:'funko-pau-draft',version:1,base,data:draft,savedAt:new Date().toISOString()},null,2);}
  function backup(){
    open(t('Backup and restore','Copia de seguridad y restauración'),`<p>${t('A backup lets you recover a draft or move it to another device. Clearing browser data removes local drafts.','Una copia permite recuperar un borrador o llevarlo a otro dispositivo. Borrar los datos del navegador elimina los borradores locales.')}</p><div class="pau-editor-actions">${button(t('Download backup','Descargar copia'),'download-backup',true)}</div><form class="pau-editor-form" id="pau-restore-form"><label>${t('Restore a backup JSON file','Restaurar un archivo JSON de copia')}<input type="file" name="file" accept=".json,application/json" required></label><label><span><input type="checkbox" name="confirm" required style="width:auto"> ${t('Replace this device’s current draft','Reemplazar el borrador actual de este dispositivo')}</span></label><button class="pau-editor-button" type="submit">${t('Restore','Restaurar')}</button></form><p>${t('You can also discard your draft and return to the published collection.','También puedes descartar el borrador y volver a la colección publicada.')}</p>${button(t('Discard draft…','Descartar borrador…'),'reset')}`);
    $('#pau-restore-form').onsubmit=async event=>{
      event.preventDefault();const file=event.target.elements.file.files[0];
      try{if(!file||file.size>3000000)throw new Error('size');const parsed=JSON.parse(await file.text());if(parsed.format!=='funko-pau-draft'||parsed.version!==1)throw new Error('format');validate(parsed.data);validate(parsed.base);base=clone(parsed.base);draft=clone(parsed.data);undo=[];corrupt=false;externalConflict=false;save();preview();if(stale())reconcile();else{dialog.close();toast(t('Backup restored.','Copia restaurada.'));}}
      catch{error(t('This is not a compatible Funko Pau backup. Your draft was not replaced.','No es una copia compatible de Funko Pau. Tu borrador no se ha reemplazado.'));}
    };
  }
  // Three-way reconciliation retains independent edits and asks about every conflicting field.
  function reconcile(){
    const merged=clone(published),conflicts=[];
    for(const [section,idKey] of [['collection','catalogId'],['contributors','id']]){
      const get=(data)=>section==='collection'?data.collection:data.people.contributors;
      for(const mine of get(draft)){
        const original=get(base).find(x=>x[idKey]===mine[idKey]);if(equal(original,mine))continue;
        const target=get(merged).find(x=>x[idKey]===mine[idKey]);
        if(!target){if(!original)get(merged).push(clone(mine));else conflicts.push({label:mine.name||catalog.get(mine.catalogId)?.name||mine[idKey],mine,current:null,apply:()=>get(merged).push(clone(mine))});continue;}
        for(const field of Object.keys(mine)){
          if(equal(mine[field],original?.[field]))continue;
          if(equal(target[field],original?.[field])||equal(target[field],mine[field]))target[field]=clone(mine[field]);
          else conflicts.push({label:`${mine.name||catalog.get(mine.catalogId)?.name||mine[idKey]} · ${field}`,mine:mine[field],current:target[field],apply:()=>{target[field]=clone(mine[field]);}});
        }
      }
    }
    open(t('Review newer published data','Revisar los datos publicados más recientes'),`<p>${t('Your draft started from an older version. Independent changes will be combined. Choose which value to keep for any conflicts below.','Tu borrador empezó con una versión anterior. Se combinarán los cambios independientes. Elige qué valor conservar en cada conflicto.')}</p><form id="pau-merge-form" class="pau-editor-form">${conflicts.map((c,i)=>`<label>${escape(c.label)}<select name="conflict-${i}" required><option value="">${t('Choose…','Elegir…')}</option><option value="published">${t('Published','Publicado')}: ${escape(JSON.stringify(c.current))}</option><option value="draft">${t('My draft','Mi borrador')}: ${escape(JSON.stringify(c.mine))}</option></select></label>`).join('')}<button type="submit" class="pau-editor-button primary">${t('Combine and continue','Combinar y continuar')}</button></form><p>${t('Export is blocked until this review is complete. Your draft remains available.','La exportación queda bloqueada hasta completar esta revisión. Tu borrador sigue disponible.')}</p>`);
    $('#pau-merge-form').onsubmit=event=>{event.preventDefault();const values=new FormData(event.target);conflicts.forEach((c,i)=>{if(values.get('conflict-'+i)==='draft')c.apply();});try{validate(merged);draft=merged;base=clone(published);undo=[];save();preview();dialog.close();toast(t('Draft combined with the published version.','Borrador combinado con la versión publicada.'));}catch{error(t('The selected values leave an invalid gift link. Choose matching acquisition and contributor values.','Los valores elegidos dejan un regalo sin enlace válido. Elige valores compatibles de adquisición y colaborador.'));}};
  }
  async function review(){
    if(corrupt){backup();return;}if(stale()){reconcile();return;}
    const list=changes();pendingPackage=null;
    open(t('Review your update','Revisar tu actualización'),`<p>${list.length} ${t('changed entries. Nothing has been published.','entradas modificadas. No se ha publicado nada.')}</p><ul class="pau-editor-summary">${list.map(c=>`<li>${escape(c.label)} — ${c.kind==='figure'?t('Collection details','Datos de colección'):c.before?t('Contributor updated','Colaborador actualizado'):t('New contributor','Nuevo colaborador')}</li>`).join('')}</ul><p>${t('Prepare the ZIP, then share it directly with your usual mobile apps. Your draft stays here until the update is published.','Prepara el ZIP y compártelo directamente con tus aplicaciones habituales del móvil. El borrador se conserva hasta que se publique la actualización.')}</p><p id="pau-source-status" role="status">${list.length?t('Preparing update…','Preparando actualización…'):''}</p><div class="pau-editor-actions">${button(t('Share update','Compartir actualización'),'share',true,true)}${button(t('Download ZIP','Descargar ZIP'),'download-update',false,true)}${button(t('Back to editing','Volver a editar'),'close')}</div><p id="pau-export-status" role="status"></p>`);
    if(!list.length)return;
    await prepareUpdate();
  }
  // Minimal standards-compliant, uncompressed ZIP writer; small text files need no library.
  function zip(files){
    const encode=new TextEncoder(),parts=[],central=[];let offset=0;
    const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
    const header=(size)=>{const bytes=new Uint8Array(size);return [bytes,new DataView(bytes.buffer)];};
    for(const [name,value] of Object.entries(files)){
      const n=encode.encode(name),data=encode.encode(value),sum=crc(data);
      const [h,v]=header(30);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,sum,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,n.length,true);
      parts.push(h,n,data);const [c,w]=header(46);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint16(14,33,true);w.setUint32(16,sum,true);w.setUint32(20,data.length,true);w.setUint32(24,data.length,true);w.setUint16(28,n.length,true);w.setUint32(42,offset,true);central.push(c,n);offset+=h.length+n.length+data.length;
    }
    const size=central.reduce((n,p)=>n+p.length,0),[end,v]=header(22);v.setUint32(0,0x06054b50,true);v.setUint16(8,Object.keys(files).length,true);v.setUint16(10,Object.keys(files).length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/zip'});
  }
  async function prepareUpdate(){
    if(externalConflict){error(t('Another tab changed this draft. Download a backup and reload before exporting.','Otra pestaña ha cambiado el borrador. Descarga una copia y recarga antes de exportar.'));return;}
    if(stale()){reconcile();return;}if(!dirty())return;
    const shareButton=dialog.querySelector('[data-pau="share"]'),downloadButton=dialog.querySelector('[data-pau="download-update"]');
    try{
      validate(draft);
      const original=await sourceAtOpen;
      if(/^https?:$/.test(location.protocol)){
        $('#pau-source-status').textContent=t('Checking the published version…','Comprobando la versión publicada…');
        const latest=await readSources();
        if(!original||!equal(original,latest)){
          $('#pau-source-status').textContent=t('The source changed or could not be verified. Download a backup, reload this page, and reopen editing before exporting.','Los datos han cambiado o no se han podido verificar. Descarga una copia, recarga la página y vuelve a abrir el editor antes de exportar.');
          $('#pau-source-status').insertAdjacentHTML('beforeend',button(t('Download backup','Descargar copia'),'download-backup'));return;
        }
      }
      const list=changes(),date=new Date().toISOString(),json=value=>JSON.stringify(value,null,2);
      // Preserve the original data-file comments in every generated replacement.
      const files={
        'people.js':'// People are intentionally separate from the collection catalog.\n// Drop transparent WebP files at the paths below. Missing files fall back to initials automatically.\nwindow.POP_PEOPLE = '+json(draft.people)+';\n',
        'collection.js':"// Pau's personal collection data.\n// Keep this file light: catalog metadata and remote imagery live in catalog.js.\n// Unknown acquisition details are null on purpose; the UI hides fields that have not been recorded.\nwindow.POP_COLLECTION = "+json(draft.collection)+';\n',
        'draft-backup.json':recovery(),
        'update-summary.json':json({createdAt:date,baseVersion:stamp(base),updatedVersion:stamp(draft),changes:list}),
        'READ-ME.txt':`Funko Pau update / Actualización\nCreated / Creada: ${date}\nBase: ${stamp(base)}\n\nNot published. Review update-summary.json and compare the base in draft-backup.json against current published data before replacing people.js and collection.js. Do not upload the backup or summary to the public site. Avatars are not included.\n\nSin publicar. Revisa update-summary.json y compara la base de draft-backup.json con los datos publicados antes de sustituir people.js y collection.js. No publiques la copia ni el resumen. No se incluyen avatares.\n`
      };
      const blob=zip(files),name='Funko-Pau-update-'+date.replace(/[:.]/g,'-')+'.zip';
      const file=new File([blob],name,{type:'application/zip'});pendingPackage={blob,name,file};
      let shareSupported=false;
      try{shareSupported=Boolean(navigator.share&&navigator.canShare?.({files:[file]}));}catch{/* Download remains available when native file sharing is unsupported. */}
      $('#pau-source-status').textContent='';
      if(shareButton?.isConnected)shareButton.disabled=!shareSupported;
      if(downloadButton?.isConnected)downloadButton.disabled=false;
      $('#pau-export-status').textContent=shareSupported?t('Update ready. Tap Share update to open your phone’s share menu.','Actualización lista. Pulsa Compartir actualización para abrir el menú de compartir del móvil.'):t('Native ZIP sharing is unavailable here. Download the ZIP instead.','El uso compartido nativo de ZIP no está disponible aquí. Descarga el ZIP.');
    }catch{error(t('Could not verify or prepare the update. Your draft is retained. Check your connection, or download a backup.','No se pudo verificar ni preparar la actualización. Tu borrador se conserva. Revisa la conexión o descarga una copia.'));}
  }
  function reset(){open(t('Discard this draft?','¿Descartar este borrador?'),`<p>${t('This removes local changes and restores the published collection. Download a backup first if you want to keep them.','Se eliminarán los cambios locales y se restaurará la colección publicada. Descarga antes una copia si quieres conservarlos.')}</p><div class="pau-editor-actions">${button(t('Download backup','Descargar copia'),'download-backup')}${button(t('Discard draft','Descartar borrador'),'confirm-reset')}${button(t('Cancel','Cancelar'),'close')}</div>`);}
  async function action(name){
    if(name==='close')dialog.close();
    if(name==='people')people();if(name==='add-person')editPerson();if(name==='review')review();if(name==='backup')backup();if(name==='reset')reset();
    if(name==='undo'&&undo.length&&!externalConflict){draft=undo.pop();save();preview();toast(t('Last change undone.','Último cambio deshecho.'));}
    if(name==='exit'){active=false;dialog.close();$('#detail').close();dialogDetailCleanup();preview();toast(t('Published collection shown. Your draft is retained.','Se muestra la colección publicada. Tu borrador se conserva.'));}
    if(name==='download-backup'){download(new Blob([recovery()],{type:'application/json'}),'Funko-Pau-draft-'+Date.now()+'.json');toast(t('Backup download requested.','Descarga de copia iniciada.'));}
    if(name==='confirm-reset'){draft=clone(published);base=clone(published);undo=[];corrupt=false;externalConflict=false;save();preview();dialog.close();}
    if(name==='download-update'&&pendingPackage){download(pendingPackage.blob,pendingPackage.name);toast(t('ZIP download requested.','Descarga del ZIP iniciada.'));}
    if(name==='share'&&pendingPackage){
      try{
        if(!navigator.share||!navigator.canShare?.({files:[pendingPackage.file]})){toast(t('Native ZIP sharing is unavailable here. Download the ZIP instead.','El uso compartido nativo de ZIP no está disponible aquí. Descarga el ZIP.'));return;}
        await navigator.share({files:[pendingPackage.file],title:'Funko Pau'});
        toast(t('Opened sharing. Complete sending in your chosen app.','Se abrió el menú de compartir. Completa el envío en tu aplicación.'));
      }catch(error){
        if(error?.name==='AbortError')toast(t('Sharing cancelled.','Envío cancelado.'));
        else toast(t('Could not open sharing. Download the ZIP instead.','No se pudo abrir el menú de compartir. Descarga el ZIP.'));
      }
    }
  }
  bar.addEventListener('click',event=>{const b=event.target.closest('[data-pau]');if(b)action(b.dataset.pau);});
  dialog.addEventListener('click',event=>{const b=event.target.closest('[data-pau]');if(b)action(b.dataset.pau);});
  window.addEventListener('storage',event=>{if(event.key===key&&active){externalConflict=true;open(t('Draft changed in another tab','Borrador modificado en otra pestaña'),`<p>${t('Export a backup of this tab before continuing. Reload to use the other tab’s saved draft.','Descarga una copia de esta pestaña antes de continuar. Recarga para usar el borrador guardado en la otra pestaña.')}</p>${button(t('Download backup','Descargar copia'),'download-backup')}`);}});
  updateBar();
})();
