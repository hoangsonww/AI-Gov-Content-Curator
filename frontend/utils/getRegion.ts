export async function getUserRegion(): Promise<string> {
  try {
    const res = await fetch("https://ipapi.co/json/");
    const data = await res.json();

    return data.country_code || "UNKNOWN";
  } catch (err) {
    console.error("Region detection failed:", err);
    return "UNKNOWN";
  }
}