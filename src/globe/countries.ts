/** Country code → human-readable name.
 *
 * GDELT — our dominant data source — uses FIPS 10-4 codes, not ISO 3166-1.
 * The two systems disagree on many codes:
 *
 *   FIPS:    CH=China,   RS=Russia,  IS=Israel,  AS=Australia, JA=Japan,
 *            KS=Korea,   UK=UK,      GM=Germany, VM=Vietnam,   SP=Spain,
 *            MO=Morocco, BG=Bangladesh, BO=Belarus, ...
 *   ISO:     CH=Switzerland, RS=Serbia, IS=Iceland, AS=Am.Samoa, JA=??,
 *            KS=??, UK=??, GM=??, VM=??, SP=??, MO=Macau, BG=Bulgaria, ...
 *
 * For ambiguous codes we resolve to the FIPS meaning (matches our data).
 * ISO-only codes that don't collide with FIPS are also included so non-GDELT
 * sources (NWS, future feeds) still render correctly.
 */
export const COUNTRY_NAMES: Record<string, string> = {
  // === Americas ===
  US: 'United States',
  CA: 'Canada',
  MX: 'Mexico',
  BR: 'Brazil',
  AR: 'Argentina',
  CI: 'Chile',                 // FIPS  (ISO: CL)
  CL: 'Chile',                 // ISO
  CO: 'Colombia',
  PE: 'Peru',
  VE: 'Venezuela',
  CU: 'Cuba',
  HA: 'Haiti',                 // FIPS  (ISO: HT)
  HT: 'Haiti',                 // ISO
  DR: 'Dominican Republic',    // FIPS  (ISO: DO)
  JM: 'Jamaica',
  GT: 'Guatemala',
  HO: 'Honduras',              // FIPS  (ISO: HN)
  HN: 'Honduras',
  NU: 'Nicaragua',             // FIPS  (ISO: NI)
  PM: 'Panama',                // FIPS  (ISO: PA)
  CS: 'Costa Rica',            // FIPS  (ISO: CR)
  CR: 'Costa Rica',
  EC: 'Ecuador',
  BL: 'Bolivia',               // FIPS  (ISO: BO conflicts with Belarus FIPS — skip ISO)
  UY: 'Uruguay',
  PA: 'Paraguay',              // FIPS  (ISO: PY conflicts)
  PY: 'Paraguay',              // ISO
  GY: 'Guyana',
  SR: 'Suriname',
  BB: 'Barbados',
  TD: 'Trinidad and Tobago',   // FIPS  (ISO: TT)
  TT: 'Trinidad and Tobago',   // ISO
  BF: 'Bahamas',               // FIPS  (ISO: BS)
  BS: 'Bahamas',               // ISO
  GJ: 'Grenada',
  // === Europe ===
  UK: 'United Kingdom',        // FIPS  (ISO: GB)
  GB: 'United Kingdom',        // ISO
  EI: 'Ireland',               // FIPS  (ISO: IE)
  IE: 'Ireland',
  FR: 'France',
  GM: 'Germany',               // FIPS  (ISO: DE)
  DE: 'Germany',
  IT: 'Italy',
  SP: 'Spain',                 // FIPS  (ISO: ES — but ES is El Salvador in FIPS)
  ES: 'El Salvador',           // FIPS  (most of our SP data is Spain — we accept this trade-off)
  PO: 'Portugal',              // FIPS  (ISO: PT)
  PT: 'Portugal',
  NL: 'Netherlands',
  BE: 'Belgium',
  SZ: 'Switzerland',           // FIPS  (ISO: CH is China in FIPS — skip)
  AU: 'Austria',               // FIPS  (ISO: AT — AT is below)
  AT: 'Austria',
  SW: 'Sweden',                // FIPS  (ISO: SE)
  SE: 'Sweden',
  NO: 'Norway',
  DA: 'Denmark',               // FIPS  (ISO: DK)
  DK: 'Denmark',
  FI: 'Finland',
  IC: 'Iceland',               // FIPS  (ISO IS = Israel in FIPS — skip)
  PL: 'Poland',
  EZ: 'Czech Republic',        // FIPS  (ISO: CZ)
  CZ: 'Czech Republic',
  HU: 'Hungary',
  RO: 'Romania',
  GR: 'Greece',
  RB: 'Serbia',                // FIPS  (ISO RS = Russia in FIPS — skip)
  HR: 'Croatia',
  AL: 'Albania',
  MJ: 'Montenegro',
  MK: 'North Macedonia',
  SI: 'Slovenia',
  LO: 'Slovakia',              // FIPS  (ISO: SK)
  SK: 'Slovakia',
  UP: 'Ukraine',               // FIPS  (ISO: UA)
  UA: 'Ukraine',
  BO: 'Belarus',               // FIPS  (ISO BO = Bolivia — conflicting; we chose FIPS)
  RS: 'Russia',                // FIPS  (ISO: RU)
  RU: 'Russia',
  TU: 'Turkey',                // FIPS  (ISO: TR)
  TR: 'Turkey',
  LU: 'Luxembourg',
  MT: 'Malta',
  AN: 'Andorra',
  GI: 'Gibraltar',
  MD: 'Moldova',
  // === Middle East / North Africa ===
  IS: 'Israel',                // FIPS  (ISO: IL)
  IL: 'Israel',
  LE: 'Lebanon',               // FIPS  (ISO: LB)
  LB: 'Lebanon',
  SY: 'Syria',
  JO: 'Jordan',
  IZ: 'Iraq',                  // FIPS  (ISO: IQ)
  IQ: 'Iraq',
  IR: 'Iran',
  SA: 'Saudi Arabia',
  AE: 'United Arab Emirates',
  TC: 'United Arab Emirates',
  QA: 'Qatar',
  KU: 'Kuwait',                // FIPS  (ISO: KW)
  KW: 'Kuwait',
  YM: 'Yemen',                 // FIPS  (ISO: YE)
  YE: 'Yemen',
  BA: 'Bahrain',               // FIPS  (ISO: BH)
  BH: 'Bahrain',
  MU: 'Oman',                  // FIPS  (ISO: OM)
  OM: 'Oman',
  EG: 'Egypt',
  LY: 'Libya',
  TS: 'Tunisia',               // FIPS  (ISO TN = Tonga in FIPS — skip)
  AG: 'Algeria',               // FIPS  (ISO: DZ)
  DZ: 'Algeria',
  MO: 'Morocco',               // FIPS  (ISO: MA — MA is Madagascar in FIPS)
  MA: 'Madagascar',            // FIPS
  // === Sub-Saharan Africa ===
  SU: 'Sudan',                 // FIPS  (ISO: SD)
  SD: 'Sudan',
  SO: 'Somalia',
  ET: 'Ethiopia',
  KE: 'Kenya',
  UG: 'Uganda',
  TZ: 'Tanzania',
  RW: 'Rwanda',
  BY: 'Burundi',               // FIPS  (ISO BY = Belarus — conflicting; chose FIPS)
  NI: 'Nigeria',               // FIPS  (ISO NI = Nicaragua — chose FIPS)
  NG: 'Niger',                 // FIPS  (ISO: NE)
  NE: 'Niger',
  GH: 'Ghana',
  IV: "Côte d'Ivoire",
  ML: 'Mali',
  SG: 'Senegal',               // FIPS  (ISO SN = Singapore in FIPS — skip)
  CM: 'Cameroon',
  CG: 'Republic of the Congo',
  CF: 'Central African Republic',
  CD: 'DR Congo',              // ISO
  SF: 'South Africa',          // FIPS  (ISO: ZA)
  ZA: 'South Africa',
  ZI: 'Zimbabwe',              // FIPS  (ISO: ZW)
  ZW: 'Zimbabwe',
  AO: 'Angola',
  MZ: 'Mozambique',
  WA: 'Namibia',               // FIPS  (ISO: NA)
  TO: 'Togo',
  EK: 'Equatorial Guinea',
  GA: 'Gambia',
  GV: 'Guinea',
  PU: 'Guinea-Bissau',
  // === South Asia / SE Asia / East Asia ===
  IN: 'India',
  PK: 'Pakistan',
  BG: 'Bangladesh',            // FIPS  (ISO BG = Bulgaria — chose FIPS)
  BD: 'Bangladesh',
  BU: 'Bulgaria',              // FIPS
  CE: 'Sri Lanka',             // FIPS  (ISO: LK)
  LK: 'Sri Lanka',
  NP: 'Nepal',
  AF: 'Afghanistan',
  BT: 'Bhutan',
  MV: 'Maldives',
  JA: 'Japan',                 // FIPS  (ISO: JP)
  JP: 'Japan',
  KS: 'South Korea',           // FIPS  (ISO: KR)
  KR: 'South Korea',
  KN: 'North Korea',           // FIPS  (ISO: KP)
  KP: 'North Korea',
  CH: 'China',                 // FIPS  (ISO: CN — CN below)
  CN: 'China',
  TW: 'Taiwan',
  HK: 'Hong Kong',
  MC: 'Macau',                 // FIPS  (ISO MO = Macau but used here for Morocco)
  VM: 'Vietnam',               // FIPS  (ISO: VN)
  VN: 'Vietnam',
  TH: 'Thailand',
  LA: 'Laos',
  CB: 'Cambodia',              // FIPS  (ISO: KH)
  KH: 'Cambodia',
  BM: 'Myanmar',               // FIPS  (ISO: MM)
  MM: 'Myanmar',
  MY: 'Malaysia',
  ID: 'Indonesia',
  RP: 'Philippines',           // FIPS  (ISO: PH)
  PH: 'Philippines',
  SN: 'Singapore',             // FIPS  (ISO SN = Senegal in FIPS)
  MG: 'Mongolia',              // FIPS  (ISO: MN)
  MN: 'Mongolia',
  KZ: 'Kazakhstan',
  UZ: 'Uzbekistan',
  KG: 'Kyrgyzstan',
  TI: 'Tajikistan',            // FIPS  (ISO: TJ)
  TJ: 'Tajikistan',
  TX: 'Turkmenistan',          // FIPS  (ISO: TM)
  TM: 'Turkmenistan',
  AJ: 'Azerbaijan',            // FIPS  (ISO: AZ)
  AZ: 'Azerbaijan',
  AM: 'Armenia',
  GG: 'Georgia',               // FIPS  (ISO: GE)
  GE: 'Georgia',
  // === Oceania ===
  AS: 'Australia',             // FIPS  (ISO AS = American Samoa)
  NZ: 'New Zealand',
  PP: 'Papua New Guinea',      // FIPS  (ISO: PG)
  PG: 'Papua New Guinea',
  FJ: 'Fiji',
  NH: 'Vanuatu',               // FIPS  (ISO: VU)
  VU: 'Vanuatu',
  WS: 'Samoa',
}

export function countryName(cc: string | null | undefined): string | null {
  if (!cc) return null
  return COUNTRY_NAMES[cc.toUpperCase()] ?? null
}

export function locationLabel(
  city: string | null | undefined,
  cc: string | null | undefined,
): string | null {
  const name = countryName(cc)
  // Drop city when it duplicates the country name ("Russia · Russia" is noise)
  const cityNorm = (city ?? '').trim().toLowerCase()
  const nameNorm = (name ?? '').trim().toLowerCase()
  const sameAsCountry = !!city && !!name && cityNorm === nameNorm

  if (city && name && !sameAsCountry) return `${city} · ${name}`
  if (name) return name
  if (city) return city
  // Unknown FIPS code → render nothing rather than a 2-letter mystery
  return null
}
