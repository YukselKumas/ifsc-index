'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DIMENSIONS, ALL_CRITERIA, EVIDENCE_TYPE_LABELS } from '@/lib/criteria'
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

  async function downloadPDF() {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = 210
    const riskColors: Record<string, [number,number,number]> = {
      strong: [22, 163, 74],
      moderate: [202, 138, 4],
      risk: [234, 88, 12],
      critical: [220, 38, 38],
    }
    const rc = riskColors[riskLevel]

    // ── KAPAK ──────────────────────────────────────────
    // Koyu arka plan
    doc.setFillColor(15, 23, 42)
    doc.rect(0, 0, W, 90, 'F')

    // Başlık
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('IFSC INDEX', 20, 28)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text('Gida Guvenlik Kulturu Degerlendirme Raporu', 20, 36)

    // Tesis bilgileri
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(assessment.facility_name, 20, 52)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text(`Tarih: ${assessment.assessment_date}`, 20, 59)
    if (assessment.facility_type) doc.text(`Tesis Tipi: ${assessment.facility_type}`, 20, 65)

    // Skor kutusu (sağ taraf)
    doc.setFillColor(...rc)
    doc.roundedRect(140, 18, 50, 55, 4, 4, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(42)
    doc.setFont('helvetica', 'bold')
    doc.text(String(total), 165, 50, { align: 'center' })
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('/ 100 puan', 165, 58, { align: 'center' })
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(riskMeta.label.toUpperCase(), 165, 67, { align: 'center' })

    // Risk açıklaması
    doc.setFillColor(30, 41, 59)
    doc.rect(0, 90, W, 18, 'F')
    doc.setTextColor(148, 163, 184)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    const splitDesc = doc.splitTextToSize(riskMeta.description, W - 40)
    doc.text(splitDesc, 20, 99)

    // ── BOYUT SKORLARI ──────────────────────────────────
    let y = 120
    doc.setTextColor(15, 23, 42)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Boyut Skorlari', 20, y)
    y += 8

    const dimColors: Record<string, [number,number,number]> = {
      D1: [37, 99, 235],
      D2: [22, 163, 74],
      D3: [147, 51, 234],
      D4: [220, 38, 38],
    }

    DIMENSIONS.forEach((dim, i) => {
      const score = Math.round(dimScores[dim.id] || 0)
      const col = dimColors[dim.id]
      const x = 20 + i * 42

      // Kart arka planı
      doc.setFillColor(248, 250, 252)
      doc.roundedRect(x, y, 38, 28, 3, 3, 'F')
      doc.setDrawColor(...col)
      doc.setLineWidth(0.5)
      doc.roundedRect(x, y, 38, 28, 3, 3, 'S')

      // Boyut ID
      doc.setTextColor(...col)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.text(dim.id, x + 4, y + 6)

      // Skor
      doc.setFontSize(20)
      doc.text(String(score), x + 19, y + 18, { align: 'center' })

      // Boyut adı
      doc.setFontSize(6)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 116, 139)
      const dimNameShort = dim.name.length > 14 ? dim.name.substring(0, 14) + '..' : dim.name
      doc.text(dimNameShort, x + 19, y + 24, { align: 'center' })

      // Progress bar
      doc.setFillColor(226, 232, 240)
      doc.rect(x + 4, y + 26, 30, 1.5, 'F')
      doc.setFillColor(...col)
      doc.rect(x + 4, y + 26, 30 * (score / 100), 1.5, 'F')
    })

    y += 40

    // En güçlü / En kritik
    doc.setFillColor(240, 253, 244)
    doc.roundedRect(20, y, 80, 12, 2, 2, 'F')
    doc.setTextColor(22, 163, 74)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(`En Guclu: ${bestDimName}`, 24, y + 7)

    doc.setFillColor(254, 242, 242)
    doc.roundedRect(110, y, 80, 12, 2, 2, 'F')
    doc.setTextColor(220, 38, 38)
    doc.text(`En Kritik: ${worstDimName}`, 114, y + 7)
    y += 22

    // ── KRİTER DETAYLARI ──────────────────────────────
    doc.setTextColor(15, 23, 42)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Kriter Detaylari', 20, y)
    y += 6

    const tableBody: any[] = []
    DIMENSIONS.forEach(dim => {
      // Boyut başlık satırı
      tableBody.push([
        { content: dim.name.toUpperCase(), colSpan: 4,
          styles: { fillColor: dimColors[dim.id], textColor: [255,255,255], fontStyle: 'bold', fontSize: 8 } }
      ])
      dim.criteria.forEach(c => {
        const row = scoreRows.find(s => s.criterion_id === c.id)
        const score = row?.score ?? '-'
        const bar = typeof score === 'number' ? '█'.repeat(score) + '░'.repeat(5 - score) : '-----'
        tableBody.push([
          { content: c.id, styles: { textColor: [148,163,184], fontSize: 7, fontStyle: 'bold' } },
          { content: c.name, styles: { fontSize: 7 } },
          { content: row?.note || '', styles: { fontSize: 6, textColor: [100,116,139] } },
          { content: `${score}/5`, styles: { halign: 'center', fontStyle: 'bold', fontSize: 9,
            textColor: dimColors[dim.id] } },
        ])
      })
    })

    autoTable(doc, {
      startY: y,
      head: [['ID', 'Kriter', 'Not', 'Puan']],
      body: tableBody,
      columnStyles: {
        0: { cellWidth: 14 },
        1: { cellWidth: 100 },
        2: { cellWidth: 60 },
        3: { cellWidth: 16 },
      },
      headStyles: { fillColor: [30, 41, 59], textColor: [255,255,255], fontSize: 8 },
      styles: { cellPadding: 2.5, overflow: 'linebreak', fontSize: 7 },
      margin: { left: 20, right: 20 },
    })

    // ── ÖNERİLER ──────────────────────────────────────
    const finalY = (doc as any).lastAutoTable.finalY + 10
    doc.addPage()
    let oy = 20

    doc.setFillColor(15, 23, 42)
    doc.rect(0, 0, W, 14, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Oneriler ve Aksiyon Plani', 20, 9)
    oy = 24

    // Risk seviyesi önerileri
    doc.setFillColor(...rc, 20)
    doc.setFillColor(rc[0], rc[1], rc[2])
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(20, oy, W - 40, 8, 2, 2, 'F')
    doc.setTextColor(...rc)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`${riskMeta.label} Seviyesi Onerileri`, 24, oy + 5.5)
    oy += 12

    riskMeta.recommendations.forEach(r => {
      doc.setTextColor(51, 65, 85)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(`→  ${r}`, W - 50)
      doc.text(lines, 24, oy)
      oy += lines.length * 5 + 2
    })

    oy += 6
    doc.setTextColor(15, 23, 42)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`En Kritik Boyut: ${worstDimName}`, 20, oy)
    oy += 8

    DIMENSION_RECOMMENDATIONS[worstDim]?.forEach(r => {
      doc.setTextColor(71, 85, 105)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(`•  ${r}`, W - 50)
      doc.text(lines, 24, oy)
      oy += lines.length * 5 + 2
    })

    // Footer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFillColor(15, 23, 42)
      doc.rect(0, 287, W, 10, 'F')
      doc.setTextColor(148, 163, 184)
      doc.setFontSize(7)
      doc.text('IFSC Index — Gida Guvenlik Kulturu Degerlendirme Sistemi', 20, 293)
      doc.text(`Sayfa ${i} / ${pageCount}`, W - 20, 293, { align: 'right' })
    }

    doc.save(`IFSC-Rapor-${assessment.facility_name}-${assessment.assessment_date}.pdf`)
    toast.success('PDF indirildi!')
  }

  return (
    <div className="p-8 max-w-5xl">
      {/* Aksiyonlar */}
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

      {/* Kriter detay tablosu */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-6">
        <div className="p-5 border-b border-slate-100">
          <h2 className="font-black text-slate-900">Kriter Detayları</h2>
        </div>
        {DIMENSIONS.map(dim => (
          <div key={dim.id}>
            <div className="px-5 py-2.5 text-xs font-black uppercase tracking-widest"
              style={{ background: dim.bg, color: dim.color }}>
              {dim.name}
            </div>
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
          <div className="font-bold mb-2" style={{ color: riskMeta.color }}>
            {riskMeta.label} Seviyesi Önerileri
          </div>
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
