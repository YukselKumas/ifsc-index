import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'
import { DIMENSIONS } from '@/lib/criteria'
import { RISK_META } from '@/lib/scoring'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { assessment, scoreRows, email, dimScores, total, riskLevel } = await req.json()
  const riskMeta = RISK_META[riskLevel as keyof typeof RISK_META]

  const dimRows = DIMENSIONS.map(dim => {
    const score = Math.round(dimScores[dim.id] || 0)
    return `
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#1e293b;">${dim.name}</td>
        <td style="padding:10px 14px;text-align:center;">
          <div style="background:${dim.bg};color:${dim.color};font-weight:900;font-size:18px;
            padding:4px 12px;border-radius:8px;display:inline-block;">${score}</div>
        </td>
        <td style="padding:10px 14px;">
          <div style="height:8px;background:#f1f5f9;border-radius:4px;">
            <div style="height:100%;width:${score}%;background:${dim.color};border-radius:4px;"></div>
          </div>
        </td>
      </tr>`
  }).join('')

  const criteriaRows = scoreRows.map((s: any) => {
    const dim = DIMENSIONS.find(d => d.id === s.dimension_id)
    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:7px 12px;font-size:11px;color:#94a3b8;font-family:monospace;">${s.criterion_id}</td>
        <td style="padding:7px 12px;font-size:12px;color:#334155;">${s.note || ''}</td>
        <td style="padding:7px 12px;text-align:center;">
          <span style="font-weight:900;font-size:16px;color:${dim?.color || '#64748b'};">${s.score}</span>
          <span style="color:#94a3b8;font-size:11px;">/5</span>
        </td>
      </tr>`
  }).join('')

  const html = `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;font-family:sans-serif;background:#f8fafc;">
    <div style="max-width:680px;margin:0 auto;padding:24px;">

      <!-- Kapak -->
      <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:20px;padding:40px;color:#fff;margin-bottom:20px;">
        <div style="font-size:28px;font-weight:900;margin-bottom:6px;">🛡️ IFSC Index Raporu</div>
        <div style="opacity:.7;font-size:14px;margin-bottom:24px;">
          ${assessment.facility_name} · ${assessment.assessment_date}
        </div>
        <div style="display:flex;align-items:flex-end;gap:20px;">
          <div>
            <div style="font-size:72px;font-weight:900;line-height:1;">${total}</div>
            <div style="opacity:.5;font-size:16px;">/ 100 puan</div>
          </div>
          <div style="padding-bottom:8px;">
            <div style="background:${riskMeta.bg};color:${riskMeta.color};
              font-weight:900;font-size:16px;padding:8px 20px;border-radius:20px;display:inline-block;">
              ${riskMeta.label}
            </div>
            <div style="margin-top:8px;opacity:.7;font-size:13px;max-width:300px;">
              ${riskMeta.description}
            </div>
          </div>
        </div>
      </div>

      <!-- Boyut Skorları -->
      <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px;border:1px solid #e2e8f0;">
        <div style="font-weight:800;font-size:16px;color:#0f172a;margin-bottom:16px;">Boyut Skorları</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="text-align:left;padding:10px 14px;font-size:11px;color:#94a3b8;text-transform:uppercase;">Boyut</th>
              <th style="text-align:center;padding:10px 14px;font-size:11px;color:#94a3b8;text-transform:uppercase;">Skor</th>
              <th style="padding:10px 14px;font-size:11px;color:#94a3b8;text-transform:uppercase;">Dağılım</th>
            </tr>
          </thead>
          <tbody>${dimRows}</tbody>
        </table>
      </div>

      <!-- Kriter Detayları -->
      <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px;border:1px solid #e2e8f0;">
        <div style="font-weight:800;font-size:16px;color:#0f172a;margin-bottom:16px;">Kriter Detayları</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="text-align:left;padding:8px 12px;font-size:11px;color:#94a3b8;text-transform:uppercase;">ID</th>
              <th style="text-align:left;padding:8px 12px;font-size:11px;color:#94a3b8;text-transform:uppercase;">Not</th>
              <th style="text-align:center;padding:8px 12px;font-size:11px;color:#94a3b8;text-transform:uppercase;">Puan</th>
            </tr>
          </thead>
          <tbody>${criteriaRows}</tbody>
        </table>
      </div>

      <!-- Öneriler -->
      <div style="background:${riskMeta.bg};border-radius:16px;padding:24px;border:1px solid ${riskMeta.border};">
        <div style="font-weight:800;font-size:16px;margin-bottom:12px;" style="color:${riskMeta.color};">
          Öneriler
        </div>
        <ul style="margin:0;padding-left:20px;">
          ${riskMeta.recommendations.map((r: string) =>
            `<li style="margin-bottom:8px;font-size:13px;color:#334155;">${r}</li>`
          ).join('')}
        </ul>
      </div>

      <!-- Footer -->
      <div style="text-align:center;padding:20px;font-size:11px;color:#94a3b8;">
        IFSC Index — Gıda Güvenliği Kültürü Değerlendirme Sistemi
      </div>
    </div>
  </body>
  </html>`

  try {
    await resend.emails.send({
      from: 'IFSC Index <onboarding@resend.dev>',
      to: email,
      subject: `IFSC Raporu: ${assessment.facility_name} — ${riskMeta.label} (${total}/100)`,
      html,
    })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message })
  }
}
