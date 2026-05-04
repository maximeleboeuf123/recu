// Plan feature gating. All features are free for now.
// When Stripe is wired up, uncomment the plan check below and flip planAllows to use it.
export function planAllows(_plan, _feature) {
  return true
  // const FEATURE_PLANS = { account_sharing: 'pro' }
  // const PLAN_RANK    = { free: 0, pro: 1 }
  // return (PLAN_RANK[_plan] ?? 0) >= (PLAN_RANK[FEATURE_PLANS[_feature]] ?? 0)
}
