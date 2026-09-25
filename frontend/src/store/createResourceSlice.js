import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api/axios';

/**
 * Builds a standard CRUD slice for a REST resource.
 * @param {string} name - slice name, e.g. 'properties'
 * @param {string} basePath - API path, e.g. '/properties'
 */
export function createResourceSlice(name, basePath) {
  const fetchAll = createAsyncThunk(`${name}/fetchAll`, async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(basePath, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || `Failed to load ${name}.`);
    }
  });

  const createOne = createAsyncThunk(`${name}/create`, async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post(basePath, payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || `Failed to create ${name}.`);
    }
  });

  const updateOne = createAsyncThunk(`${name}/update`, async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`${basePath}/${id}`, payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || `Failed to update ${name}.`);
    }
  });

  const removeOne = createAsyncThunk(`${name}/remove`, async (id, { rejectWithValue }) => {
    try {
      await api.delete(`${basePath}/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || `Failed to delete ${name}.`);
    }
  });

  const slice = createSlice({
    name,
    initialState: { items: [], total: 0, status: 'idle', error: null },
    reducers: {},
    extraReducers: (builder) => {
      builder
        .addCase(fetchAll.pending, (state) => { state.status = 'loading'; })
        .addCase(fetchAll.fulfilled, (state, action) => {
          state.status = 'succeeded';
          state.items = action.payload.data;
          state.total = action.payload.total ?? action.payload.data.length;
        })
        .addCase(fetchAll.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload; })
        .addCase(createOne.fulfilled, (state, action) => { state.items.unshift(action.payload); })
        .addCase(updateOne.fulfilled, (state, action) => {
          const idx = state.items.findIndex((i) => i.id === action.payload.id);
          if (idx !== -1) state.items[idx] = action.payload;
        })
        .addCase(removeOne.fulfilled, (state, action) => {
          state.items = state.items.filter((i) => i.id !== action.payload);
        });
    },
  });

  return { slice, fetchAll, createOne, updateOne, removeOne };
}
