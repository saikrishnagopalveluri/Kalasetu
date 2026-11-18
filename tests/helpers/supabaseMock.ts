import { vi } from 'vitest'

// A minimal stand-in for the Supabase query builder. Every chained method
// (select, eq, in, update, insert, upsert, order, ...) is recorded and
// returns the same builder; awaiting the builder, or calling maybeSingle()
// or single(), resolves to the result configured for that table.
//
// Results are queued per table, so a route that reads the same table more
// than once (for example a profile lookup, then an update) gets each
// configured result in order. Once a table's queue is empty it resolves to
// { data: null, error: null }.

export type QueryResult = { data?: unknown; error?: unknown; count?: number | null }
export type RecordedCall = [method: string, args: unknown[]]
export type RecordedQuery = { table: string; calls: RecordedCall[] }

function createQuery(table: string, result: QueryResult, log: RecordedQuery[]) {
  const recorded: RecordedQuery = { table, calls: [] }
  log.push(recorded)
  const settled = Promise.resolve({ data: null, error: null, count: null, ...result })
  const builder: object = new Proxy({}, {
    get(_target, prop) {
      if (prop === 'then') return settled.then.bind(settled)
      if (prop === 'maybeSingle' || prop === 'single') {
        return () => {
          recorded.calls.push([prop, []])
          return settled
        }
      }
      return (...args: unknown[]) => {
        recorded.calls.push([String(prop), args])
        return builder
      }
    },
  })
  return builder
}

export function createSupabaseMock(results: Record<string, QueryResult | QueryResult[]> = {}) {
  const queues = new Map<string, QueryResult[]>(
    Object.entries(results).map(([table, r]) => [table, Array.isArray(r) ? [...r] : [r]])
  )
  const queries: RecordedQuery[] = []

  const from = vi.fn((table: string) => {
    const next = queues.get(table)?.shift() ?? {}
    return createQuery(table, next, queries)
  })

  // Every call of `method` made against `table`, in order — e.g.
  // callsTo('artisan_badges', 'upsert') to see which badges were awarded.
  function callsTo(table: string, method: string): unknown[][] {
    return queries
      .filter((q) => q.table === table)
      .flatMap((q) => q.calls.filter(([m]) => m === method).map(([, args]) => args))
  }

  return { from, queries, callsTo }
}
