const SUPABASE_URL = "https://agpysewcsakdpmpftndp.supabase.co";
const CALENDAR_BUCKET = "go-calendars";

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
    var body = await up.text();
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
