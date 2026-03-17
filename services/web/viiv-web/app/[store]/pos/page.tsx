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

export default async function PosPage({ params }: PageProps) {
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
          <div style={{ fontSize: 12, color: "#666" }}>POS</div>
          <h1 style={{ margin: 0 }}>POS - {store}</h1>
        </div>
        <Link href={`/${store}`}>Back to Storefront</Link>
      </div>

      <h2 style={{ marginTop: 0 }}>Products</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {mockProducts.map((p) => (
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
            onClick={() => {}}
          >
            {p.name} (฿{p.price})
          </button>
        ))}
      </div>
    </main>
  );
}
