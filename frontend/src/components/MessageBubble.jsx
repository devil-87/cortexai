import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import CodeBlock from "./CodeBlock";
import "./codeTheme.css";
import { X, ChevronLeft, ChevronRight, Download, ZoomIn } from "lucide-react";

// ---------- Image component (small thumbnail, opens large on click) ----------
const ChatImage = ({ src, alt = "", onOpen, onError }) => {
  const [loaded, setLoaded] = useState(false);

  // <span> (not <div>) because markdown puts images inside <p>
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label="Open image"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.();
        }
      }}
      className="group/img relative inline-block align-top w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 mr-2 mb-2 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] cursor-zoom-in shadow-md shadow-black/30 hover:border-indigo-400/40 transition"
    >
      {!loaded && (
        <span className="absolute inset-0 animate-pulse bg-gradient-to-br from-indigo-500/10 to-violet-700/10" />
      )}

      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={onError}
        className={`h-full w-full object-cover transition duration-300 group-hover/img:scale-105 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Zoom hint on hover (desktop only) */}
      {loaded && (
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 hidden md:flex items-center justify-center w-7 h-7 rounded-full bg-black/50 text-white backdrop-blur-sm opacity-0 group-hover/img:opacity-100 transition">
          <ZoomIn size={14} />
        </span>
      )}
    </span>
  );
};

// ---------- Markdown styles ----------
const baseComponents = {
  p: (props) => <p className="my-2 sm:my-2.5 first:mt-0 last:mb-0" {...props} />,
  ul: (props) => (
    <ul className="list-disc pl-5 my-2.5 space-y-1.5 marker:text-slate-500" {...props} />
  ),
  ol: (props) => (
    <ol className="list-decimal pl-5 my-2.5 space-y-1.5 marker:text-slate-500" {...props} />
  ),
  li: (props) => <li className="pl-1" {...props} />,
  a: (props) => (
    <a
      target="_blank"
      rel="noreferrer"
      className="text-indigo-300 underline underline-offset-2 hover:text-indigo-200 break-all"
      {...props}
    />
  ),
  h1: (props) => (
    <h1 className="text-lg sm:text-xl font-semibold mt-4 sm:mt-5 mb-2 text-slate-100 first:mt-0" {...props} />
  ),
  h2: (props) => (
    <h2
      className="text-base sm:text-lg font-semibold mt-4 sm:mt-5 mb-2 pb-1 border-b border-white/10 text-slate-100 first:mt-0"
      {...props}
    />
  ),
  h3: (props) => (
    <h3 className="text-[15px] sm:text-base font-semibold mt-4 mb-1.5 text-slate-100 first:mt-0" {...props} />
  ),
  strong: (props) => <strong className="font-semibold text-slate-100" {...props} />,
  hr: () => <hr className="my-4 border-white/10" />,
  blockquote: (props) => (
    <blockquote
      className="my-3 border-l-2 border-indigo-400/60 pl-3 text-slate-400 italic"
      {...props}
    />
  ),
  code: (props) => (
    <code
      className="inline-code px-1.5 py-0.5 rounded text-[0.85em] font-mono break-words"
      {...props}
    />
  ),
  pre: CodeBlock,
  table: (props) => (
    <div className="my-3 overflow-x-auto max-w-full">
      <table className="w-full border-collapse text-xs sm:text-sm" {...props} />
    </div>
  ),
  th: (props) => (
    <th
      className="border border-white/10 bg-white/5 px-2 sm:px-3 py-1.5 sm:py-2 text-left font-semibold"
      {...props}
    />
  ),
  td: (props) => (
    <td className="border border-white/10 px-2 sm:px-3 py-1.5 sm:py-2 align-top" {...props} />
  ),
};

const navBtn =
  "absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white backdrop-blur-sm transition cursor-pointer";

const topBtn =
  "flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white backdrop-blur-sm transition cursor-pointer";

// Finds ![alt](url) images inside the markdown text
const MD_IMAGE = /!\[[^\]]*\]\((\S+?)\)/g;

// ---------- Message bubble ----------
const MessageBubble = ({ role, content, images }) => {
  const isUser = role === "user";
  const [openIndex, setOpenIndex] = useState(null); // image open in the viewer
  const [failed, setFailed] = useState([]); // image links that could not load
  const [viewerLoaded, setViewerLoaded] = useState(false);
  const touchStartX = useRef(0);

  const text = typeof content === "string" ? content : "";

  // All images of this message: from the markdown text AND the `images` prop
  const visibleImages = useMemo(() => {
    const fromText = [...text.matchAll(MD_IMAGE)].map((m) => m[1]);
    const fromProp = (Array.isArray(images) ? images : []).map((img) =>
      typeof img === "string" ? img : img?.url,
    );
    return [...new Set([...fromText, ...fromProp])].filter(
      (src) => src && !failed.includes(src),
    );
  }, [text, images, failed]);

  // Images already shown inside the text are not shown twice below it
  const textImages = useMemo(
    () => new Set([...text.matchAll(MD_IMAGE)].map((m) => m[1])),
    [text],
  );
  const extraImages = visibleImages.filter((src) => !textImages.has(src));

  const total = visibleImages.length;
  const current = openIndex !== null ? visibleImages[openIndex] : null;

  const markFailed = useCallback(
    (src) => setFailed((f) => (f.includes(src) ? f : [...f, src])),
    [],
  );

  const close = useCallback(() => setOpenIndex(null), []);
  const next = useCallback(
    () => setOpenIndex((i) => (i === null || total === 0 ? i : (i + 1) % total)),
    [total],
  );
  const prev = useCallback(
    () =>
      setOpenIndex((i) =>
        i === null || total === 0 ? i : (i - 1 + total) % total,
      ),
    [total],
  );

  // Show the spinner again each time the viewer image changes
  useEffect(() => {
    setViewerLoaded(false);
  }, [current]);

  // Keyboard: Esc closes, arrows change image. Page behind does not scroll.
  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = oldOverflow;
    };
  }, [openIndex, close, next, prev]);

  // Markdown images use the ChatImage thumbnail
  const markdownComponents = useMemo(
    () => ({
      ...baseComponents,
      img: ({ src, alt }) => {
        if (!src || failed.includes(src)) return null;
        return (
          <ChatImage
            src={src}
            alt={alt || "Generated image"}
            onOpen={() => {
              const index = visibleImages.indexOf(src);
              if (index !== -1) setOpenIndex(index);
            }}
            onError={() => markFailed(src)}
          />
        );
      },
    }),
    [visibleImages, failed, markFailed],
  );

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative w-fit min-w-0 break-words
        ${
          isUser
            ? "max-w-[88%] sm:max-w-[80%] md:max-w-[72%] px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl rounded-tr-sm text-[13.5px] sm:text-[14px] leading-relaxed bg-gradient-to-br from-indigo-500 to-violet-700 text-white overflow-hidden"
            : "max-w-full sm:max-w-[92%] md:max-w-[85%] px-3.5 sm:px-5 py-3 sm:py-4 rounded-2xl rounded-tl-sm text-[13.5px] sm:text-[14.5px] leading-6 sm:leading-7 text-slate-200 bg-gradient-to-br from-indigo-500/15 to-violet-700/15 border border-indigo-400/20 shadow-[0_2px_12px_rgba(99,102,241,0.08)]"
        }`}
      >
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
          components={markdownComponents}
        >
          {text}
        </Markdown>

        {/* Images that came separately (search results) */}
        {!isUser && extraImages.length > 0 && (
          <div className="flex flex-wrap mt-3">
            {extraImages.map((src) => (
              <ChatImage
                key={src}
                src={src}
                onOpen={() => setOpenIndex(visibleImages.indexOf(src))}
                onError={() => markFailed(src)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Large image viewer with blurred background */}
      {current &&
        createPortal(
          <div
            onClick={close}
            onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              const dx = e.changedTouches[0].clientX - touchStartX.current;
              if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
            }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-6"
          >
            <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-2 z-10">
              <a
                href={current}
                target="_blank"
                rel="noreferrer"
                aria-label="Open image in new tab"
                onClick={(e) => e.stopPropagation()}
                className={topBtn}
              >
                <Download size={18} />
              </a>
              <button
                type="button"
                aria-label="Close image"
                onClick={(e) => {
                  e.stopPropagation();
                  close();
                }}
                className={topBtn}
              >
                <X size={20} />
              </button>
            </div>

            {total > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={(e) => {
                    e.stopPropagation();
                    prev();
                  }}
                  className={`${navBtn} left-2 sm:left-4 md:left-8`}
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={(e) => {
                    e.stopPropagation();
                    next();
                  }}
                  className={`${navBtn} right-2 sm:right-4 md:right-8`}
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}

            {/* Spinner while the big image loads */}
            {!viewerLoaded && (
              <div className="absolute w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            )}

            <img
              key={current}
              src={current}
              alt=""
              referrerPolicy="no-referrer"
              onLoad={() => setViewerLoaded(true)}
              onClick={(e) => e.stopPropagation()}
              className={`max-h-[85vh] sm:max-h-[90vh] max-w-[94vw] sm:max-w-[90vw] rounded-xl object-contain shadow-2xl transition-opacity duration-200 ${
                viewerLoaded ? "opacity-100" : "opacity-0"
              }`}
            />

            {total > 1 && (
              <div className="absolute bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white text-xs backdrop-blur-sm">
                {openIndex + 1} / {total}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};

export default MessageBubble;