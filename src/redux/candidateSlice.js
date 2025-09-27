import { createSlice } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

const initialState = [];

const slice = createSlice({
  name: 'candidates',
  initialState,
  reducers: {
    addOrUpdateCandidate: (state, action) => {
      const cand = action.payload;
      const idx = state.findIndex(c => c.id === cand.id);
      if (idx >= 0) state[idx] = { ...state[idx], ...cand };
      else state.push({ ...cand, id: cand.id || uuidv4() });
    },
    removeCandidate: (state, action) => state.filter(c => c.id !== action.payload),
    clearCandidates: () => []
  }
});

export const { addOrUpdateCandidate, removeCandidate, clearCandidates } = slice.actions;
export default slice.reducer;
