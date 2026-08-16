(() => {
'use strict';

const SUPABASE_URL = 'https://verofwurljrefospefiz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_quKumiIdYiZSyNZsaCDcfQ_WSb-ASBC';
const LOCATION_BASE = 'https://raw.githubusercontent.com/cyaxaress/turkiye-il-ilce-mah/main/PTT/iller';
const CACHE_PREFIX = 'komsum.location.v1:';

if (!window.supabase?.createClient) return;

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

let provinces = [];
let districts = [];
let neighborhoods = [];
let patching = false;

const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

function option(value, label) {
  return `<option value="${esc(value)}">${esc(label)}</option>`;
}

function setStatus(message, kind = '') {
  const el = document.getElementById('locationStatus');
  if (!el) return;
  el.className = `notice ${kind}`.trim();
  el.textContent = message;
  el.hidden = !message;
}

function setLoading(select, label) {
  select.disabled = true;
  select.innerHTML = option('', label);
}

function readCache(key) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  try { sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value)); } catch {}
}

async function fetchJson(url, cacheKey) {
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`Adres listesi alınamadı (${response.status})`);
    const data = await response.json();
    writeCache(cacheKey, data);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function loadProvinces() {
  const province = document.getElementById('locationProvince');
  if (!province) return;
  setLoading(province, 'İller yükleniyor…');
  try {
    provinces = await fetchJson(`${LOCATION_BASE}/iller.json`, 'provinces');
    provinces.sort((a, b) => a.il_adi.localeCompare(b.il_adi, 'tr'));
    province.innerHTML = option('', 'İl seç') + provinces.map(x => option(x.il_slug, x.il_adi)).join('');
    province.disabled = false;
    setStatus('');
  } catch (error) {
    province.innerHTML = option('', 'İller yüklenemedi');
    setStatus('Adres listesi şu anda alınamadı. Davet koduyla katılabilir veya tekrar deneyebilirsin.', 'danger');
    console.error(error);
  }
}

async function onProvinceChange() {
  const provinceSelect = document.getElementById('locationProvince');
  const districtSelect = document.getElementById('locationDistrict');
  const neighborhoodSelect = document.getElementById('locationNeighborhood');
  if (!provinceSelect || !districtSelect || !neighborhoodSelect) return;

  neighborhoods = [];
  setLoading(neighborhoodSelect, 'Önce ilçe seç');
  const provinceSlug = provinceSelect.value;
  if (!provinceSlug) {
    setLoading(districtSelect, 'Önce il seç');
    return;
  }

  setLoading(districtSelect, 'İlçeler yükleniyor…');
  setStatus('');
  try {
    districts = await fetchJson(`${LOCATION_BASE}/${encodeURIComponent(provinceSlug)}/ilceler.json`, `districts:${provinceSlug}`);
    districts.sort((a, b) => a.ilce_adi.localeCompare(b.ilce_adi, 'tr'));
    districtSelect.innerHTML = option('', 'İlçe seç') + districts.map(x => option(x.ilce_slug, x.ilce_adi)).join('');
    districtSelect.disabled = false;
  } catch (error) {
    districtSelect.innerHTML = option('', 'İlçeler yüklenemedi');
    setStatus('İlçe listesi alınamadı. İnternet bağlantını kontrol edip yeniden dene.', 'danger');
    console.error(error);
  }
}

async function onDistrictChange() {
  const provinceSelect = document.getElementById('locationProvince');
  const districtSelect = document.getElementById('locationDistrict');
  const neighborhoodSelect = document.getElementById('locationNeighborhood');
  if (!provinceSelect || !districtSelect || !neighborhoodSelect) return;

  const provinceSlug = provinceSelect.value;
  const districtSlug = districtSelect.value;
  if (!provinceSlug || !districtSlug) {
    setLoading(neighborhoodSelect, 'Önce ilçe seç');
    return;
  }

  setLoading(neighborhoodSelect, 'Mahalleler yükleniyor…');
  setStatus('');
  try {
    neighborhoods = await fetchJson(
      `${LOCATION_BASE}/${encodeURIComponent(provinceSlug)}/${encodeURIComponent(districtSlug)}/mahalleler.json`,
      `neighborhoods:${provinceSlug}:${districtSlug}`
    );
    neighborhoods.sort((a, b) => a.mahalle_adi.localeCompare(b.mahalle_adi, 'tr'));
    neighborhoodSelect.innerHTML = option('', 'Mahalle seç') + neighborhoods.map(x => option(x.mahalle_id, x.mahalle_adi)).join('');
    neighborhoodSelect.disabled = false;
  } catch (error) {
    neighborhoodSelect.innerHTML = option('', 'Mahalleler yüklenemedi');
    setStatus('Mahalle listesi alınamadı. İnternet bağlantını kontrol edip yeniden dene.', 'danger');
    console.error(error);
  }
}

