import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api/axios';

export const fetchFollowUpsForLead = createAsyncThunk('followUps/fetchForLead', async (leadId, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/leads/${leadId}/follow-ups`);
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to load follow-ups.');
  }
});

export const addFollowUp = createAsyncThunk('followUps/create', async ({ leadId, ...payload }, { rejectWithValue }) => {
  try {
    const { data } = await api.post(`/leads/${leadId}/follow-ups`, payload);
    return data; // { data: followUp, lead }
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to add follow-up.');
  }
});

// The Follow-ups / Site Visits sidebars — leads that have at least one follow-up,
// each annotated with its latest activity. Params: { activityType, bucket, search }
export const fetchLeadsWithFollowUps = createAsyncThunk('followUps/fetchLeadsWithFollowUps', async (params = {}, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/follow-ups/leads', { params });
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to load follow-ups list.');
  }
});

const followUpsSlice = createSlice({
  name: 'followUps',
  initialState: { timeline: [], leadsList: [], status: 'idle', error: null },
  reducers: {
    clearTimeline(state) { state.timeline = []; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFollowUpsForLead.pending, (state) => { state.status = 'loading'; })
      .addCase(fetchFollowUpsForLead.fulfilled, (state, action) => { state.status = 'succeeded'; state.timeline = action.payload; })
      .addCase(fetchFollowUpsForLead.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload; })
      .addCase(addFollowUp.fulfilled, (state, action) => { state.timeline.unshift(action.payload.data); })
      .addCase(fetchLeadsWithFollowUps.fulfilled, (state, action) => { state.leadsList = action.payload; });
  },
});

export const { clearTimeline } = followUpsSlice.actions;
export default followUpsSlice.reducer;
