import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../api/axios';
import { fetchMe } from '../store/authSlice';

export default function SettingsView() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '' });
  const [msg, setMsg] = useState('');

  const saveProfile = async (e) => {
    e.preventDefault();
    await api.put('/settings/profile', profile);
    dispatch(fetchMe());
    setMsg('Profile updated successfully.');
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <>
      {msg && <div className="auth-error" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>{msg}</div>}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 18 }}>Profile Information</div>
        <form onSubmit={saveProfile}>
          <div className="form-grid">
            <div className="form-field"><label>Full Name</label><input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></div>
            <div className="form-field"><label>Phone Number</label><input value={user?.phone} disabled /></div>
            <div className="form-field"><label>Email Address (optional)</label><input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></div>
            <div className="form-field"><label>Role</label><input value={user?.role === 'broker' ? 'Broker · Owner' : 'Agent · Sales'} disabled /></div>
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
