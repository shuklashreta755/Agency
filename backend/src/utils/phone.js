// Accepts numbers like +919820012345, 9820012345, 09820012345 — normalizes to +<countrycode><number>
// Defaults to India (+91) when no country code is given, but accepts any valid E.164 number.
function normalizePhone(raw) {
  if (!raw) return null;
  let phone = String(raw).trim().replace(/[\s\-()]/g, '');
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  if (!phone.startsWith('+')) {
    // Strip a leading trunk 0, then assume India if it's a bare 10-digit number
    phone = phone.replace(/^0/, '');
    if (/^\d{10}$/.test(phone)) phone = `+91${phone}`;
    else phone = `+${phone}`;
  }
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

module.exports = { normalizePhone };
