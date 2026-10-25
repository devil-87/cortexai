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
  },
});

export const { setUserdata } = userSlice.actions;
export default userSlice.reducer;