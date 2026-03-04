'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { RISK_META } from '@/lib/scoring'

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.from('assessments')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => data && setAssessments(data))
  }, [])

  const filtered = assessments
    .filter(a => filter === 'all' || a.status === filter || a.risk_level === filter)
    .filter(a => a.facility_name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Değerlendirmeler</h1>
          <p className="text-slate-500 text-sm mt-1">Tüm IFSC değerlendirme kayıtları</p>
        </div>
        <Link href="/dashboard/assessments/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition">
          + Yeni Değerlendirme
        </Link>
      </div>

      {/* Filtre ve arama */}
      <div className="flex gap-3 mb-6">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tesis adı ara..."
          className="border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-400 w-64"
        />
        <div className="flex gap-2">
          {[
            ['all', 'Tümü'],
            ['draft', 'Taslak'],
            ['completed', 'Tamamlanan'],
            ['strong', 'Güçlü'],
            ['moderate', 'Orta'],
            ['risk', 'Risk'],
            ['critical', 'Kritik'],
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
      <div className="space-y-3">
        {filtered.map(a => {
          const meta = a.risk_level ? RISK_META[a.risk_level as keyof typeof RISK_META] : null
          const pct = a.total_score || 0
          const isCompleted = a.status === 'completed'

          return (
            <div key={a.id}
              className="bg-white rounded-2xl border border-slate-100 p-5 flex justify-between items-center hover:shadow-sm transition">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-2xl">🏭</div>
                <div>
                  <div className="font-bold text-slate-900">{a.facility_name}</div>
                  <div className="text-sm text-slate-400 mt-0.5">
                    {a.facility_type && <span className="mr-2">{a.facility_type}</span>}
                    {a.assessment_date}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-5">
                {isCompleted && (
                  <>
                    <div className="text-center">
                      <div className="text-2xl font-black text-slate-900">{a.total_score}</div>
                      <div className="text-xs text-slate-400">/ 100 puan</div>
                    </div>
                    <div className="w-24">
                      <div className="h-2 bg-slate-100 rounded-full">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: meta?.color || '#94a3b8' }} />
                      </div>
                    </div>
                  </>
                )}

                {meta ? (
                  <span style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}
                    className="px-3 py-1 rounded-full text-xs font-bold border">
                    {meta.label}
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                    Taslak
                  </span>
                )}

                <Link
                  href={isCompleted
                    ? `/dashboard/assessments/${a.id}/result`
                    : `/dashboard/assessments/${a.id}`}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition">
                  {isCompleted ? '📊 Raporu Gör' : '✏️ Devam Et'}
                </Link>
              </div>
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
