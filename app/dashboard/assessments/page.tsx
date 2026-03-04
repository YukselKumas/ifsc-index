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

      <div className="flex gap-3 mb-6 flex-wrap">
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

      <div className="space-y-3">
        {filtered.map(({ name, latest, all }) => {
          const meta = latest.risk_level
            ? RISK_META[latest.risk_level as keyof typeof RISK_META]
            : null
          const isExpanded = expandedFacilities.has(name)
          const hasMultiple = all.length > 1

          return (
            <div key={name} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="p-5 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center
                    justify-center text-2xl">🏭</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-slate-900">{name}</div>
                      {latest.revision_number > 1 && (
                        <span className="text-xs bg-purple-100 text-purple-700 font-bold
                          px-2 py-0.5 rounded-full">
                          R{latest.revision_number}
                        </span>
                      )}
                      {hasMultiple && (
                        <span className="text-xs bg-slate-100 text-slate-500 font-bold
                          px-2 py-0.5 rounded-full">
                          {all.length} değerlendirme
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-400 mt-0.5 flex items-center gap-2">
                      {latest.facility_type && <span>{latest.facility_type}</span>}
                      <span>·</span>
                      <span>{latest.assessment_date}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {latest.status === 'completed' && (
                    <>
                      <div className="text-center">
                        <div className="text-2xl font-black text-slate-900">
                          {latest.total_score}
                        </div>
                        <div className="text-xs text-slate-400">/ 100</div>
                      </div>
                      <div className="w-20">
                        <div className="h-2 bg-slate-100 rounded-full">
                          <div className="h-full rounded-full"
                            style={{
                              width: `${latest.total_score}%`,
                              background: meta?.color || '#94a3b8'
                            }} />
                        </div>
                      </div>
                    </>
                  )}

                  {meta ? (
                    <span style={{
                      background: meta.bg,
                      color: meta.color,
                      borderColor: meta.border
                    }} className="px-3 py-1 rounded-full text-xs font-bold border">
                      {meta.label}
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-bold
                      bg-slate-100 text-slate-500 border border-slate-200">
                      Taslak
                    </span>
                  )}

                  <Link
                    href={latest.status === 'completed'
                      ? `/dashboard/assessments/${latest.id}/result`
                      : `/dashboard/assessments/${latest.id}`}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2
                      rounded-xl text-xs font-bold transition">
                    {latest.status === 'completed' ? '📊 Raporu Gör' : '✏️ Devam Et'}
                  </Link>

                  <Link
                    href={`/dashboard/facilities/${latest.facility_id || latest.id}`}
                    className="border border-slate-200 hover:bg-slate-50 text-slate-600
                      px-3 py-2 rounded-xl text-xs font-bold transition">
                    🕐 Tarihçe
                  </Link>

                  {hasMultiple && (
                    <button onClick={() => toggleExpand(name)}
                      className="border border-slate-200 hover:bg-slate-50 text-slate-600
                        w-9 h-9 rounded-xl text-xs font-bold transition flex items-center
                        justify-center">
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && hasMultiple && (
                <div className="border-t border-slate-100 bg-slate-50">
                  {all.slice(1).map(a => {
                    const aMeta = a.risk_level
                      ? RISK_META[a.risk_level as keyof typeof RISK_META]
                      : null
                    return (
                      <div key={a.id}
                        className="px-5 py-3 flex justify-between items-center
                          border-b border-slate-100 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white border border-slate-200
                            rounded-lg flex items-center justify-center">
                            <span className="text-xs font-black text-slate-400">
                              R{a.revision_number}
                            </span>
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-600">
                              {a.assessment_date}
                            </div>
                            {a.notes && (
                              <div className="text-xs text-slate-400">{a.notes}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {a.status === 'completed' && (
                            <div className="text-sm font-black text-slate-700">
                              {a.total_score}
                              <span className="text-xs font-normal text-slate-400"> / 100</span>
                            </div>
                          )}
                          {aMeta ? (
                            <span style={{ background: aMeta.bg, color: aMeta.color }}
                              className="px-2 py-0.5 rounded-full text-xs font-bold">
                              {aMeta.label}
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
                            Görüntüle →
                          </Link>
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
