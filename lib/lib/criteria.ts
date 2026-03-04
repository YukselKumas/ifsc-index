export const DIMENSIONS = [
  {
    id: 'D1',
    name: 'Yapısal Güvenlik',
    color: '#2563eb',
    bg: '#eff6ff',
    criteria: [
      {
        id: 'D1C1',
        name: 'Kalite yatırımı için ayrılmış bütçe varlığı ve erişilebilirliği',
        description: 'Kalite/gıda güvenliği için ayrılan bütçenin varlığı, sürdürülebilirliği ve gerektiğinde erişilebilirliği.',
        evidence_types: ['dokuman', 'kpi', 'kayit', 'diger'],
      },
      {
        id: 'D1C2',
        name: 'Kritik cihaz/altyapı modernliği ve kalibrasyon-bakım disiplini',
        description: 'Metal dedektör, X-Ray, soğuk zincir vb. kritik ekipmanların uygunluğu ve kalibrasyon/bakım uyumu.',
        evidence_types: ['dokuman', 'kayit', 'gozlem', 'diger'],
      },
      {
        id: 'D1C3',
        name: 'Dijital veri ve izlenebilirlik altyapısının çalışırlığı',
        description: 'İzlenebilirlik, kayıt bütünlüğü, veri erişilebilirliği ve dijital altyapının sürekliliği.',
        evidence_types: ['ekran_goruntusu', 'dokuman', 'kayit', 'diger'],
      },
      {
        id: 'D1C4',
        name: 'KPI/prim sisteminin kaliteyi destekleme düzeyi',
        description: 'KPI ve prim kurgusunun kaliteyi ödüllendirip ödüllendirmediği; tonaj baskısı oluşturup oluşturmadığı.',
        evidence_types: ['dokuman', 'kpi', 'mulakat', 'diger'],
      },
      {
        id: 'D1C5',
        name: 'HACCP/önleyici kontrol sistemlerinin etkinliği',
        description: 'HACCP/PCQI çerçevesinde doğrulama/validasyon, gözden geçirme ve aksiyon disiplini.',
        evidence_types: ['dokuman', 'kayit', 'kpi', 'diger'],
      },
    ],
  },
  {
    id: 'D2',
    name: 'Davranışsal Güvenlik',
    color: '#16a34a',
    bg: '#f0fdf4',
    criteria: [
      {
        id: 'D2C1',
        name: 'Kimse bakmazken hijyen prosedürlerine uyum',
        description: 'Denetim baskısı olmadan hijyen uygulamalarının (özellikle el hijyeni) tutarlılığı.',
        evidence_types: ['gozlem', 'kayit', 'mulakat', 'diger'],
      },
      {
        id: 'D2C2',
        name: 'Şüpheli/uygunsuz ürün yönetimi disiplini',
        description: 'Şüpheli ürünün hatta geri dönmesi, uygunsuz ürün alanı, etiketleme ve bertaraf uygulaması.',
        evidence_types: ['gozlem', 'dokuman', 'kayit', 'diger'],
      },
      {
        id: 'D2C3',
        name: "Prosedürlerin 'neden'inin içselleştirilmesi",
        description: "Çalışanların prosedürü sadece 'ne' olarak değil 'neden' olarak da anlaması ve uygulaması.",
        evidence_types: ['mulakat', 'gozlem', 'dokuman', 'diger'],
      },
      {
        id: 'D2C4',
        name: 'Çapraz bulaşma önleme refleksi ve pratik tutarlılık',
        description: 'Zonlama, ekipman ayrımı, alerjen/cross-contamination risklerine karşı saha davranış tutarlılığı.',
        evidence_types: ['gozlem', 'dokuman', 'kayit', 'diger'],
      },
      {
        id: 'D2C5',
        name: 'Uygunsuzluk/tehlike görüldüğünde doğru tepki ve raporlama',
        description: 'Near-miss, sapma ve tehlike bildirimlerinin yapılması; anlık doğru aksiyon refleksi.',
        evidence_types: ['kayit', 'dokuman', 'mulakat', 'diger'],
      },
    ],
  },
  {
    id: 'D3',
    name: 'Liderlik ve Karar',
    color: '#9333ea',
    bg: '#faf5ff',
    criteria: [
      {
        id: 'D3C1',
        name: 'Kriz anında kalite ekibine yaklaşım (destek vs baskı)',
        description: 'Kriz/uygunsuzluk anlarında yönetim yaklaşımı: destekleyici ve çözüm odaklı mı, baskılayıcı mı?',
        evidence_types: ['mulakat', 'kayit', 'dokuman', 'diger'],
      },
      {
        id: 'D3C2',
        name: 'Psikolojik güvenlik (hattı durdurma cesareti)',
        description: 'Çalışanın hattı durdurma/bildirim yapma davranışının teşvik edilmesi; cezalandırılmaması.',
        evidence_types: ['mulakat', 'kayit', 'dokuman', 'diger'],
      },
      {
        id: 'D3C3',
        name: 'Liderlerin sahada rol-model davranışı',
        description: 'Yönetimin PPE, hijyen ve prosedür uyumunda rol model olması; saha disiplini.',
        evidence_types: ['gozlem', 'kayit', 'mulakat', 'diger'],
      },
      {
        id: 'D3C4',
        name: 'İletişim şeffaflığı ve kötü haber akışı',
        description: 'Uygunsuzlukların saklanmadan iletilmesi; geri bildirim kanalları ve iletişim şeffaflığı.',
        evidence_types: ['mulakat', 'dokuman', 'kayit', 'diger'],
      },
      {
        id: 'D3C5',
        name: 'Risk bazlı karar alma disiplini (ticari baskıda taviz)',
        description: 'Tonaj/ciro baskısı altında bile risk değerlendirme disiplininin korunması; taviz eğilimi.',
        evidence_types: ['kayit', 'dokuman', 'mulakat', 'diger'],
      },
    ],
  },
  {
    id: 'D4',
    name: 'Etik ve Değer',
    color: '#dc2626',
    bg: '#fef2f2',
    criteria: [
      {
        id: 'D4C1',
        name: 'Ekonomik baskıda tağşiş/kalite düşürme eğilimi',
        description: 'Formülasyon/kalite standartlarının ekonomik baskıda sessizce düşürülmesi riskine karşı duruş.',
        evidence_types: ['dokuman', 'kayit', 'mulakat', 'diger'],
      },
      {
        id: 'D4C2',
        name: 'Etik satın alma ve tedarik zinciri baskı riski',
        description: 'Fiyat baskısı ile tedarikçiyi hileye yönlendirme riskinin yönetimi; etik satın alma disiplini.',
        evidence_types: ['dokuman', 'kayit', 'mulakat', 'diger'],
      },
      {
        id: 'D4C3',
        name: 'Halk sağlığı riskinde şeffaflık vs örtbas',
        description: 'Kamu sağlığı riskinde şeffaflık, gerektiğinde geri çağırma/iletişim cesareti.',
        evidence_types: ['dokuman', 'kayit', 'mulakat', 'diger'],
      },
      {
        id: 'D4C4',
        name: 'Kurumsal dürüstlük ve hesap verebilirlik mekanizmaları',
        description: 'Etik ihbar hattı/uyum mekanizmaları ve vakaların adil, izlenebilir yönetimi.',
        evidence_types: ['dokuman', 'kayit', 'mulakat', 'diger'],
      },
      {
        id: 'D4C5',
        name: 'Doğru olanı yapma iradesi (kısa vadeli kâr yerine kamu yararı)',
        description: 'Değerler ile kararların uyumu; kısa vadeli çıkar yerine güvenli ürün ilkesinin korunması.',
        evidence_types: ['mulakat', 'kayit', 'dokuman', 'diger'],
      },
    ],
  },
]

export const ALL_CRITERIA = DIMENSIONS.flatMap(d =>
  d.criteria.map(c => ({ ...c, dimension_id: d.id, dimension_name: d.name }))
)

export const EVIDENCE_TYPE_LABELS: Record<string, string> = {
  dokuman: '📄 Doküman',
  kpi: '📊 KPI',
  kayit: '📋 Kayıt',
  gozlem: '👁️ Gözlem',
  mulakat: '🗣️ Mülakat',
  ekran_goruntusu: '🖥️ Ekran Görüntüsü',
  diger: '📎 Diğer',
}
