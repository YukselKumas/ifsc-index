'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { RISK_META } from '@/lib/scoring'
import Link from 'next/link'

export default function DashboardPage() {
  const [assessments, setAssessments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('assessments')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setAssessments(data)
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="p-8 text-slate-400">Yükleniyor...</div>

  const completed = assessments.filter(a => a.status === 'completed')
  const drafts = assessments.filter(a => a.status === 'draft')

  // Firma bazında grupla
  const facilityMap = new Map<string, any[]>()
  assessments.forEach(a => {
    const key = a.facility_name
    if (!facilityMap.has(key)) facilityMap.set(key, [])
    facilityMap.get(key)!.push(a)
  })
  const totalFacilities = facilityMap.size

  // Risk dağılımı
  const riskCounts = { strong: 0, moderate: 0, risk: 0, critical: 0 }
  completed.forEach(a => {
    if (a.risk_level && riskCounts[a.risk_level as keyof typeof riskCounts] !== undefined)
      riskCounts[a.risk_level as keyof typeof riskCounts]++
  })

  // Ortalama skor
  const avgScore = completed.length
    ? Math.round(completed.reduce((s, a) => s + (a.total_score || 0), 0) / completed.length)
    : 0

  // Revizyon trendi olan firmalar (2+ tamamlanmış değerlendirme)
  const trendFacilities: any[] = []
  facilityMap.forEach((items, name) => {
    const comp = items.filter(a => a.status === 'completed')
      .sort((a, b) => a.revision_number - b.revision_number)
    if (comp.length >= 2) {
      const first = comp[0].total_score
      const last = comp[comp.length - 1].total_score
      const change = last - first
      trendFacilities.push({
        name,
        facility_id: comp[0].facility_id,
        revisions: comp.length,
        firstScore: first,
        lastScore: last,
        change,
        lastRisk: comp[comp.length - 1].risk_level,
        lastRevision: comp[comp.length - 1].revision_number,
      })
    }
  })
  trendFacilities.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))

  // Son 5 değerlendirme
  const recentAssessments = [...assessments].slice(0, 5)

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900">Genel Bakış</h1>
        <p className="text-slate-500 text-sm mt-1">IFSC Index sistemi özeti</p>
      </div>

      {/* Üst istatistik kartları */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="text-xs text-slate-400 font-bold uppercase mb-3">Toplam Firma</div>
          <div className="text-4xl font-black text-slate-900">{totalFacilities}</div>
          <div className="text-xs text-slate-400 mt-1">{assessments.length} değerlendirme</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="text-xs text-slate-400 font-bold uppercase mb-3">Tamamlanan</div>
          <div className="text-4xl font-black text-green-600">{completed.length}</div>
          <div className="text-xs text-slate-400 mt-1">{drafts.length} taslak bekliyor</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="text-xs text-slate-400 font-bold uppercase mb-3">Ortalama Skor</div>
          <div className="text-4xl font-black text-blue-600">{avgScore || '—'}</div>
          <div className="text-xs text-slate-400 mt-1">tamamlanan değerlendirmeler</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="text-xs text-slate-400 font-bold uppercase mb-3">Revizyon Takibi</div>
          <div className="text-4xl font-black text-purple-600">{trendFacilities.length}</div>
          <div className="text-xs text-slate-400 mt-1">firma 2+ revizyon</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Risk dağılımı */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="font-black text-slate-900 mb-4">Risk Dağılımı</div>
          {completed.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-4">Henüz veri yok</div>
          ) : (
            <div className="space-y-3">
              {(Object.entries(riskCounts) as [string, number][]).map(([level, count]) => {
                const meta = RISK_META[level as keyof typeof RISK_META]
                const pct = completed.length ? Math.round((count / completed.length) * 100) : 0
                return (
                  <div key={level}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold" style={{ color: meta.color }}>{meta.label}</span>
                      <span className="text-slate-400">{count} firma ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: meta.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Revizyon trendi */}
        <div className="col-span-2 bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="font-black text-slate-900">📈 Revizyon Trendi</div>
            <Link href="/dashboard/assessments"
              className="text-xs text-blue-600 font-bold hover:underline">
              Tümünü Gör →
            </Link>
          </div>
          {trendFacilities.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-8">
              <div className="text-3xl mb-2">🔄</div>
              Henüz revizyon verisi yok.
              <div className="text-xs mt-1">2+ değerlendirme olan firmalar burada görünür.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {trendFacilities.slice(0, 4).map(f => {
                const meta = f.lastRisk ? RISK_META[f.lastRisk as keyof typeof RISK_META] : null
                return (
                  <div key={f.name}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition">
                    <div className="w-9 h-9 bg-purple-50 border border-purple-100
                      rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-black text-purple-600">
                        R{f.lastRevision}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 text-sm truncate">{f.name}</div>
                      <div className="text-xs text-slate-400">
                        {f.revisions} revizyon · {f.firstScore} → {f.lastScore}
                      </div>
                    </div>
                    {/* Mini trend bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-end gap-1 h-8">
                        <div className="w-4 rounded-t"
                          style={{ height: `${Math.max((f.firstScore/100)*32, 4)}px`,
                            background: '#e2e8f0' }} />
                        <div className="w-4 rounded-t"
                          style={{ height: `${Math.max((f.lastScore/100)*32, 4)}px`,
                            background: meta?.color || '#94a3b8' }} />
                      </div>
                      <span className={`text-xs font-black px-2 py-1 rounded-full min-w-12 text-center ${
                        f.change > 0
                          ? 'bg-green-100 text-green-700'
                          : f.change < 0
                          ? 'bg-red-100 text-red-600'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {f.change > 0 ? '+' : ''}{f.change}
                      </span>
                    </div>
                    <Link href={`/dashboard/facilities/${f.facility_id}`}
                      className="text-xs text-blue-600 font-bold hover:underline flex-shrink-0">
                      Tarihçe →
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Son değerlendirmeler */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <div className="font-black text-slate-900">Son Değerlendirmeler</div>
          <Link href="/dashboard/assessments"
            className="text-xs text-blue-600 font-bold hover:underline">
            Tümünü Gör →
          </Link>
        </div>
        <div className="divide-y divide-slate-50">
          {recentAssessments.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <div className="text-3xl mb-2">📋</div>
              Henüz değerlendirme yok.
              <Link href="/dashboard/assessments/new"
                className="block mt-2 text-blue-600 font-bold text-sm hover:underline">
                İlk değerlendirmeyi başlat →
              </Link>
            </div>
          ) : (
            recentAssessments.map(a => {
              const meta = a.risk_level ? RISK_META[a.risk_level as keyof typeof RISK_META] : null
              return (
                <div key={a.id}
                  className="px-5 py-4 flex justify-between items-center hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center
                      justify-center text-lg">🏭</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-slate-800 text-sm">{a.facility_name}</div>
                        {a.revision_number > 1 && (
                          <span className="text-xs bg-purple-100 text-purple-700
                            font-bold px-2 py-0.5 rounded-full">
                            R{a.revision_number}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">{a.assessment_date}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {a.status === 'completed' && (
                      <div className="font-black text-slate-700">
                        {a.total_score}
                        <span className="text-xs font-normal text-slate-400"> / 100</span>
                      </div>
                    )}
                    {meta ? (
                      <span style={{ background: meta.bg, color: meta.color }}
                        className="px-2 py-0.5 rounded-full text-xs font-bold">
                        {meta.label}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold
                        bg-slate-100 text-slate-500">Taslak</span>
                    )}
                    <Link
                      href={a.status === 'completed'
                        ? `/dashboard/assessments/${a.id}/result`
                        : `/dashboard/assessments/${a.id}`}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700">
                      {a.status === 'completed' ? 'Raporu Gör →' : 'Devam Et →'}
                    </Link>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
