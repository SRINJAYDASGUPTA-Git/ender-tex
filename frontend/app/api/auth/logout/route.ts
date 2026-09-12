import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
    process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(request: NextRequest) {
    try {
        const cookie = request.headers.get("cookie");

        const backendResponse = await fetch(
            `${BACKEND_URL}/api/auth/logout`,
            {
                method: "POST",
                headers: {
                    ...(cookie ? { Cookie: cookie } : {}),
                },
                cache: "no-store",
            }
        );

        if (!backendResponse.ok) {
            const data = await backendResponse.json().catch(() => ({
                message: "Logout failed.",
            }));

            return NextResponse.json(data, {
                status: backendResponse.status,
            });
        }

        const response = NextResponse.json(
            { message: "Logout successful" },
            { status: 200 }
        );

        // Forward the backend's cookie deletion.
        const setCookie = backendResponse.headers.get("set-cookie");

        if (setCookie) {
            response.headers.set("set-cookie", setCookie);
        }

        return response;
    } catch (error) {
        console.error("Logout proxy failed:", error);

        return NextResponse.json(
            { message: "Authentication service unavailable." },
            { status: 502 }
        );
    }
}