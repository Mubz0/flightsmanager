// Multi-airport city codes that SerpApi doesn't support directly.
// Maps city code -> individual airport IATA codes.
const CITY_AIRPORT_MAP: Record<string, string[]> = {
  LON: ["LHR", "LGW", "STN", "LTN", "LCY"],
  NYC: ["JFK", "EWR", "LGA"],
  PAR: ["CDG", "ORY"],
  TYO: ["NRT", "HND"],
  CHI: ["ORD", "MDW"],
  WAS: ["IAD", "DCA", "BWI"],
  MIL: ["MXP", "LIN"],
  BUE: ["EZE", "AEP"],
  MOW: ["SVO", "DME", "VKO"],
  SAO: ["GRU", "CGH"],
  SEL: ["ICN", "GMP"],
  BJS: ["PEK", "PKX"],
  OSA: ["KIX", "ITM"],
  STO: ["ARN", "BMA"],
  BER: ["BER"],
  ROM: ["FCO", "CIA"],
  MEX: ["MEX"],
  YTO: ["YYZ", "YTZ"],
  YMQ: ["YUL", "YMX"],
};

export function expandCityCode(code: string): string[] | null {
  return CITY_AIRPORT_MAP[code.toUpperCase()] || null;
}
