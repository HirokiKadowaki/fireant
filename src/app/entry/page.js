'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'

function EntryPageInner() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

const searchParams = useSearchParams()
const initialMonth = searchParams.get('month')
const [snapshotDate, setSnapshotDate] = useState(
  initialMonth ? `${initialMonth}-01` : firstOfThisMonth()
)
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [balances, setBalances] = useState({})
  const [amounts, setAmounts] = useState({})
  const [notes, setNotes] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [saveState, setSaveState] = useState('saved') // 'saved' | 'unsaved' | 'saving' | 'error'

  useUnsavedChanges(isDirty)

  useEffect(() => {
    loadData()
  }, [snapshotDate])

  // Auto-save 2 seconds after last change.
useEffect(() => {
  if (saveState !== 'unsaved') return  // doesn't retry from 'error' state
  const timer = setTimeout(() => {
    handleSave()
  }, 2000)
  return () => clearTimeout(timer)
}, [saveState, balances, amounts, notes])

  async function loadData() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: accountsData } = await supabase
      .from('accounts')
      .select('*')
      .eq('is_archived', false)
      .order('display_order')

    const { data: categoriesData } = await supabase
      .from('categories')
      .select('*')
      .eq('is_archived', false)
      .order('kind')
      .order('display_order')

    setAccounts(accountsData || [])
    setCategories(categoriesData || [])

    const { data: snapshot } = await supabase
      .from('monthly_snapshots')
      .select('id, notes')
      .eq('snapshot_date', snapshotDate)
      .maybeSingle()

    if (snapshot) {
      setNotes(snapshot.notes || '')
      const { data: balancesData } = await supabase
        .from('snapshot_balances')
        .select('account_id, balance_jpy')
        .eq('snapshot_id', snapshot.id)
      const balancesMap = {}
      balancesData?.forEach(b => { balancesMap[b.account_id] = b.balance_jpy })
      setBalances(balancesMap)

      const { data: amountsData } = await supabase
        .from('snapshot_amounts')
        .select('category_id, amount_jpy')
        .eq('snapshot_id', snapshot.id)
      const amountsMap = {}
      amountsData?.forEach(a => { amountsMap[a.category_id] = a.amount_jpy })
      setAmounts(amountsMap)
    } else {
      setNotes('')
      setBalances({})
      setAmounts({})
    }

    setLoading(false)
    setIsDirty(false)
  }

  async function handleSave() {
  setSaving(true)
  setSaveState('saving')
  setMessage('')

    const { data: { user } } = await supabase.auth.getUser()

    const { data: snapshot, error: snapshotError } = await supabase
      .from('monthly_snapshots')
      .upsert(
        { user_id: user.id, snapshot_date: snapshotDate, notes: notes || null },
        { onConflict: 'user_id,snapshot_date' }
      )
      .select()
      .single()

    if (snapshotError) {
      setMessage('Error: ' + snapshotError.message)
      setSaveState('error')
      setSaving(false)
      return
    }

// Build the rows we want to keep, and identify which ones to delete
const balanceRows = []
const balancesToDelete = []
for (const acc of accounts) {
  const v = balances[acc.id]
  if (v === '' || v === null || v === undefined) {
    balancesToDelete.push(acc.id)
  } else {
    balanceRows.push({
      snapshot_id: snapshot.id,
      account_id: acc.id,
      balance_jpy: Number(v)
    })
  }
}

if (balanceRows.length > 0) {
  const { error } = await supabase
    .from('snapshot_balances')
    .upsert(balanceRows, { onConflict: 'snapshot_id,account_id' })
  if (error) {
    setMessage('Error saving balances: ' + error.message)
    setSaveState('error')
    setSaving(false)
    return
  }
}

if (balancesToDelete.length > 0) {
  const { error } = await supabase
    .from('snapshot_balances')
    .delete()
    .eq('snapshot_id', snapshot.id)
    .in('account_id', balancesToDelete)
  if (error) {
    setMessage('Error clearing balances: ' + error.message)
    setSaveState('error')
    setSaving(false)
    return
  }
}

const amountRows = []
const amountsToDelete = []
for (const cat of categories) {
  const v = amounts[cat.id]
  if (v === '' || v === null || v === undefined) {
    amountsToDelete.push(cat.id)
  } else {
    amountRows.push({
      snapshot_id: snapshot.id,
      category_id: cat.id,
      amount_jpy: Number(v)
    })
  }
}

if (amountRows.length > 0) {
  const { error } = await supabase
    .from('snapshot_amounts')
    .upsert(amountRows, { onConflict: 'snapshot_id,category_id' })
  if (error) {
    setMessage('Error saving amounts: ' + error.message)
    setSaveState('error')
    setSaving(false)
    return
  }
}

if (amountsToDelete.length > 0) {
  const { error } = await supabase
    .from('snapshot_amounts')
    .delete()
    .eq('snapshot_id', snapshot.id)
    .in('category_id', amountsToDelete)
  if (error) {
    setMessage('Error clearing amounts: ' + error.message)
    setSaveState('error')
    setSaving(false)
    return
  }
}

    setIsDirty(false)
    setSaveState('saved')
    setSaving(false)
  }

  if (loading) return <div className="p-8">Loading...</div>

  const incomeCategories = categories.filter(c => c.kind === 'income')
  const expenseCategories = categories.filter(c => c.kind === 'expense')

  const totalAssets = Object.values(balances).reduce((sum, v) => sum + (Number(v) || 0), 0)
  const totalIncome = incomeCategories.reduce((sum, c) => sum + (Number(amounts[c.id]) || 0), 0)
  const totalExpenses = expenseCategories.reduce((sum, c) => sum + (Number(amounts[c.id]) || 0), 0)
  const cashFlow = totalIncome - totalExpenses

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-medium">Monthly entry</h1>
          <a href="/" className="text-sm text-gray-600 underline">← Home</a>
        </div>

        <div className="mb-8">
  <label className="block text-sm text-gray-600 mb-1">Month</label>
  <div className="flex items-center gap-2">
    <button
      type="button"
      onClick={() => setSnapshotDate(shiftMonth(snapshotDate, -1))}
      aria-label="Previous month"
      className="w-9 h-9 flex items-center justify-center border rounded-md hover:bg-gray-100"
    >
      ←
    </button>
    <input
      type="month"
      value={snapshotDate.slice(0, 7)}
      onChange={(e) => setSnapshotDate(e.target.value + '-01')}
      className="px-3 py-2 border rounded-md"
    />
    <button
      type="button"
      onClick={() => setSnapshotDate(shiftMonth(snapshotDate, 1))}
      aria-label="Next month"
      className="w-9 h-9 flex items-center justify-center border rounded-md hover:bg-gray-100"
    >
      →
    </button>
  </div>
