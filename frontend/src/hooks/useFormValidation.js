import { useCallback, useState } from 'react';

/**
 * Per-field validation that shows errors immediately:
 *  - as soon as a field has a value that fails its rule
 *  - on blur / first edit for empty required fields
 *  - on submit for every remaining error
 *
 * `rules` is { fieldName: (value, allValues) => errorString }.
 */
export default function useFormValidation(values, rules) {
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const errors = {};
  Object.entries(rules).forEach(([key, rule]) => {
    if (typeof rule !== 'function') return;
    const msg = rule(values[key], values);
    if (msg) errors[key] = msg;
  });

  const show = (key) => {
    if (!errors[key]) return '';
    if (submitted || touched[key]) return errors[key];
    const val = values[key];
    if (val !== '' && val != null && !(Array.isArray(val) && val.length === 0)) return errors[key];
    return '';
  };

  const touch = useCallback((key) => {
    setTouched((t) => (t[key] ? t : { ...t, [key]: true }));
  }, []);

  const reset = useCallback(() => {
    setTouched({});
    setSubmitted(false);
  }, []);

  const validate = () => {
    setSubmitted(true);
    return Object.keys(errors).length === 0;
  };

  return { errors, show, touch, reset, validate, submitted };
}
