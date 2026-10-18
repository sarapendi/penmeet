import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // AUTO FIX: bikin lowercase dan hapus spasi biar Daily gak error
    const rawName = body.room || body.roomName
    const roomName = String(rawName || "").trim().toLowerCase().replace(/\s+/g, '-')
    
    if (!roomName) {
      return NextResponse.json({ error: 'roomName required' }, { status: 400 })
    }

    const apiKey = process.env.DAILY_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'DAILY_API_KEY not set di Vercel' }, { status: 500 })
    }

    // 1. Cek dulu udah ada belum di Daily
    const checkRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store'
    })

    if (checkRes.ok) {
      const existData = await checkRes.json()
      return NextResponse.json({ message: 'Room exists', existed: true, name: roomName, url: existData.url })
    }

    // 2. Kalau belum ada, BIKIN OTOMATIS - INI INTINYA AUTO CREATE
    const createRes = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        name: roomName,
        privacy: "public", // WAJIB public biar bisa join tanpa token
        properties: {
          enable_chat: true,
          enable_screenshare: true,
          enable_recording: 'cloud',
          enable_knocking: false,
          start_video_off: false,
          start_audio_off: false,
          max_participants: 10,
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 // expired 24 jam
        }
      })
    })

    const data = await createRes.json()
    if (!createRes.ok) {
      console.error("DAILY CREATE FAILED:", data)
      return NextResponse.json({ error: data, name: roomName }, { status: 400 })
    }

    console.log("DAILY CREATE SUCCESS:", roomName)
    return NextResponse.json({ message: 'Room created', created: true, name: roomName, data })
  } catch (e: any) {
    console.error("API ERROR:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}