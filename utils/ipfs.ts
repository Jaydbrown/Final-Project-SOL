const PINATA_API_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

const getPinataJwt = () => (import.meta.env.VITE_PINATA_JWT as string | undefined)?.trim();
const getUploadTimeoutMs = () => {
  const raw = Number(import.meta.env.VITE_IPFS_UPLOAD_TIMEOUT_MS ?? 60000);
  return Number.isFinite(raw) && raw > 0 ? raw : 60000;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const uploadImageToIpfs = async (file: File): Promise<{ cid: string; uri: string; gatewayUrl: string }> => {
  const jwt = getPinataJwt();
  if (!jwt) {
    throw new Error("Missing VITE_PINATA_JWT. Add it to your app env (.env.local for local, or hosting env vars like Vercel) for IPFS image upload.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("pinataMetadata", JSON.stringify({ name: file.name || `localdao-logo-${Date.now()}` }));

  let response: Response | null = null;
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getUploadTimeoutMs());
    try {
      response = await fetch(PINATA_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      // Retry transient errors.
      if (response.status === 429 || (response.status >= 500 && response.status <= 599)) {
        if (attempt < maxAttempts) {
          await sleep(500 * attempt);
          continue;
        }
      }
      break;
    } catch (err) {
      clearTimeout(timeout);
      const isTimeout = err instanceof DOMException && err.name === "AbortError";
      if (attempt < maxAttempts) {
        await sleep(500 * attempt);
        continue;
      }
      if (isTimeout) {
        throw new Error("IPFS upload timed out after multiple retries. Check network and retry.");
      }
      throw new Error("IPFS upload failed after retries. Check network or CORS settings and retry.");
    }
  }

  if (!response) {
    throw new Error("IPFS upload failed: no response from Pinata.");
  }

  if (!response.ok) {
    const errorText = await response.text();
    if (errorText.includes("NO_SCOPES_FOUND")) {
      throw new Error(
        "Pinata key is missing required scopes. Enable `pinning.pinFileToIPFS` (or use an Admin key), then redeploy."
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("Pinata authentication failed. Check VITE_PINATA_JWT permissions.");
    }
    throw new Error(`IPFS upload failed: ${errorText || response.statusText}`);
  }

  const payload = (await response.json()) as { IpfsHash: string };
  const cid = payload.IpfsHash;
  if (!cid) throw new Error("IPFS upload failed: missing CID in response.");

  return {
    cid,
    uri: `ipfs://${cid}`,
    gatewayUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
  };
};
