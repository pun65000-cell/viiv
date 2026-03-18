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
      .from("public.viiv_products")
      .select("*")
      .eq("tenant_id", tenantId);

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

fastify.listen({ port: 7000, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`concore-api listening on ${address}`);
});
