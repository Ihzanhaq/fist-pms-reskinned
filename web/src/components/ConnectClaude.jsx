import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ListChecks,
  MessageSquare,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

const FEATURES = [
  { icon: ListChecks, title: 'See your issues', text: 'Ask what’s open, overdue, or in a project — Claude lists and summarises them.' },
  { icon: Search, title: 'Read full details', text: 'Descriptions, comments, sub-issues, attachments and activity for any of your issues.' },
  { icon: RefreshCw, title: 'Update status & priority', text: 'Move issues between statuses or change priority in plain words.' },
  { icon: UserRound, title: 'Reassign', text: 'Assign an issue to a teammate, to yourself, or leave it unassigned.' },
  { icon: MessageSquare, title: 'Comment', text: 'Post updates on an issue as yourself, drafted with Claude’s help.' },
  { icon: PlusCircle, title: 'Create issues', text: 'Create issues and sub-issues with status, priority, assignee, labels and dates.' },
];

const STEPS = [
  {
    title: 'Download the extension',
    text: 'One small file, fist-pms.mcpb, that contains everything needed. No other install.',
    download: true,
  },
  {
    title: 'Open Claude Desktop settings',
    text: (
      <>
        In the <strong>Claude Desktop</strong> app go to <kbd>Settings</kbd> → <kbd>Extensions</kbd> →{' '}
        <kbd>Advanced settings</kbd>.
      </>
    ),
  },
  {
    title: 'Install the file',
    text: (
      <>
        Under <em>Extension Developer</em> click <kbd>Install Extension…</kbd>, choose <code>fist-pms.mcpb</code>, and
        confirm. A note that it isn’t from the public directory is expected — it’s FIST’s own extension.
      </>
    ),
  },
  {
    title: 'Ask Claude and sign in once',
    text: (
      <>
        Start a new chat and ask <em>“What are my PMS issues?”</em>. The first time, a sign-in window opens (Edge on
        Windows, Chrome on Mac) — log in with your FIST account, then ask again.
      </>
    ),
  },
];

const PROMPTS = [
  'What are my overdue PMS issues?',
  'Summarise the comments on BMS-2',
  'Move BMS-2 to In progress',
  'Assign SCALAR360-100 to me and set priority to high',
  'Create an issue in Scalar 360: "Fix invoice rounding", priority high, assign to me',
  'Add a comment to BMS-2: backend work starts Monday',
];

function CopyPrompt({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button className="prompt-chip" onClick={copy} title="Copy">
      <span>“{text}”</span>
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

// Both download buttons share one download. The first download on an install
// builds the file on the server, so the bar is indeterminate until the
// response starts, then shows real progress.
function useExtensionDownload() {
  const [state, setState] = useState({ busy: false, progress: null, error: null });
  const start = async () => {
    setState({ busy: true, progress: null, error: null });
    try {
      const res = await fetch('/api/extension');
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Download failed');
      const total = Number(res.headers.get('content-length')) || 0;
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total) setState((s) => ({ ...s, progress: received / total }));
      }
      const url = URL.createObjectURL(new Blob(chunks));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fist-pms.mcpb';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setState({ busy: false, progress: null, error: null });
    } catch (err) {
      setState({ busy: false, progress: null, error: err.message || 'Download failed' });
    }
  };
  return { ...state, start };
}

function DownloadButton({ download, className, iconSize, label }) {
  const { busy, progress, error, start } = download;
  return (
    <div className="download-wrap">
      <button className={className} onClick={start} disabled={busy}>
        <Download size={iconSize} /> {busy ? 'Preparing…' : label}
      </button>
      {busy && (
        <div
          className={`download-progress${progress == null ? ' indeterminate' : ''}`}
          role="progressbar"
          aria-label="Downloading extension"
          aria-valuenow={progress == null ? undefined : Math.round(progress * 100)}
        >
          <span style={progress == null ? undefined : { width: `${progress * 100}%` }} />
        </div>
      )}
      {error && <p className="download-error">{error}</p>}
    </div>
  );
}

export default function ConnectClaude() {
  const download = useExtensionDownload();
  return (
    <div className="connect">
      <section className="connect-hero">
        <div>
          <h2>Use FIST PMS from Claude</h2>
          <p>
            Install this extension in Claude Desktop to check, update and create PMS issues from a chat. It uses your
            own PMS login and works on any Claude plan.
          </p>
        </div>
        <DownloadButton download={download} className="primary-btn hero-btn" iconSize={16} label="Download extension" />
      </section>

      <section className="connect-section">
        <h3>What it can do</h3>
        <div className="feature-grid">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div className="feature-card" key={title}>
              <span className="feature-icon">
                <Icon size={18} />
              </span>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="connect-section">
        <h3>Set it up in 4 steps</h3>
        <ol className="steps">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <span className="step-num">{i + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
                {step.download && (
                  <DownloadButton download={download} className="secondary-btn step-btn" iconSize={15} label="Download" />
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="connect-section">
        <h3>Try asking</h3>
        <p className="section-note">Click to copy, then paste into Claude.</p>
        <div className="prompt-list">
          {PROMPTS.map((p) => (
            <CopyPrompt key={p} text={p} />
          ))}
        </div>
      </section>

      <section className="connect-section two-col">
        <div className="info-card">
          <h4>
            <CheckCircle2 size={17} /> You’ll need
          </h4>
          <ul>
            <li>The Claude Desktop app (Windows or Mac)</li>
            <li>Microsoft Edge (Windows) or Google Chrome (Mac) for signing in</li>
            <li>Your own FIST PMS account</li>
          </ul>
        </div>
        <div className="info-card">
          <h4>
            <ShieldCheck size={17} /> Safe by design
          </h4>
          <ul>
            <li>Claude asks for your OK before changing anything</li>
            <li>Your password is typed only into the FIST sign-in page</li>
            <li>
              Your session stays on your computer in <code>.fist-pms-dashboard</code> — never share that folder
            </li>
          </ul>
        </div>
      </section>


    </div>
  );
}
