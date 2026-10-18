import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  try {
    const { room } = await req.json();
    const roomName = room?.toString().trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') || "penmeet";
    const apiKey = process.env.DAILY_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "KEY KOSONG" }, { status: 500 });
    const headers: any = { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` };
    const getRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, { headers });
    if (getRes.ok) return NextResponse.json({ ok: true });
    const createRes = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST", headers,
      body: JSON.stringify({ name: roomName, privacy: "public", properties: { enable_knocking: false, enable_prejoin_ui: false, enable_screenshare: true, exp: Math.round(Date.now()/1000)+86400 } })
    });
    const data = await createRes.json();
    return NextResponse.json({ ok: createRes.ok, data });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}