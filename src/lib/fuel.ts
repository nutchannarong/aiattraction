// Fuel prices from PTT (CurrentOilPrice SOAP service, Bangkok prices).
// Cached for a day; falls back to reference prices when PTT can't be reached.

const PTT_ENDPOINT = "https://orapiweb.pttor.com/oilservice/OilPrice.asmx";
const REVALIDATE_SECONDS = 24 * 60 * 60;

export type FuelKey =
  | "diesel"
  | "diesel_b20"
  | "gasohol_91"
  | "gasohol_95"
  | "gasohol_e20"
  | "benzine"
  | "lpg"
  | "ngv"
  | "ev";

export type FuelType = {
  key: FuelKey;
  label: string;
  unit: "ลิตร" | "กก." | "kWh";
  /** Product name in the PTT feed; null when PTT doesn't publish it. */
  pttProduct: string | null;
  /** Reference price used when the live price is unavailable (PTT, 15 Sep 2026). */
  fallbackPrice: number;
};

export const FUEL_TYPES: FuelType[] = [
  { key: "diesel", label: "ดีเซล", unit: "ลิตร", pttProduct: "ดีเซล", fallbackPrice: 40.69 },
  { key: "diesel_b20", label: "ดีเซล B20", unit: "ลิตร", pttProduct: "ดีเซล B20", fallbackPrice: 35.69 },
  { key: "gasohol_91", label: "แก๊สโซฮอล์ 91", unit: "ลิตร", pttProduct: "เบนซินแก๊สโซฮอล์ 91", fallbackPrice: 39.57 },
  { key: "gasohol_95", label: "แก๊สโซฮอล์ 95", unit: "ลิตร", pttProduct: "เบนซินแก๊สโซฮอล์ 95", fallbackPrice: 39.94 },
  { key: "gasohol_e20", label: "แก๊สโซฮอล์ E20", unit: "ลิตร", pttProduct: "เบนซินแก๊สโซฮอล์ E20", fallbackPrice: 34.94 },
  { key: "benzine", label: "เบนซิน 95", unit: "ลิตร", pttProduct: "เบนซิน", fallbackPrice: 48.93 },
  { key: "lpg", label: "LPG", unit: "ลิตร", pttProduct: null, fallbackPrice: 22.29 },
  { key: "ngv", label: "NGV", unit: "กก.", pttProduct: null, fallbackPrice: 18.59 },
  { key: "ev", label: "ไฟฟ้า (EV)", unit: "kWh", pttProduct: null, fallbackPrice: 7.5 },
];

export type FuelPrice = {
  key: FuelKey;
  label: string;
  unit: FuelType["unit"];
  price: number;
  /** "ptt" = live PTT price; "reference" = fallback, not today's price. */
  source: "ptt" | "reference";
  date: string | null;
};

type PttRow = { product: string; price: number; date: string };

function parsePttXml(xml: string): PttRow[] {
  // The SOAP payload nests an escaped XML document; decode it, then read each <FUEL>.
  const decoded = xml.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const rows: PttRow[] = [];
  for (const m of decoded.matchAll(/<FUEL>([\s\S]*?)<\/FUEL>/g)) {
    const block = m[1];
    const product = /<PRODUCT>([^<]*)<\/PRODUCT>/.exec(block)?.[1]?.trim();
    const price = Number(/<PRICE>([^<]*)<\/PRICE>/.exec(block)?.[1]);
    const date = /<PRICE_DATE>([^<]*)<\/PRICE_DATE>/.exec(block)?.[1]?.trim() ?? "";
    if (product && Number.isFinite(price) && price > 0) rows.push({ product, price, date });
  }
  return rows;
}

async function fetchPttPrices(): Promise<PttRow[]> {
  const body = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><CurrentOilPrice xmlns="http://www.pttor.com"><Language>thai</Language></CurrentOilPrice></soap:Body></soap:Envelope>`;
  try {
    const res = await fetch(PTT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: '"http://www.pttor.com/CurrentOilPrice"',
      },
      body,
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    return parsePttXml(await res.text());
  } catch {
    return [];
  }
}

/** Today's price for every fuel type, marking which ones are live from PTT. */
export async function getFuelPrices(): Promise<FuelPrice[]> {
  const rows = await fetchPttPrices();
  return FUEL_TYPES.map((f) => {
    const live = f.pttProduct ? rows.find((r) => r.product === f.pttProduct) : undefined;
    return live
      ? { key: f.key, label: f.label, unit: f.unit, price: live.price, source: "ptt", date: live.date }
      : { key: f.key, label: f.label, unit: f.unit, price: f.fallbackPrice, source: "reference", date: null };
  });
}
