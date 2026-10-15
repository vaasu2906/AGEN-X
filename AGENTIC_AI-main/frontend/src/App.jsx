import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Navbar from './components/common/Navbar'
import ProtectedRoute from './components/common/ProtectedRoute'
import { initialWorkflows } from './mock/mockData'
import { LoginPage, SignupPage } from './pages/AuthPages'
import AutomationsPage from './pages/AutomationsPage'
import DashboardPage from './pages/DashboardPage'
import DataPage from './pages/DataPage'
import HistoryPage from './pages/HistoryPage'
import ToolsPage from './pages/ToolsPage'
import WorkflowDetailPage from './pages/WorkflowDetailPage'

const STORAGE_KEY = 'agentic-workflows'

function loadWorkflows() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(saved) ? saved : initialWorkflows
  } catch {
    return initialWorkflows
  }
}

function ProtectedLayout({ children, theme, onToggleTheme }) {
  return (
    <>
      <Navbar theme={theme} onToggleTheme={onToggleTheme} />
      <main>{children}</main>
    </>
  )
}

export default function App() {
  const [workflows, setWorkflows] = useState(loadWorkflows)
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('agentic-theme') === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('agentic-theme', theme)
    } catch {
      // Storage unavailable fallback
    }
  }, [theme])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows))
    } catch {
      // Storage unavailable fallback
    }
  }, [workflows])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  const createWorkflow = useCallback((workflow) => {
    setWorkflows((current) => [workflow, ...current.filter((w) => w.id !== workflow.id)])
  }, [])

  const updateWorkflow = useCallback((id, updater) => {
    setWorkflows((current) => {
      const exists = current.some((w) => w.id === id)
      if (!exists) {
        const item = typeof updater === 'function' ? updater(null) : updater
        return item ? [item, ...current] : current
      }
      return current.map((workflow) => {
        if (workflow.id !== id) return workflow
        return typeof updater === 'function' ? updater(workflow) : { ...workflow, ...updater }
      })
    })
  }, [])

  const syncBackendRuns = useCallback((backendWorkflows) => {
    setWorkflows((current) => {
      const map = new Map()
      for (const w of backendWorkflows) map.set(w.id, w)
      for (const w of current) if (!map.has(w.id)) map.set(w.id, w)
      return Array.from(map.values())
    })
  }, [])

  return (
    <div className="min-h-screen bg-canvas text-[#e8e8e1]">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route element={<ProtectedRoute />}>
          <Route
            path="/"
            element={
              <ProtectedLayout theme={theme} onToggleTheme={toggleTheme}>
                <DashboardPage workflows={workflows} onCreateWorkflow={createWorkflow} />
              </ProtectedLayout>
            }
          />
          <Route
            path="/automations"
            element={
              <ProtectedLayout theme={theme} onToggleTheme={toggleTheme}>
                <AutomationsPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/workflow/:id"
            element={
              <ProtectedLayout theme={theme} onToggleTheme={toggleTheme}>
                <WorkflowDetailPage workflows={workflows} updateWorkflow={updateWorkflow} />
              </ProtectedLayout>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedLayout theme={theme} onToggleTheme={toggleTheme}>
                <HistoryPage workflows={workflows} onSyncRuns={syncBackendRuns} />
              </ProtectedLayout>
            }
          />
          <Route
            path="/tools"
            element={
              <ProtectedLayout theme={theme} onToggleTheme={toggleTheme}>
                <ToolsPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/data"
            element={
              <ProtectedLayout theme={theme} onToggleTheme={toggleTheme}>
                <DataPage />
              </ProtectedLayout>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
