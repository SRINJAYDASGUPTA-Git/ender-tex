import {NextRequest, NextResponse} from "next/server";

const BACKEND_URL =
    process.env.BACKEND_URL ??
    "http://localhost:8080";

export async function GET(
    request: NextRequest
) {
    try {
        const cookie =
            request.headers.get("cookie");

        if (!cookie) {
            return NextResponse.json(
                {message: "Unauthorized"},
                {status: 401}
            );
        }

        const response = await fetch(
            `${BACKEND_URL}/api/collaboration/token`,
            {
                headers: {
                    Cookie: cookie,
                },
                cache: "no-store",
            }
        );

        const data = await response.json();

        return NextResponse.json(
            data,
            {
                status: response.status,
            }
        );
    } catch (error) {
        console.error(
            "Collaboration token proxy failed:",
            error
        );

        return NextResponse.json(
            {
                message:
                    "Collaboration service unavailable.",
            },
            {
                status: 502,
            }
        );
    }
}