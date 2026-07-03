// Country code → flag emoji. Our data is GDELT FIPS 10-4 (see
// globe/countries.ts); flag emoji need ISO 3166-1 alpha-2 regional
// indicators, so colliding/differing FIPS codes are remapped first.
// Codes already valid ISO pass through.

const FIPS_TO_ISO: Record<string, string> = {
  // Americas
  CI: 'CL', HA: 'HT', DR: 'DO', HO: 'HN', NU: 'NI', PM: 'PA', CS: 'CR',
  BL: 'BO', PA: 'PY', TD: 'TT', BF: 'BS', GJ: 'GD',
  // Europe
  UK: 'GB', EI: 'IE', GM: 'DE', SP: 'ES', PO: 'PT', SZ: 'CH', AU: 'AT',
  SW: 'SE', DA: 'DK', IC: 'IS', EZ: 'CZ', RB: 'RS', MJ: 'ME', LO: 'SK',
  UP: 'UA', BO: 'BY', RS: 'RU', TU: 'TR', BU: 'BG', AN: 'AD',
  // Middle East / Africa
  IS: 'IL', LE: 'LB', IZ: 'IQ', TC: 'AE', KU: 'KW', YM: 'YE', BA: 'BH',
  MU: 'OM', TS: 'TN', AG: 'DZ', MO: 'MA', MA: 'MG', SU: 'SD', BY: 'BI',
  NI: 'NG', NG: 'NE', IV: 'CI', SG: 'SN', SF: 'ZA', ZI: 'ZW', WA: 'NA',
  TO: 'TG', EK: 'GQ', GA: 'GM', GV: 'GN', PU: 'GW',
  // Asia / Oceania
  BG: 'BD', CE: 'LK', JA: 'JP', KS: 'KR', KN: 'KP', CH: 'CN', MC: 'MO',
  VM: 'VN', CB: 'KH', BM: 'MM', RP: 'PH', SN: 'SG', MG: 'MN', TI: 'TJ',
  TX: 'TM', AJ: 'AZ', GG: 'GE', AS: 'AU', PP: 'PG', NH: 'VU',
}

export function flagEmoji(code: string | null | undefined): string {
  if (!code) return '🌐'
  const iso = FIPS_TO_ISO[code.toUpperCase()] ?? code.toUpperCase()
  if (!/^[A-Z]{2}$/.test(iso)) return '🌐'
  return String.fromCodePoint(
    ...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  )
}
