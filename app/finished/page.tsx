export default function Finished() {
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', padding: '16px' }}>
      <div style={{ background: 'white', padding: '32px', borderRadius: '24px', maxWidth: '420px', width: '100%', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
        <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '8px' }}>Wawancara Selesai!</h1>
        <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.6', marginBottom: '20px' }}>
          Terima kasih sudah mengikuti wawancara di <b>PenMeet</b>.<br/>
          Hasil interview akan kami informasikan segera melalui email/WA.<br/>
          Anda boleh menutup halaman ini.
        </p>
        <a href="/" style={{ display: 'block', width: '100%', padding: '14px', background: '#111827', color: 'white', borderRadius: '12px', fontWeight: '700', textDecoration: 'none' }}>
          Kembali ke Beranda
        </a>
      </div>
    </div>
  );
}