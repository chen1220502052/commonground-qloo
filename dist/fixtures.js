// Deliberately authored fixtures. None of these scores or venues comes from Qloo.
export const signals = [
  { id: 'wes', name: 'The Grand Budapest Hotel', domain: 'Film', entityType: 'urn:entity:movie' },
  { id: 'ghibli', name: 'Spirited Away', domain: 'Film', entityType: 'urn:entity:movie' },
  { id: 'nolan', name: 'Christopher Nolan', domain: 'Director', entityType: 'urn:entity:person' },
  { id: 'jazz', name: 'Miles Davis', domain: 'Music', entityType: 'urn:entity:artist' },
  { id: 'pop', name: 'Taylor Swift', domain: 'Music', entityType: 'urn:entity:artist' },
  { id: 'indie', name: 'Phoebe Bridgers', domain: 'Music', entityType: 'urn:entity:artist' },
  { id: 'outdoor', name: 'Patagonia', domain: 'Brand', entityType: 'urn:entity:brand' },
  { id: 'design', name: 'MUJI', domain: 'Brand', entityType: 'urn:entity:brand' },
  { id: 'street', name: 'Nike', domain: 'Brand', entityType: 'urn:entity:brand' },
];
export const initialMembers = [
  { id: 'm1', name: 'Alex', signals: ['wes', 'jazz'], exclusions: [], rejectedIds: [] },
  { id: 'm2', name: 'Jamie', signals: ['ghibli', 'design'], exclusions: [], rejectedIds: [] },
  { id: 'm3', name: 'Sam', signals: ['pop', 'street'], exclusions: [], rejectedIds: [] },
  { id: 'm4', name: 'Riley', signals: ['nolan', 'outdoor'], exclusions: [], rejectedIds: [] },
];
// Each mockAffinity value is a fixture, not a probability or a validated cultural claim.
export const venues = [
  { id: 'v1', name: 'Juniper Table', kind: 'restaurant', label: 'Shared plates', area: 'East Village', distanceKm: 1.2, priceLevel: 2, popularity: .72, description: 'Small plates for sharing and a conversation that can continue after dinner.', mockAffinity: [84,85,82,86,82,80,80,84,80] },
  { id: 'v2', name: 'Cinema Supper', kind: 'restaurant', label: 'Cinema-inspired dining', area: 'SoHo', distanceKm: 2.4, priceLevel: 3, popularity: .88, description: 'A fictional cinema-themed setting for talking about favorite stories.', mockAffinity: [98,90,97,92,76,90,82,88,78] },
  { id: 'v3', name: 'Side B Kitchen', kind: 'restaurant', label: 'Records and dinner', area: 'East Village', distanceKm: 1.8, priceLevel: 2, popularity: .31, description: 'An illustrative record-inspired restaurant for trying something new together.', mockAffinity: [82,75,75,90,70,96,72,78,76] },
  { id: 'v4', name: 'Neon Social', kind: 'bar', label: 'Lively bar', area: 'SoHo', distanceKm: 2.7, priceLevel: 2, popularity: .94, description: 'A fictional lively setting for music and conversation.', mockAffinity: [79,56,82,87,98,80,66,53,99] },
  { id: 'v5', name: 'Greenhouse Lunch', kind: 'restaurant', label: 'Easygoing lunch', area: 'Chelsea', distanceKm: 3.8, priceLevel: 2, popularity: .52, description: 'An illustrative slower lunch setting with a natural feel.', mockAffinity: [70,94,72,62,63,77,98,96,60] },
  { id: 'v6', name: 'Corner Noodles', kind: 'restaurant', label: 'Neighborhood noodles', area: 'East Village', distanceKm: .6, priceLevel: 1, popularity: .65, description: 'A nearby, lower-tier fictional choice for a simple meal.', mockAffinity: [66,78,72,58,80,66,76,72,85] },
  { id: 'v7', name: 'Stillwater Café', kind: 'cafe', label: 'Coffee and light bites', area: 'Chelsea', distanceKm: 3.2, priceLevel: 1, popularity: .26, description: 'An illustrative quieter gathering with coffee and light food.', mockAffinity: [88,90,63,80,54,93,83,91,52] },
  { id: 'v8', name: 'Blue Note Bites', kind: 'bar', label: 'Jazz and small bites', area: 'East Village', distanceKm: 1.5, priceLevel: 3, popularity: .58, description: 'A fictional jazz-themed dining setting.', mockAffinity: [90,66,73,99,62,84,65,74,61] },
  { id: 'v9', name: 'Mosaic Dining', kind: 'restaurant', label: 'Many flavors', area: 'SoHo', distanceKm: 2.1, priceLevel: 2, popularity: .41, description: 'An illustrative range of flavors for a first meal together.', mockAffinity: [75,78,77,72,82,79,80,75,80] },
  { id: 'v10', name: 'Skyline Tasting', kind: 'restaurant', label: 'Tasting dinner', area: 'Chelsea', distanceKm: 4.5, priceLevel: 4, popularity: .81, description: 'A higher-tier fictional dinner requiring shared agreement on price.', mockAffinity: [95,78,94,96,82,88,80,86,86] },
].map(v => ({ ...v, mockAffinity: Object.fromEntries(signals.map((s,i) => [s.id, v.mockAffinity[i]])) }));
