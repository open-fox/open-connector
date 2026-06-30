export function localHeaders(headers: HeadersInit = {}): HeadersInit {
  const token = process.env.OOMOL_CONNECT_API_TOKEN;
  if (!token) {
    return headers;
  }

  return {
    ...headers,
    authorization: `Bearer ${token}`,
  };
}
