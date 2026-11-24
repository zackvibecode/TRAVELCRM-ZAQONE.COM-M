import io

p = r"src\pages\BookingWorkspace.tsx"
src = io.open(p, encoding="utf-8").read()

def replace_block(src, start_marker, end_marker, replacement, end_offset=2):
    start = src.index(start_marker)
    end = src.index(end_marker, start) + end_offset
    return src[:start] + replacement + src[end:]

src = replace_block(src, "const PAKET: BwPackage[] = [", "];", "const PAKET: BwPackage[] = [];")
src = replace_block(src, "const KEBERANGKATAN: BwDeparture[] = [", "];", "const KEBERANGKATAN: BwDeparture[] = [];")
src = replace_block(src, "const PELANGGAN: BwCustomer[] = [", "];", "const PELANGGAN: BwCustomer[] = [];")
src = replace_block(src, "const AWAL_BOOKING: BwBooking[] = [", "\n];", "const AWAL_BOOKING: BwBooking[] = [];", end_offset=3)

io.open(p, "w", encoding="utf-8", newline="\n").write(src)
print("done")
