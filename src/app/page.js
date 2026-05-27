'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { projectToFire, coastFireAge, savingsRate } from '@/lib/fire'

export default function HomePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [privateMode, setPrivateMode] = useState(false)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const [profileRes, accountsRes, liabilitiesRes, snapshotsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('accounts').select('*').eq('is_archived', false).order('display_order'),
      supabase.from('liabilities').select('*').eq('is_archived', false),
      supabase.from('monthly_snapshots').select('id, snapshot_date, ai_insight, ai_insight_generated_at').order('snapshot_date', { ascending: false }).limit(6),
    ])

    const profile = profileRes.data
    const accounts = accountsRes.data || []
    const liabilities = liabilitiesRes.data || []
    const recentSnapshots = snapshotsRes.data || []

    let latestSnapshotData = null
    if (recentSnapshots.length > 0) {
      const ids = recentSnapshots.map(s => s.id)
      const [balancesRes, amountsRes, categoriesRes] = await Promise.all([
        supabase.from('snapshot_balances').select('*').in('snapshot_id', ids),
        supabase.from('snapshot_amounts').select('*').in('snapshot_id', ids),
        supabase.from('categories').select('*'),
      ])
      latestSnapshotData = {
        snapshots: recentSnapshots,
        balances: balancesRes.data || [],
        amounts: amountsRes.data || [],
        categories: categoriesRes.data || [],
      }
    }

    setData({ profile, accounts, liabilities, latestSnapshotData })
    setLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div className="p-8">Loading...</div>

  const dashboard = computeDashboard(data)

  return (
    <div className="min-h-screen p-6 md:p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">

        <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
          <h1 className="text-xl font-medium"><span className="text-red-700">Fire</span>Ant</h1>
          <div className="flex items-center gap-4 text-sm flex-wrap">
  <button
    onClick={() => setPrivateMode(!privateMode)}
    aria-label={privateMode ? 'Show numbers' : 'Hide numbers'}
    title={privateMode ? 'Show numbers' : 'Hide numbers'}
    className="text-gray-600 hover:text-gray-900 text-base"
  >
    {privateMode ? '🐜' : '👁'}
  </button>
<a href="/history" className="text-gray-600 underline">History</a>
<a href="/entry" className="text-gray-600 underline">Entry</a>
<a href="/liabilities" className="text-gray-600 underline">Liabilities</a>
<a href="/settings" className="text-gray-600 underline">Settings</a>
  <button onClick={handleSignOut} className="text-gray-600 underline">Sign out</button>
</div>
        </div>

        {!dashboard.hasData ? (
          <NoDataState />
        ) : (
          <DashboardContent dashboard={dashboard} privateMode={privateMode} />
        )}
      </div>
    </div>
  )
}

function NoDataState() {
  return (
    <div className="bg-white rounded-lg p-12 text-center">
      <h2 className="text-lg font-medium mb-2">No data yet</h2>
      <p className="text-gray-600 mb-4">
        Enter your first monthly snapshot to see your FIRE projection.
      </p>
      <a href="/entry" className="inline-block px-4 py-2 bg-red-700 text-white rounded-md text-sm">
        Enter this month →
      </a>
    </div>
  )
}

