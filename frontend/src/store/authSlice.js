import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api/axios';

// Firebase Phone Auth (in Login.jsx) handles sending + verifying the real SMS OTP
// entirely client-side. Once that succeeds, the browser holds a Firebase ID token
// proving the phone number — this thunk exchanges that for our own app session.
export const loginWithFirebaseToken = createAsyncThunk(
  'auth/loginWithFirebaseToken',
  async ({ idToken }, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/auth/firebase-login', { idToken });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Login failed.');
    }
  }
);

export const fetchMe = createAsyncThunk('auth/fetchMe', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/auth/me');
    return data.user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Session expired.');
  }
});

const storedUser = JSON.parse(localStorage.getItem('user') || 'null');

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: storedUser,
    token: localStorage.getItem('token') || null,
    status: 'idle',   // idle | loading | failed
    error: null,
  },
  reducers: {
    logout(state) {
      state.user = null;
      state.token = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginWithFirebaseToken.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(loginWithFirebaseToken.fulfilled, (state, action) => {
        state.status = 'idle';
        state.user = action.payload.user;
        state.token = action.payload.token;
        localStorage.setItem('token', action.payload.token);
        localStorage.setItem('user', JSON.stringify(action.payload.user));
      })
      .addCase(loginWithFirebaseToken.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload; })
      .addCase(fetchMe.fulfilled, (state, action) => { state.user = action.payload; })
      .addCase(fetchMe.rejected, (state) => { state.user = null; state.token = null; });
  },
});

export const { logout, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
