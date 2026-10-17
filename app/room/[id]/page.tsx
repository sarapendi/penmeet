"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
// FIX BUILD: hapus import statis Daily biar Vercel gak error

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

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
  const [remoteName, setRemoteName] = useState("Kandidat");
  const [showNameInput, setShowNameInput] = useState(true);
  const [inputName, setInputName] = useState("");
  const [inputPosisi, setInputPosisi] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [showDecision, setShowDecision] = useState(false);
  const [keputusan, setKeputusan] = useState("DIPERTIMBANGKAN");
  const recognitionRef = useRef<any>(null);

  // === SHARESCREEN P2P - START (CUMA INI YANG SAYA TAMBAH/UBAH) ===
  const [isSharing, setIsSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const callRef = useRef<any>(null);

  const toggleShareScreen = async () => {
    if (callRef.current) {
      try {
        if (!isSharing) {
          await callRef.current.startScreenShare();
          setIsSharing(true);
          return;
        } else {
          await callRef.current.stopScreenShare();
          setIsSharing(false);
          return;
        }
      } catch (e) {
        console.log("Daily share gagal, fallback lokal", e);
      }
    }
    try {
      if (!isSharing) {
        const currentStream = myVideoRef.current?.srcObject as MediaStream;
        if (currentStream) cameraStreamRef.current = currentStream;
        const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = screenStream;
        const micTrack = cameraStreamRef.current?.getAudioTracks()[0];
        if (micTrack) screenStream.addTrack(micTrack);
        if (myVideoRef.current) myVideoRef.current.srcObject = screenStream;
        screenStream.getVideoTracks()[0].onended = () => stopSharing();
        setIsSharing(true);
      } else {
        stopSharing();
      }
    } catch (e) {
      console.log("Gagal share:", e);
      alert("Gagal share screen bro, coba lagi!");
    }
  };

  const stopSharing = () => {
    try { callRef.current?.stopScreenShare(); } catch {}
    screenStreamRef.current?.getTracks().forEach((t: any) => t.stop());
    screenStreamRef.current = null;
    if (cameraStreamRef.current && myVideoRef.current) {
      myVideoRef.current.srcObject = cameraStreamRef.current;
    } else if (myVideoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true }).then(s => {
        if (myVideoRef.current) myVideoRef.current.srcObject = s;
        cameraStreamRef.current = s;
      });
    }
    setIsSharing(false);
  };
  // === SHARESCREEN P2P - END ===

  useEffect(() => {
    const savedName = localStorage.getItem("penmeet-name");
    const savedPosisi = localStorage.getItem("penmeet-posisi");
    if (savedName) setInputName(savedName);
    if (savedPosisi &&!isHR) setInputPosisi(savedPosisi);
  }, [isHR]);

  const handleJoin = () => {
    if (!inputName.trim()) return alert("Isi nama dulu bro!");
    if (!isHR &&!inputPosisi.trim()) return alert("Isi posisi yang dilamar dulu bro!");
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
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
        cameraStreamRef.current = stream;
        if (myVideoRef.current) myVideoRef.current.srcObject = stream;

        // FIX BUILD: Dynamic import biar Vercel Ready
        try {
          const Daily = (await import("@daily-co/daily-js")).default;
          const callObject = Daily.createCallObject();
          callRef.current = callObject;
          callObject.on("track-started", (e: any) => {
            if (e.participant.local) return;
            if (remoteVideoRef.current) {
              const existing = remoteVideoRef.current.srcObject as MediaStream;
              if (existing) {
                existing.getTracks().forEach(t => { if(t.kind === e.track.kind) existing.removeTrack(t); });
                existing.addTrack(e.track);
              } else {
                remoteVideoRef.current.srcObject = new MediaStream([e.track]);
              }
            }
          });
          callObject.on("participant-joined", () => {});
          callObject.on("error", (e:any) => console.log("Daily error", e));
          const DAILY_DOMAIN = "https://penmeet.daily.co"; 
          await callObject.join({ 
            url: `${DAILY_DOMAIN}/${id}`,
            userName: isHR ? `HR-${myName || inputName}` : `${candidateName || myName || inputName} - ${myPosition || inputPosisi}`
          });
        } catch (dailyErr) {
          console.log("Daily belum konek, pakai mode lokal dulu:", dailyErr);
        }
      } catch(e) { console.log(e) }
    }
    init();
    return () => { 
      stream?.getTracks().forEach(t => t.stop());
      try { callRef.current?.leave(); callRef.current?.destroy(); } catch {}
    }
  }, [showNameInput]);

  const toggleTranskrip = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Pakai Chrome ya bro!");
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'id-ID';
    recognition.onresult = (event: any) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript + " ";
      }
      setTranscript(text);
    };
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const ringkasDenganAI = async () => {
    if (!transcript) return alert("Belum ada transkrip bro!");
    setLoadingAI(true);
    try {
      const res = await fetch('/api/ringkas', {
        method: 'POST',
        body: JSON.stringify({ transcript, posisi: candidatePosisi || myPosition }),
      });
      const data = await res.json();
      setAiSummary(data.summary);
    } catch (e) {
      alert("Gagal ringkas, cek API Key Groq");
    }
    setLoadingAI(false);
  };

  const handleEndAndSave = async () => { setShowDecision(true); };
  const handleHRKeluar = () => {
    if (confirm('Yakin mau keluar tanpa menyimpan data? Data interview tidak akan masuk ke Sheet.')) {
      router.push('/');
    }
  };
  const confirmSave = async () => {
    const payload = {
      room: id,
      namaLengkap: candidateName || "Kandidat Room " + id,
      posisiDilamar: candidatePosisi || "-",
      pewawancara: myName,
      transkrip: transcript,
      ringkasanAI: aiSummary,
      keputusan: keputusan,
      tanggal: new Date().toISOString(),
    };
    try {
      await fetch('/api/simpan-hr', { method: 'POST', body: JSON.stringify(payload) });
    } catch {}
    alert(`Tersimpan! ${payload.namaLengkap} = ${keputusan}`);
    if (isHR) {
      router.push('/');
    } else {
      router.push('/finished');
    }
  };
  const handleCandidateLeave = () => {
    router.push('/finished');
  };
  const candidateLink = typeof window!== 'undefined'? `${window.location.origin}/room/${id}` : '';

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black', position: 'relative', overflow: 'hidden' }}>
      {showNameInput && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', padding: '28px', borderRadius: '20px', width: '100%', maxWidth: '380px' }}>
            {isHR? (
              <>
                <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>Dashboard HR</h2>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '18px' }}>Room: {id} • Masuk sebagai HR</p>
                <label style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px', display: 'block' }}>Nama HR / Interviewer</label>
                <input value={inputName} onChange={e => setInputName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleJoin()} placeholder="Contoh: Pak Apen" style={{ width: '100%', padding: '14px', border: '2px solid #e5e7eb', borderRadius: '12px', marginBottom: '18px', outline: 'none', fontSize: '14px' }} />
                <button onClick={handleJoin} style={{ width: '100%', padding: '14px', background: '#111827', color: 'white', borderRadius: '12px', fontWeight: '700' }}>Masuk Dashboard HR</button>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>Masuk Interview</h2>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '18px' }}>Room: {id} • Isi data kandidat dulu</p>
                <label style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px', display: 'block' }}>Nama Lengkap</label>
                <input value={inputName} onChange={e => setInputName(e.target.value)} placeholder="Contoh: Apen Saputra" style={{ width: '100%', padding: '14px', border: '2px solid #e5e7eb', borderRadius: '12px', marginBottom: '14px', outline: 'none', fontSize: '14px' }} />
                <label style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px', display: 'block' }}>Posisi yang Dilamar</label>
                <input value={inputPosisi} onChange={e => setInputPosisi(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleJoin()} placeholder="Contoh: Frontend Developer" style={{ width: '100%', padding: '14px', border: '2px solid #e5e7eb', borderRadius: '12px', marginBottom: '18px', outline: 'none', fontSize: '14px' }} />
                <button onClick={handleJoin} style={{ width: '100%', padding: '14px', background: '#2563eb', color: 'white', borderRadius: '12px', fontWeight: '700' }}>Gabung Interview</button>
                <p style={{ fontSize: '10px', color: '#999', marginTop: '10px', textAlign: 'center' }}>Data auto masuk ke Google Sheet & Looker Studio</p>
              </>
            )}
          </div>
        </div>
      )}
      {showDecision && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '20px', width: '100%', maxWidth: '420px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800' }}>{candidateName || "Kandidat"}</h2>
            <p style={{ fontSize: '12px', color: '#2563eb', fontWeight: '700', marginBottom: '12px' }}>{candidatePosisi || "-"}</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {['LOLOS', 'DIPERTIMBANGKAN', 'TIDAK LOLOS'].map(k => (
                <button key={k} onClick={() => setKeputusan(k)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '2px solid', borderColor: keputusan === k? '#2563eb' : '#e5e7eb', background: keputusan === k? '#dbeafe' : 'white', fontSize: '11px', fontWeight: '700' }}>{k}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowDecision(false)} style={{ flex: 1, padding: '14px', background: '#e5e7eb', borderRadius: '12px', fontWeight: '700' }}>Batal</button>
              <button onClick={confirmSave} style={{ flex: 1, padding: '14px', background: '#16a34a', color: 'white', borderRadius: '12px', fontWeight: '700' }}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'black' }} />
      <video ref={myVideoRef} autoPlay playsInline muted style={{ position: 'absolute', bottom: '20px', right: '20px', width: '140px', height: '105px', borderRadius: '12px', objectFit: 'cover', transform: isSharing ? 'scaleX(1)' : 'scaleX(-1)', border: '2px solid white', background: '#222' }} />

      <div style={{ position: 'absolute', bottom: '88px', left: '16px', background: 'rgba(0,0,0,0.65)', color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '600' }}>{isHR? `HR: ${myName}` : (candidateName? `${candidateName} - ${candidatePosisi}` : remoteName)} {isSharing && "• 🔵 Sharing Screen"}</div>
      <div style={{ position: 'absolute', top: '16px', left: '16px', background: 'rgba(0,0,0,0.5)', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '11px' }}>{isHR? `Dashboard HR • Room: ${id}` : `Posisi: ${candidatePosisi || `Room: ${id}`}`}</div>

      {isHR && (
        <div style={{ position: 'absolute', top: '16px', right: '16px', width: '340px', background: 'white', borderRadius: '16px', padding: '14px', maxHeight: '85vh', overflow: 'auto' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '2px' }}>Dashboard HR</h3>
          <p style={{ fontSize: '11px', color: '#666', marginBottom: '12px' }}>Interview: {myName}</p>
          <div style={{ background: '#f3f4f6', padding: '10px', borderRadius: '10px', marginBottom: '12px' }}>
            <p style={{ fontSize: '10px', fontWeight: '800', marginBottom: '6px' }}>LINK UNTUK KANDIDAT:</p>
            <p style={{ fontSize: '10px', wordBreak: 'break-all', background: 'white', padding: '6px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>{candidateLink}</p>
            <button onClick={() => { navigator.clipboard.writeText(candidateLink); alert("Link tercopy!"); }} style={{ marginTop: '8px', width: '100%', padding: '8px', background: '#111827', color: 'white', borderRadius: '8px', fontSize: '11px', fontWeight: '700' }}>📋 Copy Link Kandidat</button>
          </div>
          <button onClick={toggleTranskrip} style={{ width: '100%', padding: '10px', borderRadius: '10px', background: isRecording? '#ef4444' : '#2563eb', color: 'white', fontWeight: '700', fontSize: '12px', marginBottom: '10px' }}>{isRecording? '🔴 Stop Catat' : '🎙️ Mulai Catat Interview'}</button>
          <textarea value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Transkrip interview akan muncul di sini..." style={{ width: '100%', height: '90px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', fontSize: '11px', marginBottom: '10px' }} />
          <button onClick={ringkasDenganAI} disabled={loadingAI} style={{ width: '100%', padding: '10px', borderRadius: '10px', background: '#16a34a', color: 'white', fontWeight: '700', fontSize: '12px', marginBottom: '10px' }}>{loadingAI? 'Merangkum...' : '✨ Ringkas dengan AI (Groq)'}</button>
          {aiSummary && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px', borderRadius: '8px', fontSize: '11px', whiteSpace: 'pre-wrap' }}>{aiSummary}</div>}
        </div>
      )}

      <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', background: '#1f2937', padding: '8px 16px', borderRadius: '999px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button onClick={() => { const s = myVideoRef.current?.srcObject as MediaStream; s?.getAudioTracks().forEach(t => t.enabled =!t.enabled); try{callRef.current?.setLocalAudio(micOn ? false : true);}catch{}; setMicOn(v =>!v); }} style={{ width: '48px', height: '48px', borderRadius: '50%', background: micOn? '#374151' : '#ef4444', color: 'white' }}>{micOn? '🎤' : '🔇'}</button>
        <button onClick={() => { const s = myVideoRef.current?.srcObject as MediaStream; s?.getVideoTracks().forEach(t => t.enabled =!t.enabled); try{callRef.current?.setLocalVideo(camOn ? false : true);}catch{}; setCamOn(v =>!v); }} style={{ width: '48px', height: '48px', borderRadius: '50%', background: camOn? '#374151' : '#ef4444', color: 'white' }}>{camOn? '📹' : '📷'}</button>
        <button onClick={toggleShareScreen} style={{ width: '48px', height: '48px', borderRadius: '50%', background: isSharing ? '#2563eb' : '#374151', color: 'white', border: isSharing ? '2px solid #93c5fd' : 'none' }} title={isSharing ? "Stop Sharing" : "Share Screen"}>{isSharing ? '🛑' : '🖥️'}</button>
        {isHR? (
          <>
            <button onClick={handleHRKeluar} style={{ padding: '0 18px', height: '48px', borderRadius: '24px', background: '#e5e7eb', color: '#374151', fontWeight: '700', fontSize: '13px' }}>Keluar</button>
            <button onClick={handleEndAndSave} style={{ padding: '0 22px', height: '48px', borderRadius: '24px', background: '#ef4444', color: 'white', fontWeight: '700' }}>END & SIMPAN</button>
          </>
        ) : (
          <button onClick={handleCandidateLeave} style={{ padding: '0 22px', height: '48px', borderRadius: '24px', background: '#111827', color: 'white', fontWeight: '700' }}>Selesai</button>
        )}
      </div>
    </div>
  );
}