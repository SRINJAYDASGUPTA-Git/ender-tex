"use client";

import {ListTodo, ShieldCheck, Zap,} from "lucide-react";

import {LoginForm} from "@/components/login-form";
import Image from "next/image";
import * as React from "react";

export default function LoginPage() {
    return (
        <div className="grid min-h-screen lg:grid-cols-2">
            {/* Left */}
            <div className="flex flex-col justify-between border-r bg-[#18181a] p-8 lg:p-12">
                <div className="flex items-center gap-3">
                    <Image src={'/word_logo.png'} alt={'logo'} width={150} height={37}  />
                </div>

                <div className="mx-auto max-w-md space-y-10">
                    <div className="space-y-4">
                        <h1 className="text-5xl font-bold tracking-tight">
                            Get things
                            <br />
                            <span className="text-primary">done.</span>
                        </h1>

                        <p className="text-muted-foreground">
                            Organize your tasks, keep track of what
                            matters, and turn your plans into things
                            actually done.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-3 rounded-lg border p-4">
                            <ListTodo className="size-5 text-primary" />

                            <div>
                                <p className="font-medium">
                                    Organize Your Tasks
                                </p>

                                <p className="text-sm text-muted-foreground">
                                    Keep everything you need to do in one place.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 rounded-lg border p-4">
                            <Zap className="size-5 text-primary" />

                            <div>
                                <p className="font-medium">
                                    Stay Focused
                                </p>

                                <p className="text-sm text-muted-foreground">
                                    Focus on what matters and move things forward.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 rounded-lg border p-4">
                            <ShieldCheck className="size-5 text-primary" />

                            <div>
                                <p className="font-medium">
                                    Secure by Design
                                </p>

                                <p className="text-sm text-muted-foreground">
                                    Your account and tasks stay protected.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <p className="text-xs text-muted-foreground">
                    © {new Date().getFullYear()} EnderDoes
                </p>
            </div>

            {/* Right */}
            <div className="flex items-center justify-center bg-muted/20 p-8">
                <div className="w-full max-w-sm">
                    <LoginForm />
                </div>
            </div>
        </div>
    );
}