import { handleRequest } from '../src/app.js';

/**
 * Single Vercel Function entry point for /api/v1/* (see vercel.json rewrite).
 * One function keeps cold starts and the Hobby-plan function limit in check;
 * all logic lives in src/ (spec §8.0.7: thin handlers).
 */
export function GET(request: Request) {
  return handleRequest(request);
}
export function POST(request: Request) {
  return handleRequest(request);
}
export function PATCH(request: Request) {
  return handleRequest(request);
}
export function PUT(request: Request) {
  return handleRequest(request);
}
export function DELETE(request: Request) {
  return handleRequest(request);
}
export function OPTIONS(request: Request) {
  return handleRequest(request);
}
