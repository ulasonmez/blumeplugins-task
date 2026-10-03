# Blume Plugins — Proje rehberi

Son kaynak incelemesi: 2026-10-03. Bu doküman depo kodundan çıkarılmıştır; canlı Firebase/Vercel yapılandırmasının denetimi değildir. İlgili davranış değiştiğinde ilgili bölüm ve inceleme tarihi güncellenmelidir.

## 1. Amaç ve mimari

Blume Plugins, plugin geliştiren ekiplerin üyelerini, görevlerini, notlarını, ilerlemesini ve çalışma sürelerini izlediği bir web uygulamasıdır. Ayrıca Roleplay Mods video listesi yönetilir ve dış tüketicilere JSON olarak sunulur.

- Next.js `16.1.4`, React/React DOM `19.2.3`, TypeScript 5; App Router altında `src/app/`.
- Firebase JS SDK (`package.json`: `^12.8.0`): Authentication, Firestore ve Storage. Ana ekranlar istemci bileşenidir ve çoğu işlem Firestore'a doğrudan gider; ayrı bir genel CRUD API katmanı yoktur.
- Tailwind CSS 4, Radix tabanlı `src/components/ui/`, Lucide ikonları ve sürükle-bırak için dnd-kit.
- `next.config.ts` içinde React Compiler açıktır. TypeScript strict modu açıktır; `@/*` alias'ı `src/*` yoluna gider. Bazı mevcut modeller yerel tipler veya `any` ile tutulur.
- Depoda `package-lock.json` bulunur; komutlarda npm kullanılır. Kesin bağımlılık sürümlerinin kaynağı lock dosyasıdır.
- `src/lib/firebase.ts`, ortak `app`, `auth`, `db`, `storage` nesnelerini oluşturur; Firestore long polling kullanır. Sunucu JSON route'u da bu modülü kullanır; ayrı bir Firebase Admin SDK katmanı yoktur.

## 2. Konu → dosya haritası

Yollar depo köküne göredir. Önce kullanıcının ifadesine uyan satırı bul, sonra dosyayı ve ilişkili çağrıları oku.

