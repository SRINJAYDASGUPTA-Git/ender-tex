import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
    process.env.BACKEND_URL ?? "http://localhost:8080";

interface RouteContext {
    params: Promise<{
        id: string;
        path: string[];
    }>;
}

export async function GET(
    request: NextRequest,
    { params }: RouteContext
) {
    try {
        const cookie = request.headers.get("cookie");

        if (!cookie) {
            return NextResponse.json(
                { message: "Unauthorized" },
                { status: 401 }
            );
        }

        const { id, path } = await params;

        const filePath = path.join("/");

        if (!filePath) {
            return NextResponse.json(
                { message: "File path is required." },
                { status: 400 }
            );
        }

        const backendResponse = await fetch(
            `${BACKEND_URL}/api/projects/${encodeURIComponent(id)}/files/${path
                .map(encodeURIComponent)
                .join("/")}`,
            {
                method: "GET",
                headers: {
                    Cookie: cookie,
                },
                cache: "no-store",
            }
        );

        const contentType =
            backendResponse.headers.get("content-type") ??
            "text/plain";

        const data = await backendResponse.arrayBuffer();

        return new NextResponse(data, {
            status: backendResponse.status,
            headers: {
                "Content-Type": contentType,
            },
        });
    } catch (error) {
        console.error("Project file proxy failed:", error);

        return NextResponse.json(
            { message: "Project file service unavailable." },
            { status: 502 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: RouteContext
) {
    try {
        const cookie = request.headers.get("cookie");

        if (!cookie) {
            return NextResponse.json(
                { message: "Unauthorized" },
                { status: 401 }
            );
        }

        const { id, path } = await params;

        if (!path || path.length === 0) {
            return NextResponse.json(
                { message: "File path is required." },
                { status: 400 }
            );
        }

        const body = await request.json();

        const backendResponse = await fetch(
            `${BACKEND_URL}/api/projects/${encodeURIComponent(id)}/files/${path
                .map(encodeURIComponent)
                .join("/")}`,
            {
                method: "PUT",
                headers: {
                    Cookie: cookie,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            }
        );

        const data = await backendResponse.json();

        return NextResponse.json(data, {
            status: backendResponse.status,
        });
    } catch (error) {
        console.error("Project file save proxy failed:", error);

        return NextResponse.json(
            { message: "Project file service unavailable." },
            { status: 502 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: RouteContext
) {
    try {
        const cookie = request.headers.get("cookie");

        if (!cookie) {
            return NextResponse.json(
                { message: "Unauthorized" },
                { status: 401 }
            );
        }

        const { id, path } = await params;

        if (!path || path.length === 0) {
            return NextResponse.json(
                { message: "File path is required." },
                { status: 400 }
            );
        }

        const backendResponse = await fetch(
            `${BACKEND_URL}/api/projects/${encodeURIComponent(id)}/files/${path
                .map(encodeURIComponent)
                .join("/")}`,
            {
                method: "POST",
                headers: {
                    Cookie: cookie,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(await request.json()),
            }
        );

        const data = await backendResponse.json();

        return NextResponse.json(data, {
            status: backendResponse.status,
        });
    } catch (error) {
        console.error("Project file creation proxy failed:", error);

        return NextResponse.json(
            { message: "Project file service unavailable." },
            { status: 502 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext
) {
    try {
        const cookie = request.headers.get("cookie");

        if (!cookie) {
            return NextResponse.json(
                { message: "Unauthorized" },
                { status: 401 }
            );
        }

        const { id, path } = await params;

        if (!path || path.length === 0) {
            return NextResponse.json(
                { message: "File path is required." },
                { status: 400 }
            );
        }

        const backendResponse = await fetch(
            `${BACKEND_URL}/api/projects/${encodeURIComponent(id)}/files/${path
                .map(encodeURIComponent)
                .join("/")}`,
            {
                method: "PATCH",
                headers: {
                    Cookie: cookie,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(await request.json()),
            }
        );

        const data = await backendResponse.json();

        return NextResponse.json(data, {
            status: backendResponse.status,
        });
    } catch (error) {
        console.error("Project file rename proxy failed:", error);

        return NextResponse.json(
            { message: "Project file service unavailable." },
            { status: 502 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: RouteContext
) {
    try {
        const cookie = request.headers.get("cookie");

        if (!cookie) {
            return NextResponse.json(
                { message: "Unauthorized" },
                { status: 401 }
            );
        }

        const { id, path } = await params;

        if (!path || path.length === 0) {
            return NextResponse.json(
                { message: "File path is required." },
                { status: 400 }
            );
        }

        const backendResponse = await fetch(
            `${BACKEND_URL}/api/projects/${encodeURIComponent(id)}/files/${path
                .map(encodeURIComponent)
                .join("/")}`,
            {
                method: "DELETE",
                headers: {
                    Cookie: cookie,
                },
            }
        );

        const text = await backendResponse.text();

        if (!text) {
            return new NextResponse(null, {
                status: backendResponse.status,
            });
        }

        return NextResponse.json(JSON.parse(text), {
            status: backendResponse.status,
        });
    } catch (error) {
        console.error("Project file deletion proxy failed:", error);

        return NextResponse.json(
            { message: "Project file service unavailable." },
            { status: 502 }
        );
    }
}

