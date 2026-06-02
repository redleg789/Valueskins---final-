// ML-based ethical guard system that learns from patterns
// Analyzes every post, detects workarounds, adapts in real-time

interface GuardAnalysis {
  violation: string
  confidence: number
  patterns: string[]
  reasoning: string
}

interface EthicalGuardMLResult {
  allowed: boolean
  violations: GuardAnalysis[]
  feedback: string
  confidenceScore: number
}

// Feature extraction for ML analysis
class TextAnalyzer {
  // Extract semantic features from text
  extractFeatures(text: string) {
    return {
      length: text.length,
      wordCount: text.split(/\s+/).length,
      avgWordLength: text.split(/\s+/).reduce((sum, word) => sum + word.length, 0) / text.split(/\s+/).length,
      uppercaseRatio: (text.match(/[A-Z]/g) || []).length / text.length,
      specialCharRatio: (text.match(/[!@#$%^&*()]/g) || []).length / text.length,
      numberRatio: (text.match(/\d/g) || []).length / text.length,
      emojiCount: (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length,
      sentiment: this.analyzeSentiment(text),
      toxicityScore: this.calculateToxicity(text),
      urgencyScore: this.detectUrgency(text),
      personalityScore: this.detectPersonality(text),
    }
  }

  // Sentiment analysis (scale -1 to 1)
  private analyzeSentiment(text: string): number {
    const positive = ['good', 'great', 'awesome', 'amazing', 'love', 'excellent', 'happy', 'wonderful']
    const negative = ['bad', 'terrible', 'awful', 'hate', 'horrible', 'sad', 'disgusting', 'worst']

    const textLower = text.toLowerCase()
    const posCount = positive.filter(word => textLower.includes(word)).length
    const negCount = negative.filter(word => textLower.includes(word)).length

    return (posCount - negCount) / (posCount + negCount || 1)
  }

  // Toxicity detection (0-1 scale)
  private calculateToxicity(text: string): number {
    const slurs = ['retard', 'faggot', 'nigger', 'chink', 'spic']
    const threats = ['kill', 'hurt', 'attack', 'die', 'death threat']
    const harassment = ['idiot', 'stupid', 'dumb', 'loser', 'pathetic']

    const textLower = text.toLowerCase()
    const slurCount = slurs.filter(s => textLower.includes(s)).length
    const threatCount = threats.filter(t => textLower.includes(t)).length
    const harassCount = harassment.filter(h => textLower.includes(h)).length

    const totalMatches = slurCount * 3 + threatCount * 2 + harassCount
    return Math.min(totalMatches / text.split(/\s+/).length, 1)
  }

  // Detect urgency patterns (for dark patterns, FOMO)
  private detectUrgency(text: string): number {
    const urgencyPatterns = [
      'limited time', 'act now', 'hurry', 'only x spots', 'dont miss out',
      'last chance', 'expires soon', 'before its gone', 'ending today'
    ]

    const textLower = text.toLowerCase()
    const matches = urgencyPatterns.filter(p => textLower.includes(p)).length
    return Math.min(matches / 2, 1)
  }

  // Detect human personality (authorship, authenticity)
  private detectPersonality(text: string): number {
    const personalityMarkers = [
      /\bi\s/, /\bme\s/, /\bmy\s/, /\bwe\s/, /\bour\s/,  // First person
      /\?$/, /!$/,  // Questions and exclamations
      /\.\.\./,  // Ellipsis
      /['"]/,  // Quotes
    ]

    const matches = personalityMarkers.filter(marker => marker.test(text)).length
    return Math.min(matches / personalityMarkers.length, 1)
  }
}

// ML Model for ethical violation detection + user preference learning
class EthicalGuardML {
  private analyzer: TextAnalyzer
  private violationHistory: Map<string, GuardAnalysis[]> = new Map()
  private patternDatabase: Map<string, string[]> = new Map()
  private userPreferences: Map<string, { liked: number; disliked: number; features: Record<string, number> }> = new Map()

  constructor() {
    this.analyzer = new TextAnalyzer()
    this.initializePatternDatabase()
  }

  private initializePatternDatabase() {
    // Sexual content patterns
    this.patternDatabase.set('sexual_content', [
      'sex work', 'escort', 'nudes', 'explicit', 'porn',
      'buy photos', 'pay for content', 'onlyfans', 'cam'
    ])

    // Harassment patterns
    this.patternDatabase.set('harassment', [
      'you\'re trash', 'kill yourself', 'i hope you', 'you\'re disgusting',
      'piece of trash', 'should die', 'kys'
    ])

    // Misinformation patterns
    this.patternDatabase.set('misinformation', [
      'cures', 'prevents', 'guaranteed', '100% profit', 'risk-free',
      'doctors don\'t want', 'secret cure', 'miracle'
    ])

    // Dark pattern indicators
    this.patternDatabase.set('dark_patterns', [
      'limited spots', 'act fast', 'disappearing', 'exclusive access',
      'only today', 'before gone'
    ])

    // FOMO language
    this.patternDatabase.set('fomo_language', [
      'everyone is', 'you\'re missing', 'going viral', 'all your friends',
      'trending now', 'don\'t get left behind'
    ])

    // Political content
    this.patternDatabase.set('political_content', [
      'election', 'vote', 'candidate', 'campaign', 'congress',
      'democrat', 'republican', 'political party'
    ])

    // Religious content
    this.patternDatabase.set('religious_content', [
      'god', 'jesus', 'allah', 'pray', 'faith', 'believe in',
      'salvation', 'heaven', 'hell', 'convert'
    ])
  }

  // Detect violations using ML-style pattern matching + semantic analysis
  analyzePost(text: string): EthicalGuardMLResult {
    const features = this.analyzer.extractFeatures(text)
    const violations: GuardAnalysis[] = []

    // Rule 1: Toxicity-based harassment detection
    if (features.toxicityScore > 0.5) {
      violations.push({
        violation: 'harassment',
        confidence: features.toxicityScore,
        patterns: this.findMatchingPatterns(text, 'harassment'),
        reasoning: `High toxicity score (${(features.toxicityScore * 100).toFixed(1)}%) detected. Contains hostile language.`
      })
    }

    // Rule 2: Urgency + sentiment for dark patterns
    if (features.urgencyScore > 0.6 && features.sentiment < -0.3) {
      violations.push({
        violation: 'dark_patterns',
        confidence: Math.min((features.urgencyScore + Math.abs(features.sentiment)) / 2, 1),
        patterns: this.findMatchingPatterns(text, 'dark_patterns'),
        reasoning: `Urgent language combined with negative sentiment detected (urgency: ${(features.urgencyScore * 100).toFixed(1)}%, sentiment: ${(features.sentiment * 100).toFixed(1)}%)`
      })
    }

    // Rule 3: FOMO detection
    if (features.urgencyScore > 0.7) {
      violations.push({
        violation: 'fomo_language',
        confidence: features.urgencyScore,
        patterns: this.findMatchingPatterns(text, 'fomo_language'),
        reasoning: `High urgency patterns detected (${(features.urgencyScore * 100).toFixed(1)}%). Likely FOMO-inducing language.`
      })
    }

    // Rule 4: Low personality = AI-generated or generic
    if (features.personalityScore < 0.3 && features.wordCount > 50) {
      violations.push({
        violation: 'ai_generated',
        confidence: 1 - features.personalityScore,
        patterns: [],
        reasoning: `Low personality markers (${(features.personalityScore * 100).toFixed(1)}%). Content appears generic or AI-generated.`
      })
    }

    // Rule 5: Check known violation patterns
    const patternViolations = this.checkPatternMatches(text)
    violations.push(...patternViolations)

    // Rule 6: Sentiment extremes (potential fake engagement or manipulation)
    if (Math.abs(features.sentiment) > 0.8 && features.specialCharRatio > 0.1) {
      violations.push({
        violation: 'manipulative_language',
        confidence: Math.min(Math.abs(features.sentiment) * features.specialCharRatio, 1),
        patterns: [],
        reasoning: `Extreme sentiment (${(features.sentiment * 100).toFixed(1)}%) with excessive special characters. Appears manipulative.`
      })
    }

    // Calculate overall confidence
    const confidenceScore = violations.length === 0 ? 1 :
      Math.max(...violations.map(v => v.confidence))

    // Store for learning
    if (violations.length > 0) {
      this.violationHistory.set(text.substring(0, 50), violations)
    }

    return {
      allowed: violations.length === 0,
      violations,
      feedback: violations.map(v => `${v.violation}: ${v.reasoning}`).join(' '),
      confidenceScore
    }
  }

  private findMatchingPatterns(text: string, violationType: string): string[] {
    const patterns = this.patternDatabase.get(violationType) || []
    const textLower = text.toLowerCase()
    return patterns.filter(p => textLower.includes(p))
  }

  private checkPatternMatches(text: string): GuardAnalysis[] {
    const violations: GuardAnalysis[] = []
    const textLower = text.toLowerCase()

    for (const [violationType, patterns] of this.patternDatabase) {
      const matches = patterns.filter(p => textLower.includes(p))
      if (matches.length > 0) {
        violations.push({
          violation: violationType,
          confidence: Math.min(matches.length / patterns.length, 1),
          patterns: matches,
          reasoning: `Detected ${matches.length} pattern(s) associated with ${violationType}: ${matches.join(', ')}`
        })
      }
    }

    return violations
  }

  // Learn from false positives/negatives (admin feedback)
  learnFromFeedback(text: string, wasViolation: boolean, violationType?: string) {
    if (wasViolation && violationType) {
      const patterns = this.patternDatabase.get(violationType) || []
      const newPatterns = this.extractNewPatterns(text)
      this.patternDatabase.set(violationType, [...patterns, ...newPatterns])
    }
  }

  private extractNewPatterns(text: string): string[] {
    // Extract n-grams and key phrases
    const words = text.toLowerCase().split(/\s+/)
    const bigrams: string[] = []

    for (let i = 0; i < words.length - 1; i++) {
      bigrams.push(`${words[i]} ${words[i + 1]}`)
    }

    return bigrams.filter(bg => bg.length > 10 && bg.length < 50).slice(0, 3)
  }

  // Record user preference: "more like this" feedback
  recordMoreLikeThis(userId: string, postId: string, content: string) {
    const features = this.analyzer.extractFeatures(content)
    const key = `${userId}_${postId}`

    if (!this.userPreferences.has(key)) {
      this.userPreferences.set(key, { liked: 0, disliked: 0, features })
    }

    const pref = this.userPreferences.get(key)!
    pref.liked += 1

    // Learn from this preference: adjust pattern weights
    this.updatePatternWeights(content, true, features)
  }

  // Record user preference: "less like this" feedback
  recordLessLikeThis(userId: string, postId: string, content: string) {
    const features = this.analyzer.extractFeatures(content)
    const key = `${userId}_${postId}`

    if (!this.userPreferences.has(key)) {
      this.userPreferences.set(key, { liked: 0, disliked: 0, features })
    }

    const pref = this.userPreferences.get(key)!
    pref.disliked += 1

    // Learn from this preference: penalize similar patterns
    this.updatePatternWeights(content, false, features)
  }

  // Update pattern weights based on user feedback
  private updatePatternWeights(content: string, liked: boolean, features: Record<string, number>) {
    const textLower = content.toLowerCase()

    // If user liked it, reinforce similar patterns
    // If user disliked it, weaken similar patterns
    for (const [violationType, patterns] of this.patternDatabase) {
      const matches = patterns.filter(p => textLower.includes(p))

      if (matches.length > 0) {
        if (!liked) {
          // User dislikes content with these patterns → strengthen detection
          // (no action needed, already in pattern DB)
        } else {
          // User likes content with these patterns → weaken detection
          // Remove false positive patterns
          const filtered = patterns.filter(p => !matches.includes(p))
          if (filtered.length < patterns.length) {
            this.patternDatabase.set(violationType, filtered)
          }
        }
      }
    }
  }

  // Get user preference profile (for personalization)
  getUserPreferences(userId: string) {
    const userPrefs: Record<string, any> = {}

    for (const [key, pref] of this.userPreferences) {
      if (key.startsWith(userId)) {
        userPrefs[key] = {
          liked: pref.liked,
          disliked: pref.disliked,
          preferenceRatio: pref.liked / (pref.liked + pref.disliked || 1)
        }
      }
    }

    return userPrefs
  }

  // Get model insights
  getModelInsights() {
    return {
      totalViolationsAnalyzed: this.violationHistory.size,
      patternDatabaseSize: Array.from(this.patternDatabase.values()).reduce((sum, p) => sum + p.length, 0),
      violationTypes: Array.from(this.patternDatabase.keys()),
      totalUserPreferences: this.userPreferences.size,
      totalLikesRecorded: Array.from(this.userPreferences.values()).reduce((sum, p) => sum + p.liked, 0),
      totalDislikesRecorded: Array.from(this.userPreferences.values()).reduce((sum, p) => sum + p.disliked, 0)
    }
  }
}

export const ethicalGuardML = new EthicalGuardML()

export async function runMLEthicalGuards(content: string): Promise<EthicalGuardMLResult> {
  return ethicalGuardML.analyzePost(content)
}

export function learnFromModeration(content: string, wasViolation: boolean, violationType?: string) {
  ethicalGuardML.learnFromFeedback(content, wasViolation, violationType)
}

// User preference learning: "more like this"
export function moreLikeThis(userId: string, postId: string, content: string) {
  ethicalGuardML.recordMoreLikeThis(userId, postId, content)
}

// User preference learning: "less like this"
export function lessLikeThis(userId: string, postId: string, content: string) {
  ethicalGuardML.recordLessLikeThis(userId, postId, content)
}

// Get user's preference profile
export function getUserContentPreferences(userId: string) {
  return ethicalGuardML.getUserPreferences(userId)
}

export function getMLInsights() {
  return ethicalGuardML.getModelInsights()
}
