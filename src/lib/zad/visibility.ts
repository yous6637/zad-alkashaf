/** Public catalog predicate. `p` is products and `t` is the owning troop. */
export const visibleListing = `
  p.visibility = 'public'
  and p.status = 'active'
  and t.status = 'active'
  and has_active_subscription(t.id)
`;
