(() => {
'use strict';

const SB_URL='https://verofwurljrefospefiz.supabase.co';
const SB_KEY='sb_publishable_quKumiIdYiZSyNZsaCDcfQ_WSb-ASBC';
const APP_URL='https://fthgygsz57.github.io/Komsum-Android/';
const VAPID_PUBLIC='BHMCmYMLVoz1o_sEhEMfONnKom1K2wpK3YroOhDugPYcX840tC5O636L_2xfmTVAZlwIa3USkUdLw7hM7xZd1gM';
const PTT_BASE='https://raw.githubusercontent.com/cyaxaress/turkiye-il-ilce-mah/main/PTT/iller';
const locationCache={cities:null,districts:new Map(),neighborhoods:new Map()};
const { createClient } = window.supabase || {};
const app=document.getElementById('app');
const modal=document.getElementById('modalRoot');
const nav=document.querySelector('.bottom-nav');
const topbar=document.querySelector('.topbar');
const nb=document.getElementById('neighborhoodButton');
const refreshBtn=document.getElementById('refreshButton');
const themeBtn=document.getElementById('themeButton');

if(!createClient){
  app.innerHTML='<div class="empty"><div class="emoji">⚠️</div><h3>Bağlantı kurulamadı</h3><p>Supabase istemcisi yüklenemedi. İnternet bağlantını kontrol edip tekrar aç.</p></div>';
  return;
}

const sb=createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let state={user:null,profile:null,memberships:[],neighborhood:null,posts:[],items:[],help:[],lost:[],recs:[],requests:[],profiles:[],members:[],conversations:[],conversationMembers:[],messages:[],notifications:[],siteSuggestions:[],mediaUrls:{}};
let realtime=null;
let reloadTimer=null;
let booting=false;
let sitePickerContext={nid:null,afterJoin:false};

const e=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const route=()=>((location.hash||'#/feed').replace(/^#\/?/,'').split('?')[0]||'feed');
const go=r=>location.hash='#/'+r;
const fmtDate=v=>{try{return new Date(v).toLocaleString('tr-TR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}catch{return ''}};
const ownerName=x=>x?.profiles?.full_name||x?.owner_profile?.full_name||x?.requester_profile?.full_name||'Komşu';
const mine=x=>state.user&&[x.author_id,x.owner_id,x.requester_id,x.sender_id].includes(state.user.id);
const currentMembership=()=>state.memberships.find(x=>x.neighborhood_id===state.neighborhood?.id);
const canModerate=()=>['admin','moderator'].includes(currentMembership()?.role);
const canAdmin=()=>currentMembership()?.role==='admin';
const unreadNotifications=()=>state.notifications.filter(n=>!n.read_at).length;
function conversationUnread(id){
  const own=state.conversationMembers.find(m=>m.conversation_id===id&&m.user_id===state.user?.id);
  const since=own?.last_read_at?new Date(own.last_read_at).getTime():0;
  return state.messages.filter(m=>m.conversation_id===id&&m.sender_id!==state.user?.id&&new Date(m.created_at).getTime()>since).length;
}
const unreadMessages=()=>state.conversations.reduce((n,c)=>n+conversationUnread(c.id),0);

function pushSupported(){return 'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window}
function isIOS(){return /iPad|iPhone|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1)}
function isStandalone(){return window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true}
function pushStatusText(){if(!pushSupported())return 'Bu cihazda desteklenmiyor';if(Notification.permission==='denied')return 'İzin kapalı';if(Notification.permission==='granted')return 'Açık';return 'Kapalı'}
function urlBase64ToUint8Array(base64String){const padding='='.repeat((4-base64String.length%4)%4),base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
async function registerAppServiceWorker(){
  if(!('serviceWorker' in navigator)||location.protocol!=='https:')return null;
  try{return await navigator.serviceWorker.register('./sw.js',{scope:'./'})}catch(err){console.warn('Service worker kayıt hatası',err);return null}
}
function pushSettings(){
  if(!pushSupported()){open('Telefon Bildirimleri','<div class="notice">Bu cihaz veya uygulama biçimi Web Push desteklemiyor. iPhone’da Komşum’u Ana Ekran’dan açmalısın.</div>');return}
  const iosHint=isIOS()&&!isStandalone()?'<div class="notice">iPhone’da gerçek push için Komşum Safari’den <strong>Ana Ekrana Ekle</strong> ile kurulmalı ve uygulama Ana Ekrandaki simgeden açılmalı.</div>':'';
  open('Telefon Bildirimleri',`${iosHint}<div class="notice"><strong>Durum:</strong> ${e(pushStatusText())}</div><div class="form-actions"><button class="primary-btn" data-a="push-enable">Bildirimleri Aç</button><button class="secondary-btn" data-a="push-disable">Bildirimleri Kapat</button></div><small class="hint">Yeni mesaj ve ödünç güncellemeleri uygulama kapalıyken de kilit ekranına gelebilir.</small>`)
}
async function enablePush(){
  if(!pushSupported())throw new Error('Bu cihaz Web Push desteklemiyor.');
  if(isIOS()&&!isStandalone())throw new Error('iPhone’da önce Komşum’u Ana Ekrana ekleyip oradaki simgeden açmalısın.');
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw new Error('Bildirim izni verilmedi. iPhone Ayarlar > Bildirimler > Komşum bölümünden de kontrol edebilirsin.');
  await registerAppServiceWorker();
  const reg=await navigator.serviceWorker.ready;
  let sub=await reg.pushManager.getSubscription();
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC)});
  const json=sub.toJSON(),keys=json.keys||{};
  if(!json.endpoint||!keys.p256dh||!keys.auth)throw new Error('Push aboneliği oluşturulamadı.');
  const {error}=await sb.rpc('register_push_subscription',{p_endpoint:json.endpoint,p_p256dh:keys.p256dh,p_auth:keys.auth,p_platform:isIOS()?'ios-pwa':'web-pwa',p_user_agent:navigator.userAgent});
  if(error)throw error;
  close();render();toast('Telefon bildirimleri açıldı 🔔');
}
async function disablePush(){
  if(!pushSupported()){close();return}
  const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();
  if(sub){const endpoint=sub.endpoint;try{await sb.rpc('unregister_push_subscription',{p_endpoint:endpoint})}catch{}await sub.unsubscribe();}
  close();render();toast('Telefon bildirimleri kapatıldı');
}


async function compressImage(file){
  if(!file||!file.size)return null;
  if(!String(file.type||'').startsWith('image/'))throw new Error('Lütfen bir fotoğraf seç.');
  const objectUrl=URL.createObjectURL(file);
  try{
    const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Fotoğraf açılamadı. JPG, PNG veya HEIC deneyebilirsin.'));i.src=objectUrl;});
    const max=1600, scale=Math.min(1,max/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
    const w=Math.max(1,Math.round((img.naturalWidth||img.width)*scale)),h=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    canvas.getContext('2d').drawImage(img,0,0,w,h);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.82));
    if(!blob)throw new Error('Fotoğraf işlenemedi.');
    return blob;
  }finally{URL.revokeObjectURL(objectUrl)}
}
async function uploadMedia(file,nid){
  const blob=await compressImage(file); if(!blob)return null;
  const rid=(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2));
  const path=`${nid}/${state.user.id}/${rid}.jpg`;
  const {error}=await sb.storage.from('komsum-media').upload(path,blob,{contentType:'image/jpeg',cacheControl:'3600',upsert:false});
  if(error)throw error; return path;
}
async function hydrateMedia(){
  state.mediaUrls={};
  const rows=[...state.posts,...state.items,...state.help,...state.lost,...state.recs];
  const paths=[...new Set(rows.map(x=>x.image_path).filter(Boolean))];
  await Promise.all(paths.map(async path=>{const {data,error}=await sb.storage.from('komsum-media').createSignedUrl(path,3600);if(!error&&data?.signedUrl)state.mediaUrls[path]=data.signedUrl;}));
}
function mediaMarkup(x){const u=x?.image_path&&state.mediaUrls[x.image_path];return u?`<img class="content-photo" src="${e(u)}" alt="${e(x.title||'Fotoğraf')}" loading="lazy">`:''}


function toast(msg){
  const root=document.getElementById('toastRoot');
  if(!root)return;
  const d=document.createElement('div'); d.className='toast'; d.textContent=msg; root.appendChild(d);
  setTimeout(()=>d.remove(),3000);
}
function head(t,d,b=''){return `<div class="page-head"><div><h1 class="page-title">${e(t)}</h1><p class="page-subtitle">${e(d)}</p></div>${b}</div>`}
function empty(t){return `<div class="empty"><div class="emoji">🏘️</div><h3>Henüz kayıt yok</h3><p>${e(t)}</p></div>`}
function open(title,body){modal.hidden=false;modal.innerHTML=`<div class="modal"><div class="modal-grabber"></div><div class="modal-head"><div><h2>${e(title)}</h2></div><button class="close-btn" data-a="close">×</button></div>${body}</div>`}
function close(){modal.hidden=true;modal.innerHTML=''}
function setShell(authenticated=true){nav.style.display=authenticated?'':'none';topbar.style.display='';}
function setBusy(msg='Yükleniyor…'){app.innerHTML=`<div class="empty"><div class="emoji">⏳</div><h3>${e(msg)}</h3><p>Komşum verileri hazırlanıyor.</p></div>`}

async function init(){
  applyTheme(localStorage.getItem('komsum.theme')||'light');
  const {data:{session}}=await sb.auth.getSession();
  await boot(session);
  sb.auth.onAuthStateChange((event,session)=>{
    if(event==='PASSWORD_RECOVERY'){setTimeout(()=>passwordResetForm(),0);return;}
    if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='TOKEN_REFRESHED'||event==='USER_UPDATED') setTimeout(()=>boot(session),0);
  });
}

async function boot(session){
  if(booting)return; booting=true;
  try{
    if(!session?.user){
      state={user:null,profile:null,memberships:[],neighborhood:null,posts:[],items:[],help:[],lost:[],recs:[],requests:[],profiles:[],members:[],conversations:[],conversationMembers:[],messages:[],notifications:[],siteSuggestions:[],mediaUrls:{}};
      if(realtime){await sb.removeChannel(realtime);realtime=null;}
      renderAuth(); return;
    }
    state.user=session.user;
    setShell(true); setBusy();
    await loadIdentity();
    if(!state.memberships.length){renderNeighborhoodSetup();return;}
    if(!state.neighborhood) state.neighborhood=state.memberships[0].neighborhoods;
    await loadAll();
    subscribeRealtime();
    render();
  }catch(err){console.error(err);app.innerHTML=head('Bağlantı Hatası','Veriler alınamadı')+`<div class="notice danger">${e(err.message||err)}</div><button class="primary-btn" data-a="retry">Tekrar Dene</button>`}
  finally{booting=false;}
}

async function loadIdentity(){
  const uid=state.user.id;
  let {data:profile,error:pErr}=await sb.from('profiles').select('*').eq('id',uid).single();
  if(pErr)throw pErr;
  state.profile=profile;
  let {data:members,error:mErr}=await sb.from('memberships').select('neighborhood_id,role,joined_at,site_id,residential_sites!site_id(id,name,brand),neighborhoods(id,name,city,district,invite_code)').eq('user_id',uid).order('joined_at');
  if(mErr)throw mErr;
  state.memberships=members||[];
  if(state.neighborhood&&!state.memberships.some(m=>m.neighborhood_id===state.neighborhood.id)) state.neighborhood=null;
}

async function loadAll(){
  const nid=state.neighborhood.id;
  const [posts,items,help,lost,recs,requests,members,convs,convMembers,messages,notifications,siteSuggestions]=await Promise.all([
    sb.from('posts').select('*,profiles!author_id(full_name)').eq('neighborhood_id',nid).order('created_at',{ascending:false}),
    sb.from('items').select('*,profiles!owner_id(full_name)').eq('neighborhood_id',nid).order('created_at',{ascending:false}),
    sb.from('help_posts').select('*,profiles!author_id(full_name)').eq('neighborhood_id',nid).order('created_at',{ascending:false}),
    sb.from('lost_found').select('*,profiles!author_id(full_name)').eq('neighborhood_id',nid).order('created_at',{ascending:false}),
    sb.from('recommendations').select('*,profiles!author_id(full_name)').eq('neighborhood_id',nid).order('created_at',{ascending:false}),
    sb.from('borrow_requests').select('*,items(id,title,owner_id,neighborhood_id),profiles!requester_id(full_name)').order('created_at',{ascending:false}),
    sb.from('memberships').select('user_id,role,site_id,profiles!user_id(id,full_name,avatar_url),residential_sites!site_id(id,name)').eq('neighborhood_id',nid).order('joined_at'),
    sb.from('conversations').select('*').eq('neighborhood_id',nid).order('created_at',{ascending:false}),
    sb.from('conversation_members').select('conversation_id,user_id,last_read_at,muted,profiles!user_id(id,full_name)').order('joined_at'),
    sb.from('messages').select('*').order('created_at',{ascending:true}),
    sb.from('notifications').select('*').eq('user_id',state.user.id).order('created_at',{ascending:false}).limit(100),
    sb.from('site_suggestions').select('*,profiles!user_id(full_name)').eq('neighborhood_id',nid).eq('status','pending').order('created_at',{ascending:false})
  ]);
  for(const r of [posts,items,help,lost,recs,requests,members,convs,convMembers,messages,notifications,siteSuggestions]) if(r.error)throw r.error;
  state.posts=posts.data||[]; state.items=items.data||[]; state.help=help.data||[]; state.lost=lost.data||[]; state.recs=recs.data||[];
  state.requests=(requests.data||[]).filter(q=>q.items?.neighborhood_id===nid);
  state.members=members.data||[]; state.profiles=state.members.map(x=>x.profiles).filter(Boolean);
  state.conversations=convs.data||[]; state.conversationMembers=convMembers.data||[]; state.messages=messages.data||[];
  state.notifications=notifications.data||[]; state.siteSuggestions=siteSuggestions.data||[];
  await hydrateMedia();
}

function subscribeRealtime(){
  if(realtime)sb.removeChannel(realtime);
  const nid=state.neighborhood.id;
  realtime=sb.channel('komsum-'+nid);
  ['posts','items','help_posts','lost_found','recommendations'].forEach(table=>{
    realtime.on('postgres_changes',{event:'*',schema:'public',table,filter:`neighborhood_id=eq.${nid}`},scheduleReload);
  });
  realtime.on('postgres_changes',{event:'*',schema:'public',table:'borrow_requests'},scheduleReload);
  realtime.on('postgres_changes',{event:'*',schema:'public',table:'messages'},scheduleReload);
  realtime.on('postgres_changes',{event:'*',schema:'public',table:'conversation_members'},scheduleReload);
  realtime.on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`user_id=eq.${state.user.id}`},scheduleReload);
  realtime.subscribe();
}

