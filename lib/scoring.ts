export type RiskLevel = 'strong' | 'moderate' | 'risk' | 'critical'

export interface RiskConfig {
  strong_min: number
  moderate_min: number
  risk_min: number
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  strong_min: 80,
  moderate_min: 60,
  risk_min: 40,
}

export const RISK_META = {
  strong: {
    label: 'Güçlü',
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#86efac',
    description: 'Mevcut gıda güvenliği kültürü altyapısı ve uygulama disiplini güçlü görünmektedir.',
    recommendations: [
      'Mevcut iyi uygulamalar standart çalışma yöntemi haline getirilip tesis geneline yaygınlaştırılmalıdır.',
      'Güçlü alanların sürdürülebilirliği için rutin doğrulama/izleme devam ettirilmelidir.',
      'Benchmark çalışmaları ile sektör lideri konumu pekiştirilmelidir.',
    ],
  },
  moderate: {
    label: 'Orta',
    color: '#ca8a04',
    bg: '#fefce8',
    border: '#fde047',
    description: 'Genel kültür seviyesi kabul edilebilir olsa da belirli boyutlarda kırılganlık işaretleri vardır.',
    recommendations: [
      'Düşük skor alan kriterlerde hedefli aksiyon planı oluşturulmalı, 30–60 gün içinde yeniden değerlendirme yapılmalıdır.',
      'Liderlik mesajları ve saha uygulaması arasındaki tutarlılık güçlendirilmelidir.',
      'Orta risk alanlarında çalışan farkındalık eğitimleri planlanmalıdır.',
    ],
  },
  risk: {
    label: 'Risk',
    color: '#ea580c',
    bg: '#fff7ed',
    border: '#fdba74',
    description: 'Kültür bileşenlerinde belirgin zayıflıklar bulunmaktadır ve bu durum operasyonel gıda güvenliği risklerini artırır.',
    recommendations: [
      'Kritik kriterler için CAPA planı oluşturulmalı; sorumlu, termin ve doğrulama metodu tanımlanmalıdır.',
      'Eğitimden önce davranışsal bariyerler analiz edilmeli ve sahada günlük rutinlere gömülü kontrol noktaları kurulmalıdır.',
      '30 gün içinde acil iyileştirme aksiyonları başlatılmalıdır.',
    ],
  },
  critical: {
    label: 'Kritik',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fca5a5',
    description: 'Mevcut kültür seviyesi, sistematik uygunsuzluk ve olay riskini yükseltecek düzeydedir.',
    recommendations: [
      'Yönetim tarafından acil aksiyon ve sahada görünür liderlik şarttır.',
      '7 gün içinde hızlı durum analizi, 30 gün içinde yoğunlaştırılmış doğrulama ve yeniden değerlendirme önerilir.',
      'Tüm kritik kriterler için sorumlu atanmalı ve haftalık takip toplantıları başlatılmalıdır.',
    ],
  },
}

export const DIMENSION_RECOMMENDATIONS: Record<string, string[]> = {
  D1: [
    'Kritik ekipman kalibrasyon/bakım planı gözden geçirilmeli; gecikmiş kalibrasyonlar kapatılmalıdır.',
    'İzlenebilirlik testleri rutinleştirilmeli (ör. aylık mock recall).',
    'KPI/prim kurgusunda kaliteyi zayıflatabilecek baskılar azaltılmalıdır.',
  ],
  D2: [
    'Sahada "kimse bakmazken" davranışını ölçen gözlem programı başlatılmalıdır.',
    'Near-miss/tehlike bildirimleri teşvik edilmeli, cezasız bildirim ortamı kurulmalıdır.',
    'Hijyen ve çapraz bulaşma kritik noktaları için mikro-rutin kontroller tanımlanmalıdır.',
  ],
  D3: [
    'Yönetim "hattı durdurma" kararını güvence altına alan yazılı bir yaklaşım yayınlamalıdır.',
    'Saha ziyaretleri "rol model davranış kontrol listesi" ile standartlaştırılmalıdır.',
    'Kriz ve uygunsuzluk anında kalite ekibinin desteklendiğini gösteren somut örnekler oluşturulmalıdır.',
  ],
  D4: [
    'Tağşiş/örtbas riskine karşı değişiklik yönetimi ve onay mekanizmaları sıkılaştırılmalıdır.',
    'Etik ihbar kanalı görünür hale getirilmeli; vaka yönetimi izlenebilir olmalıdır.',
    'Tedarik zincirinde etik satın alma ilkeleri ve tedarikçi uygunluk kriterleri netleştirilmelidir.',
  ],
}

export function calcRiskLevel(score: number, config: RiskConfig): RiskLevel {
  if (score >= config.strong_min) return 'strong'
  if (score >= config.moderate_min) return 'moderate'
  if (score >= config.risk_min) return 'risk'
  return 'critical'
}

export function calcScores(
  scoreMap: Record<string, number>,
  weights: { w1: number; w2: number; w3: number; w4: number }
) {
  const dims = ['D1', 'D2', 'D3', 'D4']
  const dimScores: Record<string, number> = {}

  dims.forEach(d => {
    const vals = Object.entries(scoreMap)
      .filter(([k]) => k.startsWith(d))
      .map(([, v]) => v)
    dimScores[d] = vals.length > 0
      ? (vals.reduce((a, b) => a + b, 0) / vals.length) * 20
      : 0
  })

  const total =
    dimScores['D1'] * weights.w1 +
    dimScores['D2'] * weights.w2 +
    dimScores['D3'] * weights.w3 +
    dimScores['D4'] * weights.w4

  return { dimScores, total: Math.round(total) }
}
