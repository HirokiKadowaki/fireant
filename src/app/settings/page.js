'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [birthDate, setBirthDate] = useState('')
  const [retirementExpenses, setRetirementExpenses] = useState('')
  const [pensionMonthly, setPensionMonthly] = useState('')
  const [swrPct, setSwrPct] = useState('')
  const [returnPct, setReturnPct] = useState('')
  const [emergencyFund, setEmergencyFund] = useState('')
  const [isDirty, setIsDirty] = useState(false)
useUnsavedChanges(isDirty)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      setMessage('Could not load settings: ' + error.message)
      setLoading(false)
      return
    }

    setBirthDate(data.birth_date ?? '')
    setRetirementExpenses(data.target_retirement_expenses_jpy ?? '')
    setPensionMonthly(data.expected_pension_jpy_monthly ?? '')
    setSwrPct(data.swr_pct ?? '')
    setReturnPct(data.expected_return_real_pct ?? '')
    setEmergencyFund(data.emergency_fund_jpy ?? '')
    setLoading(false)
    setIsDirty(false)
  }

  async function handleSave() {
    setSaving(true)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('profiles')
      .update({
        birth_date: birthDate === '' ? null : birthDate,
        target_retirement_expenses_jpy: retirementExpenses === '' ? null : Number(retirementExpenses),
        expected_pension_jpy_monthly: pensionMonthly === '' ? null : Number(pensionMonthly),
        swr_pct: swrPct === '' ? null : Number(swrPct),
        expected_return_real_pct: returnPct === '' ? null : Number(returnPct),
        emergency_fund_jpy: emergencyFund === '' ? null : Number(emergencyFund),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    setSaving(false)
    if (error) {
      setMessage('Error: ' + error.message)
      return
    }

    setMessage('Saved.')
    setIsDirty(false)
    setTimeout(() => setMessage(''), 2000)
  }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-medium">Settings</h1>
          <a href="/" className="text-sm text-gray-600 underline">← Home</a>
        </div>

        <Section title="About you">
  <div>
    <label className="block text-sm text-gray-700 mb-1">Birth date</label>
    <input
      type="date"
      value={birthDate}
      onChange={(e) => { setBirthDate(e.target.value); setIsDirty(true) }}
      className="px-3 py-2 border rounded-md"
    />
    <p className="text-xs text-gray-500 mt-1">
      Used to project years to FIRE. Your age updates automatically.
    </p>
  </div>
</Section>

        <Section title="FIRE assumptions">
          <Field
            label="Safe withdrawal rate"
            value={swrPct}
            onChange={(v) => { setSwrPct(v); setIsDirty(true) }}
            suffix="%"
            step="0.1"
            hint="3.5% is the FIRE-community default. 4% is the original Trinity study. Lower = more conservative."
          />
          <Field
            label="Expected real return"
            value={returnPct}
            onChange={(v) => { setReturnPct(v); setIsDirty(true) }}
            suffix="%"
            step="0.1"
            hint="Real = after inflation. 4% is reasonable for a globally diversified equity portfolio."
          />
        </Section>

        <Section title="Retirement spending">
          <Field
            label="Monthly expenses in retirement"
            value={retirementExpenses}
            onChange={(v) => {setRetirementExpenses(v); setIsDirty(true) }}
            prefix="¥"
            hint="What you expect to spend per month after FIRE. Default assumes mortgage paid off."
          />
          <Field
            label="Expected pension at 65"
            value={pensionMonthly}
            onChange={(v) => { setPensionMonthly(v); setIsDirty(true) }}
            prefix="¥"
            suffix="/mo"
            hint="Monthly 厚生年金 payout. Check your nenkin teikibin (ねんきん定期便) for an estimate."
          />
        </Section>

        <Section title="Cash reserves">
          <Field
            label="Emergency fund target"
            value={emergencyFund}
            onChange={(v) => { setEmergencyFund(v); setIsDirty(true) }}
            prefix="¥"
            hint="Cash to keep liquid at all times. Excluded from investable assets in FIRE math."
          />
        </Section>

        <div className="mt-8 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-md disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          {message && <span className="text-sm text-gray-600">{message}</span>}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-8 bg-white rounded-lg p-6 shadow-sm">
      <h2 className="text-lg font-medium mb-4">{title}</h2>
      <div className="space-y-5">{children}</div>
    </div>
  )
}

function Field({ label, value, onChange, prefix, suffix, hint, step = '1' }) {
  const [focused, setFocused] = useState(false)
  const isPercent = step === '0.1'
  const display = focused || value === '' || value === null || value === undefined
    ? value
    : isPercent
    ? value
    : Number(value).toLocaleString('en-US')

  return (
    <div>
      <label className="block text-sm text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        {prefix && <span className="text-gray-500">{prefix}</span>}
        <input
          type="text"
          inputMode={isPercent ? 'decimal' : 'numeric'}
          value={display}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const allowed = isPercent ? /[^\d.-]/g : /[^\d-]/g
            const raw = e.target.value.replace(allowed, '')
            onChange(raw)
          }}
          className="flex-1 px-3 py-2 border rounded-md text-right"
        />
        {suffix && <span className="text-gray-500 text-sm w-12">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}