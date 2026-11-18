import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { firebaseAuth } from '../firebase';
import { loginWithFirebaseToken, clearAuthError } from '../store/authSlice';
import FormField from '../components/FormField';
import { requiredPhone, otpCode } from '../utils/validation';

const RESEND_SECONDS = 60;

// Normalizes to E.164, defaulting to India (+91) for a bare 10-digit number —
// mirrors the backend's normalizePhone() so what the user sees matches what gets sent.
function toE164(raw) {
  let phone = (raw || '').trim().replace(/[\s\-()]/g, '');
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  if (!phone.startsWith('+')) {
    phone = phone.replace(/^0/, '');
    phone = /^\d{10}$/.test(phone) ? `+91${phone}` : `+${phone}`;
  }
  return phone;
}

const FRIENDLY_ERRORS = {
  'auth/invalid-phone-number': 'Please enter a valid phone number.',
  'auth/too-many-requests': 'Too many attempts. Please wait a while before trying again.',
  'auth/invalid-verification-code': 'Incorrect OTP. Please check the code and try again.',
  'auth/code-expired': 'This OTP has expired. Please resend a new one.',
  'auth/quota-exceeded': 'SMS quota exceeded on this Firebase project. Please try again later.',
};

function friendlyError(err) {
  return FRIENDLY_ERRORS[err?.code] || err?.message || 'Something went wrong. Please try again.';
}

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { status, error: loginError } = useSelector((s) => s.auth);

  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [localError, setLocalError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  const confirmationResultRef = useRef(null);
  const recaptchaVerifierRef = useRef(null);
  const otpInputRef = useRef(null);
  const timerRef = useRef(null);

  const error = localError || loginError;

  useEffect(() => {
    if (step === 'otp') otpInputRef.current?.focus();
  }, [step]);

  // 60-second countdown; once it hits 0 the Resend button becomes active.
  useEffect(() => {
    if (step !== 'otp') return undefined;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [step]);

  const getRecaptcha = useCallback(() => {
    if (!recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
    return recaptchaVerifierRef.current;
  }, []);

  const sendOtp = useCallback(async (phoneNumber) => {
    setLocalError('');
    dispatch(clearAuthError());
    setSending(true);
    try {
      const verifier = getRecaptcha();
      const confirmation = await signInWithPhoneNumber(firebaseAuth, phoneNumber, verifier);
      confirmationResultRef.current = confirmation;
      setSecondsLeft(RESEND_SECONDS);
      setStep('otp');
    } catch (err) {
      setLocalError(friendlyError(err));
      // A failed send can leave the invisible widget in a bad state — drop it so the
      // next attempt creates a fresh one instead of silently failing again.
      recaptchaVerifierRef.current?.clear?.();
      recaptchaVerifierRef.current = null;
    } finally {
      setSending(false);
    }
  }, [dispatch, getRecaptcha]);

  const handleSendOtp = (e) => {
    e.preventDefault();
    const err = requiredPhone('Phone number')(phone);
    setPhoneError(err);
    if (err) return;
    sendOtp(toE164(phone));
  };

  const handleResend = () => {
    if (secondsLeft > 0 || sending) return;
    sendOtp(toE164(phone));
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const err = otpCode(otp);
    setOtpError(err);
    if (err) return;
    if (!confirmationResultRef.current) return;
    setLocalError('');
    dispatch(clearAuthError());
    setVerifying(true);
    try {
      const credential = await confirmationResultRef.current.confirm(otp);
      const idToken = await credential.user.getIdToken();
      const result = await dispatch(loginWithFirebaseToken({ idToken }));
      if (loginWithFirebaseToken.fulfilled.match(result)) {
        navigate(`/${result.payload.user.role}/dashboard`);
      } else {
        // Verified with Firebase, but this phone has no account in our system —
        // sign out of the Firebase session so it doesn't linger client-side.
        await firebaseAuth.signOut();
      }
    } catch (err) {
      setLocalError(friendlyError(err));
    } finally {
      setVerifying(false);
    }
  };

  const handleChangeNumber = () => {
    clearInterval(timerRef.current);
    confirmationResultRef.current = null;
    recaptchaVerifierRef.current?.clear?.();
    recaptchaVerifierRef.current = null;
    setOtp('');
    setOtpError('');
    setPhoneError('');
    setLocalError('');
    dispatch(clearAuthError());
    setStep('phone');
  };

  const mmss = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Welcome to PropelCRM</h1>
        <p>{step === 'phone' ? 'Sign in with your phone number to continue.' : `Enter the 6-digit code sent to ${toE164(phone)}.`}</p>
        {error && <div className="auth-error">{error}</div>}

        {step === 'phone' && (
          <form onSubmit={handleSendOtp} noValidate>
            <FormField label="Phone Number" required error={phoneError} style={{ marginBottom: 20 }}>
              <input
                type="tel"
                placeholder="+91 98200 12345"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setPhoneError(requiredPhone('Phone number')(e.target.value));
                }}
                onBlur={() => setPhoneError(requiredPhone('Phone number')(phone))}
                autoFocus
              />
            </FormField>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={sending}>
              {sending ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerify} noValidate>
            <FormField label="6-Digit OTP" required error={otpError} style={{ marginBottom: 14 }}>
              <input
                ref={otpInputRef}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                value={otp}
                onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, '');
                  setOtp(next);
                  setOtpError(otpCode(next));
                }}
                onBlur={() => setOtpError(otpCode(otp))}
                style={{ letterSpacing: 6, fontSize: 18, textAlign: 'center' }}
              />
            </FormField>

            <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text-600)', marginBottom: 18 }}>
              {secondsLeft > 0 ? (
                <>OTP expires in <b style={{ color: 'var(--text-900)' }}>{mmss}</b></>
              ) : (
                <span style={{ color: 'var(--red)' }}>OTP expired — please resend.</span>
              )}
            </div>

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={verifying || status === 'loading'}>
              {verifying || status === 'loading' ? 'Verifying...' : 'Verify & Sign In'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
              <button type="button" className="link-btn" onClick={handleChangeNumber}>Change number</button>
              <button
                type="button"
                className="link-btn"
                onClick={handleResend}
                disabled={secondsLeft > 0 || sending}
                style={{ opacity: secondsLeft > 0 || sending ? 0.5 : 1, cursor: secondsLeft > 0 || sending ? 'not-allowed' : 'pointer' }}
              >
                {sending ? 'Resending...' : secondsLeft > 0 ? `Resend in ${mmss}` : 'Resend OTP'}
              </button>
            </div>
          </form>
        )}

        <p style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text-400)', marginTop: 18 }}>
          Don't have access? Contact your broker to be added as an agent.
        </p>
      </div>

      {/* Invisible reCAPTCHA required by Firebase Phone Auth — renders nothing visible. */}
      <div id="recaptcha-container" />
    </div>
  );
}
