import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
    process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                { message: "Project ID is required." },
                { status: 400 }
            );
        }

        const formData = await request.formData();

        const response = await fetch(
            `${BACKEND_URL}/api/projects/${id}/upload`,
            {
                method: "POST",
                headers: {
                    // Forward the browser session cookie.
                    Cookie: request.headers.get("cookie") ?? "",
                },
                body: formData,
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
            headers: {
                "Content-Type":
                    contentType ?? "text/plain",
            },
        });
    } catch (error) {
        console.error("Project upload proxy error:", error);

        return NextResponse.json(
            {
                message: "Failed to upload project files.",
            },
            { status: 500 }
        );
    }
}