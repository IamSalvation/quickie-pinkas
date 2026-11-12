import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)
    if (authErr) {
      setError(authErr.message)
      return
    }
  }

  return (
    <div className="min-h-screen relative flex flex-col font-sans">

      {/* LAYER 0 & 1: Background Image & Dark Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src="/login-bg.jpg"
          alt="Pinkas Background"
          className="w-full h-full object-cover"
        />
        {/* The dark tint for readability */}
        <div className="absolute inset-0 bg-slate-900/70" />
      </div>

      {/* LAYER 2: UI Content */}
      <div className="relative z-10 flex flex-col min-h-screen">

        {/* Header: Logo */}
        <div className="flex justify-between items-center p-6 sm:p-8">
          <div className="flex items-center gap-2">
            {/* Using your existing logo. If it's dark, it might be hard to see on the dark background. */}
            <img src="/logo.png" alt="Quickie Pinkas" className="h-9 w-auto" />
          </div>
          <Link
            to="/signup"
            className="text-sm font-medium text-white/80 hover:text-white transition-colors"
          >
            Create an account
          </Link>
        </div>

        {/* Main Content Area: Pushes Form to the Left */}
        <div className="flex-1 flex items-center justify-center px-6 pb-16">

          {/* THE FROSTED GLASS CARD */}
          <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8">

            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
              <p className="mt-2 text-sm text-slate-600">
                Sign in to your Pinkas dashboard
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@school.com"
                  className="block w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none bg-white/70"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <Link to="/forgot-password" className="text-xs text-slate-500 hover:text-slate-900">
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  className="block w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none bg-white/70"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-500">
              Don't have an account?{' '}
              <Link to="/signup" className="font-medium text-slate-900 hover:underline">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}