from pathlib import Path

p = Path('app/src/main/assets/app.js')
s = p.read_text(encoding='utf-8')

if "const VAPID_PUBLIC=" not in s:
    s = s.replace(
        "const APP_URL='https://fthgygsz57.github.io/Komsum-Android/';",
        "const APP_URL='https://fthgygsz57.github.io/Komsum-Android/';\nconst VAPID_PUBLIC='BHMCmYMLVoz1o_sEhEMfONnKom1K2wpK3YroOhDugPYcX840tC5O636L_2xfmTVAZlwIa3USkUdLw7hM7xZd1gM';"
    )

anchor = "const unreadMessages=()=>state.conversations.reduce((n,c)=>n+conversationUnread(c.id),0);"
if "function pushSupported()" not in s:
    block = r'''

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
'''
    if anchor not in s:
        raise SystemExit('unreadMessages anchor not found')
    s = s.replace(anchor, anchor + block)

init_anchor = "async function init(){\n  applyTheme(localStorage.getItem('komsum.theme')||'light');"
if "await registerAppServiceWorker();" not in s:
    if init_anchor not in s:
        raise SystemExit('init anchor not found')
    s = s.replace(init_anchor, "async function init(){\n  applyTheme(localStorage.getItem('komsum.theme')||'light');\n  await registerAppServiceWorker();")

profile_anchor = "<button class=\"setting-row\" data-a=\"account-settings\"><span>🔐</span><span class=\"grow\"><strong>Hesap ve güvenlik</strong><small>Şifre, e-posta ve hesabı sil</small></span></button>"
if "data-a=\"push-settings\"" not in s:
    push_button = "<button class=\"setting-row\" data-a=\"push-settings\"><span>🔔</span><span class=\"grow\"><strong>Telefon bildirimleri</strong><small>${e(pushStatusText())}</small></span></button>"
    if profile_anchor not in s:
        raise SystemExit('profile account button anchor not found')
    s = s.replace(profile_anchor, push_button + profile_anchor)

click_anchor = "if(a==='profile-edit')return profileEdit(); if(a==='account-settings')return accountSettings();"
if "if(a==='push-settings')" not in s:
    if click_anchor not in s:
        raise SystemExit('click anchor not found')
    s = s.replace(click_anchor, "if(a==='push-settings')return pushSettings(); if(a==='push-enable')return safe(()=>enablePush()); if(a==='push-disable')return safe(()=>disablePush());\n  " + click_anchor)

p.write_text(s, encoding='utf-8')
print('patched web push client', len(s))
