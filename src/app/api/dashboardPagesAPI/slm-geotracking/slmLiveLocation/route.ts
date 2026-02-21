// src/app/api/dashboardPagesAPI/slm-geotracking/slmLiveLocation/route.ts
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest){
  return NextResponse.json(0, { status: 200 });
}