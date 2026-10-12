async function dump(path) {
  const res = await fetch(`http://127.0.0.1:8080${path}`, { redirect: "manual" });
  const text = await res.text();
  console.log("\n==", path, res.status, res.headers.get("location"), "len", text.length);
  const title = text.match(/<h1[^>]*>([^<]+)/);
  console.log("h1", title?.[1]?.slice(0, 120));
  if (path.includes("get-session") || path.includes("sign-")) console.log("body", text.slice(0, 300));
}

await dump("/ar/products/00000000-0000-4000-8000-000000000000");
await dump("/ar/products/not-a-uuid");
await dump("/ar/products/c3000001-0000-4000-8000-000000000001");
await dump("/ar/troops");
await dump("/ar/troops/00000000-0000-4000-8000-000000000000");
await dump("/fr/products");
await dump("/ar/account");
await dump("/ar/admin");
await dump("/api/auth/get-session");

const signIn = await fetch("http://127.0.0.1:8080/api/auth/sign-in/email", {
  method: "POST",
  headers: { "content-type": "application/json", origin: "http://127.0.0.1:8080" },
  body: JSON.stringify({ email: "nobody@example.com", password: "wrong-password-123" }),
});
console.log("\n== sign-in", signIn.status, (await signIn.text()).slice(0, 300), signIn.headers.get("set-cookie"));

const signUp = await fetch("http://127.0.0.1:8080/api/auth/sign-up/email", {
  method: "POST",
  headers: { "content-type": "application/json", origin: "http://127.0.0.1:8080" },
  body: JSON.stringify({ email: "too-short@example.com", password: "123", name: "Test User" }),
});
console.log("== sign-up", signUp.status, (await signUp.text()).slice(0, 300));
