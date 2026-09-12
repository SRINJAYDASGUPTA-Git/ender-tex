import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
    process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const backendResponse = await fetch(
            `${BACKEND_URL}/api/auth/accept-invitation`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
                cache: "no-store",
            }
        );

        const data = await backendResponse.json();

        if (!backendResponse.ok) {
            return NextResponse.json(data, {
                status: backendResponse.status,
            });
        }

        return NextResponse.json(data, {
            status: backendResponse.status,
        });
    } catch (error) {
        console.error("Accept invitation proxy failed:", error);

        return NextResponse.json(
            { message: "Authentication service unavailable." },
            { status: 502 }
        );
    }
}