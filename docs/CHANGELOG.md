# Değişiklik günlüğü

Yeni kayıtları en üste ekle. Her kayıt tarih, değişiklik/gerekçe, ilgili dosyalar, doğrulama ve varsa kalan sınırlamayı içermelidir. Yapılmamış işleri tamamlanmış gibi yazma; güncel mimariyi `PROJECT_GUIDE.md` içinde tut.

## 2026-11-17 — Potansiyel videolar: başlık ve üst bar düzeni

- Kartlarda video başlığı gösterilir (eklerken ve eski kayıtlar için sayfa açılınca `noembed.com` ile çekilip `title` alanına yazılır; alınamazsa host). Ana sayfada sağ üst menü yalnızca `2xl` ekranda mutlak konumlanır, daha dar ekranlarda başlığın altında satır kırar; böylece başlıkla çakışma giderildi. Dosyalar: `src/app/page.tsx`, `src/app/potential-videos/page.tsx`.

## 2026-11-17 — Potansiyel videolar sayfası

- Ana sayfaya (yalnızca superadmin için) `Potansiyel Videolar` bağlantısı ve `/potential-videos` sayfası eklendi: yalnızca link ile video eklenir, YouTube küçük resimli grid, dnd-kit ile sürükleyip sıralama (`order`), karta tıklayınca video yeni sekmede açılır, silme. Veri `potentialVideos` koleksiyonundadır; `firestore.rules` okuma/yazmayı yalnızca superadmin'e verir.
- Dosyalar: `src/app/potential-videos/page.tsx`, `src/app/page.tsx`, `firestore.rules`, `docs/PROJECT_GUIDE.md`, `docs/CHANGELOG.md`.
- Doğrulama: `tsc --noEmit`, ESLint (yeni sayfa), `npm run build` ve `git diff --check` geçti. Sınır: Firestore kuralları git push ile yayınlanmaz, ayrıca deploy edilmelidir; canlı oturumla elle test yapılmadı.

## 2026-11-16 — Sayaç ve görev ekleme tepkisi

- Sayaç başlatma, duraklatma ve görev değiştirmede bağımsız Firestore okumaları paralelleştirildi. Görevdeki sayaç düğmesi tıklama anında geri bildirim verir. Saniye güncellemeleri süreyi gösteren bileşenlerle sınırlı ve eski sayaç belgesi de canlı izleniyor.
- Görev ekleme alanı gönderim anında temizlenir ve yazım sürerken tekrar Enter yeni kayıt açmaz. Yazım hatasında alan boşsa taslak geri gelir. Görev ve sayaç işlemleri geçmiş kaydının tamamlanmasını beklemez.
- Dosyalar: `src/app/plugin/[id]/page.tsx`, `src/components/ActiveTimerBar.tsx`, `src/components/TodoItem.tsx`, `src/components/TodoTimer.tsx`, `src/components/UserTodoSection.tsx`, `src/hooks/useActiveTimer.ts`, `src/lib/timeTracking.ts`, `docs/PROJECT_GUIDE.md`, `docs/CHANGELOG.md`.
- Üretim derlemesi, TypeScript ve diff kontrolü geçti. Hedefli ESLint mevcut hataları bildirdi. Chrome ve yerel Firestore ile art arda Enter'ın tek görev oluşturduğu, reddedilen yazımda taslağın geri geldiği ve sayaç başlatma geri bildiriminin hemen gösterildiği doğrulandı. Her okumaya 750 ms gecikme eklendiğinde üç ilk okuma paralel başladı ve sayaç yaklaşık 0,82 saniyede onaylandı.
- Yerel Firestore emülatöründe aynı görev için eşzamanlı başlatma, görev değiştirme, tamamlama, manuel süre ekleme ve silme, eski sayaç kurtarma ve kayıt toplamları kontrol edildi. Canlı bağlantı süresi ölçülmedi.

## 2026-11-16 — İlk açılış yükü azaltıldı

- Plugin kartlarının ilerleme dinleyicileri ekranın yakınına gelince başlıyor. İlk kartın video görseli hemen, diğerlerinin görselleri tarayıcı yaklaşınca isteniyor. Üyelik görünürlüğü ve ilerleme hesabı mevcut akışını kullanıyor.
- Giriş ekranı Firestore'u yalnızca yeni hesap kaydı gerektiğinde yüklüyor. Storage dosya silme sırasında alınıyor. Kullanılmayan VT323 isteği kaldırıldı ve Geist Mono ön yüklemesi kapatıldı.
- Dosyalar: `src/app/page.tsx`, `src/app/auth/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/PluginCard.tsx`, `src/components/PluginList.tsx`, `src/components/PluginFileHandler.tsx`, `src/lib/firebase.ts`, `src/lib/firebaseAuth.ts`, `docs/PROJECT_GUIDE.md`, `docs/CHANGELOG.md`.
- Doğrulama: üretim derlemesi, TypeScript ve diff kontrolü geçti. Hedefli ESLint eski uyarı ve hataları bildirdi. Yerel Firebase emülatörleri ve Chrome ile giriş/kayıt, eski üyelik, üye olmayan kartın gizlenmesi, kaydırınca ilerlemenin gelmesi, canlı güncelleme, arama ve detay sayfasına geçiş doğrulandı.
- Yerel karşılaştırmada 30 kartlık listenin ilk ekranında ilerlemesi yüklenen kart sayısı 30'dan 9'a, istenen görsel sayısı 30'dan 21'e düştü. Webpack üretim çıktısında giriş ekranının ilk JavaScript yükü gzip ile yaklaşık %36 azaldı. Canlı Vercel gecikmesi ölçülmedi.

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
