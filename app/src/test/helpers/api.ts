import { NextRequest } from "next/server";

interface MockRequestOptions {
  method: "GET" | "POST" | "DELETE" | "PUT" | "PATCH";
  url: string;
  body?: object;
  headers?: Record<string, string>;
}

export function createMockRequest(options: MockRequestOptions): NextRequest {
  const { method, url, body, headers = {} } = options;

  const fullUrl = url.startsWith("http") ? url : `http://localhost:3000${url}`;

  const requestInit: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body && method !== "GET") {
    requestInit.body = JSON.stringify(body);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextRequest(fullUrl, requestInit as any);
}
