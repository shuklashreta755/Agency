import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../api/axios';
import { fetchMe } from '../store/authSlice';
import FormField from '../components/FormField';
import useFormValidation from '../hooks/useFormValidation';
import { personName, email } from '../utils/validation';

export default function SettingsView() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '' });
  const [msg, setMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const v = useFormValidation(profile, {
    name: personName('Full name'),
    email,
  });

  const setField = (key, val) => {
    setProfile((p) => ({ ...p, [key]: val }));
    v.touch(key);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaveError('');
    setMsg('');
    if (!v.validate()) return;
    try {
      await api.put('/settings/profile', profile);
      dispatch(fetchMe());
      setMsg('Profile updated successfully.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Could not save profile.');
    }
  };

  return (
    <>
      {msg && <div className="auth-error" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>{msg}</div>}
      {saveError && <div className="auth-error">{saveError}</div>}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 18 }}>Profile Information</div>
        <form onSubmit={saveProfile} noValidate>
          <div className="form-grid">
            <FormField label="Full Name" required error={v.show('name')}>
              <input value={profile.name} onChange={(e) => setField('name', e.target.value)} onBlur={() => v.touch('name')} />
            </FormField>
            <FormField label="Phone Number">
              <input value={user?.phone} disabled />
            </FormField>
            <FormField label="Email Address (optional)" error={v.show('email')}>
              <input type="email" value={profile.email} onChange={(e) => setField('email', e.target.value)} onBlur={() => v.touch('email')} />
            </FormField>
            <FormField label="Role">
              <input value={user?.role === 'broker' ? 'Broker · Owner' : 'Agent · Sales'} disabled />
            </FormField>
          </div>
          <p className="cell-sub" style={{ marginTop: 10 }}>
            Your phone number is your login ID and can't be changed here{user?.role === 'agent' ? ' — ask your broker to update it from the Agents page.' : '.'}
          </p>
          <div style={{ marginTop: 14 }}><button className="btn btn-primary">Save Changes</button></div>
        </form>
      </div>
    </>
  );
}
