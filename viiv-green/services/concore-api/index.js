console.log("=== CONCORE GREEN START ===");
console.log("RUNNING FROM:", __dirname);
console.log("SUPABASE_URL =", process.env.SUPABASE_URL);

require("dotenv").config();

console.log("SUPABASE_URL =", process.env.SUPABASE_URL);
console.log("SUPABASE_KEY =", process.env.SUPABASE_SERVICE_KEY?.slice(0, 30));

const dotenv = require("dotenv");
dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const fastify = require("fastify")({ logger: true });

fastify.register(require("@fastify/cors"), {
  origin: true,
});
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    global: {
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        apikey: process.env.SUPABASE_SERVICE_KEY,
      },
    },
  },
);

const generateSlug = (name) => {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
};

fastify.post("/shops", async (request, reply) => {
  try {
    const body = request.body || {};
    const name = body.name;

    if (typeof name !== "string") {
      return reply.code(400).send({ message: "Invalid input" });
    }

    const baseSlug = generateSlug(name);

    for (let i = 0; i < 100; i++) {
      const slug = i === 0 ? baseSlug : `${baseSlug}-${i}`;

      const { data: existing, error: existsError } = await supabase
        .from("shops")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (existsError) {
        console.error("SHOP ERROR FULL:", existsError);
        return reply.code(500).send({
          message: "Database error",
          error: existsError,
        });
      }

      if (existing) continue;

      const { data, error: insertError } = await supabase
        .from("shops")
        .insert([{ name, slug }])
        .select()
        .single();

      if (insertError) {
        console.error("SHOP ERROR FULL:", insertError || existsError);
        return reply.code(500).send({
          message: "Database error",
          error: insertError || existsError || null,
        });
      }

      return reply.send({
        name: data.name,
        slug: data.slug,
        tenant_id: data.slug,
        url: `https://${data.slug}.viiv.me`,
      });
    }

    return reply.code(409).send({ message: "shop exists" });
  } catch (err) {
    console.error(err);
    return reply.code(500).send({ message: "Internal error" });
  }
});

fastify.get("/viiv/products", async (request, reply) => {
  try {
    console.log("[REQUEST]", request.method, request.url);

    const tenantIdHeader = request.headers["x-tenant-id"];
    const tenantIdQuery = request.query?.tenant_id;

    const tenantId =
      (Array.isArray(tenantIdHeader) ? tenantIdHeader[0] : tenantIdHeader) ||
      tenantIdQuery;

    if (!tenantId || typeof tenantId !== "string") {
      reply.code(400).send({ success: false, message: "Missing tenant_id" });
      return;
    }

    const { data, error } = await supabase
  .from("viiv_products")
  .select("*")
  .eq("tenant_id", tenantId);

console.log("SUPABASE_URL =", process.env.SUPABASE_URL);

if (error) {
  console.error("🔥 SUPABASE ERROR FULL:", JSON.stringify(error, null, 2));
  reply.code(500).send({ success: false, message: "Database error" });
  return;
}

    reply.send({ success: true, data });
  } catch (err) {
    reply.code(500).send({ success: false, message: "Internal error" });
  }
});

fastify.post("/viiv/products", async (request, reply) => {
  try {
    console.log("[REQUEST]", request.method, request.url);

    const tenantIdHeader = request.headers["x-tenant-id"];
    const tenantId = Array.isArray(tenantIdHeader)
      ? tenantIdHeader[0]
      : tenantIdHeader;

    if (!tenantId || typeof tenantId !== "string") {
      reply.code(400).send({ success: false, message: "Missing tenant_id" });
      return;
    }

    const body = request.body || {};
    const name = body.name;
    const price = body.price;

    if (typeof name !== "string" || typeof price !== "number") {
      reply.code(400).send({ success: false, message: "Invalid body" });
      return;
    }

    const { data, error } = await supabase
      .from("viiv_products")
      .insert([{ tenant_id: tenantId, name, price }])
      .select("*");

    if (error) {
      console.error("SUPABASE ERROR FULL:");
console.error(error);
console.error(JSON.stringify(error, null, 2));
      reply.code(500).send({ success: false, message: "Database error" });
      return;
    }

    reply.send({ success: true, data });
  } catch (err) {
    reply.code(500).send({ success: false, message: "Internal error" });
  }
});

const PORT = process.env.PORT || 7000;

fastify.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`concore-api listening on ${address}`);
});