| Kullanıcının bahsettiği konu | İlk incelenecek dosyalar | İlişkili alanlar |
| --- | --- | --- |
| Giriş, kayıt, kullanıcı adı, şifre | `src/app/auth/page.tsx` | `src/lib/firebase.ts`, `firestore.rules` → `users` |
| Ana sayfa, plugin ekleme, arama, görünürlük | `src/app/page.tsx` | `plugins`, `members`, `memberUids` |
| Plugin kartı, video görseli, isim/link düzenleme, plugin silme | `src/components/PluginCard.tsx` | `src/components/PluginList.tsx`, `firestore.rules` |
| Plugin sıralaması, kart sürükleme | `src/components/PluginList.tsx`, `src/app/page.tsx` → `handleReorder` | `plugins.order` |
| Plugin detay, üye ekleme/çıkarma, owner, erişim | `src/app/plugin/[id]/page.tsx` | `firestore.rules`, `src/app/page.tsx` |
| Başlangıç/bitiş tarihi, plugin ilerlemesi | `src/app/plugin/[id]/page.tsx`, `src/components/PluginCard.tsx` | `src/components/UserTodoSection.tsx` |
| Görev ekleme, kopyalama, sıralama, üye paneli | `src/components/UserTodoSection.tsx` | `src/components/TodoItem.tsx`, `plugins/{id}/todos` |
| Görev düzenleme, tamamlama, tekrar açma, silme | `src/components/TodoItem.tsx` | `src/lib/timeTracking.ts`, `src/lib/logger.ts` |
| Görev notu, kişisel/üye notu | `src/components/UserTodoSection.tsx` | `todos.notes`, `plugins/{id}/notes/{uid}`, `src/components/LinkifiedText.tsx` |
| Sayaç başlat/duraklat, manuel süre | `src/components/TodoTimer.tsx`, `src/lib/timeTracking.ts` | `src/hooks/useActiveTimer.ts`, `src/types/timeTracking.ts`, `firestore.rules` |
| Alttaki aktif sayaç, unutulmuş sayaç, süre kurtarma | `src/components/ActiveTimerBar.tsx`, `src/lib/timeTracking.ts` | `src/app/plugin/[id]/page.tsx`, `src/hooks/useActiveTimer.ts` |
| Süre geçmişi, süre kaydı silme, toplam süre | `src/components/TimeDetailsDialog.tsx`, `src/lib/timeTracking.ts` | `src/lib/timeFormatting.ts`, `timeEntries` |
| Plugin/üye çalışma süresi raporu | `src/components/TimeReportDialog.tsx` | Detay sayfasından gelen `todos` ve `members` |
| İşlem geçmişi, log | `src/lib/logger.ts`, `src/app/plugin/[id]/page.tsx` | `plugins/{id}/logs`, `LogAction` |
| Ortak not defteri, otomatik kayıt | `src/components/SharedNotepad.tsx` | `system/shared_notepad`, `src/app/page.tsx` |
| Link, Markdown benzeri metin, görsel, tablo gösterimi | `src/components/LinkifiedText.tsx` | Görev/üye notları ve ortak not defteri; özel ayrıştırıcı |
| Roleplay Mods ekle/düzenle/sil/sırala | `src/app/roleplay-mods/page.tsx` | `roleplayMods`, `src/app/actions/roleplayMods.ts` |
| Roleplay JSON, dış liste, cache yenileme | `src/app/roleplay-mods.json/route.ts` | `src/app/actions/roleplayMods.ts`, yönetim sayfası |
| YouTuber URL bilgilerinin alınması | `src/app/api/youtuber-info/route.ts` | Depoda bunu çağıran aktif bir UI bulunmadı |
| Sohbet, plugin dosyaları, eski accordion kart | `src/components/PluginChat.tsx`, `src/components/PluginFileHandler.tsx`, `src/components/PluginCardAccordion.tsx` | Mevcut sayfalara bağlı değiller; aşağıdaki notu oku |
| Renk, font, mobil görünüm, ortak UI, bildirim | `src/app/globals.css`, `src/app/layout.tsx`, `src/components/ui/`, `src/components/Toaster.tsx` | Bileşenlerdeki Tailwind sınıfları, `src/lib/utils.ts` |
| Firebase bağlantısı, izin hatası, depolama | `src/lib/firebase.ts`, `firestore.rules`, `storage.rules`, `firebase.json` | İlgili UI sorgusu/yazımı ve ortam değişkenleri |
| Build, lint, paketler, alias | `package.json`, `package-lock.json`, `next.config.ts`, `eslint.config.mjs`, `tsconfig.json` | `postcss.config.mjs`, `components.json` |

Arama örnekleri:

```bash
rg -n 'startTimer|pauseTimer|useActiveTimer' src
rg -n 'memberUids|isSuperAdmin|isOwner' src firestore.rules
rg -n 'regenerateRoleplayModsJson|roleplayMods' src firestore.rules
rg -n 'PluginChat|PluginFileHandler|PluginCardAccordion' src
```

## 3. Route ve ekran akışları

| URL | Kaynak | Mevcut davranış |
| --- | --- | --- |
| `/auth` | `src/app/auth/page.tsx` | Kullanıcı adı/şifre ile giriş ve kayıt |
| `/` | `src/app/page.tsx` | Oturum kontrolü, plugin listesi, arama, ekleme ve sıralama |
| `/plugin/[id]` | `src/app/plugin/[id]/page.tsx` | Üyelik kontrolü, üye görev panelleri, tarihler, loglar, süre raporu ve aktif sayaç; mobilde sayfa boyunca, masaüstünde panel listesinde kaydırma |
| `/roleplay-mods` | `src/app/roleplay-mods/page.tsx` | Admin video listesi yönetimi |
| `/roleplay-mods.json` | `src/app/roleplay-mods.json/route.ts` | Herkese açık `GET`; sıralı `{ videos: [...] }` çıktısı |
| `/api/youtuber-info` | `src/app/api/youtuber-info/route.ts` | `POST { urls: [...] }`; URL'lerden HTML okuyup kanal bilgisi çıkartır |

