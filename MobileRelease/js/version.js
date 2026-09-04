const LOCAL_PATH = "./version.json";

function compareVersions(a, b) {
  const norm = (v) => String(v || "").replace(/^v/i, "").split("-")[0].split(".").map((n) => parseInt(n, 10) || 0);
  const aa = norm(a);
  const bb = norm(b);
  const len = Math.max(aa.length, bb.length);
  for (let i = 0; i < len; i += 1) {
    const d = (aa[i] || 0) - (bb[i] || 0);
    if (d) return d;
  }
  return 0;
}

export async function loadLocalVersion() {
  const res = await fetch(`${LOCAL_PATH}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("version.json missing");
  return res.json();
}

export async function checkForUpdate(local) {
  const url = String(local.updateUrl || "").trim();
  if (!url) return { outdated: false, skipped: true, local };
  const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return { outdated: false, skipped: true, local };
  const remote = await res.json();
  const outdated = compareVersions(remote.version, local.version) > 0;
  return { outdated, skipped: false, local, remote };
}
