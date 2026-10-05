import { lazy, Suspense } from 'react';

// Quill is large, so it loads only when an editor is first shown.
const QuillEditor = lazy(() => import('./QuillEditor.jsx'));

export default function RichEditor(props) {
  return (
    <Suspense fallback={<div className="rich-editor loading" />}>
      <QuillEditor {...props} />
    </Suspense>
  );
}
