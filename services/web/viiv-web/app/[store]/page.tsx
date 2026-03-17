import Link from "next/link";

type PageProps = {
  params: Promise<{
    store: string;
  }>;
};

type ProductCard = {
  id: string;
  title: string;
  priceLabel: string;
};

const mockProducts: ProductCard[] = [
  { id: "p1", title: "Chicken Salad", priceLabel: "฿129" },
  { id: "p2", title: "Avocado Bowl", priceLabel: "฿149" },
  { id: "p3", title: "Low Carb Meal", priceLabel: "฿139" },
];

function formatVariantPrice(variant: any): string | null {
  const prices: any[] | undefined =
    variant?.prices ?? variant?.price_set?.prices ?? variant?.calculated_price?.prices;

  const first = Array.isArray(prices) ? prices[0] : null;
  const amount =
    typeof first?.amount === "number"
      ? first.amount
      : typeof variant?.calculated_price?.calculated_amount === "number"
        ? variant.calculated_price.calculated_amount
        : null;

  const currency =
    typeof first?.currency_code === "string"
      ? first.currency_code
      : typeof variant?.calculated_price?.currency_code === "string"
        ? variant.calculated_price.currency_code
        : null;

  if (amount === null) return null;

  const normalized = amount % 100 === 0 ? (amount / 100).toFixed(0) : (amount / 100).toFixed(2);
  if (!currency) return normalized;
  if (currency.toLowerCase() === "thb") return `฿${normalized}`;
  return `${currency.toUpperCase()} ${normalized}`;
}

async function fetchMedusaProducts(): Promise<ProductCard[] | null> {
  try {
    const res = await fetch("http://localhost:9000/store/products", {
      cache: "no-store",
    });

    if (!res.ok) return null;

    const json: any = await res.json();
    const products: any[] | undefined = json?.products ?? json?.data;
    if (!Array.isArray(products)) return null;

    return products
      .map((p) => {
        const title =
          typeof p?.title === "string" ? p.title : typeof p?.name === "string" ? p.name : "Untitled";
        const variant = Array.isArray(p?.variants) ? p.variants[0] : null;
        const priceLabel = variant ? formatVariantPrice(variant) : null;
        return {
          id: String(p?.id ?? title),
          title,
          priceLabel: priceLabel ?? "-",
        };
      })
      .slice(0, 24);
  } catch {
    return null;
  }
}

export default async function StorefrontPage({ params }: PageProps) {
  const { store } = await params;
  const products = (await fetchMedusaProducts()) ?? mockProducts;

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
          <div style={{ fontSize: 12, color: "#666" }}>Store</div>
          <h1 style={{ margin: 0 }}>{store}</h1>
        </div>
        <Link href={`/${store}/pos`}>Go to POS</Link>
      </div>

      <h2 style={{ marginTop: 0 }}>Products</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {products.map((p) => (
          <div
            key={p.id}
            style={{
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 16,
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 700 }}>{p.title}</div>
            <div style={{ color: "#666", marginTop: 6 }}>{p.priceLabel}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