function scheduleReload(){clearTimeout(reloadTimer);reloadTimer=setTimeout(async()=>{try{await loadAll();render();}catch(err){console.error(err)}},400)}

function renderAuth(){
  setShell(false); nb.textContent='Giriş gerekli';
  app.innerHTML=`<div class="auth-wrap"><div class="card"><div class="profile-avatar" style="margin:auto">🏘️</div><h1 class="page-title" style="text-align:center">Komşum’a Hoş Geldin</h1><p class="page-subtitle" style="text-align:center">Mahallendeki komşularla ortak akış, ödünç, pazar ve yardımlaşma.</p><div class="form-row"><button class="primary-btn" data-a="auth-login">Giriş Yap</button><button class="secondary-btn" data-a="auth-signup">Kayıt Ol</button></div><button class="text-btn" data-a="forgot-password">Şifremi unuttum</button></div></div>`;
}
function authForm(mode){
  const signup=mode==='signup';
  open(signup?'Kayıt Ol':'Giriş Yap',`<form id="authForm" data-mode="${mode}" class="form-grid">${signup?`<div class="field"><label>Ad Soyad</label><input name="name" required maxlength="80" autocomplete="name"></div>`:''}<div class="field"><label>E-posta</label><input name="email" type="email" required autocomplete="email"></div><div class="field"><label>Şifre</label><input name="password" type="password" required minlength="6" autocomplete="${signup?'new-password':'current-password'}"></div><div class="form-actions"><button type="button" class="secondary-btn" data-a="close">İptal</button><button class="primary-btn">${signup?'Hesap Oluştur':'Giriş Yap'}</button></div>${signup?'<small class="hint">Kayıttan sonra e-posta adresini doğrulaman istenebilir.</small>':''}</form>`)
}
async function submitAuth(form){
  const fd=new FormData(form), email=String(fd.get('email')).trim(), password=String(fd.get('password'));
  const mode=form.dataset.mode; form.querySelector('.primary-btn').disabled=true;
  if(mode==='signup'){
    const name=String(fd.get('name')).trim();
    const {data,error}=await sb.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:APP_URL}});
    if(error)throw error; close();
    if(!data.session){open('E-postanı Doğrula',`<div class="notice"><strong>${e(email)}</strong> adresine doğrulama e-postası gönderildi. Bağlantı seni tekrar Komşum’a getirecek.</div><div class="form-actions"><button class="primary-btn" data-a="close">Tamam</button></div>`)}
  }else{const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;close();}
}
function forgotPasswordForm(){open('Şifremi Unuttum',`<form id="forgotPasswordForm" class="form-grid"><div class="field"><label>E-posta</label><input name="email" type="email" required autocomplete="email"></div><small class="hint">Şifre yenileme bağlantısını e-postana göndereceğiz.</small><div class="form-actions"><button type="button" class="secondary-btn" data-a="close">İptal</button><button class="primary-btn">Bağlantı Gönder</button></div></form>`)}
async function submitForgotPassword(form){const email=String(new FormData(form).get('email')).trim();const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:APP_URL});if(error)throw error;close();toast('Şifre yenileme e-postası gönderildi')}
function passwordResetForm(){open('Yeni Şifre Belirle',`<form id="passwordRecoveryForm" class="form-grid"><div class="field"><label>Yeni şifre</label><input name="password" type="password" required minlength="8" autocomplete="new-password"></div><div class="field"><label>Yeni şifre tekrar</label><input name="password2" type="password" required minlength="8" autocomplete="new-password"></div><div class="form-actions"><button class="primary-btn">Şifreyi Değiştir</button></div></form>`)}
async function submitPasswordRecovery(form){const fd=new FormData(form),a=String(fd.get('password')),b=String(fd.get('password2'));if(a!==b)throw new Error('Şifreler aynı değil.');const {error}=await sb.auth.updateUser({password:a});if(error)throw error;close();toast('Şifren değiştirildi')}

