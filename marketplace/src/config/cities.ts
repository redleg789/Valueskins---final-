export async function searchCities(query: string) {
  if (!query || query.length < 2) return [];

  try {
    const res = await fetch(`/api/search-cities?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.cities || [];
  } catch (err) {
    console.error('Search error:', err);
    return [];
  }
}
