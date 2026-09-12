import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
    process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const backendResponse = await fetch(
            `${BACKEND_URL}/api/auth/login`,
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

        /*
         * The Go backend creates the server-side session and returns
         * the session token through Set-Cookie.
         *
         * We forward that cookie to the browser rather than exposing
         * the session token to JavaScript.
         */
        const response = NextResponse.json(
            { message: "Login successful" },
            { status: 200 }
        );

        const setCookie = backendResponse.headers.get("set-cookie");

        if (setCookie) {
            response.headers.set("set-cookie", setCookie);
        }

        return response;
    } catch (error) {
        console.error("Login proxy failed:", error);

        return NextResponse.json(
            { message: "Authentication service unavailable." },
            { status: 502 }
        );
    }
}