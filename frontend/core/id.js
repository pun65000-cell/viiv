export function genId(prefix) {
  const ts = Math.floor(Date.now() / 1000);
  const rand = Math.random().toString(36).substring(2, 6);
  return `${prefix}_${ts}_${rand}`;
}

if (typeof window !== "undefined") {
  window.genId = genId;
}
