'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DIMENSIONS, ALL_CRITERIA, EVIDENCE_TYPE_LABELS } from '@/lib/criteria'
import { calcScores, calcRiskLevel, DEFAULT_RISK_CONFIG, RISK_META } from '@/lib/scoring'
import toast from 'react-hot-toast'

export default function AssessmentFormPage() {
  const { id } = useParams()
  const router = useRouter()
  const [assessment, setAssessment] = useState<any>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [evidenceTypes, setEvidenceTypes] = useState<Record<string, string>>({})
  const [evidenceFiles, setEvidenceFiles] = useState<Record<string, File | null>>({})
  const [activeTab, setActiveTab] = useState('D1')
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState(DEFAULT_RISK_CONFIG)
  const [weights, setWeights] = useState({ w1: 0.25, w2: 0.25, w3: 0.25, w4: 0.25 })

  useEffect(() => {
    async function load() {
      const { data: a } = await supabase.from('assessments').select('*').eq('id', id).single()
      if (a) {
        setAssessment(a)
        setWeights({ w1: a.w1, w2: a.w2, w3: a.w3, w4: a.w4 })
      }
      const { data: s } = await supabase.from('scores').select('*').eq('assessment_id', id)
      if (s) {
        const sm: Record<string, number> = {}
        const nm: Record<string, string> = {}
        const em: Record<string, string> = {}
        s.forEach((row: any) => {
          sm[row.criterion_id] = row.score
          nm[row.criterion_id] = row.note || ''
          em[row.criterion_id] = row.evidence_type || ''
        })
        setScores(sm)
        setNotes(nm)
        setEvidenceTypes(em)
      }
      // Admin config
      const { data: cfg } = await supabase.from('tenants').select('*').limit(1).single()
      if (cfg?.risk_config) setConfig(cfg.risk_config)
    }
    load()
  }, [id])

  const { dimScores, total } = calcScores(scores, weights)
  const riskLevel = calcRiskLevel(total, config)
  const riskMeta = RISK_META[riskLevel]
  const answeredCount = Object.keys(scores).length
  const allAnswered = answeredCount === 20

  async function saveScore(criterionId: string, dimensionId: string, score: number) {
    const newScores = { ...scores, [criterionId]: score }
    setScores(newScores)
    const { dimScores: ds, total: t } = calcScores(newScores, weights)
    const rl = calcRiskLevel(t, config)

    await supabase.from('scores').upsert({
      assessment_id: id,
      criterion_id: criterionId,
      dimension_id: dimensionId,
      score,
      note: notes[criterionId] || null,
      evidence_type: evidenceTypes[criterionId] || null,
    }, { onConflict: 'assessment_id,criterion_id' })

    await supabase.from('assessments').update({
      total_score: t,
      d1_score: ds['D1'],
      d2_score: ds['D2'],
      d3_score: ds['D3'],
      d4_score: ds['D4'],
      risk_level: rl,
    }).eq('id', id)
  }

  async function saveNote(criterionId: string, dimensionId: string) {
    await supabase.from('scores').upsert({
      assessment_id: id,
      criterion_id: criterionId,
      dimension_id: dimensionId,
      score: scores[criterionId] ?? 0,
      note: notes[criterionId] || null,
      evidence_type: evidenceTypes[criterionId] || null,
    }, { onConflict: 'assessment_id,criterion_id' })
  }

  async function uploadEvidence(criterionId: string, file: File) {
    const ext = file.name.split('.').pop()
    const path = `${id}/${criterionId}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('evidences').upload(path, file)
    if (upErr) { toast.error('Dosya yüklenemedi'); return }
    const { data: { publicUrl } } = supabase.storage.from('evidences').getPublicUrl(path)
    await supabase.from('evidences').insert({
      assessment_id: id,
      criterion_id: criterionId,
      file_name: file.name,
      file_url: publicUrl,
      file_type: file.type,
    })
    toast.success('Kanıt yüklendi!')
  }
async function saveWeights() {
  await supabase.from('assessments').update({
    w1: weights.w1, w2: weights.w2, w3: weights.w3, w4: weights.w4
  }).eq('id', id)
  toast.success('Ağırlıklar kaydedildi!')
}
  async function complete() {
    if (!allAnswered) { toast.error('Tüm kriterleri puanlayın'); return }
    setSaving(true)
    const highScores = Object.entries(scores).filter(([, v]) => v >= 4)
    for (const [cid] of highScores) {
      const { data: evs } = await supabase.from('evidences')
        .select('id').eq('assessment_id', id).eq('criterion_id', cid)
      if (!evs || evs.length === 0) {
        const crit = ALL_CRITERIA.find(c => c.id === cid)
        toast.error(`"${crit?.name}" için kanıt yükleyin (puan ≥ 4)`)
        setSaving(false)
        return
      }
    }
    await supabase.from('assessments').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', id)
    toast.success('Değerlendirme tamamlandı!')
    router.push(`/dashboard/assessments/${id}/result`)
  }

  if (!assessment) return <div className="p-8 text-slate-400">Yükleniyor...</div>

  const activeDim = DIMENSIONS.find(d => d.id === activeTab)!

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sol panel */}
      <div className="w-64 bg-white border-r border-slate-100 flex flex-col overflow-y-auto">
        {/* Tesis bilgisi */}
        <div className="p-4 border-b border-slate-100">
          <div className="text-xs text-slate-400 mb-1">DEĞERLENDİRME</div>
          <div className="font-bold text-slate-900 text-sm">{assessment.facility_name}</div>
          <div className="text-xs text-slate-400">{assessment.assessment_date}</div>
        </div>

        {/* Anlık skor */}
        <div className="p-4 border-b border-slate-100">
          <div className="text-xs text-slate-400 mb-2">ANLIK SKOR</div>
          <div className="text-3xl font-black" style={{ color: riskMeta.color }}>{total}</div>
          <div className="text-xs text-slate-400">/ 100 puan</div>
          <div className="mt-2 h-2 bg-slate-100 rounded-full">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${total}%`, background: riskMeta.color }} />
          </div>
          <div className="mt-2">
            <span style={{ background: riskMeta.bg, color: riskMeta.color, borderColor: riskMeta.border }}
              className="px-2 py-0.5 rounded-full text-xs font-bold border">
              {riskMeta.label}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400">{answeredCount}/20 kriter</div>
        </div>

