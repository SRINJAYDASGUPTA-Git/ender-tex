import { NextRequest, NextResponse } from "next/server";
import { Project } from "@/types";

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
            `${BACKEND_URL}/api/projects/${encodeURIComponent(id)}`,
            {
                method: "GET",
                headers: {
                    Cookie: cookie,
                },
                cache: "no-store",
            }
        );

        const data: Project = await backendResponse.json();

        return NextResponse.json(data, {
            status: backendResponse.status,
        });
    } catch (error) {
        console.error("Project proxy failed:", error);

        return NextResponse.json(
            { message: "Projects service unavailable." },
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

        const { id } = await params;

        const backendResponse = await fetch(
            `${BACKEND_URL}/api/projects/${encodeURIComponent(id)}`,
            {
                method: "DELETE",
                headers: {
                    Cookie: cookie,
                },
            }
        );

        const text = await backendResponse.text();

        let data: unknown = null;

        if (text) {
            try {
                data = JSON.parse(text);
            } catch {
                data = { message: text };
            }
        }

        return NextResponse.json(data, {
            status: backendResponse.status,
        });
    } catch (error) {
        console.error("Project deletion proxy failed:", error);

        return NextResponse.json(
            { message: "Projects service unavailable." },
            { status: 502 }
        );
    }
}