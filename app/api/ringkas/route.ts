import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { transcript, posisi } = await req.json();

    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
      return NextResponse.json({ summary: "GROQ_API_KEY belum di setting di Vercel" }, { status: 500 });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `Kamu adalah HRD profesional PenMeet. Tugasmu bikin ringkasan meeting singkat, jelas, dan to-the-point dalam Bahasa Indonesia. Fokus ke posisi: ${posisi}. Format: 1. Poin Penting, 2. Keputusan, 3. Action Items`
          },
          {
            role: 'user',
            content: `Transkrip interview:\n${transcript}`
          }
        ],
        temperature: 0.3,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq Error:", data);
      return NextResponse.json({ summary: `Error Groq: ${JSON.stringify(data)}` }, { status: 500 });
    }

    const summary = data.choices?.[0]?.message?.content || "Gagal bikin ringkasan";

    return NextResponse.json({ summary });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ summary: `Error server: ${error.message}` }, { status: 500 });
  }
}