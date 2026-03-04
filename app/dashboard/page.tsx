'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { RISK_META } from '@/lib/scoring'

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

  const completed = assessments.filter(a => a.status === 'completed')
  const drafts = assessments.filter(a => a.status === 'draft')
  const avgScore = completed.length > 0
    ? Math.round(completed.reduce((t, a) => t + a.total_score, 0) / completed.length)
    : 0

  const riskCounts = {
    strong: completed.filter(a => a.risk_level === 'strong').length,
    moderate: completed.filter(a => a.risk_level === 'moderate').length,
    risk: completed.filter(a => a.risk_level === 'risk').length,
    critical: completed.filter(a => a.risk_level === 'critical').length,
  }

  return (
    <div className="p-8">
      {/* Başlık */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Genel Bakış</h1>
          <p className="text-slate-500 text-sm mt-1">IFSC Index değerlendirme özeti</p>
        </div>
        <Link href="/dashboard/assessments/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition shadow-sm">
          + Yeni Değerlendirme
        </Link>
      </div>

      {/* İstatistik kartları */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Toplam Değerlendirme', val: assessments.length, icon: '📋', color: 'blue' },
          { label: 'Tamamlanan', val: completed.length, icon: '✅', color: 'green' },
          { label: 'Taslak', val: drafts.length, icon: '📝', color: 'yellow' },
          { label: 'Ortalama Skor', val: avgScore, icon: '🎯', color: 'purple' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className="text-2xl mb-3">{c.icon}</div>
            <div className="text-3xl font-black text-slate-900">{c.val}</div>
            <div className="text-sm text-slate-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Risk dağılımı */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {(Object.entries(riskCounts) as [keyof typeof RISK_META, number][]).map(([key, count]) => {
          const meta = RISK_META[key]
          return (
            <div key={key} style={{ background: meta.bg, borderColor: meta.border }}
              className="rounded-2xl p-4 border">
              <div className="text-2xl font-black" style={{ color: meta.color }}>{count}</div>
              <div className="text-sm font-bold mt-1" style={{ color: meta.color }}>{meta.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">değerlendirme</div>
            </div>
          )
        })}
      </div>

      {/* Son değerlendirmeler */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <h2 className="font-bold text-slate-900">Son Değerlendirmeler</h2>
          <Link href="/dashboard/assessments" className="text-blue-600 text-sm font-semibold hover:underline">
            Tümünü Gör →
          </Link>
        </div>
        <div className="divide-y divide-slate-50">
          {assessments.slice(0, 5).map(a => {
            const meta = a.risk_level ? RISK_META[a.risk_level as keyof typeof RISK_META] : null
            return (
              <div key={a.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-lg">🏭</div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{a.facility_name}</div>
                    <div className="text-xs text-slate-400">{a.assessment_date}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {a.status === 'completed' && (
                    <div className="text-right">
                      <div className="text-xl font-black text-slate-900">{a.total_score}</div>
                      <div className="text-xs text-slate-400">/ 100</div>
                    </div>
                  )}
                  {meta && (
                    <span style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}
                      className="px-3 py-1 rounded-full text-xs font-bold border">
                      {meta.label}
                    </span>
                  )}
                  {a.status === 'draft' && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                      Taslak
                    </span>
                  )}
                  <Link href={`/dashboard/assessments/${a.id}`}
                    className="text-blue-600 text-xs font-bold hover:underline">
                    {a.status === 'draft' ? 'Devam Et' : 'Görüntüle'}
                  </Link>
                </div>
              </div>
            )
          })}
          {assessments.length === 0 && !loading && (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">📋</div>
              <div className="text-slate-500 font-medium">Henüz değerlendirme yok</div>
              <Link href="/dashboard/assessments/new"
                className="inline-block mt-3 text-blue-600 font-bold text-sm hover:underline">
                İlk değerlendirmeyi başlat →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
