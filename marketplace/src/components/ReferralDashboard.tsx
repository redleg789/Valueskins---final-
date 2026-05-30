'use client';

import { useState, useEffect } from 'react';

/**
 * ReferralDashboard Component
 * 
 * BLOCKER ADDRESSED: Distribution and growth engine strength
 * - Shows referral stats and earnings
 * - Referral leaderboard for gamification
 * - Easy code sharing and tracking
 */

interface ReferralStats {
    code: string;
    totalReferrals: number;
    pendingRewards: string;
    totalEarnings: string;
    tier1Count: number;
    tier2Count: number;
    tier3Count: number;
}

interface LeaderboardEntry {
    rank: number;
    personaId: number;
    displayName: string;
    referralCount: number;
    totalEarnings: string;
}

export default function ReferralDashboard({ personaId }: { personaId: number }) {
    const [stats, setStats] = useState<ReferralStats | null>(null);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateCode, setShowCreateCode] = useState(false);
    const [newCode, setNewCode] = useState('');
    const [copied, setCopied] = useState(false);

    // Mock data - would come from API/chain
    useEffect(() => {
        // Simulate API call
        setTimeout(() => {
            setStats({
                code: 'VALUESKINS',
                totalReferrals: 47,
                pendingRewards: '0.235',
                totalEarnings: '1.24',
                tier1Count: 32,
                tier2Count: 12,
                tier3Count: 3,
            });
            setLeaderboard([
                { rank: 1, personaId: 1, displayName: 'CryptoKing', referralCount: 234, totalEarnings: '12.5' },
                { rank: 2, personaId: 2, displayName: 'Web3Builder', referralCount: 189, totalEarnings: '9.8' },
                { rank: 3, personaId: 3, displayName: 'NFTQueen', referralCount: 156, totalEarnings: '8.2' },
                { rank: 4, personaId: 4, displayName: 'DeFiDev', referralCount: 123, totalEarnings: '6.5' },
                { rank: 5, personaId: 5, displayName: 'AlphaHunter', referralCount: 98, totalEarnings: '5.1' },
            ]);
            setLoading(false);
        }, 500);
    }, [personaId]);

    const copyReferralLink = () => {
        if (stats) {
            navigator.clipboard.writeText(`https://valueskins.io?ref=${stats.code}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const claimRewards = async () => {
        // Would call smart contract
        alert('Claiming rewards... (would call ReferralSystem.claimRewards())');
    };

    if (loading) {
        return (
            <div className="animate-pulse space-y-4">
                <div className="h-32 bg-gray-800 rounded-xl"></div>
                <div className="h-64 bg-gray-800 rounded-xl"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 rounded-xl p-4 border border-purple-500/20">
                    <div className="text-2xl font-bold text-white">{stats?.totalReferrals || 0}</div>
                    <div className="text-sm text-purple-300">Total Referrals</div>
                </div>
                <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 rounded-xl p-4 border border-green-500/20">
                    <div className="text-2xl font-bold text-white">{stats?.pendingRewards || '0'} ETH</div>
                    <div className="text-sm text-green-300">Pending Rewards</div>
                </div>
                <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 rounded-xl p-4 border border-blue-500/20">
                    <div className="text-2xl font-bold text-white">{stats?.totalEarnings || '0'} ETH</div>
                    <div className="text-sm text-blue-300">Total Earned</div>
                </div>
                <div className="bg-gradient-to-br from-amber-900/50 to-amber-800/30 rounded-xl p-4 border border-amber-500/20">
                    <div className="text-2xl font-bold text-white">
                        {(stats?.tier1Count || 0) + (stats?.tier2Count || 0) * 0.3 + (stats?.tier3Count || 0) * 0.1}
                    </div>
                    <div className="text-sm text-amber-300">Network Value</div>
                </div>
            </div>

            {/* Referral Code Section */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-bold mb-4">Your Referral Code</h3>

                {stats?.code ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="flex-1 bg-gray-900 rounded-lg p-4 font-mono text-2xl font-bold text-center tracking-wider text-purple-400">
                                {stats.code}
                            </div>
                            <button
                                onClick={copyReferralLink}
                                className="px-6 py-4 bg-purple-600 hover:bg-purple-500 rounded-lg font-semibold transition-colors"
                            >
                                {copied ? '✓ Copied!' : 'Copy Link'}
                            </button>
                        </div>

                        <div className="text-sm text-gray-400">
                            Share your link: <span className="text-purple-400">valueskins.io?ref={stats.code}</span>
                        </div>

                        {/* Reward Tiers Explanation */}
                        <div className="grid grid-cols-3 gap-4 mt-6">
                            <div className="text-center p-4 bg-gray-900/50 rounded-lg">
                                <div className="text-3xl mb-2">🥇</div>
                                <div className="text-lg font-bold text-white">{stats.tier1Count}</div>
                                <div className="text-sm text-gray-400">Direct Referrals</div>
                                <div className="text-xs text-green-400 mt-1">10% reward</div>
                            </div>
                            <div className="text-center p-4 bg-gray-900/50 rounded-lg">
                                <div className="text-3xl mb-2">🥈</div>
                                <div className="text-lg font-bold text-white">{stats.tier2Count}</div>
                                <div className="text-sm text-gray-400">Tier 2</div>
                                <div className="text-xs text-green-400 mt-1">3% reward</div>
                            </div>
                            <div className="text-center p-4 bg-gray-900/50 rounded-lg">
                                <div className="text-3xl mb-2">🥉</div>
                                <div className="text-lg font-bold text-white">{stats.tier3Count}</div>
                                <div className="text-sm text-gray-400">Tier 3</div>
                                <div className="text-xs text-green-400 mt-1">1% reward</div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <p className="text-gray-400 mb-4">You haven't created a referral code yet</p>
                        <button
                            onClick={() => setShowCreateCode(true)}
                            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-semibold transition-colors"
                        >
                            Create Referral Code
                        </button>
                    </div>
                )}

                {/* Claim Button */}
                {stats && parseFloat(stats.pendingRewards) > 0 && (
                    <button
                        onClick={claimRewards}
                        className="w-full mt-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg font-bold text-lg transition-all"
                    >
                        Claim {stats.pendingRewards} ETH
                    </button>
                )}
            </div>

            {/* Create Code Modal */}
            {showCreateCode && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md">
                        <h3 className="text-xl font-bold mb-4">Create Referral Code</h3>
                        <input
                            type="text"
                            value={newCode}
                            onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                            placeholder="Enter your code (e.g., MYCODE)"
                            className="w-full px-4 py-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-purple-500 outline-none mb-4"
                            maxLength={20}
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCreateCode(false)}
                                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    // Would call ReferralSystem.createReferralCode()
                                    alert(`Creating code: ${newCode}`);
                                    setShowCreateCode(false);
                                }}
                                className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-semibold transition-colors"
                                disabled={newCode.length < 3}
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Leaderboard */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-700">
                    <h3 className="text-lg font-bold">🏆 Top Referrers</h3>
                    <p className="text-sm text-gray-400">Compete to earn bonus rewards</p>
                </div>
                <div className="divide-y divide-gray-700/50">
                    {leaderboard.map((entry) => (
                        <div key={entry.personaId} className="flex items-center gap-4 p-4 hover:bg-gray-700/30 transition-colors">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${entry.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                                    entry.rank === 2 ? 'bg-gray-400/20 text-gray-300' :
                                        entry.rank === 3 ? 'bg-orange-500/20 text-orange-400' :
                                            'bg-gray-700 text-gray-400'
                                }`}>
                                {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
                            </div>
                            <div className="flex-1">
                                <div className="font-semibold text-white">{entry.displayName}</div>
                                <div className="text-sm text-gray-400">{entry.referralCount} referrals</div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-green-400">{entry.totalEarnings} ETH</div>
                                <div className="text-xs text-gray-500">earned</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* How It Works */}
            <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-xl p-6 border border-purple-500/20">
                <h3 className="text-lg font-bold mb-4">💡 How Referrals Work</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                        <div className="text-purple-400 font-semibold mb-1">1. Share Your Code</div>
                        <p className="text-gray-400">Send your unique referral code to friends interested in building their creator profile.</p>
                    </div>
                    <div>
                        <div className="text-purple-400 font-semibold mb-1">2. They Sign Up</div>
                        <p className="text-gray-400">When they create a persona using your code, you both get benefits.</p>
                    </div>
                    <div>
                        <div className="text-purple-400 font-semibold mb-1">3. Earn Forever</div>
                        <p className="text-gray-400">Earn 10% of their persona mint + ongoing rewards from their network (up to 3 tiers).</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
