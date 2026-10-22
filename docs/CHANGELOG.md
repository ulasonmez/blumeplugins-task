# Değişiklik günlüğü

Yeni kayıtları en üste ekle. Her kayıt tarih, değişiklik/gerekçe, ilgili dosyalar, doğrulama ve varsa kalan sınırlamayı içermelidir. Yapılmamış işleri tamamlanmış gibi yazma; güncel mimariyi `PROJECT_GUIDE.md` içinde tut.

## 2026-10-22 — Dar görev kartlarında metin yerleşimi

- Görev satırındaki ekran genişliğine bağlı yerleşim, kart genişliğini izleyen container query ile değiştirildi. İçerik alanı 28 rem'den dar olduğunda sayaç ve işlem düğmeleri alt satıra geçer; dar üye panellerinde görev metninin harf harf dikey uzaması önlenir. İşlem grubu gerektiğinde kendi içinde de satır kırar.
- Dosyalar: `src/components/TodoItem.tsx`, `docs/PROJECT_GUIDE.md`, `docs/CHANGELOG.md`.
- Doğrulama: `npx tsc --noEmit`, `npx eslint src/components/TodoItem.tsx`, `npm run build` ve `git diff --check` geçti. Üretim CSS çıktısında 28 rem container query kuralları doğrulandı.
- Sınır: oturum gerektiren canlı görev listesinde görsel test yapılmadı; değişiklik yalnızca yerleşim sınıflarını etkiler.

## 2026-10-18 — Unutulan sayaç seçeneklerinin okunurluğu

- Kurtarma penceresindeki üç seçeneğin beyaz zemin üzerinde beyaz görünmesi düzeltildi. Seçilmemiş seçenekler koyu zemin/açık metin, seçili seçenekler yüksek kontrastlı renkli zemin kullanır; hover durumları da okunur kalır. Uzun metinler dar ekranlarda satır kırar. Devam düğmesinin hover zemini de koyulaştırıldı.
- Dosyalar: `src/components/ActiveTimerBar.tsx`, `docs/PROJECT_GUIDE.md`, `docs/CHANGELOG.md`.
- Doğrulama: `npx tsc --noEmit`, `npm run build` ve `git diff --check` geçti. Bileşen ESLint kontrolü mevcut dört `any` hatası ve kullanılmayan `router` uyarısı nedeniyle başarısız; bu satırlar değiştirilmedi.
- Sınır: oturum gerektiren canlı kurtarma penceresinde görsel test yapılmadı. Değişiklik yalnızca stillerdedir; süre hesaplama ve Firebase yazımları aynı kalır.

## 2026-10-03 — Plugin detayında mobil kullanım düzeni

- Mobil başlık iki satıra ayrıldı; plugin adı için alan açıldı. Üye panellerinin sabit yüksekliği ve iç görev listesi kaydırması mobilde kaldırıldı; sayfa akışında sonraki üyeye geçilebiliyor. Üye başlığı ve süre raporu kartları dar ekranlarda taşmadan okunacak şekilde düzenlendi.
- Dosyalar: `src/app/plugin/[id]/page.tsx`, `src/components/UserTodoSection.tsx`, `src/components/TimeReportDialog.tsx`, `docs/PROJECT_GUIDE.md`, `docs/CHANGELOG.md`.
- Doğrulama: `npx tsc --noEmit`, `npm run build` ve `git diff --check` geçti. Değişen dosyalarda ESLint çalıştırıldı; mevcut `any`/metin kaçışı hataları ve uyarıları nedeniyle temiz sonuç vermedi.
- Sınır: oturum gerektiren ekran için gerçek cihazda dokunmatik kaydırma testi yapılmadı.

## 2026-10-03 — Kalıcı yapay zekâ proje rehberi

- Yeni sohbetlerde proje rehberini okuma, ilgili kodu araştırma ve geliştirme sonrası dokümanları güncelleme kuralları eklendi.
- `main` dalındaki kaynak kod incelenerek konu/dosya haritası, ekran akışları, Firebase veri yolları ve Storage yazma koşulları, süre takibi uyumluluğu, Roleplay JSON akışı ve doğrulama sınırları belgelendi. Standart Next.js README'si projeye özgü başlangıç bilgileriyle değiştirildi.
- Dosyalar: `AGENTS.md`, `docs/PROJECT_GUIDE.md`, `docs/CHANGELOG.md`, `README.md`.
- Kapsam: yalnızca Markdown dokümantasyonu; uygulama kodu, bağımlılıklar, yapılandırma ve Firebase kuralları değiştirilmedi.
- Doğrulama: kaynak dosyalarla karşılaştırma, yerel bağlantı/dosya yolu kontrolü ve Git diff kapsam/boşluk kontrolü. Dokümantasyon değişikliği olduğundan lint/build ve uygulama testleri çalıştırılmadı.
- Sınır: canlı servisler doğrulanmadı. `test:rules` script'inin beklediği test dosyalarının depoda bulunmadığı rehbere işlendi.
