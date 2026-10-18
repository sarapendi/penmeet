"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

declare global {
  interface Window { SpeechRecognition: any; webkitSpeechRecognition: any; }
}

type WaitingCandidate = { id: string, name: string, posisi: string };

export default function Room() {
  const { id } = useParams();
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

  const [waitingList, setWaitingList] = useState<WaitingCandidate[]>([]);
  const [showNotif, setShowNotif] = useState(false);

  const [isSharing, setIsSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const callRef = useRef<any>(null);

  const toggleShareScreen = async () => {
    if (callRef.current) {
      try {
        if (!isSharing) { await callRef.current.startScreenShare(); setIsSharing(true); return; }
        else { await callRef.current.stopScreenShare(); setIsSharing(false); return; }
      } catch (e) { console.log("Daily share gagal", e); }
    }
  };
  const stopSharing = () => {
    try { callRef.current?.stopScreenShare(); } catch {}
    setIsSharing(false);
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
    let stream: MediaStream;
    async function init() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        cameraStreamRef.current = stream;
        if (myVideoRef.current) {
          myVideoRef.current.srcObject = stream;
          myVideoRef.current.play().catch(()=>{});
        }

        const Daily = (await import("@daily-co/daily-js")).default;
        const callObject = Daily.createCallObject();
        callRef.current = callObject;

        // FIX UTAMA BIAR GAK HITAM
        const attachParticipant = (p: any) => {
          if (!p || p.local) return;
          const vTrack = p.tracks?.video?.persistentTrack || p.tracks?.video?.track;
          const aTrack = p.tracks?.audio?.persistentTrack || p.tracks?.audio?.track;
          if ((vTrack || aTrack) && remoteVideoRef.current) {
            let ms = remoteVideoRef.current.srcObject as MediaStream;
            if (!ms) ms = new MediaStream();
            if (vTrack) {
              ms.getVideoTracks().forEach(t => ms.removeTrack(t));
              ms.addTrack(vTrack);
            }
            if (aTrack) {
              ms.getAudioTracks().forEach(t => ms.removeTrack(t));
              ms.addTrack(aTrack);
            }
            remoteVideoRef.current.srcObject = ms;
            remoteVideoRef.current.play().then(()=> {
              setRemoteName(p.user_name || "Tersambung");
              setStatus(`✅ Tersambung: ${p.user_name}`);
            }).catch(()=>{});
          }
        };

        callObject.on("track-started", (e: any) => attachParticipant(e.participant));
        callObject.on("participant-joined", (e: any) => {
          setStatus(`🔔 ${e.participant.user_name} masuk...`);
          setShowNotif(true);
          setTimeout(()=> attachParticipant(e.participant), 300);
          setTimeout(()=> attachParticipant(e.participant), 1000);
          setTimeout(()=> attachParticipant(e.participant), 2000);
          setTimeout(()=> setShowNotif(false), 4000);
        });
        callObject.on("participant-updated", (e: any) => attachParticipant(e.participant));

        const DAILY_DOMAIN = "https://penmeet.daily.co"; 
        const roomNameFix = String(id).trim().toLowerCase().replace(/\s+/g, '-');
        
        // === AUTO CREATE DAILY YANG BARU, LEBIH KUAT ===
        setStatus("Membuat room di Daily...");
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const res = await fetch('/api/create-daily-room', { 
              method: 'POST', 
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ room: roomNameFix }) 
            });
            const json = await res.json();
            console.log("AUTO CREATE RESULT:", json);
            if (res.ok) break;
          } catch (err) { console.log("auto create retry", attempt, err); }
          await new Promise(r => setTimeout(r, 1000));
        }
        await new Promise(r => setTimeout(r, 1500));
        // === END AUTO CREATE ===

        setStatus("Join room...");
        await callObject.join({ 
          url: `${DAILY_DOMAIN}/${roomNameFix}`,
          userName: isHR ? `HR-${myName || inputName}` : `${candidateName || myName || inputName} - ${myPosition || inputPosisi}`
        });
        setStatus("Menunggu lawan join...");

        setTimeout(() => {
          const parts = callObject.participants();
          Object.values(parts).forEach((p: any) => { if (!p.local) attachParticipant(p); });
        }, 1000);

      } catch(e) { console.log(e); alert("Izinkan kamera dulu Pak!"); }
    }
    init();
    return () => { 
      stream?.getTracks().forEach(t => t.stop());
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
    const payload = { room: id, namaLengkap: candidateName || "Kandidat Room " + id, posisiDilamar: candidatePosisi || "-", pewawancara: myName, transkrip: transcript, ringkasanAI: aiSummary, keputusan: keputusan, tanggal: new Date().toISOString() };
    try { await fetch('/api/simpan-hr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch {}
    alert(`Tersimpan! ${payload.namaLengkap} = ${keputusan}`);
    router.push(isHR ? '/' : '/finished');
  };
  const handleCandidateLeave = () => { router.push('/finished'); };
  const candidateLink = typeof window !== 'undefined' ? `${window.location.origin}/room/${id}` : '';

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black', position: 'relative', overflow: 'hidden' }}>
      {showNameInput && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', padding: '28px', borderRadius: '20px', width: '100%', maxWidth: '380px' }}>
            {isHR? (
              <>
                <h2 style={{ fontSize: '22px', fontWeight: '800' }}>Dashboard HR</h2>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '18px' }}>Room: {id}</p>
                <label style={{ fontSize: '12px', fontWeight: '700', display: 'block', marginBottom: '6px' }}>Nama HR</label>
                <input value={inputName} onChange={e => setInputName(e.target.value)} placeholder="Pak Apen" style={{ width: '100%', padding: '14px', border: '2px solid #e5e7eb', borderRadius: '12px', marginBottom: '18px' }} />
                <button onClick={handleJoin} style={{ width: '100%', padding: '14px', background: '#111827', color: 'white', borderRadius: '12px', fontWeight: '700' }}>Masuk Dashboard HR</button>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '22px', fontWeight: '800' }}>Masuk Interview</h2>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '18px' }}>Room: {id}</p>
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
      <video ref={myVideoRef} autoPlay playsInline muted style={{ position: 'absolute', bottom: '90px', right: '20px', width: '140px', height: '105px', borderRadius: '12px', objectFit: 'cover', transform: 'scaleX(-1)', border: '2px solid white', background: '#222', zIndex: 10 }} />

      <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', zIndex: 20 }}>{status} - {remoteName} {isSharing && "• Sharing"}</div>
      
      {isHR && (
        <div style={{ position: 'absolute', top: '50px', right: '16px', width: '340px', background: 'white', borderRadius: '16px', padding: '14px', maxHeight: '85vh', overflow: 'auto', zIndex: 20 }}>
          <h3 style={{ fontSize: '14px', fontWeight: '800' }}>Dashboard HR {showNotif && "• 🟢 JOIN!"}</h3>
          <p style={{ fontSize: '11px', color: '#666', marginBottom: '12px' }}>Room: {id}</p>
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

      <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', background: '#1f2937', padding: '8px 16px', borderRadius: '999px', display: 'flex', gap: '10px', alignItems: 'center', zIndex: 30 }}>
        <button onClick={() => { const s = myVideoRef.current?.srcObject as MediaStream; s?.getAudioTracks().forEach(t => t.enabled =!t.enabled); setMicOn(v=>!v); }} style={{ width: '48px', height: '48px', borderRadius: '50%', background: micOn? '#374151' : '#ef4444', color: 'white' }}>{micOn? '🎤' : '🔇'}</button>
        <button onClick={() => { const s = myVideoRef.current?.srcObject as MediaStream; s?.getVideoTracks().forEach(t => t.enabled =!t.enabled); setCamOn(v=>!v); }} style={{ width: '48px', height: '48px', borderRadius: '50%', background: camOn? '#374151' : '#ef4444', color: 'white' }}>{camOn? '📹' : '📷'}</button>
        <button onClick={toggleShareScreen} style={{ width: '48px', height: '48px', borderRadius: '50%', background: isSharing ? '#2563eb' : '#374151', color: 'white' }}>{isSharing ? '🛑' : '🖥️'}</button>
        {isHR? (
          <>
            <button onClick={handleHRKeluar} style={{ padding: '0 18px', height: '48px', borderRadius: '24px', background: '#e5e7eb', fontWeight: '700', fontSize: '13px' }}>Keluar</button>
            <button onClick={handleEndAndSave} style={{ padding: '0 22px', height: '48px', borderRadius: '24px', background: '#ef4444', color: 'white', fontWeight: '700' }}>END & SIMPAN</button>
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