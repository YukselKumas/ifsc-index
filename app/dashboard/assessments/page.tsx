'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { RISK_META } from '@/lib/scoring'

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expandedFacilities, setExpandedFacilities] = useState<Set<string>>(new Set())

  useEffect(() => {
    supabase.from('assessments')
      .select('*')
      .order('facility_name', { ascending: true })
      .then(({ data }) => data && setAssessments(data))
  }, [])

  const groupedByFacility = assessments.reduce<Record<string, any[]>>((acc, a) => {
    const key = a.facility_name
    if (!acc[key]) acc[key] = []
    acc[key].push(a)
    return acc
  }, {})

  const facilityGroups = Object.entries(groupedByFacility).map(([name, items]) => {
    const sorted = [...items].sort((a, b) => b.revision_number - a.revision_number)
    return { name, latest: sorted[0], all: sorted }
  })

  const filtered = facilityGroups
    .filter(g => search === '' || g.name.toLowerCase().includes(search.toLowerCase()))
    .filter(g => {
      if (filter === 'all') return true
      if (filter === 'draft') return g.latest.status === 'draft'
      if (filter === 'completed') return g.latest.status === 'completed'
      return g.latest.risk_level === filter
    })

  function toggleExpand(name: string) {
    setExpandedFacilities(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Değerlendirmeler</h1>
          <p className="text-slate-500 text-sm mt-1">
            {facilityGroups.length} firma · {assessments.length} toplam değerlendirme
          </p>
        </div>
        <Link href="/dashboard/assessments/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl
            text-sm font-bold transition">
          + Yeni Değerlendirme
        </Link>
      </div>

      {/* Filtreler */}
      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Firma adı ara..."
          className="border border-slate-200 rounded-xl px-4 py-2 text-sm
            focus:outline-none focus:border-blue-400 w-56" />
        <div className="flex gap-2 flex-wrap">
          {[
            ['all','Tümü'], ['draft','Taslak'], ['completed','Tamamlanan'],
            ['strong','Güçlü'], ['moderate','Orta'], ['risk','Risk'], ['critical','Kritik']
          ].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition
                ${filter === val
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {filtered.map(({ name, latest, all }) => {
          const meta = latest.risk_level
            ? RISK_META[latest.risk_level as keyof typeof RISK_META]
            : null
          const isExpanded = expandedFacilities.has(name)
          const hasMultiple = all.length > 1

          return (
            <div key={name} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">

              {/* Ana satır */}
              <div className="px-5 py-4 flex items-center gap-4">

                {/* Sol: ikon + firma bilgisi */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center
                    justify-center text-lg flex-shrink-0">🏭</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">{name}</span>
                      {latest.revision_number > 1 && (
                        <span className="text-xs bg-purple-100 text-purple-700 font-bold
                          px-2 py-0.5 rounded-full">
                          R{latest.revision_number}
                        </span>
                      )}
                      {hasMultiple && (
                        <span className="text-xs bg-blue-50 text-blue-500 font-bold
                          px-2 py-0.5 rounded-full">
                          {all.length} revizyon
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 truncate">
                      {latest.facility_type && <span>{latest.facility_type}</span>}
                      {latest.facility_type && <span className="mx-1">·</span>}
                      <span>{latest.assessment_date}</span>
                    </div>
                  </div>
                </div>

                {/* Orta: skor + progress */}
                <div className="flex items-center gap-3 w-48 flex-shrink-0">
                  {latest.status === 'completed' ? (
                    <>
                      <div className="text-right w-12">
                        <div className="text-xl font-black text-slate-900">
                          {latest.total_score}
                        </div>
                        <div className="text-xs text-slate-400">/ 100</div>
                      </div>
                      <div className="flex-1">
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{
                              width: `${latest.total_score}%`,
                              background: meta?.color || '#94a3b8'
                            }} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-400 italic">Henüz tamamlanmadı</div>
                  )}
                </div>

                {/* Sağ: risk badge + sabit butonlar */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Risk badge */}
                  <div className="w-20 text-center">
                    {meta ? (
                      <span style={{ background: meta.bg, color: meta.color }}
                        className="px-2.5 py-1 rounded-full text-xs font-bold inline-block">
                        {meta.label}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold
                        bg-slate-100 text-slate-500 inline-block">
                        Taslak
                      </span>
                    )}
                  </div>

                  {/* Ana aksiyon */}
                  <Link
                    href={latest.status === 'completed'
                      ? `/dashboard/assessments/${latest.id}/result`
                      : `/dashboard/assessments/${latest.id}`}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition w-28 text-center
                      ${latest.status === 'completed'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-amber-500 hover:bg-amber-600 text-white'}`}>
                    {latest.status === 'completed' ? '📊 Raporu Gör' : '✏️ Devam Et'}
                  </Link>

                  {/* Tarihçe */}
                  <Link
                    href={`/dashboard/facilities/${latest.facility_id || latest.id}`}
                    className="border border-slate-200 hover:bg-slate-50 text-slate-600
                      px-3 py-2 rounded-xl text-xs font-bold transition w-24 text-center">
                    🕐 Tarihçe
                  </Link>

                  {/* Revizyon aç/kapat */}
                  <div className="w-8">
                    {hasMultiple && (
                      <button onClick={() => toggleExpand(name)}
                        className="w-8 h-8 border border-slate-200 hover:bg-slate-50
                          rounded-xl text-xs font-bold transition flex items-center
                          justify-center text-slate-500">
                        {isExpanded ? '▲' : '▼'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Revizyon geçmişi */}
              {isExpanded && hasMultiple && (
                <div className="border-t border-slate-100 bg-slate-50/80">
                  {all.slice(1).map((a, idx) => {
                    const aMeta = a.risk_level
                      ? RISK_META[a.risk_level as keyof typeof RISK_META]
                      : null
                    return (
                      <div key={a.id}
                        className="px-5 py-3 flex items-center gap-4
                          border-b border-slate-100 last:border-0 hover:bg-white/60 transition">

                        {/* Sol */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 bg-white border border-slate-200
                            rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-black text-purple-500">
                              R{a.revision_number}
                            </span>
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-600">
                              {a.assessment_date}
                            </div>
                            {a.notes && (
                              <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">
                                {a.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Orta: skor */}
                        <div className="flex items-center gap-3 w-48 flex-shrink-0">
                          {a.status === 'completed' ? (
                            <>
                              <div className="text-right w-12">
                                <div className="text-sm font-black text-slate-700">
                                  {a.total_score}
                                </div>
                                <div className="text-xs text-slate-400">/ 100</div>
                              </div>
                              <div className="flex-1">
                                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full"
                                    style={{
                                      width: `${a.total_score}%`,
                                      background: aMeta?.color || '#94a3b8'
                                    }} />
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-slate-400 italic">Taslak</div>
                          )}
                        </div>

                        {/* Sağ */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-20 text-center">
                            {aMeta ? (
                              <span style={{ background: aMeta.bg, color: aMeta.color }}
                                className="px-2 py-0.5 rounded-full text-xs font-bold inline-block">
                                {aMeta.label}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold
                                bg-slate-100 text-slate-500 inline-block">Taslak</span>
                            )}
                          </div>
                          <Link
                            href={a.status === 'completed'
                              ? `/dashboard/assessments/${a.id}/result`
                              : `/dashboard/assessments/${a.id}`}
                            className="px-4 py-2 rounded-xl text-xs font-bold transition
                              w-28 text-center border border-slate-200 hover:bg-slate-100
                              text-slate-600">
                            {a.status === 'completed' ? '📊 Raporu Gör' : '✏️ Devam Et'}
                          </Link>
                          <div className="w-24" />
                          <div className="w-8" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-slate-500 font-medium">Sonuç bulunamadı</div>
          </div>
        )}
      </div>
    </div>
  )
}
