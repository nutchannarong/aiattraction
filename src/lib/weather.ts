// Weather from Open-Meteo (https://open-meteo.com): free, no API key, CC BY 4.0.

const REVALIDATE_SECONDS = 30 * 60;

type OpenMeteoResponse = {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    precipitation: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
    uv_index_max: (number | null)[];
  };
};

export type DailyForecast = {
  date: string;
  code: number;
  max: number;
  min: number;
  rainChance: number | null;
  uvMax: number | null;
};

export type Weather = {
  current: {
    time: string;
    temperature: number;
    feelsLike: number;
    humidity: number;
    code: number;
    windSpeed: number;
    precipitation: number;
  };
  daily: DailyForecast[];
};

export async function getWeather(latitude: number, longitude: number): Promise<Weather | null> {
  const params = new URLSearchParams({
    // ~1 km precision is plenty and lets nearby attractions share a cache entry.
    latitude: latitude.toFixed(2),
    longitude: longitude.toFixed(2),
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,precipitation",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max",
    timezone: "Asia/Bangkok",
    forecast_days: "7",
  });

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as OpenMeteoResponse;
    if (!data.current || !data.daily?.time) return null;

    const c = data.current;
    const d = data.daily;
    return {
      current: {
        time: c.time,
        temperature: c.temperature_2m,
        feelsLike: c.apparent_temperature,
        humidity: c.relative_humidity_2m,
        code: c.weather_code,
        windSpeed: c.wind_speed_10m,
        precipitation: c.precipitation,
      },
      daily: d.time.map((date, i) => ({
        date,
        code: d.weather_code[i],
        max: d.temperature_2m_max[i],
        min: d.temperature_2m_min[i],
        rainChance: d.precipitation_probability_max[i],
        uvMax: d.uv_index_max[i],
      })),
    };
  } catch {
    // Weather is supplementary; the page still renders without it.
    return null;
  }
}

/** Thai description for a WMO weather interpretation code. */
export function describeWeather(code: number) {
  if (code === 0) return "ท้องฟ้าแจ่มใส";
  if (code === 1) return "ท้องฟ้าโปร่ง";
  if (code === 2) return "มีเมฆบางส่วน";
  if (code === 3) return "เมฆมาก";
  if (code === 45 || code === 48) return "มีหมอก";
  if (code >= 51 && code <= 57) return "ฝนละออง";
  if (code === 61 || code === 80) return "ฝนตกเล็กน้อย";
  if (code === 63 || code === 81) return "ฝนตกปานกลาง";
  if (code === 65 || code === 82) return "ฝนตกหนัก";
  if (code === 66 || code === 67) return "ฝนเยือกแข็ง";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "หิมะตก";
  if (code === 95) return "พายุฝนฟ้าคะนอง";
  if (code === 96 || code === 99) return "พายุฝนฟ้าคะนองและลูกเห็บ";
  return "ไม่ทราบสภาพอากาศ";
}

export function describeUv(uv: number) {
  if (uv < 3) return "ต่ำ";
  if (uv < 6) return "ปานกลาง";
  if (uv < 8) return "สูง";
  if (uv < 11) return "สูงมาก";
  return "อันตราย";
}
