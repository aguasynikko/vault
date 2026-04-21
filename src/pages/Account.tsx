import React, { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { UserCircleIcon, CameraIcon } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
// Using local auth context; no PocketBase

export default function AccountPage() {
  const { user, updateProfile } = useAuth()
  const [name, setName] = useState<string>("")
  const [avatar, setAvatar] = useState<string>("")
  const [isUpdating, setIsUpdating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Initialize user data when user is loaded
  useEffect(() => {
    if (user) {
      setName(user.name || user.email?.split('@')[0] || "User")
      setAvatar(user.avatar || "")
    }
  }, [user])

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      setAvatar(url)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!user) return
    setIsUpdating(true)
    try {
      // Update via AuthContext local method
      await updateProfile(name, avatar || undefined)
      alert("Profile updated successfully!")
    } catch (error) {
      console.error('Failed to update profile:', error)
      alert("Failed to update profile. Please try again.")
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <h2 className="text-xl/7 font-semibold tracking-tight flex items-center gap-2">
        <UserCircleIcon className="size-5" />
        Account
      </h2>

      <Card className="p-4 lg:p-6">
        <div className="flex flex-col lg:flex-row items-start gap-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 rounded-lg">
              <AvatarImage src={avatar} alt={name} />
              <AvatarFallback className="rounded-lg">
                {name ? name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <CameraIcon />
                Change Picture
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarPick}
                className="hidden"
              />
            </div>
          </div>

          <div className="grid w-full max-w-md gap-3">
            <Label htmlFor="displayName">Display Name</Label>
            <Input id="displayName" value={name} onChange={(e) => setName(e.target.value)} />
            <div>
              <Button onClick={handleSave} disabled={isUpdating} className="mt-2">
                {isUpdating ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 lg:p-6">
        <div className="grid w-full max-w-md gap-3">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user?.email || ""} readOnly />
          <Label htmlFor="userId" className="mt-4">User ID</Label>
          <Input id="userId" value={user?.id || ""} readOnly />
          <p className="text-xs text-muted-foreground mt-2">
            Account created: {user?.created ? new Date(user.created).toLocaleDateString() : "Unknown"}
          </p>
        </div>
      </Card>
    </div>
  )
}