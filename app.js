/* MycoDex UK — GitHub Pages, no server required. Personal data is device-local. */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const DATABASE = 'mycodex-uk';
  const COLLECTION_VERSION = 1;
  const PAGE_SIZE = 60;
  const state = {species:[], finds:new Map(), photos:[], activeId:null, limit:PAGE_SIZE, galleryUrls:[], coverUrls:[], db:null};
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const scientificId = (name) => String(name||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const toast = (message) => { const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3200); };
  const today = () => { const now=new Date(), local=new Date(now.getTime()-now.getTimezoneOffset()*60000);return local.toISOString().slice(0,10);};
  const dateDisplay = (iso) => iso ? new Date(iso+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '';
  const normaliseSpecies = row => {
    const scientificName=String(row.scientificName||'').trim();
    if (!scientificName) return null;
    return {id:scientificId(scientificName),scientificName,commonName:String(row.commonName||scientificName).trim(),family:String(row.family||'Unclassified').trim(),group:String(row.group||row.phylum||'Other fungi').trim()};
  };
  function openDatabase() {
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DATABASE,COLLECTION_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains('finds'))db.createObjectStore('finds',{keyPath:'id'});
        if(!db.objectStoreNames.contains('photos')){ const ps=db.createObjectStore('photos',{keyPath:'id'});ps.createIndex('by_species','speciesId'); }
        if(!db.objectStoreNames.contains('catalog'))db.createObjectStore('catalog',{keyPath:'id'});
      };
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
  }
  function getAll(store){return new Promise((resolve,reject)=>{const req=state.db.transaction(store,'readonly').objectStore(store).getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  function put(store,obj){return new Promise((resolve,reject)=>{const tx=state.db.transaction(store,'readwrite');tx.objectStore(store).put(obj);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
  function remove(store,id){return new Promise((resolve,reject)=>{const tx=state.db.transaction(store,'readwrite');tx.objectStore(store).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
  function putMany(store,items){return new Promise((resolve,reject)=>{const tx=state.db.transaction(store,'readwrite');const dbs=tx.objectStore(store);for(const item of items)dbs.put(item);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
  async function refresh(){state.finds=new Map((await getAll('finds')).map(f=>[f.id,f]));state.photos=await getAll('photos');render();}
  function filteredSpecies(){
    const query=$('#searchInput').value.toLowerCase().trim();const group=$('#groupFilter').value;const filter=$('#statusFilter').value;
    const entries=state.species.filter(s=>{
      const found=state.finds.has(s.id);return (filter==='all'||(filter==='found'?found:!found)) && (group==='all'||s.group===group) && (!query||[s.commonName,s.scientificName,s.family,s.group].join(' ').toLowerCase().includes(query));
    });
    const sort=$('#sortSelect').value;
    if(sort==='latest')entries.sort((a,b)=>(state.finds.get(b.id)?.updatedAt||'').localeCompare(state.finds.get(a.id)?.updatedAt||'')||a.commonName.localeCompare(b.commonName));
    else entries.sort((a,b)=>sort==='scientific'?a.scientificName.localeCompare(b.scientificName):a.commonName.localeCompare(b.commonName));
    return entries;
  }
  const photoFor=id=>state.photos.filter(p=>p.speciesId===id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
  function render(){
    const count=state.species.length, found=state.finds.size;
    $('#foundCount').textContent=found.toLocaleString('en-GB');$('#speciesCount').textContent=count.toLocaleString('en-GB');$('#photoCount').textContent=state.photos.length.toLocaleString('en-GB');
    const percentage=count?100*found/count:0;$('#progressPercent').textContent=percentage.toFixed(percentage>0&&percentage<1?1:0)+'%';$('#progressFill').style.width=percentage+'%';
    $('#progressLabel').textContent=`${found.toLocaleString('en-GB')} / ${count.toLocaleString('en-GB')} SPECIES DISCOVERED`;
    $('#heroEntryCount').textContent=String(found).padStart(3,'0');
    $('#catalogueBadge').textContent=count>100?'EXPANDED CATALOGUE':'STARTER CATALOGUE';
    const entries=filteredSpecies();const shown=entries.slice(0,state.limit);
    for(const url of state.coverUrls)URL.revokeObjectURL(url);state.coverUrls=[];
    const photosBySpecies=new Map();for(const p of state.photos){const old=photosBySpecies.get(p.speciesId);if(!old||p.createdAt>old.createdAt)photosBySpecies.set(p.speciesId,p);}
    $('#speciesGrid').innerHTML=shown.map((s,i)=>{
      const item=photosBySpecies.get(s.id);const cover=item&&item.blob instanceof Blob?URL.createObjectURL(item.blob):null;if(cover)state.coverUrls.push(cover);
      const has=state.finds.has(s.id);const number=String(state.species.indexOf(s)+1).padStart(4,'0');
      return `<button type="button" class="species-card ${has?'found':''}" data-entry="${esc(s.id)}" aria-label="${esc(s.commonName)}, ${has?'found':'not found'}. Open field entry"><div class="card-photo">${cover?`<img loading="lazy" src="${esc(cover)}" alt="Your photograph of ${esc(s.commonName)}">`:'<span class="card-silhouette" aria-hidden="true">🍄</span>'}<span class="entry-index">#${number}</span><span class="found-flag ${has?'':'unfound-flag'}">${has?'✓ FOUND':'? UNKNOWN'}</span></div><div class="card-details"><h3>${esc(s.commonName)}</h3><div class="latin">${esc(s.scientificName)}</div><div class="card-bottom"><span class="family-label">${esc(s.family)}</span><span class="card-action">${has?'✓':'＋'}</span></div></div></button>`;
    }).join('');
    $('#resultsCount').textContent=`Showing ${shown.length.toLocaleString('en-GB')} of ${entries.length.toLocaleString('en-GB')} matching species`;
    $('#loadMore').hidden=entries.length<=shown.length;
    $('#emptyState').hidden=entries.length!==0;
  }
  function refreshGroups(){const s=$('#groupFilter');const previous=s.value;const groups=[...new Set(state.species.map(x=>x.group))].sort();s.innerHTML='<option value="all">All groups</option>'+groups.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('');s.value=groups.includes(previous)?previous:'all';}
  async function openEntry(id){
    const entry=state.species.find(x=>x.id===id);if(!entry)return;
    state.activeId=id;$('#entryTitle').textContent=entry.commonName;$('#entryScientific').textContent=entry.scientificName;$('#entryFamily').textContent=`${entry.group} · ${entry.family}`;
    const find=state.finds.get(id);$('#entryDate').value=find?.date||today();$('#entryLocation').value=find?.location||'';$('#entryNotes').value=find?.notes||'';
    $('#photoInput').value='';$('#selectedPhotos').textContent='';$('#unmarkButton').hidden=!find;$('#saveEntryButton').textContent=find?'✓ Update field entry':'✓ Save as found';
    await drawGallery();$('#entryDialog').showModal();
  }
  async function drawGallery(){
    for(const url of state.galleryUrls)URL.revokeObjectURL(url);state.galleryUrls=[];
    const selected=state.photos.filter(x=>x.speciesId===state.activeId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    $('#photoGallery').innerHTML=selected.map(p=>{
      const url=URL.createObjectURL(p.blob);state.galleryUrls.push(url);
      return `<div class="gallery-item"><img src="${esc(url)}" alt="Your uploaded mushroom photo"><button type="button" class="gallery-remove" data-photo-remove="${esc(p.id)}" aria-label="Delete this photograph">×</button></div>`;
    }).join('');
  }
  function compressImage(file){return new Promise((resolve,reject)=>{
    if(!file.type.startsWith('image/')&&!/\.(heic|heif)$/i.test(file.name)){reject(new Error('Please choose an image file.'));return;}
    const url=URL.createObjectURL(file),image=new Image();
    image.onload=()=>{URL.revokeObjectURL(url);try{
      const max=1400,scale=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not process this photo.')),'image/jpeg',.79);
    }catch(e){reject(e);}};
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Cannot read this image type. Try JPG or PNG.'));};image.src=url;
  });}
  async function saveEntry(event){
    event.preventDefault();const id=state.activeId;if(!id)return;const btn=$('#saveEntryButton');btn.disabled=true;
    try{
      const files=[...$('#photoInput').files];const processed=[];
      for(const file of files){const blob=await compressImage(file);processed.push({id:crypto.randomUUID(),speciesId:id,blob,name:file.name,createdAt:new Date().toISOString()});}
      await put('finds',{id,date:$('#entryDate').value||today(),location:$('#entryLocation').value.trim(),notes:$('#entryNotes').value.trim(),updatedAt:new Date().toISOString()});
      if(processed.length)await putMany('photos',processed);
      await refresh();$('#entryDialog').close();toast(processed.length?`Saved discovery with ${processed.length} new photo${processed.length===1?'':'s'}!`:'Discovery saved to your MycoDex!');
    }catch(error){console.error(error);toast('Unable to save. Check storage space and photo format.');}finally{btn.disabled=false;}
  }
  async function unmark(){if(!state.activeId)return;await remove('finds',state.activeId);await refresh();$('#entryDialog').close();toast('Species marked as not found. Photographs retained.');}
  // RFC 4180-style CSV parser: supports commas, CRLF, double-quoted fields and escaped quotes.
  function csvRows(csv){const rows=[],row=[];let field='',quoted=false;
    for(let i=0;i<csv.length;i++){const c=csv[i];if(c==='"'){if(quoted&&csv[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
      else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&csv[i+1]==='\n')i++;row.push(field);field='';if(row.some(x=>x.trim()))rows.push([...row]);row.length=0;}
      else field+=c;
    }
    row.push(field);if(row.some(x=>x.trim()))rows.push(row);return rows;
  }
  const normHeader=h=>String(h||'').replace(/^\uFEFF/,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  function getColumn(map,obj){for(const field of map)if(obj[field]!=null&&String(obj[field]).trim())return String(obj[field]).trim();return '';}
  async function importCsv(file){
    const message=$('#importMessage');message.textContent='Reading catalogue…';
    try{
      const rows=csvRows(await file.text());if(rows.length<2)throw new Error('This CSV has no species rows.');
      const headers=rows[0].map(normHeader);if(!headers.includes('scientificname')&&!headers.includes('species'))throw new Error('No scientificName (or species) column found.');
      const onlyBasidio=$('#basidioOnly').checked;const existing=new Set(state.species.map(x=>x.id));const newItems=new Map();let excluded=0;
      for(const values of rows.slice(1)){
        const r={};headers.forEach((h,i)=>r[h]=values[i]||'');
        const scientificName=getColumn(['scientificname','species'],r);const commonName=getColumn(['preferredcommonname','commonname','vernacularname','englishname'],r);
        const kingdom=getColumn(['rkkingdom','kingdom'],r),phylum=getColumn(['rkphylum','phylum'],r),rank=getColumn(['taxonrank','rank'],r),status=getColumn(['taxonomicstatus'],r);
        if((kingdom&&kingdom.toLowerCase()!=='fungi')||(rank&&!['species','sp.'].includes(rank.toLowerCase()))||(status&&!['accepted','valid'].includes(status.toLowerCase()))||(onlyBasidio&&phylum.toLowerCase()!=='basidiomycota')){excluded++;continue;}
        // Skip empty genus and generic unspecified entries; preserve real scientific binomials.
        if(!scientificName||scientificName.split(/\s+/).length<2){excluded++;continue;}
        const item=normaliseSpecies({scientificName,commonName:commonName||scientificName,family:getColumn(['rkfamily','family'],r)||'Unclassified',group:phylum||'Other fungi'});
        if(item&&!existing.has(item.id))newItems.set(item.id,item);
      }
      if(!newItems.size){message.textContent=`No new species imported (${excluded.toLocaleString()} rows skipped or existing).`;return;}
      await putMany('catalog',[...newItems.values()]);state.species.push(...newItems.values());state.species.sort((a,b)=>a.scientificName.localeCompare(b.scientificName));refreshGroups();state.limit=PAGE_SIZE;render();
      message.textContent=`Added ${newItems.size.toLocaleString('en-GB')} species · ${excluded.toLocaleString('en-GB')} rows excluded. Catalogue stored on this device.`;toast('Catalogue imported. Download species JSON to add it to GitHub.');
    }catch(error){message.textContent=`Import failed: ${error.message}`;}finally{$('#catalogueInput').value='';}
  }
  function download(content,filename,mime='application/json'){
    const url=URL.createObjectURL(new Blob([content],{type:mime}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  function exportCatalogue(){download(JSON.stringify(state.species,null,2),'species.json');toast('Downloaded species.json — commit it into data/ in GitHub.');}
  const fileAsDataUrl=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});
  function dataUrlToBlob(data){const [head,content]=data.split(',');if(!head||!content)throw new Error('Invalid photograph data.');const mime=/data:([^;]+)/.exec(head)?.[1]||'image/jpeg';const bytes=atob(content);const arr=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)arr[i]=bytes.charCodeAt(i);return new Blob([arr],{type:mime});}
  async function exportBackup(){const b=$('#backupMessage');b.textContent='Preparing backup and photos…';try{
    const photos=[];for(const p of state.photos)photos.push({id:p.id,speciesId:p.speciesId,name:p.name,createdAt:p.createdAt,data:await fileAsDataUrl(p.blob)});
    const payload={type:'mycodex-uk-backup',version:1,exportedAt:new Date().toISOString(),finds:[...state.finds.values()],photos,catalog:await getAll('catalog')};
    download(JSON.stringify(payload),'mycodex-backup-'+today()+'.json');b.textContent=`Backup created: ${payload.finds.length} finds and ${photos.length} photographs.`;
  }catch(error){b.textContent='Could not create backup: '+error.message;}}
  async function restoreBackup(file){const b=$('#backupMessage');try{
    b.textContent='Reading backup…';const data=JSON.parse(await file.text());if(data.type!=='mycodex-uk-backup'||!Array.isArray(data.finds)||!Array.isArray(data.photos))throw new Error('Not a MycoDex backup.');
    if(!confirm('Restore this backup? It will replace existing finds, photographs and added catalogue species on THIS device.')){b.textContent='Restore cancelled.';return;}
    const photos=data.photos.map(p=>({id:p.id,speciesId:p.speciesId,name:p.name||'photo',createdAt:p.createdAt||new Date().toISOString(),blob:dataUrlToBlob(p.data)}));
    await new Promise((resolve,reject)=>{const tx=state.db.transaction(['finds','photos','catalog'],'readwrite');for(const name of ['finds','photos','catalog'])tx.objectStore(name).clear();for(const item of data.finds)tx.objectStore('finds').put(item);for(const item of photos)tx.objectStore('photos').put(item);for(const item of data.catalog||[])tx.objectStore('catalog').put(item);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
    await loadSpecies();await refresh();b.textContent=`Restored ${data.finds.length} finds and ${photos.length} photographs.`;toast('Backup successfully restored!');
  }catch(error){console.error(error);b.textContent='Restore failed: '+error.message;}finally{$('#backupInput').value='';}}
  async function loadSpecies(){
    const response=await fetch('./data/species.json',{cache:'no-cache'});if(!response.ok)throw new Error('Could not load data/species.json.');const seed=await response.json();
    const imported=await getAll('catalog');const combined=new Map();for(const s of seed.concat(imported)){const item=normaliseSpecies(s);if(item)combined.set(item.id,item);}
    state.species=[...combined.values()].sort((a,b)=>a.scientificName.localeCompare(b.scientificName));refreshGroups();
  }
  function setup(){
    $('#speciesGrid').addEventListener('click',e=>{const card=e.target.closest('[data-entry]');if(card)openEntry(card.dataset.entry);});
    $('#photoGallery').addEventListener('click',async e=>{const button=e.target.closest('[data-photo-remove]');if(!button)return;if(!confirm('Delete this photograph?'))return;await remove('photos',button.dataset.photoRemove);state.photos=await getAll('photos');await drawGallery();render();toast('Photograph deleted.');});
    $('#entryForm').addEventListener('submit',saveEntry);$('#unmarkButton').addEventListener('click',unmark);
    $('#photoInput').addEventListener('change',()=>{$('#selectedPhotos').textContent=$('#photoInput').files.length?`${$('#photoInput').files.length} photograph(s) ready to add when you save.`:'';});
    $('#settingsButton').addEventListener('click',()=>$('#settingsDialog').showModal());
    document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>$('#'+button.dataset.close).close()));
    $('#searchInput').addEventListener('input',()=>{state.limit=PAGE_SIZE;render();});
    for(const id of ['statusFilter','groupFilter','sortSelect'])$('#'+id).addEventListener('change',()=>{state.limit=PAGE_SIZE;render();});
    $('#loadMore').addEventListener('click',()=>{state.limit+=PAGE_SIZE;render();});
    $('#randomButton').addEventListener('click',()=>{if(!state.species.length)return;openEntry(state.species[Math.floor(Math.random()*state.species.length)].id);});
    $('#catalogueInput').addEventListener('change',e=>{const f=e.target.files[0];if(f)importCsv(f);});
    $('#catalogueExport').addEventListener('click',exportCatalogue);
    $('#exportButton').addEventListener('click',exportBackup);$('#backupInput').addEventListener('change',e=>{const f=e.target.files[0];if(f)restoreBackup(f);});
  }
  async function init(){try{
    if(!window.indexedDB)throw new Error('IndexedDB is not available.');setup();state.db=await openDatabase();await loadSpecies();await refresh();
    if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('Offline mode not enabled',e));
  }catch(error){console.error(error);$('#resultsCount').textContent='App could not start: '+error.message;toast('App could not start. Open it through GitHub Pages (HTTPS), not as a local file.');}}
  init();
})();