"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    Document,
    Page,
    pdfjs,
} from "react-pdf";

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

pdfjs.GlobalWorkerOptions.workerSrc =
    new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
    ).toString();

interface PdfPreviewProps {
    projectId: string;
    version: number;
}

interface SearchMatch {
    index: number;
    page: number;
}

interface SearchHighlight {
    index: number;
    page: number;
    left: number;
    top: number;
    width: number;
    height: number;
}

/*
 * PDF.js text layers can contain multiple text nodes
 * inside a single span. This function walks all text
 * nodes and creates a DOM Range for an arbitrary
 * character range.
 */
function createTextRange(
    element: HTMLElement,
    startOffset: number,
    endOffset: number
): Range | null {
    const walker =
        document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT
        );

    const textNodes: Text[] = [];

    let currentNode =
        walker.nextNode();

    while (currentNode) {
        textNodes.push(
            currentNode as Text
        );

        currentNode =
            walker.nextNode();
    }

    if (textNodes.length === 0) {
        return null;
    }

    let currentOffset = 0;

    let startNode: Text | null = null;
    let startNodeOffset = 0;

    let endNode: Text | null = null;
    let endNodeOffset = 0;

    for (const node of textNodes) {
        const length =
            node.textContent?.length ?? 0;

        const nodeStart =
            currentOffset;

        const nodeEnd =
            currentOffset + length;

        /*
         * Find the start text node.
         */
        if (
            startNode === null &&
            startOffset >= nodeStart &&
            startOffset <= nodeEnd
        ) {
            startNode = node;

            startNodeOffset =
                Math.max(
                    0,
                    startOffset -
                    nodeStart
                );
        }

        /*
         * Find the end text node.
         */
        if (
            endOffset >= nodeStart &&
            endOffset <= nodeEnd
        ) {
            endNode = node;

            endNodeOffset =
                Math.max(
                    0,
                    endOffset -
                    nodeStart
                );

            break;
        }

        currentOffset = nodeEnd;
    }

    if (
        !startNode ||
        !endNode
    ) {
        return null;
    }

    const range =
        document.createRange();

    try {
        range.setStart(
            startNode,
            Math.min(
                startNodeOffset,
                startNode.length
            )
        );

        range.setEnd(
            endNode,
            Math.min(
                endNodeOffset,
                endNode.length
            )
        );

        return range;
    } catch {
        return null;
    }
}

/*
 * Find every occurrence of a query inside a DOM element.
 *
 * Unlike customTextRenderer, this operates on the actual
 * PDF.js text layer after it has been positioned.
 */
function findMatchesInElement(
    element: HTMLElement,
    query: string
): Array<{
    start: number;
    end: number;
}> {
    const text =
        element.textContent ?? "";

    const lowerText =
        text.toLowerCase();

    const lowerQuery =
        query.toLowerCase();

    const results: Array<{
        start: number;
        end: number;
    }> = [];

    let offset = 0;

    while (true) {
        const index =
            lowerText.indexOf(
                lowerQuery,
                offset
            );

        if (index === -1) {
            break;
        }

        results.push({
            start: index,
            end:
                index +
                lowerQuery.length,
        });

        /*
         * Move by one character so overlapping
         * matches are also detected.
         */
        offset = index + 1;
    }

    return results;
}