### Kimlik, üyelik ve görünürlük

- Kayıt/giriş, adı küçük harfe çevirip boşlukları noktaya ve Türkçe karakterleri Latin karşılıklarına dönüştürerek `@plugin-tasks.local` uzantılı e-posta üretir. Kayıt, Auth `displayName` alanını ve `users/{uid}` belgesini yazar.
- UI, Auth kullanıcısının `displayName` değerine göre `Ulas` için superadmin, `Ulas`/`Emir` için admin tanımlar. Firestore kuralları ise `users/{uid}.displayName` okur. Yetki sorunlarında iki kaynağı birlikte incele. Kurallar normal kullanıcı yazımlarıyla bu iki özel adı almayı kısıtlar.
- Ana sayfada superadmin tüm pluginleri, diğer kullanıcılar `memberUids` veya `members/{uid}` ile eşleşen pluginleri görür. Arama 300 ms geciktirilir. Ekleme adminlere, sürükleyerek sıralama superadmin'e sunulur.
- Detay sayfası üyelik alt koleksiyonunu dinler; superadmin erişimini ayrıca kabul eder. UI'daki owner yetkisi superadmin, üye admin veya `role: owner` için açılır. Üye ekleme/çıkarma hem alt belgeyi hem `memberUids` dizisini günceller. Eski, üyesiz pluginlerde oluşturan kişiyi owner yapmaya yönelik geçiş kodu vardır.
- **Görünürlük ile veri yetkisi aynı değildir:** mevcut kurallar giriş yapanlara plugin belgelerini ve üye listelerini okuma izni verir. Görev/not gibi alt koleksiyonlarda üyelik kontrolleri vardır. Tam izin davranışı için `firestore.rules` içindeki ilgili eşleşmeyi oku; UI koşullarından kural sonucu çıkarma.

### Görev ve ilerleme

- Detay sayfası görevleri `createdByUid` ile mevcut üyelerin panellerine dağıtır. `UserTodoSection` görev ekler, başka üyelerin görev metinlerini kullanıcının kendi listesine kopyalar, sıralar ve notları yönetir.
- Mobil plugin detayında başlık ve araçlar ayrı satırlara yerleşir; üye panelleri içerikleri kadar uzar ve sayfa tek bir akışta kayar. `md` ve üzerindeki sütunlu görünümde panel listesi ile görev listeleri kendi alanlarında kayar. Mobil süre raporu değerleri satır kırar ve rapor penceresi dikey kayar.
- Kopyalama yeni, tamamlanmamış görev üretir; eski notları ve süreleri kopyalamaz. Görev notu todo belgesinde, üye notu ayrı `notes/{uid}` belgesindedir. Üye notları kurallarda diğer üyelere de okunabilir; gizli not olarak varsayma.
- `TodoItem`, tamamlamayı `completeTodoWithTimerCheck`, silmeyi `deleteTodoSafely` üzerinden yapar. Tekrar açma `completed` / `completedAt` alanlarını günceller. Aktif sayaç varken UI görev silmeyi engeller.
- Kart ve detay sayfasındaki plugin ilerlemesi, görevi olan mevcut üyelerin tamamlanma oranlarının eşit ağırlıklı ortalamasıdır. Tüm görevlerin tek bir tamamlanma oranı değildir. Bu hesap iki yerde bulunduğundan değişiklikte ikisini de incele.
- `src/lib/logger.ts`, `plugins/{pluginId}/logs` altına işlem yazar; detay sayfası kayıtları tarihe göre gruplar. Log yazma hataları yakalanır.

### Süre takibi

