import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
      if (session) ensureUserExists(session.user)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setLoading(false)
      if (event === 'SIGNED_IN' && session) {
        ensureUserExists(session.user)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

  const signOut = () => supabase.auth.signOut()

  return { session, loading, signInWithGoogle, signOut }
}

async function ensureUserExists(user) {
  const { error } = await supabase.from('users').upsert(
    { id: user.id, email: user.email },
    { onConflict: 'id', ignoreDuplicates: true },
  )
  if (error) console.error('ensureUserExists:', error.message)
}
