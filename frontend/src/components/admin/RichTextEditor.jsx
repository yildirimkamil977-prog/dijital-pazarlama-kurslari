import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { Bold, Italic, Underline as U, Heading2, Heading3, Heading4, List, ListOrdered, Quote, Link2, AlignLeft, AlignCenter, Undo2, Redo2, RemoveFormatting, Minus } from "lucide-react";

const shiftHeadings = (html) => html.replace(/<(\/?)h1(\s|>)/gi, "<$1h2$2");

const Btn = ({ on, active, title, children }) => (
  <button type="button" title={title} onMouseDown={(e) => { e.preventDefault(); on(); }}
    className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors duration-150 ${active ? "bg-gold text-ink" : "text-muted-foreground hover:text-foreground hover:bg-white/10"}`}>{children}</button>
);

export default function RichTextEditor({ value, onChange, testId = "rich-editor" }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value || "",
    editorProps: { transformPastedHTML: shiftHeadings, attributes: { class: "rich-content min-h-[260px] max-h-[600px] overflow-y-auto px-5 py-4 focus:outline-none", "data-testid": testId } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });
  if (!editor) return null;
  const c = () => editor.chain().focus();
  const setLink = () => {
    const prev = editor.getAttributes("link").href || "";
    const url = window.prompt("Link adresi", prev);
    if (url === null) return;
    url ? c().extendMarkRange("link").setLink({ href: url }).run() : c().unsetLink().run();
  };
  return (
    <div className="bg-ink border border-white/10 rounded-xl overflow-hidden">
      <div className="flex flex-wrap gap-0.5 p-1.5 border-b border-white/10 bg-ink-surface" data-testid={`${testId}-toolbar`}>
        <Btn title="Başlık 2" on={() => c().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}><Heading2 className="w-4 h-4" /></Btn>
        <Btn title="Başlık 3" on={() => c().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}><Heading3 className="w-4 h-4" /></Btn>
        <Btn title="Başlık 4" on={() => c().toggleHeading({ level: 4 }).run()} active={editor.isActive("heading", { level: 4 })}><Heading4 className="w-4 h-4" /></Btn>
        <span className="w-px bg-white/10 mx-1" />
        <Btn title="Kalın" on={() => c().toggleBold().run()} active={editor.isActive("bold")}><Bold className="w-4 h-4" /></Btn>
        <Btn title="İtalik" on={() => c().toggleItalic().run()} active={editor.isActive("italic")}><Italic className="w-4 h-4" /></Btn>
        <Btn title="Altı çizili" on={() => c().toggleUnderline().run()} active={editor.isActive("underline")}><U className="w-4 h-4" /></Btn>
        <Btn title="Link" on={setLink} active={editor.isActive("link")}><Link2 className="w-4 h-4" /></Btn>
        <span className="w-px bg-white/10 mx-1" />
        <Btn title="Madde listesi" on={() => c().toggleBulletList().run()} active={editor.isActive("bulletList")}><List className="w-4 h-4" /></Btn>
        <Btn title="Numaralı liste" on={() => c().toggleOrderedList().run()} active={editor.isActive("orderedList")}><ListOrdered className="w-4 h-4" /></Btn>
        <Btn title="Alıntı" on={() => c().toggleBlockquote().run()} active={editor.isActive("blockquote")}><Quote className="w-4 h-4" /></Btn>
        <Btn title="Ayırıcı çizgi" on={() => c().setHorizontalRule().run()}><Minus className="w-4 h-4" /></Btn>
        <Btn title="Sola hizala" on={() => c().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })}><AlignLeft className="w-4 h-4" /></Btn>
        <Btn title="Ortala" on={() => c().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })}><AlignCenter className="w-4 h-4" /></Btn>
        <span className="w-px bg-white/10 mx-1" />
        <Btn title="Biçimi temizle" on={() => c().unsetAllMarks().clearNodes().run()}><RemoveFormatting className="w-4 h-4" /></Btn>
        <Btn title="Geri al" on={() => c().undo().run()}><Undo2 className="w-4 h-4" /></Btn>
        <Btn title="Yinele" on={() => c().redo().run()}><Redo2 className="w-4 h-4" /></Btn>
      </div>
      <EditorContent editor={editor} />
      <p className="text-[11px] text-muted-foreground px-4 py-2 border-t border-white/5">Google Docs'tan kopyala-yapıştır yapabilirsin; başlık, kalın, liste ve boşluklar korunur.</p>
    </div>
  );
}
