import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Upload,
  FileSignature,
  Send,
  Shield,
  Clock,
  Users,
  FileText,
  Zap,
  Lock,
  CheckCircle2,
  ArrowRight,
  PenTool,
  FileCheck,
} from "lucide-react";

const features = [
  {
    icon: Upload,
    title: "Easy Upload",
    description: "Upload PDFs in seconds. Drag and drop or browse to select your documents.",
    size: "normal" as const,
  },
  {
    icon: FileSignature,
    title: "Drag & Drop Fields",
    description: "Place signature, initial, date, and text fields exactly where you need them.",
    size: "normal" as const,
  },
  {
    icon: Send,
    title: "Send & Track",
    description: "Send documents to multiple recipients and track signing progress in real-time.",
    size: "featured" as const,
  },
  {
    icon: Shield,
    title: "Legally Binding",
    description: "Compliant with electronic signature laws in Australia, the US, and internationally. Your signatures are legally enforceable.",
    size: "normal" as const,
  },
  {
    icon: Clock,
    title: "Audit Trail",
    description: "Complete audit log with timestamps, IP addresses, and signing history.",
    size: "normal" as const,
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Invite team members, share templates, and work together seamlessly.",
    size: "normal" as const,
  },
];

const howItWorks = [
  {
    step: 1,
    title: "Upload",
    fullTitle: "Upload Your Document",
    description: "Upload any PDF document you need signed. Our system handles files up to 50MB.",
  },
  {
    step: 2,
    title: "Add Fields",
    fullTitle: "Add Recipients & Fields",
    description: "Specify who needs to sign and where. Drag and drop signature fields onto your document.",
  },
  {
    step: 3,
    title: "Send",
    fullTitle: "Send for Signatures",
    description: "Recipients receive an email with a secure link to sign. No account required for signers.",
  },
  {
    step: 4,
    title: "Download",
    fullTitle: "Download Signed Document",
    description: "Once everyone signs, download the completed document with full audit trail.",
  },
];

const useCases = [
  {
    icon: FileText,
    title: "Service Agreements",
    description: "Send client contracts and service agreements for signature without the back-and-forth of printing, scanning, or chasing physical copies.",
  },
  {
    icon: Users,
    title: "HR & Onboarding",
    description: "Get employment contracts, NDAs, and onboarding paperwork signed before day one — from anywhere, on any device.",
  },
  {
    icon: PenTool,
    title: "Proposals & Quotes",
    description: "Turn accepted proposals into signed agreements instantly. Keep deals moving without unnecessary delays.",
  },
];

const faqs = [
  {
    question: "Is Geek Sign legally binding?",
    answer: "Yes! Geek Sign supports legally binding electronic signatures compliant with the Electronic Transactions Act 1999 (Australia), the ESIGN Act and UETA (United States), and applicable laws internationally. Your jurisdiction can be configured in account settings.",
  },
  {
    question: "Do signers need an account?",
    answer: "No, signers don't need to create an account. They receive a secure link via email and can sign documents directly from their browser. Only document senders need a Geek Sign account.",
  },
  {
    question: "What file formats are supported?",
    answer: "Currently, Geek Sign supports PDF documents. You can upload PDFs up to 50MB in size. We're working on adding support for additional formats in the future.",
  },
  {
    question: "How secure are my documents?",
    answer: "We take security seriously. All documents are encrypted in transit and at rest using industry-standard AES-256 encryption. We maintain complete audit trails and never share your documents with third parties.",
  },
  {
    question: "Can I use Geek Sign for free?",
    answer: "Yes! Our free plan includes 3 documents per month with unlimited signatures. It's perfect for occasional use. For higher volumes, check out our Starter and Team plans.",
  },
  {
    question: "What happens after a document expires?",
    answer: "You can set expiration dates for documents. If a document expires before all signatures are collected, it becomes invalid and cannot be signed. You can always send a new signing request.",
  },
];

