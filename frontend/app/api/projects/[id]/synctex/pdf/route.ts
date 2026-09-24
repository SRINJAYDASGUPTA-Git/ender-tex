import {NextRequest, NextResponse} from "next/server";

const BACKEND_URL =
    process.env.BACKEND_URL ?? "http://localhost:8080";

interface RouteContext {
    params: Promise<{
        id: string;
    }>;
}

export async function POST(
    request: NextRequest,
    {params}: RouteContext,
) {
    const {id} = await params;

    const cookie = request.headers.get("cookie");

    if (!cookie) {
        return NextResponse.json(
            {message: "Unauthorized"},
            {status: 401},
        );
    }

    const body = await request.json();

    const response = await fetch(
        `${BACKEND_URL}/api/projects/${encodeURIComponent(id)}/synctex/pdf`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Cookie: cookie,
            },
            body: JSON.stringify(body),
            cache: "no-store",
        },
    );

    const data = await response.json();

    return NextResponse.json(data, {
        status: response.status,
    });
}