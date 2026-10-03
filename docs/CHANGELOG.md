# Değişiklik günlüğü

Yeni kayıtları en üste ekle. Her kayıt tarih, değişiklik/gerekçe, ilgili dosyalar, doğrulama ve varsa kalan sınırlamayı içermelidir. Yapılmamış işleri tamamlanmış gibi yazma; güncel mimariyi `PROJECT_GUIDE.md` içinde tut.

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
