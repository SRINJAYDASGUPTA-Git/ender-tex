import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
    process.env.BACKEND_URL ?? "http://localhost:8080";

interface RouteContext {
    params: Promise<{
        id: string;
        jobId: string;
    }>;
}

export async function GET(
    request: NextRequest,
    { params }: RouteContext
) {
    try {
        const {id, jobId} = await params;

        const cookie = request.headers.get("cookie");

        if (!cookie) {
            return NextResponse.json(
                {message: "Unauthorized"},
                {status: 401}
            );
        }

        const response = await fetch(
            `${BACKEND_URL}/api/projects/${encodeURIComponent(id)}/compile/${encodeURIComponent(jobId)}`,
            {
                method: "GET",
                headers: {
                    Cookie: cookie,
                },
                cache: "no-store",
            }
        );

        const contentType =
            response.headers.get("content-type");

        if (contentType?.includes("application/json")) {
            const data = await response.json();

            return NextResponse.json(data, {
                status: response.status,
            });
        }

        const text = await response.text();

        return new NextResponse(text, {
            status: response.status,
        });
    } catch (error) {
        console.error(
            "Compile status proxy error:",
            error
        );

        return NextResponse.json(
            {
                error: "Failed to connect to backend.",
            },
            {
                status: 502,
            }
        );
    }
}