export default function HomePage() {
  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative bg-warm-gradient">
        {/* Dot pattern overlay */}
        <div className="absolute inset-0 bg-dot-pattern opacity-40" />

        {/* Floating decorative elements */}
        <div className="absolute top-20 left-[10%] opacity-20 animate-float-slow">
          <FileText className="h-16 w-16 text-brand-navy" />
        </div>
        <div className="absolute top-40 right-[15%] opacity-15 animate-float" style={{ animationDelay: "1s" }}>
          <PenTool className="h-12 w-12 text-brand-teal" />
        </div>
        <div className="absolute bottom-32 left-[20%] opacity-10 animate-float" style={{ animationDelay: "2s" }}>
          <FileCheck className="h-10 w-10 text-brand-orange" />
        </div>

        <div className="container relative py-24 md:py-32 lg:py-40">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left side - Content */}
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 border border-brand-teal/20 shadow-sm mb-8 opacity-0 animate-fade-up">
                <span className="flex h-2 w-2 rounded-full bg-brand-teal animate-pulse" />
                <span className="text-sm font-medium text-brand-navy">Built in Australia &middot; Free to start</span>
              </div>

              <h1 className="heading-editorial text-5xl md:text-6xl lg:text-7xl text-brand-navy mb-6 opacity-0 animate-fade-up stagger-1">
                Sign Documents{" "}
                <span className="text-brand-teal italic">Online</span>
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 opacity-0 animate-fade-up stagger-2">
                The simplest way to get documents signed. Upload, add signature fields,
                send to recipients, and track everything in real-time.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-6 opacity-0 animate-fade-up stagger-3">
                <Button size="lg" className="text-base px-8 shadow-teal hover:shadow-teal-lg transition-shadow" asChild>
                  <Link href="/signup">
                    Start Signing Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="text-base px-8 border-brand-navy/20 hover:bg-brand-navy/5" asChild>
                  <Link href="/pricing">View Pricing</Link>
                </Button>
              </div>

              <p className="text-sm text-muted-foreground opacity-0 animate-fade-up stagger-4">
                No credit card required. 3 free documents per month.
              </p>
            </div>

            {/* Right side - Dashboard Preview */}
            <div className="relative opacity-0 animate-slide-in-right stagger-3">
              {/* Background decoration */}
              <div className="absolute -inset-4 bg-gradient-to-br from-brand-teal/10 via-transparent to-brand-navy/5 rounded-3xl" />

              <div className="relative rounded-2xl border border-brand-navy/10 bg-white shadow-teal-lg overflow-hidden">
                {/* Window chrome */}
                <div className="border-b border-brand-navy/5 bg-gradient-to-r from-slate-50 to-white px-4 py-3 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-400" />
                    <div className="h-3 w-3 rounded-full bg-amber-400" />
                    <div className="h-3 w-3 rounded-full bg-emerald-400" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-4 py-1 rounded-md bg-slate-100 text-xs text-muted-foreground">
                      sign.houseofgeeks.online
                    </div>
                  </div>
                </div>

                {/* Dashboard content preview */}
                <div className="aspect-[4/3] bg-gradient-to-br from-slate-50 to-slate-100/50 p-6">
                  <div className="h-full flex flex-col">
                    {/* Mini header */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-brand-teal flex items-center justify-center">
                          <span className="text-xs font-bold text-white">G</span>
                        </div>
                        <div className="h-3 w-20 rounded bg-slate-200" />
                      </div>
                      <div className="flex gap-2">
                        <div className="h-8 w-24 rounded-md bg-brand-teal/10 border border-brand-teal/20" />
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="p-3 rounded-lg bg-white shadow-sm border border-slate-100">
                          <div className="h-2 w-8 rounded bg-slate-200 mb-2" />
                          <div className="h-4 w-12 rounded bg-brand-teal/20" />
                        </div>
                      ))}
                    </div>

                    {/* Document list */}
                    <div className="flex-1 rounded-lg bg-white shadow-sm border border-slate-100 p-4">
                      <div className="h-3 w-24 rounded bg-slate-200 mb-4" />
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex items-center gap-3 p-2 rounded-md bg-slate-50">
                            <div className="h-8 w-8 rounded bg-brand-navy/10 flex items-center justify-center">
                              <FileText className="h-4 w-4 text-brand-navy/40" />
                            </div>
                            <div className="flex-1">
                              <div className="h-2 w-32 rounded bg-slate-200 mb-1" />
                              <div className="h-2 w-20 rounded bg-slate-100" />
                            </div>
                            <div className={`h-5 w-16 rounded-full ${i === 1 ? 'bg-emerald-100' : i === 2 ? 'bg-amber-100' : 'bg-slate-100'}`} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-4 -left-4 px-4 py-2 rounded-xl bg-white shadow-teal border border-brand-teal/20 animate-float" style={{ animationDelay: "0.5s" }}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="text-sm font-medium text-brand-navy">Document signed!</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container py-24 md:py-32">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-brand-teal/10 text-brand-teal text-sm font-medium mb-4">
            Features
          </span>
          <h2 className="heading-editorial text-4xl md:text-5xl text-brand-navy mb-4">
            Everything you need
          </h2>
          <p className="text-lg text-muted-foreground">
            Powerful features that make document signing effortless
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Card
              key={feature.title}
              className="group border border-slate-100 bg-white shadow-sm hover-lift cursor-default"
            >
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-4 transition-colors bg-brand-teal/10 text-brand-teal group-hover:bg-brand-teal group-hover:text-white">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-brand-navy mb-2">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-gradient-to-b from-slate-50 to-white py-24 md:py-32 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand-teal/20 to-transparent" />

        <div className="container relative">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-brand-teal/10 text-brand-teal text-sm font-medium mb-4">
              How It Works
            </span>
            <h2 className="heading-editorial text-4xl md:text-5xl text-brand-navy mb-4">
              Four simple steps
            </h2>
          </div>

          {/* Timeline */}
          <div className="relative max-w-5xl mx-auto">
            {/* Connecting line - desktop */}
            <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-brand-teal/20 via-brand-teal/40 to-brand-teal/20" />

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
              {howItWorks.map((step, index) => (
                <div key={step.step} className="relative group">
                  {/* Step number */}
                  <div className="relative z-10 flex h-24 w-24 mx-auto items-center justify-center rounded-full bg-white border-2 border-brand-teal/30 shadow-sm mb-6 group-hover:border-brand-teal group-hover:shadow-teal transition-all">
                    <span className="text-3xl font-serif italic text-brand-teal">{step.step}</span>
                  </div>

                  {/* Content */}
                  <div className="text-center">
                    <h3 className="text-xl font-semibold text-brand-navy mb-2">{step.fullTitle}</h3>
                    <p className="text-muted-foreground leading-relaxed text-sm">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="container py-16">
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
          {[
            { icon: Shield, text: "Legally Compliant Signatures" },
            { icon: Lock, text: "Secure Cloud Storage" },
            { icon: Zap, text: "Instant Delivery" },
            { icon: CheckCircle2, text: "Complete Audit Trail" },
          ].map((badge, index) => (
            <div key={index} className="flex items-center gap-3 text-muted-foreground group">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-teal/10 group-hover:bg-brand-teal/20 transition-colors">
                <badge.icon className="h-5 w-5 text-brand-teal" />
              </div>
              <span className="text-sm font-medium">{badge.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="container py-24 md:py-32">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-brand-orange/10 text-brand-orange text-sm font-medium mb-4">
            Use Cases
          </span>
          <h2 className="heading-editorial text-4xl md:text-5xl text-brand-navy mb-4">
            Built for real work
          </h2>
          <p className="text-lg text-muted-foreground">
            Whether you&apos;re a team of one or a growing business, Geek Sign handles the paperwork so you don&apos;t have to.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
          {useCases.map((useCase, index) => (
            <Card key={index} className="border border-slate-100 bg-white shadow-sm hover-lift">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange mb-4">
                  <useCase.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-brand-navy mb-2">{useCase.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {useCase.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="bg-slate-50/50 py-24 md:py-32">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-brand-navy/10 text-brand-navy text-sm font-medium mb-4">
              FAQ
            </span>
            <h2 className="heading-editorial text-4xl md:text-5xl text-brand-navy">
              Frequently asked questions
            </h2>
          </div>

          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="bg-white rounded-xl border-0 shadow-sm px-6 data-[state=open]:shadow-teal"
                >
                  <AccordionTrigger className="text-left text-brand-navy hover:no-underline py-5">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-5">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-24 md:py-32">
        <div className="relative rounded-3xl overflow-hidden">
          {/* Background - light gradient with teal accent */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-teal/5 via-white to-brand-teal/10" />
          <div className="absolute inset-0 bg-dot-pattern opacity-30" />

          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-teal/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-orange/5 rounded-full blur-3xl" />

          {/* Border */}
          <div className="absolute inset-0 rounded-3xl border border-brand-teal/20" />

          <div className="relative px-6 py-16 md:px-16 md:py-24 text-center">
            <h2 className="heading-editorial text-4xl md:text-5xl lg:text-6xl text-brand-navy mb-6">
              Ready to start signing?
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Join thousands of users who trust Geek Sign for their document signing needs.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="bg-brand-teal hover:bg-brand-teal/90 text-white text-base px-8 shadow-lg shadow-brand-teal/25"
                asChild
              >
                <Link href="/signup">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-brand-navy/20 text-brand-navy hover:bg-brand-navy/5 text-base px-8"
                asChild
              >
                <Link href="/pricing">View Pricing</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
