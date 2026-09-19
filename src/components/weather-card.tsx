import { describeUv, describeWeather, getWeather } from "@/lib/weather";

type Props = { latitude: number; longitude: number };

function dayLabel(date: string, index: number) {
  if (index === 0) return "วันนี้";
  return new Date(`${date}T00:00:00+07:00`).toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

const round = (n: number) => Math.round(n);

export async function WeatherCard({ latitude, longitude }: Props) {
  const weather = await getWeather(latitude, longitude);

  if (!weather) {
    return (
      <section className="rounded-xl border border-border bg-surface p-5 text-sm text-muted">
        ไม่สามารถโหลดข้อมูลสภาพอากาศได้ในขณะนี้
      </section>
    );
  }

  const { current, daily } = weather;
  const today = daily[0];
  const updated = new Date(`${current.time}:00+07:00`).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });

  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">สภาพอากาศ</h2>
        <span className="text-xs text-muted">อัปเดต {updated} น.</span>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <p className="text-4xl font-semibold tabular-nums">{round(current.temperature)}°C</p>
          <p className="text-sm">{describeWeather(current.code)}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted">รู้สึกเหมือน</dt>
            <dd className="tabular-nums">{round(current.feelsLike)}°C</dd>
          </div>
          <div>
            <dt className="text-muted">ความชื้น</dt>
            <dd className="tabular-nums">{current.humidity}%</dd>
          </div>
          <div>
            <dt className="text-muted">ลม</dt>
            <dd className="tabular-nums">{round(current.windSpeed)} กม./ชม.</dd>
          </div>
          {today?.uvMax != null && (
            <div>
              <dt className="text-muted">UV สูงสุดวันนี้</dt>
              <dd className="tabular-nums">
                {round(today.uvMax)} ({describeUv(today.uvMax)})
              </dd>
            </div>
          )}
        </dl>
      </div>

      <ol className="grid grid-cols-4 gap-2 text-center text-xs sm:grid-cols-7">
        {daily.map((day, i) => (
          <li key={day.date} className="rounded-lg bg-background px-1 py-2">
            <p className="font-medium">{dayLabel(day.date, i)}</p>
            <p className="mt-1 min-h-8 leading-tight text-muted">{describeWeather(day.code)}</p>
            <p className="mt-1 tabular-nums">
              {round(day.max)}° / {round(day.min)}°
            </p>
            {day.rainChance != null && (
              <p className="tabular-nums text-secondary">ฝน {day.rainChance}%</p>
            )}
          </li>
        ))}
      </ol>

      <p className="text-xs text-muted">
        ข้อมูลสภาพอากาศจาก{" "}
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="underline">
          Open-Meteo.com
        </a>
      </p>
    </section>
  );
}

export function WeatherCardSkeleton() {
  return (
    <section
      aria-busy="true"
      className="h-56 animate-pulse rounded-xl border border-border bg-surface motion-reduce:animate-none"
    >
      <span className="sr-only">กำลังโหลดสภาพอากาศ…</span>
    </section>
  );
}
