const BASE_URL = "https://dummyjson.com";

export class DummyJsonError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "DummyJsonError";
  }
}

function buildQueryString(params: Record<string, any>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      search.append(key, String(value));
    }
  }
  return search.toString();
}

export async function get<T = unknown>(
  path: string,
  params: Record<string, any> = {},
): Promise<T> {
  const query = buildQueryString(params);
  const url = `${BASE_URL}${path}${query ? `?${query}` : ""}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new DummyJsonError(
      `DummyJSON API error: ${response.statusText}`,
      response.status,
    );
  }

  return response.json() as Promise<T>;
}