function locationJoinMarkup(prefix){
  return `<form id="selectNeighborhood" data-prefix="${prefix}" class="form-grid">
    <div class="field"><label>İl</label><select id="${prefix}City" required><option value="">İl seç</option></select></div>
    <div class="field"><label>İlçe</label><select id="${prefix}District" required disabled><option value="">Önce il seç</option></select></div>
    <div class="field"><label>Mahalle</label><select id="${prefix}Neighborhood" required disabled><option value="">Önce ilçe seç</option></select></div>
    <button id="${prefix}JoinButton" class="primary-btn" disabled>Mahalleye Katıl</button>
    <small class="hint">Mahalleler PTT adres verisinden seçilir. Aynı mahalleyi seçen kullanıcılar aynı topluluğa bağlanır.</small>
  </form>`;
}

async function pttFetch(path){
  const res=await fetch(`${PTT_BASE}/${path}`,{cache:'no-cache'});
  if(!res.ok)throw new Error('Adres listesi alınamadı. İnternet bağlantını kontrol et.');
  return res.json();
}

function resetSelect(select,label){
  select.innerHTML='';
  const opt=document.createElement('option'); opt.value=''; opt.textContent=label; select.appendChild(opt);
  select.disabled=true;
}

async function initLocationSelectors(prefix){
  const city=document.getElementById(prefix+'City');
  const district=document.getElementById(prefix+'District');
  const neighborhood=document.getElementById(prefix+'Neighborhood');
  const button=document.getElementById(prefix+'JoinButton');
  if(!city||!district||!neighborhood||!button)return;

  try{
    city.disabled=true;
    const cities=locationCache.cities||(locationCache.cities=await pttFetch('iller.json'));
    city.innerHTML='<option value="">İl seç</option>';
    cities.forEach(row=>{
      const opt=document.createElement('option');
      opt.value=row.il_id; opt.textContent=row.il_adi; opt.dataset.slug=row.il_slug; opt.dataset.name=row.il_adi;
      city.appendChild(opt);
    });
    city.disabled=false;

    city.addEventListener('change',()=>safe(async()=>{
      resetSelect(district,'İlçe seç'); resetSelect(neighborhood,'Önce ilçe seç'); button.disabled=true;
      const selected=city.selectedOptions[0]; if(!selected?.value)return;
      const slug=selected.dataset.slug;
      let districts=locationCache.districts.get(slug);
      if(!districts){districts=await pttFetch(`${slug}/ilceler.json`);locationCache.districts.set(slug,districts)}
      district.innerHTML='<option value="">İlçe seç</option>';
      districts.forEach(row=>{
        const opt=document.createElement('option');
        opt.value=row.ilce_id; opt.textContent=row.ilce_adi; opt.dataset.slug=row.ilce_slug; opt.dataset.name=row.ilce_adi;
        district.appendChild(opt);
      });
      district.disabled=false;
    }));

    district.addEventListener('change',()=>safe(async()=>{
      resetSelect(neighborhood,'Mahalle seç'); button.disabled=true;
      const cityOpt=city.selectedOptions[0], districtOpt=district.selectedOptions[0];
      if(!cityOpt?.value||!districtOpt?.value)return;
      const key=`${cityOpt.dataset.slug}/${districtOpt.dataset.slug}`;
      let neighborhoods=locationCache.neighborhoods.get(key);
      if(!neighborhoods){neighborhoods=await pttFetch(`${key}/mahalleler.json`);locationCache.neighborhoods.set(key,neighborhoods)}
      neighborhood.innerHTML='<option value="">Mahalle seç</option>';
      neighborhoods.forEach(row=>{
        const opt=document.createElement('option');
        opt.value=row.mahalle_id; opt.textContent=row.mahalle_adi; opt.dataset.name=row.mahalle_adi; opt.dataset.postal=row.posta_kodu||'';
        neighborhood.appendChild(opt);
      });
      neighborhood.disabled=false;
    }));

    neighborhood.addEventListener('change',()=>{button.disabled=!neighborhood.value});
  }catch(err){
    console.error(err); toast(err.message||'Adres listesi alınamadı');
  }
}

function renderNeighborhoodSetup(){
  nav.style.display='none'; nb.textContent='Mahalle seçilmedi';
  app.innerHTML=head('Mahalleni Seç','İl, ilçe ve mahalle seçerek topluluğuna katıl. Davet kodu varsa hızlı katılım da kullanabilirsin.')+`<div class="stack"><div class="card"><h3 class="card-title">Adresinden mahalle seç</h3>${locationJoinMarkup('setup')}</div><div class="card"><h3 class="card-title">Davet koduyla hızlı katıl</h3><form id="joinNeighborhood" class="form-grid"><div class="field"><label>Davet Kodu</label><input name="code" required maxlength="20" autocapitalize="characters" placeholder="Örn. A1B2C3D4"></div><button class="secondary-btn">Davet Koduyla Katıl</button></form></div><button class="text-btn" data-a="logout">Çıkış Yap</button></div>`;
  setTimeout(()=>safe(()=>initLocationSelectors('setup')),0);
}

