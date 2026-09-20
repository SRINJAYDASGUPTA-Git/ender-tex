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
        awareness: any; // <-- Expose awareness
    };
    binding: {
        destroy: () => void;
    };
    awareness: any; // <-- Add this to easily access it in React
    destroy: () => void;
}

// Simple hash to consistently assign a color to a specific user ID
const getUserColor = (id: string) => {
    // MUST use rgb() format. y-monaco parses this string to inject
    // opacity using .replace('rgb', 'rgba') for text selections!
    const colors = [
        "rgb(239, 68, 68)",   // red-500
        "rgb(249, 115, 22)",  // orange-500
        "rgb(245, 158, 11)",  // amber-500
        "rgb(16, 185, 129)",  // emerald-500
        "rgb(59, 130, 246)",  // blue-500
        "rgb(99, 102, 241)",  // indigo-500
        "rgb(139, 92, 246)",  // violet-500
        "rgb(236, 72, 153)"   // pink-500
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};
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
    setStatus: (status: CollaborationStatus) => void,
    _initialContent: string,
    onContentChange: (content: string, local: boolean) => void,
    currentUser: { id: string; name: string } // <-- Add currentUser parameter
): Promise<CollaborationSession> {

    const [{ WebsocketProvider }, { MonacoBinding }] = await Promise.all([
        import("y-websocket"),
        import("y-monaco"),
    ]);

    const model = editorInstance.getModel();
    if (!model) throw new Error("Monaco model is not available.");

    const tokenResponse = await axios.get<{ token: string }>("/collaboration/token");
    const token = tokenResponse.data.token;
    if (!token) throw new Error("Collaboration token was not returned.");

    const room = encodeRoom(projectId, fileName);

    // Ensure this points to the Next.js proxy if you used the Next.js rewrite fix
    const websocketBase = process.env.NEXT_PUBLIC_WS_URL ??
        (typeof window !== "undefined"
            ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`
            : "ws://localhost:3000");

    const websocketServer = `${websocketBase.replace(/\/$/, "")}/api/yjs`;
    console.log(websocketServer);

    const doc = new Y.Doc();
    const text = doc.getText("content");

    const provider = new WebsocketProvider(websocketServer, room, doc, {
        connect: true,
        params: { token },
    });

    // --- NEW: Set up Local User Presence ---
    provider.awareness.setLocalStateField("user", {
        id: currentUser.id,
        name: currentUser.name,
        color: getUserColor(currentUser.id),
    });

    updateCursorStyles(provider.awareness);

    const handleAwarenessChange = () => {
        updateCursorStyles(provider.awareness);
    };

    provider.awareness.on(
        "change",
        handleAwarenessChange
    );

    // ---------------------------------------

    let binding: InstanceType<typeof MonacoBinding> | null = null;

    const handleStatus = ({ status }: { status: "connecting" | "connected" | "disconnected" }) => {
        setStatus(status);
    };
    provider.on("status", handleStatus);

    const handleTextChange = (event: Y.YTextEvent) => {
        const content = text.toString();
        const local = binding !== null && event.transaction.origin === binding;
        onContentChange(content, local);
    };
    text.observe(handleTextChange);

    const handleSync = (synced: boolean) => {
        if (!synced || binding !== null) return;

        binding = new MonacoBinding(
            text,
            model,
            new Set([editorInstance]),
            provider.awareness
        );
        onContentChange(text.toString(), false);
    };
    provider.on("sync", handleSync);
    model.setEOL(0);
    if (provider.synced) handleSync(true);

    return {
        doc,
        text,
        provider,
        awareness: provider.awareness, // <-- Expose awareness
        binding: {
            destroy() {
                binding?.destroy();
                binding = null;
            },
        },
        destroy() {
            text.unobserve(handleTextChange);
            provider.off("status", handleStatus);
            provider.awareness.off(
                "change",
                handleAwarenessChange
            );
            provider.off("sync", handleSync);
            binding?.destroy();
            binding = null;
            provider.destroy();
            doc.destroy();
        },
    };
}

function escapeCssString(value: string): string {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, " ");
}

function updateCursorStyles(awareness: any) {
    let css = "";

    awareness.getStates().forEach(
        (state: any, clientId: number) => {
            const user = state?.user;

            if (!user?.color) {
                return;
            }

            css += `
                .yRemoteSelection-${clientId},
                .yRemoteSelectionHead-${clientId} {
                    --user-color: ${user.color};
                }

                .yRemoteSelectionHead-${clientId}::after {
                    content: "${escapeCssString(
                user.name ?? "User"
            )}";
                }
            `;
        }
    );

    let style = document.getElementById(
        "yjs-monaco-cursor-styles"
    ) as HTMLStyleElement | null;

    if (!style) {
        style = document.createElement("style");
        style.id = "yjs-monaco-cursor-styles";
        document.head.appendChild(style);
    }

    style.textContent = css;
}