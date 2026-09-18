import * as Y from "yjs";
import type {editor} from "monaco-editor";

import axios from "@/utils/axiosInstance";

export type CollaborationStatus =
    | "connecting"
    | "connected"
    | "disconnected";

export interface CollaborationSession {
    doc: Y.Doc;
    text: Y.Text;

    provider: {
        destroy: () => void;
    };

    binding: {
        destroy: () => void;
    };

    destroy: () => void;
}

/**
 * Encode the room in exactly the format expected by
 * the Go collaboration backend:
 *
 * base64.RawURLEncoding(
 *     projectID + "\x00" + filePath
 * )
 */
function encodeRoom(
    projectId: string,
    filePath: string,
): string {
    const raw =
        `${projectId}\x00${filePath}`;

    const bytes =
        new TextEncoder().encode(raw);

    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

export async function connectCollaborativeEditor(
    projectId: string,
    fileName: string,
    editorInstance: editor.IStandaloneCodeEditor,
    setStatus: (
        status: CollaborationStatus
    ) => void,

    _initialContent: string,

    onContentChange: (
        content: string,
        local: boolean,
    ) => void,
): Promise<CollaborationSession> {
    /*
     * These packages access browser APIs, so load them
     * dynamically rather than at module evaluation time.
     */
    const [
        {WebsocketProvider},
        {MonacoBinding},
    ] = await Promise.all([
        import("y-websocket"),
        import("y-monaco"),
    ]);

    const model =
        editorInstance.getModel();

    if (!model) {
        throw new Error(
            "Monaco model is not available.",
        );
    }

    /*
     * Get a short-lived collaboration token from
     * the authenticated Go backend.
     */
    const tokenResponse =
        await axios.get<{
            token: string;
        }>("/collaboration/token");

    const token =
        tokenResponse.data.token;

    if (!token) {
        throw new Error(
            "Collaboration token was not returned.",
        );
    }

    /*
     * The Go server route is:
     *
     * /api/yjs/{room}
     *
     * The room itself must be a SINGLE URL-safe
     * base64 segment.
     */
    const room =
        encodeRoom(
            projectId,
            fileName,
        );

    /*
     * The Go backend is running the Ygo websocket
     * server on the same HTTP server as the REST API.
     */
    const websocketBase = process.env.NEXT_PUBLIC_WS_URL ??
        (typeof window !== "undefined" ? `ws://${window.location.host}` : "ws://localhost:3000");

    const websocketServer =
        `${websocketBase.replace(/\/$/, "")}/api/yjs`;

    console.log(
        "[Yjs] connecting",
        `${websocketServer}/${room}`,
    );

    const doc =
        new Y.Doc();

    const text =
        doc.getText("content");

    console.log("[YJS] websocket URL:", websocketServer);
    console.log("[YJS] room:", room);
    console.log("[YJS] token present:", Boolean(token));
    console.log("[YJS] token length:", token.length);

    /*
     * y-websocket's WebsocketProvider speaks the
     * Yjs websocket protocol that Ygo implements.
     */
    const provider =
        new WebsocketProvider(
            websocketServer,
            room,
            doc,
            {
                connect: true,

                /*
                 * Your Go authorize() function reads:
                 *
                 * r.URL.Query().Get("token")
                 */
                params: {
                    token,
                },
            },
        );

    let binding:
        InstanceType<typeof MonacoBinding> |
        null = null;

    const handleStatus = ({
                              status,
                          }: {
        status:
            | "connecting"
            | "connected"
            | "disconnected";
    }) => {
        console.log(
            `[Yjs] ${projectId}/${fileName}: ${status}`,
        );

        setStatus(status);
    };

    provider.on(
        "status",
        handleStatus,
    );

    /*
     * React gets a representation of the current
     * collaborative document.
     */
    const handleTextChange = (
        event: Y.YTextEvent,
    ) => {
        const content =
            text.toString();

        const local =
            binding !== null &&
            event.transaction.origin === binding;

        onContentChange(
            content,
            local,
        );
    };

    text.observe(
        handleTextChange,
    );

    /*
     * Ygo loads the initial filesystem contents
     * through OnLoadDocument on the Go side.
     *
     * Therefore the browser does NOT seed the document.
     */
    const handleSync = (
        synced: boolean,
    ) => {
        if (!synced || binding !== null) {
            return;
        }

        console.log(
            `[Yjs] synced ${projectId}/${fileName}`,
        );

        /*
         * At this point the Y.Doc already contains
         * whatever the Go server loaded from the
         * filesystem or received from another peer.
         */
        binding =
            new MonacoBinding(
                text,
                model,
                new Set([
                    editorInstance,
                ]),
                provider.awareness,
            );

        /*
         * Make React aware of the current document
         * without marking it as a local edit.
         */
        onContentChange(
            text.toString(),
            false,
        );
    };

    provider.on(
        "sync",
        handleSync,
    );

    /*
     * Canonical line endings.
     */
    model.setEOL(0);

    /*
     * Handle the case where synchronization completed
     * before our listener was attached.
     */
    if (provider.synced) {
        handleSync(true);
    }

    return {
        doc,
        text,
        provider,

        binding: {
            destroy() {
                binding?.destroy();
                binding = null;
            },
        },

        destroy() {
            text.unobserve(
                handleTextChange,
            );

            provider.off(
                "status",
                handleStatus,
            );

            provider.off(
                "sync",
                handleSync,
            );

            binding?.destroy();
            binding = null;

            provider.destroy();
            doc.destroy();
        },
    };
}