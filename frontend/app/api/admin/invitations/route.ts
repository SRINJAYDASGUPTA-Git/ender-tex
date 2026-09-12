import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
    process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const cookie = request.headers.get("cookie");

        const backendResponse = await fetch(
            `${BACKEND_URL}/api/admin/invitations`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(cookie ? { Cookie: cookie } : {}),
                },
                body: JSON.stringify(body),
                cache: "no-store",
            }
        );

        const data = await backendResponse.json();

        return NextResponse.json(data, {
            status: backendResponse.status,
        });
    } catch (error) {
        console.error("Create invitation proxy failed:", error);

        return NextResponse.json(
            { message: "Authentication service unavailable." },
            { status: 502 }
        );
    }
}