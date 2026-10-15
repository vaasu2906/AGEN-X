import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Button from '../components/common/Button'

function GoogleIcon() {
  return <svg aria-hidden="true" viewBox="0 0 48 48" className="h-[17px] w-[17px]"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 4)" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.25 5.48-4.72 7.18l7.62 5.91c4.45-4.11 7.14-10.16 7.14-17.56Z" transform="translate(0 -3)" /><path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.9 23.9 0 0 0 0 21.56l7.98-6.19Z" transform="translate(0 3)" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.79l-7.62-5.91c-2.12 1.42-4.85 2.26-8.28 2.26-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" /></svg>
}

function Brand() {
  return <Link to="/" className="mb-10 inline-flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-lime text-[#161712]"><Sparkles size={18} /></span><span className="font-display text-[17px] font-extrabold text-white">Agenix</span></Link>
}

export function AuthPage({ mode }) {
  const isSignup = mode === 'signup'
  const { isAuthenticated, login, loginWithGoogle, signup } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  if (isAuthenticated) return <Navigate to="/" replace />

  async function submit(event) {
    event.preventDefault()
    if (!form.email.trim() || !form.password) return setError('Please enter your email and password.')
    if (isSignup && !form.name.trim()) return setError('Please enter your full name.')
    if (form.password.length < 6) return setError('Your password must be at least 6 characters.')
    setError('')
    setLoading(true)
    try {
      if (isSignup) await signup(form.name.trim(), form.email.trim())
      else await login(form.email.trim(), form.password)
      navigate('/', { replace: true })
    } catch {
      setError('We couldn’t sign you in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function googleSignIn() {
    setLoading(true)
    try { await loginWithGoogle(); navigate('/', { replace: true }) }
    catch { setError('Google sign in is unavailable right now.') }
    finally { setLoading(false) }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-5 py-12">
      <div className="pointer-events-none absolute left-1/2 top-[-330px] h-[560px] w-[760px] -translate-x-1/2 rounded-full bg-lime/[.045] blur-[100px]" />
      <div className="absolute left-6 top-7"><Link to="/" className="inline-flex items-center gap-2 text-xs text-[#82837c] transition hover:text-white"><ArrowLeft size={14} />Back to home</Link></div>
      <div className="relative w-full max-w-[420px]">
        <Brand />
        <div className="rounded-[20px] border border-line bg-[#171815]/90 p-7 shadow-[0_20px_80px_rgba(0,0,0,.26)] sm:p-9">
          <div className="mb-7"><p className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-lime">{isSignup ? 'Get started' : 'Welcome back'}</p><h1 className="font-display text-[27px] font-bold tracking-tight text-[#f0f0ea]">{isSignup ? 'Create your account' : 'Sign in to Agenix'}</h1><p className="mt-2 text-[13px] leading-5 text-[#92938d]">{isSignup ? 'Build workflows that take the busywork off your plate.' : 'Your workflows are ready when you are.'}</p></div>
          {error && <div role="alert" className="mb-4 rounded-lg border border-red-400/20 bg-red-400/[.07] px-3 py-2.5 text-xs text-red-200">{error}</div>}
          <Button variant="secondary" className="w-full border-[#363731] py-3 text-[#e7e7e1]" onClick={googleSignIn} disabled={loading}><GoogleIcon />Continue with Google</Button>
          <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-line" /><span className="text-[10px] uppercase tracking-[.14em] text-[#70716b]">or continue with email</span><span className="h-px flex-1 bg-line" /></div>
          <form className="space-y-4" onSubmit={submit}>
            {isSignup && <label className="block"><span className="mb-1.5 block text-xs font-medium text-[#cecec7]">Full name</span><input autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="auth-input" placeholder="Alex Morgan" /></label>}
            <label className="block"><span className="mb-1.5 block text-xs font-medium text-[#cecec7]">Email address</span><input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="auth-input" placeholder="you@example.com" /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-medium text-[#cecec7]">Password</span><input type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="auth-input" placeholder="At least 6 characters" /></label>
            <Button type="submit" className="mt-1 w-full py-3" loading={loading}>{isSignup ? 'Create account' : 'Sign in'}<ArrowRight size={15} /></Button>
          </form>
          <p className="mt-6 text-center text-xs text-[#93948d]">{isSignup ? 'Already have an account?' : 'New to Agenix?'} <Link className="font-semibold text-lime hover:text-[#e4ff9a]" to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Sign in' : 'Create an account'}</Link></p>
        </div>
      </div>
    </main>
  )
}

export function LoginPage() { return <AuthPage mode="login" /> }
export function SignupPage() { return <AuthPage mode="signup" /> }
