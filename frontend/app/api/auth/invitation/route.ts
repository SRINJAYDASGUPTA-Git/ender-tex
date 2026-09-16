import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
        return NextResponse.json(
            { error: "Invitation token is required" },
            { status: 400 }
        );
    }

    const response = await fetch(
        `${BACKEND_URL}/api/auth/invitation?token=${encodeURIComponent(token)}`,
        {
            method: "GET",
            cache: "no-store",
        }
    );

    const data = await response.json();

    return NextResponse.json(data, {
        status: response.status,
    });
}