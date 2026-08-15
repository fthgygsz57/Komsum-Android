# Komşum Android APK Projesi

Bu proje, Komşum mobil web uygulamasını Android WebView içinde tamamen yerel olarak çalıştırır.

## Özellikler
- Uygulama içeriği APK içine gömülüdür; açılış için internet gerekmez.
- localStorage verileri uygulama içinde kalıcı tutulur.
- Fotoğraf alanları Android kamera/galeri seçicisini açar.
- JSON yedekleme Android'in Dosyayı Kaydet ekranını kullanır.
- Telefon bağlantıları Android arama ekranına yönlendirilir.
- Paket adı: `com.komsum.mahalle`
- Min Android: Android 10 (API 29)
- Target/compile SDK: 35

## APK üretme - GitHub Actions
`.github/workflows/build-apk.yml` her `main` push'unda otomatik çalışır.
Başarılı derlemenin `Komsum-APK` artefaktında APK bulunur.

## Not
Bu APK v1.0 verileri yalnızca kurulu olduğu telefonda tutar. Gerçek çok kullanıcılı mahalle platformu için sonraki aşamada ortak backend/veritabanı eklenmelidir.
