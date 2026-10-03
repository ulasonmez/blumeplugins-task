# Yapay zekâ çalışma rehberi

Bu talimatlar deponun tamamı için geçerlidir. Amaç, yeni sohbetlerin önceki sohbet hafızasına ihtiyaç duymadan projeyi anlayabilmesi ve geliştirme sonrasında proje bilgisini güncel bırakmasıdır.

## Her yeni sohbetin başlangıcında

1. [Proje rehberini](docs/PROJECT_GUIDE.md) oku. İsteği rehberdeki **Konu → dosya haritası** ile eşleştir.
2. [Değişiklik günlüğünün](docs/CHANGELOG.md) en yeni kayıtlarını oku; görevle ilgili eski kayıtları gerektiğinde ara.
3. `git status --short` ve `git branch --show-current` ile mevcut durumu kontrol et. Kullanıcının veya başka bir çalışmanın değişikliklerini koru.
4. İlgili kaynak dosyalarını, çağıran bileşenleri, veri yazımlarını ve gerekiyorsa Firebase kurallarını incele. Dosya varlığından özelliğin aktif kullanıldığı sonucunu çıkarma; import ve çağrıları doğrula.
5. Rehber bir yön bulma aracıdır; gerçek davranışın kaynağı mevcut koddur. Çelişki varsa kodu araştır, bulguyu belirt ve ilgili dokümanı düzelt. Doğrulanmamış varsayımları gerçek gibi kaydetme.

## Geliştirme sırasında

- Kullanıcının isteği kapsamında çalış. Türkçe iletişim ve Türkçe proje dokümantasyonu kullan; kod tanımlayıcılarını mevcut biçiminde koru.
- Önce ilgili akışı izle, sonra değiştir. Genel bir dosya adı tahminiyle doğrudan düzenlemeye başlama. Arama için `rg` / `rg --files` kullan.
- Süre takibi değişikliklerinde servis, hook, tipler, UI ve Firestore kurallarını birlikte değerlendir. Kullanıcı + plugin kapsamını, eski kayıt uyumluluğunu ve süre toplamlarının tutarlılığını gözet.
- Üyelik/yetki değişikliklerinde hem UI kontrolünü hem `firestore.rules` ve ilgiliyse `storage.rules` dosyasını incele. UI'da bir butonun gizlenmesi veri erişim yetkisi sağlamaz.
- Firebase ortam değişkenlerinin değerlerini, kimlik bilgilerini ve özel kullanıcı verilerini dokümanlara veya Git'e ekleme. Yalnızca değişken adlarını ve kullanım amaçlarını kaydet.
- Kullanıcı yalnızca dokümantasyon istiyorsa uygulama kodu, yapılandırma, kurallar ve bağımlılık dosyalarını değiştirme.

## Her değişiklik görevinin sonunda

Dokümantasyonu güncellemek, geliştirme işinin tamamlanma koşuludur:

1. Davranış, dosya konumu, route, veri modeli, yetki, bağımlılık, kurulum veya doğrulama akışı değiştiyse `docs/PROJECT_GUIDE.md` içindeki ilgili bölümü aynı görevde güncelle. Eski bilgiyle yeni bilgiyi yan yana bırakma.
2. Her tamamlanan değişiklik için `docs/CHANGELOG.md` dosyasının başına tarihli kısa bir kayıt ekle: ne/neden değişti, etkilenen dosyalar, yapılan doğrulama ve varsa kalan sınırlama. Sohbet dökümü veya yapılmamış iş ekleme.
3. Kurulum değiştiyse `README.md`, ajan çalışma yöntemi değiştiyse bu dosyayı da güncelle. Rehberin güncel durumu değişmediyse sırf dokunmuş olmak için yeniden yazma; değişiklik günlüğündeki kayıt yeterlidir. Salt soru-cevap için kayıt gerekmez.
4. Rehberdeki doğrulama bölümüne göre değişikliğe uygun kontrolleri yap. Çalıştırılmayan veya başarısız kontrolleri geçmiş gibi yazma.
5. `git diff --check` ve diff incelemesiyle kapsamı doğrula; yeni dosyaları da kontrol et. Dosya yollarının ve Markdown bağlantılarının hâlâ geçerli olduğunu kontrol et.
6. Kullanıcı Git işlemi istediyse yalnızca görev kapsamındaki dosyaları commit'e al; ilgili dokümanları aynı commit'e dahil et. Push hedefini mevcut dal ve uzak depo durumundan doğrula; force push yapma. Git isteği yoksa otomatik commit/push zorunluluğu yoktur.
7. Son yanıtta değişikliği, güncellenen dokümanları, doğrulama sonucunu ve istenmişse commit/push durumunu kısaca bildir.

## Hızlı bağlam

Blume Plugins; Next.js App Router, React, TypeScript ve Firebase kullanan bir ekip görev/süre takip uygulamasıdır. Ana akış: plugin listesi → plugin detayındaki üye panelleri → görevler ve süre kayıtları. Ayrı bir Roleplay Mods yönetimi ve herkese açık JSON çıktısı bulunur. Ayrıntılar ve dosya adresleri `docs/PROJECT_GUIDE.md` içindedir.
