"use client";

import {
    useEffect,
    useMemo,
    useRef,
} from "react";

import {
    AlertCircle,
    CheckCircle2,
    Terminal,
    TriangleAlert,
} from "lucide-react";

interface CompileLogPanelProps {
    log: string;
    compiling: boolean;
    success?: boolean;
}

type LogLineType =
    | "normal"
    | "command"
    | "section"
    | "warning"
    | "error";

interface ParsedLogLine {
    text: string;
    type: LogLineType;
}

function stripAnsi(value: string): string {
    return value.replace(
        // eslint-disable-next-line no-control-regex
        /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
        ""
    );
}

function classifyLine(line: string): LogLineType {
    const trimmed = line.trim();

    if (!trimmed) {
        return "normal";
    }

    if (
        /^! /.test(trimmed) ||
        /LaTeX Error:/i.test(trimmed) ||
        /Fatal error/i.test(trimmed) ||
        /Emergency stop/i.test(trimmed) ||
        /gave return code [1-9]/i.test(trimmed) ||
        /Errors, so I did not complete/i.test(trimmed) ||
        /did not complete making targets/i.test(trimmed)
    ) {
        return "error";
    }

    if (
        /warning/i.test(trimmed) ||
        /undefined references/i.test(trimmed) ||
        /undefined citations/i.test(trimmed) ||
        /missing or unavailable character/i.test(trimmed)
    ) {
        return "warning";
    }

    if (
        /^Running '/.test(trimmed) ||
        /^Latexmk:/.test(trimmed) ||
        /^Rule '.+'/.test(trimmed) ||
        /^Rc files read/.test(trimmed) ||
        /^Run number \d+/.test(trimmed) ||
        /^Category '/.test(trimmed)
    ) {
        return "command";
    }

    if (
        /^[-]{5,}$/.test(trimmed) ||
        /^=+/.test(trimmed) ||
        /^Collected error summary/.test(trimmed) ||
        /^Summary of warnings/.test(trimmed)
    ) {
        return "section";
    }

    return "normal";
}

function lineClasses(
    type: LogLineType
): string {
    switch (type) {
        case "error":
            return "text-red-400";

        case "warning":
            return "text-yellow-400";

        case "command":
            return "text-cyan-300";

        case "section":
            return "font-semibold text-foreground/80";

        default:
            return "text-muted-foreground";
    }
}

export function CompileLogPanel({
                                    log,
                                    compiling,
                                    success,
                                }: CompileLogPanelProps) {
    const containerRef =
        useRef<HTMLDivElement | null>(null);

    const parsedLines = useMemo<
        ParsedLogLine[]
    >(() => {
        const cleanLog = stripAnsi(log);

        if (!cleanLog) {
            return [];
        }

        return cleanLog
            .split(/\r?\n/)
            .map((text) => ({
                text,
                type: classifyLine(text),
            }));
    }, [log]);

    useEffect(() => {
        const container =
            containerRef.current;

        if (!container || !compiling) {
            return;
        }

        container.scrollTop =
            container.scrollHeight;
    }, [log, compiling]);

    const statusLabel = compiling
        ? "Running"
        : success
            ? "Succeeded"
            : log
                ? "Failed"
                : "Idle";

    const StatusIcon = compiling
        ? Terminal
        : success
            ? CheckCircle2
            : log
                ? AlertCircle
                : Terminal;

    return (
        <div className="flex h-full min-h-0 flex-col bg-[#0b0d10]">
            {/* Console header */}
            <div className="flex h-9 shrink-0 items-center border-b border-white/10 px-3">
                <div className="flex items-center gap-2">
                    <Terminal className="size-3.5 text-muted-foreground" />

                    <span className="text-xs font-medium">
                        Compilation Log
                    </span>
                </div>

                <div className="ml-auto flex items-center gap-1.5">
                    <StatusIcon
                        className={`size-3 ${
                            compiling
                                ? "animate-pulse text-cyan-400"
                                : success
                                    ? "text-emerald-400"
                                    : log
                                        ? "text-red-400"
                                        : "text-muted-foreground"
                        }`}
                    />

                    <span className="text-[10px] text-muted-foreground">
                        {statusLabel}
                    </span>
                </div>
            </div>

            {/* Console */}
            <div
                ref={containerRef}
                className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[11px] leading-[1.6]"
            >
                {!parsedLines.length ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                        {compiling
                            ? "Starting LaTeX compilation..."
                            : "No compilation output yet."}
                    </div>
                ) : (
                    <div className="min-w-max">
                        {parsedLines.map(
                            (line, index) => (
                                <div
                                    key={index}
                                    className="group flex min-h-[18px] hover:bg-white/[0.03]"
                                >
                                    {/* Line number */}
                                    <span className="mr-4 w-9 shrink-0 select-none text-right text-[10px] text-muted-foreground/30">
                                        {String(
                                            index + 1
                                        ).padStart(
                                            3,
                                            "0"
                                        )}
                                    </span>

                                    {/* Log content */}
                                    <span
                                        className={`whitespace-pre-wrap ${lineClasses(
                                            line.type
                                        )}`}
                                    >
                                        {line.text ||
                                            " "}
                                    </span>
                                </div>
                            )
                        )}
                    </div>
                )}

                {compiling && (
                    <div className="mt-2 flex items-center gap-2 pl-13 text-[10px] text-cyan-400">
                        <span className="inline-block size-1.5 animate-pulse rounded-full bg-cyan-400" />
                        latexmk is still running...
                    </div>
                )}
            </div>
        </div>
    );
}