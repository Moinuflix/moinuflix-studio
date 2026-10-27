import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
  const repo = "Moinuflix/My-Movies";
  const branch = "main";
  
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${repo}/${branch}/inbox_arrivals.json?t=${Date.now()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    
    if (!res.ok) {
      return NextResponse.json({ arrivals: [] });
    }
    const data = await res.json();
    return NextResponse.json({ arrivals: Array.isArray(data) ? data : [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, arrivals: [] }, { status: 500 });
  }
}
