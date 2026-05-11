"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, ArrowRight, FileText, Upload } from "lucide-react";

export default function NewTemplateChooserPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/templates">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create template</h1>
          <p className="text-muted-foreground">
            How do you want to build this template?
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="group flex flex-col transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <CardTitle>Start from scratch</CardTitle>
            <CardDescription>
              Compose the agreement in a rich-text editor. Add signature
              fields and variables inline — no PDF needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button asChild className="w-full">
              <Link href="/dashboard/templates/new/blank">
                Open composer
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="group flex flex-col transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Upload className="h-5 w-5" />
            </div>
            <CardTitle>Upload a PDF</CardTitle>
            <CardDescription>
              Use an existing PDF as the document. Place signature fields on
              top of the rendered pages.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard/templates/new/pdf">
                Upload PDF
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
