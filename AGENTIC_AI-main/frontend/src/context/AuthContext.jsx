import { createContext, useContext, useMemo, useState } from 'react'

const AuthContext = createContext(null)
const USER_KEY = 'agentic-user'

function readUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY)) || null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser)

  function setMockUser(email, name) {
    const nextUser = {
      email,
      name: name || email.split('@')[0].replace(/[._-]/g, ' '),
      avatar: (name || email).trim().charAt(0).toUpperCase(),
    }
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    setUser(nextUser)
    return nextUser
  }

  const value = useMemo(() => ({
    user,
    isAuthenticated: Boolean(user),
    login: async (email) => setMockUser(email),
    loginWithGoogle: async () => setMockUser('alex.morgan@gmail.com', 'Alex Morgan'),
    signup: async (name, email) => setMockUser(email, name),
    logout: () => {
      localStorage.removeItem(USER_KEY)
      setUser(null)
    },
  }), [user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
