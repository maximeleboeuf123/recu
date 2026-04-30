import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    const handle = async () => {
      // Try existing session first (Supabase may have already processed the callback)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        navigate('/', { replace: true })
        return
      }

      // Exchange code for session if present in URL (PKCE flow)
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (code) {
        const { error: err } = await supabase.auth.exchangeCodeForSession(code)
        if (err) {
          setError(err.message)
          return
        }
        navigate('/', { replace: true })
        return
      }

      // No session and no code — send to auth
      navigate('/', { replace: true })
    }

    handle()
  }, [navigate])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background px-4">
        <div className="bg-error-bg text-error rounded-lg p-4 text-sm max-w-sm w-full text-center">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <p className="text-muted text-sm">Chargement...</p>
    </div>
  )
}
