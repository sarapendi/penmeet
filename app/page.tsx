"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [code, setCode] = useState("");
  const router = useRouter();

  const createMeeting = () => {
    const newId = Math.random().toString(36).substring(2, 9);
    router.push(`/room/${newId}?role=hr`);
  };

  const joinMeeting = () => {
    if (!code) return;
    router.push(`/room/${code.trim()}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800', margin: 0 }}>PenMeet</h1>
        <span style={{ fontSize: '12px', color: '#666' }}>by Apen • Baleendah</span>
      </header>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ maxWidth: '500px', width: '100%', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', background: '#e8f0fe', color: '#1a73e8', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', marginBottom: '20px' }}>
            🚀 Level 2 - Video On
          </div>
          <h2 style={{ fontSize: '48px', fontWeight: '900', lineHeight: '1', margin: '0 0 20px 0', letterSpacing: '-2px' }}>
            MEET.<br/>TALK.<br/>DONE.
          </h2>
          <p style={{ color: '#5f6368', fontSize: '16px', marginBottom: '30px' }}>
            Bikin meeting link dalam 1 detik. Gak perlu login, gak perlu download.
          </p>
          <button onClick={createMeeting} style={{ width: '100%', background: '#1a73e8', color: 'white', border: 'none', padding: '16px', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px' }}>
            + Buat Meeting Baru
          </button>
          <div style={{ display: 'flex', gap: '10px', border: '1px solid #dadce0', padding: '8px', borderRadius: '8px' }}>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Masukkan kode meeting" style={{ flex: 1, border: 'none', outline: 'none', padding: '8px', fontSize: '15px' }} />
            <button onClick={joinMeeting} style={{ background: 'none', border: 'none', color: '#1a73e8', fontWeight: 'bold', cursor: 'pointer', padding: '0 15px' }}>Join</button>
          </div>
        </div>
      </main>
    </div>
  );
}