{/* Ağırlık ayarı */}
<div className="p-3 border-b border-slate-100">
  <div className="text-xs font-bold text-slate-400 uppercase mb-2">BOYUT AĞIRLIKLARI</div>
  {DIMENSIONS.map((dim, i) => {
    const key = `w${i + 1}` as keyof typeof weights
    const pct = Math.round(weights[key] * 100)
    return (
      <div key={dim.id} className="mb-2">
        <div className="flex justify-between text-xs mb-0.5">
          <span className="text-slate-500">{dim.name}</span>
          <span className="font-bold" style={{ color: dim.color }}>%{pct}</span>
        </div>
        <input type="range" min={5} max={60} step={5}
          value={pct}
          onChange={e => {
            const val = parseInt(e.target.value) / 100
            setWeights(w => ({ ...w, [key]: val }))
          }}
          className="w-full h-1 accent-blue-600"
        />
      </div>
    )
  })}
  <div className={`text-xs font-bold text-center py-1 rounded-lg mt-1
    ${Math.round((weights.w1+weights.w2+weights.w3+weights.w4)*100) === 100
      ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
    Toplam: %{Math.round((weights.w1+weights.w2+weights.w3+weights.w4)*100)}
    <button onClick={saveWeights}
  className="w-full mt-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1 rounded-lg text-xs transition">
  Kaydet
</button>
  </div>
</div>
        
        {/* Boyut sekmeleri */}
        
        <div className="p-3 space-y-1">
          {DIMENSIONS.map(dim => {
            const dimCriteria = dim.criteria
            const dimAnswered = dimCriteria.filter(c => scores[c.id] !== undefined).length
            const dimScore = Math.round(dimScores[dim.id] || 0)
            return (
              <button key={dim.id} onClick={() => setActiveTab(dim.id)}
                style={activeTab === dim.id ? { background: dim.bg, borderColor: dim.color, color: dim.color } : {}}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition border
                  ${activeTab === dim.id ? 'font-bold' : 'border-transparent text-slate-600 hover:bg-slate-50'}`}>
                <div className="flex justify-between items-center">
                  <span>{dim.name}</span>
                  <span className="font-bold">{dimScore}</span>
                </div>
                <div className="flex justify-between mt-1 opacity-70">
                  <span>{dimAnswered}/5 kriter</span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Tamamla butonu */}
        <div className="p-3 mt-auto border-t border-slate-100">
          <button onClick={complete} disabled={!allAnswered || saving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition disabled:opacity-40">
            {saving ? 'Kaydediliyor...' : '✅ Tamamla ve Sonucu Gör'}
          </button>
          {!allAnswered && (
            <div className="text-xs text-slate-400 text-center mt-1">
              {20 - answeredCount} kriter kaldı
            </div>
          )}
        </div>
      </div>

      {/* Ana içerik */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ background: activeDim.bg }}>
            {activeTab === 'D1' ? '🏗️' : activeTab === 'D2' ? '💪' : activeTab === 'D3' ? '🧠' : '⭐'}
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">{activeDim.name}</h2>
            <p className="text-xs text-slate-400">5 kriter · her biri 0-5 puan</p>
          </div>
        </div>

        <div className="space-y-4">
          {activeDim.criteria.map((criterion, idx) => {
            const score = scores[criterion.id]
            const hasScore = score !== undefined
            const needsEvidence = hasScore && score >= 4
            return (
              <div key={criterion.id}
                style={{ borderColor: hasScore ? activeDim.color : '#e2e8f0' }}
                className="bg-white rounded-2xl border-2 p-5 transition-colors">
                {/* Kriter başlık */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-400">{criterion.id}</span>
                      {needsEvidence && (
                        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">
                          ⚠️ Kanıt Zorunlu
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm leading-snug">{criterion.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{criterion.description}</p>
                  </div>
                  {hasScore && (
                    <div className="ml-4 text-right">
                      <div className="text-2xl font-black" style={{ color: activeDim.color }}>{score}</div>
                      <div className="text-xs text-slate-400">/ 5</div>
                    </div>
                  )}
                </div>

                {/* Puan seçimi */}
                <div className="flex gap-2 mb-3">
                  {[0, 1, 2, 3, 4, 5].map(v => (
                    <button key={v}
                      onClick={() => saveScore(criterion.id, activeDim.id, v)}
                      style={score === v ? { background: activeDim.color, color: '#fff', borderColor: activeDim.color } : {}}
                      className={`w-10 h-10 rounded-xl font-black text-sm border-2 transition
                        ${score === v ? '' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      {v}
                    </button>
                  ))}
                </div>

                {/* Kanıt tipi + not */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Kanıt Türü</label>
                    <select
                      value={evidenceTypes[criterion.id] || ''}
                      onChange={e => {
                        setEvidenceTypes(p => ({ ...p, [criterion.id]: e.target.value }))
                        saveNote(criterion.id, activeDim.id)
                      }}
                      className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-400">
                      <option value="">Seçiniz</option>
                      {criterion.evidence_types.map(et => (
                        <option key={et} value={et}>{EVIDENCE_TYPE_LABELS[et]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Not</label>
                    <input
                      value={notes[criterion.id] || ''}
                      onChange={e => setNotes(p => ({ ...p, [criterion.id]: e.target.value }))}
                      onBlur={() => saveNote(criterion.id, activeDim.id)}
                      placeholder="Gözlem notu..."
                      className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-400"
                    />
                  </div>
                </div>

                {/* Dosya yükleme */}
                <div className="mt-3">
                  <label className="text-xs font-bold text-slate-400 uppercase block mb-1">
                    Kanıt Dosyası {needsEvidence ? <span className="text-orange-500">*</span> : ''}
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                    onChange={async e => {
                      const file = e.target.files?.[0]
                      if (file) await uploadEvidence(criterion.id, file)
                    }}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
