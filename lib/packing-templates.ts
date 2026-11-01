/** Built-in, reusable packing templates. Users can also save their own (packing_templates table). */
export const BUILTIN_TEMPLATES: { name: string; items: { label: string; category: string }[] }[] = [
  {
    name: "Essentials",
    items: [
      ["Passport", "Documents"], ["Visa printouts", "Documents"], ["Travel insurance", "Documents"], ["Credit + debit card", "Money"],
      ["Some local cash", "Money"], ["Phone + charger", "Tech"], ["Universal adapter", "Tech"], ["Power bank", "Tech"],
      ["Headphones", "Tech"], ["Toothbrush + paste", "Toiletries"], ["Medication", "Health"], ["Reusable water bottle", "Gear"],
    ].map(([label, category]) => ({ label: label!, category: category! })),
  },
  {
    name: "Clothes (1 week)",
    items: [
      ["T-shirts ×5", "Clothes"], ["Trousers ×2", "Clothes"], ["Underwear ×7", "Clothes"], ["Socks ×7", "Clothes"],
      ["Light jacket", "Clothes"], ["Sleepwear", "Clothes"], ["Comfortable walking shoes", "Clothes"], ["Sandals", "Clothes"],
    ].map(([label, category]) => ({ label: label!, category: category! })),
  },
  {
    name: "Beach & heat",
    items: [
      ["Swimsuit", "Clothes"], ["Sunscreen SPF 50", "Toiletries"], ["Sunglasses", "Gear"], ["Hat", "Clothes"],
      ["After-sun", "Toiletries"], ["Quick-dry towel", "Gear"], ["Insect repellent", "Health"],
    ].map(([label, category]) => ({ label: label!, category: category! })),
  },
  {
    name: "Cold weather",
    items: [
      ["Down jacket", "Clothes"], ["Thermal base layers", "Clothes"], ["Beanie", "Clothes"], ["Gloves", "Clothes"],
      ["Wool socks", "Clothes"], ["Lip balm", "Toiletries"], ["Hand warmers", "Gear"],
    ].map(([label, category]) => ({ label: label!, category: category! })),
  },
  {
    name: "Toiletries kit",
    items: [
      ["Shampoo (travel size)", "Toiletries"], ["Deodorant", "Toiletries"], ["Razor", "Toiletries"], ["Moisturiser", "Toiletries"],
      ["Nail clippers", "Toiletries"], ["First-aid kit", "Health"], ["Hand sanitiser", "Health"],
    ].map(([label, category]) => ({ label: label!, category: category! })),
  },
];

export const PACKING_CATEGORIES = ["Documents", "Money", "Tech", "Clothes", "Toiletries", "Health", "Gear", "General"];
