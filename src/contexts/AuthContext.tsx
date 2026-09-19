import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, hasSupabase } from '@/lib/supabase';

// Auth model persisted via Supabase profiles table
export interface AuthModel {
  id: string;
  email: string;
  name?: string;
  avatar?: string; // http URL
  created: string; // ISO date
}

interface AuthContextType {
  user: AuthModel | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, passwordConfirm: string) => Promise<void>;
  updateProfile: (name: string, avatarDataUrl?: string) => Promise<void>;
  logout: () => void;
  loginWithGithub: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Utility to bound long-running requests and provide graceful fallback
  const withTimeout = async <T,>(p: PromiseLike<T>, ms: number): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Request timed out')), ms)
      Promise.resolve(p).then(
        (v) => { clearTimeout(t); resolve(v) },
        (err: any) => { clearTimeout(t); reject(err) }
      )
    })
  }

  const loadProfile = async (uid: string, email: string): Promise<AuthModel> => {
    const { data, error } = await withTimeout(
      supabase
      .from('profiles')
      .select('id,email,name,avatar_url,created_at')
      .eq('id', uid)
      .single(),
      30000,
    )
    if (error && error.code !== 'PGRST116') { // unexpected errors
      console.warn('profile fetch error', error)
    }
    let name = email.split('@')[0]
    let avatar = ''
    let created = new Date().toISOString()
    if (data) {
      name = data.name ?? name
      avatar = data.avatar_url ?? ''
      created = data.created_at ?? created
    } else if (hasSupabase) {
      // Ensure a profile row exists for OAuth users or first-time logins
      try {
        const { error: upErr } = await supabase.from('profiles').upsert({ id: uid, email, name })
        if (upErr) console.warn('profile upsert (hydrate) error', upErr)
      } catch (e) {
        console.warn('profile upsert (hydrate) exception', e)
      }
    }
    return { id: uid, email, name, avatar, created }
  }

  useEffect(() => {
    const init = async () => {
      if (hasSupabase) {
        try {
          const { data: { user: sUser } } = await supabase.auth.getUser()
          if (sUser) {
            try {
              const profile = await loadProfile(sUser.id, sUser.email ?? '')
              setUser(profile)
            } catch (e) {
              console.warn('Profile load failed, using minimal profile', e)
              setUser({ 
                id: sUser.id, 
                email: sUser.email ?? '', 
                name: sUser.email?.split('@')[0] ?? 'User', 
                avatar: '', 
                created: new Date().toISOString() 
              })
            }
          }
        } catch (e) {
          console.warn('Auth check failed:', e)
        }
      } else {
        try {
          const raw = localStorage.getItem('filesys/auth')
          if (raw) setUser(JSON.parse(raw))
        } catch {}
      }
      setIsLoading(false)
    }
    init()
    
    if (hasSupabase) {
      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
        const sUser = session?.user
        if (sUser) {
          try {
            const profile = await loadProfile(sUser.id, sUser.email ?? '')
            setUser(profile)
          } catch (e) {
            console.warn('Profile load failed on auth change', e)
            setUser({ 
              id: sUser.id, 
              email: sUser.email ?? '', 
              name: sUser.email?.split('@')[0] ?? 'User', 
              avatar: '', 
              created: new Date().toISOString() 
            })
          }
        } else {
          setUser(null)
        }
      })
      return () => { sub?.subscription.unsubscribe() }
    }
  }, [])

  const login = async (email: string, password: string) => {
    if (hasSupabase) {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        20000,
      )
      if (error) throw error
      const sUser = data.user
      if (!sUser) throw new Error('No user returned')
      try {
        const profile = await loadProfile(sUser.id, sUser.email ?? email)
        setUser(profile)
      } catch (e) {
        console.warn('profile load timeout, using minimal profile', e)
        setUser({ id: sUser.id, email: sUser.email ?? email, name: email.split('@')[0], avatar: '', created: new Date().toISOString() })
      }
    } else {
      const next: AuthModel = {
        id: Math.random().toString(36).slice(2),
        email,
        name: email.split('@')[0],
        avatar: '',
        created: new Date().toISOString(),
      }
      localStorage.setItem('filesys/auth', JSON.stringify(next))
      setUser(next)
    }
  }

  const signup = async (email: string, password: string, passwordConfirm: string) => {
    if (password !== passwordConfirm) throw new Error('Passwords do not match')
    if (hasSupabase) {
      const { data, error } = await withTimeout(
        supabase.auth.signUp({ email, password }),
        20000,
      )
      if (error) throw error
      const sUser = data.user
      if (!sUser) return
      
      // Try to create profile, but don't fail signup if it fails
      const { error: upsertErr } = await supabase.from('profiles').upsert({
        id: sUser.id,
        email,
        name: email.split('@')[0],
      })
      if (upsertErr) {
        console.warn('profile upsert error', upsertErr)
      }
      
      try {
        const profile = await loadProfile(sUser.id, email)
        setUser(profile)
      } catch (e) {
        console.warn('profile load timeout after signup, using minimal profile', e)
        setUser({ id: sUser.id, email, name: email.split('@')[0], avatar: '', created: new Date().toISOString() })
      }
    } else {
      const next: AuthModel = {
        id: Math.random().toString(36).slice(2),
        email,
        name: email.split('@')[0],
        avatar: '',
        created: new Date().toISOString(),
      }
      localStorage.setItem('filesys/auth', JSON.stringify(next))
      setUser(next)
    }
  }

  const updateProfile = async (name: string, avatarDataUrl?: string) => {
    if (!user) return
    if (hasSupabase) {
      let avatar_url = user.avatar ?? ''
      if (avatarDataUrl && avatarDataUrl.startsWith('data:')) {
        const res = await fetch(avatarDataUrl)
        const blob = await res.blob()
        const fileName = `${user.id}.jpg`
        const upload = await supabase.storage.from('avatars').upload(fileName, blob, { upsert: true })
        if (upload.error) {
          console.warn('avatar upload error', upload.error)
        } else {
          const pub = supabase.storage.from('avatars').getPublicUrl(fileName)
          avatar_url = pub.data.publicUrl
        }
      }
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        name,
        avatar_url,
      })
      if (error) throw error
      setUser({ ...user, name, avatar: avatar_url })
    } else {
      const next = { ...user, name, avatar: avatarDataUrl ?? user.avatar }
      localStorage.setItem('filesys/auth', JSON.stringify(next))
      setUser(next)
    }
  }

  const logout = async () => {
    setUser(null)
    if (hasSupabase) {
      // Fire-and-forget the sign out request to avoid blocking the UI
      supabase.auth.signOut().catch(e => console.warn('Sign out error:', e))
    } else {
      localStorage.removeItem('filesys/auth')
    }
  }

  const loginWithGithub = async () => {
    if (!hasSupabase) {
      throw new Error('Supabase is not configured for OAuth login')
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          // Keep optional params minimal; can be customized later
        },
      },
    })
    if (error) throw error
    // On success, Supabase redirects; on return, onAuthStateChange hydrates user
  }

  const loginWithGoogle = async () => {
    if (!hasSupabase) {
      throw new Error('Supabase is not configured for OAuth login')
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {},
      },
    })
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, updateProfile, logout, loginWithGithub, loginWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
