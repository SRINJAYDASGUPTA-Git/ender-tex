import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
    process.env.BACKEND_URL ?? "http://localhost:8080";

interface RouteContext {
    params: Promise<{
        id: string;
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

        const { id } = await params;

        const backendResponse = await fetch(
            `${BACKEND_URL}/api/projects/${encodeURIComponent(id)}/files`,
            {
                method: "GET",
                headers: {
                    Cookie: cookie,
                },
                cache: "no-store",
            }
        );

        const data = await backendResponse.json();

        return NextResponse.json(data, {
            status: backendResponse.status,
        });
    } catch (error) {
        console.error("Project files proxy failed:", error);

        return NextResponse.json(
            { message: "Project files service unavailable." },
            { status: 502 }
        );
    }
}