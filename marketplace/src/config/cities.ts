// World cities database
// Source: Curated list of major cities across all continents
// Can be replaced with API call to geonames.org or similar

export const WORLD_CITIES = [
  // Asia Pacific
  { city: 'Mumbai', country: 'India', countryCode: 'IN', region: 'Asia' },
  { city: 'Delhi', country: 'India', countryCode: 'IN', region: 'Asia' },
  { city: 'Bangalore', country: 'India', countryCode: 'IN', region: 'Asia' },
  { city: 'Hyderabad', country: 'India', countryCode: 'IN', region: 'Asia' },
  { city: 'Chennai', country: 'India', countryCode: 'IN', region: 'Asia' },
  { city: 'Kolkata', country: 'India', countryCode: 'IN', region: 'Asia' },
  { city: 'Pune', country: 'India', countryCode: 'IN', region: 'Asia' },
  { city: 'Ahmedabad', country: 'India', countryCode: 'IN', region: 'Asia' },
  { city: 'Jaipur', country: 'India', countryCode: 'IN', region: 'Asia' },
  { city: 'Lucknow', country: 'India', countryCode: 'IN', region: 'Asia' },
  
  { city: 'Tokyo', country: 'Japan', countryCode: 'JP', region: 'Asia' },
  { city: 'Osaka', country: 'Japan', countryCode: 'JP', region: 'Asia' },
  { city: 'Kyoto', country: 'Japan', countryCode: 'JP', region: 'Asia' },
  
  { city: 'Beijing', country: 'China', countryCode: 'CN', region: 'Asia' },
  { city: 'Shanghai', country: 'China', countryCode: 'CN', region: 'Asia' },
  { city: 'Shenzhen', country: 'China', countryCode: 'CN', region: 'Asia' },
  { city: 'Guangzhou', country: 'China', countryCode: 'CN', region: 'Asia' },
  { city: 'Chengdu', country: 'China', countryCode: 'CN', region: 'Asia' },
  
  { city: 'Singapore', country: 'Singapore', countryCode: 'SG', region: 'Asia' },
  { city: 'Bangkok', country: 'Thailand', countryCode: 'TH', region: 'Asia' },
  { city: 'Kuala Lumpur', country: 'Malaysia', countryCode: 'MY', region: 'Asia' },
  { city: 'Jakarta', country: 'Indonesia', countryCode: 'ID', region: 'Asia' },
  { city: 'Ho Chi Minh City', country: 'Vietnam', countryCode: 'VN', region: 'Asia' },
  { city: 'Hanoi', country: 'Vietnam', countryCode: 'VN', region: 'Asia' },
  { city: 'Manila', country: 'Philippines', countryCode: 'PH', region: 'Asia' },
  { city: 'Seoul', country: 'South Korea', countryCode: 'KR', region: 'Asia' },
  { city: 'Busan', country: 'South Korea', countryCode: 'KR', region: 'Asia' },
  { city: 'Hong Kong', country: 'Hong Kong', countryCode: 'HK', region: 'Asia' },
  { city: 'Taipei', country: 'Taiwan', countryCode: 'TW', region: 'Asia' },
  { city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE', region: 'Asia' },
  { city: 'Abu Dhabi', country: 'United Arab Emirates', countryCode: 'AE', region: 'Asia' },
  { city: 'Tel Aviv', country: 'Israel', countryCode: 'IL', region: 'Asia' },
  
  // North America
  { city: 'New York', country: 'United States', countryCode: 'US', region: 'North America' },
  { city: 'Los Angeles', country: 'United States', countryCode: 'US', region: 'North America' },
  { city: 'Chicago', country: 'United States', countryCode: 'US', region: 'North America' },
  { city: 'Houston', country: 'United States', countryCode: 'US', region: 'North America' },
  { city: 'Phoenix', country: 'United States', countryCode: 'US', region: 'North America' },
  { city: 'Philadelphia', country: 'United States', countryCode: 'US', region: 'North America' },
  { city: 'San Antonio', country: 'United States', countryCode: 'US', region: 'North America' },
  { city: 'San Diego', country: 'United States', countryCode: 'US', region: 'North America' },
  { city: 'Dallas', country: 'United States', countryCode: 'US', region: 'North America' },
  { city: 'San Francisco', country: 'United States', countryCode: 'US', region: 'North America' },
  { city: 'Seattle', country: 'United States', countryCode: 'US', region: 'North America' },
  { city: 'Austin', country: 'United States', countryCode: 'US', region: 'North America' },
  { city: 'Boston', country: 'United States', countryCode: 'US', region: 'North America' },
  { city: 'Denver', country: 'United States', countryCode: 'US', region: 'North America' },
  { city: 'Miami', country: 'United States', countryCode: 'US', region: 'North America' },
  { city: 'Portland', country: 'United States', countryCode: 'US', region: 'North America' },
  
  { city: 'Toronto', country: 'Canada', countryCode: 'CA', region: 'North America' },
  { city: 'Vancouver', country: 'Canada', countryCode: 'CA', region: 'North America' },
  { city: 'Montreal', country: 'Canada', countryCode: 'CA', region: 'North America' },
  { city: 'Calgary', country: 'Canada', countryCode: 'CA', region: 'North America' },
  
  { city: 'Mexico City', country: 'Mexico', countryCode: 'MX', region: 'North America' },
  { city: 'Cancun', country: 'Mexico', countryCode: 'MX', region: 'North America' },
  
  // South America
  { city: 'São Paulo', country: 'Brazil', countryCode: 'BR', region: 'South America' },
  { city: 'Rio de Janeiro', country: 'Brazil', countryCode: 'BR', region: 'South America' },
  { city: 'Salvador', country: 'Brazil', countryCode: 'BR', region: 'South America' },
  { city: 'Brasília', country: 'Brazil', countryCode: 'BR', region: 'South America' },
  
  { city: 'Buenos Aires', country: 'Argentina', countryCode: 'AR', region: 'South America' },
  { city: 'Lima', country: 'Peru', countryCode: 'PE', region: 'South America' },
  { city: 'Bogotá', country: 'Colombia', countryCode: 'CO', region: 'South America' },
  { city: 'Santiago', country: 'Chile', countryCode: 'CL', region: 'South America' },
  { city: 'Caracas', country: 'Venezuela', countryCode: 'VE', region: 'South America' },
  
  // Europe
  { city: 'London', country: 'United Kingdom', countryCode: 'GB', region: 'Europe' },
  { city: 'Paris', country: 'France', countryCode: 'FR', region: 'Europe' },
  { city: 'Berlin', country: 'Germany', countryCode: 'DE', region: 'Europe' },
  { city: 'Frankfurt', country: 'Germany', countryCode: 'DE', region: 'Europe' },
  { city: 'Munich', country: 'Germany', countryCode: 'DE', region: 'Europe' },
  
  { city: 'Amsterdam', country: 'Netherlands', countryCode: 'NL', region: 'Europe' },
  { city: 'Brussels', country: 'Belgium', countryCode: 'BE', region: 'Europe' },
  { city: 'Zurich', country: 'Switzerland', countryCode: 'CH', region: 'Europe' },
  { city: 'Geneva', country: 'Switzerland', countryCode: 'CH', region: 'Europe' },
  
  { city: 'Milan', country: 'Italy', countryCode: 'IT', region: 'Europe' },
  { city: 'Rome', country: 'Italy', countryCode: 'IT', region: 'Europe' },
  { city: 'Venice', country: 'Italy', countryCode: 'IT', region: 'Europe' },
  
  { city: 'Madrid', country: 'Spain', countryCode: 'ES', region: 'Europe' },
  { city: 'Barcelona', country: 'Spain', countryCode: 'ES', region: 'Europe' },
  { city: 'Lisbon', country: 'Portugal', countryCode: 'PT', region: 'Europe' },
  
  { city: 'Moscow', country: 'Russia', countryCode: 'RU', region: 'Europe' },
  { city: 'St. Petersburg', country: 'Russia', countryCode: 'RU', region: 'Europe' },
  
  { city: 'Stockholm', country: 'Sweden', countryCode: 'SE', region: 'Europe' },
  { city: 'Copenhagen', country: 'Denmark', countryCode: 'DK', region: 'Europe' },
  { city: 'Helsinki', country: 'Finland', countryCode: 'FI', region: 'Europe' },
  { city: 'Oslo', country: 'Norway', countryCode: 'NO', region: 'Europe' },
  
  { city: 'Prague', country: 'Czech Republic', countryCode: 'CZ', region: 'Europe' },
  { city: 'Budapest', country: 'Hungary', countryCode: 'HU', region: 'Europe' },
  { city: 'Warsaw', country: 'Poland', countryCode: 'PL', region: 'Europe' },
  { city: 'Krakow', country: 'Poland', countryCode: 'PL', region: 'Europe' },
  
  { city: 'Vienna', country: 'Austria', countryCode: 'AT', region: 'Europe' },
  { city: 'Athens', country: 'Greece', countryCode: 'GR', region: 'Europe' },
  { city: 'Istanbul', country: 'Turkey', countryCode: 'TR', region: 'Europe' },
  
  // Africa
  { city: 'Cairo', country: 'Egypt', countryCode: 'EG', region: 'Africa' },
  { city: 'Lagos', country: 'Nigeria', countryCode: 'NG', region: 'Africa' },
  { city: 'Abuja', country: 'Nigeria', countryCode: 'NG', region: 'Africa' },
  { city: 'Johannesburg', country: 'South Africa', countryCode: 'ZA', region: 'Africa' },
  { city: 'Cape Town', country: 'South Africa', countryCode: 'ZA', region: 'Africa' },
  { city: 'Nairobi', country: 'Kenya', countryCode: 'KE', region: 'Africa' },
  { city: 'Casablanca', country: 'Morocco', countryCode: 'MA', region: 'Africa' },
  { city: 'Marrakech', country: 'Morocco', countryCode: 'MA', region: 'Africa' },
  { city: 'Accra', country: 'Ghana', countryCode: 'GH', region: 'Africa' },
  { city: 'Addis Ababa', country: 'Ethiopia', countryCode: 'ET', region: 'Africa' },
  
  // Oceania
  { city: 'Sydney', country: 'Australia', countryCode: 'AU', region: 'Oceania' },
  { city: 'Melbourne', country: 'Australia', countryCode: 'AU', region: 'Oceania' },
  { city: 'Brisbane', country: 'Australia', countryCode: 'AU', region: 'Oceania' },
  { city: 'Perth', country: 'Australia', countryCode: 'AU', region: 'Oceania' },
  { city: 'Adelaide', country: 'Australia', countryCode: 'AU', region: 'Oceania' },
  
  { city: 'Auckland', country: 'New Zealand', countryCode: 'NZ', region: 'Oceania' },
  { city: 'Wellington', country: 'New Zealand', countryCode: 'NZ', region: 'Oceania' },
];

export function searchCities(query: string): typeof WORLD_CITIES {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return [];
  
  return WORLD_CITIES.filter(c => 
    c.city.toLowerCase().includes(lowerQuery) ||
    c.country.toLowerCase().includes(lowerQuery) ||
    c.countryCode.toLowerCase().includes(lowerQuery)
  ).slice(0, 10); // Return top 10 matches
}

export function getCityByName(cityName: string): (typeof WORLD_CITIES)[0] | undefined {
  return WORLD_CITIES.find(c => c.city.toLowerCase() === cityName.toLowerCase());
}