async function joinSelectedNeighborhood(form){
  const prefix=form.dataset.prefix;
  const city=document.getElementById(prefix+'City')?.selectedOptions[0];
  const district=document.getElementById(prefix+'District')?.selectedOptions[0];
  const neighborhood=document.getElementById(prefix+'Neighborhood')?.selectedOptions[0];
  if(!city?.value||!district?.value||!neighborhood?.value)throw new Error('İl, ilçe ve mahalle seçmelisin.');
  const {data,error}=await sb.rpc('join_neighborhood_by_ptt',{
    p_il_id:city.value,
    p_il_name:city.dataset.name,
    p_ilce_id:district.value,
    p_ilce_name:district.dataset.name,
    p_mahalle_id:neighborhood.value,
    p_mahalle_name:neighborhood.dataset.name,
    p_posta_kodu:neighborhood.dataset.postal||null
  });
  if(error)throw error;
  toast('Mahalleye katıldın');
  await openSitePicker(data,true);
}

async function joinNeighborhood(form){
  const code=String(new FormData(form).get('code')).trim().toUpperCase(); const {data,error}=await sb.rpc('join_neighborhood',{p_invite_code:code});
  if(error)throw error; toast('Mahalleye katıldın'); await openSitePicker(data,true);
}

async function getNeighborhoodSites(nid){
  const {data,error}=await sb.from('residential_site_neighborhoods')
    .select('site_id,residential_sites!site_id(id,name,brand)')
    .eq('neighborhood_id',nid);
  if(error)throw error;
  return (data||[]).map(x=>x.residential_sites).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,'tr'));
}

async function openSitePicker(nid,afterJoin=false){
  sitePickerContext={nid,afterJoin};
  const sites=await getNeighborhoodSites(nid);
  open('Siteni Seç',`<div class="stack"><button class="setting-row" data-a="set-site" data-nid="${nid}" data-site=""><span>🏘️</span><span class="grow"><strong>Mahalle geneli</strong><small>Sitede oturmuyorum / site seçmek istemiyorum</small></span></button>${sites.map(x=>`<button class="setting-row" data-a="set-site" data-nid="${nid}" data-site="${x.id}"><span>🏢</span><span class="grow"><strong>${e(x.name)}</strong><small>${e(x.brand||'Konut sitesi')}</small></span></button>`).join('')}<button class="setting-row" data-a="suggest-site" data-nid="${nid}"><span>➕</span><span class="grow"><strong>Sitem listede yok</strong><small>Site adını doğrulama için gönder</small></span></button></div>`);
}

async function setSiteChoice(nid,siteId){
  const {error}=await sb.rpc('set_membership_site',{p_neighborhood_id:nid,p_site_id:siteId||null});
  if(error)throw error;
  const after=sitePickerContext.afterJoin;
  close();
  await loadIdentity();
  const membership=state.memberships.find(x=>x.neighborhood_id===nid);
  if(membership)state.neighborhood=membership.neighborhoods;
  if(after&&state.neighborhood){await loadAll();subscribeRealtime();go('feed');}
  render(); toast(siteId?'Site seçildi':'Mahalle geneli seçildi');
}

function suggestSite(nid){
  open('Sitem Listede Yok',`<form id="siteSuggestionForm" data-nid="${nid}" class="form-grid"><div class="field"><label>Site / Konut Projesi Adı</label><input name="name" required minlength="2" maxlength="160" placeholder="Örn. Avrupa Konutları Atakent"></div><small class="hint">Öneri doğrulandıktan sonra bu mahalledeki herkes için tek seçenek olarak yayınlanır.</small><div class="form-actions"><button type="button" class="secondary-btn" data-a="close">İptal</button><button class="primary-btn">Gönder</button></div></form>`);
}

async function submitSiteSuggestion(form){
  const nid=form.dataset.nid,name=String(new FormData(form).get('name')||'').trim();
  const {error}=await sb.from('site_suggestions').insert({user_id:state.user.id,neighborhood_id:nid,suggested_name:name});
  if(error)throw error;
  toast('Site önerisi doğrulamaya gönderildi');
  await setSiteChoice(nid,null);
}

function card(x,kind,extra=''){
  const name=ownerName(x),isMine=mine(x),title=x.title||'Paylaşım',text=x.body||x.description||'',canDelete=isMine||canModerate();
  return `<article class="card"><div class="card-head"><div class="avatar">${e((name||'K')[0])}</div><div class="card-meta"><strong>${e(name)}</strong><span class="meta">${e(fmtDate(x.created_at))}</span></div></div><h3 class="card-title">${e(title)}</h3>${mediaMarkup(x)}<div class="card-text">${e(text)}</div>${extra}<div class="card-footer">${isMine?`<span class="spacer"></span><button class="text-btn" data-a="edit" data-k="${kind}" data-id="${x.id}">Düzenle</button>`:''}${canDelete?`<button class="text-btn danger" data-a="del" data-k="${kind}" data-id="${x.id}">Sil</button>`:''}</div></article>`
}

function render(){
  if(!state.user){renderAuth();return}
  if(!state.memberships.length){renderNeighborhoodSetup();return}
  nav.style.display=''; nb.textContent=state.neighborhood?.name||'Mahalle';
  const r=route(); document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.route===r||(n.dataset.route==='more'&&['more','lost','recs','profile','messages','notifications','admin'].includes(r))));
  ({feed:feed,lend:lend,market:market,help:help,lost:lost,recs:recs,profile:profile,more:more,messages:messagesPage,notifications:notificationsPage,admin:adminPage}[r]||feed)();
}