export function PdfPreview({
                               projectId,
                               version,
                           }: PdfPreviewProps) {
    const [numPages, setNumPages] =
        useState(0);

    const [scale, setScale] =
        useState(1);

    const [searchOpen, setSearchOpen] =
        useState(false);

    const [search, setSearch] =
        useState("");

    const [currentMatch, setCurrentMatch] =
        useState(0);

    const [matches, setMatches] =
        useState<SearchMatch[]>([]);

    const [highlights, setHighlights] =
        useState<SearchHighlight[]>([]);

    const [pdfAvailable, setPdfAvailable] =
        useState(false);

    const [checkingPdf, setCheckingPdf] =
        useState(true);

    /*
     * The element that actually scrolls.
     */
    const pdfContainerRef =
        useRef<HTMLDivElement | null>(
            null
        );

    /*
     * Wrapper around the entire PDF document.
     *
     * Highlight coordinates are relative to this
     * element, so scrolling does not invalidate them.
     */
    const pdfContentRef =
        useRef<HTMLDivElement | null>(
            null
        );

    /*
     * Incremented whenever a PDF text layer
     * finishes rendering.
     */
    const textLayerVersion =
        useRef(0);

    const pdfUrl = useMemo(() => {
        return `/projects/${projectId}/pdf?v=${version}`;
    }, [projectId, version]);

    /*
     * Reset search when the PDF changes.
     */
    useEffect(() => {
        setSearch("");
        setCurrentMatch(0);
        setMatches([]);
        setHighlights([]);
    }, [pdfUrl]);

    /*
     * Check whether a compiled PDF exists.
     */
    useEffect(() => {
        let cancelled = false;

        const checkPdf = async () => {
            setCheckingPdf(true);
            setPdfAvailable(false);
            setNumPages(0);
            setMatches([]);
            setHighlights([]);

            try {
                await axios.get(
                    pdfUrl,
                    {
                        responseType:
                            "blob",
                    }
                );

                if (!cancelled) {
                    setPdfAvailable(
                        true
                    );
                }
            } catch {
                if (!cancelled) {
                    setPdfAvailable(
                        false
                    );
                }
            } finally {
                if (!cancelled) {
                    setCheckingPdf(
                        false
                    );
                }
            }
        };

        void checkPdf();

        return () => {
            cancelled = true;
        };
    }, [pdfUrl]);

    /*
     * Tell React that a PDF.js text layer has
     * finished rendering.
     */
    const handleTextLayerSuccess =
        useCallback(() => {
            textLayerVersion.current += 1;

            /*
             * Force the search effect to run.
             *
             * We don't actually need the value itself;
             * changing state is enough.
             */
            setSearchRenderVersion(
                (value) => value + 1
            );
        }, []);

    const [
        searchRenderVersion,
        setSearchRenderVersion,
    ] = useState(0);

    /*
     * Build exact highlight rectangles from the
     * real PDF.js text layer.
     */
    useEffect(() => {
        const query =
            search.trim();

        if (!query) {
            setMatches([]);
            setHighlights([]);
            setCurrentMatch(0);
            return;
        }

        const container =
            pdfContainerRef.current;

        const content =
            pdfContentRef.current;

        if (!container || !content) {
            return;
        }

        let cancelled = false;

        let retryTimer:
            number | undefined;

        const calculateHighlights = (
            attempt: number
        ) => {
            if (cancelled) {
                return;
            }

            const pageElements =
                Array.from(
                    content.querySelectorAll<HTMLElement>(
                        ".react-pdf__Page"
                    )
                );

            const textSpans =
                Array.from(
                    content.querySelectorAll<HTMLElement>(
                        ".react-pdf__Page__textContent span"
                    )
                );

            /*
             * Text layer hasn't appeared yet.
             */
            if (
                pageElements.length ===
                0 ||
                textSpans.length ===
                0
            ) {
                if (attempt < 30) {
                    retryTimer =
                        window.setTimeout(
                            () =>
                                calculateHighlights(
                                    attempt +
                                    1
                                ),
                            50
                        );
                }

                return;
            }

            const contentRect =
                content.getBoundingClientRect();

            const nextMatches: SearchMatch[] =
                [];

            const nextHighlights: SearchHighlight[] =
                [];

            let globalIndex = 0;

            /*
             * Iterate in DOM order.
             *
             * React-PDF renders pages in document order,
             * and text spans in reading order.
             */
            for (
                const span of textSpans
                ) {
                const pageElement =
                    span.closest<HTMLElement>(
                        ".react-pdf__Page"
                    );

                if (!pageElement) {
                    continue;
                }

                const pageNumber =
                    Number(
                        pageElement.dataset
                            .pageNumber
                    );

                if (
                    !Number.isFinite(
                        pageNumber
                    )
                ) {
                    continue;
                }

                const occurrences =
                    findMatchesInElement(
                        span,
                        query
                    );

                if (
                    occurrences.length ===
                    0
                ) {
                    continue;
                }

                for (
                    const occurrence of occurrences
                    ) {
                    const range =
                        createTextRange(
                            span,
                            occurrence.start,
                            occurrence.end
                        );

                    if (!range) {
                        continue;
                    }

                    const rects =
                        Array.from(
                            range.getClientRects()
                        );

                    /*
                     * A match can span multiple visual
                     * rectangles, for example if the text
                     * wraps.
                     */
                    for (
                        const rect of rects
                        ) {
                        if (
                            rect.width <= 0 ||
                            rect.height <= 0
                        ) {
                            continue;
                        }

                        nextHighlights.push({
                            index:
                            globalIndex,
                            page:
                            pageNumber,
                            left:
                                rect.left -
                                contentRect.left,
                            top:
                                rect.top -
                                contentRect.top,
                            width:
                            rect.width,
                            height:
                            rect.height,
                        });
                    }

                    nextMatches.push({
                        index:
                        globalIndex,
                        page:
                        pageNumber,
                    });

                    globalIndex++;
                }
            }

            if (cancelled) {
                return;
            }

            setMatches(
                nextMatches
            );

            setHighlights(
                nextHighlights
            );

            setCurrentMatch(
                (value) => {
                    if (
                        nextMatches.length ===
                        0
                    ) {
                        return 0;
                    }

                    return Math.min(
                        value,
                        nextMatches.length -
                        1
                    );
                }
            );
        };

        /*
         * Give React-PDF one frame to finish layout.
         */
        retryTimer =
            window.setTimeout(
                () =>
                    calculateHighlights(
                        0
                    ),
                0
            );

        return () => {
            cancelled = true;

            if (
                retryTimer !==
                undefined
            ) {
                window.clearTimeout(
                    retryTimer
                );
            }
        };
    }, [
        search,
        scale,
        searchRenderVersion,
    ]);

    /*
     * Recalculate highlight positions when the
     * PDF container changes size.
     *
     * This handles sidebar resizing and browser
     * resizing as well.
     */
    useEffect(() => {
        const content =
            pdfContentRef.current;

        if (!content) {
            return;
        }

        const observer =
            new ResizeObserver(() => {
                if (
                    search.trim()
                ) {
                    setSearchRenderVersion(
                        (value) =>
                            value + 1
                    );
                }
            });

        observer.observe(content);

        return () => {
            observer.disconnect();
        };
    }, [search]);

    /*
     * Scroll to the currently selected match.
     */
    useEffect(() => {
        if (
            matches.length === 0 ||
            highlights.length === 0
        ) {
            return;
        }

        const container =
            pdfContainerRef.current;

        if (!container) {
            return;
        }

        /*
         * Get the first visual rectangle belonging
         * to the selected match.
         */
        const highlight =
            highlights.find(
                (item) =>
                    item.index ===
                    currentMatch
            );

        if (!highlight) {
            return;
        }

        /*
         * Coordinates are relative to the entire
         * PDF content wrapper.
         */
        const targetTop =
            highlight.top;

        const targetLeft =
            highlight.left;

        const scrollTop =
            targetTop -
            container.clientHeight /
            2 +
            highlight.height / 2;

        const scrollLeft =
            targetLeft -
            container.clientWidth /
            2 +
            highlight.width / 2;

        container.scrollTo({
            top: Math.max(
                0,
                scrollTop
            ),
            left: Math.max(
                0,
                scrollLeft
            ),
            behavior: "smooth",
        });
    }, [
        currentMatch,
        matches.length,
        highlights,
    ]);

    /*
     * Zoom controls.
     */
    const zoomIn = () => {
        setScale((value) =>
            Math.min(
                2.5,
                value + 0.1
            )
        );
    };

    const zoomOut = () => {
        setScale((value) =>
            Math.max(
                0.5,
                value - 0.1
            )
        );
    };

    const resetZoom = () => {
        setScale(1);
    };

    /*
     * Close search.
     */
    const closeSearch = () => {
        setSearchOpen(false);
        setSearch("");
        setCurrentMatch(0);
        setMatches([]);
        setHighlights([]);
    };

    /*
     * Next search result.
     */
    const nextMatch = () => {
        if (
            matches.length === 0
        ) {
            return;
        }

        setCurrentMatch(
            (value) =>
                (value + 1) %
                matches.length
        );
    };

    /*
     * Previous search result.
     */
    const previousMatch = () => {
        if (
            matches.length === 0
        ) {
            return;
        }

        setCurrentMatch(
            (value) =>
                (value -
                    1 +
                    matches.length) %
                matches.length
        );
    };

    /*
     * Keyboard controls:
     *
     * Enter       -> next
     * Shift+Enter -> previous
     * Escape      -> close
     */
    const handleSearchKeyDown = (
        event: React.KeyboardEvent<HTMLInputElement>
    ) => {
        if (
            event.key ===
            "Escape"
        ) {
            closeSearch();
            return;
        }

        if (
            event.key ===
            "Enter"
        ) {
            event.preventDefault();

            if (
                event.shiftKey
            ) {
                previousMatch();
            } else {
                nextMatch();
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
                                    value={
                                        search
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setSearch(
                                            event
                                                .target
                                                .value
                                        )
                                    }
                                    onKeyDown={
                                        handleSearchKeyDown
                                    }
                                    placeholder="Search PDF..."
                                    className="h-7 w-48 pl-7 text-xs"
                                />
                            </div>

                            {search.trim() && (
                                <span className="min-w-12 text-center text-[10px] text-muted-foreground">
                                    {matches.length >
                                    0
                                        ? `${currentMatch + 1} / ${matches.length}`
                                        : "0 / 0"}
                                </span>
                            )}

                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={
                                    previousMatch
                                }
                                disabled={
                                    matches.length ===
                                    0
                                }
                                title="Previous match"
                            >
                                <ChevronUp className="size-3.5" />
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={
                                    nextMatch
                                }
                                disabled={
                                    matches.length ===
                                    0
                                }
                                title="Next match"
                            >
                                <ChevronDown className="size-3.5" />
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={
                                    closeSearch
                                }
                                title="Close search"
                            >
                                <X className="size-3.5" />
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() =>
                                setSearchOpen(
                                    true
                                )
                            }
                            title="Search PDF"
                        >
                            <Search className="size-3.5" />
                        </Button>
                    )}

                    <div className="mx-1 h-4 w-px bg-border" />

                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={
                            zoomOut
                        }
                        disabled={
                            scale <=
                            0.5
                        }
                        title="Zoom out"
                    >
                        <Minus className="size-3.5" />
                    </Button>

                    <button
                        type="button"
                        onClick={
                            resetZoom
                        }
                        className="w-12 text-center text-xs text-muted-foreground hover:text-foreground"
                        title="Reset zoom"
                    >
                        {Math.round(
                            scale * 100
                        )}
                        %
                    </button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={
                            zoomIn
                        }
                        disabled={
                            scale >=
                            2.5
                        }
                        title="Zoom in"
                    >
                        <Plus className="size-3.5" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={
                            resetZoom
                        }
                        title="Reset zoom"
                    >
                        <RotateCcw className="size-3.5" />
                    </Button>
                </div>
            </div>

            {/* PDF viewport */}
            <div
                ref={
                    pdfContainerRef
                }
                className="min-h-0 flex-1 overflow-auto bg-muted/40 p-6"
            >
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
                            Compile the
                            project to
                            preview the
                            PDF here.
                        </p>
                    </div>
                ) : (
                    /*
                     * This wrapper establishes the coordinate
                     * system for our highlight overlay.
                     */
                    <div
                        ref={
                            pdfContentRef
                        }
                        className="relative w-fit min-w-full"
                    >
                        <Document
                            key={`/api/${pdfUrl}`}
                            file={`/api/${pdfUrl}`}
                            onLoadSuccess={({
                                                numPages,
                                            }) => {
                                setNumPages(
                                    numPages
                                );
                            }}
                            onLoadError={(
                                error
                            ) => {
                                console.error(
                                    "Failed to load PDF:",
                                    error
                                );

                                setPdfAvailable(
                                    false
                                );

                                setNumPages(
                                    0
                                );

                                setMatches(
                                    []
                                );

                                setHighlights(
                                    []
                                );
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
                                {
                                    length: numPages,
                                },
                                (
                                    _,
                                    index
                                ) => {
                                    const pageNumber =
                                        index +
                                        1;

                                    return (
                                        <div
                                            key={`page-${pageNumber}`}
                                            className="bg-white shadow-md"
                                        >
                                            <Page
                                                pageNumber={
                                                    pageNumber
                                                }
                                                scale={
                                                    scale
                                                }
                                                renderTextLayer
                                                renderAnnotationLayer
                                                onRenderTextLayerSuccess={
                                                    handleTextLayerSuccess
                                                }
                                            />
                                        </div>
                                    );
                                }
                            )}
                        </Document>

                        {/*
                         * Search highlight overlay.
                         *
                         * This sits above the PDF canvas and
                         * native PDF.js text layer, so it cannot
                         * disturb the text-layer positioning.
                         */}
                        {highlights.length >
                            0 && (
                                <div className="pointer-events-none absolute inset-0 z-30">
                                    {highlights.map(
                                        (
                                            highlight
                                        ) => (
                                            <div
                                                key={`${highlight.index}-${highlight.left}-${highlight.top}`}
                                                className={
                                                    highlight.index ===
                                                    currentMatch
                                                        ? "pdf-search-highlight pdf-search-highlight-current"
                                                        : "pdf-search-highlight"
                                                }
                                                style={{
                                                    position:
                                                        "absolute",
                                                    left: `${highlight.left}px`,
                                                    top: `${highlight.top}px`,
                                                    width: `${highlight.width}px`,
                                                    height: `${highlight.height}px`,
                                                }}
                                            />
                                        )
                                    )}
                                </div>
                            )}
                    </div>
                )}
            </div>
        </div>
    );
}