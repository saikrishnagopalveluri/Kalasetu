// Re-exported from AuthProvider so all components share one auth instance
// instead of each `useAuth()` call running its own independent listener.
export { useAuth } from './AuthProvider'
export type { ArtisanProfile, SignupDetails } from './AuthProvider'
