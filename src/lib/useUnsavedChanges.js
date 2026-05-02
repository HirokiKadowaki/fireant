'use client'

import { useEffect } from 'react'

/**
 * Warn the user when they try to leave with unsaved changes.
 *
 * Covers:
 * - Browser tab close / refresh / external nav (beforeunload event)
 * - Internal link clicks (intercepts <a> in the same tab)
 *
 * Caveat: browsers don't allow custom messages on beforeunload. The user sees
 * a generic "Leave site?" prompt regardless of what message we set.
 */
export function useUnsavedChanges(isDirty) {
 useEffect(() => {
  if (!isDirty) return
  // listeners attach here, no logs needed

    function handleBeforeUnload(e) {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }

    function handleLinkClick(e) {
      const link = e.target.closest('a[href]')
      if (!link) return
      // Allow target=_blank and external links to behave normally
      const href = link.getAttribute('href')
      if (!href || href.startsWith('http') || link.target === '_blank') return
      // Only intercept same-origin internal navigation
      const confirmed = window.confirm('You have unsaved changes. Leave anyway?')
      if (!confirmed) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleLinkClick, true)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleLinkClick, true)
    }
  }, [isDirty])
}