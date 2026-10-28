import { createSlice } from "@reduxjs/toolkit";

const userSlice = createSlice({
  name: "user",
  initialState: {
    userData: null,
    loading: true, // true until the first /api/me check finishes
  },
  reducers: {
    setUserdata: (state, action) => {
      state.userData = action.payload;
      state.loading = false;
    },
    // ADDED: update only the credits, so the Billing drawer changes without a refresh
    setCredits: (state, action) => {
      if (state.userData) state.userData.credits = action.payload;
    },
  },
});

export const { setUserdata, setCredits } = userSlice.actions;
export default userSlice.reducer;