"use client";

import { useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
    ChevronDown,
    ChevronUp,
    Minus,
    Plus,
    RotateCcw,
    Search,
    X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import axios from "@/utils/axiosInstance";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
).toString();

interface PdfPreviewProps {
    projectId: string;
    version: number;
}

export function PdfPreview({
                               projectId,
                               version,
                           }: PdfPreviewProps) {
    const [numPages, setNumPages] = useState(0);
    const [scale, setScale] = useState(1);

    const [searchOpen, setSearchOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [currentMatch, setCurrentMatch] = useState(0);

    const [pdfAvailable, setPdfAvailable] = useState(false);
    const [checkingPdf, setCheckingPdf] = useState(true);

    const pdfUrl = useMemo(() => {
        return `/projects/${projectId}/pdf?v=${version}`;
    }, [projectId, version]);

    useEffect(() => {
        setCurrentMatch(0);
    }, [search]);

    /*
     * Check whether a compiled PDF exists before
     * giving react-pdf the URL.
     */
    useEffect(() => {
        let cancelled = false;

        const checkPdf = async () => {
            setCheckingPdf(true);
            setPdfAvailable(false);
            setNumPages(0);

            try {
                await axios.get(pdfUrl, {
                    responseType: "blob",
                });

                if (!cancelled) {
                    setPdfAvailable(true);
                }
            } catch (error) {
                if (!cancelled) {
                    setPdfAvailable(false);
                }
            } finally {
                if (!cancelled) {
                    setCheckingPdf(false);
                }
            }
        };

        checkPdf();

        return () => {
            cancelled = true;
        };
    }, [pdfUrl]);

    const zoomIn = () => {
        setScale((value) => Math.min(2.5, value + 0.1));
    };

    const zoomOut = () => {
        setScale((value) => Math.max(0.5, value - 0.1));
    };

    const resetZoom = () => {
        setScale(1);
    };

    const closeSearch = () => {
        setSearchOpen(false);
        setSearch("");
        setCurrentMatch(0);
    };

    const handleSearchKeyDown = (
        event: React.KeyboardEvent<HTMLInputElement>
    ) => {
        if (event.key === "Escape") {
            closeSearch();
        }

        if (event.key === "Enter") {
            if (event.shiftKey) {
                setCurrentMatch((value) => Math.max(0, value - 1));
            } else {
                setCurrentMatch((value) => value + 1);
            }
        }
    };

    return (
        <div className="flex h-full flex-col">
            {/* Toolbar */}
            <div className="flex h-9 shrink-0 items-center border-b px-2">
                <span className="px-2 text-xs font-medium text-muted-foreground">
                    PDF Preview
                </span>

                <div className="ml-auto flex items-center gap-1">
                    {searchOpen ? (
                        <div className="flex items-center gap-1">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />

                                <Input
                                    autoFocus
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    onKeyDown={handleSearchKeyDown}
                                    placeholder="Search PDF..."
                                    className="h-7 w-48 pl-7 text-xs"
                                />
                            </div>

                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() =>
                                    setCurrentMatch((value) =>
                                        Math.max(0, value - 1)
                                    )
                                }
                                disabled={!search}
                            >
                                <ChevronUp className="size-3.5" />
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() =>
                                    setCurrentMatch(
                                        (value) => value + 1
                                    )
                                }
                                disabled={!search}
                            >
                                <ChevronDown className="size-3.5" />
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={closeSearch}
                            >
                                <X className="size-3.5" />
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => setSearchOpen(true)}
                        >
                            <Search className="size-3.5" />
                        </Button>
                    )}

                    <div className="mx-1 h-4 w-px bg-border" />

                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={zoomOut}
                        disabled={scale <= 0.5}
                    >
                        <Minus className="size-3.5" />
                    </Button>

                    <button
                        type="button"
                        onClick={resetZoom}
                        className="w-12 text-center text-xs text-muted-foreground hover:text-foreground"
                    >
                        {Math.round(scale * 100)}%
                    </button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={zoomIn}
                        disabled={scale >= 2.5}
                    >
                        <Plus className="size-3.5" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={resetZoom}
                    >
                        <RotateCcw className="size-3.5" />
                    </Button>
                </div>
            </div>

            {/* PDF */}
            <div className="min-h-0 flex-1 overflow-auto bg-muted/40 p-6">
                {checkingPdf ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Checking PDF...
                    </div>
                ) : !pdfAvailable ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                        <p className="text-sm font-medium">
                            No compiled PDF
                        </p>

                        <p className="text-xs text-muted-foreground">
                            Compile the project to preview the PDF here.
                        </p>
                    </div>
                ) : (
                    <Document
                        key={`/api/${pdfUrl}`}
                        file={`/api/${pdfUrl}`}
                        onLoadSuccess={({ numPages }) => {
                            setNumPages(numPages);
                        }}
                        onLoadError={(error) => {
                            console.error(
                                "Failed to load PDF:",
                                error
                            );
                            setPdfAvailable(false);
                            setNumPages(0);
                        }}
                        loading={
                            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                Loading PDF...
                            </div>
                        }
                        error={
                            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                Failed to load PDF.
                            </div>
                        }
                        className="flex flex-col items-center gap-6"
                    >
                        {Array.from(
                            { length: numPages },
                            (_, index) => (
                                <div
                                    key={`page-${index + 1}`}
                                    className="bg-white shadow-md"
                                >
                                    <Page
                                        pageNumber={index + 1}
                                        scale={scale}
                                        renderTextLayer
                                        renderAnnotationLayer
                                    />
                                </div>
                            )
                        )}
                    </Document>
                )}
            </div>
        </div>
    );
}