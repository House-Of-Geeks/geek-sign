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

export default function NewDocumentChooserPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/documents">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New document</h1>
          <p className="text-muted-foreground">
            How do you want to create this agreement?
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="group flex flex-col transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <CardTitle>Compose on platform</CardTitle>
            <CardDescription>
              Write the agreement directly in a rich-text editor and drop
              signature fields inline. No PDF needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button asChild className="w-full">
              <Link href="/dashboard/documents/new/blank">
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
              Use an existing PDF and place signature fields on top of the
              rendered pages.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard/upload">
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
