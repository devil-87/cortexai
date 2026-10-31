import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import {
  X,
  Crown,
  Check,
  Lock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { createOrder } from "../features/createOrder.js";
import { verifyPayment } from "../features/verifyPayment.js";
import getCurrentUser from "../features/getCurrentUser.js";
import { setUserdata } from "../redux/userSlice.js";

// ---------- Plans: edit, add or remove plans here ----------
const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "₹199",
    credits: 500,
    perks: ["500 credits", "Use across all agents"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹499",
    credits: 1000,
    popular: true,
    perks: ["1000 credits", "Use across all agents", "Best for heavy use"],
  },
];

const RAZORPAY_SRC = "https://checkout.razorpay.com/v1/checkout.js";

// Loads the Razorpay script only once, and only when it is really needed
const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector(`script[src="${RAZORPAY_SRC}"]`);
    const script = existing || document.createElement("script");
    script.addEventListener("load", () => resolve(true), { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });
    if (!existing) {
      script.src = RAZORPAY_SRC;
      document.body.appendChild(script);
    }
  });

// ---------- One plan card (memoized, so it only re-renders when its own props change) ----------
const PlanCard = memo(function PlanCard({
  plan,
  index,
  isCurrent,
  loading,
  disabled,
  onSelect,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.06, duration: 0.25 }}
      className={`relative rounded-2xl p-4 border ${
        plan.popular
          ? "border-indigo-500/40 bg-gradient-to-br from-indigo-500/[0.10] to-violet-500/[0.04] shadow-[0_0_24px_rgba(99,102,241,0.12)]"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      {plan.popular && (
        <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase text-white bg-gradient-to-r from-indigo-500 to-violet-600">
          <Sparkles size={10} /> Most popular
        </span>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-white font-semibold text-base">{plan.name}</h3>
          <p className="text-slate-400 text-xs mt-0.5">
            {plan.credits.toLocaleString()} credits
          </p>
        </div>
        <p className="text-white text-2xl font-bold tracking-tight shrink-0">
          {plan.price}
        </p>
      </div>

      <ul className="mt-3 space-y-1.5">
        {plan.perks.map((perk) => (
          <li
            key={perk}
            className="flex items-center gap-2 text-[13px] text-slate-300"
          >
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-500/15 shrink-0">
              <Check size={10} className="text-indigo-300" />
            </span>
            {perk}
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={isCurrent || disabled}
        onClick={() => onSelect(plan.id)}
        className={`mt-4 w-full flex items-center justify-center gap-2 rounded-xl py-3 sm:py-2.5 text-sm font-medium border-none transition-all duration-150 ${
          isCurrent
            ? "bg-white/[0.06] text-slate-400 cursor-default"
            : plan.popular
              ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:opacity-90 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              : "bg-white/10 text-white hover:bg-white/15 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        }`}
      >
        {isCurrent ? (
          "Current plan"
        ) : loading ? (
          <>
            <Loader2 size={15} className="animate-spin" /> Opening checkout...
          </>
        ) : (
          `Upgrade to ${plan.name}`
        )}
      </button>
    </motion.div>
  );
});

