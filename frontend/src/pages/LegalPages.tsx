import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link
        to="/welcome"
        className="inline-flex items-center gap-1.5 rounded text-sm text-indigo-300 hover:text-indigo-200"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-neutral-300 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-neutral-100">
        {children}
      </div>
      <p className="mt-10 text-xs text-neutral-500">Last updated: July 22, 2026</p>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy">
      <p>
        MyWebexists to be <em>your</em> memory of the web. That only works if you can
        trust where that memory lives, so here is exactly what happens to your data.
      </p>
      <h2>What we store</h2>
      <p>
        Your account email, and the pages you choose to save: their URL, a snapshot of the
        page as you saw it, the extracted text, and things derived from it (summaries,
        tags, search embeddings). Notes, collections, and favorites you create are stored
        too. Nothing is captured unless you save it.
      </p>
      <h2>What we don't do</h2>
      <p>
        We don't track your browsing, sell data, run ads, or share your library with
        anyone. The extension only touches a page when you click Save, Sweep, or Park.
      </p>
      <h2>AI processing</h2>
      <p>
        Summaries and question-answering send the relevant saved text to Anthropic's API
        to generate the response. Only the pages needed for that request are sent, and
        they aren't used to train models.
      </p>
      <h2>Your data stays yours</h2>
      <p>
        Export your entire library as JSON from the Dashboard at any time. Deleting a page
        deletes its content, snapshot, and search index; deleting your account removes
        everything. The whole stack is open source, so you can also self-host and keep
        every byte on your own infrastructure.
      </p>
      <h2>Contact</h2>
      <p>
        Questions or deletion requests: open an issue on GitHub or email the address on
        the repository.
      </p>
    </LegalShell>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p>
        MyWebis a personal tool for saving and searching web pages you have access to.
        By using it you agree to the following common-sense rules.
      </p>
      <h2>Your account</h2>
      <p>
        You're responsible for your account and for keeping your password safe. You must
        be legally able to agree to these terms where you live.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Save pages for your own personal use. Don't use MyWeb to redistribute copyrighted
        content, to store unlawful material, or to hammer the service with automated
        traffic. We may suspend accounts that abuse the service or harm other users.
      </p>
      <h2>Your content</h2>
      <p>
        Everything you save remains yours. We claim no ownership over your library and
        only process it to provide the product's features to you.
      </p>
      <h2>Service</h2>
      <p>
        MyWebis provided as-is, without warranties. We work to keep it reliable, but
        we can't promise uninterrupted service, and we're not liable for lost data —
        please use the JSON export for anything you can't afford to lose. We may update
        these terms; continued use after changes means acceptance.
      </p>
    </LegalShell>
  );
}
