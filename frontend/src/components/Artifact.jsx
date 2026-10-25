import {
  PanelRightClose,
  PanelRightOpen,
  Code2,
  Copy,
  Check,
  Eye,
  Maximize2,
  X,
} from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSelector } from 'react-redux'
import { motion } from 'motion/react'
import CodeViewer from './CodeViewer'

const OPEN_WIDTH = 350
const CLOSED_WIDTH = 48

// merge index.html + style.css + script.js into one page for the preview iframe
const buildPreview = (files) => {
  const list = Array.isArray(files) ? files : []
  const get = (name) => list.find((f) => f.name === name)?.content || ''
  const css = get('style.css')
  const js = get('script.js')
  let doc = get('index.html')

  const cssLink = /<link[^>]*href=["']style\.css["'][^>]*>/i
  const jsTag = /<script[^>]*src=["']script\.js["'][^>]*>\s*<\/script>/i

  // function replacers, so "$" inside the code is never treated as a special pattern
  doc = cssLink.test(doc)
    ? doc.replace(cssLink, () => `<style>${css}</style>`)
    : `<style>${css}</style>${doc}`

  doc = jsTag.test(doc)
    ? doc.replace(jsTag, () => `<script>${js}</script>`)
    : `${doc}<script>${js}</script>`

  return doc
}

const Artifact = () => {
  const [collapsed, setCollapsed] = useState(false)
  const [tab, setTab] = useState('code') // 'code' | 'preview'
  const [activeFile, setActiveFile] = useState(0)
  const [copied, setCopied] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const { artifacts } = useSelector((state) => state.message)

  // show the most recent artifact
  const latest = Array.isArray(artifacts)
    ? artifacts[artifacts.length - 1]
    : undefined
  const files = Array.isArray(latest?.files) ? latest.files : []
  const title = latest?.title || 'Generated Code'
  const currentFile = files[activeFile] ?? files[0]

  const previewDoc = useMemo(() => buildPreview(latest?.files), [latest])

  // a new artifact starts on its first file
  useEffect(() => {
    setActiveFile(0)
  }, [latest?.id])

  // Escape closes the full screen preview
  useEffect(() => {
    if (!fullscreen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fullscreen])

  // nothing generated yet: show no panel (all hooks are above this line)
  if (!Array.isArray(artifacts) || artifacts.length === 0) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentFile?.content || '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  const toggleClass = (active) =>
    `flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors duration-150 border-none cursor-pointer ${
      active
        ? 'bg-indigo-500 text-white'
        : 'bg-transparent text-slate-500 hover:text-slate-200'
    }`

  return (
    <>
      <motion.div
        initial={{ width: OPEN_WIDTH }}
        animate={{ width: collapsed ? CLOSED_WIDTH : OPEN_WIDTH }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className='hidden lg:flex h-full border-l border-white/[0.06] flex-col overflow-hidden shrink-0'
      >
        {!collapsed ? (
          // ---------- EXPANDED ----------
          <div
            className='flex flex-col h-full bg-[#0d0f14] shrink-0'
            style={{ width: OPEN_WIDTH }}
          >
            {/* Header: collapse + icon + title + copy + Code/Preview toggle */}
            <div className='h-14 px-3 border-b border-white/[0.06] flex items-center gap-2 shrink-0'>
              <button
                type='button'
                aria-label='Close artifact panel'
                className='flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors duration-150 bg-transparent border-none cursor-pointer shrink-0'
                onClick={() => setCollapsed(true)}
              >
                <PanelRightClose size={16} />
              </button>

              <div className='flex items-center gap-2 flex-1 min-w-0'>
                <div className='flex items-center justify-center w-6 h-6 rounded-md bg-indigo-500/10 border border-indigo-500/20 shrink-0'>
                  <Code2 className='text-indigo-400' size={12} />
                </div>
                <div
                  title={title}
                  className='text-[13px] font-medium text-slate-200 truncate'
                >
                  {title}
                </div>
              </div>

              <div className='flex items-center gap-1 shrink-0'>
                <button
                  type='button'
                  aria-label='Copy code'
                  title={currentFile ? `Copy ${currentFile.name}` : 'Copy'}
                  onClick={handleCopy}
                  className='flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] rounded-lg transition-colors duration-150 bg-transparent border-none cursor-pointer'
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>

              <div className='flex items-center gap-1 bg-white/[0.04] border border-white/[0.06] p-1 rounded-lg shrink-0'>
                <button
                  type='button'
                  onClick={() => setTab('code')}
                  className={toggleClass(tab === 'code')}
                >
                  <Code2 size={11} /> Code
                </button>
                <button
                  type='button'
                  onClick={() => setTab('preview')}
                  className={toggleClass(tab === 'preview')}
                >
                  <Eye size={11} /> Preview
                </button>
              </div>
            </div>

            {/* File tabs (Code view only) */}
            {tab === 'code' && (
              <div className='flex border-b border-white/[0.06] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0'>
                {files.map((f, index) => (
                  <button
                    key={f.name}
                    type='button'
                    onClick={() => setActiveFile(index)}
                    className={`px-4 py-2.5 text-[11px] font-medium whitespace-nowrap transition-colors duration-150 border-r border-white/[0.05] relative cursor-pointer bg-transparent ${
                      activeFile === index
                        ? 'text-indigo-400'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {f.name}
                    {activeFile === index && (
                      <div className='absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-t-full' />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Preview bar with the Full screen button (Preview view only) */}
            {tab === 'preview' && (
              <div className='h-9 px-3 border-b border-white/[0.06] flex items-center justify-between shrink-0'>
                <span className='text-[11px] text-slate-500'>Live preview</span>
                <button
                  type='button'
                  onClick={() => setFullscreen(true)}
                  className='flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] rounded-md transition-colors duration-150 bg-transparent border-none cursor-pointer'
                >
                  <Maximize2 size={12} /> Full screen
                </button>
              </div>
            )}

            {/* Content */}
            <div className='flex-1 min-h-0'>
              {tab === 'code' ? (
                currentFile ? (
                  <CodeViewer
                    fileName={currentFile.name}
                    code={currentFile.content || ''}
                  />
                ) : (
                  <div className='p-4 text-[12px] text-slate-500'>No files.</div>
                )
              ) : (
                <iframe
                  title='Preview'
                  sandbox='allow-scripts'
                  srcDoc={previewDoc}
                  className='w-full h-full bg-white border-none'
                />
              )}
            </div>
          </div>
        ) : (
          // ---------- COLLAPSED: icon button + vertical title ----------
          <div className='flex flex-col items-center w-full h-full bg-[#0d0f14] py-4 gap-3'>
            <button
              type='button'
              aria-label='Open artifact panel'
              className='flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors duration-150 bg-transparent border-none cursor-pointer shrink-0'
              onClick={() => setCollapsed(false)}
            >
              <PanelRightOpen size={16} />
            </button>

            <div className='flex-1 min-h-0 overflow-hidden'>
              <div
                title={title}
                className='max-h-full overflow-hidden text-ellipsis text-[10px] font-medium text-slate-600 tracking-widest uppercase whitespace-nowrap'
                style={{
                  writingMode: 'vertical-lr',
                  transform: 'rotate(180deg)',
                }}
              >
                {title}
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* ---------- FULL SCREEN PREVIEW (drawn on top of the whole page) ---------- */}
      {fullscreen &&
        createPortal(
          <div className='fixed inset-0 z-50 flex flex-col bg-[#0d0f14]'>
            <div className='h-12 px-4 border-b border-white/[0.06] flex items-center justify-between shrink-0'>
              <div className='flex items-center gap-2 min-w-0'>
                <div className='flex items-center justify-center w-6 h-6 rounded-md bg-indigo-500/10 border border-indigo-500/20 shrink-0'>
                  <Code2 className='text-indigo-400' size={12} />
                </div>
                <span className='text-[13px] font-medium text-slate-200 truncate'>
                  {title}
                </span>
              </div>

              <div className='flex items-center gap-3 shrink-0'>
                <span className='hidden sm:block text-[11px] text-slate-500'>
                  Press Esc to close
                </span>
                <button
                  type='button'
                  aria-label='Close full screen'
                  onClick={() => setFullscreen(false)}
                  className='flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] transition-colors duration-150 bg-transparent border-none cursor-pointer'
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <iframe
              title='Full screen preview'
              sandbox='allow-scripts'
              srcDoc={previewDoc}
              className='flex-1 w-full bg-white border-none'
            />
          </div>,
          document.body,
        )}
    </>
  )
}

export default Artifact