function feed(){app.innerHTML=head('Mahalle Akışı','Mahallendeki ortak duyuru ve paylaşımlar',`<button class="primary-btn small-btn" data-a="new" data-k="posts">+ Paylaş</button>`)+`<div class="stack">${state.posts.length?state.posts.map(x=>card(x,'posts',`<div class="card-footer"><span class="badge">${e(x.category||'Genel')}</span></div>`)).join(''):empty('İlk paylaşımı sen yapabilirsin.')}</div>`}
function lend(){
  const list=state.items.filter(x=>x.kind==='lend'); const incoming=state.requests.filter(q=>q.items?.owner_id===state.user.id&&q.status==='pending');
  app.innerHTML=head('Ödünç','Komşular arasında eşya paylaşımı',`<button class="primary-btn small-btn" data-a="new" data-k="lend">+ Eşya</button>`)+(incoming.length?`<button class="setting-row" data-a="incoming"><span>🔔</span><span class="grow"><strong>${incoming.length} yeni talep</strong><small>Onaylamak veya reddetmek için dokun</small></span></button>`:'')+`<div class="stack">${list.length?list.map(x=>card(x,'lend',`<div class="card-footer"><span class="badge">${statusTR(x.status)}</span><span class="spacer"></span>${x.owner_id!==state.user.id&&x.status==='available'?`<button class="primary-btn small-btn" data-a="request" data-id="${x.id}">İste</button>`:''}</div>`)).join(''):empty('Ödünç verilecek eşya yok.')}</div>`
}
function market(){const list=state.items.filter(x=>x.kind==='market');app.innerHTML=head('Mahalle Pazarı','Mahalle içi satış ve paylaşım',`<button class="primary-btn small-btn" data-a="new" data-k="market">+ İlan</button>`)+`<div class="stack">${list.length?list.map(x=>card(x,'market',`<div class="card-footer"><span class="price">${Number(x.price||0).toLocaleString('tr-TR')} TL</span><span class="spacer"></span>${x.owner_id!==state.user.id?`<button class="secondary-btn small-btn" data-a="message-user" data-user="${x.owner_id}">Mesaj</button>`:''}</div>`)).join(''):empty('Henüz pazar ilanı yok.')}</div>`}
function help(){app.innerHTML=head('Yardımlaşma','Mahalle içinde yardım iste veya destek sun',`<button class="primary-btn small-btn" data-a="new" data-k="help">+ Yardım</button>`)+`<div class="stack">${state.help.length?state.help.map(x=>card(x,'help',`<div class="card-footer"><span class="badge">${statusTR(x.status)}</span>${x.author_id!==state.user.id?`<span class="spacer"></span><button class="secondary-btn small-btn" data-a="message-user" data-user="${x.author_id}">Yaz</button>`:''}</div>`)).join(''):empty('Yardım kaydı bulunmuyor.')}</div>`}
function lost(){app.innerHTML=head('Kayıp & Buluntu','Kaybettiğini ara, bulduğunu sahibine ulaştır',`<button class="primary-btn small-btn" data-a="new" data-k="lost">+ Kayıt</button>`)+`<div class="stack">${state.lost.length?state.lost.map(x=>card(x,'lost',`<div class="card-footer"><span class="badge ${x.type==='lost'?'danger':'accent'}">${x.type==='lost'?'Kayıp':'Bulundu'} · ${statusTR(x.status)}</span></div>`)).join(''):empty('Kayıp veya buluntu kaydı yok.')}</div>`}
function recs(){app.innerHTML=head('Tavsiyeler','Komşuların deneyimlediği usta ve işletmeler',`<button class="primary-btn small-btn" data-a="new" data-k="recs">+ Tavsiye</button>`)+`<div class="stack">${state.recs.length?state.recs.map(x=>card(x,'recs',`<div class="card-footer"><span class="badge accent">${'★'.repeat(Number(x.rating||5))}</span><span class="spacer"></span>${x.phone?`<button class="secondary-btn small-btn" data-a="call" data-phone="${e(x.phone)}">Ara</button>`:''}</div>`)).join(''):empty('İlk tavsiyeyi sen ekleyebilirsin.')}</div>`}
function more(){
  const n=unreadNotifications(),m=unreadMessages();
  app.innerHTML=head('Daha Fazla','Komşum’un diğer bölümleri')+`<div class="grid-menu"><button class="menu-tile" data-go="lost"><span>🔎</span><strong>Kayıp & Buluntu</strong><small>Kayıp ve bulunan eşyalar</small></button><button class="menu-tile" data-go="recs"><span>⭐</span><strong>Tavsiyeler</strong><small>Usta ve işletme önerileri</small></button><button class="menu-tile" data-go="messages"><span>💬</span><strong>Mesajlar ${m?`<b class="count-pill">${m}</b>`:''}</strong><small>Komşularla özel görüşme</small></button><button class="menu-tile" data-go="notifications"><span>🔔</span><strong>Bildirimler ${n?`<b class="count-pill">${n}</b>`:''}</strong><small>Mesaj ve ödünç güncellemeleri</small></button>${canModerate()?`<button class="menu-tile" data-go="admin"><span>🛡️</span><strong>Mahalle Yönetimi</strong><small>Üyeler ve moderasyon</small></button>`:''}<button class="menu-tile" data-go="profile"><span>👤</span><strong>Profil</strong><small>Hesap ve mahalle bilgileri</small></button></div>`
}
function profile(){
  const m=currentMembership();
  app.innerHTML=head('Profil','Hesabın ve mahalle üyeliğin')+`<div class="card profile-card"><div class="profile-avatar">${e((state.profile?.full_name||'K')[0])}</div><div><strong>${e(state.profile?.full_name||'Komşu')}</strong><div class="meta">${e(state.user.email||'')}</div></div></div><div class="card"><h3 class="card-title">${e(state.neighborhood.name)}</h3><div class="card-text">${e([state.neighborhood.district,state.neighborhood.city].filter(Boolean).join(' / '))}</div><div class="notice"><strong>Davet Kodu:</strong> ${e(state.neighborhood.invite_code)}</div><div class="notice"><strong>Site:</strong> ${e(m?.residential_sites?.name||'Mahalle geneli')}</div></div><div class="settings-list"><button class="setting-row" data-a="site-change"><span>🏢</span><span class="grow"><strong>Site / Konut projesi</strong><small>${e(m?.residential_sites?.name||'Mahalle geneli')}</small></span></button><button class="setting-row" data-a="profile-edit"><span>✏️</span><span class="grow"><strong>Profili düzenle</strong><small>Ad ve telefon bilgisi</small></span></button><button class="setting-row" data-a="push-settings"><span>🔔</span><span class="grow"><strong>Telefon bildirimleri</strong><small>${e(pushStatusText())}</small></span></button><button class="setting-row" data-a="account-settings"><span>🔐</span><span class="grow"><strong>Hesap ve güvenlik</strong><small>Şifre, e-posta ve hesabı sil</small></span></button>${canModerate()?`<button class="setting-row" data-go="admin"><span>🛡️</span><span class="grow"><strong>Mahalle yönetimi</strong><small>${e(m?.role||'')}</small></span></button>`:''}<button class="setting-row" data-a="switch-neighborhood"><span>🏘️</span><span class="grow"><strong>Mahalle değiştir</strong><small>${state.memberships.length} üyelik · ${e(m?.role||'member')}</small></span></button><button class="setting-row" data-a="logout"><span>↪</span><span class="grow"><strong>Çıkış yap</strong><small>Bu cihazdaki oturumu kapat</small></span></button></div>`
}
function messagesPage(){
  const convs=state.conversations.map(c=>{const members=state.conversationMembers.filter(m=>m.conversation_id===c.id),other=members.find(m=>m.user_id!==state.user.id)?.profiles,msgs=state.messages.filter(m=>m.conversation_id===c.id),last=msgs[msgs.length-1],unread=conversationUnread(c.id);return {c,other,last,unread};}).sort((a,b)=>new Date(b.last?.created_at||b.c.created_at)-new Date(a.last?.created_at||a.c.created_at));
  app.innerHTML=head('Mesajlar','Mahallendeki komşularla özel görüşmeler',`<button class="primary-btn small-btn" data-a="new-message">+ Yeni</button>`)+`<div class="stack">${convs.length?convs.map(x=>`<button class="setting-row" data-a="open-conv" data-id="${x.c.id}"><span class="avatar">${e((x.other?.full_name||'K')[0])}</span><span class="grow"><strong>${e(x.other?.full_name||'Komşu')} ${x.unread?`<b class="count-pill">${x.unread}</b>`:''}</strong><small>${e(x.last?.body||'Konuşmayı aç')}</small></span><small>${x.last?e(fmtDate(x.last.created_at)):''}</small></button>`).join(''):empty('Henüz mesajlaşma yok.')}</div>`
}
function notificationsPage(){
  const unread=unreadNotifications();
  app.innerHTML=head('Bildirimler',unread?`${unread} okunmamış bildirimin var`:'Tüm bildirimlerin okundu',state.notifications.length?`<button class="secondary-btn small-btn" data-a="notifications-read-all">Tümünü Okundu Yap</button>`:'')+`<div class="stack">${state.notifications.length?state.notifications.map(n=>`<button class="setting-row ${n.read_at?'':'unread-row'}" data-a="notification-open" data-id="${n.id}"><span>${n.type==='message'?'💬':'🔔'}</span><span class="grow"><strong>${e(n.title)}</strong><small>${e(n.body||'')}</small><small>${e(fmtDate(n.created_at))}</small></span>${n.read_at?'':'<b class="unread-dot"></b>'}</button>`).join(''):empty('Henüz bildirimin yok.')}</div>`
}
async function markAllNotifications(){const {error}=await sb.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',state.user.id).is('read_at',null);if(error)throw error;await loadAll();render()}
async function openNotification(id){const n=state.notifications.find(x=>x.id===id);if(!n)return;if(!n.read_at){const {error}=await sb.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id);if(error)throw error;}await loadAll();if(n.entity_type==='conversation'&&n.entity_id){go('messages');await openConversation(n.entity_id)}else if(n.entity_type==='borrow_request'){go('lend');render()}else{go('feed');render()}}

