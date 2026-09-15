import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const response = await fetch(
            `${BACKEND_URL}/api/projects/${id}/compile`,
            {
                method: "POST",
                headers: {
                    Cookie: request.headers.get("cookie") ?? "",
                },
            }
        );

        const contentType = response.headers.get("content-type");

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
        console.error("Compile proxy error:", error);

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