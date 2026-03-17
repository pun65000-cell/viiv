export default async function ({ container }) {
  const currencyService = container.resolve("currencyService")

  try {
    await currencyService.create({
      code: "thb",
      symbol: "฿",
      symbol_native: "฿",
      name: "Thai Baht",
    })

    console.log("✅ THB created")
  } catch (e) {
    console.log("⚠️ THB may already exist")
  }
}
