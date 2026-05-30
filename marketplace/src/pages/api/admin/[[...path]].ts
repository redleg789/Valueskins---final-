import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return res.json({
    overview: {
      totalEvents: 1247,
      activeUsers: 8432,
      totalRevenue: 84250.00,
      totalFees: 12637.50,
      repeatRate: 0.37,
      avgRating: 4.3,
      topCity: 'Pune',
      topCategory: 'Nightlife',
    },
    topCategories: [
      { name: 'Nightlife', events: 312, revenue: 28500, growth: 12 },
      { name: 'Comedy', events: 198, revenue: 18400, growth: 8 },
      { name: 'Music', events: 178, revenue: 22300, growth: 15 },
      { name: 'Tech', events: 145, revenue: 12100, growth: 22 },
      { name: 'Art', events: 98, revenue: 8400, growth: 5 },
      { name: 'Food', events: 76, revenue: 5200, growth: 18 },
      { name: 'Sports', events: 45, revenue: 3800, growth: -2 },
    ],
    fastestGrowingCities: [
      { city: 'Pune', users: 1240, events: 89, growth: 28 },
      { city: 'Bangalore', users: 2100, events: 156, growth: 18 },
      { city: 'Mumbai', users: 1850, events: 134, growth: 14 },
      { city: 'Delhi', users: 980, events: 72, growth: 22 },
      { city: 'Hyderabad', users: 540, events: 41, growth: 35 },
      { city: 'Chennai', users: 420, events: 33, growth: 16 },
    ],
    topPromoters: [
      { name: 'DJ Rahul', conversion: 42, ticketsSold: 156, revenue: 163800 },
      { name: 'Maya Singh', conversion: 38, ticketsSold: 128, revenue: 134400 },
      { name: 'Arjun Nair', conversion: 35, ticketsSold: 98, revenue: 102900 },
      { name: 'Priya Kapoor', conversion: 31, ticketsSold: 87, revenue: 91350 },
      { name: 'Rohit Sharma', conversion: 28, ticketsSold: 72, revenue: 75600 },
    ],
    retention: {
      week1: 0.64,
      week4: 0.41,
      month3: 0.25,
      month6: 0.16,
      year1: 0.08,
    },
    communities: [
      { name: 'Pune Startup Network', members: 234, events: 28, growth: 18 },
      { name: 'Friday Techno Tribe', members: 89, events: 12, growth: 32 },
      { name: 'Rock Tribe', members: 156, events: 18, growth: 12 },
      { name: 'Comedy Collective', members: 112, events: 9, growth: 24 },
    ],
    emergingTrends: [
      'AI meetups growing 35% month-over-month in Bangalore',
      'Stand-up comedy expanding to Tier 2 cities (Pune, Nagpur)',
      'Founder-investor mixer events have highest repeat rate (52%)',
      'Sunday brunch events emerging as new category in Mumbai',
    ],
  });
}
