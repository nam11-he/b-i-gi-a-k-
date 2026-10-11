import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { initialsOf } from "@/lib/format"

/** Avatar with the initials of a name (no photos in NamBeDe yet). */
export function UserAvatar({ name, size = "default" }: { name: string | null | undefined; size?: "sm" | "default" | "lg" }) {
  return (
    <Avatar size={size}>
      <AvatarFallback className="bg-primary/10 font-medium text-primary">{initialsOf(name)}</AvatarFallback>
    </Avatar>
  )
}
