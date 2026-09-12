import { NextRequest, NextResponse } from "next/server";
import { UserResponse } from "@/types";

const BACKEND_URL =
    process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET(request: NextRequest) {
    try {
        const cookie = request.headers.get("cookie");

        if (!cookie) {
            return NextResponse.json(
                { message: "Unauthorized" },
                { status: 401 }
            );
        }

        const backendResponse = await fetch(
            `${BACKEND_URL}/api/auth/me`,
            {
                method: "GET",
                headers: {
                    Cookie: cookie,
                },
                cache: "no-store",
            }
        );

        const data: UserResponse =
            await backendResponse.json();
        console.log(data)
        return NextResponse.json(data, {
            status: backendResponse.status,
        });
    } catch (error) {
        console.error("User proxy failed:", error);

        return NextResponse.json(
            {
                message:
                    "Authentication service unavailable.",
            },
            { status: 502 }
        );
    }
}