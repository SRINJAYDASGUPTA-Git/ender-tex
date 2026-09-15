import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
    process.env.BACKEND_URL ?? "http://localhost:8080";

interface RouteContext {
    params: Promise<{
        id: string;
        path: string[];
    }>;
}

async function proxy(
    request: NextRequest,
    {params}: RouteContext,
    method: "POST" | "PATCH" | "DELETE"
) {
    try {
        const cookie = request.headers.get("cookie");

        if (!cookie) {
            return NextResponse.json(
                { message: "Unauthorized" },
                { status: 401 }
            );
        }

        const { id, path } = await params;

        if (!path || path.length === 0) {
            return NextResponse.json(
                { message: "Folder path is required." },
                { status: 400 }
            );
        }

        // const reqJSON = await request.json();
        // console.log(reqJSON);

        // const body =
        //     method === "DELETE" || reqJSON == undefined
        //         ? undefined
        //         : JSON.stringify(reqJSON);
        // console.log(body)

        let backendResponse
        if(request.method === "PATCH") {
            const body = await request.json();
            backendResponse = await fetch(
                `${BACKEND_URL}/api/projects/${encodeURIComponent(id)}/folders/${path
                    .map(encodeURIComponent)
                    .join("/")}`,
                {
                    method: "PATCH",
                    headers: {
                        Cookie: cookie,
                        body: JSON.stringify(body)
                    }
                }
            );
        } else{
            backendResponse = await fetch(
                `${BACKEND_URL}/api/projects/${encodeURIComponent(id)}/folders/${path
                    .map(encodeURIComponent)
                    .join("/")}`,
                {
                    method,
                    headers: {
                        Cookie: cookie,
                    }
                }
            );
        }

        const text = await backendResponse.text();

        if (!text) {
            return new NextResponse(null, {
                status: backendResponse.status,
            });
        }

        return NextResponse.json(JSON.parse(text), {
            status: backendResponse.status,
        });
    } catch (error) {
        console.error("Project folder proxy failed:", error);

        return NextResponse.json(
            { message: "Project folder service unavailable." },
            { status: 502 }
        );
    }
}

export async function POST(
    request: NextRequest,
    context: RouteContext
) {
    return proxy(request, context, "POST");
}

export async function PATCH(
    request: NextRequest,
    context: RouteContext
) {
    return proxy(request, context, "PATCH");
}

export async function DELETE(
    request: NextRequest,
    context: RouteContext
) {
    return proxy(request, context, "DELETE");
}