const fs = require("fs");

// DashboardOverview.tsx — remove static demo data blocks
{
  const p = "src/pages/DashboardOverview.tsx";
  let s = fs.readFileSync(p, "utf8");

  function block(src, startMarker, endMarker, replacement, endOffset = 2) {
    const a = src.indexOf(startMarker);
    if (a < 0) throw new Error("not found: " + startMarker);
    const b = src.indexOf(endMarker, a) + endOffset;
    return src.slice(0, a) + replacement + src.slice(b);
  }

  s = block(s, "const DEPARTURES = [", "];", "const DEPARTURES: unknown[] = [];")
  s = block(s, "const STATIC_BOOKINGS = [", "];", "const STATIC_BOOKINGS: { id: string; customer: string; pax: number; amount: string; status: string; tone: Tone }[] = [];")
  s = block(s, "const FEED = [", "];", "const FEED: unknown[] = [];")
  s = block(s, "const REVENUE = [", "];", "const REVENUE: { month: string; revenue: number; bookings: number }[] = [];")
  s = block(s, "const BOOKING_MIX = [", "];", "const BOOKING_MIX: { label: string; value: number; color: string }[] = [];")
  s = block(s, "const TOP_PACKAGES = [", "];", "const TOP_PACKAGES: { id: string; name: string; destination: string; sold: number; target: number; revenue: string }[] = [];")
  s = s.replace("if (liveBookings.length === 0) return STATIC_BOOKINGS;", "return STATIC_BOOKINGS;")
  s = s.replace("? live?.collected ?? 1600000", "? live?.collected ?? 0")
  s = s.replace("? live?.outstanding ?? 204100", "? live?.outstanding ?? 0")

  fs.writeFileSync(p, s);
}

// TripsDashboard.tsx — clear static prototype trip seat overrides
{
  const p = "src/pages/TripsDashboard.tsx";
  let s = fs.readFileSync(p, "utf8");
  const a = s.indexOf("const TRIPS");
  if (a >= 0) {
    const b = s.indexOf("\n];", a) + 3;
    s = s.slice(0, a) + "const TRIPS: PrototypeTrip[] = [];\n" + s.slice(b);
  }
  fs.writeFileSync(p, s);
}

console.log("done");
