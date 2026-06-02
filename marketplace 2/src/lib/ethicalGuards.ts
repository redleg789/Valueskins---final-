import { runMLEthicalGuards, learnFromModeration, getMLInsights } from './mlEthicalGuards'

export interface EthicalGuardsResult {
  allowed: boolean
  violations: string[]
  feedback: string
}

// Use ML-based ethical guards instead of hardcoded rules
export const runEthicalGuards = async (content: string): Promise<EthicalGuardsResult> => {
  const mlResult = await runMLEthicalGuards(content)

  return {
    allowed: mlResult.allowed,
    violations: mlResult.violations.map(v => v.violation),
    feedback: mlResult.feedback
  }
}

// Admin feedback to improve ML model
export const reportModerationFeedback = (content: string, wasViolation: boolean, violationType?: string) => {
  learnFromModeration(content, wasViolation, violationType)
}

// Get ML model performance
export const getEthicalGuardStats = () => {
  return getMLInsights()
}

export const getEthicalGuidelinesSummary = (): string => {
  return `Nexus Ethical Guidelines:
✓ Human-created content only (no AI)
✓ No sexual content
✓ No harassment or bullying
✓ No health/financial misinformation
✓ No manipulative dark patterns
✓ No FOMO language
✓ No politics or divisive topics
✓ No religious content or proselytization
✓ No argumentative posts designed to provoke
✓ No child-targeted content
✓ Keep it professional, relaxing, and inclusive`
}
