import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AuthGuard } from './pages/AuthPage'
import { EditorPage } from './pages/EditorPage'
import { HomePage } from './pages/HomePage'
import { useTheme } from './hooks/useTheme'

function AppRoutes() {
  useTheme()

  return (
    <AuthGuard>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/note/:id" element={<EditorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthGuard>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
