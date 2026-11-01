import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { api, errorText } from '../shared/api.js';
import { money } from '../shared/formatters.js';

// Loads the Razorpay checkout.js script once
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function RazorpayCheckout({ projectId, quoteTotal, customerName, customerEmail, customerPhone, onSuccess, onClose }) {
  const [step, setStep] = useState('form'); // form | qr | processing | success | error
  const [amount, setAmount] = useState('');
  const [payType, setPayType] = useState('ADVANCE');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [txnId, setTxnId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef(null);

  // Generate UPI QR when step = 'qr'
  useEffect(() => {
    if (step !== 'qr' || !amount) return;
    const upiString = `upi://pay?pa=sunpowersolutions@okaxis&pn=SunPower+Solutions&am=${Number(amount).toFixed(2)}&cu=INR&tn=Solar+System+Payment`;
    QRCode.toDataURL(upiString, {
      width: 220,
      margin: 2,
      color: { dark: '#072654', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    }).then(setQrDataUrl);
  }, [step, amount]);

  async function handleProceed(e) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) { setErrorMsg('Enter a valid amount.'); return; }
    setErrorMsg('');
    setStep('qr');
  }

  async function handleOpenRazorpay() {
    setBusy(true);
    setErrorMsg('');
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Could not load Razorpay. Check your internet connection.');

      const { data } = await api.post('/payments/razorpay/create-order', {
        amount: Number(amount),
        projectId,
      });
      const { orderId: rzpOrderId, keyId } = data.data;
      setOrderId(rzpOrderId);

      const options = {
        key: keyId,
        amount: Math.round(Number(amount) * 100),
        currency: 'INR',
        name: 'SunPower Solutions',
        description: `Solar System Payment — ${payType}`,
        image: '/vite.svg',
        order_id: rzpOrderId,
        prefill: {
          name: customerName || '',
          email: customerEmail || '',
          contact: customerPhone || '',
        },
        theme: { color: '#072654' },
        modal: { backdropclose: false },
        handler: async (response) => {
          setStep('processing');
          try {
            await api.post('/payments/razorpay/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              projectId,
              amount: Number(amount),
              type: payType,
            });
            setTxnId(response.razorpay_payment_id);
            setOrderId(response.razorpay_order_id);
            // Brief pause for animation
            await new Promise((r) => setTimeout(r, 800));
            setStep('success');
            onSuccess?.();
          } catch (err) {
            setErrorMsg(errorText(err));
            setStep('qr');
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => {
        setErrorMsg(`Payment failed: ${resp.error.description}`);
        setStep('qr');
      });
      rzp.open();
    } catch (err) {
      setErrorMsg(errorText(err));
      setStep('qr');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.4)', fontFamily: 'system-ui,sans-serif' }}>

        {/* Header */}
        <div style={{ background: '#072654', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#3395FF', borderRadius: 6, padding: '4px 10px', fontWeight: 900, fontSize: 15, color: '#fff', letterSpacing: '-1px' }}>razorpay</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>SunPower Solutions</div>
              <div style={{ color: '#93c5fd', fontSize: 11 }}>🔒 Secured by Razorpay</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#93c5fd', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {/* ── STEP: FORM ── */}
        {step === 'form' && (
          <form onSubmit={handleProceed} style={{ padding: 24 }}>
            {errorMsg && <div style={errStyle}>{errorMsg}</div>}

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>AMOUNT TO PAY (₹) *</label>
              <div style={{ display: 'flex', border: '2px solid #d1d5db', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                <span style={{ padding: '10px 14px', background: '#f9fafb', color: '#374151', fontWeight: 800, fontSize: 16, borderRight: '1px solid #d1d5db' }}>₹</span>
                <input
                  type="number" min="1" step="1" required autoFocus
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={Math.round(quoteTotal * 0.3).toString()}
                  style={{ border: 'none', outline: 'none', flex: 1, padding: '10px 14px', fontSize: 18, fontWeight: 700 }}
                />
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                Total quoted: <strong>{money(quoteTotal)}</strong>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>PAYMENT TYPE</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {[['ADVANCE', '30% Booking'], ['PARTIAL', 'Part Payment'], ['FINAL', 'Full & Final']].map(([val, label]) => (
                  <button key={val} type="button"
                    onClick={() => setPayType(val)}
                    style={{ padding: '9px 6px', border: '1.5px solid', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'center', transition: 'all .15s', borderColor: payType === val ? '#3395FF' : '#e5e7eb', background: payType === val ? '#eff6ff' : '#fff', color: payType === val ? '#1d4ed8' : '#374151' }}
                  >{label}</button>
                ))}
              </div>
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#166534', marginBottom: 20 }}>
              <strong>Multiple payment options available:</strong> UPI · QR Code · Cards · Netbanking · Wallets
            </div>

            <button type="submit" style={primaryBtnStyle}>
              Continue to Pay ₹{amount ? Number(amount).toLocaleString('en-IN') : '—'}  →
            </button>
          </form>
        )}

        {/* ── STEP: QR ── */}
        {step === 'qr' && (
          <div style={{ padding: 24, textAlign: 'center' }}>
            {errorMsg && <div style={errStyle}>{errorMsg}</div>}

            <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>
              Paying <strong style={{ fontSize: 16, color: '#072654' }}>₹{Number(amount).toLocaleString('en-IN')}</strong>
              <span style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 700, marginLeft: 6 }}>{payType}</span>
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 16 }}>Scan with any UPI app or click Pay Now</div>

            {/* QR Code with pulsing ring */}
            <div style={{ position: 'relative', width: 220, margin: '0 auto 16px', display: 'inline-block' }}>
              <div style={{ position: 'absolute', inset: -8, borderRadius: 18, border: '3px solid #3395FF', animation: 'rzpPulse 2s ease-in-out infinite', opacity: 0.6 }} />
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="UPI QR" style={{ width: 220, height: 220, borderRadius: 12, border: '3px solid #e5e7eb', display: 'block' }} />
              ) : (
                <div style={{ width: 220, height: 220, borderRadius: 12, background: '#f1f5f9', display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: 12 }}>Generating QR…</div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16, fontSize: 11, color: '#6b7280' }}>
              <div style={{ height: 1, flex: 1, background: '#e5e7eb' }} />
              OR PAY WITH RAZORPAY CHECKOUT
              <div style={{ height: 1, flex: 1, background: '#e5e7eb' }} />
            </div>

            <button onClick={handleOpenRazorpay} disabled={busy} style={{ ...primaryBtnStyle, marginBottom: 10 }}>
              {busy ? '⏳ Opening Checkout…' : '⚡ Pay Now — All Methods'}
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, marginBottom: 14 }}>
              {['UPI', 'Cards', 'NetBanking', 'Wallets', 'EMI'].map((m) => (
                <div key={m} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 2px', fontSize: 10, color: '#475569', fontWeight: 600, textAlign: 'center' }}>{m}</div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              🔒 256-bit SSL · Powered by Razorpay
            </div>
            <button onClick={() => setStep('form')} style={{ marginTop: 10, background: 'none', border: 'none', color: '#6b7280', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>← Change amount</button>
          </div>
        )}

        {/* ── STEP: PROCESSING ── */}
        {step === 'processing' && (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ position: 'relative', width: 70, height: 70, margin: '0 auto 24px' }}>
              <div style={{ position: 'absolute', inset: 0, border: '5px solid #e5e7eb', borderTopColor: '#3395FF', borderRadius: '50%', animation: 'rzpSpin 0.8s linear infinite' }} />
              <div style={{ position: 'absolute', inset: 10, border: '4px solid #e5e7eb', borderTopColor: '#072654', borderRadius: '50%', animation: 'rzpSpin 1.2s linear infinite reverse' }} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#1e293b', marginBottom: 6 }}>Verifying Payment…</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Confirming with Razorpay servers</div>
          </div>
        )}

        {/* ── STEP: SUCCESS ── */}
        {step === 'success' && (
          <SuccessScreen amount={amount} txnId={txnId} orderId={orderId} onClose={onClose} />
        )}

        {/* ── STEP: ERROR ── */}
        {step === 'error' && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#991b1b', marginBottom: 8 }}>Payment Failed</div>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 20 }}>{errorMsg}</div>
            <button onClick={() => { setStep('form'); setErrorMsg(''); }} style={primaryBtnStyle}>Try Again</button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes rzpSpin { to { transform: rotate(360deg) } }
        @keyframes rzpPulse { 0%,100% { transform: scale(1); opacity:.6 } 50% { transform: scale(1.06); opacity:1 } }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SUCCESS SCREEN  — full Razorpay-style animation
───────────────────────────────────────────── */
function SuccessScreen({ amount, txnId, orderId, onClose }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: '#fff' }}>
      <ConfettiBurst />

      {/* Green hero band */}
      <div style={{
        background: 'linear-gradient(160deg, #064e3b 0%, #065f46 50%, #047857 100%)',
        padding: '36px 24px 44px',
        textAlign: 'center',
        position: 'relative',
      }}>
        {/* Ripple rings */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              position: 'absolute',
              width: 90 + i * 44, height: 90 + i * 44,
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.18)',
              animation: `rzpRipple 2.4s ease-out ${i * 0.4}s infinite`,
            }} />
          ))}
        </div>

        {/* Animated checkmark circle */}
        <div style={{ position: 'relative', zIndex: 1, margin: '0 auto 18px' }}>
          <svg width="88" height="88" viewBox="0 0 88 88">
            {/* outer glow circle */}
            <circle cx="44" cy="44" r="40" fill="rgba(255,255,255,0.12)" style={{ animation: 'rzpCirclePop .35s cubic-bezier(.175,.885,.32,1.275) both' }} />
            {/* white solid circle */}
            <circle cx="44" cy="44" r="32" fill="#fff" style={{ animation: 'rzpCirclePop .4s .05s cubic-bezier(.175,.885,.32,1.275) both' }} />
            {/* animated stroke circle */}
            <circle cx="44" cy="44" r="38" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="3"
              strokeDasharray="239" strokeDashoffset="239"
              style={{ animation: 'rzpStrokeDraw .6s .1s ease forwards' }} />
            {/* checkmark */}
            <polyline points="28,44 40,56 62,34" fill="none" stroke="#16a34a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="50" strokeDashoffset="50"
              style={{ animation: 'rzpCheckDraw .4s .45s ease forwards' }} />
          </svg>
        </div>

        <div style={{ position: 'relative', zIndex: 1, color: '#fff', fontWeight: 800, fontSize: 22, letterSpacing: '-.3px', animation: 'rzpSlideUp .4s .5s ease both', opacity: 0 }}>
          Payment Successful!
        </div>
        <div style={{ position: 'relative', zIndex: 1, color: 'rgba(255,255,255,.8)', fontSize: 13, marginTop: 4, animation: 'rzpSlideUp .4s .65s ease both', opacity: 0 }}>
          ₹<strong style={{ fontSize: 17, color: '#fff' }}>{Number(amount).toLocaleString('en-IN')}</strong> · Received
        </div>
      </div>

      {/* Details card — slides up */}
      <div style={{ padding: '20px 24px 24px', animation: 'rzpSlideUp .5s .55s ease both', opacity: 0 }}>
        {/* Razorpay branding strip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 18, fontSize: 11, color: '#6b7280' }}>
          <div style={{ height: 1, flex: 1, background: '#e5e7eb' }} />
          <span style={{ background: '#3395FF', color: '#fff', borderRadius: 4, padding: '2px 8px', fontWeight: 900, fontSize: 12, letterSpacing: '-0.5px' }}>razorpay</span>
          <div style={{ height: 1, flex: 1, background: '#e5e7eb' }} />
        </div>

        {/* Transaction detail rows */}
        <div style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 16 }}>
          {[
            ['Transaction ID', txnId, true],
            ['Order ID', orderId, true],
            ['Amount Paid', `₹${Number(amount).toLocaleString('en-IN')}`, false],
            ['Status', '✓ Verified by Razorpay', false, '#16a34a'],
          ].map(([label, val, mono, color], i, arr) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px',
              borderBottom: i < arr.length - 1 ? '1px solid #e2e8f0' : 'none',
            }}>
              <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: mono ? 10 : 12, fontFamily: mono ? 'monospace' : 'inherit', fontWeight: 700, color: color || '#1e293b', maxWidth: 180, textAlign: 'right', wordBreak: 'break-all' }}>{val}</span>
            </div>
          ))}
        </div>

        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#92400e', marginBottom: 16 }}>
          ⏳ Shows <strong>Pending Verification</strong> until our Sales team manually confirms receipt.
        </div>

        <button onClick={onClose} style={{
          width: '100%', padding: '13px',
          background: 'linear-gradient(90deg,#3395FF,#1d6fe8)',
          color: '#fff', border: 'none', borderRadius: 10,
          fontWeight: 700, fontSize: 15, cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(51,149,255,.4)',
        }}>
          Done
        </button>
      </div>

      <style>{`
        @keyframes rzpRipple   { 0%{transform:scale(.6);opacity:.8} 100%{transform:scale(1.3);opacity:0} }
        @keyframes rzpCirclePop{ from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes rzpStrokeDraw{ to{ stroke-dashoffset:0 } }
        @keyframes rzpCheckDraw { to{ stroke-dashoffset:0 } }
        @keyframes rzpSlideUp  { from{transform:translateY(18px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes rzpConfetti {
          0%   { transform: translateY(-10px) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(460px) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* Confetti that rains DOWN from the top */
function ConfettiBurst() {
  const COLORS = ['#3395FF','#16a34a','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#f97316'];
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    left:  `${5 + (i / 40) * 90}%`,
    delay: `${(i * 0.045).toFixed(2)}s`,
    color: COLORS[i % COLORS.length],
    w: 5 + (i % 4) * 3,
    h: 8 + (i % 3) * 4,
    dur:   `${1.2 + (i % 5) * 0.2}s`,
    radius: i % 3 === 0 ? '50%' : (i % 3 === 1 ? '2px' : '0'),
  }));
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100%', pointerEvents: 'none', overflow: 'hidden', zIndex: 10 }}>
      {pieces.map((p, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: '-12px',
          left: p.left,
          width: p.w,
          height: p.h,
          background: p.color,
          borderRadius: p.radius,
          animation: `rzpConfetti ${p.dur} ${p.delay} ease-in both`,
        }} />
      ))}
    </div>
  );
}

const labelStyle = { fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5, letterSpacing: '.05em' };
const primaryBtnStyle = { width: '100%', padding: '12px', background: '#3395FF', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer' };
const errStyle = { background: '#fee2e2', color: '#991b1b', borderRadius: 6, padding: '8px 12px', fontSize: 12, marginBottom: 12 };
