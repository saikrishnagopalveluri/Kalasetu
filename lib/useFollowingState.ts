'use client'

import { useState } from 'react'

// Local state that starts from `source` and resets to it whenever `source`
// changes, while still letting the user override it in between. Used by the
// AI tools (content, promote, coach, catalogue) so their output-language
// picker follows the site's language: a reader who switches the site to
// Telugu gets Telugu output by default, but can still pick another language
// for just this tool.
//
// Resetting during render (instead of in a useEffect) is the pattern React
// recommends for this: it avoids a second render with the stale value.
// https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
export function useFollowingState<T>(source: T) {
  const [value, setValue] = useState<T>(source)
  const [lastSource, setLastSource] = useState<T>(source)
  if (source !== lastSource) {
    setLastSource(source)
    setValue(source)
  }
  return [value, setValue] as const
}
