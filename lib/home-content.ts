// Home-page marketing content. Recommended topics link to a catalog search, so they list real courses as instructors publish them.
import type { TopicKind } from "@/components/Art";
export const RECOMMENDED: { t: string; sub: string; q: string; hue: number; tag: string; art: TopicKind }[] = [
  { t: "Generative AI & Prompting", sub: "Use AI tools and language models with confidence", q: "AI", hue: 300, tag: "Hot", art: "ai" },
  { t: "Python Programming", sub: "From first script to real projects", q: "Python", hue: 220, tag: "Popular", art: "code" },
  { t: "Web Development", sub: "Build and ship modern websites and apps", q: "Web", hue: 150, tag: "Popular", art: "web" },
  { t: "Data Analysis & SQL", sub: "Turn spreadsheets and databases into answers", q: "Data", hue: 90, tag: "Rising", art: "data" },
  { t: "UI/UX Design", sub: "Design interfaces people love to use", q: "Design", hue: 10, tag: "Popular", art: "design" },
  { t: "Digital Marketing", sub: "SEO, email and ads that actually convert", q: "Marketing", hue: 60, tag: "Rising", art: "marketing" },
  { t: "Excel & Productivity", sub: "Work faster with the tools you already use", q: "Excel", hue: 130, tag: "Popular", art: "excel" },
  { t: "Spoken Languages", sub: "Speak confidently from the first week", q: "Spanish", hue: 330, tag: "Popular", art: "lang" },
];

// Sample testimonials and numbers (placeholders) — replace with real ones before launch.
export const REVIEWS = [
  { n: "Sofia R.", c: "Python learner", x: "Clear, practical and fun. I built something real in the first week." },
  { n: "Marcus T.", c: "Design learner", x: "Best course I have taken. The projects made everything click." },
  { n: "Hana K.", c: "Language learner", x: "Short lessons that fit my commute. I actually speak now." },
];

export const STATS: [string, string][] = [
  ["17,000+", "companies"],
  ["3.1M", "learners"],
  ["2,800", "expert instructors"],
  ["30-day", "money-back guarantee"],
  ["Lifetime", "access"],
];
