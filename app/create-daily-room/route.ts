import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const roomName = body.room || body.roomName
    
    if (!roomName) {
      return NextResponse.json({ error: 'roomName required' }, { status: 400 })
    }

    const apiKey = process.env.DAILY_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'DAILY_API_KEY not set' }, { status: 500 })
    }

    const checkRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    })

    if (checkRes.ok) {
      return NextResponse.json({ message: 'Room exists' })
    }

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
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24
        }
      })
    })

    const data = await createRes.json()
    if (!createRes.ok) {
      return NextResponse.json({ error: data }, { status: 400 })
    }

    return NextResponse.json({ message: 'Room created', data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}