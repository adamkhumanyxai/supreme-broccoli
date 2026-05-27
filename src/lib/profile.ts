export type ProfileRow = {
  full_name: string | null;
  headline: string | null;
  superpowers: string | null;
  resume_file_url: string | null;
  domain: string | null;
};

export function profileCompleteness(p: Partial<ProfileRow> | null | undefined): number {
  if (!p) return 0;
  let score = 0;
  // 5 factors, each 20%
  if (p.full_name && p.full_name.trim().length > 0) score += 20;
  if (p.headline && p.headline.trim().length > 0) score += 20;
  if (p.resume_file_url) score += 20;
  if (p.superpowers && p.superpowers.trim().length >= 50) score += 20;
  if (p.domain && p.domain.trim().length > 0) score += 20;
  return score;
}

export const DOMAIN_OPTIONS: { value: string; label: string }[] = [
  { value: "engineering", label: "Engineering" },
  { value: "product", label: "Product" },
  { value: "design", label: "Design" },
  { value: "sales", label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "operations", label: "Operations" },
  { value: "customer_success", label: "Customer Success" },
  { value: "data", label: "Data & Analytics" },
  { value: "finance", label: "Finance" },
  { value: "people", label: "People & HR" },
  { value: "executive", label: "Executive / Leadership" },
  { value: "other", label: "Other" },
];

export const HEADLINE_PLACEHOLDERS = [
  "Senior Software Engineer building developer tools",
  "Product Manager focused on growth & retention",
  "Account Executive closing mid-market SaaS deals",
  "Designer crafting calm, opinionated interfaces",
  "Engineering leader scaling high-trust teams",
];

export const ROLE_SUGGESTIONS = [
  "Account Executive",
  "Sales Engineer",
  "Software Engineer",
  "Engineering Manager",
  "Product Manager",
  "Designer",
  "Marketing Manager",
  "Operations Manager",
  "Customer Success Manager",
  "Data Scientist",
  "VP Sales",
  "VP Product",
  "VP Engineering",
];