function DashboardContent({ dashboard, privateMode }) {
  const { headline, metrics, projection, bridge, currentMonth, latestMonth, accounts, staleness } = dashboard

  return (
    <div className="space-y-4">
      <StalenessBanner staleness={staleness} />
      <VoiceAssistant dashboard={dashboard} />

      <div className="bg-white rounded-lg p-6">
        <p className="text-xs text-gray-500 mb-1">
          FIRE projection · age {headline.age} · <Hidden hide={privateMode}>¥{headline.investedAssets.toLocaleString('en-US')}</Hidden> invested
        </p>
        <h2 className="text-2xl font-medium">
          {headline.fireAgeMin && headline.fireAgeMax
            ? <>FIRE between age <span className="text-red-700">{Math.floor(headline.fireAgeMin)} and {Math.ceil(headline.fireAgeMax)}</span></>
            : 'FIRE projection unavailable'}
        </h2>
        {headline.expectedFireAge && (
          <p className="text-sm text-gray-600 mt-2">
            Expected: <span className="font-medium text-gray-900">age {headline.expectedFireAge.toFixed(1)} (in {headline.expectedYears.toFixed(1)} years)</span> · {headline.swr}% SWR · pension at 65
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
       <MetricCard label="Net worth" value={formatM(metrics.netWorth)} hint={metrics.netWorth >= 0 ? null : 'negative · early in mortgage'} hide={privateMode} />
<MetricCard label="FIRE number" value={formatM(metrics.fireNumber)} hint={`${metrics.percentToFire.toFixed(0)}% there`} hide={privateMode} />
<MetricCard label="Savings rate" value={`${metrics.savingsRate.toFixed(0)}%`} hint="last complete month" hide={privateMode} />
<MetricCard label="Coast FIRE" value={metrics.coastFireAge ? `age ${metrics.coastFireAge}` : '—'} hint="stop saving, retire 65" hide={privateMode} />
      </div>

      <div className="bg-white rounded-lg p-6">
        <div className="flex justify-between items-baseline mb-4">
          <p className="text-sm font-medium">Path to FIRE</p>
          <p className="text-xs text-gray-500">real yen · 4% expected return</p>
        </div>
        <ProjectionChart data={projection} fireNumber={metrics.fireNumber} privateMode={privateMode} />
      </div>

      {bridge && (
        <div className="bg-amber-50 rounded-lg p-5">
          <p className="text-sm font-medium text-amber-900 mb-1">
            Bridge check · age {bridge.fireAge} → {bridge.unlockAge}
          </p>
          <p className="text-sm text-amber-900 leading-relaxed">
  <Hidden hide={privateMode}>¥{(bridge.lockedAtFire / 1_000_000).toFixed(1)}M</Hidden> will be locked in 確定拠出年金 until age 60.
  You need <Hidden hide={privateMode}>¥{(bridge.expensesNeeded / 1_000_000).toFixed(1)}M</Hidden> in liquid accounts to bridge {bridge.yearsToBridge} years.
  Projected liquid at FIRE: <Hidden hide={privateMode}>¥{(bridge.liquidAtFire / 1_000_000).toFixed(1)}M</Hidden>.
  {bridge.shortfall > 0
    ? <span className="font-medium"> Shortfall: <Hidden hide={privateMode}>¥{(bridge.shortfall / 1_000_000).toFixed(1)}M</Hidden>.</span>
    : <span className="font-medium"> On track.</span>}
</p>
        </div>
      )}
      {latestMonth && <InsightCard latestMonth={latestMonth} dashboard={dashboard} />}

      <div className="bg-white rounded-lg p-5">
        <p className="text-sm font-medium mb-3">Accounts</p>
        <div className="space-y-2 text-sm">
  {accounts.map(a => (
    <div key={a.id} className="flex justify-between">
      <span className="text-gray-600">{a.name}</span>
      <span className="font-medium">
        <Hidden hide={privateMode}>¥{a.balance.toLocaleString('en-US')}</Hidden>
      </span>
    </div>
  ))}
</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MonthPanel
  title={`This month · ${formatMonthName(currentMonth.date)}`}
  income={currentMonth.income}
  expenses={currentMonth.expenses}
  saved={currentMonth.saved}
  isEmpty={currentMonth.isEmpty}
  hide={privateMode}
/>
{latestMonth && (
  <MonthPanel
    title={`Last complete month · ${formatMonthName(latestMonth.date)}`}
    income={latestMonth.income}
    expenses={latestMonth.expenses}
    saved={latestMonth.saved}
    hide={privateMode}
  />
)}
      </div>

    </div>
  )
}

function MonthPanel({ title, income, expenses, saved, isEmpty, hide }) {
  return (
    <div className="bg-white rounded-lg p-5">
      <p className="text-sm font-medium mb-3">{title}</p>
      {isEmpty ? (
        <p className="text-sm text-gray-500 italic">No entries yet.</p>
      ) : (
        <div className="space-y-2 text-sm">
          <Row label="Income" value={income} color="text-green-700" hide={hide} />
          <Row label="Expenses" value={expenses} hide={hide} />
          <Row label="Saved" value={saved} color={saved >= 0 ? 'text-red-700' : 'text-gray-700'} bold hide={hide} />
        </div>
      )}
    </div>
  )
}

function StalenessBanner({ staleness }) {
  if (!staleness || staleness.daysOld === null || staleness.daysOld < 45) {
    return null
  }

  const { daysOld } = staleness
  const isOverdue = daysOld > 60

  const bannerClass = isOverdue
    ? 'bg-amber-50 text-amber-900'
    : 'bg-gray-100 text-gray-700'

  const message = isOverdue
    ? `Last entry was ${daysOld} days ago. Numbers above may be stale.`
    : `Last entry was ${daysOld} days ago. Time for a monthly update?`

  return (
    <div className={`${bannerClass} rounded-lg px-4 py-3 flex items-center justify-between gap-3 text-sm`}>
      <span>{message}</span>
      <a href="/entry" className="font-medium underline whitespace-nowrap">
        Enter now →
      </a>
    </div>
  )
}

function ProjectionChart({ data, fireNumber, privateMode }) {
  if (!data || !data.expected || data.expected.length === 0) {
    return <p className="text-sm text-gray-500">Not enough data to project.</p>
  }

  const points = data.expected
  const allValues = [
    ...data.conservative.map(p => p.total),
    ...data.optimistic.map(p => p.total),
    fireNumber,
  ]
  const maxValue = Math.max(...allValues) * 1.05
  const maxYears = Math.max(...points.map(p => p.year)) || 1

  const xScale = (year) => 40 + (year / maxYears) * 540
  const yScale = (value) => 170 - (value / maxValue) * 150

  const pathFor = (series) =>
    series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.year)} ${yScale(p.total)}`).join(' ')

  const fireY = yScale(fireNumber)

  let crossoverPoint = null
  if (data.expectedFireAge && data.expectedFireAge > data.startAge) {
    const yearsToFire = data.expectedFireAge - data.startAge
    if (yearsToFire <= maxYears) {
      crossoverPoint = {
        x: xScale(yearsToFire),
        y: fireY,
        age: data.expectedFireAge,
      }
    }
  }

  let unlockMarker = null
  const yearsToUnlock = 60 - data.startAge
  if (yearsToUnlock > 0 && yearsToUnlock <= maxYears) {
    unlockMarker = {
      x: xScale(yearsToUnlock),
    }
  }

  return (
    <svg viewBox="0 0 600 210" className="w-full h-auto">
      <line x1="40" y1="170" x2="580" y2="170" stroke="#e5e7eb" strokeWidth="0.5"/>
      <line x1="40" y1="20" x2="40" y2="170" stroke="#e5e7eb" strokeWidth="0.5"/>

      {unlockMarker && (
        <>
          <line
            x1={unlockMarker.x} y1="20"
            x2={unlockMarker.x} y2="170"
            stroke="#6b7280" strokeWidth="0.5" strokeDasharray="2,3" opacity="0.6"
          />
          <text x={unlockMarker.x + 3} y="30" fontSize="9" fill="#6b7280">
            age 60 · DC unlocks
          </text>
        </>
      )}

      <line x1="40" y1={fireY} x2="580" y2={fireY} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.6"/>
      <text x="45" y={fireY - 4} fontSize="10" fill="#dc2626" fontWeight="500">
  {privateMode ? 'FIRE: ¥••' : `FIRE: ¥${(fireNumber / 1_000_000).toFixed(0)}M`}
</text>

      <path d={pathFor(data.conservative)} fill="none" stroke="#9ca3af" strokeWidth="1.2" opacity="0.7"/>
      <path d={pathFor(data.optimistic)} fill="none" stroke="#9ca3af" strokeWidth="1.2" opacity="0.7"/>
      <path d={pathFor(data.expected)} fill="none" stroke="#dc2626" strokeWidth="2"/>

      {crossoverPoint && (
        <>
          <circle
            cx={crossoverPoint.x} cy={crossoverPoint.y}
            r="4" fill="#dc2626"
          />
          <text
            x={crossoverPoint.x + 8} y={crossoverPoint.y + 4}
            fontSize="11" fill="#111827" fontWeight="500"
          >
            age {crossoverPoint.age.toFixed(1)}
          </text>
        </>
      )}

      <text x="40" y="195" fontSize="10" fill="#6b7280">{data.startAge}</text>
      <text x="200" y="195" fontSize="10" fill="#6b7280">{Math.round(data.startAge + maxYears * 0.3)}</text>
      <text x="360" y="195" fontSize="10" fill="#6b7280">{Math.round(data.startAge + maxYears * 0.6)}</text>
      <text x="520" y="195" fontSize="10" fill="#6b7280">{Math.round(data.startAge + maxYears * 0.9)}</text>
    </svg>
  )
}

function MetricCard({ label, value, hint, hide }) {
  return (
    <div className="bg-white rounded-lg p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-medium">
        <Hidden hide={hide}>{value}</Hidden>
      </p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

function Row({ label, value, color, bold, hide }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}</span>
      <span className={`${color || ''} ${bold ? 'font-medium' : ''}`}>
        <Hidden hide={hide}>¥{Number(value).toLocaleString('en-US')}</Hidden>
      </span>
    </div>
  )
}

function formatMonthName(dateStr) {
  if (!dateStr) return ''
  const [year, month] = dateStr.split('-').map(Number)
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${monthNames[month - 1]} ${year}`
}