function adminPage(){
  if(!canModerate()){go('profile');return}
  const isAdmin=canAdmin(),suggestions=state.siteSuggestions||[];
  app.innerHTML=head('Mahalle Yönetimi',`${state.neighborhood.name} · ${isAdmin?'Admin':'Moderatör'}`)+`<div class="card"><h3 class="card-title">Üyeler (${state.members.length})</h3><div class="settings-list">${state.members.map(m=>`<div class="setting-row"><span class="avatar">${e((m.profiles?.full_name||'K')[0])}</span><span class="grow"><strong>${e(m.profiles?.full_name||'Komşu')}</strong><small>${e(m.role)}${m.residential_sites?.name?' · '+e(m.residential_sites.name):''}</small></span>${isAdmin&&m.user_id!==state.user.id&&m.role!=='admin'?`<button class="text-btn" data-a="admin-role" data-user="${m.user_id}" data-role="${m.role==='moderator'?'member':'moderator'}">${m.role==='moderator'?'Moderatörlüğü Kaldır':'Moderatör Yap'}</button><button class="text-btn danger" data-a="admin-remove" data-user="${m.user_id}">Çıkar</button>`:''}</div>`).join('')}</div></div>${isAdmin?`<div class="card"><h3 class="card-title">Davet Kodu</h3><div class="notice"><strong>${e(state.neighborhood.invite_code)}</strong></div><button class="secondary-btn" data-a="admin-regenerate-code">Yeni Kod Oluştur</button></div>`:''}<div class="card"><h3 class="card-title">Bekleyen Site Önerileri (${suggestions.length})</h3>${suggestions.length?suggestions.map(x=>`<div class="setting-row"><span>🏢</span><span class="grow"><strong>${e(x.suggested_name)}</strong><small>${e(x.profiles?.full_name||'Komşu')}</small></span><button class="text-btn danger" data-a="admin-site-review" data-id="${x.id}" data-ok="0">Reddet</button><button class="primary-btn small-btn" data-a="admin-site-review" data-id="${x.id}" data-ok="1">Onayla</button></div>`).join(''):'<div class="hint">Bekleyen öneri yok.</div>'}</div><div class="notice">Admin ve moderatörler uygunsuz içerikleri doğrudan kayıt üzerindeki <strong>Sil</strong> düğmesiyle kaldırabilir.</div>`
}
async function adminSetRole(user,role){const {error}=await sb.rpc('admin_set_member_role',{p_neighborhood:state.neighborhood.id,p_user:user,p_role:role});if(error)throw error;await loadAll();render();toast('Rol güncellendi')}
async function adminRemove(user){if(!confirm('Bu kullanıcı mahalleden çıkarılsın mı?'))return;const {error}=await sb.rpc('admin_remove_member',{p_neighborhood:state.neighborhood.id,p_user:user});if(error)throw error;await loadAll();render();toast('Kullanıcı çıkarıldı')}
async function adminRegenerate(){if(!confirm('Eski davet kodu geçersiz olacak. Yeni kod oluşturulsun mu?'))return;const {data,error}=await sb.rpc('admin_regenerate_invite_code',{p_neighborhood:state.neighborhood.id});if(error)throw error;await loadIdentity();const m=state.memberships.find(x=>x.neighborhood_id===state.neighborhood.id);if(m)state.neighborhood=m.neighborhoods;await loadAll();render();toast('Yeni davet kodu: '+data)}
async function adminReviewSite(id,ok){const {error}=await sb.rpc('admin_review_site_suggestion',{p_suggestion:id,p_approve:ok});if(error)throw error;await loadAll();render();toast(ok?'Site onaylandı':'Öneri reddedildi')}

function statusTR(v){return ({available:'Müsait',requested:'Talep Var',loaned:'Ödünçte',sold:'Satıldı',unavailable:'Kapalı',pending:'Bekliyor',approved:'Onaylandı',rejected:'Reddedildi',returned:'İade Edildi',cancelled:'İptal',open:'Açık',resolved:'Çözüldü',closed:'Kapalı'})[v]||v||''}

const meta={
  posts:{table:'posts',title:'Paylaşım',titleLabel:'Başlık',textLabel:'İçerik'},
  lend:{table:'items',title:'Ödünç Eşya',titleLabel:'Eşya adı',textLabel:'Açıklama'},
  market:{table:'items',title:'Pazar İlanı',titleLabel:'Ürün adı',textLabel:'Açıklama'},
  help:{table:'help_posts',title:'Yardım',titleLabel:'Başlık',textLabel:'Açıklama'},
  lost:{table:'lost_found',title:'Kayıp / Buluntu',titleLabel:'Başlık',textLabel:'Açıklama'},
  recs:{table:'recommendations',title:'Tavsiye',titleLabel:'İşletme / kişi',textLabel:'Deneyimin'}
};
function getEntity(k,id){if(k==='posts')return state.posts.find(x=>x.id===id);if(k==='lend'||k==='market')return state.items.find(x=>x.id===id);if(k==='help')return state.help.find(x=>x.id===id);if(k==='lost')return state.lost.find(x=>x.id===id);if(k==='recs')return state.recs.find(x=>x.id===id)}
function entityForm(k,id=''){
  const x=id?getEntity(k,id):null,m=meta[k],existing=x?.image_path&&state.mediaUrls[x.image_path];
  open(x?'Kaydı Düzenle':m.title,`<form id="entityForm" data-k="${k}" data-id="${id}" class="form-grid"><div class="field"><label>${e(m.titleLabel)}</label><input name="title" required maxlength="120" value="${e(x?.title||'')}"></div><div class="field"><label>${e(m.textLabel)}</label><textarea name="text" required maxlength="3000">${e(x?.body||x?.description||'')}</textarea></div>${k==='posts'?`<div class="field"><label>Kategori</label><input name="category" maxlength="40" value="${e(x?.category||'Genel')}"></div>`:''}${k==='market'?`<div class="field"><label>Fiyat (TL)</label><input name="price" type="number" min="0" step="1" required value="${e(x?.price??'')}"></div>`:''}${k==='lost'?`<div class="field"><label>Tür</label><select name="type"><option value="lost" ${x?.type==='found'?'':'selected'}>Kayıp</option><option value="found" ${x?.type==='found'?'selected':''}>Bulundu</option></select></div>`:''}${k==='recs'?`<div class="form-row"><div class="field"><label>Puan</label><select name="rating">${[5,4,3,2,1].map(n=>`<option value="${n}" ${Number(x?.rating||5)===n?'selected':''}>${n}</option>`).join('')}</select></div><div class="field"><label>Telefon</label><input name="phone" inputmode="tel" value="${e(x?.phone||'')}"></div></div>`:''}<div class="field"><label>Fotoğraf (isteğe bağlı)</label>${existing?`<img class="form-photo" src="${e(existing)}" alt="Mevcut fotoğraf"><label class="check-row"><input type="checkbox" name="remove_image" value="1"> Mevcut fotoğrafı kaldır</label>`:''}<input name="image" type="file" accept="image/*"><small class="hint">Kamera veya galeriden seçebilirsin. Fotoğraf yüklemeden önce küçültülür.</small></div><div class="form-actions"><button type="button" class="secondary-btn" data-a="close">İptal</button><button class="primary-btn">Kaydet</button></div></form>`)
}
async function saveEntity(form){
  const k=form.dataset.k,id=form.dataset.id,fd=new FormData(form),m=meta[k],uid=state.user.id,nid=state.neighborhood.id,old=id?getEntity(k,id):null;
  const btn=form.querySelector('.primary-btn');if(btn){btn.disabled=true;btn.textContent='Kaydediliyor…'}
  let imagePath=old?.image_path||null,newUpload=null;
  if(fd.get('remove_image'))imagePath=null;
  const file=fd.get('image');if(file instanceof File&&file.size){newUpload=await uploadMedia(file,nid);imagePath=newUpload;}
  let payload={image_path:imagePath};
  if(k==='posts')Object.assign(payload,{title:String(fd.get('title')).trim(),body:String(fd.get('text')).trim(),category:String(fd.get('category')||'Genel').trim()||'Genel',neighborhood_id:nid,author_id:uid});
  if(k==='lend'||k==='market')Object.assign(payload,{title:String(fd.get('title')).trim(),description:String(fd.get('text')).trim(),kind:k==='lend'?'lend':'market',price:k==='market'?Number(fd.get('price')||0):null,neighborhood_id:nid,owner_id:uid});
  if(k==='help')Object.assign(payload,{title:String(fd.get('title')).trim(),body:String(fd.get('text')).trim(),neighborhood_id:nid,author_id:uid});
  if(k==='lost')Object.assign(payload,{title:String(fd.get('title')).trim(),body:String(fd.get('text')).trim(),type:String(fd.get('type')),neighborhood_id:nid,author_id:uid});
  if(k==='recs')Object.assign(payload,{title:String(fd.get('title')).trim(),body:String(fd.get('text')).trim(),rating:Number(fd.get('rating')||5),phone:String(fd.get('phone')||'').trim()||null,neighborhood_id:nid,author_id:uid});
  const q=id?sb.from(m.table).update(payload).eq('id',id):sb.from(m.table).insert(payload),{error}=await q;
  if(error){if(newUpload)await sb.storage.from('komsum-media').remove([newUpload]);throw error}
  if(old?.image_path&&old.image_path!==imagePath&&mine(old))await sb.storage.from('komsum-media').remove([old.image_path]);
  close();toast('Kaydedildi');await loadAll();render();
}
async function deleteEntity(k,id){const x=getEntity(k,id);if(!confirm('Bu kayıt silinsin mi?'))return;const {error}=await sb.from(meta[k].table).delete().eq('id',id);if(error)throw error;if(x?.image_path&&mine(x))await sb.storage.from('komsum-media').remove([x.image_path]);await loadAll();render();toast('Silindi')}

