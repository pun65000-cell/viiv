"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type PageProps = {
  params: {
    store: string;
  };
};

type Product = {
  id: string;
  name: string;
  price: number;
  variantId?: string;
};

type CartItem = Product & {
  quantity: number;
};

const mockProducts: Product[] = [
  { id: "p1", name: "Chicken Salad", price: 129 },
  { id: "p2", name: "Avocado Bowl", price: 149 },
  { id: "p3", name: "Low Carb Meal", price: 139 },
];

const MEDUSA_BASE_URL = "http://localhost:9000";

function parseVariantId(product: any): string | undefined {
  const variants: any[] | undefined = product?.variants;
  const first = Array.isArray(variants) ? variants[0] : null;
  return typeof first?.id === "string" ? first.id : undefined;
}

function parseVariantPrice(product: any): number | undefined {
  const variants: any[] | undefined = product?.variants;
  const first = Array.isArray(variants) ? variants[0] : null;
  const prices: any[] | undefined = first?.prices ?? first?.price_set?.prices ?? undefined;
  const p = Array.isArray(prices) ? prices[0] : null;
  const amount = typeof p?.amount === "number" ? p.amount : null;
  if (amount === null) return undefined;
  return amount % 100 === 0 ? amount / 100 : Number((amount / 100).toFixed(2));
}

export default function PosPage({ params }: PageProps) {
  const { store } = params;
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const res = await fetch(`${MEDUSA_BASE_URL}/store/products`, {
          method: "GET",
        });
        if (!res.ok) return;

        const json: any = await res.json();
        const items: any[] | undefined = json?.products ?? json?.data;
        if (!Array.isArray(items)) return;

        const mapped: Product[] = items
          .map((p) => {
            const title =
              typeof p?.title === "string"
                ? p.title
                : typeof p?.name === "string"
                  ? p.name
                  : null;
            if (!title || typeof p?.id !== "string") return null;

            const variantId = parseVariantId(p);
            const price = parseVariantPrice(p) ?? 0;
            return { id: p.id, name: title, price, variantId };
          })
          .filter(Boolean)
          .slice(0, 24) as Product[];

        if (!cancelled && mapped.length > 0) setProducts(mapped);
      } catch {
        return;
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPrice = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((p) => p.id === product.id);
      if (!existing) return [...prev, { ...product, quantity: 1 }];
      return prev.map((p) =>
        p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p,
      );
    });
  };

  const checkout = async () => {
    setIsCheckingOut(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const createCartRes = await fetch(`${MEDUSA_BASE_URL}/store/carts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      const createCartJson: any = await createCartRes.json().catch(() => null);
      if (!createCartRes.ok) {
        throw new Error(
          createCartJson?.message ?? "Failed to create cart in Medusa",
        );
      }

      const cartId: string | undefined =
        createCartJson?.cart?.id ?? createCartJson?.id;
      if (!cartId) throw new Error("Medusa cart_id missing from response");

      for (const item of cart) {
        const variantId = item.variantId ?? item.id;
        const addRes = await fetch(
          `${MEDUSA_BASE_URL}/store/carts/${cartId}/line-items`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              variant_id: variantId,
              quantity: item.quantity,
            }),
          },
        );

        const addJson: any = await addRes.json().catch(() => null);
        if (!addRes.ok) {
          throw new Error(addJson?.message ?? `Failed to add item: ${item.name}`);
        }
      }

      const completeRes = await fetch(
        `${MEDUSA_BASE_URL}/store/carts/${cartId}/complete`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );

      const completeJson: any = await completeRes.json().catch(() => null);
      if (!completeRes.ok) {
        throw new Error(completeJson?.message ?? "Failed to complete cart");
      }

      setCart([]);
      const orderId: string | undefined =
        completeJson?.order?.id ?? completeJson?.data?.order?.id;
      setStatusMessage(orderId ? `Order created: ${orderId}` : "Checkout success");
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <main style={{ maxWidth: 980, margin: "48px auto", padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: "#666" }}>POS</div>
          <h1 style={{ margin: 0 }}>POS - {store}</h1>
        </div>
        <Link href={`/${store}`}>Back to Storefront</Link>
      </div>

      {statusMessage ? (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 10,
            border: "1px solid #b7eb8f",
            background: "#f6ffed",
          }}
        >
          {statusMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 10,
            border: "1px solid #ffa39e",
            background: "#fff2f0",
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        <section>
          <h2 style={{ marginTop: 0 }}>Products</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                style={{
                  border: "1px solid #111",
                  background: "#111",
                  color: "#fff",
                  padding: "10px 14px",
                  borderRadius: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => addToCart(p)}
              >
                {p.name} (฿{p.price})
              </button>
            ))}
          </div>
        </section>

        <aside
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 16,
            background: "#fff",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Cart</h2>

          {cart.length === 0 ? (
            <div style={{ color: "#666" }}>Cart is empty.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {cart.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "baseline",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      Qty: {item.quantity}
                    </div>
                  </div>
                  <div style={{ fontFamily: "monospace" }}>
                    ฿{item.price * item.quantity}
                  </div>
                </div>
              ))}

              <div
                style={{
                  borderTop: "1px solid #eee",
                  paddingTop: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 700,
                }}
              >
                <div>Total</div>
                <div style={{ fontFamily: "monospace" }}>฿{totalPrice}</div>
              </div>
            </div>
          )}

          <button
            type="button"
            style={{
              width: "100%",
              marginTop: 16,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
              opacity: cart.length === 0 || isCheckingOut ? 0.6 : 1,
            }}
            disabled={cart.length === 0 || isCheckingOut}
            onClick={checkout}
          >
            {isCheckingOut ? "Checking out..." : "Checkout"}
          </button>
        </aside>
      </div>
    </main>
  );
}
