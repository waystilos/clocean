export async function fetchAuthenticatedFile(
  url: string,
  sessionToken: string | null,
  fetchImpl: typeof fetch = fetch,
  userEmail?: string,
): Promise<Blob> {
  const headers: Record<string, string> = {};
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
  if (userEmail) headers["x-user-email"] = userEmail;

  const response = await fetchImpl(url, {
    credentials: "same-origin",
    headers,
  });
  if (!response.ok) {
    throw new Error(`Unable to load file preview (${response.status})`);
  }
  return response.blob();
}
