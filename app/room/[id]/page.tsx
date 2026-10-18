"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

declare global {
  interface Window { SpeechRecognition: any; webkitSpeechRecognition: any; }
}

export default function Room() {
  const params = useParams();
  const roomName = (params.roomName as string) || (params.id as string) || "penmeet";
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHR = searchParams.get("role") === "hr";

  const myVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [myName, setMyName] = useState("");
  const [myPosition, setMyPosition] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [candidatePosisi, setCandidatePosisi] = useState("");
  const [remoteName, setRemoteName] = useState("Menunggu...");
  const [showNameInput, setShowNameInput] = useState(true);
  const [inputName, setInputName] = useState("");
  const [inputPosisi, setInputPosisi] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [status, setStatus] = useState("Siap...");

  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [showDecision, setShowDecision] = useState(false);
  const [keputusan, setKeputusan] = useState("DIPERTIMBANGKAN");
  const recognitionRef = useRef<any>(null);
  const [isSharing, setIsSharing] = useState(false);
  const callRef = useRef<any>(null);

  const toggleShareScreen = async () => {
    if (!callRef.current) return;
    try {
      if (!isSharing) { await callRef.current.startScreenShare(); setIsSharing(true); }
      else { await callRef.current.stopScreenShare(); setIsSharing(false); }
    } catch (e) { console.log(e); }
  };

  useEffect(() => {
    const savedName = localStorage.getItem("penmeet-name");
    const savedPosisi = localStorage.getItem("penmeet-posisi");
    if (savedName) setInputName(savedName);
    if (savedPosisi && !isHR) setInputPosisi(savedPosisi);
  }, [isHR]);

  const handleJoin = () => {
    if (!inputName.trim()) return alert("Isi nama dulu bro!");
    if (!isHR && !inputPosisi.trim()) return alert("Isi posisi dulu!");
    setMyName(inputName.trim());
    if (isHR) {
      setMyPosition("HR / Interviewer");
      localStorage.setItem("penmeet-name", inputName.trim());
      setShowNameInput(false);
    } else {
      setMyPosition(inputPosisi.trim());
      setCandidateName(inputName.trim());
      setCandidatePosisi(inputPosisi.trim());
      setRemoteName(`${inputName.trim()} - ${inputPosisi.trim()}`);
      localStorage.setItem("penmeet-name", inputName.trim());
      localStorage.setItem("penmeet-posisi", inputPosisi.trim());
      setShowNameInput(false);
    }
  };

  useEffect(() => {
    if (showNameInput) return;
    let mounted = true;
    async function init() {
      try {
        // === TAMBAHAN: NYALAKAN KAMERA LOKAL DULU BIAR KELIATAN HIDUP ===
        try {
          const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          if (myVideoRef.current) {
            myVideoRef.current.srcObject = localStream;
            await myVideoRef.current.play().catch(()=>{});
            setStatus("Kamera lokal nyala, join Daily...");
          }
        } catch {}

        const Daily = (await import("@daily-co/daily-js")).default;
        // === TAMBAHAN: KASIH AUDIO VIDEO SOURCE BIAR NYALA ===
        const callObject = Daily.createCallObject({ audioSource: true, videoSource: true } as any);
        callRef.current = callObject;

        callObject.on("track-started", (e: any) => {
          if (!e.track) return;
          const track = e.track.persistentTrack || e.track;
          if (!track) return;
          
          if (e.participant?.local) {
            // === FIX: VIDEO SAYA - PAKAI MediaStream BARU ===
            if (track.kind === 'video' && myVideoRef.current) {
              myVideoRef.current.srcObject = new MediaStream([track]);
              myVideoRef.current.play().catch(()=>{});
            }
            return;
          }
          
          // VIDEO LAWAN - FIX
          if (track.kind === 'video' && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = new MediaStream([track]);
            remoteVideoRef.current.play().then(()=>{
              setRemoteName(e.participant.user_name || "Tersambung");
              setStatus(`✅ Tersambung: ${e.participant.user_name}`);
            }).catch(()=>{});
          }
          if (track.kind === 'audio' && remoteVideoRef.current) {
            // tambah audio ke remote
            const ms = remoteVideoRef.current.srcObject as MediaStream;
            if (ms && ms.getAudioTracks().length === 0) {
              ms.addTrack(track);
            }
          }
        });

        callObject.on("participant-joined", (e: any) => setStatus(`🔔 ${e.participant.user_name} masuk`));
        callObject.on("participant-left", () => { setStatus("Peserta keluar"); setRemoteName("Menunggu..."); });
        callObject.on("error", (e: any) => setStatus("Error: " + JSON.stringify(e).slice(0,150)));

        const domain = (process.env.NEXT_PUBLIC_DAILY_DOMAIN as string) || "penmeet.daily.co";
        const cleanDomain = domain.replace('https://','').replace(/\/$/,'');
        const roomNameFix = String(roomName).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        setStatus("Membuat room...");
        try {
          await fetch('/api/create-daily-room', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room: roomNameFix }) 
          });
        } catch {}
        await new Promise(r => setTimeout(r, 800));

        setStatus("Join room...");
        await callObject.join({ 
          url: `https://${cleanDomain}/${roomNameFix}`,
          userName: isHR ? `HR-${myName || inputName}` : `${candidateName || myName || inputName} - ${myPosition || inputPosisi}`
        });
        setStatus("Menunggu lawan join...");

      } catch(e: any) { 
        console.log(e); 
        setStatus("Error: " + (e?.message || JSON.stringify(e).slice(0,200))); 
      }
    }
    init();
    return () => { 
      mounted = false;
      try { callRef.current?.leave(); callRef.current?.destroy(); } catch {}
    }
  }, [showNameInput]);

  const toggleTranskrip = () => {
    if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Pakai Chrome!");
    const recognition = new SpeechRecognition();
    recognition.continuous = true; recognition.interimResults = true; recognition.lang = 'id-ID';
    recognition.onresult = (event: any) => {
      let text = ""; for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript + " ";
      setTranscript(text);
    };
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition; recognition.start(); setIsRecording(true);
  };
  const ringkasDenganAI = async () => {
    if (!transcript) return alert("Belum ada transkrip!");
    setLoadingAI(true);
    try {
      const res = await fetch('/api/ringkas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript, posisi: candidatePosisi || myPosition }) });
      const data = await res.json(); setAiSummary(data.summary);
    } catch { alert("Gagal ringkas"); }
    setLoadingAI(false);
  };
  const handleEndAndSave = async () => { setShowDecision(true); };
  const handleHRKeluar = () => { if (confirm('Yakin keluar?')) router.push('/'); };
  const confirmSave = async () => {
    const payload = { room: roomName, namaLengkap: candidateName || "Kandidat Room " + roomName, posisiDilamar: candidatePosisi || "-", pewawancara: myName, transkrip: transcript, ringkasanAI: aiSummary, keputusan: keputusan, tanggal: new Date().toISOString() };
    try { await fetch('/api/simpan-hr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch {}
    alert(`Tersimpan! ${payload.namaLengkap} = ${keputusan}`);
    router.push(isHR ? '/' : '/finished');
  };
  const handleCandidateLeave = () => { router.push('/finished'); };
  const candidateLink = typeof window !== 'undefined' ? `${window.location.origin}/room/${roomName}` : '';

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black', position: 'relative', overflow: 'hidden' }}>
      {showNameInput && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', padding: '28px', borderRadius: '20px', width: '100%', maxWidth: '380px' }}>
            {isHR? (
              <>
                <h2 style={{ fontSize: '22px', fontWeight: '800' }}>Dashboard HR</h2>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '18px' }}>Room: {roomName}</p>
                <label style={{ fontSize: '12px', fontWeight: '700', display: 'block', marginBottom: '6px' }}>Nama HR</label>
                <input value={inputName} onChange={e => setInputName(e.target.value)} placeholder="Pak Apen" style={{ width: '100%', padding: '14px', border: '2px solid #e5e7eb', borderRadius: '12px', marginBottom: '18px' }} />
                <button onClick={handleJoin} style={{ width: '100%', padding: '14px', background: '#111827', color: 'white', borderRadius: '12px', fontWeight: '700' }}>Masuk Dashboard HR</button>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '22px', fontWeight: '800' }}>Masuk Interview</h2>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '18px' }}>Room: {roomName}</p>
                <label style={{ fontSize: '12px', fontWeight: '700', display: 'block', marginBottom: '6px' }}>Nama Lengkap</label>
                <input value={inputName} onChange={e => setInputName(e.target.value)} placeholder="Apen Saputra" style={{ width: '100%', padding: '14px', border: '2px solid #e5e7eb', borderRadius: '12px', marginBottom: '14px' }} />
                <label style={{ fontSize: '12px', fontWeight: '700', display: 'block', marginBottom: '6px' }}>Posisi</label>
                <input value={inputPosisi} onChange={e => setInputPosisi(e.target.value)} placeholder="Sales" style={{ width: '100%', padding: '14px', border: '2px solid #e5e7eb', borderRadius: '12px', marginBottom: '18px' }} />
                <button onClick={handleJoin} style={{ width: '100%', padding: '14px', background: '#2563eb', color: 'white', borderRadius: '12px', fontWeight: '700' }}>Gabung Interview</button>
              </>
            )}
          </div>
        </div>
      )}
      <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#0a0a0a' }} />
      {/* WAJAH BAPAK - SUDAH DI KIRI + ZINDEX TINGGI BIAR GA KETUTUP */}
      <video ref={myVideoRef} autoPlay playsInline muted style={{ position: 'absolute', bottom: '100px', left: '20px', width: '180px', height: '135px', borderRadius: '16px', objectFit: 'cover', transform: 'scaleX(-1)', border: '3px solid white', background: '#222', zIndex: 40, boxShadow: '0 10px 20px rgba(0,0,0,0.5)' }} />
      <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', zIndex: 20 }}>{status} - {remoteName}</div>
      {isHR && (
        <div style={{ position: 'absolute', top: '50px', right: '16px', width: '340px', background: 'white', borderRadius: '16px', padding: '14px', maxHeight: '80vh', overflow: 'auto', zIndex: 25 }}>
          <h3 style={{ fontSize: '14px', fontWeight: '800' }}>Dashboard HR</h3>
          <p style={{ fontSize: '11px', color: '#666', marginBottom: '12px' }}>Room: {roomName}</p>
          <div style={{ background: '#f3f4f6', padding: '10px', borderRadius: '10px', marginBottom: '12px' }}>
            <p style={{ fontSize: '10px', fontWeight: '800', marginBottom: '6px' }}>LINK KANDIDAT:</p>
            <p style={{ fontSize: '10px', wordBreak: 'break-all', background: 'white', padding: '6px', borderRadius: '6px' }}>{candidateLink}</p>
            <button onClick={() => { navigator.clipboard.writeText(candidateLink); alert("Link tercopy!"); }} style={{ marginTop: '8px', width: '100%', padding: '8px', background: '#111827', color: 'white', borderRadius: '8px', fontSize: '11px', fontWeight: '700' }}>📋 Copy Link</button>
          </div>
          <button onClick={toggleTranskrip} style={{ width: '100%', padding: '10px', borderRadius: '10px', background: isRecording? '#ef4444' : '#2563eb', color: 'white', fontWeight: '700', fontSize: '12px', marginBottom: '10px' }}>{isRecording? '🔴 Stop Catat' : '🎙️ Mulai Catat'}</button>
          <textarea value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Transkrip..." style={{ width: '100%', height: '90px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', fontSize: '11px', marginBottom: '10px' }} />
          <button onClick={ringkasDenganAI} disabled={loadingAI} style={{ width: '100%', padding: '10px', borderRadius: '10px', background: '#16a34a', color: 'white', fontWeight: '700', fontSize: '12px', marginBottom: '10px' }}>{loadingAI? 'Merangkum...' : '✨ Ringkas AI'}</button>
          {aiSummary && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px', borderRadius: '8px', fontSize: '11px', whiteSpace: 'pre-wrap' }}>{aiSummary}</div>}
        </div>
      )}
      {/* TOMBOL BAWAH - SUDAH SAYA BALIKIN END & SIMPAN */}
      <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', background: '#1f2937', padding: '8px 16px', borderRadius: '999px', display: 'flex', gap: '10px', alignItems: 'center', zIndex: 30 }}>
        <button onClick={() => { try{ callRef.current?.setLocalAudio(!micOn); }catch{}; setMicOn(v=>!v); }} style={{ width: '48px', height: '48px', borderRadius: '50%', background: micOn? '#374151' : '#ef4444', color: 'white' }}>{micOn? '🎤' : '🔇'}</button>
        <button onClick={() => { try{ callRef.current?.setLocalVideo(!camOn); }catch{}; setCamOn(v=>!v); }} style={{ width: '48px', height: '48px', borderRadius: '50%', background: camOn? '#374151' : '#ef4444', color: 'white' }}>{camOn? '📹' : '📷'}</button>
        <button onClick={toggleShareScreen} style={{ width: '48px', height: '48px', borderRadius: '50%', background: isSharing ? '#2563eb' : '#374151', color: 'white' }}>{isSharing ? '🛑' : '🖥️'}</button>
        {isHR? (
          <>
            <button onClick={handleHRKeluar} style={{ padding: '0 18px', height: '48px', borderRadius: '24px', background: '#e5e7eb', color: '#111', fontWeight: '700', fontSize: '13px' }}>Keluar</button>
            <button onClick={handleEndAndSave} style={{ padding: '0 22px', height: '48px', borderRadius: '24px', background: '#ef4444', color: 'white', fontWeight: '700', fontSize: '13px' }}>END & SIMPAN</button>
          </>
        ) : (
          <button onClick={handleCandidateLeave} style={{ padding: '0 22px', height: '48px', borderRadius: '24px', background: '#111827', color: 'white', fontWeight: '700' }}>Selesai</button>
        )}
      </div>
      {showDecision && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '16px', width: '320px' }}>
            <h3 style={{ fontWeight: '800', marginBottom: '12px' }}>Keputusan?</h3>
            <select value={keputusan} onChange={e => setKeputusan(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', marginBottom: '12px' }}>
              <option>DITERIMA</option><option>DIPERTIMBANGKAN</option><option>DITOLAK</option>
            </select>
            <button onClick={confirmSave} style={{ width: '100%', padding: '12px', background: '#16a34a', color: 'white', borderRadius: '8px', fontWeight: '700' }}>Simpan</button>
          </div>
        </div>
      )}
    </div>
  );
}