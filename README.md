# Blume Plugins

Plugin geliştirme ekipleri için görev, üyelik, not ve çalışma süresi takibi. Next.js App Router, React, TypeScript ve Firebase kullanır. Ayrı Roleplay Mods yönetimi, herkese açık `/roleplay-mods.json` çıktısı sağlar.

## Projeyi anlamak

- [AGENTS.md](AGENTS.md): Yapay zekâ ajanları için sohbet başlangıcı, kod araştırması ve dokümantasyonu güncel tutma kuralları.
- [Proje rehberi](docs/PROJECT_GUIDE.md): Konu → dosya haritası, mimari, ekran/veri akışları ve doğrulama bilgileri.
- [Değişiklik günlüğü](docs/CHANGELOG.md): Yapılan değişiklikler ve doğrulama sonuçları.

Codex, bu depoda başlayan oturumlarda kökteki `AGENTS.md` dosyasını başlangıç talimatlarına dahil eder; bu dosya da proje rehberi ve son değişikliklerin okunmasını ister. Keşif davranışı için [resmî AGENTS.md dokümantasyonu](https://learn.chatgpt.com/docs/agent-configuration/agents-md) incelenebilir. Başka bir yapay zekâ aracı bu standardı otomatik okumuyorsa başlangıç talimatına “Önce AGENTS.md dosyasını oku ve uygula” ekle. Bu düzen bir ajan çalışma talimatıdır; arka planda kendi kendine çalışan bir doküman güncelleme servisi değildir.

## Yerel çalıştırma

```bash
npm ci
```

`.env.local` dosyasında aşağıdaki Firebase değişkenlerini tanımla; değerleri Git'e ekleme:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

```bash
npm run dev
```

Uygulamayı [localhost:3000](http://localhost:3000) üzerinden aç. Uygulama yapılandırılan Firebase projesine bağlanır; otomatik emülatör bağlantısı yoktur.

## Kontroller

- `npm run lint`: ESLint.
- `npm run build`: Üretim derlemesi; Firebase yapılandırması ve ağ erişimi gerekebilir.
- `npm start`: Derlenmiş uygulamayı çalıştırır.
- `npm run test:rules`: Firestore kural testi script'i vardır, fakat mevcut depoda beklediği `test/**/*.test.ts` dosyaları bulunmamaktadır.

Değişiklikten sonra ilgili proje rehberi bölümünü ve değişiklik günlüğünü güncelle. Ayrıntılı çalışma yöntemi [AGENTS.md](AGENTS.md) içindedir.
