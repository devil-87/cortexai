import React, { useEffect } from "react";
import Home from "./pages/Home.jsx";
import getCurrentUser from "./features/getCurrentUser.js";
import { useDispatch } from "react-redux";
import { setUserdata } from "./redux/userSlice.js";

const App = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const getUser = async () => {
      const data = await getCurrentUser(); // returns null if not logged in
      dispatch(setUserdata(data));         // also sets loading = false
    };
    getUser();
  }, [dispatch]);

  return <Home />;
};

export default App;