- Merkez: `src/lib/timeTracking.ts`; `startTimer`, `pauseTimer`, `stopAndAddManualTime`, `addManualTime`, `completeTodoWithTimerCheck`, `deleteTimeEntry`, `deleteTodoSafely`.
- Aktif sayaç anahtarı `activeTimers/{uid}_{pluginId}`: kullanıcı başına **plugin içinde** tek aktif sayaç. Farklı pluginlerde ayrı sayaçlar olabilir. Eski `activeTimers/{uid}` belgeleri ilgili plugin eşleşmesiyle desteklenir; bu uyumluluğu yanlışlıkla kaldırma.
- `startTimer` yalnızca görev sahibinin sayacını başlatır. Aynı görevde tekrar başlatma etkisizdir. Aynı plugin içinde görev değiştirildiğinde mevcut süre kapanıp yeni kayıt açılır; işlemler Firestore transaction kullanır.
- Başka göreve geçişte mevcut sayaç 8 saatten eskiyse veya yerel takvim günü değişmişse servis kurtarma gerektiren hata üretir. `ActiveTimerBar` otomatik kurtarma penceresini 8 saat eşiğinde açar; iki koşul aynı değildir.
- `useActiveTimer`, Firestore başlangıç zamanından geçen süreyi her saniye hesaplar; her saniye Firestore'a yazmaz. Eski belge için fallback okuması vardır.
- Kayıt tipleri `timer`, `manual`, `recovery`; durumlar `running`, `completed`. Tamamlanan kayıtlar todo üzerindeki `timerTrackedSeconds`, `manualTrackedSeconds`, `totalTrackedSeconds`, `timeEntryCount`, `lastTrackedAt` özetlerini etkiler. `recovery`, sayaç toplamına dahildir. Toplamlar ile detay kayıtları birlikte ele alınmalıdır.
- `baseTrackedSeconds` çalışan sayaç başladığındaki kaydedilmiş toplamı saklar. Canlı süreyi eklerken kullanıcı/plugin/görev kapsamını kontrol et; kaydedilmiş süreyi iki kere toplama.
- `TimeDetailsDialog` kayıt geçmişini dinler; manuel ekleme/silme sunar. Geliştirme modunda detay kayıtlarıyla özetler uyuşmadığında konsola uyarı yazar.
- `TimeReportDialog` kaydedilmiş todo toplamlarını kullanır; canlı sayacı ayrıca toplamaz. Eski üyelerin süreli görevlerini ayrı grupta gösterebilir. `deleteTodoSafely` alt süre kayıtlarını 490'lık batch'lerle temizleyip görevi siler; işlem tek transaction değildir.

### Roleplay Mods ve JSON çıktısı

- Yönetim sayfası `roleplayMods` koleksiyonunu `order` artan sırada dinler. Ekleme listenin başına yerleştirir; silme/sıralama order değerlerini yeniden düzenler.
- Her mutasyondan sonra `regenerateRoleplayModsJson()` çağrılır. Bu server action, `revalidatePath('/roleplay-mods.json')` çalıştırır; UI ardından JSON URL'sine `fetch` yapar.
- JSON route'unda `dynamic = 'force-static'`, herkese açık CORS ve `Cache-Control: public, max-age=30, s-maxage=30` başlığı vardır. Önbellek davranışını değiştirirken route, action ve UI çağrısını birlikte incele.
- Dış sözleşme: `{ "videos": [{ "title": "...", "videoUrl": "...", "version": "...", "badge": "..." }] }`. `id` ve `order` dışarı verilmez. Yönetim ekranındaki not metni veride `version` alanına yazılır.
- Firestore okuma hatası boş liste döndürülerek gizlenmez; hata fırlatılır. Böylece hata sonucu boş listenin cache'e yazılması amaçlanmaz. Statik çıktı üretimi Firebase erişimine ihtiyaç duyabilir.

### Ortak notlar ve bağlı olmayan parçalar

