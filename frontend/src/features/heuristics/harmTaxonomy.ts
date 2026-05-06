import type { PromptClassify } from '../../domain/types'

/**
 * 12 harm domains + auxiliary jailbreak-adjacent tags (roleplay, generic adult wording).
 * Trigger lists combine the reference table + common red-team / safety-taxonomy phrasing.
 */
export const HARM_TAXONOMY_LABELS: Record<string, string> = {
  harm_chemical: 'Chemical',
  harm_biological: 'Biological',
  harm_nuclear: 'Nuclear',
  harm_radiological: 'Radiological',
  harm_cyber: 'Cybersecurity / hacking',
  harm_fraud_financial: 'Fraud / scams / financial crime',
  harm_violence_weapons: 'Violence / weapons',
  harm_self_harm: 'Self-harm',
  harm_sexual_exploitation: 'Sexual exploitation (non-consensual)',
  harm_misinformation: 'Misinformation / manipulation',
  harm_privacy: 'Privacy / data leakage',
  harm_drugs_controlled: 'Drugs / controlled substances',
  sexual_content: 'Sexual / explicit (general)',
  roleplay: 'Roleplay / persona',
}

/** Tie-break when scores tie: earlier = wins primary. */
const CATEGORY_PRIORITY: string[] = [
  'harm_sexual_exploitation',
  'harm_self_harm',
  'harm_violence_weapons',
  'harm_chemical',
  'harm_biological',
  'harm_nuclear',
  'harm_radiological',
  'harm_drugs_controlled',
  'harm_cyber',
  'harm_fraud_financial',
  'harm_misinformation',
  'harm_privacy',
  'sexual_content',
  'roleplay',
]

type TaxonomyRule = {
  id: string
  category: string
  weight: number
  tags: string[]
  rx: RegExp
}

