import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
    process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(request: NextRequest) {
    const body = await request.json();

    const cookie = request.headers.get("cookie");

    const response = await fetch(
        `${BACKEND_URL}/api/auth/accept-invitation`,
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

    const nextResponse = NextResponse.json(data, {
        status: response.status,
    });

    const setCookie = response.headers.get("set-cookie");

    if (setCookie) {
        nextResponse.headers.set("set-cookie", setCookie);
    }

    return nextResponse;
}