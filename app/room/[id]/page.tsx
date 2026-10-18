"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

export default function Room() {
  const params = useParams();
  const roomName = (params.roomName as string) || (params.id as string) || "penmeet";
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHR = searchParams.get("role") === "hr";

  const myVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callRef = useRef<any>(null);

  const [inputName, setInputName] = useState("");
  const [inputPosisi, setInputPosisi] = useState("");
  const [showNameInput, setShowNameInput] = useState(true);
  const [myName, setMyName] = useState("");
  const [myPosition, setMyPosition] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [candidatePosisi, setCandidatePosisi] = useState("");
  const [remoteName, setRemoteName] = useState("Menunggu...");
  const [status, setStatus] = useState("Siap...");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [showDecision, setShowDecision] = useState(false);
  const [keputusan, setKeputusan] = useState("DIPERTIMBANGKAN");
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const savedName = localStorage.getItem("penmeet-name");
    const savedPosisi = localStorage.getItem("penmeet-posisi");
    if (savedName) setInputName(savedName);
    if (savedPosisi && !isHR) setInputPosisi(savedPosisi);
  }, [isHR]);

  const handleJoin = () => {
    if (!inputName.trim()) return alert("Isi nama dulu!");
    if (!isHR && !inputPosisi.trim()) return alert("Isi posisi!");
    setMyName(inputName.trim());
    if (isHR) {
      setMyPosition("HR / Interviewer");
      localStorage.setItem("penmeet-name", inputName.trim());
    } else {
      setMyPosition(inputPosisi.trim());
      setCandidateName(inputName.trim());
      setCandidatePosisi(inputPosisi.trim());
      setRemoteName(`${inputName.trim()} - ${inputPosisi.trim()}`);
      localStorage.setItem("penmeet-name", inputName.trim());
      localStorage.setItem("penmeet-posisi", inputPosisi.trim());
    }
    setShowNameInput(false);
  };

  useEffect(() => {
    if (showNameInput) return;

    let mounted = true;

    async function init() {
      try {
        // 1. NYALAKAN KAMERA LOKAL DULU BIAR KELIATAN HIDUP (fallback)
        try {
          const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          if (myVideoRef.current) {
            myVideoRef.current.srcObject = localStream;
            await myVideoRef.current.play().catch(()=>{});
            setStatus("Kamera lokal nyala...");
          }
        } catch (e) {
          console.log("getUserMedia gagal", e);
        }

        // 2. JOIN DAILY
        const Daily = (await import("@daily-co/daily-js")).default;
        const callObject = Daily.createCallObject({ audioSource: true, videoSource: true });
        callRef.current = callObject;

        callObject.on("track-started", (e: any) => {
          if (!e?.track) return;
          const track = e.track.persistentTrack || e.track;
          if (!track) return;

          // LOCAL TRACK
          if (e.participant?.local) {
            if (track.kind === "video" && myVideoRef.current) {
              // GANTI stream lokal dengan track dari Daily (yang resmi)
              const stream = new MediaStream([track]);
              myVideoRef.current.srcObject = stream;
              myVideoRef.current.play().catch(()=>{});
            }
            return;
          }

          // REMOTE TRACK
          if (track.kind === "video" && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = new MediaStream([track]);
            remoteVideoRef.current.play().then(() => {
              setRemoteName(e.participant?.user_name || "Tersambung");
              setStatus(`✅ Tersambung: ${e.participant?.user_name}`);
            }).catch(()=>{});
          }
          if (track.kind === "audio" && remoteVideoRef.current) {
            const ms = remoteVideoRef.current.srcObject as MediaStream || new MediaStream();
            const existing = ms as MediaStream;
            if (!remoteVideoRef.current.srcObject) remoteVideoRef.current.srcObject = existing;
            // tambah audio ke stream yang sama
            const hasAudio = existing.getAudioTracks().length > 0;
            if (!hasAudio) existing.addTrack(track);
          }
        });

        callObject.on("participant-joined", (e: any) => setStatus(`🔔 ${e.participant.user_name} masuk`));
        callObject.on("error", (e: any) => setStatus("Error: " + JSON.stringify(e).slice(0,200)));

        const roomNameFix = String(roomName).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const domain = process.env.NEXT_PUBLIC_DAILY_DOMAIN || "penmeet.daily.co";
        const dailyUrl = `https://${domain.replace('https://','').replace(/\/$/,'')}/${roomNameFix}`;

        setStatus("Membuat room...");
        await fetch('/api/create-daily-room', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room: roomNameFix }) 
        }).catch(()=>{});

        await new Promise(r => setTimeout(r, 800));
        setStatus("Join " + dailyUrl + "...");

        await callObject.join({ 
          url: dailyUrl,
          userName: isHR ? `HR-${myName || inputName}` : `${candidateName || inputName} - ${myPosition || inputPosisi}`
        });
        setStatus("Menunggu lawan join...");
      } catch (e: any) {
        console.error(e);
        setStatus("Error: " + (e?.message || JSON.stringify(e).slice(0,300)));
      }
    }
    init();
    return () => {
      mounted = false;
      try { callRef.current?.leave(); callRef.current?.destroy(); } catch {}
    };
  }, [showNameInput, roomName, isHR, myName, inputName, candidateName, myPosition, inputPosisi]);

  const toggleTranskrip = () => {
    if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); return; }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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

  const candidateLink = typeof window !== 'undefined' ? `${window.location.origin}/room/${roomName}` : '';

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black', position: 'relative', overflow: 'hidden' }}>
      {showNameInput && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', padding: '28px', borderRadius: '20px', width: '100%', maxWidth: '380px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '800' }}>{isHR ? 'Dashboard HR' : 'Masuk Interview'}</h2>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '18px' }}>Room: {roomName}</p>
            <input value={inputName} onChange={e => setInputName(e.target.value)} placeholder={isHR ? "Nama HR" : "Nama Lengkap"} style={{ width: '100%', padding: '14px', border: '2px solid #e5e7eb', borderRadius: '12px', marginBottom: '14px' }} />
            {!isHR && <input value={inputPosisi} onChange={e => setInputPosisi(e.target.value)} placeholder="Posisi" style={{ width: '100%', padding: '14px', border: '2px solid #e5e7eb', borderRadius: '12px', marginBottom: '18px' }} />}
            <button onClick={handleJoin} style={{ width: '100%', padding: '14px', background: '#111827', color: 'white', borderRadius: '12px', fontWeight: '700' }}>Masuk</button>
          </div>
        </div>
      )}
      <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#0a0a0a' }} />
      <video ref={myVideoRef} autoPlay playsInline muted style={{ position: 'absolute', bottom: '100px', left: '20px', width: '200px', height: '150px', borderRadius: '16px', objectFit: 'cover', transform: 'scaleX(-1)', border: '3px solid white', background: '#222', zIndex: 40 }} />
      <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', zIndex: 20 }}>{status} - {remoteName}</div>
      {isHR && (
        <div style={{ position: 'absolute', top: '50px', right: '16px', width: '340px', background: 'white', borderRadius: '16px', padding: '14px', maxHeight: '80vh', overflow: 'auto', zIndex: 25 }}>
          <h3 style={{ fontSize: '14px', fontWeight: '800' }}>Dashboard HR</h3>
          <p style={{ fontSize: '10px', wordBreak: 'break-all', background: '#f3f4f6', padding: '6px', borderRadius: '6px', margin: '8px 0' }}>{candidateLink}</p>
          <button onClick={() => { navigator.clipboard.writeText(candidateLink); alert("Link tercopy!"); }} style={{ width: '100%', padding: '8px', background: '#111827', color: 'white', borderRadius: '8px', fontSize: '11px', fontWeight: '700', marginBottom: '10px' }}>📋 Copy Link Kandidat</button>
          <button onClick={toggleTranskrip} style={{ width: '100%', padding: '10px', borderRadius: '10px', background: isRecording? '#ef4444' : '#2563eb', color: 'white', fontWeight: '700', fontSize: '12px', marginBottom: '10px' }}>{isRecording? '🔴 Stop' : '🎙️ Mulai Catat'}</button>
          <textarea value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Transkrip..." style={{ width: '100%', height: '80px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', fontSize: '11px', marginBottom: '10px' }} />
          <button onClick={ringkasDenganAI} disabled={loadingAI} style={{ width: '100%', padding: '10px', borderRadius: '10px', background: '#16a34a', color: 'white', fontWeight: '700', fontSize: '12px' }}>{loadingAI? 'Merangkum...' : '✨ Ringkas AI'}</button>
          {aiSummary && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px', borderRadius: '8px', fontSize: '11px', whiteSpace: 'pre-wrap', marginTop: '10px' }}>{aiSummary}</div>}
        </div>
      )}
      <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', background: '#1f2937', padding: '8px 16px', borderRadius: '999px', display: 'flex', gap: '10px', zIndex: 30 }}>
        <button onClick={() => { try{ callRef.current?.setLocalAudio(!micOn); }catch{}; setMicOn(v=>!v); }} style={{ width: '48px', height: '48px', borderRadius: '50%', background: micOn? '#374151' : '#ef4444', color: 'white' }}>{micOn? '🎤' : '🔇'}</button>
        <button onClick={() => { try{ callRef.current?.setLocalVideo(!camOn); }catch{}; setCamOn(v=>!v); }} style={{ width: '48px', height: '48px', borderRadius: '50%', background: camOn? '#374151' : '#ef4444', color: 'white' }}>{camOn? '📹' : '📷'}</button>
        <button onClick={async()=>{ if(!callRef.current) return; try{ if(!isSharing){ await callRef.current.startScreenShare(); setIsSharing(true);} else{ await callRef.current.stopScreenShare(); setIsSharing(false);} }catch{}}} style={{ width: '48px', height: '48px', borderRadius: '50%', background: isSharing ? '#2563eb' : '#374151', color: 'white' }}>{isSharing ? '🛑' : '🖥️'}</button>
        {isHR ? <button onClick={()=>router.push('/')} style={{ padding: '0 18px', height: '48px', borderRadius: '24px', background: '#ef4444', color: 'white', fontWeight: '700' }}>Keluar</button> : <button onClick={()=>router.push('/finished')} style={{ padding: '0 22px', height: '48px', borderRadius: '24px', background: '#111827', color: 'white', fontWeight: '700' }}>Selesai</button>}
      </div>
    </div>
  );
}