</div>

        <Section title="Account balances">
          {accounts.map(acc => (
            <Field
              key={acc.id}
              label={acc.name}
              value={balances[acc.id] ?? ''}
              onChange={v => { setBalances({ ...balances, [acc.id]: v }); setIsDirty(true); setSaveState('unsaved') }}
            />
          ))}
          <Total label="Total assets" value={totalAssets} />
        </Section>

        <Section title="Income">
          {incomeCategories.map(cat => (
            <Field
              key={cat.id}
              label={cat.name}
              value={amounts[cat.id] ?? ''}
              onChange={v => { setAmounts({ ...amounts, [cat.id]: v }); setIsDirty(true); setSaveState('unsaved') }}
            />
          ))}
          <Total label="Total income" value={totalIncome} />
        </Section>

        <Section title="Expenses">
          {expenseCategories.map(cat => (
            <Field
              key={cat.id}
              label={cat.name}
              value={amounts[cat.id] ?? ''}
              onChange={v => { setAmounts({ ...amounts, [cat.id]: v }); setIsDirty(true); setSaveState('unsaved') }}
            />
          ))}
          <Total label="Total expenses" value={totalExpenses} />
        </Section>

        <Section title="Summary">
          <Total label="Cash flow this month" value={cashFlow} highlight />
        </Section>

        <div className="mb-6">
          <label className="block text-sm text-gray-600 mb-1">Notes (optional)</label>
          <textarea
  value={notes}
  onChange={(e) => { setNotes(e.target.value); setIsDirty(true); setSaveState('unsaved') }}
            rows={2}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div className="flex items-center gap-3">
  <button
    onClick={handleSave}
    disabled={saving || saveState === 'saved'}
    className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-md disabled:opacity-50"
  >
    {saveState === 'saving' ? 'Saving...' : 'Save now'}
  </button>
  <SaveIndicator state={saveState} />
  {message && <span className="text-sm text-red-600">{message}</span>}
</div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-medium mb-3">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Field({ label, value, onChange }) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')

  const display = focused
    ? draft
    : value === '' || value === null || value === undefined
    ? ''
    : Number(value).toLocaleString('en-US')

  function handleFocus() {
    setDraft(value === '' || value === null || value === undefined ? '' : String(value))
    setFocused(true)
  }

  function handleBlur() {
    const result = evaluateExpression(draft)
    if (result === null) {
      // Invalid expression — revert to the last good saved value.
      setFocused(false)
      return
    }
    onChange(result === '' ? '' : String(result))
    setFocused(false)
  }

  function handleChange(e) {
    setDraft(e.target.value)
  }

  return (
    <div className="flex items-center gap-3">
      <label className="text-sm text-gray-700 w-40">{label}</label>
      <span className="text-gray-500">¥</span>
      <input
        type="text"
        inputMode="tel"
        value={display}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        placeholder=""
        className="flex-1 px-3 py-2 border rounded-md text-right"
      />
    </div>
  )
}

function evaluateExpression(input) {
  const trimmed = String(input).trim()
  if (trimmed === '') return ''

  // Allow only digits, +, -, *, /, parentheses, decimal points, spaces.
  // This whitelist is the security: anything outside it is rejected.
  if (!/^[\d+\-*/().\s]+$/.test(trimmed)) {
    return null
  }

  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${trimmed})`)()
    if (typeof result !== 'number' || !isFinite(result)) return null
    return Math.round(result)
  } catch {
    return null
  }
}

function Total({ label, value, highlight }) {
  return (
    <div className={`flex items-center gap-3 pt-2 border-t ${highlight ? 'font-medium' : ''}`}>
      <label className="text-sm text-gray-700 w-40">{label}</label>
      <span className="text-gray-500">¥</span>
      <span className="flex-1 px-3 py-2 text-right">
        {value.toLocaleString('ja-JP')}
      </span>
    </div>
  )
}

function SaveIndicator({ state }) {
  if (state === 'saved') {
    return <span className="text-sm text-gray-500">✓ All changes saved</span>
  }
  if (state === 'saving') {
    return <span className="text-sm text-gray-500">Saving...</span>
  }
  if (state === 'error') {
    return <span className="text-sm text-red-600">Save failed — click Save now to retry</span>
  }
  return <span className="text-sm text-amber-600">Unsaved changes...</span>
}

function firstOfThisMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function shiftMonth(dateStr, delta) {
  const [year, month] = dateStr.slice(0, 7).split('-').map(Number)
  const d = new Date(year, month - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function EntryPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <EntryPageInner />
    </Suspense>
  )
}