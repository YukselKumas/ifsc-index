'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DIMENSIONS, EVIDENCE_TYPE_LABELS } from '@/lib/criteria'
import { calcScores, calcRiskLevel, DEFAULT_RISK_CONFIG, RISK_META, DIMENSION_RECOMMENDATIONS } from '@/lib/scoring'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function ResultPage() {
  const { id } = useParams()
  const [assessment, setAssessment] = useState<any>(null)
  const [scoreRows, setScoreRows] = useState<any[]>([])
  const [mailTo, setMailTo] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    supabase.from('assessments').select('*').eq('id', id).single()
      .then(({ data }) => data && setAssessment(data))
    supabase.from('scores').select('*').eq('assessment_id', id).order('criterion_id')
      .then(({ data }) => data && setScoreRows(data))
  }, [id])

  if (!assessment) return <div className="p-8 text-slate-400">Yükleniyor...</div>

  const scoreMap: Record<string, number> = {}
  scoreRows.forEach(s => { scoreMap[s.criterion_id] = s.score })

  const weights = { w1: assessment.w1, w2: assessment.w2, w3: assessment.w3, w4: assessment.w4 }
  const { dimScores, total } = calcScores(scoreMap, weights)
  const riskLevel = calcRiskLevel(total, DEFAULT_RISK_CONFIG)
  const riskMeta = RISK_META[riskLevel]

  const worstDim = Object.entries(dimScores).sort(([,a],[,b]) => a - b)[0][0]
  const bestDim = Object.entries(dimScores).sort(([,a],[,b]) => b - a)[0][0]
  const worstDimName = DIMENSIONS.find(d => d.id === worstDim)?.name || ''
  const bestDimName = DIMENSIONS.find(d => d.id === bestDim)?.name || ''

  async function sendMail() {
    if (!mailTo) { toast.error('E-posta adresi girin'); return }
    setSending(true)
    const res = await fetch('/api/send-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessment, scoreRows, email: mailTo, dimScores, total, riskLevel })
    })
    const data = await res.json()
    if (data.ok) toast.success('Rapor gönderildi!')
    else toast.error('Mail gönderilemedi: ' + data.error)
    setSending(false)
  }

  function downloadPDF() {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const dimColorMap: Record<string, string> = {
      D1: '#2563eb', D2: '#16a34a', D3: '#9333ea', D4: '#dc2626'
    }
    const dimBgMap: Record<string, string> = {
      D1: '#eff6ff', D2: '#f0fdf4', D3: '#faf5ff', D4: '#fef2f2'
    }

    const dimCardsHtml = DIMENSIONS.map(dim => {
      const score = Math.round(dimScores[dim.id] || 0)
      return `
        <div style="flex:1;background:${dimBgMap[dim.id]};border:1.5px solid ${dimColorMap[dim.id]}60;
          border-radius:12px;padding:16px;text-align:center;
          -webkit-print-color-adjust:exact;print-color-adjust:exact;">
          <div style="font-size:11px;font-weight:800;color:${dimColorMap[dim.id]};margin-bottom:4px;">${dim.id}</div>
          <div style="font-size:32px;font-weight:900;color:${dimColorMap[dim.id]};line-height:1;">${score}</div>
          <div style="font-size:10px;color:${dimColorMap[dim.id]};opacity:.6;margin-bottom:8px;">/ 100</div>
          <div style="font-size:10px;font-weight:700;color:${dimColorMap[dim.id]};">${dim.name}</div>
          <div style="height:4px;background:#e2e8f0;border-radius:2px;margin-top:8px;
            -webkit-print-color-adjust:exact;print-color-adjust:exact;">
            <div style="height:100%;width:${score}%;background:${dimColorMap[dim.id]};border-radius:2px;
              -webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>
          </div>
        </div>`
    }).join('')

    const criteriaTableHtml = DIMENSIONS.map(dim => {
      const rows = dim.criteria.map(c => {
        const row = scoreRows.find(s => s.criterion_id === c.id)
        const score = row?.score ?? '-'
        const scoreNum = typeof score === 'number' ? score : 0
        const bars = Array.from({length: 5}, (_, i) =>
          `<span style="display:inline-block;width:14px;height:8px;border-radius:2px;margin-right:2px;
            background:${i < scoreNum ? dimColorMap[dim.id] : '#e2e8f0'};
            -webkit-print-color-adjust:exact;print-color-adjust:exact;"></span>`
        ).join('')
        return `
          <tr style="border-bottom:1px solid #f1f5f9;page-break-inside:avoid;">
            <td style="padding:8px 10px;font-size:10px;font-weight:700;color:#94a3b8;
              font-family:monospace;white-space:nowrap;">${c.id}</td>
            <td style="padding:8px 10px;font-size:11px;color:#334155;line-height:1.4;">${c.name}</td>
            <td style="padding:8px 10px;font-size:10px;color:#64748b;">${row?.note || ''}</td>
            <td style="padding:8px 10px;text-align:center;white-space:nowrap;">
              <div>${bars}</div>
              <div style="font-size:13px;font-weight:900;color:${dimColorMap[dim.id]};margin-top:3px;
                -webkit-print-color-adjust:exact;print-color-adjust:exact;">${score}/5</div>
            </td>
          </tr>`
      }).join('')

      return `
        <tr style="page-break-inside:avoid;">
          <td colspan="4" style="padding:10px;background:${dimColorMap[dim.id]};
            color:white;font-weight:800;font-size:11px;letter-spacing:.05em;
            -webkit-print-color-adjust:exact;print-color-adjust:exact;">
            ${dim.name.toUpperCase()}
          </td>
        </tr>
        ${rows}`
    }).join('')

    const recHtml = riskMeta.recommendations.map(r =>
      `<li style="margin-bottom:8px;font-size:12px;color:#334155;line-height:1.6;">${r}</li>`
    ).join('')

    const dimRecHtml = (DIMENSION_RECOMMENDATIONS[worstDim] || []).map(r =>
      `<li style="margin-bottom:8px;font-size:12px;color:#475569;line-height:1.6;">${r}</li>`
    ).join('')

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>IFSC Raporu - ${assessment.facility_name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; background:#f8fafc; color:#0f172a; }
  tr { page-break-inside: avoid; }
  tbody tr { page-break-inside: avoid; }
  .section { page-break-inside: avoid; }
  .page-break { page-break-before: always; }
  @media print {
    body {
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }
    .no-print { display:none !important; }
    @page { margin: 12mm; size: A4; }
    .kapak { page-break-after: always; }
  }
</style>
</head>
<body>

<!-- Yazdır butonu -->
<div class="no-print" style="position:fixed;top:16px;right:16px;z-index:99;display:flex;gap:8px;">
  <button onclick="window.print()" style="background:#2563eb;color:white;border:none;
    padding:10px 20px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;
    box-shadow:0 4px 12px rgba(37,99,235,.3);">
    🖨️ PDF Olarak Kaydet
  </button>
  <button onclick="window.close()" style="background:#e2e8f0;color:#334155;border:none;
    padding:10px 20px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;">
    ✕ Kapat
  </button>
</div>

<div style="max-width:800px;margin:0 auto;padding:24px 24px 40px;">

  <!-- KAPAK -->
  <div class="kapak" style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);
    border-radius:20px;padding:40px;color:white;margin-bottom:24px;position:relative;overflow:hidden;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;">

    <div style="position:absolute;right:-40px;top:-40px;width:200px;height:200px;
      border-radius:50%;background:rgba(255,255,255,.04);"></div>
    <div style="position:absolute;right:40px;bottom:-60px;width:150px;height:150px;
      border-radius:50%;background:rgba(255,255,255,.03);"></div>

    <div style="display:flex;justify-content:space-between;align-items:flex-start;position:relative;">
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <div style="width:44px;height:44px;background:rgba(255,255,255,.15);
            border-radius:12px;display:flex;align-items:center;justify-content:center;
            font-size:22px;flex-shrink:0;">🛡️</div>
          <div>
            <div style="font-size:20px;font-weight:900;">IFSC Index</div>
            <div style="font-size:11px;opacity:.5;">Gıda Güvenliği Kültürü Değerlendirme</div>
          </div>
        </div>
        <div style="font-size:28px;font-weight:900;margin-bottom:8px;line-height:1.2;">
          ${assessment.facility_name}
        </div>
        <div style="font-size:13px;opacity:.6;margin-bottom:4px;">📅 ${assessment.assessment_date}</div>
        ${assessment.facility_type ? `<div style="font-size:13px;opacity:.6;margin-bottom:16px;">🏭 ${assessment.facility_type}</div>` : '<div style="margin-bottom:16px;"></div>'}
      </div>

      <!-- Skor kutusu -->
      <div style="background:${riskMeta.color};border-radius:16px;padding:24px 28px;
        text-align:center;min-width:140px;flex-shrink:0;margin-left:24px;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;">
        <div style="font-size:64px;font-weight:900;line-height:1;color:white;">${total}</div>
        <div style="font-size:12px;color:white;opacity:.8;margin-top:4px;">/ 100 puan</div>
        <div style="margin-top:10px;background:rgba(255,255,255,.25);border-radius:20px;
          padding:5px 16px;font-size:14px;font-weight:800;color:white;
          -webkit-print-color-adjust:exact;print-color-adjust:exact;">
          ${riskMeta.label}
        </div>
      </div>
    </div>

    <!-- Risk açıklaması -->
    <div style="margin-top:20px;padding:14px 18px;background:rgba(255,255,255,.08);
      border-radius:12px;border-left:3px solid ${riskMeta.color};
      -webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <div style="font-size:12px;opacity:.8;line-height:1.7;color:white;">
        ${riskMeta.description}
      </div>
    </div>

    <!-- En güçlü / En kritik -->
    <div style="display:flex;gap:12px;margin-top:16px;">
      <div style="flex:1;background:rgba(22,163,74,.25);border-radius:10px;padding:12px 16px;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;">
        <div style="font-size:10px;color:white;opacity:.7;margin-bottom:4px;text-transform:uppercase;
          letter-spacing:.05em;">En Güçlü Boyut</div>
        <div style="font-size:13px;font-weight:700;color:white;">✅ ${bestDimName}</div>
      </div>
      <div style="flex:1;background:rgba(220,38,38,.25);border-radius:10px;padding:12px 16px;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;">
        <div style="font-size:10px;color:white;opacity:.7;margin-bottom:4px;text-transform:uppercase;
          letter-spacing:.05em;">En Kritik Boyut</div>
        <div style="font-size:13px;font-weight:700;color:white;">⚠️ ${worstDimName}</div>
      </div>
    </div>
  </div>

  <!-- BOYUT SKORLARI -->
  <div class="section" style="background:white;border-radius:16px;border:1px solid #e2e8f0;
    padding:24px;margin-bottom:20px;">
    <div style="font-size:15px;font-weight:800;color:#0f172a;margin-bottom:16px;">📊 Boyut Skorları</div>
    <div style="display:flex;gap:12px;">${dimCardsHtml}</div>
  </div>

  <!-- KRİTER DETAYLARI -->
  <div style="background:white;border-radius:16px;border:1px solid #e2e8f0;
    overflow:hidden;margin-bottom:20px;">
    <div style="padding:20px 24px;border-bottom:1px solid #f1f5f9;">
      <div style="font-size:15px;font-weight:800;color:#0f172a;">📋 Kriter Detayları</div>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f8fafc;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
          <th style="padding:10px;text-align:left;font-size:10px;color:#94a3b8;font-weight:700;
            text-transform:uppercase;width:60px;">ID</th>
          <th style="padding:10px;text-align:left;font-size:10px;color:#94a3b8;font-weight:700;
            text-transform:uppercase;">Kriter</th>
          <th style="padding:10px;text-align:left;font-size:10px;color:#94a3b8;font-weight:700;
            text-transform:uppercase;width:130px;">Not</th>
          <th style="padding:10px;text-align:center;font-size:10px;color:#94a3b8;font-weight:700;
            text-transform:uppercase;width:90px;">Puan</th>
        </tr>
      </thead>
      <tbody>${criteriaTableHtml}</tbody>
    </table>
  </div>

  <!-- ÖNERİLER -->
  <div class="section" style="background:white;border-radius:16px;border:1px solid #e2e8f0;
    padding:24px;margin-bottom:20px;">
    <div style="font-size:15px;font-weight:800;color:#0f172a;margin-bottom:16px;">
      💡 Öneriler ve Aksiyon Planı
    </div>

    <div style="background:${riskMeta.bg};border:1px solid ${riskMeta.border};
      border-radius:12px;padding:18px;margin-bottom:16px;
      -webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <div style="font-size:13px;font-weight:700;color:${riskMeta.color};margin-bottom:12px;">
        ${riskMeta.label} Seviyesi Önerileri
      </div>
      <ul style="padding-left:20px;">${recHtml}</ul>
    </div>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;
      -webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <div style="font-size:13px;font-weight:700;color:#334155;margin-bottom:12px;">
        En Kritik Boyut: ${worstDimName}
      </div>
      <ul style="padding-left:20px;">${dimRecHtml}</ul>
    </div>
  </div>

  <!-- FOOTER -->
  <div style="text-align:center;padding:16px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;margin-top:8px;">
    IFSC Index — Gıda Güvenliği Kültürü Değerlendirme Sistemi · ${new Date().toLocaleDateString('tr-TR')}
  </div>

</div>
</body>
</html>`

    printWindow.document.write(html)
    printWindow.document.close()
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link href="/dashboard/assessments" className="text-slate-400 text-sm hover:text-slate-600">
            ← Değerlendirmelere Dön
          </Link>
          <h1 className="text-2xl font-black text-slate-900 mt-1">Değerlendirme Sonucu</h1>
          <p className="text-slate-500 text-sm">{assessment.facility_name} · {assessment.assessment_date}</p>
        </div>
        <div className="flex gap-2 items-center">
          <Link href={`/dashboard/assessments/${id}`}
            className="border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50">
            ✏️ Düzenle
          </Link>
          <button onClick={downloadPDF}
            className="border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50">
            📥 PDF İndir
          </button>
          <input value={mailTo} onChange={e => setMailTo(e.target.value)}
            placeholder="mail@firma.com"
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 w-44" />
          <button onClick={sendMail} disabled={sending}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-blue-700">
            {sending ? '...' : '📧 Gönder'}
          </button>
        </div>
      </div>

      {/* Ana skor kartı */}
      <div className="rounded-3xl p-8 mb-6 text-white"
        style={{ background: 'linear-gradient(135deg, #1e293b, #334155)' }}>
        <div className="flex justify-between items-start">
          <div>
            <div className="text-sm opacity-60 mb-1 uppercase tracking-widest">IFSC Index Skoru</div>
            <div className="text-8xl font-black leading-none">{total}</div>
            <div className="text-lg opacity-50 mt-1">/ 100 puan</div>
            <div className="mt-4">
              <span style={{ background: riskMeta.bg, color: riskMeta.color }}
                className="px-4 py-1.5 rounded-full text-sm font-black">
                {riskMeta.label}
              </span>
            </div>
          </div>
          <div className="text-right max-w-xs">
            <div className="text-sm opacity-70 leading-relaxed">{riskMeta.description}</div>
            <div className="mt-4 text-xs opacity-50">
              <div>En güçlü: {bestDimName}</div>
              <div>En kritik: {worstDimName}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 boyut kartları */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {DIMENSIONS.map(dim => {
          const score = Math.round(dimScores[dim.id] || 0)
          return (
            <div key={dim.id} style={{ background: dim.bg, borderColor: dim.color + '40' }}
              className="rounded-2xl p-4 border">
              <div className="text-xs font-bold mb-2 opacity-70" style={{ color: dim.color }}>{dim.id}</div>
              <div className="text-2xl font-black" style={{ color: dim.color }}>{score}</div>
              <div className="text-xs opacity-60" style={{ color: dim.color }}>/ 100</div>
              <div className="text-xs font-bold mt-2" style={{ color: dim.color }}>{dim.name}</div>
              <div className="mt-2 h-1.5 bg-white/50 rounded-full">
                <div className="h-full rounded-full" style={{ width: `${score}%`, background: dim.color }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Kriter tablosu */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-6">
        <div className="p-5 border-b border-slate-100">
          <h2 className="font-black text-slate-900">Kriter Detayları</h2>
        </div>
        {DIMENSIONS.map(dim => (
          <div key={dim.id}>
            <div className="px-5 py-2.5 text-xs font-black uppercase tracking-widest"
              style={{ background: dim.bg, color: dim.color }}>{dim.name}</div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-50">
                {dim.criteria.map(c => {
                  const row = scoreRows.find(s => s.criterion_id === c.id)
                  const score = row?.score ?? '-'
                  const scoreNum = typeof score === 'number' ? score : 0
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 w-20">
                        <span className="text-xs font-bold text-slate-400">{c.id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 text-xs">{c.name}</div>
                        {row?.note && <div className="text-xs text-slate-400 mt-0.5">{row.note}</div>}
                      </td>
                      <td className="px-4 py-3 w-24">
                        {row?.evidence_type && (
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                            {EVIDENCE_TYPE_LABELS[row.evidence_type]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 w-32">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full">
                            <div className="h-full rounded-full"
                              style={{ width: `${(scoreNum/5)*100}%`, background: dim.color }} />
                          </div>
                          <span className="font-black text-sm w-4" style={{ color: dim.color }}>{score}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Öneriler */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="font-black text-slate-900 mb-4">Öneriler ve Aksiyon Planı</h2>
        <div className="mb-4 p-4 rounded-xl" style={{ background: riskMeta.bg, borderColor: riskMeta.border }}>
          <div className="font-bold mb-2" style={{ color: riskMeta.color }}>{riskMeta.label} Seviyesi Önerileri</div>
          <ul className="space-y-1">
            {riskMeta.recommendations.map((r, i) => (
              <li key={i} className="text-sm text-slate-700 flex gap-2">
                <span style={{ color: riskMeta.color }}>→</span> {r}
              </li>
            ))}
          </ul>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="font-bold text-slate-700 mb-2 text-sm">En Kritik Boyut: {worstDimName}</div>
          <ul className="space-y-1">
            {DIMENSION_RECOMMENDATIONS[worstDim]?.map((r, i) => (
              <li key={i} className="text-sm text-slate-600 flex gap-2">
                <span className="text-slate-400">•</span> {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
