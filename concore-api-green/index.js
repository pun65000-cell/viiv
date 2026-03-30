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

try {
  fastify.register(require("@fastify/cors"), {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-tenant-id"],
  });
} catch (err) {}

const allowedOrigins = new Set(
  (process.env.FRONTEND_URL || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
);

fastify.addHook("onRequest", (request, reply, done) => {
  const origin = request.headers.origin;
  if (typeof origin === "string" && allowedOrigins.has(origin)) {
    reply.header("Access-Control-Allow-Origin", origin);
    reply.header("Vary", "Origin");
    reply.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    reply.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-tenant-id",
    );
  }

  if (request.method === "OPTIONS") {
    reply.code(204).send();
    return;
  }

  done();
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
    console.log("[REQUEST]", request.method, request.url);

    const body = request.body || {};
    const name = body.name;

    if (typeof name !== "string") {
      reply.code(400).send({ message: "Invalid input" });
      return;
    }

    const baseSlug = generateSlug(name);

    if (baseSlug.length < 3 || !/^[a-z0-9-]+$/.test(baseSlug)) {
      reply.code(400).send({ message: "Invalid input" });
      return;
    }

    for (let i = 0; i < 100; i += 1) {
      const slug = i === 0 ? baseSlug : `${baseSlug}-${i}`;

      const { data: existing, error: existsError } = await supabase
        .from("shops")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (existsError) {
        console.error("[SUPABASE ERROR]", existsError);
        reply.code(500).send({ message: "Database error" });
        return;
      }

      if (existing) {
        continue;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("shops")
        .insert([{ name, slug }])
        .select("name,slug")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          continue;
        }
        console.error("[SUPABASE ERROR]", insertError);
        reply.code(500).send({ message: "Database error" });
        return;
      }

      reply.send({
        name: inserted.name,
        slug: inserted.slug,
        url: `${process.env.PUBLIC_BASE_URL}/${inserted.slug}`,
      });
      return;
    }

    reply.code(409).send({ message: "shop already exists" });
  } catch (err) {
    console.error(err);
    reply.code(500).send({ message: "Internal error" });
  }
});

fastify.get("/viiv/products", async (request, reply) => {
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
      .from("public.viiv_products")
      .insert([{ tenant_id: tenantId, name, price }])
      .select();

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

fastify.get('/test', async (request, reply) => { 
  return { message: 'API WORKING' } 
})

fastify.get('/products', async (request, reply) => { 
  const { data, error } = await supabase 
    .from('products') 
    .select('*') 

  if (error) { 
    return { 
      success: false, 
      error: error.message 
    } 
  } 

  return { 
    success: true, 
    data: data || [] 
  } 
}) 

fastify.listen({ port: process.env.PORT || 7000, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`concore-api listening on ${address}`);
});
