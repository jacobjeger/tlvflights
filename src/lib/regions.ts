/**
 * Destination region mapping for grouping flights by geography.
 */

export interface Region {
  id: string;
  name: string;
  emoji: string;
}

export const REGIONS: Region[] = [
  { id: 'all', name: 'All', emoji: '' },
  { id: 'europe-south', name: 'Southern Europe', emoji: '' },
  { id: 'europe-west', name: 'Western Europe', emoji: '' },
  { id: 'europe-central', name: 'Central Europe', emoji: '' },
  { id: 'europe-east', name: 'Eastern Europe', emoji: '' },
  { id: 'europe-north', name: 'Scandinavia', emoji: '' },
  { id: 'balkans', name: 'Balkans', emoji: '' },
  { id: 'caucasus', name: 'Caucasus', emoji: '' },
  { id: 'middle-east', name: 'Middle East', emoji: '' },
  { id: 'africa', name: 'Africa', emoji: '' },
  { id: 'asia', name: 'Asia', emoji: '' },
  { id: 'other', name: 'Other', emoji: '' },
];

// Map IATA codes to region IDs
const DESTINATION_REGIONS: Record<string, string> = {
  // Southern Europe - Greece
  ATH: 'europe-south', RHO: 'europe-south', HER: 'europe-south',
  CFU: 'europe-south', JTR: 'europe-south', SKG: 'europe-south',
  JMK: 'europe-south', ZTH: 'europe-south', KGS: 'europe-south',
  MJT: 'europe-south', AOK: 'europe-south', EFL: 'europe-south',
  JSI: 'europe-south', SMI: 'europe-south',
  // Southern Europe - Italy
  ROM: 'europe-south', FCO: 'europe-south', MXP: 'europe-south',
  MIL: 'europe-south', BLQ: 'europe-south', BRI: 'europe-south',
  NAP: 'europe-south', CTA: 'europe-south', VRN: 'europe-south',
  VCE: 'europe-south',
  // Southern Europe - Spain
  MAD: 'europe-south', BCN: 'europe-south', AGP: 'europe-south',
  VLC: 'europe-south',
  // Southern Europe - Portugal
  LIS: 'europe-south', OPO: 'europe-south',
  // Southern Europe - Cyprus
  LCA: 'europe-south', PFO: 'europe-south',
  // Southern Europe - Malta
  MLA: 'europe-south',
  // Western Europe
  LON: 'europe-west', LHR: 'europe-west', LGW: 'europe-west',
  STN: 'europe-west', LTN: 'europe-west',
  PAR: 'europe-west', CDG: 'europe-west', ORY: 'europe-west',
  MRS: 'europe-west', GNB: 'europe-west', NCE: 'europe-west',
  AMS: 'europe-west', BRU: 'europe-west',
  BSL: 'europe-west', ZRH: 'europe-west', GVA: 'europe-west',
  // Central Europe
  BER: 'europe-central', FRA: 'europe-central', MUC: 'europe-central',
  DUS: 'europe-central', CGN: 'europe-central', STR: 'europe-central',
  HAM: 'europe-central',
  VIE: 'europe-central', SZG: 'europe-central',
  PRG: 'europe-central', BTS: 'europe-central',
  BUD: 'europe-central', DEB: 'europe-central',
  WAW: 'europe-central', KRK: 'europe-central',
  // Eastern Europe
  BUH: 'europe-east', OTP: 'europe-east',
  SOF: 'europe-east', VAR: 'europe-east', BOJ: 'europe-east',
  KBP: 'europe-east', IEV: 'europe-east',
  KIV: 'europe-east', MSQ: 'europe-east',
  VNO: 'europe-east', RIX: 'europe-east', TLL: 'europe-east',
  // Scandinavia
  OSL: 'europe-north', BGO: 'europe-north', RVN: 'europe-north',
  ARN: 'europe-north', CPH: 'europe-north', HEL: 'europe-north',
  // Balkans
  TIA: 'balkans', TIV: 'balkans', LJU: 'balkans',
  ZAG: 'balkans', BEG: 'balkans', SKP: 'balkans',
  SJJ: 'balkans', DBV: 'balkans', SPU: 'balkans',
  // Caucasus
  TBS: 'caucasus', BUS: 'caucasus', BAK: 'caucasus',
  EVN: 'caucasus',
  // Middle East
  DXB: 'middle-east', AUH: 'middle-east', DOH: 'middle-east',
  AMM: 'middle-east', IST: 'middle-east', SAW: 'middle-east',
  AYT: 'middle-east', SSH: 'middle-east', HRG: 'middle-east',
  CAI: 'middle-east', RUH: 'middle-east', JED: 'middle-east',
  BAH: 'middle-east', MCT: 'middle-east', KWI: 'middle-east',
  // Africa
  ZNZ: 'africa', NBO: 'africa', ADD: 'africa',
  CMN: 'africa', RAK: 'africa', ACC: 'africa',
  LOS: 'africa', JNB: 'africa', CPT: 'africa',
  DAR: 'africa',
  // Asia
  BKK: 'asia', DEL: 'asia', BOM: 'asia',
  HKG: 'asia', SIN: 'asia', PEK: 'asia',
  PVG: 'asia', ICN: 'asia', NRT: 'asia',
  KTM: 'asia', CMB: 'asia', MLE: 'asia',
};

export function getRegionForDestination(iata: string): string {
  return DESTINATION_REGIONS[iata] || 'other';
}

export function getRegionName(regionId: string): string {
  const region = REGIONS.find((r) => r.id === regionId);
  return region?.name || 'Other';
}
