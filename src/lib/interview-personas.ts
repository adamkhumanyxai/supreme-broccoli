import type { Persona, InterviewType } from "@/lib/interview.functions";

type Suggestion = Persona;

const SUGGESTIONS: Record<string, string[]> = {
  engineering: ["Engineering Manager", "Senior IC Peer", "Skip-level VP Eng", "CTO", "Tech Lead"],
  sales: ["Sales Hiring Manager", "Senior AE Peer", "VP Sales", "CRO", "Sales Engineer"],
  product: ["Product Lead", "VP Product", "Engineering Counterpart", "Designer Counterpart", "CEO"],
  design: ["Design Manager", "Senior IC Designer", "Cross-functional PM", "Head of Design"],
  marketing: ["Marketing Manager", "VP Marketing", "CMO", "Head of Demand Gen"],
  executive: ["Board Member", "CEO", "Chief of Staff", "Investor"],
};

const DEFAULT = ["Hiring Manager", "Skip-Level Leader", "Cross-functional Peer", "Recruiter"];

const STYLE_BY_TITLE: Record<string, { seniority: string; style: string }> = {
  "Engineering Manager": {
    seniority: "8-12 yrs eng",
    style: "Calm, structured. Probes for ownership and tradeoffs.",
  },
  "Senior IC Peer": {
    seniority: "Senior IC",
    style: "Curious, technical, wants real war stories.",
  },
  "Skip-level VP Eng": {
    seniority: "VP",
    style: "Strategic. Tests for clarity of thinking under abstraction.",
  },
  CTO: { seniority: "Executive", style: "Sharp, busy. No fluff. Wants signal fast." },
  "Tech Lead": {
    seniority: "Staff IC",
    style: "Pragmatic. Probes architecture and team dynamics.",
  },
  "Sales Hiring Manager": {
    seniority: "Director",
    style: "Direct, results-oriented. Tests deal mechanics.",
  },
  "Senior AE Peer": {
    seniority: "Senior AE",
    style: "Conversational, swaps stories, pressure-tests pipeline.",
  },
  "VP Sales": { seniority: "VP", style: "Looks for repeatable methodology and judgment." },
  CRO: { seniority: "Executive", style: "Outcome-obsessed. Forecast accuracy matters." },
  "Sales Engineer": { seniority: "Senior", style: "Technical-collaborative. Tests product depth." },
  "Product Lead": { seniority: "Director", style: "Probes prioritization and user empathy." },
  "VP Product": { seniority: "VP", style: "Strategic, frameworks-driven, tests roadmap thinking." },
  "Engineering Counterpart": {
    seniority: "Senior",
    style: "Wants to know if you'll respect engineering.",
  },
  "Designer Counterpart": {
    seniority: "Senior",
    style: "Wants to feel craft and taste in your thinking.",
  },
  CEO: { seniority: "Executive", style: "Big picture. Pattern matches fast." },
  "Design Manager": { seniority: "Director", style: "Probes craft, process, collaboration." },
  "Senior IC Designer": {
    seniority: "Senior",
    style: "Wants to peel back the why behind every decision.",
  },
  "Cross-functional PM": { seniority: "Senior", style: "Probes how you partner under ambiguity." },
  "Head of Design": { seniority: "VP", style: "Strategic, looks for design leadership signals." },
  "Marketing Manager": { seniority: "Manager", style: "Tactical, channel-savvy, ROI-focused." },
  "VP Marketing": { seniority: "VP", style: "Strategic, brand + demand fluency." },
  CMO: { seniority: "Executive", style: "Story-led. Tests judgment and breadth." },
  "Head of Demand Gen": { seniority: "Director", style: "Pipeline math obsessed." },
  "Board Member": { seniority: "Board", style: "Detached, strategic, asks meta-questions." },
  "Chief of Staff": {
    seniority: "Executive Adjacent",
    style: "Tests organization, judgment, written clarity.",
  },
  Investor: { seniority: "Partner", style: "Scrutinizes thesis, market, conviction." },
  "Hiring Manager": {
    seniority: "Director",
    style: "Friendly but evaluative. Tests fit and capability.",
  },
  "Skip-Level Leader": { seniority: "VP", style: "Higher-altitude. Probes judgment and ambition." },
  "Cross-functional Peer": {
    seniority: "Senior",
    style: "Will you make their job easier or harder?",
  },
  Recruiter: {
    seniority: "Senior recruiter",
    style: "Warm, structured, screens for fit and motivation.",
  },
};

export function getPersonaSuggestions(domain: string | null | undefined): Suggestion[] {
  const titles = (domain && SUGGESTIONS[domain]) || DEFAULT;
  return titles.map((title) => ({
    title,
    seniority: STYLE_BY_TITLE[title]?.seniority ?? "",
    style: STYLE_BY_TITLE[title]?.style ?? "",
  }));
}

export const INTERVIEW_TYPE_OPTIONS: { value: InterviewType; label: string; blurb: string }[] = [
  { value: "behavioral", label: "Behavioral", blurb: "STAR stories, judgment, collaboration." },
  { value: "role_specific", label: "Role-Specific", blurb: "Domain craft and technical depth." },
  { value: "panel", label: "Panel", blurb: "Multiple angles, rapid context switching." },
  { value: "executive", label: "Executive", blurb: "Strategic altitude, big-picture trade-offs." },
  { value: "general", label: "General", blurb: "Mixed bag — fit, motivation, depth." },
];
