export const buildDaoImageDataUri = (name: string, seed: string): string => {
  // Deterministic seeded image per DAO for visual uniqueness across cards.
  // Using picsum seed keeps each DAO image stable without local asset management.
  const normalizedSeed = encodeURIComponent(`${seed}-${name}`.toLowerCase());
  return `https://picsum.photos/seed/${normalizedSeed}/1200/800`;
};
