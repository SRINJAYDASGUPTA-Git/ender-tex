import {NextRequest, NextResponse} from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function GET(
    request: NextRequest,
    {params}: {params: Promise<{id: string}>}
) {
    const {id} = await params;

    const response = await fetch(
        `${BACKEND_URL}/api/projects/${id}/invitations`,
        {
            method: "GET",
            headers: {
                Cookie: request.headers.get("cookie") ?? "",
            },
            cache: "no-store",
        }
    );

    const data = await response.json();

    return NextResponse.json(data, {
        status: response.status,
    });
}