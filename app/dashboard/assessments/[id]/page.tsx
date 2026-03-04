'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DIMENSIONS } from '@/lib/criteria'
import { calcScores, calcRiskLevel, DEFAULT_RISK_CONFIG, RISK_META } from '@/lib/scoring'
import Link from 'next/link'
import toast from 'react-hot-toast'

const EVIDENCE_TYPES = [
  { value: 'document', label: 'Doküman' },
  { value: 'photo', label: 'Fotoğraf' },
  { value: 'audit', label: 'Denetim Kaydı' },
  { value: 'certificate', label: 'Sertifika' },
  { value: 'record', label: 'Kayıt/Log' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Düşük', color: '#22c55e', bg: '#f0fdf4' },
  { value: 'medium', label: 'Orta', color: '#f59e0b', bg: '#fffbeb' },
  { value: 'high', label: 'Yüksek', color: '#f97316', bg: '#fff7ed' },
  { value: 'critical', label: 'Kritik', color: '#ef4444', bg: '#fef2f2' },
]

export default function AssessmentFormPage() {
  const { id } = useParams()
  const router = useRouter()
  const [assessment, setAssessment] = useState<any>(null)
  const [scoreRows, setScoreRows] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'D1' | 'D2' | 'D3' | 'D4' | 'actions'>('D1')
  const [weights, setWeights] = useState({ w1: 25, w2: 25, w3: 25, w4: 25 })
  const [savingWeights, setSavingWeights] = useState(false)
  const [completing, setCompleting] = useState(false)

  // Aksiyon state
  const [actions, setActions] = useState<any[]>([])
  const [newAction, setNewAction] = useState({
    title: '',
    description: '',
    responsible: '',
    priority: 'medium',
    due_date: '',
  })
  const [addingAction, setAddingAction] = useState(false)
  const [savingAction, setSavingAction] = useState(false)

  useEffect(() => {
    supabase.from('assessments').select('*').eq('id', id).single()
      .then(({ data }) => {
        if (data) {
          setAssessment(data)
          setWeights({
            w1: Math.round((data.w1 || 0.25) * 100),
            w2: Math.round((data.w2 || 0.25) * 100),
            w3: Math.round((data.w3 || 0.25) * 100),
            w4: Math.round((data.w4 || 0.25) * 100),
          })
        }
      })
    supabase.from('scores').select('*').eq('assessment_id', id)
      .then(({ data }) => data && setScoreRows(data))
    supabase.from('actions').select('*').eq('assessment_id', id).order('created_at')
      .then(({ data }) => data && setActions(data))
  }, [id])

  const scoreMap: Record<string, number> = {}
  scoreRows.forEach(s => { scoreMap[s.criterion_id] = s.score })
  const { dimScores, total } = calcScores(scoreMap, {
    w1: weights.w1 / 100, w2: weights.w2 / 100,
    w3: weights.w3 / 100, w4: weights.w4 / 100
  })
  const riskLevel = calcRiskLevel(total, DEFAULT_RISK_CONFIG)
  const riskMeta = RISK_META[riskLevel]

  async function setScore(criterionId: string, score: number) {
    const existing = scoreRows.find(s => s.criterion_id === criterionId)
    if (existing) {
      await supabase.from('scores').update({ score }).eq('id', existing.id)
      setScoreRows(prev => prev.map(s => s.criterion_id === criterionId ? { ...s, score } : s))
    } else {
      const { data } = await supabase.from('scores').insert({
        assessment_id: id, criterion_id: criterionId, score
      }).select().single()
      if (data) setScoreRows(prev => [...prev, data])
    }
  }

  async function updateNote(criterionId: string, note: string) {
    const existing = scoreRows.find(s => s.criterion_id === criterionId)
    if (existing) {
      await supabase.from('scores').update({ note }).eq('id', existing.id)
      setScoreRows(prev => prev.map(s => s.criterion_id === criterionId ? { ...s, note } : s))
    }
  }

  async function updateEvidenceType(criterionId: string, evidence_type: string) {
    const existing = scoreRows.find(s => s.criterion_id === criterionId)
    if (existing) {
      await supabase.from('scores').update({ evidence_type }).eq('id', existing.id)
      setScoreRows(prev => prev.map(s => s.criterion_id === criterionId ? { ...s, evidence_type } : s))
    }
  }

  async function uploadEvidence(criterionId: string, file: File) {
    const ext = file.name.split('.').pop()
    const path = `${id}/${criterionId}.${ext}`
    const { error } = await supabase.storage.from('evidences').upload(path, file, { upsert: true })
    if (error) { toast.error('Dosya yüklenemedi'); return }
    const { data: urlData } = supabase.storage.from('evidences').getPublicUrl(path)
    const existing = scoreRows.find(s => s.criterion_id === criterionId)
    if (existing) {
      await supabase.from('scores').update({ evidence_url: urlData.publicUrl }).eq('id', existing.id)
      setScoreRows(prev => prev.map(s =>
        s.criterion_id === criterionId ? { ...s, evidence_url: urlData.publicUrl } : s
      ))
      toast.success('Dosya yüklendi')
    }
  }

  async function saveWeights() {
    const total = weights.w1 + weights.w2 + weights.w3 + weights.w4
    if (total !== 100) { toast.error(`Toplam ${total}% — 100% olmalı`); return }
    setSavingWeights(true)
    await supabase.from('assessments').update({
      w1: weights.w1 / 100, w2: weights.w2 / 100,
      w3: weights.w3 / 100, w4: weights.w4 / 100,
    }).eq('id', id)
    setSavingWeights(false)
    toast.success('Ağırlıklar kaydedildi')
  }

  async function completeAssessment() {
    const allDimensions = DIMENSIONS.every(dim =>
      dim.criteria.every(c => scoreRows.find(s => s.criterion_id === c.id))
    )
    if (!allDimensions) { toast.error('Tüm kriterler puanlanmalı'); return }
    setCompleting(true)
    const w = { w1: weights.w1/100, w2: weights.w2/100, w3: weights.w3/100, w4: weights.w4/100 }
    const { dimScores: ds, total: t } = calcScores(scoreMap, w)
    const rl = calcRiskLevel(t, DEFAULT_RISK_CONFIG)
    await supabase.from('assessments').update({
      status: 'completed', total_score: t, risk_level: rl,
      d1_score: ds.D1, d2_score: ds.D2, d3_score: ds.D3, d4_score: ds.D4,
    }).eq('id', id)
    setCompleting(false)
    toast.success('Değerlendirme tamamlandı!')
    router.push(`/dashboard/assessments/${id}/result`)
  }

  async function addAction() {
    if (!newAction.title) { toast.error('Aksiyon başlığı gerekli'); return }
    setSavingAction(true)
    const { data: authData } = await supabase.auth.getUser()
    const { data: userData } = await supabase.from('users')
      .select('tenant_id').eq('id', authData.user!.id).single()
    const { data, error } = await supabase.from('actions').insert({
      assessment_id: id,
      tenant_id: userData?.tenant_id,
      title: newAction.title,
      description: newAction.description,
      responsible: newAction.responsible,
      priority: newAction.priority,
      due_date: newAction.due_date || null,
      status: 'open',
    }).select().single()
    setSavingAction(false)
    if (error) { toast.error('Hata: ' + error.message); return }
    setActions(prev => [...prev, data])
    setNewAction({ title: '', description: '', responsible: '', priority: 'medium', due_date: '' })
    setAddingAction(false)
    toast.success('Aksiyon eklendi')
  }

  async function deleteAction(actionId: string) {
    await supabase.from('actions').delete().eq('id', actionId)
    setActions(prev => prev.filter(a => a.id !== actionId))
    toast.success('Aksiyon silindi')
  }

  async function toggleActionStatus(action: any) {
    const newStatus = action.status === 'open' ? 'done' : 'open'
    await supabase.from('actions').update({ status: newStatus }).eq('id', action.id)
    setActions(prev => prev.map(a => a.id === action.id ? { ...a, status: newStatus } : a))
  }

  if (!assessment) return <div className="p-8 text-slate-400">Yükleniyor...</div>

  const weightTotal = weights.w1 + weights.w2 + weights.w3 + weights.w4
  const activeDim = DIMENSIONS.find(d => d.id === activeTab)
  const scoredCount = scoreRows.length
  const totalCriteria = 20

  return (
    <div className="flex h-screen overflow-hidden">

      {/* Sol panel */}
      <div className="w-72 border-r border-slate-100 bg-slate-50 flex flex-col p-5 gap-4 overflow-y-auto">
        <div>
          <Link href="/dashboard/assessments"
            className="text-xs text-slate-400 hover:text-slate-600">← Geri</Link>
          <h2 className="font-black text-slate-900 mt-1 text-lg leading-tight">
            {assessment.facility_name}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{assessment.assessment_date}</p>
          {assessment.revision_number > 1 && (
            <span className="text-xs bg-purple-100 text-purple-700 font-bold
              px-2 py-0.5 rounded-full mt-1 inline-block">
              R{assessment.revision_number}
            </span>
          )}
        </div>

        {/* Skor */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 text-center">
          <div className="text-4xl font-black" style={{ color: riskMeta.color }}>{total}</div>
          <div className="text-xs text-slate-400">/ 100 puan</div>
          <div className="mt-2 px-3 py-1 rounded-full text-xs font-bold inline-block"
            style={{ background: riskMeta.bg, color: riskMeta.color }}>
            {riskMeta.label}
          </div>
          <div className="mt-3 text-xs text-slate-400">
            {scoredCount}/{totalCriteria} kriter puanlandı
          </div>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full">
            <div className="h-full rounded-full bg-blue-500"
              style={{ width: `${(scoredCount/totalCriteria)*100}%` }} />
          </div>
        </div>

        {/* Boyut skorları */}
        <div className="space-y-2">
          {DIMENSIONS.map(dim => {
            const s = Math.round(dimScores[dim.id] || 0)
            const isActive = activeTab === dim.id
            return (
              <button key={dim.id} onClick={() => setActiveTab(dim.id as any)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition ${
                  isActive
                    ? 'border-current'
                    : 'border-transparent hover:bg-white'
                }`}
                style={isActive ? { background: dim.bg, borderColor: dim.color + '60' } : {}}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold" style={{ color: dim.color }}>{dim.id}</span>
                  <span className="text-xs font-black" style={{ color: dim.color }}>{s}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{dim.name}</div>
                <div className="mt-1.5 h-1 bg-slate-200 rounded-full">
                  <div className="h-full rounded-full"
                    style={{ width: `${s}%`, background: dim.color }} />
                </div>
              </button>
            )
          })}
          {/* Aksiyonlar sekmesi */}
          <button onClick={() => setActiveTab('actions')}
            className={`w-full text-left px-3 py-2.5 rounded-xl border transition ${
              activeTab === 'actions'
                ? 'border-violet-300 bg-violet-50'
                : 'border-transparent hover:bg-white'
            }`}>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-violet-600">📋 Aksiyonlar</span>
              <span className="text-xs font-black text-violet-600 bg-violet-100
                px-2 py-0.5 rounded-full">{actions.length}</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Yapılacaklar listesi</div>
          </button>
        </div>

        {/* Ağırlıklar */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <div className="text-xs font-bold text-slate-500 uppercase mb-3">Boyut Ağırlıkları</div>
          <div className="space-y-2">
            {DIMENSIONS.map((dim, i) => {
              const key = `w${i+1}` as keyof typeof weights
              return (
                <div key={dim.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: dim.color }} className="font-bold">{dim.id}</span>
                    <span className="font-black text-slate-700">%{weights[key]}</span>
                  </div>
                  <input type="range" min={5} max={60} step={5}
                    value={weights[key]}
                    onChange={e => setWeights(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: dim.color }} />
                </div>
              )
            })}
          </div>
          <div className={`text-xs font-bold mt-2 text-center ${
            weightTotal === 100 ? 'text-green-600' : 'text-red-500'
          }`}>
            Toplam: %{weightTotal}
          </div>
          <button onClick={saveWeights} disabled={savingWeights || weightTotal !== 100}
            className="w-full mt-2 bg-slate-800 text-white text-xs font-bold py-2
              rounded-xl disabled:opacity-40 hover:bg-slate-700 transition">
            {savingWeights ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>

        {/* Tamamla */}
        <button onClick={completeAssessment} disabled={completing}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold
            py-3 rounded-2xl text-sm transition disabled:opacity-40">
          {completing ? 'Tamamlanıyor...' : '✓ Değerlendirmeyi Tamamla'}
        </button>
      </div>

      {/* Sağ panel - içerik */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* Kriter sekmeleri */}
        {activeTab !== 'actions' && activeDim && (
          <>
            <div className="mb-5">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-3 h-3 rounded-full" style={{ background: activeDim.color }} />
                <h2 className="font-black text-xl text-slate-900">{activeDim.name}</h2>
              </div>
              <p className="text-slate-400 text-sm ml-6">
                {activeDim.criteria.filter(c => scoreRows.find(s => s.criterion_id === c.id)).length}
                /{activeDim.criteria.length} kriter puanlandı
              </p>
            </div>

            <div className="space-y-4">
              {activeDim.criteria.map((c, idx) => {
                const row = scoreRows.find(s => s.criterion_id === c.id)
                const score = row?.score ?? null
                return (
                  <div key={c.id} className="bg-white rounded-2xl border border-slate-100 p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <span className="text-xs font-black text-slate-300 mt-0.5 w-10 flex-shrink-0">
                        {c.id}
                      </span>
                      <div className="flex-1">
                        <p className="font-bold text-slate-800 text-sm leading-relaxed">{c.name}</p>
                      </div>
                    </div>

                    {/* Puan butonları */}
<div className="flex gap-2 mb-4">
  {[0,1,2,3,4,5].map(v => (
    <button key={v} onClick={() => setScore(c.id, v)}
      className="flex-1 py-3 rounded-xl text-sm font-black transition border-2"
      style={
        score === v
          ? { background: activeDim.color, borderColor: activeDim.color, color: 'white' }
          : { background: 'white', borderColor: '#e2e8f0', color: '#94a3b8' }
      }>
      {v}
    </button>
  ))}
</div>

                    <div className="grid grid-cols-2 gap-3">
                      <select
                        value={row?.evidence_type || ''}
                        onChange={e => updateEvidenceType(c.id, e.target.value)}
                        className="border border-slate-200 rounded-xl px-3 py-2 text-xs
                          focus:outline-none focus:border-blue-400 text-slate-600">
                        <option value="">Kanıt türü seçin</option>
                        {EVIDENCE_TYPES.map(et => (
                          <option key={et.value} value={et.value}>{et.label}</option>
                        ))}
                      </select>
                      <input
                        defaultValue={row?.note || ''}
                        onBlur={e => updateNote(c.id, e.target.value)}
                        placeholder="Not ekle..."
                        className="border border-slate-200 rounded-xl px-3 py-2 text-xs
                          focus:outline-none focus:border-blue-400" />
                    </div>

                    {(score !== null && score >= 4) && (
                      <div className="mt-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <span className="text-xs text-slate-500">Kanıt dosyası:</span>
                          <input type="file" className="hidden"
                            onChange={e => e.target.files && uploadEvidence(c.id, e.target.files[0])} />
                          <span className="text-xs bg-blue-50 text-blue-600 font-bold
                            px-3 py-1.5 rounded-lg cursor-pointer hover:bg-blue-100">
                            {row?.evidence_url ? '✓ Yüklendi' : '+ Dosya Yükle'}
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Aksiyonlar sekmesi */}
        {activeTab === 'actions' && (
          <div>
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="font-black text-xl text-slate-900">Aksiyon Planı</h2>
                <p className="text-slate-400 text-sm mt-0.5">
                  Yapılması gereken işleri takip edin
                </p>
              </div>
              <button onClick={() => setAddingAction(true)}
                className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5
                  rounded-xl text-sm font-bold transition">
                + Aksiyon Ekle
              </button>
            </div>

            {/* Yeni aksiyon formu */}
            {addingAction && (
              <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5 mb-5">
                <div className="font-bold text-violet-800 mb-4 text-sm">Yeni Aksiyon</div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                      Başlık / Yapılacak İş *
                    </label>
                    <input value={newAction.title}
                      onChange={e => setNewAction(p => ({ ...p, title: e.target.value }))}
                      placeholder="ör: HACCP belgelerini güncelle"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm
                        focus:outline-none focus:border-violet-400" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                      Açıklama
                    </label>
                    <textarea value={newAction.description}
                      onChange={e => setNewAction(p => ({ ...p, description: e.target.value }))}
                      placeholder="Detaylı açıklama..."
                      rows={2}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm
                        focus:outline-none focus:border-violet-400 resize-none" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                        Sorumlu Kişi
                      </label>
                      <input value={newAction.responsible}
                        onChange={e => setNewAction(p => ({ ...p, responsible: e.target.value }))}
                        placeholder="Ad Soyad"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm
                          focus:outline-none focus:border-violet-400" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                        Öncelik
                      </label>
                      <select value={newAction.priority}
                        onChange={e => setNewAction(p => ({ ...p, priority: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm
                          focus:outline-none focus:border-violet-400">
                        {PRIORITY_OPTIONS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                        Son Tarih
                      </label>
                      <input type="date" value={newAction.due_date}
                        onChange={e => setNewAction(p => ({ ...p, due_date: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm
                          focus:outline-none focus:border-violet-400" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setAddingAction(false)}
                      className="flex-1 border border-slate-200 text-slate-600 font-bold
                        py-2.5 rounded-xl text-sm hover:bg-slate-50 transition">
                      İptal
                    </button>
                    <button onClick={addAction} disabled={savingAction}
                      className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold
                        py-2.5 rounded-xl text-sm transition disabled:opacity-40">
                      {savingAction ? 'Kaydediliyor...' : '+ Ekle'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Aksiyon listesi */}
            {actions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                <div className="text-4xl mb-3">📋</div>
                <div className="text-slate-500 font-bold mb-1">Henüz aksiyon yok</div>
                <div className="text-slate-400 text-sm">
                  Değerlendirme sonucunda yapılması gereken işleri buraya ekleyin
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {actions.map(action => {
                  const prio = PRIORITY_OPTIONS.find(p => p.value === action.priority)
                  const isDone = action.status === 'done'
                  const isOverdue = action.due_date && new Date(action.due_date) < new Date() && !isDone
                  return (
                    <div key={action.id}
                      className={`bg-white rounded-2xl border p-4 transition ${
                        isDone ? 'opacity-60 border-slate-100' : 'border-slate-200'
                      }`}>
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <button onClick={() => toggleActionStatus(action)}
                          className={`w-5 h-5 rounded-md border-2 flex-shrink-0 mt-0.5
                            flex items-center justify-center transition ${
                            isDone
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-slate-300 hover:border-green-400'
                          }`}>
                          {isDone && <span className="text-xs">✓</span>}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-bold text-sm ${
                              isDone ? 'line-through text-slate-400' : 'text-slate-800'
                            }`}>
                              {action.title}
                            </span>
                            {prio && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{ background: prio.bg, color: prio.color }}>
                                {prio.label}
                              </span>
                            )}
                            {isDone && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full
                                bg-green-100 text-green-600">
                                Tamamlandı
                              </span>
                            )}
                          </div>
                          {action.description && (
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                              {action.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {action.responsible && (
                              <span className="text-xs text-slate-400">
                                👤 {action.responsible}
                              </span>
                            )}
                            {action.due_date && (
                              <span className={`text-xs font-bold ${
                                isOverdue ? 'text-red-500' : 'text-slate-400'
                              }`}>
                                📅 {new Date(action.due_date).toLocaleDateString('tr-TR')}
                                {isOverdue && ' — Gecikmiş!'}
                              </span>
                            )}
                          </div>
                        </div>

                        <button onClick={() => deleteAction(action.id)}
                          className="text-slate-300 hover:text-red-400 transition text-lg
                            flex-shrink-0">
                          ×
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Özet */}
                <div className="bg-slate-50 rounded-xl p-3 flex gap-4 text-xs text-slate-500">
                  <span>Toplam: <strong>{actions.length}</strong></span>
                  <span>Tamamlanan: <strong className="text-green-600">
                    {actions.filter(a => a.status === 'done').length}
                  </strong></span>
                  <span>Bekleyen: <strong className="text-amber-600">
                    {actions.filter(a => a.status === 'open').length}
                  </strong></span>
                  <span>Gecikmiş: <strong className="text-red-500">
                    {actions.filter(a =>
                      a.due_date && new Date(a.due_date) < new Date() && a.status === 'open'
                    ).length}
                  </strong></span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
