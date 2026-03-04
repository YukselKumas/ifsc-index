'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DIMENSIONS } from '@/lib/criteria'
import { RISK_META } from '@/lib/scoring'
import Link from 'next/link'

export default function FacilityHistoryPage() {
  const { slug } = useParams()
  const [assessments, setAssessments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('assessments')
      .select('*')
      .eq('facility_id', slug)
      .order('revision_number', { ascending: true })
      .then(({ data }) => {
        if (data) setAssessments(data)
        setLoading(false)
      })
  }, [slug])

  if (loading) return <div className="p-8 text-slate-400">Yükleniyor...</div>
  if (!assessments.length) return (
    <div className="p-8">
      <div className="text-slate-400">Firma bulunamadı.</div>
      <Link href="/dashboard/assessments" className="text-blue-600 text-sm mt-2 block">
        ← Değerlendirmelere Dön
      </Link>
    </div>
  )

  const facility = assessments[0]
  const completed = assessments.filter(a => a.status === 'completed')
  const latest = [...assessments].sort((a, b) => b.revision_number - a.revision_number)[0]
  const latestMeta = latest.risk_level ? RISK_META[latest.risk_level as keyof typeof RISK_META] : null

  // Trend hesapla
  const trend = completed.length >= 2
    ? completed[completed.length - 1].total_score - completed[completed.length - 2].total_score
    : null

  // Boyut trendi
  const dimKeys = ['d1_score', 'd2_score', 'd3_score', 'd4_score']

  return (
    <div className="p-8 max-w-5xl">
      {/* Başlık */}
      <div className="mb-6">
        <Link href="/dashboard/assessments"
          className="text-slate-400 text-sm hover:text-slate-600">
          ← Değerlendirmelere Dön
        </Link>
        <div className="flex justify-between items-start mt-2">
          <div>
            <h1 className="text-2xl font-black text-slate-900">{facility.facility_name}</h1>
            <p className="text-slate-500 text-sm mt-1">
              {facility.facility_type} · {assessments.length} değerlendirme
            </p>
          </div>
          <Link href="/dashboard/assessments/new"
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5
              rounded-xl text-sm font-bold transition">
            🔄 Yeni Revizyon
          </Link>
        </div>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <div className="text-xs text-slate-400 font-bold uppercase mb-2">Son Skor</div>
          <div className="text-3xl font-black" style={{ color: latestMeta?.color || '#64748b' }}>
            {latest.total_score ?? '-'}
          </div>
          <div className="text-xs text-slate-400">/ 100 puan</div>
          {latestMeta && (
            <span style={{ background: latestMeta.bg, color: latestMeta.color }}
              className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-bold">
              {latestMeta.label}
            </span>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <div className="text-xs text-slate-400 font-bold uppercase mb-2">Toplam Revizyon</div>
          <div className="text-3xl font-black text-slate-900">{assessments.length}</div>
          <div className="text-xs text-slate-400">değerlendirme</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <div className="text-xs text-slate-400 font-bold uppercase mb-2">Trend</div>
          {trend !== null ? (
            <>
              <div className={`text-3xl font-black ${trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                {trend > 0 ? '+' : ''}{trend}
              </div>
              <div className="text-xs text-slate-400">son 2 revizyon</div>
            </>
          ) : (
            <>
              <div className="text-3xl font-black text-slate-300">—</div>
              <div className="text-xs text-slate-400">yeterli veri yok</div>
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <div className="text-xs text-slate-400 font-bold uppercase mb-2">İlk Değerlendirme</div>
          <div className="text-sm font-black text-slate-900">{assessments[0].assessment_date}</div>
          <div className="text-xs text-slate-400 mt-1">Son: {latest.assessment_date}</div>
        </div>
      </div>

      {/* Skor trendi grafiği (manuel bar chart) */}
      {completed.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
          <div className="font-black text-slate-900 mb-6">📈 Skor Trendi</div>
          <div className="flex items-end gap-4 h-40">
            {completed.map((a, i) => {
              const score = a.total_score || 0
              const meta = a.risk_level ? RISK_META[a.risk_level as keyof typeof RISK_META] : null
              const height = Math.max((score / 100) * 140, 8)
              return (
                <div key={a.id} className="flex-1 flex flex-col items-center gap-2">
                  <div className="text-xs font-black text-slate-600">{score}</div>
                  <div className="w-full rounded-t-lg transition-all"
                    style={{ height: `${height}px`, background: meta?.color || '#94a3b8' }} />
                  <div className="text-xs text-slate-400 text-center">
                    <div className="font-bold text-purple-600">R{a.revision_number}</div>
                    <div>{a.assessment_date}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Boyut karşılaştırma tablosu */}
      {completed.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-6">
          <div className="p-5 border-b border-slate-100">
            <div className="font-black text-slate-900">📊 Boyut Karşılaştırması</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Boyut</th>
                  {completed.map(a => (
                    <th key={a.id} className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase">
                      <div className="text-purple-600">R{a.revision_number}</div>
                      <div>{a.assessment_date}</div>
                    </th>
                  ))}
                  {completed.length >= 2 && (
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase">
                      Değişim
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {DIMENSIONS.map((dim, i) => {
                  const key = dimKeys[i]
                  const scores = completed.map(a => a[key] ?? 0)
                  const change = scores.length >= 2
                    ? Math.round(scores[scores.length - 1] - scores[scores.length - 2])
                    : null
                  return (
                    <tr key={dim.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full"
                            style={{ background: dim.color }} />
                          <span className="font-medium text-slate-700 text-xs">{dim.name}</span>
                        </div>
                      </td>
                      {scores.map((score, j) => (
                        <td key={j} className="px-4 py-3 text-center">
                          <div className="font-black text-sm" style={{ color: dim.color }}>
                            {Math.round(score)}
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1">
                            <div className="h-full rounded-full"
                              style={{ width: `${score}%`, background: dim.color }} />
                          </div>
                        </td>
                      ))}
                      {change !== null && (
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-black px-2 py-1 rounded-full ${
                            change > 0
                              ? 'bg-green-100 text-green-700'
                              : change < 0
                              ? 'bg-red-100 text-red-600'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {change > 0 ? '+' : ''}{change}
                          </span>
                        </td>
                      )}
                    </tr>
                  )
                })}
                {/* Toplam satırı */}
                <tr className="bg-slate-50 font-black">
                  <td className="px-4 py-3 text-xs font-black text-slate-600 uppercase">
                    Toplam
                  </td>
                  {completed.map(a => {
                    const meta = a.risk_level ? RISK_META[a.risk_level as keyof typeof RISK_META] : null
                    return (
                      <td key={a.id} className="px-4 py-3 text-center">
                        <div className="font-black text-sm" style={{ color: meta?.color }}>
                          {a.total_score}
                        </div>
                        {meta && (
                          <div className="text-xs font-bold" style={{ color: meta.color }}>
                            {meta.label}
                          </div>
                        )}
                      </td>
                    )
                  })}
                  {completed.length >= 2 && (
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-black px-2 py-1 rounded-full ${
                        trend && trend > 0
                          ? 'bg-green-100 text-green-700'
                          : trend && trend < 0
                          ? 'bg-red-100 text-red-600'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {trend !== null ? (trend > 0 ? '+' : '') + trend : '—'}
                      </span>
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tüm revizyonlar listesi */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <div className="font-black text-slate-900">🗂️ Tüm Revizyonlar</div>
        </div>
        <div className="divide-y divide-slate-50">
          {[...assessments].reverse().map(a => {
            const meta = a.risk_level ? RISK_META[a.risk_level as keyof typeof RISK_META] : null
            return (
              <div key={a.id} className="px-5 py-4 flex justify-between items-center hover:bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl border border-slate-200 bg-white
                    flex items-center justify-center">
                    <span className="text-xs font-black text-purple-600">R{a.revision_number}</span>
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{a.assessment_date}</div>
                    {a.notes && <div className="text-xs text-slate-400 mt-0.5">{a.notes}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {a.status === 'completed' && (
                    <div className="text-right">
                      <div className="font-black text-slate-900">{a.total_score}</div>
                      <div className="text-xs text-slate-400">/ 100</div>
                    </div>
                  )}
                  {meta ? (
                    <span style={{ background: meta.bg, color: meta.color }}
                      className="px-3 py-1 rounded-full text-xs font-bold">
                      {meta.label}
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-bold
                      bg-slate-100 text-slate-500">Taslak</span>
                  )}
                  <Link
                    href={a.status === 'completed'
                      ? `/dashboard/assessments/${a.id}/result`
                      : `/dashboard/assessments/${a.id}`}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5
                      rounded-lg text-xs font-bold transition">
                    {a.status === 'completed' ? 'Raporu Gör' : 'Devam Et'}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
