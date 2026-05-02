// FIRE projection engine. All amounts in real (inflation-adjusted) yen.

export const SCENARIOS = {
  conservative: { label: 'Conservative', returnPct: 3.0, color: '#9ca3af' },
  expected:     { label: 'Expected',     returnPct: 4.0, color: '#dc2626' },
  optimistic:   { label: 'Optimistic',   returnPct: 5.5, color: '#9ca3af' },
}

const PENSION_AGE = 65
const DC_UNLOCK_AGE = 60
const MAX_PROJECTION_YEARS = 50

export function projectToFire(inputs) {
  const {
    age,
    swrPct,
    expectedReturnPct,
    retirementExpensesMonthly,
    pensionMonthly,
    liquidAssets,
    lockedAssets,
    monthlyContribution,
    contributionToLocked,
  } = inputs

  const fireNumber = computeFireNumber(retirementExpensesMonthly, swrPct, pensionMonthly, age)
  const swr = swrPct / 100

  const scenarios = {}
  for (const [key, scenario] of Object.entries(SCENARIOS)) {
    scenarios[key] = simulate({
      ...inputs,
      returnPct: scenario.returnPct,
      fireNumber,
      swr,
    })
  }

  return { fireNumber, scenarios }
}

function simulate(inputs) {
  const {
    age,
    returnPct,
    retirementExpensesMonthly,
    pensionMonthly,
    liquidAssets,
    lockedAssets,
    monthlyContribution,
    contributionToLocked,
    swr,
  } = inputs

  const monthlyReturn = Math.pow(1 + returnPct / 100, 1 / 12) - 1
  const liquidContribution = Math.max(0, monthlyContribution - contributionToLocked)
  const lockedContribution = Math.max(0, contributionToLocked)

  let liquid = liquidAssets
  let locked = lockedAssets
  let fireMonth = null
  const trajectory = []

  for (let m = 0; m <= MAX_PROJECTION_YEARS * 12; m++) {
    const yearsElapsed = m / 12
    const ageNow = age + yearsElapsed

    // Effective annual expenses to fund from portfolio:
    // before pension age: full retirement expenses
    // after pension age: retirement expenses minus pension
    const effectiveAnnualExpenses = ageNow >= PENSION_AGE
      ? Math.max(0, (retirementExpensesMonthly - pensionMonthly) * 12)
      : retirementExpensesMonthly * 12

    const totalAssets = liquid + locked
    const liquidNeeded = ageNow >= DC_UNLOCK_AGE ? totalAssets : liquid
    const couldSustain = liquidNeeded * swr >= effectiveAnnualExpenses

    if (couldSustain && fireMonth === null && m > 0) {
      fireMonth = m
    }

    if (m % 12 === 0) {
      trajectory.push({
        year: yearsElapsed,
        age: Math.round(ageNow * 10) / 10,
        liquid: Math.round(liquid),
        locked: Math.round(locked),
        total: Math.round(liquid + locked),
      })
    }

    // Apply growth, then contributions for next month
    liquid = liquid * (1 + monthlyReturn) + liquidContribution
    locked = locked * (1 + monthlyReturn) + lockedContribution
  }

  let fireAge = null
  let yearsToFire = null
  if (fireMonth !== null) {
    fireAge = age + fireMonth / 12
    yearsToFire = fireMonth / 12
  }

  // Bridge analysis: at FIRE age, can liquid alone sustain expenses
  // until DC unlocks at 60?
  let bridgeAnalysis = null
  if (fireMonth !== null && fireAge < DC_UNLOCK_AGE) {
    const trajectoryAtFire = trajectory.find(t => Math.floor(t.year) === Math.floor(fireMonth / 12))
    if (trajectoryAtFire) {
      const yearsToBridge = DC_UNLOCK_AGE - fireAge
      const expensesUntilBridge = retirementExpensesMonthly * 12 * yearsToBridge
      const liquidAtFire = trajectoryAtFire.liquid
      const liquidShortfall = Math.max(0, expensesUntilBridge - liquidAtFire * swr * yearsToBridge)
      bridgeAnalysis = {
        yearsToBridge: Math.round(yearsToBridge * 10) / 10,
        liquidAtFire: Math.round(liquidAtFire),
        lockedAtFire: Math.round(trajectoryAtFire.locked),
        expensesNeeded: Math.round(expensesUntilBridge),
        shortfall: Math.round(liquidShortfall),
      }
    }
  }

  return {
    fireMonth,
    fireAge: fireAge !== null ? Math.round(fireAge * 10) / 10 : null,
    yearsToFire: yearsToFire !== null ? Math.round(yearsToFire * 10) / 10 : null,
    trajectory,
    bridgeAnalysis,
  }
}

function computeFireNumber(monthlyExpenses, swrPct, pensionMonthly, age) {
  // FIRE number is what you need to sustain expenses from now until pension
  // covers some of them. Simple version: full expenses / swr.
  // Pension reduces this implicitly via the simulation, so for the headline
  // number we show the pre-pension full requirement.
  return Math.round((monthlyExpenses * 12) / (swrPct / 100))
}

export function coastFireAge(inputs) {
  const {
    age,
    swrPct,
    retirementExpensesMonthly,
    pensionMonthly,
    liquidAssets,
    lockedAssets,
    expectedReturnPct,
  } = inputs

  const fireNumber = computeFireNumber(retirementExpensesMonthly, swrPct, pensionMonthly, age)
  const totalAssets = liquidAssets + lockedAssets

  // Edge cases
  if (totalAssets <= 0) return null
  if (totalAssets >= fireNumber) return age // already coast-FIRE'd
  if (expectedReturnPct <= 0) return null

  const annualReturn = expectedReturnPct / 100
  const yearsToCoast = Math.log(fireNumber / totalAssets) / Math.log(1 + annualReturn)
  if (!isFinite(yearsToCoast) || yearsToCoast < 0) return null

  return Math.round((age + yearsToCoast) * 10) / 10
}

export function savingsRate(income, expenses) {
  if (income <= 0) return 0
  return Math.round(((income - expenses) / income) * 1000) / 10
}