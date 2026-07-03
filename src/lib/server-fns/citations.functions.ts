import { createServerFn } from "@tanstack/react-start";
import { CitationsInput } from "@/lib/schemas";
import { getSupabasePublic } from "@/lib/supabase-server";

export interface Citation {
  key: string;
  label: string;
  citation: string;
  url?: string;
  category: "labor" | "automation" | "education" | "skills" | "ai" | "data";
}

const STATIC_CITATIONS: Citation[] = [
  {
    key: "isco",
    label: "ISCO-08",
    citation:
      "International Labour Organization — International Standard Classification of Occupations (ISCO-08), 4-digit codes",
    url: "https://ilostat.ilo.org/methods/concepts-and-definitions/classification-occupation/",
    category: "skills",
  },
  {
    key: "esco",
    label: "ESCO v1.1",
    citation:
      "European Skills, Competences, Qualifications and Occupations classification (ESCO v1.1)",
    url: "https://esco.ec.europa.eu/",
    category: "skills",
  },
  {
    key: "frey-osborne",
    label: "Frey & Osborne (2013)",
    citation:
      "Frey, C.B. & Osborne, M.A. (2013). The Future of Employment: How Susceptible are Jobs to Computerisation? Oxford Martin School.",
    url: "https://www.oxfordmartin.ox.ac.uk/publications/the-future-of-employment/",
    category: "automation",
  },
  {
    key: "wittgenstein",
    label: "Wittgenstein Centre — SSP2 (2023)",
    citation:
      "Wittgenstein Centre for Demography and Global Human Capital, Human Capital Data Explorer (2023), SSP2 baseline scenario",
    url: "http://dataexplorer.wittgensteincentre.org/",
    category: "education",
  },
  {
    key: "ai-model",
    label: "Lovable AI · google/gemini-3-flash-preview",
    citation:
      "Skill extraction performed by Lovable AI Gateway with structured tool-calling against the google/gemini-3-flash-preview model",
    category: "ai",
  },
];

export const getCitations = createServerFn({ method: "GET" })
  .inputValidator((input: { countryCode?: string }) => CitationsInput.parse(input ?? {}))
  .handler(async ({ data }): Promise<Citation[]> => {
    const sb = getSupabasePublic();
    const list: Citation[] = [...STATIC_CITATIONS];

    if (data.countryCode) {
      const { data: c } = await sb
        .from("countries")
        .select("code,name,unemployment_source,wage_source,informal_source,hci_source")
        .eq("code", data.countryCode)
        .maybeSingle();
      if (c) {
        if (c.unemployment_source) {
          list.push({
            key: `${c.code}-unemp`,
            label: `${c.name} · Youth unemployment`,
            citation: c.unemployment_source,
            category: "labor",
          });
        }
        if (c.wage_source) {
          list.push({
            key: `${c.code}-wage`,
            label: `${c.name} · Minimum wage`,
            citation: c.wage_source,
            category: "labor",
          });
        }
        if (c.informal_source) {
          list.push({
            key: `${c.code}-inf`,
            label: `${c.name} · Informal employment`,
            citation: c.informal_source,
            category: "labor",
          });
        }
        if (c.hci_source) {
          list.push({
            key: `${c.code}-hci`,
            label: `${c.name} · Human Capital Index`,
            citation: c.hci_source,
            category: "data",
          });
        }
      }
    }

    return list;
  });
