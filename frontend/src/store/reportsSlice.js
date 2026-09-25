import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api/axios';

export const fetchOverview = createAsyncThunk('reports/overview', async (_, { rejectWithValue }) => {
  try { const { data } = await api.get('/reports/overview'); return data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message || 'Failed to load overview.'); }
});

export const fetchLeadsByStage = createAsyncThunk('reports/leadsByStage', async (_, { rejectWithValue }) => {
  try { const { data } = await api.get('/reports/leads-by-stage'); return data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message || 'Failed to load report.'); }
});

export const fetchLeadsByPriority = createAsyncThunk('reports/leadsByPriority', async (_, { rejectWithValue }) => {
  try { const { data } = await api.get('/reports/leads-by-priority'); return data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message || 'Failed to load report.'); }
});

export const fetchLeadsBySource = createAsyncThunk('reports/leadsBySource', async (_, { rejectWithValue }) => {
  try { const { data } = await api.get('/reports/leads-by-source'); return data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message || 'Failed to load report.'); }
});

export const fetchMonthlyTrend = createAsyncThunk('reports/monthlyTrend', async (_, { rejectWithValue }) => {
  try { const { data } = await api.get('/reports/monthly-trend'); return data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message || 'Failed to load report.'); }
});

export const fetchAgentPerformance = createAsyncThunk('reports/agentPerformance', async (_, { rejectWithValue }) => {
  try { const { data } = await api.get('/reports/agent-performance'); return data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message || 'Failed to load report.'); }
});

const reportsSlice = createSlice({
  name: 'reports',
  initialState: {
    overview: {}, leadsByStage: [], leadsByPriority: [], leadsBySource: [], monthlyTrend: [], agentPerformance: [],
    status: 'idle',
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchOverview.fulfilled, (state, action) => { state.overview = action.payload; })
      .addCase(fetchLeadsByStage.fulfilled, (state, action) => { state.leadsByStage = action.payload; })
      .addCase(fetchLeadsByPriority.fulfilled, (state, action) => { state.leadsByPriority = action.payload; })
      .addCase(fetchLeadsBySource.fulfilled, (state, action) => { state.leadsBySource = action.payload; })
      .addCase(fetchMonthlyTrend.fulfilled, (state, action) => { state.monthlyTrend = action.payload; })
      .addCase(fetchAgentPerformance.fulfilled, (state, action) => { state.agentPerformance = action.payload; });
  },
});

export default reportsSlice.reducer;
