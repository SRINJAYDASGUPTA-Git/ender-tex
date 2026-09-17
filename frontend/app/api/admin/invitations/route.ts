import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const cookie = request.headers.get("cookie");

        const response = await fetch(
            `${BACKEND_URL}/api/admin/invitations`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(cookie ? { Cookie: cookie } : {}),
                },
                body: JSON.stringify(body),
            }
        );

        const data = await response.json();

        return NextResponse.json(data, {
            status: response.status,
        });
    } catch (error) {
        console.error("Admin invitation proxy failed:", error);

        return NextResponse.json(
            { message: "Admin service unavailable." },
            { status: 502 }
        );
    }
}