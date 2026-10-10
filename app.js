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
  async function refresh(){state.finds=new Map((await getAll('finds')).filter(f=>!f.deletedAt).map(f=>[f.id,f]));state.photos=await getAll('photos');render();}
  // Cloud sync is opt-in. IndexedDB is always written FIRST (works when offline).
  const cloud = window.MycoDexCloud;
  let cloudTimer = null;
  let cloudSyncPromise = null;
  let syncAgain = false;
  const cloudOwnerKey = 'mycodex-cloud-owner-v1';
  const timestamp = value => Date.parse(value||'') || 0;
  const activePhotos = () => state.photos.filter(p=>!p.deletedAt);
  function cloudMessage(message){const el=$('#cloudMessage');if(el)el.textContent=message;}
  function showCloudStatus(message){const el=$('#cloudStatus');if(el)el.textContent=message;const pill=$('#cloudBadge');if(pill)pill.textContent=message;}
  function cloudUI(){
    const configured=Boolean(cloud?.configured), user=cloud?.user;
    $('#cloudNotConfigured').hidden=configured;
    $('#cloudLoginForm').hidden=!configured||Boolean(user);
    $('#cloudConnected').hidden=!configured||!user;
    $('#cloudEmailLabel').textContent=user?.email||'';
    if(!configured)showCloudStatus('Local only');
    else if(!user)showCloudStatus('Sign in to sync');
  }
  function scheduleCloudSync(){
    if(!cloud?.configured||!cloud.user)return;
    if(cloudSyncPromise)syncAgain=true;
    clearTimeout(cloudTimer);
    cloudTimer=setTimeout(()=>syncCloud().catch(console.warn),750);
    showCloudStatus(navigator.onLine?'Saved locally · sync pending':'Saved locally · offline');
  }
  function cloudError(error){
    const details=String(error?.message||error||'Cloud sync failed');
    showCloudStatus('Cloud sync needs attention');
    cloudMessage(`Your discoveries are saved on this device. Cloud sync failed: ${details}`);
    console.error('MycoDex cloud:',error);
  }
  async function fetchCloudRows(table){
    const rows=[];
    for(let offset=0;;offset+=500){
      const {data,error}=await cloud.client.from(table).select('*').range(offset,offset+499);
      if(error)throw error;
      rows.push(...(data||[]));
      if(!data||data.length<500)break;
    }
    return rows;
  }
  async function syncCloud(){
    if(!cloud?.configured||!cloud.client||!cloud.user)return;
    if(cloudSyncPromise){syncAgain=true;return cloudSyncPromise;}
    const user=cloud.user;
    if(!navigator.onLine){showCloudStatus('Saved locally · offline');return;}
    cloudSyncPromise=(async()=>{
      const previousOwner=localStorage.getItem(cloudOwnerKey);
      if(previousOwner && previousOwner!==user.id){
        throw new Error('This device has a collection linked to another cloud account. Export a backup before switching accounts.');
      }
      showCloudStatus('Syncing…');cloudMessage('Synchronising finds and photographs securely…');
      const remoteFinds=await fetchCloudRows('mycodex_finds');
      const localFinds=await getAll('finds');
      const remoteFindMap=new Map(remoteFinds.map(f=>[f.species_id,f]));
      const localUpdates=[], uploads=[];
      for(const local of localFinds){
        const remote=remoteFindMap.get(local.id);
        if(remote && timestamp(remote.updated_at)>timestamp(local.updatedAt))continue;
        if(!remote || timestamp(local.updatedAt)>timestamp(remote.updated_at)){
          uploads.push({user_id:user.id,species_id:local.id,found_date:local.date||null,location:local.location||'',notes:local.notes||'',updated_at:local.updatedAt||new Date(0).toISOString(),deleted_at:local.deletedAt||null});
        }
      }
      const localFindMap=new Map(localFinds.map(x=>[x.id,x]));
      for(const remote of remoteFinds){
        const local=localFindMap.get(remote.species_id);
        if(!local||timestamp(remote.updated_at)>timestamp(local.updatedAt)){
          localUpdates.push({id:remote.species_id,date:remote.found_date||'',location:remote.location||'',notes:remote.notes||'',updatedAt:remote.updated_at,deletedAt:remote.deleted_at||null});
        }
      }
      for(let i=0;i<uploads.length;i+=100){
        const {error}=await cloud.client.from('mycodex_finds').upsert(uploads.slice(i,i+100),{onConflict:'user_id,species_id'});
        if(error)throw error;
      }
      if(localUpdates.length)await putMany('finds',localUpdates);

      const remotePhotos=await fetchCloudRows('mycodex_photos');
      const remotePhotoMap=new Map(remotePhotos.map(p=>[p.id,p]));
      const localPhotoMap=new Map((await getAll('photos')).map(p=>[p.id,p]));
      const incomingPhotos=[];
      for(const remote of remotePhotos){
        const local=localPhotoMap.get(remote.id);
        if(local && timestamp(local.updatedAt||local.createdAt)>=timestamp(remote.updated_at) && (local.blob||local.deletedAt))continue;
        if(remote.deleted_at){
          incomingPhotos.push({id:remote.id,speciesId:remote.species_id,createdAt:remote.created_at,updatedAt:remote.updated_at,deletedAt:remote.deleted_at,name:local?.name||'photo',blob:local?.blob||null});
        } else {
          const {data,error}=await cloud.client.storage.from('mycodex-photos').download(remote.storage_path);
          if(error)throw error;
          incomingPhotos.push({id:remote.id,speciesId:remote.species_id,createdAt:remote.created_at,updatedAt:remote.updated_at,deletedAt:null,name:local?.name||'Cloud photograph',blob:data});
        }
      }
      if(incomingPhotos.length)await putMany('photos',incomingPhotos);
      // Never overwrite newer remote changes with older cached local records.
      for(const local of localPhotoMap.values()){
        const remote=remotePhotoMap.get(local.id);
        if(remote && timestamp(local.updatedAt||local.createdAt)<=timestamp(remote.updated_at))continue;
        const path=`${user.id}/${local.id}.jpg`;
        if(!local.deletedAt && !remote){
          if(!(local.blob instanceof Blob))throw new Error(`Photograph ${local.id} is missing on this device.`);
          const {error}=await cloud.client.storage.from('mycodex-photos').upload(path,local.blob,{contentType:'image/jpeg',upsert:false});
          // A previous partial sync may have uploaded the file before recording metadata.
          if(error && !/already exists|duplicate/i.test(error.message||''))throw error;
        }
        const payload={id:local.id,user_id:user.id,species_id:local.speciesId,storage_path:remote?.storage_path||path,
          created_at:local.createdAt||new Date().toISOString(),updated_at:local.updatedAt||local.createdAt||new Date().toISOString(),deleted_at:local.deletedAt||null};
        const {error}=await cloud.client.from('mycodex_photos').upsert(payload,{onConflict:'id'});
        if(error)throw error;
        if(local.deletedAt && remote && !remote.deleted_at){
          const {error:deleteError}=await cloud.client.storage.from('mycodex-photos').remove([payload.storage_path]);
          if(deleteError)console.warn('Photo delete delayed:',deleteError);
        }
      }
      localStorage.setItem(cloudOwnerKey,user.id);
      await refresh();
      showCloudStatus('Cloud up to date');
      cloudMessage(`Synced ${state.finds.size} found species and ${activePhotos().length} photographs. Your iPhone and iPad can share this collection when signed in to the same account.`);
    })();
    try{await cloudSyncPromise;}
    catch(error){cloudError(error);}
    finally{
      cloudSyncPromise=null;
      if(syncAgain){syncAgain=false;scheduleCloudSync();}
    }
  }
  async function initCloud(){
    cloudUI();
    if(!cloud?.configured)return;
    showCloudStatus('Connecting…');
    try{await cloud.init(user=>{
      cloudUI();
      if(user)scheduleCloudSync();
    });if(cloud.user)scheduleCloudSync();}
    catch(error){cloudError(error);}
  }

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
    $('#foundCount').textContent=found.toLocaleString('en-GB');$('#speciesCount').textContent=count.toLocaleString('en-GB');$('#photoCount').textContent=activePhotos().length.toLocaleString('en-GB');
    const percentage=count?100*found/count:0;$('#progressPercent').textContent=percentage.toFixed(percentage>0&&percentage<1?1:0)+'%';$('#progressFill').style.width=percentage+'%';
    $('#progressLabel').textContent=`${found.toLocaleString('en-GB')} / ${count.toLocaleString('en-GB')} SPECIES DISCOVERED`;
    $('#heroEntryCount').textContent=String(found).padStart(3,'0');
    $('#catalogueBadge').textContent=count>100?'EXPANDED CATALOGUE':'STARTER CATALOGUE';
    const entries=filteredSpecies();const shown=entries.slice(0,state.limit);
    for(const url of state.coverUrls)URL.revokeObjectURL(url);state.coverUrls=[];
    const photosBySpecies=new Map();for(const p of activePhotos()){const old=photosBySpecies.get(p.speciesId);if(!old||p.createdAt>old.createdAt)photosBySpecies.set(p.speciesId,p);}
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
    const selected=activePhotos().filter(x=>x.speciesId===state.activeId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
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
    if(event)event.preventDefault();
    const id=state.activeId;if(!id)return;
    const btn=$('#saveEntryButton');if(btn.disabled)return;
    btn.disabled=true;btn.textContent='Saving…';
    const files=[...$('#photoInput').files];
    let success=false;
    try{
      // Save the discovery first. A bad HEIC/image can no longer lose the "found" state.
      await put('finds',{id,date:$('#entryDate').value||today(),location:$('#entryLocation').value.trim(),notes:$('#entryNotes').value.trim(),updatedAt:new Date().toISOString(),deletedAt:null});
      await refresh();success=true;
      let savedPhotos=0,failedPhotos=0;
      for(const file of files){
        try{
          const blob=await compressImage(file);
          await put('photos',{id:crypto.randomUUID(),speciesId:id,blob,name:file.name,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),deletedAt:null});
          savedPhotos++;
        }catch(e){failedPhotos++;console.warn('Could not save selected mushroom photo',file.name,e);}
      }
      if(savedPhotos)await refresh();
      $('#entryDialog').close();
      scheduleCloudSync();
      toast(failedPhotos?`Find saved! ${failedPhotos} photo(s) could not be added. Try JPG.`:savedPhotos?`Saved as found with ${savedPhotos} photograph(s)!`:'Saved as found! Dashboard updated.');
    }catch(error){console.error('MycoDex save failed:',error);toast('Could not save. Check device storage and try again.');}
    finally{btn.disabled=false;btn.textContent=success?'✓ Update field entry':'✓ Save as found';}
  }
  async function unmark(){
    if(!state.activeId)return;
    const previous=state.finds.get(state.activeId)||{};
    await put('finds',{...previous,id:state.activeId,updatedAt:new Date().toISOString(),deletedAt:new Date().toISOString()});
    await refresh();$('#entryDialog').close();scheduleCloudSync();
    toast('Species marked as not found. Photographs retained.');
  }
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
    const photos=[];for(const p of state.photos)photos.push({id:p.id,speciesId:p.speciesId,name:p.name,createdAt:p.createdAt,updatedAt:p.updatedAt,deletedAt:p.deletedAt||null,data:p.blob?await fileAsDataUrl(p.blob):null});
    const payload={type:'mycodex-uk-backup',version:1,exportedAt:new Date().toISOString(),finds:await getAll('finds'),photos,catalog:await getAll('catalog')};
    download(JSON.stringify(payload),'mycodex-backup-'+today()+'.json');b.textContent=`Backup created: ${payload.finds.length} finds and ${photos.length} photographs.`;
  }catch(error){b.textContent='Could not create backup: '+error.message;}}
  async function restoreBackup(file){const b=$('#backupMessage');try{
    b.textContent='Reading backup…';const data=JSON.parse(await file.text());if(data.type!=='mycodex-uk-backup'||!Array.isArray(data.finds)||!Array.isArray(data.photos))throw new Error('Not a MycoDex backup.');
    if(!confirm('Restore this backup? It will replace existing finds, photographs and added catalogue species on THIS device.')){b.textContent='Restore cancelled.';return;}
    const photos=data.photos.map(p=>({id:p.id,speciesId:p.speciesId,name:p.name||'photo',createdAt:p.createdAt||new Date().toISOString(),updatedAt:p.updatedAt||p.createdAt||new Date().toISOString(),deletedAt:p.deletedAt||null,blob:p.data?dataUrlToBlob(p.data):null}));
    await new Promise((resolve,reject)=>{const tx=state.db.transaction(['finds','photos','catalog'],'readwrite');for(const name of ['finds','photos','catalog'])tx.objectStore(name).clear();for(const item of data.finds)tx.objectStore('finds').put(item);for(const item of photos)tx.objectStore('photos').put(item);for(const item of data.catalog||[])tx.objectStore('catalog').put(item);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
    await loadSpecies();await refresh();scheduleCloudSync();b.textContent=`Restored ${data.finds.length} finds and ${photos.length} photographs.`;toast('Backup successfully restored!');
  }catch(error){console.error(error);b.textContent='Restore failed: '+error.message;}finally{$('#backupInput').value='';}}
  async function loadSpecies(){
    const response=await fetch('./data/species.json',{cache:'no-cache'});if(!response.ok)throw new Error('Could not load data/species.json.');const seed=await response.json();
    const imported=await getAll('catalog');const combined=new Map();for(const s of seed.concat(imported)){const item=normaliseSpecies(s);if(item)combined.set(item.id,item);}
    state.species=[...combined.values()].sort((a,b)=>a.scientificName.localeCompare(b.scientificName));refreshGroups();
  }
  function setup(){
    $('#speciesGrid').addEventListener('click',e=>{const card=e.target.closest('[data-entry]');if(card)openEntry(card.dataset.entry);});
    $('#photoGallery').addEventListener('click',async e=>{const button=e.target.closest('[data-photo-remove]');if(!button)return;if(!confirm('Delete this photograph?'))return;const old=state.photos.find(p=>p.id===button.dataset.photoRemove);if(!old)return;await put('photos',{...old,updatedAt:new Date().toISOString(),deletedAt:new Date().toISOString()});await refresh();await drawGallery();scheduleCloudSync();toast('Photograph deleted.');});
    $('#entryForm').addEventListener('submit',saveEntry);$('#saveEntryButton').addEventListener('click',saveEntry);$('#unmarkButton').addEventListener('click',unmark);
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
    $('#cloudLoginForm').addEventListener('submit',async e=>{
      e.preventDefault();const btn=$('#cloudSendLink');btn.disabled=true;
      try{await cloud.sendLink($('#cloudEmailInput').value.trim());cloudMessage('Check your email for the secure sign-in link. Open it on this device.');}
      catch(error){cloudError(error);}finally{btn.disabled=false;}
    });
    $('#cloudLogout').addEventListener('click',async()=>{try{await cloud.signOut();cloudUI();cloudMessage('Signed out. Local discoveries remain on this device.');}catch(error){cloudError(error);}});
    $('#cloudSyncNow').addEventListener('click',()=>syncCloud());
    window.addEventListener('online',scheduleCloudSync);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleCloudSync();});

  }
  async function init(){try{
    if(!window.indexedDB)throw new Error('IndexedDB is not available.');setup();state.db=await openDatabase();await loadSpecies();await refresh();initCloud();
    if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('Offline mode not enabled',e));
  }catch(error){console.error(error);$('#resultsCount').textContent='App could not start: '+error.message;toast('App could not start. Open it through GitHub Pages (HTTPS), not as a local file.');}}
  init();
})();