/**
 * IATA airport code to country code mapping for flag display.
 */

const AIRPORT_COUNTRIES: Record<string, string> = {
  // Greece
  ATH: 'GR', RHO: 'GR', HER: 'GR', CFU: 'GR', JTR: 'GR', SKG: 'GR',
  JMK: 'GR', ZTH: 'GR', KGS: 'GR', MJT: 'GR', AOK: 'GR', EFL: 'GR',
  JSI: 'GR', SMI: 'GR',
  // Italy
  ROM: 'IT', FCO: 'IT', MXP: 'IT', MIL: 'IT', BLQ: 'IT', BRI: 'IT',
  NAP: 'IT', CTA: 'IT', VRN: 'IT', VCE: 'IT',
  // Spain
  MAD: 'ES', BCN: 'ES', AGP: 'ES', VLC: 'ES',
  // Portugal
  LIS: 'PT', OPO: 'PT',
  // Cyprus
  LCA: 'CY', PFO: 'CY',
  // Malta
  MLA: 'MT',
  // UK
  LON: 'GB', LHR: 'GB', LGW: 'GB', STN: 'GB', LTN: 'GB',
  // France
  PAR: 'FR', CDG: 'FR', ORY: 'FR', MRS: 'FR', GNB: 'FR', NCE: 'FR',
  // Netherlands
  AMS: 'NL',
  // Belgium
  BRU: 'BE',
  // Switzerland
  BSL: 'CH', ZRH: 'CH', GVA: 'CH',
  // Germany
  BER: 'DE', FRA: 'DE', MUC: 'DE', DUS: 'DE', CGN: 'DE', STR: 'DE', HAM: 'DE',
  // Austria
  VIE: 'AT', SZG: 'AT',
  // Czech Republic
  PRG: 'CZ',
  // Slovakia
  BTS: 'SK',
  // Hungary
  BUD: 'HU', DEB: 'HU',
  // Poland
  WAW: 'PL', KRK: 'PL',
  // Romania
  BUH: 'RO', OTP: 'RO',
  // Bulgaria
  SOF: 'BG', VAR: 'BG', BOJ: 'BG',
  // Ukraine
  KBP: 'UA', IEV: 'UA',
  // Moldova
  KIV: 'MD',
  // Lithuania
  VNO: 'LT',
  // Latvia
  RIX: 'LV',
  // Estonia
  TLL: 'EE',
  // Norway
  OSL: 'NO', BGO: 'NO',
  // Finland
  HEL: 'FI', RVN: 'FI',
  // Sweden
  ARN: 'SE',
  // Denmark
  CPH: 'DK',
  // Albania
  TIA: 'AL',
  // Montenegro
  TIV: 'ME',
  // Slovenia
  LJU: 'SI',
  // Croatia
  ZAG: 'HR', DBV: 'HR', SPU: 'HR',
  // Serbia
  BEG: 'RS',
  // North Macedonia
  SKP: 'MK',
  // Bosnia
  SJJ: 'BA',
  // Georgia
  TBS: 'GE', BUS: 'GE',
  // Azerbaijan
  BAK: 'AZ',
  // Armenia
  EVN: 'AM',
  // UAE
  DXB: 'AE', AUH: 'AE',
  // Qatar
  DOH: 'QA',
  // Jordan
  AMM: 'JO',
  // Turkey
  IST: 'TR', SAW: 'TR', AYT: 'TR',
  // Egypt
  SSH: 'EG', HRG: 'EG', CAI: 'EG',
  // Saudi Arabia
  RUH: 'SA', JED: 'SA',
  // Bahrain
  BAH: 'BH',
  // Oman
  MCT: 'OM',
  // Kuwait
  KWI: 'KW',
  // Tanzania
  ZNZ: 'TZ', DAR: 'TZ',
  // Kenya
  NBO: 'KE',
  // Ethiopia
  ADD: 'ET',
  // Morocco
  CMN: 'MA', RAK: 'MA',
  // Ghana
  ACC: 'GH',
  // Nigeria
  LOS: 'NG',
  // South Africa
  JNB: 'ZA', CPT: 'ZA',
  // Thailand
  BKK: 'TH',
  // India
  DEL: 'IN', BOM: 'IN',
  // Hong Kong
  HKG: 'HK',
  // Singapore
  SIN: 'SG',
  // China
  PEK: 'CN', PVG: 'CN',
  // South Korea
  ICN: 'KR',
  // Japan
  NRT: 'JP',
  // Nepal
  KTM: 'NP',
  // Sri Lanka
  CMB: 'LK',
  // Maldives
  MLE: 'MV',
  // Belarus
  MSQ: 'BY',
  // USA
  JFK: 'US', EWR: 'US', LAX: 'US', MIA: 'US', ORD: 'US', SFO: 'US',
  BOS: 'US', IAD: 'US', DFW: 'US', ATL: 'US', IAH: 'US', SEA: 'US',
  LAS: 'US', MCO: 'US', DEN: 'US', PHL: 'US', CLT: 'US', PHX: 'US',
  MSP: 'US', DTW: 'US', BWI: 'US', FLL: 'US', SAN: 'US', TPA: 'US',
  PDX: 'US', STL: 'US', SLC: 'US', HNL: 'US', AUS: 'US', RDU: 'US',
  // Canada
  YYZ: 'CA', YUL: 'CA', YVR: 'CA', YOW: 'CA', YEG: 'CA', YYC: 'CA',
  YWG: 'CA', YHZ: 'CA',
  // Mexico
  MEX: 'MX', CUN: 'MX', GDL: 'MX', SJD: 'MX', PVR: 'MX',
  // Caribbean
  SJU: 'PR', PUJ: 'DO', NAS: 'BS', MBJ: 'JM', KIN: 'JM',
  BGI: 'BB', AUA: 'AW', CUR: 'CW', SXM: 'SX', HAV: 'CU',
  SDQ: 'DO', POS: 'TT', GCM: 'KY',
  // South America
  GRU: 'BR', GIG: 'BR', EZE: 'AR', BOG: 'CO', SCL: 'CL',
  LIM: 'PE', MVD: 'UY', CCS: 'VE', UIO: 'EC', MDE: 'CO',
  PTY: 'PA',
  // More Asia
  KUL: 'MY', MNL: 'PH', CGK: 'ID', HAN: 'VN', SGN: 'VN',
  TPE: 'TW', PNH: 'KH', RGN: 'MM', DAD: 'VN',
  // Oceania
  SYD: 'AU', MEL: 'AU', BNE: 'AU', AKL: 'NZ', PER: 'AU', NAN: 'FJ',
};

/**
 * Convert country code to flag emoji.
 * Uses regional indicator symbols: each letter maps to 0x1F1E6 + offset.
 */
export function countryCodeToFlag(countryCode: string): string {
  const cc = countryCode.toUpperCase();
  if (cc.length !== 2) return '';
  const first = 0x1f1e6 + (cc.charCodeAt(0) - 65);
  const second = 0x1f1e6 + (cc.charCodeAt(1) - 65);
  return String.fromCodePoint(first, second);
}

export function getFlagForAirport(iata: string): string {
  const cc = AIRPORT_COUNTRIES[iata];
  if (!cc) return '';
  return countryCodeToFlag(cc);
}

export function getCountryCodeForAirport(iata: string): string | null {
  return AIRPORT_COUNTRIES[iata] || null;
}
