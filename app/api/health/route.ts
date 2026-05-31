import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const timestamp = new Date().toISOString()

  try {
    // Ping Supabase to keep connection alive
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("users")
      .select("count", { count: "exact", head: true })

    const supabaseStatus = error ? "error" : "ok"

    return NextResponse.json({
      status: "ok",
      timestamp,
      supabase: supabaseStatus,
      message: "Service is healthy",
    }, { status: 200 })
  } catch (err) {
    return NextResponse.json({
      status: "error",
      timestamp,
      supabase: "unreachable",
      message: "Service check failed",
      error: err instanceof Error ? err.message : "Unknown error",
    }, { status: 500 })
  }
}
