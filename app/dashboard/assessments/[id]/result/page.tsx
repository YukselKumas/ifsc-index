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
        <div style="flex:1;background:${dimBgMap[dim.id]};border:1.5px solid ${dimColorMap[dim.id]}50;
          border-radius:12px;padding:18px 14px;text-align:center;
          -webkit-print-color-adjust:exact;print-color-adjust:exact;">
          <div style="font-size:10px;font-weight:800;color:${dimColorMap[dim.id]};
            margin-bottom:6px;letter-spacing:.05em;">${dim.id}</div>
          <div style="font-size:34px;font-weight:900;color:${dimColorMap[dim.id]};
            line-height:1;margin-bottom:2px;">${score}</div>
          <div style="font-size:10px;color:${dimColorMap[dim.id]};opacity:.5;
            margin-bottom:10px;">/ 100</div>
          <div style="font-size:10px;font-weight:700;color:${dimColorMap[dim.id]};
            margin-bottom:8px;line-height:1.3;">${dim.name}</div>
          <div style="height:3px;background:rgba(0,0,0,.08);border-radius:2px;
            -webkit-print-color-adjust:exact;print-color-adjust:exact;">
            <div style="height:100%;width:${score}%;background:${dimColorMap[dim.id]};
              border-radius:2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>
          </div>
        </div>`
    }).join('')

    const criteriaTableHtml = DIMENSIONS.map(dim => {
      const rows = dim.criteria.map(c => {
        const row = scoreRows.find((s: any) => s.criterion_id === c.id)
        const score = row?.score ?? '-'
        const scoreNum = typeof score === 'number' ? score : 0
        const bars = Array.from({length: 5}, (_, i) =>
          `<span style="display:inline-block;width:12px;height:7px;border-radius:2px;margin-right:2px;
            background:${i < scoreNum ? dimColorMap[dim.id] : '#e2e8f0'};
            -webkit-print-color-adjust:exact;print-color-adjust:exact;"></span>`
        ).join('')
        return `
          <tr style="border-bottom:1px solid #f8fafc;page-break-inside:avoid;">
            <td style="padding:9px 12px;font-size:10px;font-weight:700;color:#94a3b8;
              font-family:monospace;white-space:nowrap;width:56px;">${c.id}</td>
            <td style="padding:9px 12px;font-size:11px;color:#334155;line-height:1.5;">${c.name}</td>
            <td style="padding:9px 12px;font-size:10px;color:#94a3b8;font-style:italic;">
              ${row?.note || ''}</td>
            <td style="padding:9px 12px;text-align:right;white-space:nowrap;width:90px;">
              <div style="margin-bottom:3px;">${bars}</div>
              <div style="font-size:12px;font-weight:900;color:${dimColorMap[dim.id]};
                -webkit-print-color-adjust:exact;print-color-adjust:exact;">${score}/5</div>
            </td>
          </tr>`
      }).join('')

      return `
        <tr style="page-break-inside:avoid;">
          <td colspan="4" style="padding:9px 12px;
            background:${dimColorMap[dim.id]};color:white;
            font-weight:800;font-size:10px;letter-spacing:.08em;
            -webkit-print-color-adjust:exact;print-color-adjust:exact;">
            ${dim.name.toUpperCase()}
          </td>
        </tr>
        ${rows}`
    }).join('')

    const recHtml = riskMeta.recommendations.map(r =>
      `<li style="margin-bottom:10px;font-size:12px;color:#334155;line-height:1.7;
        padding-left:4px;">${r}</li>`
    ).join('')

    const dimRecHtml = (DIMENSION_RECOMMENDATIONS[worstDim] || []).map(r =>
      `<li style="margin-bottom:10px;font-size:12px;color:#475569;line-height:1.7;
        padding-left:4px;">${r}</li>`
    ).join('')

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>IFSC Raporu - ${assessment.facility_name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; background:#f1f5f9; color:#0f172a; }
  tr { page-break-inside:avoid; }
  tbody tr { page-break-inside:avoid; }
  @media print {
    body {
      background:white;
      -webkit-print-color-adjust:exact;
      print-color-adjust:exact;
      color-adjust:exact;
    }
    .no-print { display:none !important; }
    @page { margin:12mm; size:A4; }
  }
</style>
</head>
<body>

<div class="no-print" style="position:fixed;top:16px;right:16px;z-index:99;display:flex;gap:8px;">
  <button onclick="window.print()" style="background:#2563eb;color:white;border:none;
    padding:10px 22px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;
    box-shadow:0 4px 14px rgba(37,99,235,.35);">
    🖨️ PDF Olarak Kaydet
  </button>
  <button onclick="window.close()" style="background:#e2e8f0;color:#334155;border:none;
    padding:10px 18px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;">
    ✕ Kapat
  </button>
</div>

<div style="max-width:794px;margin:0 auto;padding:20px 20px 40px;">

  <!-- SAYFA 1: KAPAK + BOYUT SKORLARI -->
  <div style="min-height:1050px;display:flex;flex-direction:column;gap:16px;
    page-break-after:always;">

    <!-- Kapak kartı -->
    <div style="background:linear-gradient(140deg,#0f172a 0%,#1a2f52 60%,#1e3a5f 100%);
      border-radius:20px;padding:44px 44px 36px;color:white;position:relative;overflow:hidden;
      -webkit-print-color-adjust:exact;print-color-adjust:exact;">

      <!-- Subtle grid pattern -->
      <div style="position:absolute;inset:0;opacity:.04;
        background-image:linear-gradient(rgba(255,255,255,.3) 1px,transparent 1px),
          linear-gradient(90deg,rgba(255,255,255,.3) 1px,transparent 1px);
        background-size:32px 32px;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>

      <!-- Soft glow circles -->
      <div style="position:absolute;right:-60px;top:-60px;width:260px;height:260px;
        border-radius:50%;background:radial-gradient(circle,rgba(99,179,237,.08) 0%,transparent 70%);
        -webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>
      <div style="position:absolute;left:-40px;bottom:-80px;width:220px;height:220px;
        border-radius:50%;background:radial-gradient(circle,rgba(167,139,250,.06) 0%,transparent 70%);
        -webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>

      <div style="position:relative;display:flex;justify-content:space-between;
        align-items:flex-start;gap:24px;">
        <div style="flex:1;">
          <!-- Logo -->
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:28px;">
            <div style="width:40px;height:40px;background:rgba(255,255,255,.12);
              border:1px solid rgba(255,255,255,.15);border-radius:11px;
              display:flex;align-items:center;justify-content:center;font-size:19px;
              -webkit-print-color-adjust:exact;print-color-adjust:exact;">🛡️</div>
            <div>
              <div style="font-size:17px;font-weight:900;letter-spacing:-.01em;">IFSC Index</div>
              <div style="font-size:10px;opacity:.45;margin-top:1px;">
                Gıda Güvenliği Kültürü Değerlendirme</div>
            </div>
          </div>

          <!-- Tesis adı -->
          <div style="font-size:30px;font-weight:900;line-height:1.15;margin-bottom:12px;
            letter-spacing:-.02em;">${assessment.facility_name}</div>

          <!-- Meta -->
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:24px;">
            <div style="font-size:12px;opacity:.55;">📅 ${assessment.assessment_date}</div>
            ${assessment.facility_type
              ? `<div style="font-size:12px;opacity:.55;">🏭 ${assessment.facility_type}</div>`
              : ''}
          </div>

          <!-- Risk açıklaması -->
          <div style="padding:14px 16px;background:rgba(255,255,255,.07);
            border-radius:11px;border-left:3px solid ${riskMeta.color};
            -webkit-print-color-adjust:exact;print-color-adjust:exact;">
            <div style="font-size:11px;opacity:.75;line-height:1.7;">
              ${riskMeta.description}</div>
          </div>
        </div>

        <!-- Skor kutusu -->
        <div style="background:${riskMeta.color};border-radius:18px;padding:28px 32px;
          text-align:center;min-width:148px;flex-shrink:0;
          box-shadow:0 12px 32px rgba(0,0,0,.25);
          -webkit-print-color-adjust:exact;print-color-adjust:exact;">
          <div style="font-size:11px;color:rgba(255,255,255,.7);font-weight:600;
            text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">IFSC Skoru</div>
          <div style="font-size:68px;font-weight:900;line-height:1;color:white;">
            ${total}</div>
          <div style="font-size:12px;color:rgba(255,255,255,.65);margin-top:5px;">/ 100 puan</div>
          <div style="margin-top:14px;background:rgba(255,255,255,.22);border-radius:20px;
            padding:5px 14px;font-size:13px;font-weight:800;color:white;
            -webkit-print-color-adjust:exact;print-color-adjust:exact;">
            ${riskMeta.label}
          </div>
        </div>
      </div>

      <!-- En güçlü / En kritik -->
      <div style="position:relative;display:flex;gap:12px;margin-top:24px;">
        <div style="flex:1;background:rgba(22,163,74,.18);border-radius:10px;
          padding:11px 16px;border:1px solid rgba(22,163,74,.2);
          -webkit-print-color-adjust:exact;print-color-adjust:exact;">
          <div style="font-size:9px;color:rgba(255,255,255,.5);text-transform:uppercase;
            letter-spacing:.06em;margin-bottom:4px;">En Güçlü Boyut</div>
          <div style="font-size:13px;font-weight:700;color:white;">✅ ${bestDimName}</div>
        </div>
        <div style="flex:1;background:rgba(220,38,38,.18);border-radius:10px;
          padding:11px 16px;border:1px solid rgba(220,38,38,.2);
          -webkit-print-color-adjust:exact;print-color-adjust:exact;">
          <div style="font-size:9px;color:rgba(255,255,255,.5);text-transform:uppercase;
            letter-spacing:.06em;margin-bottom:4px;">En Kritik Boyut</div>
          <div style="font-size:13px;font-weight:700;color:white;">⚠️ ${worstDimName}</div>
        </div>
      </div>
    </div>

    <!-- Boyut Skorları (1. sayfada kapakla birlikte) -->
    <div style="background:white;border-radius:16px;border:1px solid #e8ecf0;padding:24px;
      -webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:16px;
        display:flex;align-items:center;gap:8px;">
        <span style="display:inline-block;width:3px;height:16px;background:#2563eb;
          border-radius:2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></span>
        Boyut Skorları
      </div>
      <div style="display:flex;gap:12px;">${dimCardsHtml}</div>
    </div>

  </div>
  <!-- /SAYFA 1 -->

  <!-- SAYFA 2: KRİTER DETAYLARI -->
  <div style="background:white;border-radius:16px;border:1px solid #e8ecf0;
    overflow:hidden;margin-bottom:16px;page-break-after:always;">
    <div style="padding:20px 24px;border-bottom:1px solid #f1f5f9;
      background:linear-gradient(135deg,#f8fafc,#fff);
      -webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <div style="font-size:14px;font-weight:800;color:#0f172a;
        display:flex;align-items:center;gap:8px;">
        <span style="display:inline-block;width:3px;height:16px;background:#2563eb;
          border-radius:2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></span>
        Kriter Detayları
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f8fafc;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
          <th style="padding:10px 12px;text-align:left;font-size:9px;color:#94a3b8;
            font-weight:700;text-transform:uppercase;letter-spacing:.06em;width:56px;">ID</th>
          <th style="padding:10px 12px;text-align:left;font-size:9px;color:#94a3b8;
            font-weight:700;text-transform:uppercase;letter-spacing:.06em;">Kriter</th>
          <th style="padding:10px 12px;text-align:left;font-size:9px;color:#94a3b8;
            font-weight:700;text-transform:uppercase;letter-spacing:.06em;width:130px;">Not</th>
          <th style="padding:10px 12px;text-align:right;font-size:9px;color:#94a3b8;
            font-weight:700;text-transform:uppercase;letter-spacing:.06em;width:90px;">Puan</th>
        </tr>
      </thead>
      <tbody>${criteriaTableHtml}</tbody>
    </table>
  </div>

  <!-- SAYFA 3: ÖNERİLER -->
  <div style="background:white;border-radius:16px;border:1px solid #e8ecf0;padding:28px;">
    <div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:20px;
      display:flex;align-items:center;gap:8px;">
      <span style="display:inline-block;width:3px;height:16px;background:#2563eb;
        border-radius:2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></span>
      Öneriler ve Aksiyon Planı
    </div>

    <div style="background:${riskMeta.bg};border:1px solid ${riskMeta.border};
      border-radius:12px;padding:20px;margin-bottom:16px;
      -webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
        <div style="width:8px;height:8px;border-radius:50%;background:${riskMeta.color};
          -webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>
        <div style="font-size:13px;font-weight:700;color:${riskMeta.color};">
          ${riskMeta.label} Seviyesi Önerileri</div>
      </div>
      <ul style="padding-left:18px;">${recHtml}</ul>
    </div>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;
      -webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
        <div style="width:8px;height:8px;border-radius:50%;background:#64748b;
          -webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>
        <div style="font-size:13px;font-weight:700;color:#334155;">
          En Kritik Boyut: ${worstDimName}</div>
      </div>
      <ul style="padding-left:18px;">${dimRecHtml}</ul>
    </div>

    <!-- Footer -->
    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #f1f5f9;
      display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:10px;color:#94a3b8;">
        IFSC Index — Gıda Güvenliği Kültürü Değerlendirme Sistemi
      </div>
      <div style="font-size:10px;color:#94a3b8;">
        ${new Date().toLocaleDateString('tr-TR')}
      </div>
    </div>
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
                  const row = scoreRows.find((s: any) => s.criterion_id === c.id)
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
