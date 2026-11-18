
export function isBlank(v) {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  return String(v).trim() === '';
}

export function required(label) {
  return (v) => (isBlank(v) ? `${label} is required.` : '');
}

export function personName(label) {
  return (v) => {
    const s = String(v || '').trim();
    if (!s) return `${label} is required.`;
    if (s.length < 2) return `${label} must be at least 2 characters.`;
    if (!/^[\p{L}][\p{L} .'-]*$/u.test(s)) return `${label} can only contain letters, spaces, and . ' -`;
    return '';
  };
}

export function textName(label, min = 2) {
  return (v) => {
    const s = String(v || '').trim();
    if (!s) return `${label} is required.`;
    if (s.length < min) return `${label} must be at least ${min} characters.`;
    return '';
  };
}

export function isValidPhone(raw) {
  if (raw == null || String(raw).trim() === '') return false;
  let phone = String(raw).trim().replace(/[\s\-()]/g, '');
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  if (!phone.startsWith('+')) {
    phone = phone.replace(/^0/, '');
    phone = /^\d{10}$/.test(phone) ? `+91${phone}` : `+${phone}`;
  }
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

export function phone(v) {
  if (isBlank(v)) return '';
  return isValidPhone(v) ? '' : 'Enter a valid phone number (10 digits, or with country code).';
}

export function requiredPhone(label = 'Phone') {
  return (v) => required(label)(v) || phone(v);
}

export function email(v) {
  if (isBlank(v)) return '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()) ? '' : 'Enter a valid email address.';
}

export function otpCode(v) {
  const s = String(v || '').trim();
  if (!s) return 'OTP is required.';
  if (!/^\d{6}$/.test(s)) return 'Enter the 6-digit OTP.';
  return '';
}

export function positiveNumber(label) {
  return (v) => {
    if (isBlank(v)) return `${label} is required.`;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return `${label} must be a positive number.`;
    return '';
  };
}

export function nonNegativeNumber(label) {
  return (v) => {
    if (isBlank(v)) return '';
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return `${label} cannot be negative.`;
    return '';
  };
}

export function optionalPositiveNumber(label) {
  return (v) => {
    if (isBlank(v)) return '';
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return `${label} must be a positive number.`;
    return '';
  };
}

export function percentage(label = 'Percentage') {
  return (v) => {
    if (isBlank(v)) return `${label} is required.`;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return `${label} must be greater than 0.`;
    if (n > 100) return `${label} cannot be more than 100.`;
    return '';
  };
}

export function latitude(v) {
  if (isBlank(v)) return '';
  const n = Number(v);
  if (!Number.isFinite(n) || n < -90 || n > 90) return 'Latitude must be between -90 and 90.';
  return '';
}

export function longitude(v) {
  if (isBlank(v)) return '';
  const n = Number(v);
  if (!Number.isFinite(n) || n < -180 || n > 180) return 'Longitude must be between -180 and 180.';
  return '';
}

export function exactAmount(expected, label = 'Amount') {
  return (v) => {
    if (isBlank(v)) return `${label} is required.`;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return `${label} must be a positive number.`;
    if (Math.abs(n - Number(expected)) > 0.01) {
      return `${label} must be exactly ₹${Number(expected).toLocaleString('en-IN')}.`;
    }
    return '';
  };
}