function requestItem(id){const x=state.items.find(i=>i.id===id);open('Ödünç İste',`<form id="borrowForm" data-id="${id}" class="form-grid"><div class="notice"><strong>${e(x?.title||'Eşya')}</strong> için sahibine talep gönderilecek.</div><div class="field"><label>Not</label><textarea name="message" maxlength="1000" placeholder="Ne zaman ve ne kadar süre kullanacağını yazabilirsin."></textarea></div><div class="form-actions"><button type="button" class="secondary-btn" data-a="close">İptal</button><button class="primary-btn">Talep Gönder</button></div></form>`)}
async function submitBorrow(form){const itemId=form.dataset.id,message=String(new FormData(form).get('message')||'').trim();const {error}=await sb.from('borrow_requests').insert({item_id:itemId,requester_id:state.user.id,message:message||null});if(error)throw error;close();toast('Talep gönderildi');await loadAll();render()}
function incoming(){const qs=state.requests.filter(q=>q.items?.owner_id===state.user.id);open('Ödünç Talepleri',qs.length?qs.map(q=>`<div class="card"><strong>${e(q.profiles?.full_name||'Komşu')} → ${e(q.items?.title||'Eşya')}</strong><div class="card-text">${e(q.message||'Not bırakılmadı.')}</div><div class="card-footer"><span class="badge">${e(statusTR(q.status))}</span>${q.status==='pending'?`<span class="spacer"></span><button class="secondary-btn small-btn" data-a="borrow-status" data-id="${q.id}" data-status="rejected">Reddet</button><button class="primary-btn small-btn" data-a="borrow-status" data-id="${q.id}" data-status="approved">Onayla</button>`:''}</div></div>`).join(''):empty('Talep yok.'))}
async function updateBorrow(id,status){const q=state.requests.find(x=>x.id===id);let {error}=await sb.from('borrow_requests').update({status}).eq('id',id);if(error)throw error;if(status==='approved'&&q?.item_id){const r=await sb.from('items').update({status:'loaned'}).eq('id',q.item_id);if(r.error)throw r.error}close();await loadAll();render();toast(status==='approved'?'Talep onaylandı':'Talep reddedildi')}

function newMessage(){const others=state.profiles.filter(p=>p.id!==state.user.id);open('Yeni Mesaj',others.length?`<div class="settings-list">${others.map(p=>`<button class="setting-row" data-a="message-user" data-user="${p.id}"><span class="avatar">${e((p.full_name||'K')[0])}</span><span class="grow"><strong>${e(p.full_name||'Komşu')}</strong><small>Konuşma başlat</small></span></button>`).join('')}</div>`:empty('Mahallende başka üye görünmüyor.'))}
async function startConversation(other){const {data,error}=await sb.rpc('start_conversation',{p_other_user:other,p_neighborhood:state.neighborhood.id});if(error)throw error;close();await loadAll();await openConversation(data)}
async function openConversation(id){
  const now=new Date().toISOString();
  await sb.from('conversation_members').update({last_read_at:now}).eq('conversation_id',id).eq('user_id',state.user.id);
  await sb.from('notifications').update({read_at:now}).eq('user_id',state.user.id).eq('entity_type','conversation').eq('entity_id',id).is('read_at',null);
  await loadAll();
  const members=state.conversationMembers.filter(m=>m.conversation_id===id),otherMember=members.find(m=>m.user_id!==state.user.id),other=otherMember?.profiles,msgs=state.messages.filter(m=>m.conversation_id===id),otherRead=otherMember?.last_read_at?new Date(otherMember.last_read_at).getTime():0;
  open(other?.full_name||'Mesajlar',`<div class="stack chat-stack">${msgs.length?msgs.map(m=>{const read=m.sender_id===state.user.id&&otherRead>=new Date(m.created_at).getTime();return `<div class="card ${m.sender_id===state.user.id?'mine-message':''}"><div class="card-text">${e(m.body)}</div><small class="meta">${e(fmtDate(m.created_at))}${m.sender_id===state.user.id?(read?' · Okundu':' · Gönderildi'):''}</small></div>`}).join(''):empty('İlk mesajı sen gönder.')}</div><form id="messageForm" data-id="${id}" class="form-row" style="margin-top:12px"><input name="body" required maxlength="5000" placeholder="Mesaj yaz…"><button class="primary-btn small-btn">Gönder</button></form>`)
}
async function sendMessage(form){const body=String(new FormData(form).get('body')).trim();if(!body)return;const {error}=await sb.from('messages').insert({conversation_id:form.dataset.id,sender_id:state.user.id,body});if(error)throw error;await loadAll();await openConversation(form.dataset.id)}

function accountSettings(){open('Hesap ve Güvenlik',`<div class="settings-list"><button class="setting-row" data-a="change-password"><span>🔑</span><span class="grow"><strong>Şifreyi değiştir</strong><small>Yeni bir şifre belirle</small></span></button><button class="setting-row" data-a="change-email"><span>✉️</span><span class="grow"><strong>E-postayı değiştir</strong><small>${e(state.user.email||'')}</small></span></button><button class="setting-row" data-a="delete-account"><span>🗑️</span><span class="grow"><strong>Hesabı sil</strong><small>Hesap ve içerikler kalıcı silinir</small></span></button></div>`)}
function changePasswordForm(){open('Şifreyi Değiştir',`<form id="changePasswordForm" class="form-grid"><div class="field"><label>Yeni şifre</label><input name="password" type="password" required minlength="8" autocomplete="new-password"></div><div class="field"><label>Yeni şifre tekrar</label><input name="password2" type="password" required minlength="8" autocomplete="new-password"></div><div class="form-actions"><button type="button" class="secondary-btn" data-a="close">İptal</button><button class="primary-btn">Değiştir</button></div></form>`)}
async function saveNewPassword(form){const fd=new FormData(form),a=String(fd.get('password')),b=String(fd.get('password2'));if(a!==b)throw new Error('Şifreler aynı değil.');const {error}=await sb.auth.updateUser({password:a});if(error)throw error;close();toast('Şifre değiştirildi')}
function changeEmailForm(){open('E-postayı Değiştir',`<form id="changeEmailForm" class="form-grid"><div class="field"><label>Yeni e-posta</label><input name="email" type="email" required autocomplete="email"></div><small class="hint">Supabase güvenlik ayarına göre eski ve/veya yeni adrese onay e-postası gelebilir.</small><div class="form-actions"><button type="button" class="secondary-btn" data-a="close">İptal</button><button class="primary-btn">Değiştir</button></div></form>`)}
async function saveNewEmail(form){const email=String(new FormData(form).get('email')).trim();const {error}=await sb.auth.updateUser({email},{emailRedirectTo:APP_URL});if(error)throw error;close();toast('E-posta değişikliği için onay bağlantısını kontrol et')}
function deleteAccountForm(){open('Hesabı Kalıcı Sil',`<div class="notice danger">Bu işlem geri alınamaz. Paylaşımların, mesajların ve üyeliklerin silinecek.</div><form id="deleteAccountForm" class="form-grid"><div class="field"><label>Onaylamak için SİL yaz</label><input name="confirm" required autocomplete="off"></div><div class="form-actions"><button type="button" class="secondary-btn" data-a="close">Vazgeç</button><button class="primary-btn danger-btn">Hesabı Sil</button></div></form>`)}
async function deleteAccount(form){const value=String(new FormData(form).get('confirm')).trim().toLocaleUpperCase('tr-TR');if(value!=='SİL')throw new Error('Onay alanına SİL yazmalısın.');const {error}=await sb.functions.invoke('delete-account',{body:{confirm:true}});if(error)throw error;close();try{await sb.auth.signOut()}catch{}localStorage.removeItem('komsum.theme');renderAuth();toast('Hesap silindi')}

