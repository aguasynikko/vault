import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"

export function LoginForm({
  className,
  onSignupClick,
  onLogin,
  ...props
}: React.ComponentPropsWithoutRef<"form"> & {
  onSignupClick?: () => void;
  onLogin?: () => void;
}) {
  const { login, loginWithGithub, loginWithGoogle } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      // Add a timeout so users aren't stuck on infinite loading if network hangs
      const withTimeout = <T,>(p: Promise<T>, ms: number) => {
        return new Promise<T>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error("Login timed out. Check network and Supabase auth settings.")), ms)
          p.then((v) => { clearTimeout(t); resolve(v) }).catch((err) => { clearTimeout(t); reject(err) })
        })
      }
      await withTimeout(login(email, password), 12000)
      onLogin?.()
    } catch (err: any) {
      setError(err?.message || "Login failed. Please check your credentials.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Login to your account</h1>
        <p className="text-balance text-sm text-muted-foreground">
          Enter your email below to login to your account
        </p>
      </div>
      <div className="grid gap-6">
        {error && (
          <div className="text-sm text-red-500 text-center">
            {error}
          </div>
        )}
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input 
            id="email" 
            type="email" 
            placeholder="m@example.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center">
            <Label htmlFor="password">Password</Label>
            <a
              href="#"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              Forgot your password?
            </a>
          </div>
          <Input 
            id="password" 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Logging in..." : "Login"}
        </Button>
        <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
          <span className="relative z-10 bg-background px-2 text-muted-foreground">
            Or login with
          </span>
        </div>
        <div className="flex justify-center gap-2">
          <Button 
            variant="outline"
            size="icon"
            type="button"
            aria-label="Login with GitHub"
            onClick={async () => {
              setError("")
              setIsLoading(true)
              try {
                await loginWithGithub()
              } catch (err: any) {
                const msg = String(err?.message || "GitHub login failed. Please try again.")
                if (msg.toLowerCase().includes('provider is not enabled')) {
                  setError("GitHub provider is not enabled. Enable it in Supabase → Authentication → Providers, add Client ID/Secret and the callback URL.")
                } else {
                  setError(msg)
                }
              } finally {
                setIsLoading(false)
              }
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4">
              <path
                d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                fill="currentColor"
              />
            </svg>
            <span className="sr-only">Login with GitHub</span>
          </Button>
          <Button 
            variant="outline"
            size="icon"
            type="button"
            aria-label="Login with Google"
            onClick={async () => {
              setError("")
              setIsLoading(true)
              try {
                await loginWithGoogle()
              } catch (err: any) {
                const msg = String(err?.message || "Google login failed. Please try again.")
                if (msg.toLowerCase().includes('provider is not enabled')) {
                  setError("Google provider is not enabled. Enable it in Supabase → Authentication → Providers, add Client ID/Secret and the callback URL.")
                } else {
                  setError(msg)
                }
              } finally {
                setIsLoading(false)
              }
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4">
              <path d="M21.35 11.1h-9.18v2.98h5.27c-.23 1.35-1.6 3.97-5.27 3.97-3.17 0-5.76-2.62-5.76-5.86s2.59-5.86 5.76-5.86c1.81 0 3.02.76 3.72 1.41l2.53-2.45C17.25 3.6 15.02 2.7 12.17 2.7 6.97 2.7 2.8 6.87 2.8 12.07c0 5.2 4.17 9.37 9.37 9.37 5.41 0 8.98-3.8 8.98-9.16 0-.62-.07-1.08-.2-1.58z" fill="currentColor" />
            </svg>
            <span className="sr-only">Login with Google</span>
          </Button>
        </div>
      </div>
      <div className="text-center text-sm">
        Don't have an account?{" "}
        <a href="#" className="underline underline-offset-4" onClick={(e) => { e.preventDefault(); onSignupClick?.(); }}>
          Sign up
        </a>
      </div>
    </form>
  )
}
