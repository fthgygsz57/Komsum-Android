# Komşum iOS / TestFlight

Komşum'un iPhone sürümü. Uygulama HTML/CSS/JS arayüzünü WKWebView içinde yerel olarak çalıştırır.

- Bundle ID: `com.komsum.mahalle`
- Minimum iOS: 15.0
- Android sürümüyle aynı Komşum web arayüzünü kullanır.
- JSON yedekleme iOS paylaşım ekranını açar.
- `tel:` ve dış web bağlantıları iOS sistem uygulamalarında açılır.

## Proje üretme

```bash
brew install xcodegen
cd ios
xcodegen generate
open Komsum.xcodeproj
```

GitHub Actions'taki `Build Komşum iOS` workflow'u imzasız iPhone Simulator build ile kaynak kodu doğrular.
TestFlight dağıtımı için Apple Developer Program üyeliği, Bundle ID kaydı ve dağıtım imzalama bilgileri gerekir.
