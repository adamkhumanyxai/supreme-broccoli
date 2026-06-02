import { createFileRoute, Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/wordmark";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
});

function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-4 md:px-12">
        <Wordmark />
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Home
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 md:px-12 md:py-20">
        <h1 className="font-serif text-4xl text-foreground">Privacy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: May 2026</p>

        <div className="prose prose-invert prose-zinc mt-10 max-w-none">
          <p>
            Interview Compass exists to help you prepare for interviews. Your data is yours. We do
            not sell it, share it with third parties, or use it to train models.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>Your name, headline, domain, role preferences, and "superpowers" notes</li>
            <li>Your resume (PDF and parsed text)</li>
            <li>Job descriptions you paste in</li>
            <li>AI-generated company insights tied to those jobs</li>
            <li>Mock interview transcripts (and audio recordings if you use voice mode)</li>
            <li>Take-home projects you create</li>
          </ul>

          <h2>What we do with it</h2>
          <p>
            We send relevant context (your profile, the job description, the company dossier) to
            Google Gemini via the Lovable AI Gateway when you generate a dossier, run a mock, or
            draft a project section. We store the outputs in a Supabase Postgres database, and we
            store audio recordings in Supabase Storage with row-level security so only you can
            access yours.
          </p>

          <h2>Your controls</h2>
          <ul>
            <li>
              <strong>Retention.</strong> You can configure how long voice recordings and
              transcripts are kept. Defaults: recordings 90 days, transcripts 365 days.
            </li>
            <li>
              <strong>Export.</strong> Download a JSON archive of all your data from Settings →
              Privacy &amp; Data.
            </li>
            <li>
              <strong>Delete.</strong> Delete your account and all associated data from Settings.
              Deletion is immediate and irreversible.
            </li>
          </ul>

          <h2>Where it lives</h2>
          <p>
            App + database: Supabase (Postgres, Storage, Auth). AI processing: Google Gemini via the
            Lovable AI Gateway. We do not transmit your data to other third parties.
          </p>

          <h2>Questions</h2>
          <p>Email us. We're a small team and read every message.</p>
        </div>
      </main>
    </div>
  );
}
