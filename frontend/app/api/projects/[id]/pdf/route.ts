import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const response = await fetch(
            `${BACKEND_URL}/api/projects/${id}/pdf`,
            {
                method: "GET",
                headers: {
                    Cookie: request.headers.get("cookie") ?? "",
                },
            }
        );

        if (!response.ok) {
            const text = await response.text();

            return new NextResponse(text, {
                status: response.status,
            });
        }

        const pdf = await response.arrayBuffer();

        return new NextResponse(pdf, {
            status: 200,
            headers: {
                "Content-Type":
                    response.headers.get("content-type") ??
                    "application/pdf",
                "Content-Disposition":
                    response.headers.get("content-disposition") ??
                    'inline; filename="current.pdf"',
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        console.error("PDF proxy error:", error);

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