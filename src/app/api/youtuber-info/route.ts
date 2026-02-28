import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { urls } = body;

        if (!urls || !Array.isArray(urls)) {
            return NextResponse.json({ error: 'Invalid or missing "urls" array' }, { status: 400 });
        }

        const results = await Promise.all(
            urls.map(async (url) => {
                try {
                    const response = await fetch(url, {
                        headers: {
                            'User-Agent':
                                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept-Language': 'en-US,en;q=0.9',
                        },
                    });
                    const html = await response.text();

                    // Extract og:title and og:image using regex
                    const titleMatch = html.match(/<meta\s+(?:property|name)="og:title"\s+content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
                    const imageMatch = html.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i);

                    let name = url;
                    if (titleMatch && titleMatch[1]) {
                        // remove " - YouTube" if present
                        name = titleMatch[1].replace(' - YouTube', '').trim();
                    }

                    const photoUrl = imageMatch ? imageMatch[1] : '';

                    return {
                        url,
                        name,
                        photoUrl,
                        email: '',
                        status: 'success',
                    };
                } catch (err: any) {
                    return {
                        url,
                        error: err.message,
                        status: 'error',
                    };
                }
            })
        );

        return NextResponse.json({ results });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