function profileEdit(){open('Profili Düzenle',`<form id="profileForm" class="form-grid"><div class="field"><label>Ad Soyad</label><input name="name" required maxlength="80" value="${e(state.profile?.full_name||'')}"></div><div class="field"><label>Telefon</label><input name="phone" inputmode="tel" maxlength="30" value="${e(state.profile?.phone||'')}"></div><div class="form-actions"><button type="button" class="secondary-btn" data-a="close">İptal</button><button class="primary-btn">Kaydet</button></div></form>`)}
async function saveProfile(form){const fd=new FormData(form);const {error}=await sb.from('profiles').update({full_name:String(fd.get('name')).trim(),phone:String(fd.get('phone')||'').trim()||null,updated_at:new Date().toISOString()}).eq('id',state.user.id);if(error)throw error;close();await loadIdentity();render();toast('Profil güncellendi')}
function switchNeighborhood(){open('Mahalle Değiştir',`<div class="settings-list">${state.memberships.map(m=>`<button class="setting-row" data-a="choose-neighborhood" data-id="${m.neighborhood_id}"><span>🏘️</span><span class="grow"><strong>${e(m.neighborhoods?.name||'Mahalle')}</strong><small>${e([m.neighborhoods?.district,m.neighborhoods?.city].filter(Boolean).join(' / '))}</small></span></button>`).join('')}</div><div class="section-title">Başka mahalle</div><button class="secondary-btn" data-a="join-more">Davet koduyla katıl</button>`)}
function joinMore(){
  open('Mahalleye Katıl',`<div class="stack"><div><h3 class="card-title">Adresinden mahalle seç</h3>${locationJoinMarkup('more')}</div><div class="section-title">veya davet kodu</div><form id="joinNeighborhood" class="form-grid"><div class="field"><label>Davet Kodu</label><input name="code" required maxlength="20" autocapitalize="characters"></div><button class="secondary-btn">Davet Koduyla Katıl</button></form></div>`);
  setTimeout(()=>safe(()=>initLocationSelectors('more')),0);
}
async function chooseNeighborhood(id){const m=state.memberships.find(x=>x.neighborhood_id===id);if(!m)return;state.neighborhood=m.neighborhoods;close();await loadAll();subscribeRealtime();go('feed');render()}

function applyTheme(v){document.documentElement.dataset.theme=v;localStorage.setItem('komsum.theme',v);if(themeBtn)themeBtn.textContent=v==='dark'?'☀':'☾'}
function toggleTheme(){applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark')}

async function safe(fn){try{await fn()}catch(err){console.error(err);toast(err.message||'Bir hata oluştu')}}

document.addEventListener('submit',ev=>{
  ev.preventDefault(); const f=ev.target;
  if(f.id==='authForm')return safe(()=>submitAuth(f));
  if(f.id==='forgotPasswordForm')return safe(()=>submitForgotPassword(f));
  if(f.id==='passwordRecoveryForm')return safe(()=>submitPasswordRecovery(f));
  if(f.id==='selectNeighborhood')return safe(()=>joinSelectedNeighborhood(f));
  if(f.id==='joinNeighborhood')return safe(()=>joinNeighborhood(f));
  if(f.id==='entityForm')return safe(()=>saveEntity(f));
  if(f.id==='borrowForm')return safe(()=>submitBorrow(f));
  if(f.id==='profileForm')return safe(()=>saveProfile(f));
  if(f.id==='siteSuggestionForm')return safe(()=>submitSiteSuggestion(f));
  if(f.id==='messageForm')return safe(()=>sendMessage(f));
  if(f.id==='changePasswordForm')return safe(()=>saveNewPassword(f));
  if(f.id==='changeEmailForm')return safe(()=>saveNewEmail(f));
  if(f.id==='deleteAccountForm')return safe(()=>deleteAccount(f));
});
document.addEventListener('click',ev=>{
  const el=ev.target.closest('[data-a],[data-go]'); if(!el)return;
  if(el.dataset.go)return go(el.dataset.go);
  const a=el.dataset.a;
  if(a==='close')return close(); if(a==='auth-login')return authForm('login'); if(a==='auth-signup')return authForm('signup'); if(a==='forgot-password')return forgotPasswordForm();
  if(a==='new')return entityForm(el.dataset.k); if(a==='edit')return entityForm(el.dataset.k,el.dataset.id); if(a==='del')return safe(()=>deleteEntity(el.dataset.k,el.dataset.id));
  if(a==='request')return requestItem(el.dataset.id); if(a==='incoming')return incoming(); if(a==='borrow-status')return safe(()=>updateBorrow(el.dataset.id,el.dataset.status));
  if(a==='new-message')return newMessage(); if(a==='message-user')return safe(()=>startConversation(el.dataset.user)); if(a==='open-conv')return safe(()=>openConversation(el.dataset.id));
  if(a==='notifications-read-all')return safe(()=>markAllNotifications()); if(a==='notification-open')return safe(()=>openNotification(el.dataset.id));
  if(a==='admin-role')return safe(()=>adminSetRole(el.dataset.user,el.dataset.role)); if(a==='admin-remove')return safe(()=>adminRemove(el.dataset.user)); if(a==='admin-regenerate-code')return safe(()=>adminRegenerate()); if(a==='admin-site-review')return safe(()=>adminReviewSite(el.dataset.id,el.dataset.ok==='1'));
  if(a==='set-site')return safe(()=>setSiteChoice(el.dataset.nid,el.dataset.site||null)); if(a==='suggest-site')return suggestSite(el.dataset.nid); if(a==='site-change')return safe(()=>openSitePicker(state.neighborhood.id,false));
  if(a==='push-settings')return pushSettings(); if(a==='push-enable')return safe(()=>enablePush()); if(a==='push-disable')return safe(()=>disablePush());
  if(a==='profile-edit')return profileEdit(); if(a==='account-settings')return accountSettings(); if(a==='change-password')return changePasswordForm(); if(a==='change-email')return changeEmailForm(); if(a==='delete-account')return deleteAccountForm();
  if(a==='switch-neighborhood')return switchNeighborhood(); if(a==='join-more')return joinMore(); if(a==='choose-neighborhood')return safe(()=>chooseNeighborhood(el.dataset.id));
  if(a==='logout')return safe(()=>sb.auth.signOut()); if(a==='retry')return safe(async()=>boot((await sb.auth.getSession()).data.session));
  if(a==='call'){const p=el.dataset.phone;if(p)location.href='tel:'+p.replace(/\s/g,'')}
});

window.addEventListener('hashchange',render);
refreshBtn?.addEventListener('click',()=>safe(async()=>{if(state.user&&state.neighborhood){await loadAll();render();toast('Güncellendi')}}));
themeBtn?.addEventListener('click',toggleTheme);
nb?.addEventListener('click',()=>{if(state.user&&state.memberships.length)go('profile')});

init();
})();
