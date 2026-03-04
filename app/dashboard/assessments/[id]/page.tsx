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
  const [activeTab, setActiveTab] = useState<'D1'|'D2'|'D3'|'D4'|'actions'>('D1')
  const [weights, setWeights] = useState({ w1: 25, w2: 25, w3: 25, w4: 25 })
  const [savingWeights, setSavingWeights] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [actions, setActions] = useState<any[]>([])
  const [newAction, setNewAction] = useState({
    title: '', description: '', responsible: '', priority: 'medium', due_date: '',
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
    w1: weights.w1/100, w2: weights.w2/100, w3: weights.w3/100, w4: weights.w4/100
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
    const t = weights.w1 + weights.w2 + weights.w3 + weights.w4
    if (t !== 100) { toast.error(`Toplam ${t}% — 100% olmalı`); return }
    setSavingWeights(true)
    await supabase.from('assessments').update({
      w1: weights.w1/100, w2: weights.w2/100, w3: weights.w3/100, w4: weights.w4/100,
    }).eq('id', id)
    setSavingWeights(false)
    toast.success('Ağırlıklar kaydedildi')
  }

  async function completeAssessment() {
    const allScored = DIMENSIONS.every(dim =>
      dim.criteria.every(c => scoreRows.find(s => s.criterion_id === c.id))
    )
    if (!allScored) { toast.error('Tüm kriterler puanlanmalı'); return }
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

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f8fafc' }}>

      {/* Sol panel */}
      <div style={{ width:288, borderRight:'1px solid #e2e8f0', background:'white',
        display:'flex', flexDirection:'column', overflowY:'auto', flexShrink:0 }}>

        <div style={{ padding:'20px', borderBottom:'1px solid #f1f5f9' }}>
          <Link href="/dashboard/assessments"
            style={{ fontSize:12, color:'#94a3b8', textDecoration:'none' }}>← Geri</Link>
          <div style={{ fontWeight:900, color:'#0f172a', marginTop:4, fontSize:15,
            lineHeight:1.3 }}>{assessment.facility_name}</div>
          <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{assessment.assessment_date}</div>
          {assessment.revision_number > 1 && (
            <span style={{ fontSize:11, background:'#f3e8ff', color:'#7c3aed', fontWeight:700,
              padding:'2px 8px', borderRadius:20, marginTop:4, display:'inline-block' }}>
              R{assessment.revision_number}
            </span>
          )}
        </div>

        {/* Skor */}
        <div style={{ padding:'16px', borderBottom:'1px solid #f1f5f9' }}>
          <div style={{ background:'#f8fafc', borderRadius:16, padding:'16px', textAlign:'center' }}>
            <div style={{ fontSize:40, fontWeight:900, color:riskMeta.color, lineHeight:1 }}>
              {total}
            </div>
            <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>/ 100 puan</div>
            <div style={{ marginTop:8, padding:'4px 12px', borderRadius:20, fontSize:11,
              fontWeight:700, display:'inline-block',
              background:riskMeta.bg, color:riskMeta.color }}>
              {riskMeta.label}
            </div>
            <div style={{ fontSize:11, color:'#94a3b8', marginTop:8 }}>
              {scoredCount}/20 kriter puanlandı
            </div>
            <div style={{ marginTop:6, height:4, background:'#e2e8f0', borderRadius:4, overflow:'hidden' }}>
              <div style={{ height:'100%', background:'#3b82f6', borderRadius:4,
                width:`${(scoredCount/20)*100}%`, transition:'width .3s' }} />
            </div>
          </div>
        </div>

        {/* Sekmeler */}
        <div style={{ padding:'12px', borderBottom:'1px solid #f1f5f9', display:'flex',
          flexDirection:'column', gap:4 }}>
          {DIMENSIONS.map(dim => {
            const s = Math.round(dimScores[dim.id] || 0)
            const isActive = activeTab === dim.id
            const dimScored = dim.criteria.filter(c =>
              scoreRows.find(sr => sr.criterion_id === c.id)
            ).length
            return (
              <button key={dim.id}
                onClick={() => setActiveTab(dim.id as any)}
                style={{ width:'100%', textAlign:'left', padding:'10px 12px', borderRadius:12,
                  border:'none', cursor:'pointer', transition:'all .15s',
                  background: isActive ? dim.color : 'transparent',
                  color: isActive ? 'white' : '#64748b' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontWeight:900, fontSize:11 }}>{dim.id}</span>
                    <span style={{ fontSize:11 }}>{dim.name}</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:11, opacity:.7 }}>{dimScored}/5</span>
                    <span style={{ fontWeight:900, fontSize:13 }}>{s}</span>
                  </div>
                </div>
                {isActive && (
<div style={{ marginTop:6, height:3, borderRadius:3, overflow:'hidden',
  background: isActive ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.06)' }}>
  <div style={{ height:'100%', borderRadius:3,
    background: isActive ? 'rgba(255,255,255,.8)' : dim.color,
    width:`${s}%` }} />
</div>
                )}
              </button>
            )
          })}
          <button
            onClick={() => setActiveTab('actions')}
            style={{ width:'100%', textAlign:'left', padding:'10px 12px', borderRadius:12,
              border:'none', cursor:'pointer', transition:'all .15s',
              background: activeTab === 'actions' ? '#7c3aed' : 'transparent',
              color: activeTab === 'actions' ? 'white' : '#64748b' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontWeight:900, fontSize:11 }}>📋</span>
                <span style={{ fontSize:11, fontWeight:700 }}>Aksiyonlar</span>
              </div>
              <span style={{ fontWeight:900, fontSize:13 }}>{actions.length}</span>
            </div>
          </button>
        </div>

        {/* Ağırlıklar */}
        <div style={{ padding:'16px', borderBottom:'1px solid #f1f5f9' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase',
            letterSpacing:'.05em', marginBottom:12 }}>Boyut Ağırlıkları</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {DIMENSIONS.map((dim, i) => {
              const key = `w${i+1}` as keyof typeof weights
              return (
                <div key={dim.id} style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:11, fontWeight:900, color:dim.color, width:20 }}>
                    {dim.id}
                  </span>
<input type="range" min={5} max={60} step={5}
    value={weights[key]}
    onChange={e => setWeights(p => ({ ...p, [key]: Number(e.target.value) }))}
    style={{ flex:1, accentColor:dim.color, cursor:'pointer',
      background:'#e2e8f0', height:4, borderRadius:4,
      outline:'none', border:'none', appearance:'auto' }} />
                  <span style={{ fontSize:11, fontWeight:900, color:'#334155', width:28,
                    textAlign:'right' }}>%{weights[key]}</span>
                </div>
              )
            })}
          </div>
          <div style={{ fontSize:11, fontWeight:700, textAlign:'center', marginTop:8,
            color: weightTotal === 100 ? '#16a34a' : '#ef4444' }}>
            Toplam: %{weightTotal}
          </div>
          <button onClick={saveWeights} disabled={savingWeights || weightTotal !== 100}
            style={{ width:'100%', marginTop:8, background:'#1e293b', color:'white',
              fontSize:11, fontWeight:700, padding:'8px', borderRadius:12, border:'none',
              cursor:'pointer', opacity: (savingWeights || weightTotal !== 100) ? .4 : 1 }}>
            {savingWeights ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>

        {/* Tamamla */}
        <div style={{ padding:'16px' }}>
          <button onClick={completeAssessment} disabled={completing}
            style={{ width:'100%', background:'#16a34a', color:'white', fontWeight:700,
              fontSize:14, padding:'12px', borderRadius:16, border:'none', cursor:'pointer',
              opacity: completing ? .4 : 1 }}>
            {completing ? 'Tamamlanıyor...' : '✓ Değerlendirmeyi Tamamla'}
          </button>
        </div>
      </div>

      {/* Sağ panel */}
      <div style={{ flex:1, overflowY:'auto', padding:'24px' }}>

        {activeTab !== 'actions' && activeDim && (
          <>
            <div style={{ marginBottom:24, display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:14, height:14, borderRadius:'50%',
                background:activeDim.color, flexShrink:0 }} />
              <div>
                <div style={{ fontWeight:900, fontSize:20, color:'#0f172a' }}>
                  {activeDim.name}
                </div>
                <div style={{ fontSize:13, color:'#94a3b8', marginTop:2 }}>
                  {activeDim.criteria.filter(c =>
                    scoreRows.find(s => s.criterion_id === c.id)
                  ).length}/{activeDim.criteria.length} kriter puanlandı
                </div>
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {activeDim.criteria.map(c => {
                const row = scoreRows.find(s => s.criterion_id === c.id)
                const score = row?.score ?? null
                return (
                  <div key={c.id} style={{ background:'white', borderRadius:20,
                    border:'1px solid #e2e8f0', padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.04)' }}>

                    <div style={{ display:'flex', gap:12, marginBottom:16 }}>
                      <span style={{ fontSize:11, fontWeight:900, color:'#cbd5e1',
                        flexShrink:0, fontFamily:'monospace', marginTop:2 }}>{c.id}</span>
                      <span style={{ fontSize:14, fontWeight:600, color:'#1e293b',
                        lineHeight:1.5 }}>{c.name}</span>
                    </div>

                    {/* Puan butonları */}
                    <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                      {[0,1,2,3,4,5].map(v => {
                        const isSelected = score === v
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setScore(c.id, v)}
                            style={{
                              flex:1, padding:'10px 0', borderRadius:12,
                              fontSize:14, fontWeight:900, cursor:'pointer',
                              border:`2px solid ${isSelected ? activeDim.color : '#e2e8f0'}`,
                              background: isSelected ? activeDim.color : '#ffffff',
                              color: isSelected ? 'white' : '#94a3b8',
                              transition:'all .15s',
                            }}>
                            {v}
                          </button>
                        )
                      })}
                    </div>

                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                      <select
                        value={row?.evidence_type || ''}
                        onChange={e => updateEvidenceType(c.id, e.target.value)}
                        style={{ border:'1px solid #e2e8f0', borderRadius:12, padding:'8px 12px',
                          fontSize:12, color:'#475569', background:'white', cursor:'pointer' }}>
                        <option value="">Kanıt türü seçin</option>
                        {EVIDENCE_TYPES.map(et => (
                          <option key={et.value} value={et.value}>{et.label}</option>
                        ))}
                      </select>
                      <input
                        defaultValue={row?.note || ''}
                        onBlur={e => updateNote(c.id, e.target.value)}
                        placeholder="Not ekle..."
                        style={{ border:'1px solid #e2e8f0', borderRadius:12, padding:'8px 12px',
                          fontSize:12, color:'#475569', outline:'none' }} />
                    </div>

                    {score !== null && score >= 4 && (
                      <div style={{ marginTop:12 }}>
                        <label style={{ display:'flex', alignItems:'center', gap:8,
                          cursor:'pointer', width:'fit-content' }}>
                          <span style={{ fontSize:12, color:'#64748b' }}>Kanıt dosyası:</span>
                          <input type="file" style={{ display:'none' }}
                            onChange={e => e.target.files &&
                              uploadEvidence(c.id, e.target.files[0])} />
                          <span style={{ fontSize:12, background:'#eff6ff', color:'#2563eb',
                            fontWeight:700, padding:'6px 12px', borderRadius:8, cursor:'pointer' }}>
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

        {activeTab === 'actions' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
              marginBottom:20 }}>
              <div>
                <div style={{ fontWeight:900, fontSize:20, color:'#0f172a' }}>Aksiyon Planı</div>
                <div style={{ fontSize:13, color:'#94a3b8', marginTop:2 }}>
                  Yapılması gereken işleri takip edin
                </div>
              </div>
              <button onClick={() => setAddingAction(true)}
                style={{ background:'#7c3aed', color:'white', fontWeight:700, fontSize:13,
                  padding:'10px 18px', borderRadius:12, border:'none', cursor:'pointer' }}>
                + Aksiyon Ekle
              </button>
            </div>

            {addingAction && (
              <div style={{ background:'#faf5ff', border:'1px solid #ddd6fe', borderRadius:20,
                padding:20, marginBottom:20 }}>
                <div style={{ fontWeight:700, color:'#5b21b6', marginBottom:16, fontSize:14 }}>
                  Yeni Aksiyon
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8',
                      textTransform:'uppercase', marginBottom:4 }}>Başlık *</div>
                    <input value={newAction.title}
                      onChange={e => setNewAction(p => ({ ...p, title: e.target.value }))}
                      placeholder="ör: HACCP belgelerini güncelle"
                      style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:12,
                        padding:'10px 14px', fontSize:13, boxSizing:'border-box' }} />
                  </div>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8',
                      textTransform:'uppercase', marginBottom:4 }}>Açıklama</div>
                    <textarea value={newAction.description}
                      onChange={e => setNewAction(p => ({ ...p, description: e.target.value }))}
                      placeholder="Detaylı açıklama..." rows={2}
                      style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:12,
                        padding:'10px 14px', fontSize:13, resize:'none', boxSizing:'border-box' }} />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8',
                        textTransform:'uppercase', marginBottom:4 }}>Sorumlu</div>
                      <input value={newAction.responsible}
                        onChange={e => setNewAction(p => ({ ...p, responsible: e.target.value }))}
                        placeholder="Ad Soyad"
                        style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:12,
                          padding:'10px 14px', fontSize:13, boxSizing:'border-box' }} />
                    </div>
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8',
                        textTransform:'uppercase', marginBottom:4 }}>Öncelik</div>
                      <select value={newAction.priority}
                        onChange={e => setNewAction(p => ({ ...p, priority: e.target.value }))}
                        style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:12,
                          padding:'10px 14px', fontSize:13, background:'white',
                          boxSizing:'border-box' }}>
                        {PRIORITY_OPTIONS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8',
                        textTransform:'uppercase', marginBottom:4 }}>Son Tarih</div>
                      <input type="date" value={newAction.due_date}
                        onChange={e => setNewAction(p => ({ ...p, due_date: e.target.value }))}
                        style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:12,
                          padding:'10px 14px', fontSize:13, boxSizing:'border-box' }} />
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, marginTop:4 }}>
                    <button onClick={() => setAddingAction(false)}
                      style={{ flex:1, border:'1px solid #e2e8f0', background:'white',
                        color:'#475569', fontWeight:700, padding:'10px', borderRadius:12,
                        cursor:'pointer', fontSize:13 }}>
                      İptal
                    </button>
                    <button onClick={addAction} disabled={savingAction}
                      style={{ flex:1, background:'#7c3aed', color:'white', fontWeight:700,
                        padding:'10px', borderRadius:12, border:'none', cursor:'pointer',
                        fontSize:13, opacity: savingAction ? .5 : 1 }}>
                      {savingAction ? 'Kaydediliyor...' : '+ Ekle'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {actions.length === 0 && !addingAction ? (
              <div style={{ background:'white', borderRadius:20, border:'1px solid #f1f5f9',
                padding:48, textAlign:'center' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
                <div style={{ fontWeight:700, color:'#475569', marginBottom:4 }}>
                  Henüz aksiyon yok
                </div>
                <div style={{ fontSize:13, color:'#94a3b8' }}>
                  Değerlendirme sonucunda yapılması gereken işleri buraya ekleyin
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {actions.map(action => {
                  const prio = PRIORITY_OPTIONS.find(p => p.value === action.priority)
                  const isDone = action.status === 'done'
                  const isOverdue = action.due_date &&
                    new Date(action.due_date) < new Date() && !isDone
                  return (
                    <div key={action.id}
                      style={{ background:'white', borderRadius:20, padding:16,
                        border:`1px solid ${isDone ? '#f1f5f9' : '#e2e8f0'}`,
                        opacity: isDone ? .65 : 1,
                        boxShadow: isDone ? 'none' : '0 1px 4px rgba(0,0,0,.04)' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                        <button onClick={() => toggleActionStatus(action)}
                          style={{ width:20, height:20, borderRadius:6, flexShrink:0,
                            marginTop:2, display:'flex', alignItems:'center',
                            justifyContent:'center', cursor:'pointer', transition:'all .15s',
                            border: isDone ? 'none' : '2px solid #cbd5e1',
                            background: isDone ? '#22c55e' : 'transparent' }}>
                          {isDone && <span style={{ color:'white', fontSize:11,
                            fontWeight:900 }}>✓</span>}
                        </button>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8,
                            flexWrap:'wrap' }}>
                            <span style={{ fontWeight:700, fontSize:14,
                              color: isDone ? '#94a3b8' : '#1e293b',
                              textDecoration: isDone ? 'line-through' : 'none' }}>
                              {action.title}
                            </span>
                            {prio && (
                              <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px',
                                borderRadius:20, background:prio.bg, color:prio.color }}>
                                {prio.label}
                              </span>
                            )}
                            {isDone && (
                              <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px',
                                borderRadius:20, background:'#f0fdf4', color:'#16a34a' }}>
                                Tamamlandı
                              </span>
                            )}
                          </div>
                          {action.description && (
                            <div style={{ fontSize:12, color:'#64748b', marginTop:4,
                              lineHeight:1.6 }}>{action.description}</div>
                          )}
                          <div style={{ display:'flex', gap:12, marginTop:6,
                            flexWrap:'wrap' }}>
                            {action.responsible && (
                              <span style={{ fontSize:11, color:'#94a3b8' }}>
                                👤 {action.responsible}
                              </span>
                            )}
                            {action.due_date && (
                              <span style={{ fontSize:11, fontWeight:700,
                                color: isOverdue ? '#ef4444' : '#94a3b8' }}>
                                📅 {new Date(action.due_date).toLocaleDateString('tr-TR')}
                                {isOverdue && ' — Gecikmiş!'}
                              </span>
                            )}
                          </div>
                        </div>
                        <button onClick={() => deleteAction(action.id)}
                          style={{ color:'#cbd5e1', fontSize:20, background:'none',
                            border:'none', cursor:'pointer', lineHeight:1, flexShrink:0 }}>
                          ×
                        </button>
                      </div>
                    </div>
                  )
                })}
                <div style={{ background:'#f8fafc', borderRadius:12, padding:12,
                  display:'flex', gap:16, fontSize:12, color:'#64748b' }}>
                  <span>Toplam: <strong>{actions.length}</strong></span>
                  <span>Tamamlanan: <strong style={{ color:'#16a34a' }}>
                    {actions.filter(a => a.status === 'done').length}</strong></span>
                  <span>Bekleyen: <strong style={{ color:'#d97706' }}>
                    {actions.filter(a => a.status === 'open').length}</strong></span>
                  <span>Gecikmiş: <strong style={{ color:'#ef4444' }}>
                    {actions.filter(a =>
                      a.due_date && new Date(a.due_date) < new Date() && a.status === 'open'
                    ).length}</strong></span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
