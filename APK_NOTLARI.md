# Komşum APK v1.0 - Yapılan Android Uyarlamaları

- PWA arayüzü APK içine gömüldü.
- `port/5000` gibi harici API bağımlılığı yoktur.
- Android WebView + JavaScript + DOM storage etkinleştirildi.
- Kamera ve galeri için native file chooser eklendi.
- JSON yedekleme için native Android `ACTION_CREATE_DOCUMENT` akışı eklendi.
- Telefon numarası bağlantıları Android Dialer'a yönlendirildi.
- HTTP/HTTPS harici bağlantılar sistem tarayıcısına yönlendirildi.
- `file://` kaynaklarından evrensel erişim kapalı bırakılarak WebView güvenliği sıkılaştırıldı.
- Android 10 ve üzeri hedeflendi.
- GitHub Actions ile tek tık APK build workflow'u eklendi.
