import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import { X, Crown } from "lucide-react";
import { createOrder } from "../features/createOrder.js";
import { verifyPayment } from "../features/verifyPayment.js";
import getCurrentUser from "../features/getCurrentUser.js";
import { setUserdata } from "../redux/userSlice.js";

const BillingDrawer = ({ open, onClose }) => {
  const dispatch = useDispatch();
  const { userData } = useSelector((state) => state.user);

  const handleUpgrade = async (plan) => {
    try {
      const orderData = await createOrder(plan);

      if (!orderData?.order?.id) {
        console.error("Order creation failed");
        return;
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: "CortexAI",
        description: `${orderData?.plan?.name} Plan`,
        order_id: orderData.order.id,
        handler: async (response) => {
          try {
            const result = await verifyPayment(response);
            console.log("verify result:", result);

            // ADDED: payment verified, so reload the user from the server.
            // The drawer reads userData from Redux, so the new plan and
            // credits show up right away, no page refresh needed.
            const user = await getCurrentUser();
            if (user) dispatch(setUserdata(user));
          } catch (error) {
            console.log(error);
          }
        },
        theme: {
          color: "#4F46E5",
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.log(error);
    }
  };

  // Compute once so the text and the progress bar always agree
  const credits = userData?.credits || 0;
  const totalCredits = userData?.totalCredits || 100;
  const percent = Math.min(100, Math.max(0, (credits / totalCredits) * 100));

  // Portal renders the drawer on document.body, so the sidebar's
  // overflow-hidden / z-index can't clip it or trap the overlay.
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="billing-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40"
          />

          {/* Drawer */}
          <motion.div
            key="billing-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.25 }}
            className="fixed right-0 top-0 z-50 h-screen w-[380px] max-w-full bg-[#0f1117] border-l border-white/10 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div>
                <div className="text-white text-lg font-semibold">Billing</div>
                <div className="text-slate-400 text-sm">Plans & Credits</div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close billing"
                className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer border-none"
              >
                <X size={18} className="text-slate-300" />
              </button>
            </div>

            {/* Current plan + credits */}
            <div className="p-5">
              <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-slate-400 text-sm">Current Plan</p>
                    <h3 className="text-white text-xl font-bold capitalize">
                      {userData?.plan || "free"}
                    </h3>
                  </div>
                  <Crown className="text-yellow-400" />
                </div>

                <div className="mt-5">
                  <div className="flex justify-between text-xs text-slate-400 mb-2">
                    <span>Credits</span>
                    <span>
                      {credits}/{totalCredits}
                    </span>
                  </div>

                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Plans */}
            <div className="px-5 flex-1 overflow-auto space-y-4">
              <div className="rounded-xl border border-white/10 p-4">
                <h3 className="text-white font-semibold">Starter Plan</h3>
                <p className="text-indigo-400 text-2xl font-bold mt-2">₹199</p>
                <p className="text-slate-400 text-sm mt-1">500 Credits</p>
                <button
                  className="mt-4 w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 py-2 text-white cursor-pointer border-none"
                  onClick={() => handleUpgrade("starter")}
                >
                  Upgrade
                </button>
              </div>

              <div className="rounded-xl border border-white/10 p-4">
                <h3 className="text-white font-semibold">Pro Plan</h3>
                <p className="text-indigo-400 text-2xl font-bold mt-2">₹499</p>
                <p className="text-slate-400 text-sm mt-1">1000 Credits</p>
                <button
                  className="mt-4 w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 py-2 text-white cursor-pointer border-none"
                  onClick={() => handleUpgrade("pro")}
                >
                  Upgrade
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default BillingDrawer;