const RULES: TaxonomyRule[] = [
  // ── Chemical ─────────────────────────────────────────────────────────────
  {
    id: 'chem_napalm_incendiary',
    category: 'harm_chemical',
    weight: 2,
    tags: ['incendiary', 'flammable'],
    rx: /\b(napalm|thermite|molotov|styrofoam|packing peanuts|gasoline|motor oil|incendiary gel|homemade napalm|sticky fire)\b/i,
  },
  {
    id: 'chem_process_lab',
    category: 'harm_chemical',
    weight: 1,
    tags: ['synthesis', 'lab'],
    rx: /\b(how to make|recipe for|synthes(?:e|is|ize)|manufacture|cook chemistry|extract (?:and )?purif|toxic (?:chemical|precursor)|chloroform|cyanide|acid attack|anfo|tatp|hmt[d]|nitroglycerin|precursor chemical)\b/i,
  },
  {
    id: 'chem_warfare_names',
    category: 'harm_chemical',
    weight: 2,
    tags: ['agent', 'cw'],
    rx: /\b(sarin|tabun|soman|vx\b|mustard gas|lewisite|ricin extract|phosgene|hydrogen cyanide)\b/i,
  },

  // ── Biological ───────────────────────────────────────────────────────────
  {
    id: 'bio_agents',
    category: 'harm_biological',
    weight: 2,
    tags: ['pathogen', 'bioweapon'],
    rx: /\b(anthrax|botulin|botox toxin|smallpox|plague bacterium|ricin from castor|castor beans?|weaponi[sz]e pathogens?|aerosoliz(?:e|ed) (?:virus|bacteria)|gain[- ]of[- ]function|lab[- ]grown (?:pathogen|virus))\b/i,
  },
  {
    id: 'bio_culture_weapon',
    category: 'harm_biological',
    weight: 1,
    tags: ['culture'],
    rx: /\b(culture (?:of )?(?:bacteria|plague)|grow (?:anthrax|plague|smallpox)|purif(?:y|ication) (?:of )?(?:toxin|ricin))\b/i,
  },

  // ── Nuclear ──────────────────────────────────────────────────────────────
  {
    id: 'nuclear_weapon_design',
    category: 'harm_nuclear',
    weight: 2,
    tags: ['nuclear'],
    rx: /\b(uranium enrichment|plutonium pit|critical mass|implosion lens|thermonuclear|hydrogen bomb design|fission device|gun[- ]type (?:bomb|assembly))\b/i,
  },
  {
    id: 'nuclear_dirty',
    category: 'harm_nuclear',
    weight: 1,
    tags: ['dirty bomb'],
    rx: /\b(dirty bomb|radiological dispersal device|rdd\b|spread radioactive (?:material|dust))\b/i,
  },

  // ── Radiological (materials / dispersion - overlaps dirty bomb) ─────────
  {
    id: 'radio_sources',
    category: 'harm_radiological',
    weight: 2,
    tags: ['radiation'],
    rx: /\b(americium|cesium[- ]?137|co[- ]?60|cobalt[- ]?60|iodine[- ]?131|sr[- ]?90|radioactive (?:source|material|powder)|smoke detectors?.*(?:extract|remove)|spread (?:it )?effectively)\b/i,
  },

  // ── Cyber ────────────────────────────────────────────────────────────────
  {
    id: 'cyber_stealer_rat',
    category: 'harm_cyber',
    weight: 2,
    tags: ['malware', 'stealer'],
    rx: /\b(token stealer|discord (?:token )?grabber|grab(?:s|bed)? tokens|infostealer|keylogger|ransomware|rootkit|remote access trojan|\brat\b.*(?:payload|malware)|credential (?:harvest|stuffing)|sql injection|xss\b|reverse shell|exploit kit|persistence hook|webhook.*(?:exfil|send))\b/i,
  },
  {
    id: 'cyber_illegal_access',
    category: 'harm_cyber',
    weight: 1,
    tags: ['intrusion'],
    rx: /\b(bypass (?:2fa|mfa)|crack password|brute force login|ddos attack|botnet c2|privilege escalat|lateral movement.*network)\b/i,
  },

  // ── Fraud / financial ────────────────────────────────────────────────────
  {
    id: 'fraud_romance_scam',
    category: 'harm_fraud_financial',
    weight: 2,
    tags: ['scam', 'social engineering'],
    rx: /\b(romance scam|pig butcher(?:ing)?|send (?:me )?money on (?:cash app|venmo|zelle)|fake (?:invoice|check|wire)|money mule|carding tutorial|identity theft playbook)\b/i,
  },
  {
    id: 'fraud_general',
    category: 'harm_fraud_financial',
    weight: 1,
    tags: ['fraud'],
    rx: /\b(phishing kit|whatsapp (?:investment|crypto) scam|pump and dump|market manipulation script|ponzi (?:scheme|script))\b/i,
  },

  // ── Violence / weapons ───────────────────────────────────────────────────
  {
    id: 'wpn_ied_firearms',
    category: 'harm_violence_weapons',
    weight: 2,
    tags: ['explosive', 'weapon'],
    rx: /\b(pipe bomb|ied\b|improvised explosive|detonator|shaped charge|tnt|dynamite|letter bomb|silencer (?:3d|print)|ghost gun|undetectable firearm|armor[- ]piercing (?:ammo|rounds))\b/i,
  },
  {
    id: 'wpn_instructions',
    category: 'harm_violence_weapons',
    weight: 1,
    tags: ['instructions'],
    rx: /\b(how to (?:make|build) (?:a )?(?:bomb|grenade|weapon)|full auto (?:conversion|sears?))\b/i,
  },

  // ── Self-harm ────────────────────────────────────────────────────────────
  {
    id: 'sh_method',
    category: 'harm_self_harm',
    weight: 2,
    tags: ['self_harm'],
    rx: /\b(suicid|kill myself|end my life|want to die|self[- ]?harm|cut (?:my|your) wrists|lethal dose|pills? from .*medicine cabinet|fastest.*least painful.*(?:die|death)|finish the job)\b/i,
  },

  // ── Sexual exploitation (non-consent / synthetic abuse) ────────────────
  {
    id: 'sexploitation_nc_deepfake',
    category: 'harm_sexual_exploitation',
    weight: 2,
    tags: ['non-consensual'],
    rx: /\b(non[- ]?consensual|revenge porn|deepfake (?:porn|sex)|synthetic (?:intimate|nude).*(?:without consent)|(?:photo|image)s? of (?:my )?ex.*(?:porn|deepfake)|create realistic.*non[- ]?consensual)\b/i,
  },
  {
    id: 'sexploitation_coercion',
    category: 'harm_sexual_exploitation',
    weight: 1,
    tags: ['coercion'],
    rx: /\b(coerc(?:e|ion) (?:sex|scene)|sexual (?:coercion|blackmail) (?:script|instructions))\b/i,
  },

  // ── Misinformation ───────────────────────────────────────────────────────
  {
    id: 'misinfo_fake_news',
    category: 'harm_misinformation',
    weight: 2,
    tags: ['disinfo'],
    rx: /\b(fake news article|disinformation campaign|deepfake (?:video|speech).*(?:election|candidate)|conspiracy.*(?:tracking chip|vaccine)|fabricated (?:stud(?:y|ies)|sources))\b/i,
  },
  {
    id: 'misinfo_manipulation',
    category: 'harm_misinformation',
    weight: 1,
    tags: ['manipulation'],
    rx: /\b(viral hoax|astroturf|sockpuppet|mass report brigade|ban evasion.*(?:disinfo|propaganda))\b/i,
  },

  // ── Privacy / doxing ─────────────────────────────────────────────────────
  {
    id: 'priv_dox',
    category: 'harm_privacy',
    weight: 2,
    tags: ['dox'],
    rx: /\b(dox(x)?|doxing|fullz\b|osint stalk|find (?:their )?(?:home )?address from|family info from (?:facebook|instagram)|swatting|track someone(?:'s)? (?:phone|location) without)\b/i,
  },
  {
    id: 'priv_harvest',
    category: 'harm_privacy',
    weight: 1,
    tags: ['harvest'],
    rx: /\b(scrape (?:private )?profiles en masse|dump database.*(?:pii|password)|sell (?:leaked|stolen) credentials)\b/i,
  },

  // ── Drugs / controlled substances ────────────────────────────────────────
  {
    id: 'drugs_meth_cook',
    category: 'harm_drugs_controlled',
    weight: 2,
    tags: ['meth', 'synthesis'],
    rx: /\b(crystal meth|methamphetamine|cook meth|pseudoephedrine|red phosphorus|lithium (?:from )?batter|anhydrous ammonia|one[- ]pot meth|nazi meth)\b/i,
  },
  {
    id: 'drugs_opioids_rc',
    category: 'harm_drugs_controlled',
    weight: 1,
    tags: ['opioid', 'rc'],
    rx: /\b(fentanyl analog|carfentanil|xylazine tranq|research chemical dose|rc vendor synthesis|heroin cook)\b/i,
  },

  // ── Generic sexual wording (not necessarily NC - lower severity bucket) ──
  {
    id: 'sex_generic',
    category: 'sexual_content',
    weight: 1,
    tags: ['nsfw'],
    rx: /\b(nsfw|porn|erotic|explicit (?:sexual|scene)|smut|xxx|blow ?job|orgasm|penetration)\b/i,
  },

  // ── Roleplay / persona (jailbreak framing) ───────────────────────────────
  {
    id: 'rp_persona',
    category: 'roleplay',
    weight: 1,
    tags: ['persona'],
    rx: /\b(roleplay|role[- ]?play|act as|pretend to be|you are (a|an|the)|in character|persona:)\b/i,
  },
]

const _CONFIDENCE_CAP = 12

function pickPrimary(scores: Record<string, number>): string | null {
  const entries = Object.entries(scores)
  if (!entries.length) return null
  const max = Math.max(...entries.map(([, s]) => s))
  const top = entries.filter(([, s]) => s === max)
  if (top.length === 1) return top[0][0]
  const order = new Map(CATEGORY_PRIORITY.map((c, i) => [c, i]))
  top.sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999) || a[0].localeCompare(b[0]))
  return top[0][0]
}

