import Link from "next/link";

export default function SigningLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Simple Header */}
      <header className="border-b bg-background">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <span className="text-xs font-bold text-primary-foreground">G</span>
            </div>
            <span className="text-base font-semibold">Geek Sign</span>
          </Link>
          <p className="text-sm text-muted-foreground">
            Secure Document Signing
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Simple Footer */}
      <footer className="border-t bg-background mt-auto">
        <div className="container py-4">
          <p className="text-xs text-center text-muted-foreground">
            Powered by Geek Sign • Legally Compliant Electronic Signatures •{" "}
            <a href="/terms" className="hover:underline">Terms</a> •{" "}
            <a href="/privacy" className="hover:underline">Privacy</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