const BillingDrawer = ({ open, onClose }) => {
  const dispatch = useDispatch();
  const { userData } = useSelector((state) => state.user);
  const [loadingPlan, setLoadingPlan] = useState(null); // plan id while checkout is starting
  const [status, setStatus] = useState(null); // { type: "success" | "error", message }

  // keep the latest onClose without re-running the effect below on every parent render
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // While the drawer is open: lock page scroll and let Esc close it
  useEffect(() => {
    if (!open) return;

    setStatus(null);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key === "Escape") onCloseRef.current?.();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // success messages disappear on their own
  useEffect(() => {
    if (status?.type !== "success") return;
    const t = setTimeout(() => setStatus(null), 5000);
    return () => clearTimeout(t);
  }, [status]);

  const handleUpgrade = useCallback(
    async (planId) => {
      setStatus(null);
      setLoadingPlan(planId);

      try {
        const loaded = await loadRazorpay();
        if (!loaded) {
          setStatus({
            type: "error",
            message: "Could not load the payment window. Check your internet and try again.",
          });
          setLoadingPlan(null);
          return;
        }

        const orderData = await createOrder(planId);

        if (!orderData?.order?.id) {
          console.error("Order creation failed");
          setStatus({
            type: "error",
            message: "Could not start the payment. Please try again.",
          });
          setLoadingPlan(null);
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

              // Payment verified, so reload the user from the server.
              // The drawer reads userData from Redux, so the new plan and
              // credits show up right away, no page refresh needed.
              const user = await getCurrentUser();
              if (user) dispatch(setUserdata(user));
              setStatus({
                type: "success",
                message: "Payment successful. Your credits have been added.",
              });
            } catch (error) {
              console.log(error);
              setStatus({
                type: "error",
                message:
                  "Payment received, but we could not confirm it yet. Refresh in a minute to see your credits.",
              });
            } finally {
              setLoadingPlan(null);
            }
          },
          modal: {
            // the user closed the payment window without paying
            ondismiss: () => setLoadingPlan(null),
          },
          theme: {
            color: "#4F46E5",
          },
        };

        const razorpay = new window.Razorpay(options);
        razorpay.on("payment.failed", () => {
          setStatus({
            type: "error",
            message: "Payment failed. You were not charged. Please try again.",
          });
          setLoadingPlan(null);
        });
        razorpay.open();
      } catch (error) {
        console.log(error);
        setStatus({
          type: "error",
          message: "Something went wrong. Please try again.",
        });
        setLoadingPlan(null);
      }
    },
    [dispatch],
  );

  // Compute once so the text and the progress bar always agree
  const { credits, totalCredits, percent, level } = useMemo(() => {
    const c = userData?.credits || 0;
    const t = userData?.totalCredits || 100;
    const p = Math.min(100, Math.max(0, (c / t) * 100));
    return {
      credits: c,
      totalCredits: t,
      percent: p,
      level: c <= 0 ? "empty" : p <= 20 ? "low" : "ok",
    };
  }, [userData?.credits, userData?.totalCredits]);

  const barClass = {
    ok: "from-indigo-400 to-violet-500",
    low: "from-amber-400 to-orange-500",
    empty: "from-red-500 to-rose-500",
  }[level];

  const currentPlan = (userData?.plan || "free").toLowerCase();

  // Portal renders the drawer on document.body, so the sidebar's
  // overflow-hidden / z-index can't clip it or trap the overlay.
  // z-[70] / z-[80] keep it above the mobile sidebar (z-50) and the code sheet (z-50).
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="billing-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[70]"
          />

          {/* Drawer: full width on phones, 400px panel on larger screens */}
          <motion.aside
            key="billing-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Billing"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
            className="fixed right-0 top-0 z-[80] h-dvh w-full sm:w-[400px] bg-[#0d0f14] border-l border-white/10 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-white/[0.08] shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shrink-0">
                  <Sparkles size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-white text-base font-semibold leading-tight">
                    Billing
                  </div>
                  <div className="text-slate-500 text-xs">Plans & credits</div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close billing"
                className="w-10 h-10 sm:w-9 sm:h-9 shrink-0 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer border-none transition-colors duration-150"
              >
                <X size={18} className="text-slate-300" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 pt-5 pb-4 space-y-5 [scrollbar-width:thin]">
              {/* Status message */}
              <AnimatePresence initial={false}>
                {status && (
                  <motion.div
                    key={status.type + status.message}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div
                      role="status"
                      className={`flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13px] border ${
                        status.type === "success"
                          ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                          : "bg-red-500/10 border-red-500/25 text-red-300"
                      }`}
                    >
                      {status.type === "success" ? (
                        <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                      )}
                      <span className="flex-1">{status.message}</span>
                      <button
                        type="button"
                        aria-label="Dismiss message"
                        onClick={() => setStatus(null)}
                        className="shrink-0 bg-transparent border-none cursor-pointer text-current opacity-70 hover:opacity-100"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Current plan + credits */}
              <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.14] via-violet-500/[0.07] to-transparent p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-slate-400 text-xs">Current plan</p>
                    <h3 className="text-white text-xl font-bold capitalize truncate mt-0.5">
                      {currentPlan}
                    </h3>
                  </div>
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-yellow-400/10 border border-yellow-400/20 shrink-0">
                    <Crown size={17} className="text-yellow-400" />
                  </div>
                </div>

                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="text-white text-3xl font-bold tracking-tight">
                    {credits.toLocaleString()}
                  </span>
                  <span className="text-slate-400 text-sm">
                    / {totalCredits.toLocaleString()} credits left
                  </span>
                </div>

                <div
                  className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={totalCredits}
                  aria-valuenow={credits}
                >
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${barClass} transition-all duration-500`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                {level !== "ok" && (
                  <p
                    className={`mt-2.5 text-xs ${
                      level === "empty" ? "text-red-300" : "text-amber-300"
                    }`}
                  >
                    {level === "empty"
                      ? "You are out of credits. Pick a plan below to continue."
                      : "Running low on credits. Top up to keep going."}
                  </p>
                )}
              </div>

              {/* Plans */}
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
                  Choose a plan
                </h4>
                <div className="space-y-4 pt-1">
                  {PLANS.map((plan, index) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      index={index}
                      isCurrent={currentPlan === plan.id}
                      loading={loadingPlan === plan.id}
                      disabled={!!loadingPlan}
                      onSelect={handleUpgrade}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-white/[0.08] px-4 sm:px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
              <Lock size={11} />
              Secure payments powered by Razorpay
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default BillingDrawer;