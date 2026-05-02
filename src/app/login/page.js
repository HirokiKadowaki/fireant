'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function openPanel(which) {
    setMode(which)
    setMessage('')
    setEmail('')
    setPassword('')
  }

  function closePanel() {
    setMode(null)
    setMessage('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    if (mode === 'signup') {
      setMessage('Check your email for a confirmation link.')
      return
    }

    router.push('/')
  }

  const panelOpen = mode !== null

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #2a1438 0%, #6b1a3a 50%, #c0233f 100%)',
      }}
    >
      <div className="flex-1 flex flex-col items-center justify-center w-full px-6 pt-16">
        <img
          src="/fireant-logo.png"
          alt="FireAnt"
          className="w-100 max-w-full mb-12"
        />

        <div className="w-full max-w-xs space-y-3">
<button
  onClick={() => openPanel('signin')}
  style={{ fontFamily: 'Trebuchet MS, sans-serif' }}
  className="w-full py-3 border-2 border-white text-white font-medium rounded-md hover:bg-white hover:text-gray-900 transition-colors"
>
  SIGN IN
</button>
          <button
            onClick={() => openPanel('signup')}
            style={{ fontFamily: 'Trebuchet MS, sans-serif' }}
            className="w-full py-3 bg-white text-gray-900 font-medium rounded-md hover:bg-gray-100 transition-colors"
          >
            SIGN UP
          </button>
        </div>
      </div>

      {panelOpen && (
        <div
          onClick={closePanel}
          className="absolute inset-0 bg-black/30 transition-opacity"
        />
      )}

      <div
        className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out ${
          panelOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ height: '70vh' }}
      >
        <div className="relative h-full px-6 pt-6 pb-8 flex flex-col">
          <button
            onClick={closePanel}
            aria-label="Close"
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-900 text-2xl"
          >
            ×
          </button>

          <h2 className="text-2xl font-medium text-gray-900 mb-6 mt-2">
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-red-700 hover:bg-red-800 text-white font-medium rounded-md disabled:opacity-50 transition-colors"
            >
              {loading
                ? 'Loading...'
                : mode === 'signin'
                ? 'Sign in'
                : 'Create account'}
            </button>
            {message && (
              <p className="text-sm text-red-600 mt-2">{message}</p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}