import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { room } = await req.json();
    const roomName = String(room || '').trim().toLowerCase().replace(/\s+/g, '-');
    if (!roomName) return NextResponse.json({ error: 'room kosong' }, { status: 400 });

    const DAILY_API_KEY = process.env.DAILY_API_KEY || process.env.NEXT_PUBLIC_DAILY_API_KEY;
    if (!DAILY_API_KEY) return NextResponse.json({ error: 'DAILY_API_KEY belum di set di Vercel' }, { status: 500 });

    // Cek dulu room udah ada apa belum
    const check = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    });
    if (check.ok) {
      return NextResponse.json({ ok: true, message: 'Room exists', name: roomName });
    }

    // Bikin room baru yang ANTI-KUNCI - BIAR LANGSUNG NYAMBUNG
    const create = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        name: roomName,
        privacy: 'public',
        properties: {
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 jam
          enable_screenshare: true,
          enable_chat: true,
          start_video_off: false,
          start_audio_off: false,
          enable_knocking: false,
          enable_prejoin_ui: false,
          enable_network_ui: false,
          enable_people_ui: false,
          max_participants: 10,
        },
      }),
    });

    const data = await create.json();
    if (!create.ok) {
      console.log('DAILY CREATE ERROR', data);
      // Kalau room exists, anggap sukses aja
      if (data?.info?.includes('already') || data?.error?.includes('exists')) {
        return NextResponse.json({ ok: true, message: 'Room exists', name: roomName });
      }
      return NextResponse.json(data, { status: create.status });
    }

    return NextResponse.json({ ok: true, name: data.name });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}