function daysSince(dateStr) {
  if (!dateStr) return null
  const then = new Date(dateStr)
  const now = new Date()
  const diffMs = now - then
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

function formatM(value) {
  const millions = value / 1_000_000
  if (Math.abs(millions) >= 100) return `¥${millions.toFixed(0)}M`
  return `¥${millions.toFixed(1)}M`
}

function calcCost(usage) {
  // Sonnet 4.6 pricing as of early 2026: $3/MTok input, $15/MTok output
  const inputCost = (usage.input_tokens / 1_000_000) * 3
  const outputCost = (usage.output_tokens / 1_000_000) * 15
  return inputCost + outputCost
}

function Hidden({ children, hide }) {
  if (!hide) return <>{children}</>
  return (
    <span className="select-none" style={{ filter: 'blur(6px)' }}>
      {children}
    </span>
  )
}

function computeAge(birthDateStr) {
  if (!birthDateStr) return 30
  const today = new Date()
  const birth = new Date(birthDateStr)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

function todaySnapshotDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function summarizeSnapshot(snapshotId, latestSnapshotData, incomeIds, expenseIds) {
  const amounts = latestSnapshotData.amounts.filter(a => a.snapshot_id === snapshotId)
  const income = amounts.filter(a => incomeIds.has(a.category_id)).reduce((s, a) => s + Number(a.amount_jpy), 0)
  const expenses = amounts.filter(a => expenseIds.has(a.category_id)).reduce((s, a) => s + Number(a.amount_jpy), 0)
  return { income, expenses, saved: income - expenses }
}

function computeDashboard(data) {
  const { profile, accounts, liabilities, latestSnapshotData } = data

  if (!latestSnapshotData || latestSnapshotData.snapshots.length === 0) {
    return { hasData: false }
  }

  const today = todaySnapshotDate()

  // Find the latest snapshot with actual balance data — used for accounts and net worth
  const latestSnapshotWithData = latestSnapshotData.snapshots.find(s =>
    latestSnapshotData.balances.some(b => b.snapshot_id === s.id)
  ) || latestSnapshotData.snapshots[0]

  // Categories
  const incomeCategories = latestSnapshotData.categories.filter(c => c.kind === 'income')
  const expenseCategories = latestSnapshotData.categories.filter(c => c.kind === 'expense')
  const incomeIds = new Set(incomeCategories.map(c => c.id))
  const expenseIds = new Set(expenseCategories.map(c => c.id))

  // Current month: in-progress, may or may not have data
  const currentSnapshot = latestSnapshotData.snapshots.find(s => s.snapshot_date === today)
  const currentMonth = currentSnapshot
    ? { date: today, isEmpty: false, ...summarizeSnapshot(currentSnapshot.id, latestSnapshotData, incomeIds, expenseIds) }
    : { date: today, isEmpty: true, income: 0, expenses: 0, saved: 0 }

  // Latest complete month: most recent snapshot before this month, with at least some data
  const latestCompleteSnapshot = latestSnapshotData.snapshots.find(s =>
    s.snapshot_date < today &&
    (latestSnapshotData.balances.some(b => b.snapshot_id === s.id) ||
     latestSnapshotData.amounts.some(a => a.snapshot_id === s.id))
  )
const latestMonth = latestCompleteSnapshot
  ? {
      id: latestCompleteSnapshot.id,
      date: latestCompleteSnapshot.snapshot_date,
      aiInsight: latestCompleteSnapshot.ai_insight,
      aiInsightGeneratedAt: latestCompleteSnapshot.ai_insight_generated_at,
      ...summarizeSnapshot(latestCompleteSnapshot.id, latestSnapshotData, incomeIds, expenseIds)
    }
  : null

  // Account balances from the most recent snapshot with balance data
  const latestBalances = latestSnapshotData.balances.filter(b => b.snapshot_id === latestSnapshotWithData.id)
  const accountBalances = accounts.map(acc => {
    const bal = latestBalances.find(b => b.account_id === acc.id)
    return { ...acc, balance: bal ? Number(bal.balance_jpy) : 0 }
  })

  const totalAssets = accountBalances.reduce((s, a) => s + a.balance, 0)
  const totalLiabilities = liabilities.reduce((s, l) => s + Number(l.principal_jpy), 0)
  const netWorth = totalAssets - totalLiabilities

  const emergencyFund = Number(profile?.emergency_fund_jpy || 0)
  const cashAccounts = accountBalances.filter(a => a.type === 'savings').reduce((s, a) => s + a.balance, 0)
  const cashAboveEmergency = Math.max(0, cashAccounts - emergencyFund)
  const investableLiquid = accountBalances
    .filter(a => a.type === 'nisa' || a.type === 'taxable')
    .reduce((s, a) => s + a.balance, 0) + cashAboveEmergency
  const investableLocked = accountBalances
    .filter(a => a.is_locked_until_60)
    .reduce((s, a) => s + a.balance, 0)
  const investedAssets = investableLiquid + investableLocked

  // Average contribution from up to 3 most recent COMPLETE (non-current) months
  const completeSnapshots = latestSnapshotData.snapshots.filter(s => s.snapshot_date < today).slice(0, 3)
  const recentSavings = completeSnapshots.map(s => summarizeSnapshot(s.id, latestSnapshotData, incomeIds, expenseIds).saved)
  const avgMonthlyContribution = recentSavings.length > 0
    ? recentSavings.reduce((s, v) => s + v, 0) / recentSavings.length
    : 0
    // Compute baseline averages from completed snapshots (for AI insight)
const completeSummaries = completeSnapshots.map(s => summarizeSnapshot(s.id, latestSnapshotData, incomeIds, expenseIds))
const avgIncome = completeSummaries.length > 0
  ? Math.round(completeSummaries.reduce((sum, s) => sum + s.income, 0) / completeSummaries.length)
  : 0
const avgExpenses = completeSummaries.length > 0
  ? Math.round(completeSummaries.reduce((sum, s) => sum + s.expenses, 0) / completeSummaries.length)
  : 0
const avgSavingsRate = avgIncome > 0
  ? Math.round(((avgIncome - avgExpenses) / avgIncome) * 100)
  : 0

// Build category breakdown for the latest complete month
let latestExpenseBreakdown = {}
if (latestCompleteSnapshot) {
  const myAmounts = latestSnapshotData.amounts.filter(a => a.snapshot_id === latestCompleteSnapshot.id)
  for (const a of myAmounts) {
    const cat = latestSnapshotData.categories.find(c => c.id === a.category_id)
    if (cat?.kind === 'expense' && Number(a.amount_jpy) > 0) {
      latestExpenseBreakdown[cat.name] = Number(a.amount_jpy)
    }
  }
}

  const age = computeAge(profile?.birth_date)

  const fireInputs = {
    age,
    swrPct: Number(profile?.swr_pct) || 3.5,
    expectedReturnPct: Number(profile?.expected_return_real_pct) || 4.0,
    retirementExpensesMonthly: Number(profile?.target_retirement_expenses_jpy) || 450000,
    pensionMonthly: Number(profile?.expected_pension_jpy_monthly) || 150000,
    liquidAssets: investableLiquid,
    lockedAssets: investableLocked,
    monthlyContribution: Math.max(0, avgMonthlyContribution),
    contributionToLocked: 0,
  }

  const projection = projectToFire(fireInputs)
  const coastAge = coastFireAge(fireInputs)

  const expectedScenario = projection.scenarios.expected
  const conservativeScenario = projection.scenarios.conservative
  const optimisticScenario = projection.scenarios.optimistic

  const bridge = expectedScenario.bridgeAnalysis ? {
    fireAge: expectedScenario.fireAge,
    unlockAge: 60,
    yearsToBridge: expectedScenario.bridgeAnalysis.yearsToBridge,
    liquidAtFire: expectedScenario.bridgeAnalysis.liquidAtFire,
    lockedAtFire: expectedScenario.bridgeAnalysis.lockedAtFire,
    expensesNeeded: expectedScenario.bridgeAnalysis.expensesNeeded,
    shortfall: expectedScenario.bridgeAnalysis.shortfall,
  } : null

  // Savings rate: from latest complete month if available, else 0
  const latestSavingsRate = latestMonth
    ? savingsRate(latestMonth.income, latestMonth.expenses)
    : 0
const latestSnapshotDate = latestMonth?.date || latestSnapshotWithData?.snapshot_date || null
const daysOld = daysSince(latestSnapshotDate)
  return {
    hasData: true,
    headline: {
      age,
      investedAssets,
      fireAgeMin: optimisticScenario.fireAge,
      fireAgeMax: conservativeScenario.fireAge,
      expectedFireAge: expectedScenario.fireAge,
      expectedYears: expectedScenario.yearsToFire,
      swr: profile?.swr_pct ?? 3.5,
    },
    metrics: {
      netWorth,
      fireNumber: projection.fireNumber,
      percentToFire: projection.fireNumber > 0 ? (investedAssets / projection.fireNumber) * 100 : 0,
      savingsRate: latestSavingsRate,
      coastFireAge: coastAge,
    },
    projection: {
      conservative: conservativeScenario.trajectory,
      expected: expectedScenario.trajectory,
      optimistic: optimisticScenario.trajectory,
      expectedFireAge: expectedScenario.fireAge,
      startAge: age,
    },
    bridge,
    currentMonth,
    latestMonth,
    accounts: accountBalances,
    staleness: {
      latestDate: latestSnapshotDate,
      daysOld,
    },
    baseline: {
  avgIncome,
  avgExpenses,
  avgSavingsRate,
  monthsAveraged: completeSummaries.length,
},
latestExpenseBreakdown,
  }
}

function InsightCard({ latestMonth, dashboard }) {
  const [insight, setInsight] = useState(latestMonth.aiInsight)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUsage, setLastUsage] = useState(null)

  async function generateInsight() {
    setLoading(true)
    setError(null)

    try {
      const payload = buildInsightPayload(dashboard)
      const response = await fetch('/api/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate insight')
      }

      // Save to database via Supabase
      const { error: dbError } = await supabase
        .from('monthly_snapshots')
        .update({
          ai_insight: result.reply,
          ai_insight_generated_at: new Date().toISOString(),
        })
        .eq('id', latestMonth.id)

      if (dbError) throw new Error(dbError.message)

      setInsight(result.reply)
      setLastUsage(result.usage)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg p-5">
      <div className="flex justify-between items-center mb-2">
        <p className="text-sm font-medium">Monthly Insight</p>
        {insight && (
          <button
            onClick={generateInsight}
            disabled={loading}
            className="text-xs text-gray-500 underline disabled:opacity-50"
          >
            {loading ? 'Regenerating...' : 'Regenerate'}
          </button>
        )}
      </div>
      {insight ? (
  <>
    <p className="text-sm text-gray-700 leading-relaxed">{insight}</p>
    {lastUsage && (
      <p className="text-xs text-gray-400 mt-2">
        {lastUsage.input_tokens.toLocaleString()} input tokens · {lastUsage.output_tokens.toLocaleString()} output tokens · ~${calcCost(lastUsage).toFixed(4)}
      </p>
    )}
  </>
) : (
        <div>
          <p className="text-sm text-gray-500 mb-3">
            Get an AI-written summary of how your last complete month compared to your baseline.
          </p>
          <button
            onClick={generateInsight}
            disabled={loading}
            className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white text-sm rounded-md disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate insight'}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}

function buildVoiceContext(dashboard) {
  if (!dashboard?.hasData) return null

  const { metrics, headline, latestMonth, currentMonth, baseline, latestExpenseBreakdown, accounts } = dashboard

  // Get today's month label
  const now = new Date()
  const currentMonthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  return {
    todayDate: new Date().toISOString().split('T')[0],
    currentMonthInProgress: currentMonth ? {
      date: currentMonth.date,
      label: 'current month (in progress, may be partial)',
      income: currentMonth.income,
      expenses: currentMonth.expenses,
      saved: currentMonth.saved,
      isEmpty: currentMonth.isEmpty,
    } : null,
    latestCompleteMonth: latestMonth ? {
      date: latestMonth.date,
      label: 'latest fully-closed month',
      income: latestMonth.income,
      expenses: latestMonth.expenses,
      saved: latestMonth.saved,
      savingsRate: metrics.savingsRate,
      expenseBreakdown: latestExpenseBreakdown || {},
    } : null,
    baseline: baseline ? {
      avgIncome: baseline.avgIncome,
      avgExpenses: baseline.avgExpenses,
      avgSavingsRate: baseline.avgSavingsRate,
      monthsAveraged: baseline.monthsAveraged,
    } : null,
    fireProjection: {
      expectedFireAge: headline.expectedFireAge,
      fireAgeRange: `${Math.floor(headline.fireAgeMin)} to ${Math.ceil(headline.fireAgeMax)}`,
      yearsToFire: headline.expectedYears,
      fireNumber: metrics.fireNumber,
      currentAge: headline.age,
      investedAssets: headline.investedAssets,
      netWorth: metrics.netWorth,
      percentToFire: metrics.percentToFire,
      swrPct: headline.swr,
    },
    accounts: accounts.map(a => ({
      name: a.name,
      type: a.type,
      balance: a.balance,
      isLocked: a.is_locked_until_60,
    })),
  }
}

function VoiceAssistant({ dashboard }) {
  const [state, setState] = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const audioRef = useRef(null)

  async function startRecording() {
    try {
      setState('recording')
      setTranscript('')
      setAnswer('')
      setError('')
      chunksRef.current = []

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.start()
    } catch (err) {
      setError('Microphone access denied. Please allow microphone in browser settings.')
      setState('idle')
    }
  }

  async function stopRecording() {
    if (!mediaRecorderRef.current) return
    setState('processing')

    return new Promise((resolve) => {
      mediaRecorderRef.current.onstop = async () => {
        const stream = mediaRecorderRef.current.stream
        stream.getTracks().forEach(t => t.stop())

        try {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
          await processVoice(audioBlob)
        } catch (err) {
          setError(err.message)
          setState('idle')
        }
        resolve()
      }
      mediaRecorderRef.current.stop()
    })
  }

  async function processVoice(audioBlob) {
    // Step 1: Transcribe
    const formData = new FormData()
    formData.append('audio', audioBlob, 'recording.webm')

    const transcribeRes = await fetch('/api/voice/transcribe', {
      method: 'POST',
      body: formData,
    })
    const { text, error: transcribeError } = await transcribeRes.json()
    if (transcribeError) throw new Error(transcribeError)
    setTranscript(text)

    // Step 2: Get answer from Claude
    const context = buildVoiceContext(dashboard)
    const answerRes = await fetch('/api/voice/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: text, context }),
    })
    const { answer: answerText, error: answerError } = await answerRes.json()
    if (answerError) throw new Error(answerError)
    setAnswer(answerText)

    // Step 3: Convert to speech
    setState('speaking')
    const speakRes = await fetch('/api/voice/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: answerText }),
    })

    if (!speakRes.ok) throw new Error('Failed to generate speech')

    const audioBlob2 = await speakRes.blob()
    const audioUrl = URL.createObjectURL(audioBlob2)

    if (audioRef.current) {
      audioRef.current.src = audioUrl
      audioRef.current.onended = () => {
        setState('idle')
        URL.revokeObjectURL(audioUrl)
      }
      audioRef.current.play()
    }
  }

  function handlePointerDown() {
    startRecording()
  }

  function handlePointerUp() {
    if (state === 'recording') stopRecording()
  }

  const stateConfig = {
    idle: {
      bg: 'bg-red-700 hover:bg-red-800',
      icon: '🎙️',
      label: 'Hold to ask',
    },
    recording: {
      bg: 'bg-red-500 animate-pulse',
      icon: '⏺',
      label: 'Listening...',
    },
    processing: {
      bg: 'bg-gray-500',
      icon: '⏳',
      label: 'Thinking...',
    },
    speaking: {
      bg: 'bg-green-600',
      icon: '🔊',
      label: 'Speaking...',
    },
  }

  const config = stateConfig[state] || stateConfig.idle

  return (
    <>
      <audio ref={audioRef} className="hidden" />

      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-2 z-50">
        {(transcript || answer || error) && (
          <div className="bg-white rounded-lg shadow-lg p-4 max-w-xs text-sm">
            {transcript && (
              <p className="text-gray-500 mb-1">
                <span className="font-medium">You:</span> {transcript}
              </p>
            )}
            {answer && (
              <p className="text-gray-800">
                <span className="font-medium">FireAnt:</span> {answer}
              </p>
            )}
            {error && (
              <p className="text-red-600">{error}</p>
            )}
          </div>
        )}

        <div className="flex flex-col items-center gap-1">
          <button
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            disabled={state === 'processing' || state === 'speaking'}
            className={`w-14 h-14 rounded-full text-white text-xl shadow-lg transition-all ${config.bg} disabled:opacity-60 select-none`}
          >
            {config.icon}
          </button>
          <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full shadow-sm">
            {config.label}
          </span>
        </div>
      </div>
    </>
  )
}

function buildInsightPayload(dashboard) {
  const { metrics, latestMonth, accounts, headline, baseline, latestExpenseBreakdown } = dashboard
  return {
    thisMonth: {
      date: latestMonth.date,
      income: latestMonth.income,
      expenses: latestMonth.expenses,
      saved: latestMonth.saved,
      savingsRate: metrics.savingsRate,
      expenseBreakdown: latestExpenseBreakdown,
    },
    baseline: {
      avgIncome: baseline.avgIncome,
      avgExpenses: baseline.avgExpenses,
      avgSavingsRate: baseline.avgSavingsRate,
      monthsAveraged: baseline.monthsAveraged,
    },
    fireSnapshot: {
      fireAge: headline.expectedFireAge,
      netWorth: metrics.netWorth,
      investedAssets: headline.investedAssets,
      fireNumber: metrics.fireNumber,
    },
  }
}