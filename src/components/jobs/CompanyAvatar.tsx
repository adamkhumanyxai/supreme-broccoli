import { Building2 } from "lucide-react";

export function CompanyAvatar({
  name,
  logoUrl,
  size = 40,
}: {
  name?: string | null;
  logoUrl?: string | null;
  size?: number;
}) {
  const initials = (name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name ?? "Company"}
        className="rounded-md object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground"
      style={{ width: size, height: size }}
    >
      {initials ? (
        <span className="font-serif text-sm">{initials}</span>
      ) : (
        <Building2 className="h-4 w-4" />
      )}
    </div>
  );
}
