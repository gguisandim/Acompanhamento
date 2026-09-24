import { userInitials } from "@/lib/types";

export default function Avatar({
  name,
  avatarUrl,
  size = "medium"
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "small" | "medium" | "large";
}) {
  return (
    <span
      className={`avatar avatar-${size}`}
      aria-label={`Avatar de ${name}`}
      role="img"
    >
      {avatarUrl ? <img src={avatarUrl} alt="" /> : userInitials(name)}
    </span>
  );
}
