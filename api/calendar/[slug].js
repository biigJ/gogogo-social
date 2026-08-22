const SUPABASE_URL = "https://agpysewcsakdpmpftndp.supabase.co";
const CALENDAR_BUCKET = "go-calendars";

function normalizeIcsForGoogle(body) {
  var raw = String(body || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  var unfolded = [];
  raw.split("\n").forEach(function (line) {
    if ((line.charAt(0) === " " || line.charAt(0) === "\t") && unfolded.length) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  });

  var out = [];
  var inTz = false;
  unfolded.forEach(function (line) {
    if (!line) return;
    if (line === "BEGIN:VTIMEZONE") {
      inTz = true;
      return;
    }
    if (inTz) {
      if (line === "END:VTIMEZONE") inTz = false;
      return;
    }
    if (line.indexOf("X-WR-TIMEZONE:") === 0) return;
    if (line.indexOf("STATUS:") === 0) return;
    if (line.indexOf("TRANSP:") === 0) return;
    if (line.indexOf("CREATED:") === 0) return;
    if (line.indexOf("REFRESH-INTERVAL") === 0) return;
    if (line.indexOf("X-PUBLISHED-TTL") === 0) return;
    if (line.indexOf("X-LIC-LOCATION:") === 0) return;
    line = line.replace(/^DTSTART;TZID=[^:]+:/, "DTSTART:");
    line = line.replace(/^DTEND;TZID=[^:]+:/, "DTEND:");
    if (line.indexOf("RRULE:") === 0) line = "RRULE:FREQ=WEEKLY";
    line = line.replace(/\u00b7/g, " - ");
    out.push(line);
  });

  var text = out.join("\r\n");
  if (!text.endsWith("\r\n")) text += "\r\n";
  return text;
}

module.exports = async function handler(req, res) {
  var slug = String(req.query.slug || "");
  if (!/^[a-zA-Z0-9-]+\.ics$/.test(slug)) {
    res.status(400).send("Invalid calendar path");
    return;
  }

  var upstream = SUPABASE_URL + "/storage/v1/object/public/" + CALENDAR_BUCKET + "/" + slug;
  try {
    var up = await fetch(upstream, {
      headers: { Accept: "text/calendar, text/plain, */*" }
    });
    if (!up.ok) {
      res.status(up.status === 404 ? 404 : 502).send("Calendar feed not found");
      return;
    }
    var body = normalizeIcsForGoogle(await up.text());
    if (!body || body.indexOf("BEGIN:VCALENDAR") !== 0) {
      res.status(502).send("Invalid calendar feed");
      return;
    }
    res.setHeader("Content-Type", "text/calendar");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(200).send(body);
  } catch (err) {
    res.status(502).send("Calendar feed unavailable");
  }
};
