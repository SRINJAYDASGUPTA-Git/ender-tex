import { NextRequest, NextResponse } from "next/server";
import { Project } from "@/types";

const BACKEND_URL =
    process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET(request: NextRequest) {
    try {
        const cookie = request.headers.get("cookie");

        if (!cookie) {
            return NextResponse.json(
                { message: "Unauthorized" },
                { status: 401 }
            );
        }

        const backendResponse = await fetch(
            `${BACKEND_URL}/api/projects`,
            {
                method: "GET",
                headers: {
                    Cookie: cookie,
                },
                cache: "no-store",
            }
        );

        const data: Project[] = await backendResponse.json();

        return NextResponse.json(data, {
            status: backendResponse.status,
        });
    } catch (error) {
        console.error("Project proxy failed:", error);

        return NextResponse.json(
            {
                message: "Projects service unavailable.",
            },
            { status: 502 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const cookie = request.headers.get("cookie");

        if (!cookie) {
            return NextResponse.json(
                { message: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await request.json();

        const backendResponse = await fetch(
            `${BACKEND_URL}/api/projects`,
            {
                method: "POST",
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
        console.error("Project creation proxy failed:", error);

        return NextResponse.json(
            { message: "Projects service unavailable." },
            { status: 502 }
        );
    }
}