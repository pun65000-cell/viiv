import Link from "next/link";

type PageProps = {
  params: Promise<{
    store: string;
  }>;
};

const mockProducts = [
  { id: "p1", name: "Chicken Salad", price: 129 },
  { id: "p2", name: "Avocado Bowl", price: 149 },
  { id: "p3", name: "Low Carb Meal", price: 139 },
];

export default async function StorefrontPage({ params }: PageProps) {
  const { store } = await params;

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
          <div style={{ fontSize: 12, color: "#666" }}>Store: {store}</div>
          <h1 style={{ margin: 0 }}>Products</h1>
        </div>
        <Link href={`/${store}/pos`}>Go to POS</Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {mockProducts.map((p) => (
          <div
            key={p.id}
            style={{
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 16,
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 700 }}>{p.name}</div>
            <div style={{ color: "#666", marginTop: 6 }}>฿{p.price}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
