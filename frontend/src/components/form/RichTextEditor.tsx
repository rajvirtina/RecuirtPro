/**
 * RichTextEditor — Tiptap v2 wrapper.
 *
 * Required packages (run before using):
 *   npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-placeholder
 */
import React, { useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { clsx } from 'clsx';

// ─── Toolbar ─────────────────────────────────────────────────────────────────

function ToolBtn({
  onClick, active, title, children,
}: {
  onClick: () => void;
  active: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // Use mousedown (not click) so the editor doesn't lose focus
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={clsx(
        'p-1.5 rounded transition-colors text-sm select-none',
        active
          ? 'bg-primary-100 text-primary-700'
          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-neutral-200 mx-0.5" aria-hidden="true" />;
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div
      className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-neutral-200 bg-neutral-50 rounded-t-lg"
      aria-label="Text formatting toolbar"
    >
      {/* Headings */}
      <ToolBtn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <span className="font-bold text-xs w-5 block text-center">H2</span>
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        <span className="font-bold text-xs w-5 block text-center">H3</span>
      </ToolBtn>

      <Divider />

      {/* Inline marks */}
      <ToolBtn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold (Ctrl+B)"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 4v16h7a5 5 0 003.53-8.53A5 5 0 0013 4H6zm3 3h4a2 2 0 010 4H9V7zm0 7h4.5a2.5 2.5 0 010 5H9v-5z"/>
        </svg>
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic (Ctrl+I)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <line x1="19" y1="4" x2="10" y2="4" />
          <line x1="14" y1="20" x2="5"  y2="20" />
          <line x1="15" y1="4" x2="9"  y2="20" />
        </svg>
      </ToolBtn>

      <Divider />

      {/* Lists */}
      <ToolBtn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Numbered List"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-2-2-2"/>
        </svg>
      </ToolBtn>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface RichTextEditorProps {
  content:      string;
  onChange:     (html: string) => void;
  placeholder?: string;
  label?:       React.ReactNode;
  hint?:        string;
  error?:       string;
  minHeight?:   number;
  className?:   string;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start writing…',
  label,
  hint,
  error,
  minHeight = 160,
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      // Empty Tiptap document serializes as '<p></p>' — normalize to ''
      const html = editor.getHTML();
      onChange(html === '<p></p>' ? '' : html);
    },
    editorProps: {
      attributes: {
        class: 'prose-editor outline-none',
      },
    },
  });

  // Load initial content when editing an existing job (runs once on mount)
  useEffect(() => {
    if (editor && content && editor.getHTML() !== content) {
      editor.commands.setContent(content, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]); // intentionally only when editor becomes available

  const EDITOR_ID = label
    ? `rte-${label.toLowerCase().replace(/\s+/g, '-')}`
    : 'rich-text-editor';

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={EDITOR_ID}
          className="block text-sm font-medium text-neutral-700 mb-1.5"
        >
          {label}
        </label>
      )}

      {/* Scoped styles for ProseMirror content */}
      <style>{`
        .tiptap-shell .ProseMirror {
          outline: none;
          min-height: ${minHeight}px;
          padding: 12px;
          font-size: 0.875rem;
          color: #0a0a0f;
          line-height: 1.625;
        }
        .tiptap-shell .ProseMirror p { margin-bottom: 0.5rem; }
        .tiptap-shell .ProseMirror h2 {
          font-size: 1.1rem; font-weight: 700;
          margin: 0.875rem 0 0.375rem;
          color: #0a0a0f;
        }
        .tiptap-shell .ProseMirror h3 {
          font-size: 1rem; font-weight: 600;
          margin: 0.625rem 0 0.25rem;
        }
        .tiptap-shell .ProseMirror ul,
        .tiptap-shell .ProseMirror ol {
          padding-left: 1.5rem;
          margin-bottom: 0.5rem;
        }
        .tiptap-shell .ProseMirror ul  { list-style-type: disc; }
        .tiptap-shell .ProseMirror ol  { list-style-type: decimal; }
        .tiptap-shell .ProseMirror li  { margin-bottom: 0.2rem; }
        .tiptap-shell .ProseMirror strong { font-weight: 700; }
        .tiptap-shell .ProseMirror em     { font-style: italic; }
        /* Placeholder */
        .tiptap-shell .ProseMirror.is-editor-empty:first-child::before,
        .tiptap-shell .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
      `}</style>

      <div
        id={EDITOR_ID}
        className={clsx(
          'rounded-lg border bg-white overflow-hidden transition-all duration-150 tiptap-shell',
          error
            ? 'border-error-400 focus-within:ring-2 focus-within:ring-error-400'
            : 'border-neutral-200 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500',
        )}
      >
        {editor && <Toolbar editor={editor} />}
        <EditorContent editor={editor} />
      </div>

      <div className="mt-1">
        {error && <p className="text-xs text-error-600">{error}</p>}
        {!error && hint && <p className="text-xs text-neutral-400">{hint}</p>}
      </div>
    </div>
  );
}
