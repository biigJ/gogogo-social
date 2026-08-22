const SUPABASE_URL = "https://agpysewcsakdpmpftndp.supabase.co";
const CALENDAR_BUCKET = "go-calendars";
const EXPAND_WEEKS = 16;

function icsAscii(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss");
}

function unfoldIcs(body) {
  var raw = String(body || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  var unfolded = [];
  raw.split("\n").forEach(function (line) {
    if ((line.charAt(0) === " " || line.charAt(0) === "\t") && unfolded.length) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  });
  return unfolded;
}

function parseIcsDateValue(value) {
  var v = String(value || "").trim();
  if (!v) return null;
  var m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?$/);
  if (!m) return null;
  return {
    ymd: m[1] + m[2] + m[3],
    time: m[4] ? m[4] + m[5] + m[6] : null,
    utc: !!m[7]
  };
}

function ymdToDate(ymd) {
  return new Date(
    parseInt(ymd.slice(0, 4), 10),
    parseInt(ymd.slice(4, 6), 10) - 1,
    parseInt(ymd.slice(6, 8), 10)
  );
}

function dateToYmd(d) {
  return (
    String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0")
  );
}

function addDaysYmd(ymd, days) {
  var d = ymdToDate(ymd);
  d.setDate(d.getDate() + days);
  return dateToYmd(d);
}

function nextFutureYmd(ymd) {
  var today = new Date();
  var start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  var eventDay = ymdToDate(ymd);
  while (eventDay < start) {
    eventDay.setDate(eventDay.getDate() + 7);
  }
  return dateToYmd(eventDay);
}

function formatIcsDate(parsed) {
  if (!parsed) return "";
  if (parsed.time) return parsed.ymd + "T" + parsed.time;
  return parsed.ymd;
}

function shiftIcsDateByDays(value, days) {
  var parsed = parseIcsDateValue(value);
  if (!parsed) return value;
  var nextYmd = addDaysYmd(parsed.ymd, days);
  if (parsed.time) return nextYmd + "T" + parsed.time;
  return nextYmd;
}

function sanitizeLine(line) {
  if (!line) return null;
  if (line.indexOf("X-WR-TIMEZONE:") === 0) return null;
  if (line.indexOf("STATUS:") === 0) return null;
  if (line.indexOf("TRANSP:") === 0) return null;
  if (line.indexOf("CREATED:") === 0) return null;
  if (line.indexOf("REFRESH-INTERVAL") === 0) return null;
  if (line.indexOf("X-PUBLISHED-TTL") === 0) return null;
  if (line.indexOf("X-LIC-LOCATION:") === 0) return null;
  if (line.indexOf("RRULE:") === 0) return null;

  line = line.replace(/^DTSTART;TZID=[^:]+:/, "DTSTART:");
  line = line.replace(/^DTEND;TZID=[^:]+:/, "DTEND:");
  line = line.replace(/\u00b7/g, " - ");

  if (
    line.indexOf("SUMMARY:") === 0 ||
    line.indexOf("LOCATION:") === 0 ||
    line.indexOf("DESCRIPTION:") === 0 ||
    line.indexOf("X-WR-CALNAME:") === 0
  ) {
    var idx = line.indexOf(":");
    return line.slice(0, idx + 1) + icsAscii(line.slice(idx + 1));
  }
  return line;
}

function expandWeeklyEvent(eventLines) {
  var props = {};
  eventLines.forEach(function (line) {
    var idx = line.indexOf(":");
    if (idx <= 0) return;
    var key = line.slice(0, idx).split(";")[0];
    props[key] = line;
  });

  var hasWeekly = eventLines.some(function (line) {
    return line.indexOf("RRULE:") === 0 && /FREQ=WEEKLY/i.test(line);
  });
  if (!hasWeekly) {
    return [eventLines.map(function (line) {
      var cleaned = sanitizeLine(line);
      return cleaned;
    }).filter(Boolean)];
  }

  var dtStartLine = props.DTSTART || "";
  var dtEndLine = props.DTEND || "";
  var dtStartVal = dtStartLine.split(":").slice(1).join(":");
  var dtEndVal = dtEndLine.split(":").slice(1).join(":");
  var startParsed = parseIcsDateValue(dtStartVal);
  if (!startParsed) return [eventLines.map(sanitizeLine).filter(Boolean)];

  var firstYmd = nextFutureYmd(startParsed.ymd);
  var dayShift = Math.round((ymdToDate(firstYmd) - ymdToDate(startParsed.ymd)) / 86400000);
  var uidLine = props.UID || "UID:generated@gogogo";
  var uidVal = uidLine.split(":").slice(1).join(":").replace(/@.*$/, "");

  var expanded = [];
  for (var w = 0; w < EXPAND_WEEKS; w++) {
    var weekShift = dayShift + w * 7;
    var copy = [];
    eventLines.forEach(function (line) {
      if (line.indexOf("RRULE:") === 0) return;
      if (line.indexOf("UID:") === 0) {
        copy.push("UID:" + uidVal + "-w" + w + "@gogogo");
        return;
      }
      if (line.indexOf("DTSTART:") === 0 || line.indexOf("DTSTART;") === 0) {
        var key = line.slice(0, line.indexOf(":") + 1);
        copy.push(key + shiftIcsDateByDays(dtStartVal, weekShift));
        return;
      }
      if (line.indexOf("DTEND:") === 0 || line.indexOf("DTEND;") === 0) {
        var endKey = line.slice(0, line.indexOf(":") + 1);
        copy.push(endKey + shiftIcsDateByDays(dtEndVal, weekShift));
        return;
      }
      var cleaned = sanitizeLine(line);
      if (cleaned) copy.push(cleaned);
    });
    expanded.push(copy);
  }
  return expanded;
}

function normalizeIcsForGoogle(body) {
  var unfolded = unfoldIcs(body);
  var header = [];
  var events = [];
  var current = null;
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
    if (line === "BEGIN:VEVENT") {
      current = [];
      return;
    }
    if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      return;
    }
    if (current) {
      current.push(line);
      return;
    }
    var cleaned = sanitizeLine(line);
    if (cleaned) header.push(cleaned);
  });

  var out = [];
  header.forEach(function (line) {
    if (line === "END:VCALENDAR") return;
    if (line.indexOf("X-WR-CALNAME:") === 0) {
      out.push("CALNAME:" + line.slice("X-WR-CALNAME:".length));
      out.push(line);
      return;
    }
    out.push(line);
  });
  if (!out.some(function (line) { return line.indexOf("CALNAME:") === 0; })) {
    out.splice(4, 0, "CALNAME:gogogo Wochenplan");
  }

  events.forEach(function (eventLines) {
    expandWeeklyEvent(eventLines).forEach(function (expandedEvent) {
      out.push("BEGIN:VEVENT");
      expandedEvent.forEach(function (line) {
        if (line) out.push(line);
      });
      out.push("END:VEVENT");
    });
  });

  out.push("END:VCALENDAR");
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
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(200).send(body);
  } catch (err) {
    res.status(502).send("Calendar feed unavailable");
  }
};
