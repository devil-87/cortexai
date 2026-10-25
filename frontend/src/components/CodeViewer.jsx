import Editor from '@monaco-editor/react'

const languageFor = (fileName = '') => {
  const ext = fileName.split('.').pop().toLowerCase()
  const map = {
    html: 'html',
    css: 'css',
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    md: 'markdown',
  }
  return map[ext] || 'plaintext'
}

// match the panel background (#0d0f14) instead of the default grey
const handleBeforeMount = (monaco) => {
  monaco.editor.defineTheme('panel-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#0d0f14',
      'editorGutter.background': '#0d0f14',
    },
  })
}

export default function CodeViewer({ fileName, code }) {
  return (
    <div className='relative w-full h-full'>
      <div className='absolute inset-0'>
        <Editor
          height='100%'
          theme='panel-dark'
          language={languageFor(fileName)}
          value={code}
          path={fileName}
          beforeMount={handleBeforeMount}
          loading={
            <div className='text-[12px] text-slate-500'>Loading editor...</div>
          }
          options={{
            readOnly: true,
            lineNumbers: 'on',
            minimap: { enabled: false },
            fontSize: 12,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            renderLineHighlight: 'none',
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>
    </div>
  )
}