/**
 * Full heuristic classification for the prompt text (used in UI + exports).
 */
export function classifyHarmTaxonomy(promptText: string): PromptClassify {
  const text = (promptText || '').trim()
  if (!text) {
    return {
      primary_category: 'unknown',
      confidence: 0,
      scores: {},
      secondary_categories: [],
      tags: [],
      matched_rules: [],
    }
  }

  const scores: Record<string, number> = {}
  const matchedRules: string[] = []
  const tags = new Set<string>()

  for (const rule of RULES) {
    if (!rule.rx.test(text)) continue
    scores[rule.category] = (scores[rule.category] ?? 0) + rule.weight
    matchedRules.push(rule.id)
    for (const t of rule.tags) tags.add(t)
  }

  const primary = pickPrimary(scores)
  if (!primary) {
    return {
      primary_category: 'unknown',
      confidence: 0,
      scores: {},
      secondary_categories: [],
      tags: [],
      matched_rules: [],
    }
  }

  const primaryScore = scores[primary] ?? 0
  const confidence = Math.min(primaryScore / _CONFIDENCE_CAP, 1)

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const secondary = sorted.filter(([c]) => c !== primary).map(([c]) => c)

  return {
    primary_category: primary,
    confidence,
    scores: Object.fromEntries(sorted),
    secondary_categories: secondary,
    tags: Array.from(tags),
    matched_rules: matchedRules,
  }
}

export function formatTaxonomyLabel(categoryId: string): string {
  return HARM_TAXONOMY_LABELS[categoryId] || categoryId.replace(/_/g, ' ')
}
