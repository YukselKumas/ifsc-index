'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DIMENSIONS } from '@/lib/criteria'
import toast from 'react-hot-toast'

export default function AdminPage() {
  const [weights, setWeights] = useState({ w1: 0.25, w2: 0.25, w3: 0.25, w4: 0.25 })
  const [thresholds, setThresholds] = useState({ strong_min: 80, moderate_min: 60, risk_min: 40 })
  const [users, setUsers] = useState<any[]>([])
  const [tenantId, setTenantId] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('weights')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: userData } = await supabase.from('users').select('tenant_id, role').eq('id', user.id).single()
      if (!userData || userData.role !== 'admin') {
        toast.error('Bu sayfaya erişim yetkiniz yok')
        return
      }
      setTenantId(userData.tenant_id)
      const { data: tenant } = await supabase.from('tenants').select('*').eq('id', userData.tenant_id).single()
      if (tenant?.risk_config) setThresholds(tenant.risk_config)
      if (tenant?.weights) setWeights(tenant.weights)
      const { data: us } = await supabase.from('users').select('*').eq('tenant_id', userData.tenant_id)
      if (us) setUsers(us)
    }
    load()
  }, [])

  const totalWeight = Math.round((weights.w1 + weights.w2 + weights.w3 + weights.w4) * 100)

  async function saveWeights() {
    if (totalWeight !== 100) { toast.error('Ağırlıklar toplamı %100 olmalı'); return }
    setSaving(true)
    await supabase.from('tenants').update({ weights }).eq('id', tenantId)
    toast.success('Ağırlıklar kaydedildi!')
    setSaving(false)
  }

  async function saveThresholds() {
    if (thresholds.strong_min <= thresholds.moderate_min ||
        thresholds.moderate_min <= thresholds.risk_min) {
      toast.error('Eşikler: Güçlü > Orta > Risk sıralamasında olmalı')
      return
    }
    setSaving(true)
    await supabase.from('tenants').update({ risk_config: thresholds }).eq('id', tenantId)
    toast.success('Eşikler kaydedildi!')
    setSaving(false)
  }

  async function updateUserRole(userId: string, role: string) {
    await supabase.from('users').update({ role }).eq('id', userId)
    setUsers(us => us.map(u => u.id === userId ? { ...u, role } : u))
    toast.success('Rol güncellendi!')
  }

  const tabs = [
    { id: 'weights', label: '⚖️ Ağırlıklar' },
    { id: 'thresholds', label: '🎯 Risk Eşikleri' },
    { id: 'users', label: '👥 Kullanıcılar' },
  ]

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900">Admin Ayarları</h1>
        <p className="text-slate-500 text-sm mt-1">Sistem parametrelerini buradan yönetebilirsiniz</p>
      </div>

      {/* Sekmeler */}
      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition
              ${activeTab === t.id ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Ağırlıklar */}
      {activeTab === 'weights' && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h2 className="font-bold text-slate-900 mb-1">Boyut Ağırlıkları</h2>
          <p className="text-slate-400 text-sm mb-6">Her boyutun toplam skora katkı oranı. Toplam %100 olmalıdır.</p>

          <div className="space-y-5">
            {DIMENSIONS.map((dim, i) => {
              const key = `w${i + 1}` as keyof typeof weights
              const pct = Math.round(weights[key] * 100)
              return (
                <div key={dim.id}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: dim.color }} />
                      <span className="font-semibold text-slate-800 text-sm">{dim.name}</span>
                    </div>
                    <span className="font-black text-lg" style={{ color: dim.color }}>%{pct}</span>
                  </div>
                  <input
                    type="range" min={5} max={60} step={5}
                    value={pct}
                    onChange={e => {
                      const val = parseInt(e.target.value) / 100
                      setWeights(w => ({ ...w, [key]: val }))
                    }}
                    className="w-full accent-blue-600"
                  />
                  <div className="h-2 bg-slate-100 rounded-full mt-1">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: dim.color }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div className={`mt-4 p-3 rounded-xl text-sm font-bold text-center
            ${totalWeight === 100 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            Toplam: %{totalWeight} {totalWeight === 100 ? '✓' : `(${totalWeight > 100 ? '+' : ''}${totalWeight - 100} fark)`}
          </div>

          <button onClick={saveWeights} disabled={saving || totalWeight !== 100}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-40">
            {saving ? 'Kaydediliyor...' : 'Ağırlıkları Kaydet'}
          </button>
        </div>
      )}

      {/* Risk Eşikleri */}
      {activeTab === 'thresholds' && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h2 className="font-bold text-slate-900 mb-1">Risk Seviyesi Eşikleri</h2>
          <p className="text-slate-400 text-sm mb-6">Skor aralıklarına göre risk seviyesi belirlenir.</p>

          <div className="space-y-6">
            {[
              { key: 'strong_min', label: 'Güçlü', desc: 'Bu eşik ve üzeri → Güçlü', color: '#16a34a' },
              { key: 'moderate_min', label: 'Orta', desc: 'Bu eşik ve üzeri → Orta', color: '#ca8a04' },
              { key: 'risk_min', label: 'Risk', desc: 'Bu eşik ve üzeri → Risk (altı Kritik)', color: '#ea580c' },
            ].map(item => (
              <div key={item.key}>
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <div className="font-bold text-slate-800" style={{ color: item.color }}>{item.label}</div>
                    <div className="text-xs text-slate-400">{item.desc}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={0} max={100}
                      value={thresholds[item.key as keyof typeof thresholds]}
                      onChange={e => setThresholds(t => ({ ...t, [item.key]: parseInt(e.target.value) }))}
                      className="w-20 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-center focus:outline-none focus:border-blue-400"
                    />
                    <span className="text-slate-400 text-sm">/ 100</span>
                  </div>
                </div>
                <div className="h-2 bg-slate-100 rounded-full">
                  <div className="h-full rounded-full"
                    style={{ width: `${thresholds[item.key as keyof typeof thresholds]}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>

          {/* Görsel özet */}
          <div className="mt-6 p-4 bg-slate-50 rounded-xl">
            <div className="text-xs font-bold text-slate-500 mb-2">SKOR ARALIKLARI ÖZETİ</div>
            <div className="flex rounded-lg overflow-hidden text-xs font-bold text-white text-center">
              <div style={{ width: `${100 - thresholds.strong_min}%`, background: '#16a34a' }} className="py-1.5">
                Güçlü ({thresholds.strong_min}-100)
              </div>
              <div style={{ width: `${thresholds.strong_min - thresholds.moderate_min}%`, background: '#ca8a04' }} className="py-1.5">
                Orta
              </div>
              <div style={{ width: `${thresholds.moderate_min - thresholds.risk_min}%`, background: '#ea580c' }} className="py-1.5">
                Risk
              </div>
              <div style={{ width: `${thresholds.risk_min}%`, background: '#dc2626' }} className="py-1.5">
                Kritik
              </div>
            </div>
          </div>

          <button onClick={saveThresholds} disabled={saving}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-40">
            {saving ? 'Kaydediliyor...' : 'Eşikleri Kaydet'}
          </button>
        </div>
      )}

      {/* Kullanıcılar */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-bold text-slate-900">Kullanıcı Yönetimi</h2>
            <p className="text-slate-400 text-sm mt-0.5">Kullanıcı rollerini buradan değiştirebilirsiniz</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Kullanıcı ID', 'Ad Soyad', 'Rol', 'İşlem'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-400 font-mono">{u.id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{u.full_name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold
                      ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={e => updateUserRole(u.id, e.target.value)}
                      className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-400">
                      <option value="assessor">assessor</option>
                      <option value="admin">admin</option>
                      <option value="viewer">viewer</option>
                    </select>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Kullanıcı bulunamadı</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
