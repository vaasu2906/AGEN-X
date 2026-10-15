import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Activity,
  CalendarClock,
  ChevronDown,
  CircleHelp,
  Command,
  FolderKanban,
  GitPullRequest,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ScrollText,
  Sparkles,
  Sun,
  Wrench,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import api from '../../lib/api'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/swe', label: 'SWE Agent', icon: GitPullRequest },
  { to: '/automations', label: 'Automations', icon: CalendarClock },
  { to: '/history', label: 'History', icon: ScrollText },
  { to: '/tools', label: 'Tools', icon: Wrench },
  { to: '/data', label: 'Data Explorer', icon: FolderKanban },
]

export default function Navbar({ theme, onToggleTheme }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    let mounted = true
    async function checkBackend() {
      const live = await api.checkHealth()
      if (mounted) setIsLive(live)
    }
    checkBackend()
    const interval = setInterval(checkBackend, 10000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  function signOut() {
    logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-[#10110f]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[70px] max-w-[1440px] items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-8">
          <NavLink to="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-lime text-[#161712]">
              <Sparkles size={17} strokeWidth={2.4} />
            </span>
            <span className="font-display text-[15px] font-extrabold tracking-tight text-[#f0f0e9]">Agenix</span>
          </NavLink>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={label}
                end={end}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                    isActive ? 'bg-white/[.07] text-white' : 'text-[#92938d] hover:text-white'
                  }`
                }
              >
                <Icon size={15} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="grid h-9 w-9 place-items-center rounded-full border border-line bg-[#171815] text-[#b6b7af] transition hover:bg-white/[.07] hover:text-white"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <div
            className="hidden items-center gap-2 rounded-full border border-line bg-[#171815] px-3 py-1.5 sm:flex"
            title={isLive ? 'Connected to FastAPI Agentic Backend (:8000)' : 'Running in local preview mode'}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-35 ${
                  isLive ? 'bg-lime' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  isLive ? 'bg-lime' : 'bg-amber-400'
                }`}
              />
            </span>
            <span className="text-[11px] font-medium text-[#b6b7af]">
              {isLive ? 'Live Backend' : 'Mock mode'}
            </span>
          </div>

          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-full p-1.5 pr-2.5 transition hover:bg-white/[.05]"
              aria-expanded={menuOpen}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#383a31] text-xs font-semibold text-lime">
                {user?.avatar || 'A'}
              </span>
              <span className="hidden max-w-[110px] truncate text-xs text-[#d1d1ca] sm:block">{user?.name}</span>
              <ChevronDown size={13} className="text-muted" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 w-56 rounded-xl border border-line bg-[#1b1c19] p-2 shadow-xl">
                <div className="border-b border-line px-3 py-2">
                  <p className="truncate text-sm font-medium text-white">{user?.name}</p>
                  <p className="truncate text-xs text-muted">{user?.email}</p>
                </div>
                <button
                  onClick={signOut}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[#d6d6cf] hover:bg-white/[.05]"
                >
                  <LogOut size={15} />Sign out
                </button>
              </div>
            )}
          </div>
          <button
            className="text-[#aaa] md:hidden"
            aria-label="Toggle navigation"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <nav className="flex flex-col gap-1 border-t border-line px-5 py-3 md:hidden">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={label}
              to={to}
              end={end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${
                  isActive ? 'bg-white/[.07] text-white' : 'text-[#92938d]'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
      )}
      <span className="sr-only"><Command /><CircleHelp /><Activity /></span>
    </header>
  )
}
