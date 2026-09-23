import {NextRequest, NextResponse} from "next/server";

const BACKEND_URL =
    process.env.BACKEND_URL ??
    "http://localhost:8080";

export async function GET(
    request: NextRequest,
    {params}: {
        params: Promise<{
            id: string;
        }>;
    }
) {
    try {
        const {id} = await params;

        const response = await fetch(
            `${BACKEND_URL}/api/projects/${encodeURIComponent(id)}/pdf/download`,
            {
                method: "GET",
                headers: {
                    Cookie:
                        request.headers.get(
                            "cookie"
                        ) ?? "",
                },
                cache: "no-store",
            }
        );

        const body =
            await response.arrayBuffer();

        return new NextResponse(body, {
            status: response.status,
            headers: {
                "Content-Type":
                    response.headers.get(
                        "content-type"
                    ) ?? "application/pdf",

                "Content-Disposition":
                    response.headers.get(
                        "content-disposition"
                    ) ??
                    'attachment; filename="endertex-project.pdf"',

                "Cache-Control":
                    "no-store",
            },
        });
    } catch (error) {
        console.error(
            "PDF download proxy error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to download PDF.",
            },
            {
                status: 502,
            }
        );
    }
}