- `SharedNotepad` ana sayfada adminlere açılır; `system/shared_notepad` belgesini dinler ve değişiklikleri 1 saniye bekleyerek kaydeder. `LinkifiedText` linkleri ve Markdown benzeri içeriği özel kodla gösterir.
- `PluginChat`, `PluginFileHandler`, `PluginCardAccordion` depoda vardır, ancak mevcut `src` import/çağrı taramasında sayfalardan kullanılmıyorlar. Aktif kullanıcı özelliği olduklarını varsayma. Dosya yöneticisinde listeleme/silme vardır; tam yükleme akışı olduğunu varsayma.
- `/api/youtuber-info` URL'lerden başlık, görsel ve ülke çıkartır; `email` boş döner. Mevcut route'ta auth veya URL host kısıtlaması bulunmaz. Bu, mevcut durum tespitidir; davranışı güvenli bir tasarım standardı olarak çoğaltma.
- `firestore.rules` içinde `youtubers` ve `youtubers_members` kuralları bulunur; depoda bunlara ait aktif yönetim sayfası bulunmadı.

## 4. Firebase veri haritası

Bu tablo tam bir şema doğrulayıcısı değildir; okuma/yazım noktalarını bulmak içindir. Eski belgelerde bazı alanlar bulunmayabilir.

| Firestore yolu | Başlıca içerik | Kaynak |
| --- | --- | --- |
| `users/{uid}` | `displayName`, üretilen `email`, `createdAt` | Auth sayfası, üye araması, yetki kuralları |
| `plugins/{pluginId}` | `name`, `videoUrl`, `description`, `createdByUid/Name`, `memberUids`, `createdAt`, `order`, `startDate/endDate` | Ana sayfa, kart, detay sayfası |
| `plugins/{pluginId}/members/{uid}` | `uid`, `displayName`, `role` (`owner`/`member`), `joinedAt` | Plugin oluşturma ve üye yönetimi |
| `plugins/{pluginId}/todos/{todoId}` | `text`, oluşturan kullanıcı, `completed`, zamanlar, `notes`, `order`, süre özetleri | Üye paneli, görev satırı, süre servisi |
| `plugins/{pluginId}/todos/{todoId}/timeEntries/{entryId}` | `TimeEntry`; kaynak, durum, başlangıç/bitiş, saniye, kullanıcı | `src/types/timeTracking.ts`, süre servisi |
| `activeTimers/{uid}_{pluginId}` | `ActiveTimer`; kullanıcı/plugin/görev/kayıt kimlikleri, başlangıç, `baseTrackedSeconds` | Süre servisi ve hook; eski `{uid}` desteği de var |
| `plugins/{pluginId}/notes/{uid}` | `content`, `updatedAt` | Üye notları |
| `plugins/{pluginId}/logs/{logId}` | `action`, `details`, `uid`, `userName`, `timestamp` | `logPluginAction` |
| `system/shared_notepad` | `content`, `lastUpdated` | Ortak not defteri |
| `roleplayMods/{modId}` | `title`, `videoUrl`, `version`, `badge`, `order` | Roleplay yönetimi ve JSON route'u |
| `plugins/{pluginId}/messages/{messageId}` | Sohbet mesajları | Şu an bağlı olmayan `PluginChat` |
| `plugins/{pluginId}/files/{fileId}` | Dosya metaverisi ve Storage yolu | Şu an bağlı olmayan `PluginFileHandler` |

`storage.rules` iki yol tanımlar: `attachments/{pluginId}/{uid}/{fileName}` yalnızca yolu kendi UID'siyle eşleşen oturum sahibi için okunup yazılabilir. `plugins/{pluginId}/files/{fileName}` giriş yapan kullanıcılarca okunabilir; yazma için dosya boyutu 100 MB altında olmalı ve Auth token'ındaki `name` alanı `Ulas` veya `Emir` olmalıdır. Bu kural `main` dalına özgü güncel durumdur. Token alanını `users/{uid}.displayName` ile aynı kaynak sanma; kuralları Firestore üyelik kurallarıyla eşdeğer varsayma.

## 5. Kurulum ve doğrulama

### Yerel çalıştırma

1. `npm ci` ile lock dosyasındaki bağımlılıkları kur.
2. `.env.local` içinde `src/lib/firebase.ts` tarafından kullanılan aşağıdaki değişkenleri ilgili Firebase projesinden sağla. Değerleri Git'e ekleme; `.env*` ignore edilir.
3. `npm run dev` ile geliştirme sunucusunu başlat; varsayılan adres `http://localhost:3000`.

