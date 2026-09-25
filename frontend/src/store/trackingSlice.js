import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api/axios';

export const fetchAgentLocations = createAsyncThunk('tracking/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/tracking');
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to load agent locations.');
  }
});

const trackingSlice = createSlice({
  name: 'tracking',
  initialState: { agents: [], status: 'idle', error: null },
  reducers: {
    // Called when a 'location:updated' socket event arrives
    applyLocationUpdate(state, action) {
      const { agentId, lat, lng, areaLabel, updatedAt } = action.payload;
      const agent = state.agents.find((a) => a.id === agentId);
      if (agent) agent.location = { lat, lng, areaLabel, updatedAt };
    },
    applyStatusUpdate(state, action) {
      const { agentId, status } = action.payload;
      const agent = state.agents.find((a) => a.id === agentId);
      if (agent) agent.status = status;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAgentLocations.pending, (state) => { state.status = 'loading'; })
      .addCase(fetchAgentLocations.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.agents = action.payload;
      })
      .addCase(fetchAgentLocations.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload; });
  },
});

export const { applyLocationUpdate, applyStatusUpdate } = trackingSlice.actions;
export default trackingSlice.reducer;
