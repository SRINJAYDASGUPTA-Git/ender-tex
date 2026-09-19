"use client";

import {FileCode2, FileText, Users,} from "lucide-react";

import {LoginForm} from "@/components/login-form";
import Image from "next/image";
import * as React from "react";

export default function LoginPage() {
    return (
        <div className="grid min-h-screen lg:grid-cols-2">
            {/* Left */}
            <div className="flex flex-col justify-between border-r bg-[#18181a] p-8 lg:p-12">
                <div className="flex items-center gap-3">
                    <Image src={'/ender-tex-logo.png'} alt={'logo'} width={40} height={37}  />
                    <span className={"text-3xl font-bold font-sans"}>
                      Ender
                      <span className="bg-linear-to-r from-violet-400 via-purple-500 to-fuchsia-500 bg-clip-text text-transparent">
                        TeX
                      </span>
                    </span>
                </div>


                <div className="mx-auto max-w-md space-y-10">
                    <div className="space-y-4">
                        <h1 className="text-5xl font-bold tracking-tight">
                            Write beyond.
                            <br />
                            <span className="text-primary">Compile beautifully.</span>
                        </h1>

                        <p className="text-muted-foreground">
                            Write, compile, and collaborate on your LaTeX projects
                            from one powerful workspace.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-3 rounded-lg border p-4">
                            <FileCode2 className="size-5 text-primary" />

                            <div>
                                <p className="font-medium">
                                    Write Without Limits
                                </p>

                                <p className="text-sm text-muted-foreground">
                                    A focused LaTeX editor built for serious writing.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 rounded-lg border p-4">
                            <Users className="size-5 text-primary" />

                            <div>
                                <p className="font-medium">
                                    Collaborate in Real Time
                                </p>

                                <p className="text-sm text-muted-foreground">
                                    Work together on the same document, wherever you are.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 rounded-lg border p-4">
                            <FileText className="size-5 text-primary" />

                            <div>
                                <p className="font-medium">
                                    Compile & Preview
                                </p>

                                <p className="text-sm text-muted-foreground">
                                    Turn your source into polished PDFs right inside your workspace.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <p className="text-xs text-muted-foreground">
                    © {new Date().getFullYear()} EnderDev
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