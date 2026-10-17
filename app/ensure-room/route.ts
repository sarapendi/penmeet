import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { roomName } = await req.json()
    
    if (!roomName) {
      return NextResponse.json({ error: 'roomName required' }, { status: 400 })
    }

    const apiKey = process.env.DAILY_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'DAILY_API_KEY not set' }, { status: 500 })
    }

    // Cek dulu room udah ada apa belum
    const checkRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    })

    if (checkRes.ok) {
      return NextResponse.json({ message: 'Room exists', created: false })
    }

    // Kalau belum ada, bikin baru
    const createRes = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        name: roomName,
        properties: {
          enable_chat: true,
          enable_screenshare: true,
          enable_recording: 'cloud',
          max_participants: 10,
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 3 // 3 jam
        }
      })
    })

    const data = await createRes.json()

    if (!createRes.ok) {
      return NextResponse.json({ error: data }, { status: createRes.status })
    }

    return NextResponse.json({ message: 'Room created', created: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}