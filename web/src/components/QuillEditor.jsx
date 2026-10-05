import { useEffect, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

// Same toolbar and Quill version (1.3.7) as the PMS editor, so the HTML round-trips unchanged.
const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['blockquote', 'code-block'],
  ['link'],
  ['clean'],
];

// Uncontrolled: `value` seeds the editor once; onChange gets HTML ('' when empty).
export default function QuillEditor({ value, onChange, placeholder, disabled, ariaLabel }) {
  const hostRef = useRef(null);
  const quillRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const host = hostRef.current;
    const quill = new Quill(host.appendChild(document.createElement('div')), {
      theme: 'snow',
      placeholder,
      modules: { toolbar: TOOLBAR },
    });
    if (value) quill.clipboard.dangerouslyPasteHTML(value, 'silent');
    quill.root.setAttribute('aria-label', ariaLabel ?? 'Description');
    quill.on('text-change', () => {
      onChangeRef.current(quill.getText().trim() ? quill.root.innerHTML : '');
    });
    quillRef.current = quill;
    return () => {
      quillRef.current = null;
      host.innerHTML = ''; // drop the toolbar and editor Quill added
    };
  }, []); // seeded once; later value changes come from the editor itself

  useEffect(() => {
    quillRef.current?.enable(!disabled);
  }, [disabled]);

  return <div className="rich-editor" ref={hostRef} />;
}
