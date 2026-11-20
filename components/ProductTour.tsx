'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { driver, type DriveStep, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useAuth } from '@/lib/useAuth'
import { useLanguage } from '@/lib/LanguageProvider'
import type { TranslationKey } from '@/lib/translations'
import { hasSeenGuide, markGuideSeen, presentSteps, prefersReducedMotion, shouldAutoStartGuide } from '@/lib/onboarding'

// Post-login guide for the dashboard (app/page.tsx) and the bottom NavBar.
// Follows the onboarding rule of thumb: orient, don't educate. Four core
// things (where to start, how to create, where help is, where everything
// lives), then hand the artisan straight to their first real action
// instead of ending on a dead "Got it".
//
// Runs once per account (lib/onboarding.ts), only after the language
// chooser is gone, and can be replayed from the "Take a tour" button.

const FIRST_TARGET = '#tour-challenges'
const WAIT_FOR_TARGET_MS = 4000

type Step = { element?: string; title: TranslationKey; desc: TranslationKey; side?: 'top' | 'bottom'; align?: 'start' | 'center' | 'end' }

const STEPS: Step[] = [
  { title: 'guide.welcome.title', desc: 'guide.welcome.desc' },
  { element: '#tour-challenges', title: 'guide.start.title', desc: 'guide.start.desc', side: 'bottom', align: 'start' },
  { element: '#tour-actions', title: 'guide.create.title', desc: 'guide.create.desc', side: 'top', align: 'start' },
  { element: '#tour-nav-coach', title: 'tour.navCoach.title', desc: 'tour.navCoach.desc', side: 'top', align: 'end' },
  { element: '#tour-nav-bar', title: 'guide.nav.title', desc: 'guide.nav.desc', side: 'top', align: 'center' },
  { title: 'guide.finish.title', desc: 'guide.finish.desc' },
]

export default function ProductTour() {
  const { user, loading } = useAuth()
  const { t, showGate, languageResolved } = useLanguage()
  const router = useRouter()
  const autoStarted = useRef(false)
  const active = useRef<Driver | null>(null)

  const start = useCallback(() => {
    if (active.current?.isActive()) return
    const steps = presentSteps(STEPS, (sel) => !!document.querySelector(sel))
    const lastIndex = steps.length - 1

    const goToFirstAction = () => {
      active.current?.destroy()
      router.push('/products')
    }
    const driveSteps: DriveStep[] = steps.map((s, i) => ({
      element: s.element,
      popover: {
        title: t(s.title),
        description: t(s.desc),
        side: s.side,
        align: s.align,
        // The last step's primary button is the first real action, not "Done".
        ...(i === lastIndex && {
          doneBtnText: t('guide.finish.cta'),
          onNextClick: goToFirstAction,
          onDoneClick: goToFirstAction,
        }),
      },
    }))

    const d = driver({
      steps: driveSteps,
      popoverClass: 'ks-tour',
      showProgress: true,
      progressText: t('guide.progress'),
      showButtons: ['next', 'previous', 'close'],
      allowClose: true,
      allowKeyboardControl: true,
      // Highlighted nav links stayed clickable, so a tap mid-guide navigated
      // away and left a half-torn-down overlay.
      disableActiveInteraction: true,
      animate: !prefersReducedMotion(),
      smoothScroll: !prefersReducedMotion(),
      overlayColor: '#0b1a2c',
      overlayOpacity: 0.72,
      stagePadding: 6,
      stageRadius: 14,
      popoverOffset: 12,
      nextBtnText: t('tour.next'),
      prevBtnText: t('tour.prev'),
      doneBtnText: t('tour.done'),
      onDestroyed: () => {
        if (user) markGuideSeen(user.id)
        active.current = null
      },
    })
    active.current = d
    d.drive()
  }, [t, router, user])

  // `start` changes identity whenever the profile or language reloads (auth
  // events do this in the background). The pending auto-start must survive
  // that, so it calls through a ref and is only cancelled on unmount.
  const startRef = useRef(start)
  useEffect(() => { startRef.current = start }, [start])
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (autoStarted.current || !user) return
    const ready = shouldAutoStartGuide({
      userId: user.id,
      authLoading: loading,
      languageGateOpen: showGate || !languageResolved,
      seen: hasSeenGuide(user.id),
    })
    if (!ready) return
    autoStarted.current = true
    const userId = user.id

    // The checklist renders only after its data loads; wait for it (briefly)
    // so the guide doesn't skip the most important step.
    const startedAt = Date.now()
    const tick = () => {
      if (document.querySelector(FIRST_TARGET) || Date.now() - startedAt > WAIT_FOR_TARGET_MS) {
        pending.current = null
        // Mark seen as it opens: if the tab is closed mid-guide, it should
        // not ambush the artisan again on the next login.
        markGuideSeen(userId)
        startRef.current()
      } else {
        pending.current = setTimeout(tick, 150)
      }
    }
    pending.current = setTimeout(tick, 400)
  }, [user, loading, showGate, languageResolved])

  // Tear down on unmount (route change) so no overlay or timer is left behind.
  // If the component unmounts before the guide opened (including React's
  // dev-mode remount check, which keeps refs), re-arm the auto-start.
  useEffect(() => () => {
    if (pending.current) {
      clearTimeout(pending.current)
      pending.current = null
      autoStarted.current = false
    }
    active.current?.destroy()
  }, [])

  if (!user) return null

  return (
    <button
      type="button"
      onClick={start}
      className="ks-tour-trigger"
      aria-label={t('tour.cta')}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><path d="M16.2 7.8l-2.1 6.3-6.3 2.1 2.1-6.3z" />
      </svg>
      {t('tour.cta')}
    </button>
  )
}
