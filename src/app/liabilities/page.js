'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'

export default function LiabilitiesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [liabilities, setLiabilities] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [hasUnsavedEdit, setHasUnsavedEdit] = useState(false)
useUnsavedChanges(hasUnsavedEdit)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data, error } = await supabase
      .from('liabilities')
      .select('*')
      .eq('is_archived', false)
      .order('created_at')

    if (!error) setLiabilities(data || [])
    setLoading(false)
  }

  async function handleSave(id, updates) {
    const { error } = await supabase
      .from('liabilities')
      .update({
        name: updates.name,
        original_principal_jpy: Number(updates.original_principal_jpy),
        principal_jpy: Number(updates.principal_jpy),
        interest_rate_pct: Number(updates.interest_rate_pct),
        monthly_payment_jpy: Number(updates.monthly_payment_jpy),
        payoff_date: updates.payoff_date,
        rate_type: updates.rate_type,
      })
      .eq('id', id)

    if (!error) {
      setEditingId(null)
      setHasUnsavedEdit(false)
      loadData()
    }
    return error
  }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-medium">Liabilities</h1>
          <a href="/" className="text-sm text-gray-600 underline">← Home</a>
        </div>

        {liabilities.length === 0 && (
          <div className="bg-white rounded-lg p-8 text-center text-gray-500">
            No liabilities yet.
          </div>
        )}

        {liabilities.map(l => (
          <LiabilityCard
  key={l.id}
  liability={l}
  isEditing={editingId === l.id}
  onEdit={() => setEditingId(l.id)}
  onCancel={() => { setEditingId(null); setHasUnsavedEdit(false) }}
  onSave={(updates) => handleSave(l.id, updates)}
  onDirty={() => setHasUnsavedEdit(true)}
/>
        ))}
      </div>
    </div>
  )
}

function LiabilityCard({ liability, isEditing, onEdit, onCancel, onSave, onDirty }) {
  const stats = computeStats(liability)

   if (isEditing) {
    return <LiabilityEditForm liability={liability} onCancel={onCancel} onSave={onSave} onDirty={onDirty} />
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm mb-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-medium">{liability.name}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {liability.rate_type === 'variable' ? '変動金利' : '固定金利'} · {liability.interest_rate_pct}%
          </p>
        </div>
        <button onClick={onEdit} className="text-sm text-gray-600 underline">Edit</button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <Stat label="Current balance" value={`¥${Number(liability.principal_jpy).toLocaleString('en-US')}`} hint="Update monthly from bank" />
        <Stat label="Monthly payment" value={`¥${Number(liability.monthly_payment_jpy).toLocaleString('en-US')}`} />
        <Stat label="Months remaining" value={`${stats.monthsRemaining} (${(stats.monthsRemaining / 12).toFixed(1)} yrs)`} />
        <Stat label="Payoff date" value={liability.payoff_date} />
        <Stat label="Total interest remaining" value={`¥${stats.totalInterestRemaining.toLocaleString('en-US')}`} hint="At current rate" />
        <Stat label="This month's split" value={`¥${stats.thisMonthInterest.toLocaleString('en-US')} / ¥${stats.thisMonthPrincipal.toLocaleString('en-US')}`} hint="interest / principal" />
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-1">Loan progression</p>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-red-700" style={{ width: `${stats.percentPaid}%` }} />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {stats.percentPaid.toFixed(1)}% paid down · ¥{stats.principalPaid.toLocaleString('en-US')} of ¥{Number(liability.original_principal_jpy ?? liability.principal_jpy).toLocaleString('en-US')}
        </p>
      </div>

      {liability.rate_type === 'variable' && (
        <p className="text-xs text-gray-500 mt-4 italic">
          Note: projections assume {liability.interest_rate_pct}% holds. Update the current balance from your bank statement to keep this accurate.
        </p>
      )}
    </div>
  )
}

function LiabilityEditForm({ liability, onCancel, onSave, onDirty }) {
  const [form, setForm] = useState({
    name: liability.name,
    original_principal_jpy: liability.original_principal_jpy ?? liability.principal_jpy,
    principal_jpy: liability.principal_jpy,
    interest_rate_pct: liability.interest_rate_pct,
    monthly_payment_jpy: liability.monthly_payment_jpy,
    payoff_date: liability.payoff_date,
    rate_type: liability.rate_type,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const err = await onSave(form)
    if (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 shadow-sm mb-4 space-y-4">
      <h2 className="text-lg font-medium">Edit {liability.name}</h2>

<EditField label="Name" value={form.name} onChange={(v) => { setForm({ ...form, name: v }); onDirty?.() }} />
      <EditField label="Original principal (¥)" type="number" value={form.original_principal_jpy} onChange={(v) => { setForm({ ...form, original_principal_jpy: v }); onDirty?.() }} hint="The full loan amount when you took it out." />
      <EditField label="Current balance (¥)" type="number" value={form.principal_jpy} onChange={(v) => { setForm({ ...form, principal_jpy: v }); onDirty?.() }} hint="What you owe today, per your bank statement. Update this monthly." />
      <EditField label="Interest rate (%)" type="number" step="0.001" value={form.interest_rate_pct} onChange={(v) => { setForm({ ...form, interest_rate_pct: v }); onDirty?.() }} />
      <EditField label="Monthly payment (¥)" type="number" value={form.monthly_payment_jpy} onChange={(v) => { setForm({ ...form, monthly_payment_jpy: v }); onDirty?.() }} />
      <EditField label="Payoff date" type="date" value={form.payoff_date} onChange={(v) => { setForm({ ...form, payoff_date: v }); onDirty?.() }} />

      <div>
        <label className="block text-sm text-gray-700 mb-1">Rate type</label>
        <select
          value={form.rate_type}
          onChange={(e) => { setForm({ ...form, rate_type: e.target.value }); onDirty?.() }}
          className="px-3 py-2 border rounded-md"
        >
          <option value="variable">変動金利 (variable)</option>
          <option value="fixed">固定金利 (fixed)</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-red-700 text-white rounded-md disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 border rounded-md">
          Cancel
        </button>
      </div>
    </form>
  )
}

function EditField({ label, value, onChange, type = 'text', step, hint }) {
  return (
    <div>
      <label className="block text-sm text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-md"
      />
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

function Stat({ label, value, hint }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium">{value}</p>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function computeStats(liability) {
  const original = Number(liability.original_principal_jpy ?? liability.principal_jpy)
  const current = Number(liability.principal_jpy)
  const monthlyRate = Number(liability.interest_rate_pct) / 100 / 12
  const payment = Number(liability.monthly_payment_jpy)
  const payoffDate = new Date(liability.payoff_date)
  const today = new Date()

  const monthsRemaining = Math.max(0, monthsBetween(today, payoffDate))
  const principalPaid = Math.max(0, original - current)
  const percentPaid = original > 0 ? (principalPaid / original) * 100 : 0

  const thisMonthInterest = current * monthlyRate
  const thisMonthPrincipal = Math.max(0, payment - thisMonthInterest)

  const totalRemaining = payment * monthsRemaining
  const totalInterestRemaining = Math.max(0, totalRemaining - current)

  return {
    monthsRemaining,
    principalPaid: Math.round(principalPaid),
    percentPaid,
    thisMonthInterest: Math.round(thisMonthInterest),
    thisMonthPrincipal: Math.round(thisMonthPrincipal),
    totalInterestRemaining: Math.round(totalInterestRemaining),
  }
}

function monthsBetween(start, end) {
  const yearDiff = end.getFullYear() - start.getFullYear()
  const monthDiff = end.getMonth() - start.getMonth()
  return yearDiff * 12 + monthDiff
}