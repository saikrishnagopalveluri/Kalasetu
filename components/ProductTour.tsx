'use client'

import { useEffect, useRef } from 'react'
import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useAuth } from '@/lib/useAuth'
import { useLanguage } from '@/lib/LanguageProvider'

const SEEN_KEY = 'hastkatha-tour-seen'

// A short guided tour of the logged-in dashboard (app/page.tsx) plus the
// bottom NavBar, for artisans who are new to the app. Auto-runs once per
// browser (tracked in localStorage, not the account, since it's just a
// UI hint) and can be re-run any time from the "Take a tour" button this
// component also renders.
export default function ProductTour() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const autoStarted = useRef(false)

  function start() {
    const allSteps: DriveStep[] = [
      { popover: { title: t('tour.welcome.title'), description: t('tour.welcome.desc') } },
      { element: '#tour-greeting', popover: { title: t('tour.progress.title'), description: t('tour.progress.desc'), side: 'bottom', align: 'start' } },
      { element: '#tour-challenges', popover: { title: t('tour.challenges.title'), description: t('tour.challenges.desc'), side: 'bottom', align: 'start' } },
      { element: '#tour-actions', popover: { title: t('tour.actions.title'), description: t('tour.actions.desc'), side: 'top', align: 'start' } },
      { element: '#tour-nav-create', popover: { title: t('tour.navCreate.title'), description: t('tour.navCreate.desc'), side: 'top', align: 'center' } },
      { element: '#tour-nav-community', popover: { title: t('tour.navCommunity.title'), description: t('tour.navCommunity.desc'), side: 'top', align: 'center' } },
      { element: '#tour-nav-upskill', popover: { title: t('tour.navUpskill.title'), description: t('tour.navUpskill.desc'), side: 'top', align: 'center' } },
      { element: '#tour-nav-coach', popover: { title: t('tour.navCoach.title'), description: t('tour.navCoach.desc'), side: 'top', align: 'end' } },
      { element: '#tour-recent', popover: { title: t('tour.recent.title'), description: t('tour.recent.desc'), side: 'top', align: 'start' } },
    ]
    // Only include steps whose target actually exists on the page right now
    // (e.g. recent creations always renders something, but a future step
    // added here might not always have a match) — driver.js throws if a
    // step's element selector matches nothing.
    const steps = allSteps.filter((step) => !step.element || document.querySelector(step.element as string))

    const driverObj = driver({
      showProgress: true,
      allowClose: true,
      overlayColor: 'rgba(19,42,69,0.7)',
      nextBtnText: t('tour.next'),
      prevBtnText: t('tour.prev'),
      doneBtnText: t('tour.done'),
      steps,
      onDestroyed: () => {
        try { localStorage.setItem(SEEN_KEY, '1') } catch { /* private-mode storage, safe to ignore */ }
      },
    })
    driverObj.drive()
  }

  useEffect(() => {
    if (!user || autoStarted.current) return
    autoStarted.current = true
    let seen = false
    try { seen = localStorage.getItem(SEEN_KEY) === '1' } catch { /* private-mode storage, treat as unseen */ }
    if (seen) return
    // Mark as seen right away, not only in onDestroyed: if the artisan
    // clicks a highlighted nav link mid-tour (a very likely thing to do,
    // since the tour points at real nav items), the SPA navigates away and
    // driver.js's overlay is torn down without ever calling onDestroyed,
    // so the flag never got set and the tour kept reappearing on every
    // subsequent login.
    try { localStorage.setItem(SEEN_KEY, '1') } catch { /* private-mode storage, safe to ignore */ }
    // Small delay so the dashboard's own data (level, challenges) has
    // rendered before the tour tries to highlight it.
    const timer = setTimeout(start, 900)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  if (!user) return null

  return (
    <button
      onClick={start}
      style={{
        position: 'absolute', top: 16, right: 16,
        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.35)', color: '#fff',
        borderRadius: 999, padding: '6px 13px', fontSize: 11.5, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'inline-flex', alignItems: 'center', gap: 5,
      }}
    >
      <span aria-hidden="true">🧭</span> {t('tour.cta')}
    </button>
  )
}
