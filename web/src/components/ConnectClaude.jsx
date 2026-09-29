import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ListChecks,
  Lock,
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

export default function ConnectClaude() {
  return (
    <div className="connect">
      <section className="connect-hero">
        <div>
          <span className="eyebrow">Claude Desktop extension</span>
          <h2>Manage FIST PMS by just asking Claude</h2>
          <p>
            Check what’s due, move issues along, comment and create new work — in plain language, from a Claude
            chat. Works with your own PMS login, on every Claude plan including Free.
          </p>
          <a className="primary-btn hero-btn" href="/api/extension" download="fist-pms.mcpb">
            <Download size={17} /> Download fist-pms.mcpb
          </a>
        </div>
        <div className="hero-chat" aria-hidden="true">
          <div className="bubble user">What’s overdue for me in PMS?</div>
          <div className="bubble claude">
            You have 2 overdue issues:
            <br />• <strong>BMS-1</strong> Complete Screen Development — due 11 Sep
            <br />• <strong>BMS-2</strong> Scope Rework — due 23 Sep
          </div>
          <div className="bubble user">Move BMS-2 to In progress</div>
          <div className="bubble claude">
            <CheckCircle2 size={14} /> BMS-2 moved from New to In progress.
          </div>
        </div>
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
                  <a className="secondary-btn step-btn" href="/api/extension" download="fist-pms.mcpb">
                    <Download size={15} /> Download
                  </a>
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

      <section className="connect-section">
        <h3>Good to know</h3>
        <div className="faq">
          <details>
            <summary>Can I use it on my phone?</summary>
            <p>
              Not directly — the extension runs in Claude Desktop on your computer. On Pro plans and above you can
              drive a desktop session from the Claude mobile app (Remote Control). Full mobile support would need an
              official PMS API.
            </p>
          </details>
          <details>
            <summary>Why can’t Claude find an issue by its key?</summary>
            <p>
              Keys are looked up among <em>your</em> issues. For someone else’s issue, paste its PMS link into the chat
              instead.
            </p>
          </details>
          <details>
            <summary>Can it upload attachments?</summary>
            <p>Not from Claude. Use the New issue form in this dashboard, or the PMS itself.</p>
          </details>
          <details>
            <summary>How do I sign out or switch accounts?</summary>
            <p>
              Delete the <code>.fist-pms-dashboard</code> folder in your user folder. The next request opens a fresh
              sign-in window.
            </p>
          </details>
          <details>
            <summary>How do I update to a new version?</summary>
            <p>Download the new file from this page and install it the same way; it replaces the old one.</p>
          </details>
        </div>
      </section>

      <p className="connect-foot">
        <Lock size={13} /> Unofficial tool — it reads the PMS pages the same way your browser does. If the PMS layout
        changes, it may need an update.
      </p>
    </div>
  );
}