async function submitLocation(form) {
  const provinceSlug = form.querySelector('#locationProvince')?.value;
  const districtSlug = form.querySelector('#locationDistrict')?.value;
  const neighborhoodId = form.querySelector('#locationNeighborhood')?.value;

  const province = provinces.find(x => x.il_slug === provinceSlug);
  const district = districts.find(x => x.ilce_slug === districtSlug);
  const neighborhood = neighborhoods.find(x => x.mahalle_id === neighborhoodId);

  if (!province || !district || !neighborhood) {
    setStatus('Lütfen il, ilçe ve mahalleyi sırayla seç.', 'danger');
    return;
  }

  const submit = form.querySelector('button[type="submit"]');
  if (submit) {
    submit.disabled = true;
    submit.textContent = 'Katılınıyor…';
  }
  setStatus('Mahalle üyeliğin hazırlanıyor…');

  try {
    const { error } = await client.rpc('join_or_create_location', {
      p_mahalle_id: neighborhood.mahalle_id,
      p_mahalle_name: neighborhood.mahalle_adi,
      p_city: province.il_adi,
      p_district: district.ilce_adi,
      p_postal_code: neighborhood.posta_kodu || null
    });
    if (error) throw error;
    setStatus(`${neighborhood.mahalle_adi} mahallesine katıldın. Uygulama yenileniyor…`);
    setTimeout(() => location.reload(), 350);
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'Mahalleye katılırken bir hata oluştu.', 'danger');
    if (submit) {
      submit.disabled = false;
      submit.textContent = 'Mahalleye Katıl';
    }
  }
}

function patchNeighborhoodSetup() {
  if (patching) return;
  const oldForm = document.getElementById('createNeighborhood');
  if (!oldForm || oldForm.dataset.canonicalPatched === '1') return;

  const card = oldForm.closest('.card');
  if (!card) return;

  patching = true;
  card.innerHTML = `
    <h3 class="card-title">Mahalleni seç</h3>
    <p class="card-text">Adresini listeden seç. Aynı mahalleyi seçen komşular otomatik olarak aynı topluluğa bağlanır.</p>
    <form id="canonicalNeighborhoodForm" class="form-grid" data-canonical-patched="1">
      <div class="field">
        <label>İl</label>
        <select id="locationProvince" name="province" required disabled>
          <option value="">İller yükleniyor…</option>
        </select>
      </div>
      <div class="field">
        <label>İlçe</label>
        <select id="locationDistrict" name="district" required disabled>
          <option value="">Önce il seç</option>
        </select>
      </div>
      <div class="field">
        <label>Mahalle</label>
        <select id="locationNeighborhood" name="neighborhood" required disabled>
          <option value="">Önce ilçe seç</option>
        </select>
      </div>
      <div id="locationStatus" class="notice" hidden></div>
      <button class="primary-btn" type="submit">Mahalleye Katıl</button>
      <small class="hint">Mahalle listesi PTT tabanlı adres kataloğundan alınır. Davet kodun varsa aşağıdaki hızlı katılım alanını da kullanabilirsin.</small>
    </form>`;

  document.getElementById('locationProvince')?.addEventListener('change', onProvinceChange);
  document.getElementById('locationDistrict')?.addEventListener('change', onDistrictChange);
  loadProvinces();
  patching = false;
}

document.addEventListener('submit', event => {
  const form = event.target;
  if (form?.id !== 'canonicalNeighborhoodForm') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  submitLocation(form);
}, true);

const app = document.getElementById('app');
if (app) {
  new MutationObserver(patchNeighborhoodSetup).observe(app, { childList: true, subtree: true });
}

patchNeighborhoodSetup();
})();
