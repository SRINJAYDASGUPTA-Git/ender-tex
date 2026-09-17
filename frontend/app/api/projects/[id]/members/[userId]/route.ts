import {NextRequest, NextResponse} from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

type RouteContext = {
    params: Promise<{
        id: string;
        userId: string;
    }>;
};

export async function PATCH(
    request: NextRequest,
    {params}: RouteContext
) {
    const {id, userId} = await params;

    const body = await request.text();

    const response = await fetch(
        `${BACKEND_URL}/api/projects/${id}/members/${userId}`,
        {
            method: "PATCH",
            headers: {
                Cookie: request.headers.get("cookie") ?? "",
                "Content-Type":
                    request.headers.get("content-type") ?? "application/json",
            },
            body,
        }
    );

    const data = await response.json();

    return NextResponse.json(data, {
        status: response.status,
    });
}

export async function DELETE(
    request: NextRequest,
    {params}: RouteContext
) {
    const {id, userId} = await params;

    const response = await fetch(
        `${BACKEND_URL}/api/projects/${id}/members/${userId}`,
        {
            method: "DELETE",
            headers: {
                Cookie: request.headers.get("cookie") ?? "",
            },
        }
    );

    const data = await response.json();

    return NextResponse.json(data, {
        status: response.status,
    });
}