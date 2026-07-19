/** Live local weather via Open-Meteo (free, no API key). */

export interface WeatherInfo {
  tempC: number;
  label: string;
  emoji: string;
}

const WMO: Array<[codes: number[], label: string, emoji: string]> = [
  [[0], "Clear", "☀️"],
  [[1, 2], "Partly cloudy", "🌤️"],
  [[3], "Overcast", "☁️"],
  [[45, 48], "Foggy", "🌫️"],
  [[51, 53, 55, 56, 57], "Drizzle", "🌦️"],
  [[61, 63, 65, 66, 67, 80, 81, 82], "Rainy", "🌧️"],
  [[71, 73, 75, 77, 85, 86], "Snowy", "❄️"],
  [[95, 96, 99], "Stormy", "⛈️"],
];

function describe(code: number): { label: string; emoji: string } {
  for (const [codes, label, emoji] of WMO) {
    if (codes.includes(code)) return { label, emoji };
  }
  return { label: "Mild", emoji: "🌤️" };
}

/** Human summary the stylist can reason about, e.g. "Rainy, 14°C (cool)". */
export function weatherSummary(w: WeatherInfo): string {
  const t = w.tempC;
  const band =
    t >= 30 ? "hot" : t >= 22 ? "warm" : t >= 14 ? "mild" : t >= 6 ? "cool" : "cold";
  return `${w.label}, ${Math.round(t)}°C (${band})`;
}

export async function fetchWeather(): Promise<WeatherInfo | null> {
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 6000,
        maximumAge: 30 * 60 * 1000,
      })
    );
    const { latitude, longitude } = pos.coords;
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`
    );
    if (!res.ok) return null;
    const json = await res.json();
    const tempC: number = json?.current?.temperature_2m;
    const code: number = json?.current?.weather_code ?? 1;
    if (typeof tempC !== "number") return null;
    return { tempC, ...describe(code) };
  } catch {
    return null; // permission denied / offline — the UI offers manual options
  }
}
