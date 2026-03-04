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
  const router = useRouter()
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

  function printPDF() { window.print() }

  return (
    <div className="p-8 max-w-5xl">
      {/* Aksiyonlar */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <div>
          <Link href="/dashboard/assessments" className="text-slate-400 text-sm hover:text-slate-600">
            ← Değerlendirmelere Dön
          </Link>
          <h1 className="text-2xl font-black text-slate-900 mt-1">Değerlendirme Sonucu</h1>
          <p className="text-slate-500 text-sm">{assessment.facility_name} · {assessment.assessment_date}</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={printPDF}
            className="border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50">
            🖨️ PDF İndir
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
        style={{ background: `linear-gradient(135deg, #1e293b, #334155)` }}>
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
          const pct = score
          return (
            <div key={dim.id} style={{ background: dim.bg, borderColor: dim.color + '40' }}
              className="rounded-2xl p-4 border">
              <div className="text-xs font-bold mb-2 opacity-70" style={{ color: dim.color }}>
                {dim.id}
              </div>
              <div className="text-2xl font-black" style={{ color: dim.color }}>{score}</div>
              <div className="text-xs opacity-60" style={{ color: dim.color }}>/ 100</div>
              <div className="text-xs font-bold mt-2" style={{ color: dim.color }}>{dim.name}</div>
              <div className="mt-2 h-1.5 bg-white/50 rounded-full">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: dim.color }} />
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
                  const barWidth = (scoreNum / 5) * 100
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
                              style={{ width: `${barWidth}%`, background: dim.color }} />
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
      <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
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
          <div className="font-bold text-slate-700 mb-2 text-sm">
            En Kritik Boyut: {worstDimName}
          </div>
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
