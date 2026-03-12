'use client'

import { useEffect, useRef } from 'react'

type SessionKeepAliveProps = {
  userType: 'student' | 'admin'
}

const KEEP_ALIVE_INTERVAL_MS = 30 * 60 * 1000
const MIN_REFRESH_GAP_MS = 60 * 1000

export function SessionKeepAlive({ userType }: SessionKeepAliveProps) {
  const lastRefreshAtRef = useRef(0)

  useEffect(() => {
    let disposed = false

    async function refreshSession(force = false) {
      if (disposed) {
        return
      }

      const now = Date.now()
      if (!force && now - lastRefreshAtRef.current < MIN_REFRESH_GAP_MS) {
        return
      }

      lastRefreshAtRef.current = now

      try {
        await fetch('/api/auth/refresh-session', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({ userType }),
          cache: 'no-store',
          credentials: 'same-origin',
        })
      } catch {
        // Keep-alive failures should not interrupt the current UI session.
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshSession()
      }
    }

    const handleFocus = () => {
      void refreshSession()
    }

    void refreshSession(true)
    const intervalId = window.setInterval(() => {
      void refreshSession()
    }, KEEP_ALIVE_INTERVAL_MS)

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      disposed = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [userType])

  return null
}
