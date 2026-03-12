# IFSC Index — Gıda Güvenliği Kültürü Değerlendirme Platformu

**Integrated Food Safety Culture Index (IFSC Index)**, gıda üretim tesislerinin güvenlik kültürünü çok boyutlu olarak ölçen, profesyonel bir değerlendirme ve raporlama platformudur.

---

## Nedir?

IFSC Index; bir gıda tesisinin sadece prosedür ve belgelere değil, **insanların davranışlarına, liderlik anlayışına ve etik değerlerine** de bakarak bütünsel bir güvenlik kültürü skoru üretir. Her değerlendirme 0–100 arasında puanlanır ve firmanın risk seviyesi belirlenir.

---

## Özellikler

- **Çok boyutlu değerlendirme** — 4 ana boyut, her birinde 5 kriter (toplam 20 kriter)
- **Ağırlıklı puanlama** — Admin panelinden her boyutun ağırlığı özelleştirilebilir
- **Risk sınıflandırması** — Güçlü / Orta / Risk / Kritik seviyeleri, özelleştirilebilir eşikler
- **Revizyon takibi** — Aynı tesise yapılan tekrarlı değerlendirmelerle zaman içindeki gelişim izlenir
- **PDF raporu** — Her değerlendirme sonucunda indirilebilir PDF rapor üretilir
- **E-posta raporu** — Değerlendirme raporu e-posta ile otomatik olarak gönderilebilir
- **Çok kiracılı (multi-tenant) mimari** — Her organizasyon kendi verilerini yönetir
- **Rol tabanlı yetkilendirme** — Admin ve standart kullanıcı rolleri

---

## Değerlendirme Boyutları

| Boyut | Açıklama |
|-------|----------|
| **D1 — Yapısal Güvenlik** | Altyapı, bütçe, ekipman, HACCP, dijital izlenebilirlik |
| **D2 — Davranışsal Güvenlik** | Hijyen uyumu, şüpheli ürün yönetimi, çapraz bulaşma refleksi |
| **D3 — Liderlik ve Karar** | Kriz anı yönetimi, psikolojik güvenlik, şeffaf iletişim |
| **D4 — Etik ve Değer** | Tağşiş riski, tedarik zinciri etiği, halk sağlığı şeffaflığı |

Her kriter 1–5 üzerinden puanlanır; puanlar ağırlıklı ortalama ile 0–100 skalasına dönüştürülür.

---

## Risk Seviyeleri

| Seviye | Puan Aralığı | Anlam |
|--------|-------------|-------|
| **Güçlü** | 80–100 | Kültür altyapısı ve uygulama disiplini güçlü |
| **Orta** | 60–79 | Kabul edilebilir; belirli alanlarda kırılganlık var |
| **Risk** | 40–59 | Belirgin zayıflıklar; operasyonel risk artıyor |
| **Kritik** | 0–39 | Sistematik uygunsuzluk riski yüksek; acil aksiyon gerekli |

---

## Teknoloji Yığını

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
- **Veritabanı & Auth:** [Supabase](https://supabase.com/)
- **Stil:** [Tailwind CSS](https://tailwindcss.com/)
- **E-posta:** [Resend](https://resend.com/)
- **Grafikler:** [Recharts](https://recharts.org/)
- **PDF:** [jsPDF](https://github.com/parallax/jsPDF) + jspdf-autotable
- **Bildirimler:** [react-hot-toast](https://react-hot-toast.com/)
- **Dil:** TypeScript

---

## Uygulama Yapısı

```
ifsc-index/
├── app/
│   ├── login/                  # Giriş & kayıt sayfası
│   ├── dashboard/
│   │   ├── page.tsx            # Genel bakış (istatistikler, revizyon trendi)
│   │   ├── assessments/        # Değerlendirme listesi, oluşturma, sonuç
│   │   ├── facilities/[slug]/  # Tesis bazlı revizyon tarihçesi
│   │   └── admin/              # Ağırlık, eşik ve kullanıcı yönetimi
│   └── api/
│       └── send-report/        # E-posta gönderim API endpoint'i
├── lib/
│   ├── criteria.ts             # 4 boyut × 5 kriter tanımları
│   ├── scoring.ts              # Puanlama, risk hesaplama, öneri metinleri
│   └── supabase.ts             # Supabase istemcisi
```

---

## Kurulum

### Gereksinimler

- Node.js 18+
- Bir [Supabase](https://supabase.com/) projesi
- (Opsiyonel) Bir [Resend](https://resend.com/) API anahtarı (e-posta özelliği için)

### Adımlar

```bash
# Bağımlılıkları yükle
npm install

# Ortam değişkenlerini ayarla
cp .env.example .env.local
# .env.local dosyasını düzenle (Supabase URL, anon key, Resend API key)

# Geliştirme sunucusunu başlat
npm run dev
```

### Ortam Değişkenleri

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
RESEND_API_KEY=re_xxxxx
```

---

## Kullanım Akışı

1. **Giriş yap** — E-posta/şifre ile oturum aç
2. **Yeni değerlendirme oluştur** — Tesis adı, tarih ve denetçi bilgilerini gir
3. **Kriterleri puanla** — Her kriter için 1–5 arası puan ver, kanıt türü ve not ekle
4. **Raporu incele** — Boyut skorları, risk seviyesi ve önerileri gör
5. **Paylaş** — PDF indir veya e-posta ile gönder
6. **Takip et** — Aynı tesisi yeniden değerlendirerek gelişimi izle

---

## Admin Paneli

`/dashboard/admin` sayfasından:

- **Boyut ağırlıkları** — D1, D2, D3, D4 için ağırlık oranları belirle (toplam %100 olmalı)
- **Risk eşikleri** — Güçlü/Orta/Risk sınır puanlarını özelleştir
- **Kullanıcı yönetimi** — Organizasyon kullanıcılarının rollerini düzenle

---

## Lisans

Bu proje özel kullanım amaçlıdır.