Gerekli değişken adları:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

Depoda uygulamayı otomatik olarak Firebase emülatörüne bağlayan `connect*Emulator` çağrısı bulunmuyor. `npm run dev` çalıştırmak emülatör kullanıldığı anlamına gelmez; yazma içeren manuel denemelerde bağlı Firebase projesini kontrol et.

### Mevcut komutlar ve sınırlar

| Komut | Amaç / koşul |
| --- | --- |
| `npm run dev` | Yerel Next.js geliştirme sunucusu |
| `npm run lint` | ESLint kontrolü; mevcut hatalar varsa görev kaynaklı olanlarla ayır |
| `npm run build` | Üretim derlemesi; Firebase ortamı/ağ ve font erişimi gerekebilir |
| `npm start` | Başarılı build sonrasında üretim sunucusu |
| `npm run test:rules` | Firestore emülatörü + Mocha/ts-node; script `test/**/*.test.ts` arıyor, ancak bu incelemede depoda test dosyaları bulunmadı |

`firebase.json` Firestore emülatörü için 8080 portunu ve kural dosyalarını tanımlar. Repo içinde genel `npm test` komutu veya doğrulanmış bir CI test hattı yoktur. `test:rules` komutunun varlığı çalışan test kapsamı bulunduğunu kanıtlamaz.

- Yalnızca doküman değiştiğinde: Markdown bağlantıları/dosya yolları, içeriğin kaynak kodla uyumu ve `git diff --check` yeterlidir; uygulama testleri geçmiş gibi raporlanmaz.
- Uygulama değişikliğinde: ilgili lint/build kontrollerini ve değişen akışın uygun doğrulamasını yap; ortam nedeniyle çalışmayan kontrolleri açıkça belirt.
- Sayaç değişikliğinde: başlat/duraklat, aynı pluginde görev değiştir, farklı plugin kapsamı, görevi tamamla, manuel süre ekle/sil, eski sayaç fallback'i ve kurtarma akışını değerlendir. Kaydedilmiş toplamların detay kayıtlarıyla tutarlılığını kontrol et.
- Yetki değişikliğinde: normal üye, üye olmayan kullanıcı, owner ve admin senaryolarını ilgili Firebase kurallarıyla doğrula. Kural testi altyapısı yoksa bunu çözülmüş varsayma.
- Roleplay değişikliğinde: yönetim mutasyonu → revalidation → JSON içerik/sıra akışını kontrol et.

Canlı hosting projesi, yayınlanmış Firebase kuralları, mevcut veriler ve uzak ortam değişkenleri bu rehber hazırlanırken doğrulanmadı. Git push ile Firebase kural yayınlamasını aynı işlem kabul etme. `firestore-debug.log` hâlihazırda Git tarafından izleniyor; yerel emülatör çalışmaları bunu değiştirirse ilgisiz logları commit'e ekleme.

## 6. Bu rehberi güncel tutma

Çalışma kuralları için [AGENTS.md](../AGENTS.md), yapılan işler için [değişiklik günlüğü](CHANGELOG.md), kısa kurulum için [README](../README.md) kullanılır.

- Yeni özellik/dosya/route: konu haritasına ve ilgili akışa ekle; gerekirse veri tablosunu güncelle.
- Dosya taşıma/silme: eski yolu ve bağlantıları düzelt; kaldırılmış bir özelliği aktif gibi anlatma.
- Davranış/yetki/veri modeli değişikliği: ilgili açıklamayı yeni gerçek durumla değiştir; uyumluluk ve doğrulama etkisini kaydet.
- Paket/kurulum/test değişikliği: mimari ve komut bölümünü güncelle.
- Her tamamlanan değişiklik: günlüğe kısa, doğrulanabilir kayıt ekle. Rehberi sohbet dökümüne dönüştürme; geçici ayrıntıların kaynağı Git geçmişidir.
