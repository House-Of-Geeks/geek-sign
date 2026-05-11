import { auth } from "@/lib/auth";
import { db, documents } from "@/lib/db";
import { eq, and, desc, count } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  FileText,
  Clock,
  CheckCircle2,
  Upload,
  Plus,
  ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  // Fetch document stats
  const [totalResult] = await db
    .select({ count: count() })
    .from(documents)
    .where(eq(documents.userId, session.user.id));

  const [pendingResult] = await db
    .select({ count: count() })
    .from(documents)
    .where(and(eq(documents.userId, session.user.id), eq(documents.status, "pending")));

  const [completedResult] = await db
    .select({ count: count() })
    .from(documents)
    .where(and(eq(documents.userId, session.user.id), eq(documents.status, "completed")));

  // Fetch recent documents
  const recentDocuments = await db
    .select()
    .from(documents)
    .where(eq(documents.userId, session.user.id))
    .orderBy(desc(documents.createdAt))
    .limit(5);

  const stats = [
    {
      name: "Total Documents",
      value: totalResult?.count || 0,
      icon: FileText,
      color: "text-[#252A61]",
      bgColor: "bg-[#252A61]/15",
    },
    {
      name: "Pending",
      value: pendingResult?.count || 0,
      icon: Clock,
      color: "text-[#F15C3E]",
      bgColor: "bg-[#F15C3E]/15",
    },
    {
      name: "Completed",
      value: completedResult?.count || 0,
      icon: CheckCircle2,
      color: "text-[#07AFBA]",
      bgColor: "bg-[#07AFBA]/15",
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "pending":
        return <Badge variant="outline" className="border-[#F15C3E] text-[#F15C3E]">Pending</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-[#07AFBA] hover:bg-[#07AFBA]/90">Completed</Badge>;
      case "expired":
        return <Badge variant="destructive">Expired</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s an overview of your documents.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/documents/new">
            <Upload className="mr-2 h-4 w-4" />
            New Document
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.name}
              </CardTitle>
              <div className={`rounded-full p-2 ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Get started with common tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
              <Link href="/dashboard/documents/new">
                <Upload className="h-6 w-6" />
                <span>New Document</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
              <Link href="/dashboard/templates">
                <Plus className="h-6 w-6" />
                <span>Create Template</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
              <Link href="/dashboard/documents">
                <FileText className="h-6 w-6" />
                <span>View All Documents</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Documents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Documents</CardTitle>
            <CardDescription>Your latest document activity</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/documents">
              View all
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentDocuments && recentDocuments.length > 0 ? (
            <div className="space-y-4">
              {recentDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-muted p-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{doc.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(doc.createdAt))} ago
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(doc.status)}
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/documents/${doc.id}`}>
                        View
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold">No documents yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first document to get started
              </p>
              <Button asChild>
                <Link href="/dashboard/documents/new">
                  <Upload className="mr-2 h-4 w-4" />
                  New Document
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
