import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AuthGuard } from './pages/AuthPage'
import { EditorPage } from './pages/EditorPage'
import { HomePage } from './pages/HomePage'
import { SharePage } from './pages/SharePage'
import { useTheme } from './hooks/useTheme'

function AppRoutes() {
  useTheme()

  return (
    <Routes>
      <Route path="/share/:token" element={<SharePage />} />
      <Route
        path="*"
        element={
          <AuthGuard>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/note/:id" element={<EditorPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthGuard>
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
