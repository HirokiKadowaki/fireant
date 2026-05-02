'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function HistoryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [privateMode, setPrivateMode] = useState(false)

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const [snapshotsRes, balancesRes, amountsRes, accountsRes, categoriesRes, liabilitiesRes] = await Promise.all([
      supabase.from('monthly_snapshots').select('*').order('snapshot_date', { ascending: true }),
      supabase.from('snapshot_balances').select('*'),
      supabase.from('snapshot_amounts').select('*'),
      supabase.from('accounts').select('*'),
      supabase.from('categories').select('*'),
      supabase.from('liabilities').select('*'),
    ])

    setData({
      snapshots: snapshotsRes.data || [],
      balances: balancesRes.data || [],
      amounts: amountsRes.data || [],
      accounts: accountsRes.data || [],
      categories: categoriesRes.data || [],
      liabilities: liabilitiesRes.data || [],
    })
    setLoading(false)
  }

  if (loading) return <div className="p-8">Loading...</div>

  const rows = buildRows(data)

  return (
    <div className="min-h-screen p-6 md:p-8 bg-gray-50">
      <div className="max-w-5xl mx-auto">

        <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
  <h1 className="text-2xl font-medium">History</h1>
  <div className="flex items-center gap-4 text-sm">
    <button
      onClick={() => setPrivateMode(!privateMode)}
      aria-label={privateMode ? 'Show numbers' : 'Hide numbers'}
      title={privateMode ? 'Show numbers' : 'Hide numbers'}
      className="text-gray-600 hover:text-gray-900 text-base"
    >
      {privateMode ? '🐜' : '👁'}
    </button>
    <a href="/" className="text-gray-600 underline">← Home</a>
  </div>
</div>

        {rows.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center text-gray-500">
            No snapshots yet. <a href="/entry" className="underline">Enter your first month →</a>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <TrendCard title="Net worth" rows={rows} field="netWorth" formatY={formatM} hide={privateMode} />
<TrendCard title="Savings rate" rows={rows} field="savingsRate" formatY={(v) => `${v.toFixed(0)}%`} hide={privateMode} />
<TrendCard title="Monthly saved" rows={rows} field="saved" formatY={formatM} hide={privateMode} />
            </div>

            <div className="bg-white rounded-lg p-5 mb-6">
              <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <p className="text-sm font-medium">All snapshots</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => downloadCsv('fireant-summary.csv', buildSummaryCsv(rows))}
                    className="text-sm px-3 py-1.5 border rounded-md hover:bg-gray-50"
                  >
                    Export summary CSV
                  </button>
                  <button
                    onClick={() => downloadCsv('fireant-detail.csv', buildDetailCsv(data))}
                    className="text-sm px-3 py-1.5 border rounded-md hover:bg-gray-50"
                  >
                    Export detail CSV
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-gray-500 border-b">
                    <tr>
                      <th className="py-2 pr-4">Month</th>
                      <th className="py-2 pr-4 text-right">Income</th>
                      <th className="py-2 pr-4 text-right">Expenses</th>
                      <th className="py-2 pr-4 text-right">Saved</th>
                      <th className="py-2 pr-4 text-right">Savings rate</th>
                      <th className="py-2 pr-4 text-right">Assets</th>
                      <th className="py-2 pr-4 text-right">Net worth</th>
                      <th className="py-2 pr-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                     {[...rows].reverse().map(r => (
  <tr key={r.date} className="border-b last:border-0 hover:bg-gray-50">
    <td className="py-2 pr-4 font-medium">{formatMonthName(r.date)}</td>
    <td className="py-2 pr-4 text-right">
      <Hidden hide={privateMode}>¥{r.income.toLocaleString('en-US')}</Hidden>
    </td>
    <td className="py-2 pr-4 text-right">
      <Hidden hide={privateMode}>¥{r.expenses.toLocaleString('en-US')}</Hidden>
    </td>
    <td className={`py-2 pr-4 text-right ${r.saved >= 0 ? 'text-red-700' : 'text-gray-500'}`}>
      <Hidden hide={privateMode}>¥{r.saved.toLocaleString('en-US')}</Hidden>
    </td>
    <td className="py-2 pr-4 text-right">
      <Hidden hide={privateMode}>{r.savingsRate.toFixed(0)}%</Hidden>
    </td>
    <td className="py-2 pr-4 text-right">
      <Hidden hide={privateMode}>¥{r.totalAssets.toLocaleString('en-US')}</Hidden>
    </td>
    <td className={`py-2 pr-4 text-right ${r.netWorth >= 0 ? '' : 'text-gray-500'}`}>
      <Hidden hide={privateMode}>¥{r.netWorth.toLocaleString('en-US')}</Hidden>
    </td>
    <td className="py-2 pr-4 text-right">
      <a
        href={`/entry?month=${r.date.slice(0, 7)}`}
        className="text-xs text-gray-600 underline"
      >
        Edit
      </a>
    </td>
  </tr>
))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function TrendCard({ title, rows, field, formatY, hide }) {
  if (rows.length === 0) return null
  const values = rows.map(r => r[field])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const xScale = (i) => 30 + (i / Math.max(1, rows.length - 1)) * 240
  const yScale = (v) => 80 - ((v - min) / range) * 60

  const path = rows.map((r, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(r[field])}`).join(' ')
  const last = rows[rows.length - 1]

  return (
    <div className="bg-white rounded-lg p-4">
      <p className="text-xs text-gray-500 mb-1">{title}</p>
      <p className="text-lg font-medium mb-2">
        <Hidden hide={hide}>{formatY(last[field])}</Hidden>
      </p>
      <svg viewBox="0 0 280 100" className="w-full h-auto" style={hide ? { filter: 'blur(4px)' } : {}}>
        <line x1="30" y1="80" x2="270" y2="80" stroke="#e5e7eb" strokeWidth="0.5"/>
        <path d={path} fill="none" stroke="#dc2626" strokeWidth="1.5"/>
        {rows.map((r, i) => (
          <circle key={r.date} cx={xScale(i)} cy={yScale(r[field])} r="2" fill="#dc2626"/>
        ))}
      </svg>
      <p className="text-xs text-gray-500 mt-1">
        {formatMonthShort(rows[0].date)} → {formatMonthShort(last.date)}
      </p>
    </div>
  )
}

function buildRows(data) {
  const { snapshots, balances, amounts, accounts, categories, liabilities } = data

  const accountById = new Map(accounts.map(a => [a.id, a]))
  const categoryById = new Map(categories.map(c => [c.id, c]))

  // Total liabilities are constant for now (we don't track historical liability balances)
  const totalLiabilities = liabilities.reduce((s, l) => s + Number(l.principal_jpy || 0), 0)

  return snapshots.map(s => {
    const myBalances = balances.filter(b => b.snapshot_id === s.id)
    const myAmounts = amounts.filter(a => a.snapshot_id === s.id)

    const totalAssets = myBalances.reduce((sum, b) => sum + Number(b.balance_jpy), 0)

    const income = myAmounts
      .filter(a => categoryById.get(a.category_id)?.kind === 'income')
      .reduce((sum, a) => sum + Number(a.amount_jpy), 0)
    const expenses = myAmounts
      .filter(a => categoryById.get(a.category_id)?.kind === 'expense')
      .reduce((sum, a) => sum + Number(a.amount_jpy), 0)
    const saved = income - expenses
    const savingsRate = income > 0 ? (saved / income) * 100 : 0

    return {
      date: s.snapshot_date,
      income,
      expenses,
      saved,
      savingsRate,
      totalAssets,
      netWorth: totalAssets - totalLiabilities,
    }
  })
}

function buildSummaryCsv(rows) {
  const headers = ['month', 'income_jpy', 'expenses_jpy', 'saved_jpy', 'savings_rate_pct', 'total_assets_jpy', 'net_worth_jpy']
  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push([
      r.date,
      r.income,
      r.expenses,
      r.saved,
      r.savingsRate.toFixed(2),
      r.totalAssets,
      r.netWorth,
    ].join(','))
  }
  return lines.join('\n')
}

function buildDetailCsv(data) {
  const { snapshots, balances, amounts, accounts, categories } = data
  const accountById = new Map(accounts.map(a => [a.id, a]))
  const categoryById = new Map(categories.map(c => [c.id, c]))
  const snapshotById = new Map(snapshots.map(s => [s.id, s]))

  const headers = ['month', 'kind', 'name', 'amount_jpy']
  const lines = [headers.join(',')]

  for (const b of balances) {
    const s = snapshotById.get(b.snapshot_id)
    const acc = accountById.get(b.account_id)
    if (!s || !acc) continue
    lines.push([
      s.snapshot_date,
      'balance',
      escapeCsv(acc.name),
      b.balance_jpy,
    ].join(','))
  }

  for (const a of amounts) {
    const s = snapshotById.get(a.snapshot_id)
    const cat = categoryById.get(a.category_id)
    if (!s || !cat) continue
    lines.push([
      s.snapshot_date,
      cat.kind,
      escapeCsv(cat.name),
      a.amount_jpy,
    ].join(','))
  }

  return lines.join('\n')
}

function escapeCsv(s) {
  if (s == null) return ''
  const str = String(s)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function downloadCsv(filename, content) {
  // Add BOM so Excel opens UTF-8 (Japanese characters) correctly
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function formatMonthName(dateStr) {
  if (!dateStr) return ''
  const [year, month] = dateStr.split('-').map(Number)
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${monthNames[month - 1]} ${year}`
}

function formatMonthShort(dateStr) {
  if (!dateStr) return ''
  const [year, month] = dateStr.split('-').map(Number)
  const short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${short[month - 1]} ${year}`
}

function Hidden({ children, hide }) {
  if (!hide) return <>{children}</>
  return (
    <span className="select-none" style={{ filter: 'blur(6px)' }}>
      {children}
    </span>
  )
}

function formatM(value) {
  const millions = value / 1_000_000
  if (Math.abs(millions) >= 100) return `¥${millions.toFixed(0)}M`
  return `¥${millions.toFixed(1)}M`
}