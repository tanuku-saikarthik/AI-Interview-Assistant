import { createSlice } from "@reduxjs/toolkit";
const initialState = {
  activeCandidateId: null,
  sessions: {},
};
const slice = createSlice({
  name: "interview",
  initialState,
  reducers: {
    setActiveCandidate: (state, action) => {
      state.activeCandidateId = action.payload;
    },
    initSession: (state, action) => {
      const { id } = action.payload;
      if (!state.sessions[id])
        state.sessions[id] = {
          qas: [],
          questionIndex: 0,
          running: false,
          timer: 0,
          currentQuestion: null,
        };
    },
    updateSession: (state, action) => {
      const { id, patch } = action.payload;
      state.sessions[id] = { ...(state.sessions[id] || {}), ...patch };
    },
    clearSession: (state, action) => {
      delete state.sessions[action.payload];
    },
  },
});
export const { setActiveCandidate, initSession, updateSession, clearSession } =
  slice.actions;
export default slice.reducer;
