"use client";

import {Plus, Sparkles,} from "lucide-react";

import {useEffect} from "react";
import {useRouter} from "next/navigation";

import {useUser} from "@/providers/UserContext";

import {Button} from "@/components/ui/button";
import {toast} from "@/components/ui/toast";

export default function Home() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/login");
    }
  }, [user, userLoading, router]);

  useEffect(() => {
    if (!user) {
      toast.add({
        type: "error",
        description: "Not logged in",
        priority: "high",
      });
    }
  }, [user]);

  if (userLoading || !user) {
    return (
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />

            <p className="text-sm text-muted-foreground">
              Loading your workspace...
            </p>
          </div>
        </div>
    );
  }

  return (
      <div className="mx-auto w-full max-w-7xl space-y-8 p-6 lg:p-8">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="size-4 text-primary" />

              <span>Good to see you</span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight">
              Hey, {user.name} 👋
            </h1>

            <p className="mt-1 text-muted-foreground">
              Let&apos;s get some things done today.
            </p>
          </div>

          <Button
              onClick={() => router.push("/todos")}
              className="gap-2"
          >
            <Plus className="size-4" />
            New Task
          </Button>
        </div>

      </div>
  );
}