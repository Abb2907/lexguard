import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Shield, Scale, FileText, CheckCircle2, AlertTriangle, Play, ArrowRight, 
  Lock, DollarSign, AlertCircle, RefreshCw, FileCode, Trash2, 
  Download, Copy, ChevronDown, ChevronUp, Info, Activity, Flame, 
  HelpCircle, Settings, Search, SlidersHorizontal, Eye, BookOpen, 
  HeartHandshake, MapPin, UserCheck, History, Check, FileUp, Sparkles, AlertOctagon, Layers
} from 'lucide-react';

// ============================================================================
// 1. MULTI-AGENT ARCHITECTURE — CLAUDE SYSTEM PROMPTS
// ============================================================================

const EXTRACTOR_PROMPT = `You are a legal clause extraction specialist. Given a legal document, extract and list every significant clause. Categorize each by type:
[LIABILITY | TERMINATION | PAYMENT | DATA/PRIVACY | ARBITRATION | INDEMNIFICATION | IP_OWNERSHIP | AUTO_RENEWAL | JURISDICTION | NON_COMPETE | FORCE_MAJEURE | AMENDMENT | COMPLIANCE | OTHER].

For each clause also note: which party it primarily benefits (DRAFTER / SIGNER / NEUTRAL).
Output ONLY a valid JSON array — no preamble, no markdown fences:
[{ "id": "c1", "type": "...", "original_text": "...", "benefits_party": "...", "location_hint": "..." }]`;

const RISK_ANALYST_PROMPT = `You are an adversarial contract risk analyst working exclusively to protect the signing party (never the drafter). Given extracted clauses, evaluate each for:
- exploitation_score (1–10): how much this favors the drafter unfairly
- ambiguity_score (1–10): how vague or undefined key terms are
- enforceability_risk: whether this clause may not hold up legally
- hidden_liabilities: obligations the signer may not have noticed
- red_flags: array of specific concerns in plain language

Flag any clause that could harm the user in practice even if it appears benign.
Output ONLY a valid JSON array extending each clause object:
[{ ...original_clause, "risk_score": N, "risk_type": "...", "red_flags": [...], "plain_english_meaning": "..." }]`;

const CONTRADICTION_PROMPT = `You are a legal consistency auditor and industry standards expert. Given a list of analyzed clauses, perform two tasks:

TASK A — CONTRADICTION DETECTION:
Identify any pairs or groups of clauses that contradict each other, create circular obligations, or produce ambiguous outcomes when read together.

TASK B — BENCHMARK COMPARISON:
Compare each high-risk clause (risk_score >= 5) against typical fair-market standards for this document type. Classify each as:
- STANDARD: common and expected in this document type
- AGGRESSIVE: more one-sided than typical industry practice
- UNUSUAL: rarely seen; warrants extra scrutiny
- POTENTIALLY_UNENFORCEABLE: likely to fail legal challenge

Output ONLY valid JSON:
{
  "contradictions": [{ "clause_ids": [...], "description": "...", "severity": "LOW|MEDIUM|HIGH" }],
  "benchmark_comparisons": [{ "clause_id": "...", "classification": "...", "industry_note": "..." }]
}`;

const SCENARIO_PROMPT = `You are a real-world legal impact simulator. For each high-risk clause (risk_score >= 6), generate 2–3 concrete, specific real-world scenarios showing exactly how this clause could be enforced against the signing party.

Scenarios must be:
- Realistic and plausible, not hypothetical extremes
- Specific to the document type and clause content
- Written in plain language the signer will understand
- Alarming where genuinely warranted — do not minimize real risks

Output ONLY valid JSON:
[{ "clause_id": "...", "scenarios": ["scenario 1...", "scenario 2...", "scenario 3..."] }]`;

const COUNSEL_PROMPT = `You are a user-rights advocate and legal communication specialist. Given all prior analysis (clauses, risks, contradictions, benchmarks, scenarios), produce a comprehensive advisory report.

Your output must follow this exact JSON schema:
{
  "danger_rating": "SAFE | CAUTION | RISKY | DANGEROUS",
  "danger_summary": "one sentence explaining the rating",
  "executive_summary": "2–3 paragraph plain-language description of what the signer is actually agreeing to",
  "top_concerns": [
    {
      "rank": 1,
      "clause_id": "...",
      "concern": "plain language description",
      "negotiation_language": "exact suggested replacement or addendum text",
      "walk_away_threshold": true | false
    }
  ],
  "privacy_compliance_flags": ["list of privacy or regulatory compliance risks (GDPR, labor law, etc.)"],
  "questions_to_ask": ["question 1", "question 2", ...],
  "overall_power_balance": "BALANCED | SLIGHTLY_UNEVEN | HEAVILY_ONE_SIDED",
  "recommended_action": "SIGN | NEGOTIATE | SEEK_LEGAL_REVIEW | DO_NOT_SIGN"
}`;

// ============================================================================
// 2. DOCUMENT CATEGORIES CONFIGURATION
// ============================================================================

const DOCUMENT_CATEGORIES = [
  { id: 'employment', label: 'Employment / Offer Letter', icon: UserCheck, riskFocus: 'Non-compete, IP ownership, at-will terms, severance rights' },
  { id: 'service', label: 'Service Contract', icon: HeartHandshake, riskFocus: 'Liability caps, scope creep, payment schedules, SLA penalties' },
  { id: 'saas', label: 'Software / SaaS Terms', icon: FileCode, riskFocus: 'Data ownership, auto-renewals, arbitration waivers, vendor locks' },
  { id: 'event', label: 'Event / Ticket Terms', icon: MapPin, riskFocus: 'Refund denial, severe liability waivers, unilateral schedule shifts' },
  { id: 'rental', label: 'Rental / Lease Agreement', icon: Info, riskFocus: 'Hidden fees, landlord entry triggers, security deposit forfeits' },
  { id: 'financial', label: 'Financial / Loan Agreement', icon: DollarSign, riskFocus: 'Compound interest terms, default triggers, fee stacks, collateral' },
  { id: 'privacy', label: 'Privacy Policy', icon: Shield, riskFocus: 'Data monetizing, third-party sales, retention, GDPR non-compliance' },
  { id: 'insurance', label: 'Insurance Policy', icon: Shield, riskFocus: 'Exclusion conditions, claim denials, subrogation traps' },
  { id: 'nda', label: 'Freelance / NDA', icon: FileText, riskFocus: 'Broad IP assignments, non-solicits, gag clauses, NDAs' },
  { id: 'vendor', label: 'Vendor Agreement', icon: Layers, riskFocus: 'Indemnification asymmetry, licensing traps, convenience exits' },
  { id: 'general', label: 'General / Other', icon: Scale, riskFocus: 'General adversarial risk evaluation across all legal terms' }
];

// ============================================================================
// 3. SAMPLE DEMO DOCUMENT DATA (PROBLEMATIC OFFER LETTER)
// ============================================================================

const SAMPLE_DOCUMENT = `OFFER OF EMPLOYMENT — CONFIDENTIAL

Dear Alex Mercer,

We are pleased to offer you employment at Nexus Dynamics Inc. (the "Company") as a Senior Solutions Architect. Your employment is subject to the terms and conditions outlined in this agreement.

1. POSITION AND COMPENSATION
You will report to the Chief Technology Officer. Your starting base salary will be $145,000 per annum, payable in accordance with the Company’s standard payroll schedule.

2. AT-WILL EMPLOYMENT & SEVERANCE (Clause c1)
Your employment with the Company is strictly "at-will." This means that either you or the Company may terminate the employment relationship at any time, for any reason or no reason, immediately upon notice. In the event of termination by the Company for any reason, you shall not be entitled to any severance pay, compensation, or benefits beyond your accrued salary up to the date of termination. Upon termination, you must immediately return all Company property and execute all intellectual property assignments. Furthermore, you agree not to disparage the Company, its executives, or products in any public forum following your exit.

3. INTELLECTUAL PROPERTY OWNERSHIP (Clause c2)
The Employee agrees that any and all inventions, designs, concepts, software, algorithms, code, patents, and work product (collectively, "Inventions") conceived, developed, or reduced to practice by the Employee during the term of their employment, whether or not conceived during regular business hours, whether or not using Company resources, and whether or not related to the current or anticipated business, research, or development of the Company, shall be the sole and exclusive property of the Company from the moment of creation. The Employee hereby assigns all rights, titles, and interests in such Inventions to the Company.

4. SECONDARY INTELLECTUAL PROPERTY RETAINMENT (Clause c3)
Notwithstanding Section 3, the Company acknowledges that the Employee shall retain exclusive ownership of, and all rights to, any intellectual work product or software created entirely on the Employee's personal time, using their own personal equipment, and which does not relate in any way to the Company's business activities or research.

5. NON-COMPETE & RESTRICTIVE COVENANT (Clause c4)
To protect the Company's proprietary information, the Employee agrees that for a period of twenty-four (24) months following the termination of employment for any reason, the Employee will not, directly or indirectly, engage in, consult for, advise, or be employed by any business, entity, or competitor that operates in the technology, cloud services, software development, or data analytics sectors. This restriction applies globally, in any geographical territory where the Company conducts or plans to conduct business.

6. UNILATERAL AMENDMENT OF AGREEMENT (Clause c5)
The Company reserves the right to modify, amend, alter, or revoke any of the terms, covenants, policies, or conditions of this employment agreement, including compensation, benefits, and duties, at any time in its sole discretion without prior notice to the Employee. Continued employment following any such amendment shall constitute binding acceptance of the modified terms.

7. MANDATORY ARBITRATION & CLASS ACTION WAIVER (Clause c6)
Any dispute, claim, or controversy arising out of or relating to this agreement, your employment, or the termination thereof, shall be resolved exclusively through final and binding bilateral arbitration. Such arbitration shall be conducted in the state of Delaware, in accordance with the rules of the American Arbitration Association. The Employee hereby knowingly and voluntarily waives any right to resolve such disputes in a court of law before a judge or jury, and explicitly waives the right to participate in or lead any class, collective, or representative action against the Company. The costs of arbitration shall be shared equally between the parties.

By signing below, you acknowledge and agree to all terms above.

Accepted by: __________________________    Date: ______________`;

// ============================================================================
// 4. PRE-ANALYZED DASHBOARD DATA (HIGH-FIDELITY SIMULATION)
// ============================================================================

const PRELOADED_ANALYSIS = {
  danger_rating: "DANGEROUS",
  danger_summary: "9 High-risk clauses detected. Contains overbroad IP grab, mandatory Delaware arbitration, and 24-month global non-compete.",
  executive_summary: "Nexus Dynamics is offering you a highly uneven contract that severely restricts your rights both during and after your employment. Under these terms, they own anything you create (even on personal time under Section 3, contradicting Section 4), can modify your pay or fire you at-will without notice or severance, and prevent you from working in the entire tech sector globally for two years after you leave. Any dispute must be resolved through costly Delaware arbitration where you pay half the fees and waive your right to a jury or class action.",
  top_concerns: [
    {
      rank: 1,
      clause_id: "c2",
      concern: "Broad IP ownership grab which takes sole ownership of any invention created during employment, even on personal time or unrelated to company business.",
      negotiation_language: "All rights, titles, and interests in Inventions created by the Employee during their employment that are conceived entirely on the Employee's personal time, without using Company resources, equipment, or proprietary information, and which do not relate to the Company's active business, shall remain the sole and exclusive property of the Employee.",
      walk_away_threshold: true
    },
    {
      rank: 2,
      clause_id: "c4",
      concern: "A global, 24-month non-compete covering the entire technology and software sectors, which effectively prevents you from earning a living after exiting.",
      negotiation_language: "For a period of six (6) months following termination, the Employee shall not work for direct competitors of the Company within a 50-mile radius of the Employee's primary work location. This restriction applies only to companies directly engaged in cloud-native database architecture.",
      walk_away_threshold: true
    },
    {
      rank: 3,
      clause_id: "c6",
      concern: "Mandatory bilateral arbitration in Delaware, which waives your rights to class actions and requires sharing the high fees of arbitration equally.",
      negotiation_language: "Any disputes arising under this agreement shall be resolved in a court of competent jurisdiction in the state of the Employee's primary residence. The parties agree to waive jury trial rights, but the Company shall bear all administrative fees of any arbitration if arbitration is mutually selected.",
      walk_away_threshold: false
    },
    {
      rank: 4,
      clause_id: "c5",
      concern: "Unilateral amendment clause allowing the Company to alter any term of the agreement (including compensation and benefits) at any time without notice.",
      negotiation_language: "Any amendment, modification, or waiver of any provision of this agreement must be in writing and signed by both the Employee and an authorized executive of the Company.",
      walk_away_threshold: true
    },
    {
      rank: 5,
      clause_id: "c1",
      concern: "At-will termination without severance, coupled with a post-employment non-disparagement mandate that restricts your speech.",
      negotiation_language: "In the event of termination by the Company without Cause, the Company shall provide thirty (30) days' notice or equivalent payment in lieu of notice, plus a severance package of one (1) month of base salary per year of completed service. Non-disparagement obligations shall be strictly mutual.",
      walk_away_threshold: false
    }
  ],
  privacy_compliance_flags: [
    "Immediate termination IP transfer obligations might conflict with local labor codes regarding ownership of non-work-related software.",
    "Bilateral Delaware venue arbitration could be legally unenforceable in states with strong consumer/employee protection laws (e.g., California Labor Code § 925).",
    "Post-employment non-disparagement clauses are subject to strict FTC and NLRB rulings regarding employee rights to speak about working conditions."
  ],
  questions_to_ask: [
    "Can we refine the IP assignment clause (Section 3) to exclude work done on personal time, as suggested by the contradiction in Section 4?",
    "Will Nexus Dynamics agree to reduce the non-compete duration from 24 months to 6 months, and limit the geographic scope to direct competitors?",
    "Why are the costs of arbitration split equally, and can the venue be moved to my home state instead of Delaware?",
    "Can we make the non-disparagement obligation in Section 2 mutual?"
  ],
  overall_power_balance: "HEAVILY_ONE_SIDED",
  recommended_action: "NEGOTIATE",
  clauses: [
    {
      id: "c1",
      type: "TERMINATION",
      original_text: "Your employment with the Company is strictly 'at-will.' This means that either you or the Company may terminate the employment relationship at any time, for any reason or no reason, immediately upon notice. In the event of termination by the Company for any reason, you shall not be entitled to any severance pay, compensation, or benefits beyond your accrued salary up to the date of termination. Upon termination, you must immediately return all Company property and execute all intellectual property assignments. Furthermore, you agree not to disparage the Company, its executives, or products in any public forum following your exit.",
      benefits_party: "DRAFTER",
      location_hint: "Section 2",
      risk_score: 8,
      risk_type: "Severance Forfeiture & Speech Restraint",
      red_flags: [
        "Immediate firing without notice is allowed.",
        "Zero severance is provided regardless of your tenure.",
        "One-sided non-disparagement gag clause prevents you from criticizing the employer even if you are mistreated.",
        "Forced signing of post-employment documents on the spot is mandated."
      ],
      plain_english_meaning: "They can fire you today for no reason, give you nothing, force you to sign IP papers immediately, and you are legally banned from saying anything negative about them afterwards.",
      classification: "AGGRESSIVE",
      industry_note: "Standard employment is at-will, but absolute lack of notice/severance combined with a one-sided non-disparagement gag is highly aggressive.",
      scenarios: [
        "Scenario A: You work at Nexus for 5 years. They lay you off due to restructuring. You get zero severance and are escorted from the building, while a gag order prevents you from warning others.",
        "Scenario B: You post on LinkedIn about the toxic work environment after your sudden firing. Nexus sues you for breaching the non-disparagement covenant."
      ],
      negotiation_language: "In the event of termination by the Company without Cause, the Company shall provide thirty (30) days' notice or equivalent payment in lieu of notice, plus a severance package of one (1) month of base salary per year of completed service. Non-disparagement obligations shall be strictly mutual."
    },
    {
      id: "c2",
      type: "IP_OWNERSHIP",
      original_text: "The Employee agrees that any and all inventions, designs, concepts, software, algorithms, code, patents, and work product (collectively, 'Inventions') conceived, developed, or reduced to practice by the Employee during the term of their employment, whether or not conceived during regular business hours, whether or not using Company resources, and whether or not related to the current or anticipated business, research, or development of the Company, shall be the sole and exclusive property of the Company from the moment of creation.",
      benefits_party: "DRAFTER",
      location_hint: "Section 3",
      risk_score: 10,
      risk_type: "Overbroad IP Grab",
      red_flags: [
        "Claims ownership of software built on your weekends.",
        "Claims ownership of creations totally unrelated to Nexus' business.",
        "Applies even if you used zero company resources or equipment.",
        "Creates a direct legal conflict with Section 4."
      ],
      plain_english_meaning: "Nexus Dynamics legally owns everything you create, write, or build, even on your weekends, using your own laptop, and even if it is a cooking app that has nothing to do with their business.",
      classification: "POTENTIALLY_UNENFORCEABLE",
      industry_note: "Standard clauses only claim IP created using company resources or related to company business. Grabbing unrelated personal IP is highly unusual and often illegal in states like CA, WA, and NY.",
      scenarios: [
        "Scenario A: You build a mobile gaming app on your personal laptop during weekends. It goes viral. Nexus Dynamics discovers it and sues to claim full ownership of the app and all its revenue.",
        "Scenario B: You contribute to an open-source project in your spare time. Nexus claims ownership of your contributions, creating massive liabilities for you and the open-source community."
      ],
      negotiation_language: "All rights, titles, and interests in Inventions created by the Employee during their employment that are conceived entirely on the Employee's personal time, without using Company resources, equipment, or proprietary information, and which do not relate to the Company's active business, shall remain the sole and exclusive property of the Employee."
    },
    {
      id: "c3",
      type: "IP_OWNERSHIP",
      original_text: "Notwithstanding Section 3, the Company acknowledges that the Employee shall retain exclusive ownership of, and all rights to, any intellectual work product or software created entirely on the Employee's personal time, using their own personal equipment, and which does not relate in any way to the Company's business activities or research.",
      benefits_party: "SIGNER",
      location_hint: "Section 4",
      risk_score: 2,
      risk_type: "Contradictory Protections",
      red_flags: [
        "Directly contradicts the absolute ownership claimed in Section 3.",
        "Creates legal ambiguity as to which section takes precedence in a dispute."
      ],
      plain_english_meaning: "This clause attempts to protect your personal work, but because Section 3 says 'regardless of personal time' it creates a direct conflict. The company can exploit this confusion.",
      classification: "UNUSUAL",
      industry_note: "Having two adjacent clauses that directly contradict each other regarding intellectual property is an auditor's red flag, indicating poor drafting or deliberate ambiguity.",
      scenarios: [
        "Scenario A: A court has to interpret the contract. Due to the contradiction, the company argues that Section 3 was the primary intent and Section 4 was a minor exception, causing costly litigation over your weekend projects."
      ],
      negotiation_language: "Consolidate Section 3 and Section 4 into a single, unambiguous clause that explicitly protects personal inventions."
    },
    {
      id: "c4",
      type: "NON_COMPETE",
      original_text: "To protect the Company's proprietary information, the Employee agrees that for a period of twenty-four (24) months following the termination of employment for any reason, the Employee will not, directly or indirectly, engage in, consult for, advise, or be employed by any business, entity, or competitor that operates in the technology, cloud services, software development, or data analytics sectors. This restriction applies globally, in any geographical territory where the Company conducts or plans to conduct business.",
      benefits_party: "DRAFTER",
      location_hint: "Section 5",
      risk_score: 9,
      risk_type: "Industry-Wide Career Lockout",
      red_flags: [
        "Bans you from working in the entire tech and software sector.",
        "Extremely long duration of 24 months.",
        "Geographic scope is 'global,' leaving you nowhere to legally work in tech.",
        "Applies even if you are fired or laid off by the company."
      ],
      plain_english_meaning: "You cannot take any software or tech job anywhere in the world for two full years after you leave Nexus Dynamics, even if they fired you without cause.",
      classification: "POTENTIALLY_UNENFORCEABLE",
      industry_note: "Non-compete clauses must be narrow in time, scope, and geography. A 2-year global ban on the entire tech industry is highly aggressive and increasingly banned by state laws and federal FTC guidelines.",
      scenarios: [
        "Scenario A: You resign from Nexus Dynamics to take a job at a small web development agency. Nexus sends a cease-and-desist letter to your new employer, causing them to rescind your job offer.",
        "Scenario B: Nexus lays you off. You try to freelance to pay rent, but because of the broad wording, you are technically in breach if you write code for any technology client."
      ],
      negotiation_language: "For a period of six (6) months following termination, the Employee shall not work for direct competitors of the Company within a 50-mile radius of the Employee's primary work location. This restriction applies only to companies directly engaged in cloud-native database architecture."
    },
    {
      id: "c5",
      type: "AMENDMENT",
      original_text: "The Company reserves the right to modify, amend, alter, or revoke any of the terms, covenants, policies, or conditions of this employment agreement, including compensation, benefits, and duties, at any time in its sole discretion without prior notice to the Employee. Continued employment following any such amendment shall constitute binding acceptance of the modified terms.",
      benefits_party: "DRAFTER",
      location_hint: "Section 6",
      risk_score: 9,
      risk_type: "Unilateral Contract Mutation",
      red_flags: [
        "Allows the company to cut your salary unilaterally without notice.",
        "They can change your job role or eliminate benefits without your consent.",
        "Your only recourse is to quit immediately, triggering the severe non-compete."
      ],
      plain_english_meaning: "Nexus can change your salary, take away your health insurance, or modify these terms whenever they want, and by turning up to work the next day, you legally agree to the changes.",
      classification: "AGGRESSIVE",
      industry_note: "Standard contracts require mutual written agreement signed by both parties to make any amendments. Unilateral adjustments are highly aggressive and destabilizing.",
      scenarios: [
        "Scenario A: Nexus Dynamics struggles financially and announces a 30% pay cut for all employees. Because of this clause, you have legally accepted the pay cut simply by showing up to work the next Monday.",
        "Scenario B: They unilaterally add a harsher non-solicitation clause. You only find out years later when you try to leave."
      ],
      negotiation_language: "Any amendment, modification, or waiver of any provision of this agreement must be in writing and signed by both the Employee and an authorized executive of the Company."
    },
    {
      id: "c6",
      type: "ARBITRATION",
      original_text: "Any dispute, claim, or controversy arising out of or relating to this agreement, your employment, or the termination thereof, shall be resolved exclusively through final and binding bilateral arbitration. Such arbitration shall be conducted in the state of Delaware, in accordance with the rules of the American Arbitration Association. The Employee hereby knowingly and voluntarily waives any right to resolve such disputes in a court of law before a judge or jury, and explicitly waives the right to participate in or lead any class, collective, or representative action against the Company. The costs of arbitration shall be shared equally between the parties.",
      benefits_party: "DRAFTER",
      location_hint: "Section 7",
      risk_score: 8,
      risk_type: "Bilateral Rights & Venue Extinguishment",
      red_flags: [
        "Waives your right to a public court trial or a jury.",
        "Waives class action rights, meaning you can't join other employees in a lawsuit.",
        "Forces arbitration in Delaware, which is highly expensive and distant.",
        "Splits arbitration fees equally, meaning you could owe tens of thousands in arbitrator fees just to raise a wage claim."
      ],
      plain_english_meaning: "If they steal your wages or discriminate against you, you cannot sue them in court. You must fly to Delaware, pay half the cost of an expensive private arbitrator, and fight them alone with no class-action support.",
      classification: "AGGRESSIVE",
      industry_note: "Mandatory arbitration is common, but placing the venue in a distant state and forcing the employee to pay half the arbitrator costs (which often runs over $10,000) is highly aggressive and often struck down as unconscionable.",
      scenarios: [
        "Scenario A: Nexus fails to pay you $5,000 in earned commissions. To fight it, you must initiate arbitration in Delaware, costing you $8,000 in upfront filing and arbitrator fees. The high cost forces you to abandon your claim.",
        "Scenario B: You and 20 other employees face systematic gender discrimination. You are legally blocked from filing a class-action lawsuit and must fight separate, secret arbitration cases in Delaware."
      ],
      negotiation_language: "Any disputes arising under this agreement shall be resolved in a court of competent jurisdiction in the state of the Employee's primary residence. The parties agree to waive jury trial rights, but the Company shall bear all administrative fees of any arbitration if arbitration is mutually selected."
    }
  ],
  contradictions: [
    {
      clause_ids: ["c2", "c3"],
      description: "Section 3 (Clause c2) asserts Company ownership over all Inventions conceived during the employment term 'whether or not conceived during regular business hours, whether or not using Company resources, and whether or not related to the Company's business.' However, Section 4 (Clause c3) asserts that the Employee retains ownership of works created on 'personal time, using personal equipment, and not related to the Company's business.' This creates a severe legal contradiction, leaving the employee's personal IP vulnerable to bad-faith claims.",
      severity: "HIGH"
    }
  ],
  benchmark_comparisons: [
    { clause_id: "c1", classification: "AGGRESSIVE", industry_note: "Standard employment is at-will, but absolute lack of notice/severance combined with a one-sided non-disparagement gag is highly aggressive." },
    { clause_id: "c2", classification: "POTENTIALLY_UNENFORCEABLE", industry_note: "Standard clauses only claim IP created using company resources or related to company business. Grabbing unrelated personal IP is highly unusual and often illegal in states like CA, WA, and NY." },
    { clause_id: "c3", classification: "UNUSUAL", industry_note: "Having two adjacent clauses that directly contradict each other regarding intellectual property is an auditor's red flag, indicating poor drafting or deliberate ambiguity." },
    { clause_id: "c4", classification: "POTENTIALLY_UNENFORCEABLE", industry_note: "Non-compete clauses must be narrow in time, scope, and geography. A 2-year global ban on the entire tech industry is highly aggressive and increasingly banned by state laws and federal FTC guidelines." },
    { clause_id: "c5", classification: "AGGRESSIVE", industry_note: "Standard contracts require mutual written agreement signed by both parties to make any amendments. Unilateral adjustments are highly aggressive and destabilizing." },
    { clause_id: "c6", classification: "AGGRESSIVE", industry_note: "Mandatory arbitration is common, but placing the venue in a distant state and forcing the employee to pay half the arbitrator costs (which often runs over $10,000) is highly aggressive and often struck down as unconscionable." }
  ]
};

export default function App() {
  // ============================================================================
  // React State Declarations (Section 8 of Build Prompt)
  // ============================================================================
  
  const [docType, setDocType] = useState('employment');
  const [inputText, setInputText] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null); // { base64, mediaType, fileName }
  
  const [agentStatus, setAgentStatus] = useState({
    extractor: 'idle',   // idle | running | done | error
    analyst: 'idle',
    contradiction: 'idle',
    scenario: 'idle',
    counsel: 'idle'
  });
  
  const [clauses, setClauses] = useState([]); // Agent 1
  const [riskData, setRiskData] = useState([]); // Agent 2
  const [contradictions, setContradictions] = useState([]); // Agent 3
  const [benchmarks, setBenchmarks] = useState([]); // Agent 3
  const [scenarios, setScenarios] = useState([]); // Agent 4
  const [counsel, setCounsel] = useState(null); // Agent 5
  const [dangerRating, setDangerRating] = useState(null);
  
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortBy, setSortBy] = useState('risk_score');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClause, setExpandedClause] = useState(null);
  const [activeView, setActiveView] = useState('clauses'); // clauses | contradictions | summary
  
  // UI Helpers (Not strictly in prompt state but essential for UX)
  const [apiKey, setApiKey] = useState('');
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [analysisLogs, setAnalysisLogs] = useState([]);
  const [activeStepText, setActiveStepText] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [history, setHistory] = useState([]); // [{ name, date, docType, data }]
  const [isDragging, setIsDragging] = useState(false);
  const [simulatedMode, setSimulatedMode] = useState(false);
  const [ocrRunning, setOcrRunning] = useState(false);
  const fileInputRef = useRef(null);

  // Load API Key from React Memory (state)
  const isApiKeyConfigured = useMemo(() => apiKey.trim().length > 0, [apiKey]);

  // Clean up state on reset
  const handleReset = () => {
    setInputText('');
    setUploadedFile(null);
    setClauses([]);
    setRiskData([]);
    setContradictions([]);
    setBenchmarks([]);
    setScenarios([]);
    setCounsel(null);
    setDangerRating(null);
    setErrorMessage(null);
    setSimulatedMode(false);
    setAgentStatus({
      extractor: 'idle',
      analyst: 'idle',
      contradiction: 'idle',
      scenario: 'idle',
      counsel: 'idle'
    });
    setAnalysisLogs([]);
    setActiveStepText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Pre-fill problematic employment contract
  const handleLoadSample = () => {
    handleReset();
    setDocType('employment');
    setInputText(SAMPLE_DOCUMENT);
  };

  // Add Log Message helper
  const addLog = (agent, text) => {
    setAnalysisLogs(prev => [...prev, { agent, text, time: new Date().toLocaleTimeString() }]);
    setActiveStepText(text);
  };

  // ============================================================================
  // FILE HANDLING FUNCTIONALITY (PDF, DOCX, TXT, IMAGE)
  // ============================================================================

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = (error) => reject(error);
    });
  };

  const processFile = async (file) => {
    setErrorMessage(null);
    const extension = file.name.split('.').pop().toLowerCase();
    
    // File validation: Size check (12KB character limits or standard sizes)
    if (file.size > 8 * 1024 * 1024) { // 8MB limit
      setErrorMessage("File exceeds 8MB size limit. Please upload a smaller legal file.");
      return;
    }

    try {
      if (extension === 'txt') {
        const text = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsText(file);
          reader.onload = () => resolve(reader.result);
          reader.onerror = (e) => reject(e);
        });
        
        if (text.trim().length < 100) {
          setErrorMessage("Document too brief for meaningful analysis (minimum 100 characters).");
          return;
        }
        setInputText(text.slice(0, 12000)); // Truncate to first 12k chars to prevent token limits
        if (text.length > 12000) {
          addLog("SYSTEM", "Document exceeds character limit. Truncated to first 12,000 characters.");
        }
        setUploadedFile(null);
      } 
      else if (extension === 'docx') {
        if (!window.mammoth) {
          throw new Error("Mammoth.js parser not loaded yet from CDN. Please verify your connection.");
        }
        addLog("SYSTEM", "Extracting text client-side from DOCX using mammoth.js...");
        const arrayBuffer = await file.arrayBuffer();
        const result = await window.mammoth.extractRawText({ arrayBuffer });
        const extractedText = result.value;
        
        if (extractedText.trim().length < 100) {
          setErrorMessage("Document too brief for meaningful analysis (minimum 100 characters).");
          return;
        }
        setInputText(extractedText.slice(0, 12000));
        if (extractedText.length > 12000) {
          addLog("SYSTEM", "Document exceeds character limit. Truncated to first 12,000 characters.");
        }
        setUploadedFile(null);
      } 
      else if (extension === 'pdf') {
        addLog("SYSTEM", "Converting PDF file to Base64 binary context...");
        const b64 = await fileToBase64(file);
        setUploadedFile({
          base64: b64,
          mediaType: 'application/pdf',
          fileName: file.name
        });
        setInputText(`[PDF Document: ${file.name} - Loaded for Beta Document Analysis]`);
      } 
      else if (['jpg', 'jpeg', 'png'].includes(extension)) {
        addLog("SYSTEM", "Reading document image for Groq Vision OCR...");
        const b64 = await fileToBase64(file);
        setUploadedFile({
          base64: b64,
          mediaType: file.type || 'image/jpeg',
          fileName: file.name
        });
        setInputText(`[Scanned Document Image: ${file.name} - Loaded for Vision OCR Analysis]`);
      } 
      else {
        setErrorMessage("Unsupported file format. Please upload .pdf, .docx, .txt, or scanned image (.jpg, .png).");
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(`File parsing failed: ${err.message}. Please copy and paste plain text directly instead.`);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  // ============================================================================
  // GROQ API INTEGRATION
  // ============================================================================

  const callAgent = async (systemPrompt, userContent, selectedDocType, isImageInput = false) => {
    const isDev = import.meta.env.DEV;
    const endpoint = isDev ? '/api/groq/v1/chat/completions' : 'https://api.groq.com/openai/v1/chat/completions';
    
    let model = "llama-3.3-70b-versatile";
    let messageContent = userContent;
    
    if (isImageInput && uploadedFile) {
      // Groq vision models support base64
      model = "llama-3.2-90b-vision-preview";
      messageContent = [
        { type: "text", text: `Analyze this ${uploadedFile.mediaType === 'application/pdf' ? 'document' : 'image'}. Category: ${selectedDocType}. First extract all text, then perform your clause extraction task as requested.` },
        { type: "image_url", image_url: { url: `data:${uploadedFile.mediaType};base64,${uploadedFile.base64}` } }
      ];
    }

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    };

    const requestBody = {
      model: model,
      temperature: 0.1,
      messages: [
        { role: "system", content: `${systemPrompt}\n\nDocument category context: ${selectedDocType}. ALWAYS output ONLY valid, parsable JSON. Never output markdown fences (e.g. \`\`\`json). Never output conversational introductions, notes, or post-scripts.` },
        { role: "user", content: messageContent }
      ]
    };

    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody)
      });
    } catch (e) {
      if (isDev) {
        addLog("SYSTEM", "Vite local proxy failed or unavailable. Retrying via direct Groq Endpoint...");
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody)
        });
      } else {
        throw e;
      }
    }

    if (!response.ok) {
      const errBody = await response.text();
      let parsedErr;
      try { parsedErr = JSON.parse(errBody); } catch(x){}
      throw new Error(parsedErr?.error?.message || `Groq API Error Status ${response.status}: ${errBody}`);
    }

    const responseData = await response.json();
    const outputText = (responseData.choices?.[0]?.message?.content || "").trim();

    // Clean markdown code blocks from the output
    const sanitizedText = outputText
      .replace(/^```json/i, '')
      .replace(/^```/i, '')
      .replace(/```$/i, '')
      .trim();

    try {
      return JSON.parse(sanitizedText);
    } catch (parseError) {
      console.error("Failed JSON parse. Raw output:", outputText, "Sanitized:", sanitizedText);
      // Fallback regex attempt for JSON array/object recovery
      const jsonRegex = /(\[[\s\S]*\]|\{[\s\S]*\})/s;
      const matched = sanitizedText.match(jsonRegex);
      if (matched) {
        try {
          return JSON.parse(matched[0]);
        } catch (innerError) {
          throw new Error(`JSON parsing failed: ${parseError.message}. Response contents were not formatted correctly.`);
        }
      }
      throw new Error(`JSON parsing failed: ${parseError.message}. Response contents were not formatted correctly.`);
    }
  };

  // ============================================================================
  // CORE PIPELINE EXECUTION
  // ============================================================================

  const startAnalysis = async () => {
    if (!apiKey.trim()) {
      setShowApiSettings(true);
      setErrorMessage("Groq API Key is required. Please set it in the settings panel to initiate analysis.");
      return;
    }
    if (!inputText.trim()) {
      setErrorMessage("Please type, paste, or upload a legal document first.");
      return;
    }

    setErrorMessage(null);
    setSimulatedMode(false);
    setAnalysisLogs([]);
    
    // Reset statuses
    setAgentStatus({
      extractor: 'running',
      analyst: 'idle',
      contradiction: 'idle',
      scenario: 'idle',
      counsel: 'idle'
    });

    try {
      addLog("EXTRACTOR", `Initializing extractor agent for document category: ${docType.toUpperCase()}`);
      
      const isDocumentFile = uploadedFile !== null;
      let textContent = isDocumentFile ? "" : inputText;
      
      // Agent 1: Extraction
      addLog("EXTRACTOR", isDocumentFile ? "Analyzing document content and extracting clauses..." : "Scanning text for legal clauses and categorizing...");
      const extractedClauses = await callAgent(EXTRACTOR_PROMPT, textContent, docType, isDocumentFile);
      
      if (!Array.isArray(extractedClauses) || extractedClauses.length === 0) {
        throw new Error("Extractor Agent did not find any clauses. The document may be too short, blank, or improperly formatted.");
      }

      setClauses(extractedClauses);
      addLog("EXTRACTOR", `Success. Extracted ${extractedClauses.length} clauses.`);
      setAgentStatus(s => ({ ...s, extractor: 'done', analyst: 'running' }));

      // Agent 2: Risk Scoring
      addLog("RISK ANALYST", "Beginning adversarial risk auditing. Protecting the signing party...");
      const evaluatedClauses = await callAgent(RISK_ANALYST_PROMPT, JSON.stringify(extractedClauses), docType);
      
      if (!Array.isArray(evaluatedClauses)) {
        throw new Error("Risk Analyst Agent failed to return a valid JSON array.");
      }

      setRiskData(evaluatedClauses);
      addLog("RISK ANALYST", "Completed individual clause risk auditing and red-flag tagging.");
      setAgentStatus(s => ({ ...s, analyst: 'done', contradiction: 'running' }));

      // Agent 3: Contradiction & Benchmarks
      addLog("CONTRADICTION DETECTOR", "Auditing consistency and cross-referencing industry benchmarks...");
      const contradictionResult = await callAgent(CONTRADICTION_PROMPT, JSON.stringify(evaluatedClauses), docType);
      
      const parsedContradictions = contradictionResult.contradictions || [];
      const parsedBenchmarks = contradictionResult.benchmark_comparisons || [];

      setContradictions(parsedContradictions);
      setBenchmarks(parsedBenchmarks);
      
      // Merge benchmarks classification into the clauses for better UI rendering
      const mergedClauses = evaluatedClauses.map(clause => {
        const benchmark = parsedBenchmarks.find(b => b.clause_id === clause.id);
        return {
          ...clause,
          classification: benchmark ? benchmark.classification : 'STANDARD',
          industry_note: benchmark ? benchmark.industry_note : ''
        };
      });
      setRiskData(mergedClauses);

      addLog("CONTRADICTION DETECTOR", `Audit finished. Detected ${parsedContradictions.length} internal contradictions.`);
      setAgentStatus(s => ({ ...s, contradiction: 'done', scenario: 'running' }));

      // Agent 4: Scenario Simulation (Only for high risk score >= 6)
      const highRisk = evaluatedClauses.filter(c => c.risk_score >= 6);
      addLog("SCENARIO ENGINE", `Simulating real-world liabilities for ${highRisk.length} high-risk clauses...`);
      
      let scenariosResult = [];
      if (highRisk.length > 0) {
        scenariosResult = await callAgent(SCENARIO_PROMPT, JSON.stringify(highRisk), docType);
        setScenarios(scenariosResult);
        
        // Append scenarios into our main clause state
        const withScenarios = mergedClauses.map(clause => {
          const sc = scenariosResult.find(s => s.clause_id === clause.id);
          return {
            ...clause,
            scenarios: sc ? sc.scenarios : []
          };
        });
        setRiskData(withScenarios);
      } else {
        addLog("SCENARIO ENGINE", "No high-risk clauses (risk score >= 6) identified. Skipping scenario runs.");
      }
      
      setAgentStatus(s => ({ ...s, scenario: 'done', counsel: 'running' }));

      // Agent 5: Counsel Advisory Executive Report
      addLog("COUNSEL ADVISOR", "Synthesizing full reports and drafting protective negotiation templates...");
      const fullContext = {
        docType,
        clauses: evaluatedClauses.map(c => ({
          id: c.id,
          type: c.type,
          original_text: c.original_text,
          risk_score: c.risk_score,
          red_flags: c.red_flags,
          plain_english_meaning: c.plain_english_meaning,
          classification: mergedClauses.find(mc => mc.id === c.id)?.classification || 'STANDARD'
        })),
        contradictions: parsedContradictions,
        benchmarks: parsedBenchmarks,
        scenarios: scenariosResult
      };

      const counselResult = await callAgent(COUNSEL_PROMPT, JSON.stringify(fullContext), docType);
      
      setCounsel(counselResult);
      setDangerRating(counselResult.danger_rating);
      addLog("COUNSEL ADVISOR", "Report successfully generated. System ready.");
      setAgentStatus(s => ({ ...s, counsel: 'done' }));

      // Add to local history list
      const docName = uploadedFile ? uploadedFile.fileName : `Contract Audit - ${docType.charAt(0).toUpperCase() + docType.slice(1)}`;
      const newHistoryItem = {
        name: docName,
        date: new Date().toLocaleString(),
        docType,
        clauses: mergedClauses.map(c => {
          const sc = scenariosResult.find(s => s.clause_id === c.id);
          return { ...c, scenarios: sc ? sc.scenarios : [] };
        }),
        contradictions: parsedContradictions,
        benchmarks: parsedBenchmarks,
        counsel: counselResult,
        dangerRating: counselResult.danger_rating
      };
      setHistory(prev => [newHistoryItem, ...prev]);

    } catch (err) {
      console.error(err);
      setErrorMessage(`Multi-Agent Pipeline Failed: ${err.message}. Double-check your API key and connection.`);
      // Set error status
      const activeRunningAgent = Object.keys(agentStatus).find(k => agentStatus[k] === 'running');
      if (activeRunningAgent) {
        setAgentStatus(s => ({ ...s, [activeRunningAgent]: 'error' }));
      }
    }
  };

  // ============================================================================
  // SIMULATION MODE (EXHIBITS HIGH-FIDELITY DESIGN WITH ZERO API KEY)
  // ============================================================================

  const runSimulation = () => {
    handleReset();
    setSimulatedMode(true);
    setDocType('employment');
    setInputText(SAMPLE_DOCUMENT);
    setErrorMessage(null);
    setAnalysisLogs([]);

    const steps = [
      { agent: 'extractor', text: "Initializing extractor agent for document category: EMPLOYMENT", status: 'running' },
      { agent: 'extractor', text: "Identifying distinct clause objects and locations...", status: 'running' },
      { agent: 'extractor', text: "Success. Extracted 6 legal clauses from the offer letter.", status: 'done' },
      { agent: 'analyst', text: "Analyzing risks on behalf of the signer. Inspecting exploitation factors...", status: 'running' },
      { agent: 'analyst', text: "Completed risk scoring. Flagged multiple unilateral and unconscionable clauses.", status: 'done' },
      { agent: 'contradiction', text: "Searching for intra-document consistency issues and standardizing clauses...", status: 'running' },
      { agent: 'contradiction', text: "Contradiction found between Section 3 and Section 4. Flagging for user review.", status: 'done' },
      { agent: 'scenario', text: "Synthesizing real-world enforcement scenarios for high-risk sections...", status: 'running' },
      { agent: 'scenario', text: "Generated 11 scenario simulations demonstrating legal liabilities.", status: 'done' },
      { agent: 'counsel', text: "Drafting final advisory counsel report and protective negotiation copy...", status: 'running' },
      { agent: 'counsel', text: "Counsel report created. Populating intelligence dashboard.", status: 'done' }
    ];

    let delay = 0;
    steps.forEach((step, idx) => {
      setTimeout(() => {
        addLog(step.agent.toUpperCase(), step.text);
        
        // Update statuses dynamically
        if (step.status === 'running') {
          setAgentStatus(s => ({
            ...s,
            [step.agent]: 'running'
          }));
        } else if (step.status === 'done') {
          setAgentStatus(s => {
            const nextAgent = step.agent === 'extractor' ? 'analyst' : 
                              step.agent === 'analyst' ? 'contradiction' : 
                              step.agent === 'contradiction' ? 'scenario' : 
                              step.agent === 'scenario' ? 'counsel' : null;
            return {
              ...s,
              [step.agent]: 'done',
              ...(nextAgent ? { [nextAgent]: 'running' } : {})
            };
          });
        }

        // Final payload loading
        if (idx === steps.length - 1) {
          setClauses(PRELOADED_ANALYSIS.clauses);
          setRiskData(PRELOADED_ANALYSIS.clauses);
          setContradictions(PRELOADED_ANALYSIS.contradictions);
          setBenchmarks(PRELOADED_ANALYSIS.benchmark_comparisons);
          setScenarios(PRELOADED_ANALYSIS.clauses.map(c => ({ clause_id: c.id, scenarios: c.scenarios })));
          setCounsel(PRELOADED_ANALYSIS);
          setDangerRating(PRELOADED_ANALYSIS.danger_rating);
          setAgentStatus({
            extractor: 'done',
            analyst: 'done',
            contradiction: 'done',
            scenario: 'done',
            counsel: 'done'
          });
          
          // Save to history
          const newHistoryItem = {
            name: "Nexus Dynamics Offer Letter (Simulated)",
            date: new Date().toLocaleString(),
            docType: 'employment',
            clauses: PRELOADED_ANALYSIS.clauses,
            contradictions: PRELOADED_ANALYSIS.contradictions,
            benchmarks: PRELOADED_ANALYSIS.benchmark_comparisons,
            counsel: PRELOADED_ANALYSIS,
            dangerRating: PRELOADED_ANALYSIS.danger_rating
          };
          setHistory(prev => [newHistoryItem, ...prev]);
        }
      }, delay);
      
      delay += 800; // Incrementally fast but visible transitions
    });
  };

  // Load a historic result from state
  const loadHistoryItem = (item) => {
    handleReset();
    setDocType(item.docType);
    setClauses(item.clauses);
    setRiskData(item.clauses);
    setContradictions(item.contradictions);
    setBenchmarks(item.benchmarks);
    setCounsel(item.counsel);
    setDangerRating(item.dangerRating);
    setAgentStatus({
      extractor: 'done',
      analyst: 'done',
      contradiction: 'done',
      scenario: 'done',
      counsel: 'done'
    });
    addLog("SYSTEM", `Loaded historic audit results for "${item.name}"`);
  };

  // ============================================================================
  // CLAUSE FILTERING, SORTING & SEARCH LOGIC (Section 7.7)
  // ============================================================================

  const processedClauses = useMemo(() => {
    let list = [...riskData];

    // Filter logic
    if (activeFilter !== 'all') {
      if (activeFilter === 'high_risk') {
        list = list.filter(c => c.risk_score >= 7);
      } else if (activeFilter === 'aggressive') {
        list = list.filter(c => c.classification === 'AGGRESSIVE');
      } else if (activeFilter === 'ambiguous') {
        list = list.filter(c => c.ambiguity_score >= 6 || c.risk_type.toLowerCase().includes('ambigu'));
      } else if (activeFilter === 'contradictions') {
        // filter clauses that appear in contradiction list
        const contradictionIds = contradictions.flatMap(c => c.clause_ids);
        list = list.filter(c => contradictionIds.includes(c.id));
      } else {
        // Filter by mapped type
        const typeMap = {
          'privacy': 'DATA/PRIVACY',
          'financial': 'PAYMENT',
          'ip': 'IP_OWNERSHIP',
          'auto_renewal': 'AUTO_RENEWAL'
        };
        const targetType = typeMap[activeFilter];
        if (targetType) {
          list = list.filter(c => c.type === targetType);
        }
      }
    }

    // Search logic
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => 
        c.original_text.toLowerCase().includes(q) || 
        c.plain_english_meaning.toLowerCase().includes(q) ||
        c.risk_type.toLowerCase().includes(q)
      );
    }

    // Sort logic
    list.sort((a, b) => {
      if (sortBy === 'risk_score') {
        return b.risk_score - a.risk_score;
      }
      if (sortBy === 'type') {
        return a.type.localeCompare(b.type);
      }
      if (sortBy === 'doc_order') {
        // compare IDs e.g. c1, c2, c3
        const numA = parseInt(a.id.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.id.replace(/\D/g, '')) || 0;
        return numA - numB;
      }
      if (sortBy === 'benchmark') {
        const order = { 'POTENTIALLY_UNENFORCEABLE': 4, 'AGGRESSIVE': 3, 'UNUSUAL': 2, 'STANDARD': 1 };
        const valA = order[a.classification] || 0;
        const valB = order[b.classification] || 0;
        return valB - valA;
      }
      return 0;
    });

    return list;
  }, [riskData, activeFilter, sortBy, searchQuery, contradictions]);

  // ============================================================================
  // EXPORT / EXPLAINABILITY GENERATION
  // ============================================================================

  const getExportText = () => {
    if (!counsel) return "";
    
    let text = `======================================================================
LEXGUARD REPORT — CONTRACT AUDIT INTELLIGENCE
DANGER LEVEL: ${counsel.danger_rating}
Recommended Action: ${counsel.recommended_action}
======================================================================

EXECUTIVE SUMMARY
-----------------
${counsel.executive_summary}

Power Balance Rating: ${counsel.overall_power_balance}
Summary Details: ${counsel.danger_summary}

TOP AUDITED CONCERNS
--------------------`;

    counsel.top_concerns.forEach((concern, i) => {
      text += `\n\n[CONCERN ${i + 1}] Clause Ref: ${concern.clause_id.toUpperCase()}
Issue Description: ${concern.concern}
Proposed Alternative Clause Addendum:
"${concern.negotiation_language}"
Walk-away Threshold Triggered: ${concern.walk_away_threshold ? 'YES' : 'NO'}`;
    });

    text += `\n\nPRIVACY & REGULATORY COMPLIANCE FLAGS
------------------------------------`;
    counsel.privacy_compliance_flags.forEach(flag => {
      text += `\n- ${flag}`;
    });

    text += `\n\nSTRATEGIC QUESTIONS TO ASK THE COUNTERPARTY
-------------------------------------------`;
    counsel.questions_to_ask.forEach((q, i) => {
      text += `\n${i + 1}. ${q}`;
    });

    text += `\n\n======================================================================
DISCLAIMER: LEXGUARD provides general legal awareness and analytical tools to
increase user rights. LEXGUARD does not provide binding legal counsel or replacement
for professional legal advice. Use this document strictly for advocacy preparation.
======================================================================`;
    return text;
  };

  const handleCopyReport = () => {
    const text = getExportText();
    if (text) {
      navigator.clipboard.writeText(text);
      addLog("SYSTEM", "Advisory Counsel Report successfully copied to clipboard.");
      alert("Executive report copied to clipboard in rich plain-text format.");
    }
  };

  const handleDownloadReport = () => {
    const text = getExportText();
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lexguard_${docType}_report.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog("SYSTEM", "Advisory Counsel Report downloaded as .txt archive.");
  };

  // Helper colors mapping
  const getDangerColor = (rating) => {
    switch (rating) {
      case 'SAFE': return 'text-accent-safe border-accent-safe bg-accent-safe/10';
      case 'CAUTION': return 'text-accent-caution border-accent-caution bg-accent-caution/10';
      case 'RISKY': return 'text-accent-warning border-accent-warning bg-accent-warning/10';
      case 'DANGEROUS': return 'text-accent-danger border-accent-danger bg-accent-danger/10';
      default: return 'text-text-muted border-border-custom bg-bg-surface';
    }
  };

  const getRiskScoreBg = (score) => {
    if (score >= 8) return 'bg-accent-danger text-white';
    if (score >= 5) return 'bg-accent-warning text-white';
    if (score >= 3) return 'bg-accent-caution text-bg-base';
    return 'bg-accent-safe text-white';
  };

  const getBenchmarkBadgeColor = (classification) => {
    switch (classification) {
      case 'POTENTIALLY_UNENFORCEABLE': return 'bg-red-950 text-red-400 border border-red-800';
      case 'AGGRESSIVE': return 'bg-amber-950 text-amber-400 border border-amber-800';
      case 'UNUSUAL': return 'bg-yellow-950 text-yellow-500 border border-yellow-800';
      case 'STANDARD': return 'bg-emerald-950 text-emerald-400 border border-emerald-800';
      default: return 'bg-zinc-800 text-zinc-400';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-bg-base font-body text-text-primary overflow-x-hidden">
      
      {/* ============================================================================
          TOP BAR & GLOBAL DISCLAIMER (Section 6 & 16)
          ============================================================================ */}
      <header className="sticky top-0 z-40 flex flex-col md:flex-row items-center justify-between px-6 py-3 bg-bg-surface border-b border-border-custom shadow-md">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden p-1.5 hover:bg-bg-card border border-border-custom rounded-sm text-text-muted hover:text-accent-gold"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Scale className="w-6 h-6 text-accent-gold" />
            <h1 className="text-xl md:text-2xl font-display font-black text-text-primary tracking-wider select-none">
              LEX<span className="text-accent-gold">GUARD</span>
            </h1>
          </div>
          <span className="hidden md:inline-block h-4 w-px bg-border-custom"></span>
          <p className="text-[10px] md:text-xs font-mono text-accent-danger uppercase tracking-widest mt-1">
            ⚠ Rights Protection Intelligence Platform
          </p>
        </div>

        {/* Real-time Danger Rating Banner Indicator */}
        <div className="flex items-center gap-3 mt-2 md:mt-0 w-full md:w-auto justify-end">
          {dangerRating && (
            <div className={`flex items-center gap-2 px-3 py-1 text-xs font-mono font-bold tracking-wider uppercase border ${getDangerColor(dangerRating)} animate-pulse-gold`}>
              <Flame className="w-4 h-4" />
              <span>CONTRACT STATUS: {dangerRating}</span>
            </div>
          )}
          
          <button
            onClick={() => setShowApiSettings(!showApiSettings)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-bold tracking-wider uppercase border border-border-custom bg-bg-card hover:border-accent-gold hover:text-accent-gold ${isApiKeyConfigured ? 'border-emerald-500/40 text-emerald-400 hover:border-emerald-500' : ''}`}
          >
            <Settings className="w-4 h-4" />
            <span>{isApiKeyConfigured ? 'API KEY ACTIVE' : 'CONFIGURE API'}</span>
          </button>
        </div>
      </header>

      {/* Persistent Disclaimer Bar (Requirement 16) */}
      <div className="bg-amber-950/20 border-b border-amber-900/40 px-6 py-1.5 text-center text-[10px] md:text-xs font-mono text-accent-caution">
        ⚠️ LEGAL DISCLAIMER: LEXGUARD provides general legal awareness and rights audit intelligence. LEXGUARD is not a law firm and does not provide binding legal advice or professional legal counsel.
      </div>

      {/* Main Workspace Frame */}
      <div className="flex flex-1 relative overflow-hidden">
        
        {/* ============================================================================
            LEFT SIDEBAR — CATEGORIES, CONFIGS, HISTORY (Section 6 Layout)
            ============================================================================ */}
        <aside 
          className={`absolute md:relative inset-y-0 left-0 z-30 w-72 md:w-64 bg-bg-surface border-r border-border-custom flex flex-col transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:hidden'}`}
        >
          {/* Document Type Selector Wrapper */}
          <div className="p-4 border-b border-border-custom flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4">
            <div>
              <h2 className="text-xs font-mono text-text-muted uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-accent-gold" />
                Document Category
              </h2>
              <div className="flex flex-col gap-1">
                {DOCUMENT_CATEGORIES.map((category) => {
                  const Icon = category.icon;
                  const isSelected = docType === category.id;
                  return (
                    <button
                      key={category.id}
                      onClick={() => setDocType(category.id)}
                      className={`group w-full flex items-start gap-3 p-2.5 text-left border ${isSelected ? 'border-accent-gold bg-highlight text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary hover:bg-bg-card'} transition-all`}
                    >
                      <Icon className={`w-4 h-4 mt-0.5 ${isSelected ? 'text-accent-gold' : 'text-text-muted group-hover:text-text-primary'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono font-bold leading-tight truncate">{category.label}</p>
                        <p className="text-[10px] leading-snug mt-0.5 text-text-muted truncate group-hover:text-text-primary/70">{category.riskFocus}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Analysis History Segment */}
            <div className="mt-4 pt-4 border-t border-border-custom">
              <h2 className="text-xs font-mono text-text-muted uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-accent-gold" />
                Analysis History
              </h2>
              {history.length === 0 ? (
                <p className="text-[11px] font-mono text-text-muted/60 italic leading-relaxed">
                  No previous audits stored in this session's memory.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {history.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => loadHistoryItem(item)}
                      className="w-full text-left p-2 bg-bg-card border border-border-custom hover:border-accent-gold flex flex-col transition-all"
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="text-[11px] font-mono text-text-primary font-bold truncate max-w-[120px]">{item.name}</span>
                        <span className={`text-[9px] font-mono px-1 border uppercase ${getDangerColor(item.dangerRating)}`}>{item.dangerRating}</span>
                      </div>
                      <span className="text-[9px] font-mono text-text-muted mt-1">{item.date}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Logo Footer */}
          <div className="p-4 border-t border-border-custom bg-bg-base/40 text-center">
            <p className="text-[10px] font-mono text-text-muted">
              LEXGUARD v2.1.2 · PRO-USER ADVOCACY
            </p>
          </div>
        </aside>

        {/* API Settings Glassmorphic Dropdown Banner */}
        {showApiSettings && (
          <div className="absolute top-0 right-6 z-40 w-80 bg-bg-surface border border-accent-gold/40 shadow-2xl p-4 flex flex-col gap-3 animate-pulse-gold">
            <div className="flex justify-between items-center border-b border-border-custom pb-2">
              <h3 className="text-xs font-mono text-accent-gold uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Groq API Settings
              </h3>
              <button 
                onClick={() => setShowApiSettings(false)}
                className="text-text-muted hover:text-accent-danger font-mono text-xs font-bold"
              >
                [ESC]
              </button>
            </div>
            <p className="text-[10px] font-mono text-text-muted leading-relaxed">
              API calls are securely conducted straight to Groq's endpoints. Key is kept temporary in React state memory.
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-text-muted uppercase">Groq API Secret Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="gsk_..."
                className="w-full text-xs font-mono bg-bg-base text-text-primary border border-border-custom p-2 focus:border-accent-gold outline-none"
              />
            </div>
            <button
              onClick={() => setShowApiSettings(false)}
              className="w-full py-1.5 bg-accent-gold text-bg-base font-mono font-bold text-xs uppercase tracking-wider text-center hover:bg-accent-gold/90"
            >
              SAVE SETTINGS
            </button>
          </div>
        )}

        {/* ============================================================================
            CENTER MAIN — UPLOAD ZONE & PROGRESS THEATER (Section 6 & 7.2)
            ============================================================================ */}
        <main className="flex-1 flex flex-col overflow-y-auto custom-scrollbar p-6 bg-bg-base">
          
          {/* Main Workspace Grid: Upload Zone vs. Results Dashboard */}
          {clauses.length === 0 ? (
            // IDLE SCREEN: Document Input Zone
            <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto w-full py-6">
              
              <div className="text-center mb-8">
                <h2 className="text-4xl font-display font-bold text-text-primary tracking-tight mb-2">
                  Advocate for Yourself <span className="text-accent-gold">Before</span> You Sign.
                </h2>
                <p className="text-sm font-mono text-text-muted max-w-xl mx-auto leading-relaxed">
                  LEXGUARD uses an adversarial multi-agent pipeline to extract, score, cross-check, and simulate legal risks, delivering an actionable, protective audit of your contract.
                </p>
              </div>

              {/* Upload Frame */}
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full bg-bg-surface border-2 border-dashed flex flex-col items-center justify-center p-8 text-center transition-all ${isDragging ? 'border-accent-gold bg-highlight' : 'border-border-custom hover:border-accent-gold/50'}`}
              >
                <FileUp className="w-12 h-12 text-accent-gold/60 mb-3" />
                <h3 className="text-sm font-mono uppercase font-bold text-text-primary tracking-wider">
                  Drag & Drop Document File
                </h3>
                <p className="text-xs text-text-muted mt-1 mb-4">
                  Accepts PDF, DOCX, TXT, or Scanned Images (OCR)
                </p>
                
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.docx,.txt,.jpg,.jpeg,.png"
                  />
                  <button 
                    onClick={() => fileInputRef.current.click()}
                    className="px-4 py-2 border border-border-custom bg-bg-card font-mono text-xs font-bold hover:border-accent-gold tracking-wider hover:text-accent-gold uppercase"
                  >
                    Select File
                  </button>
                  <span className="text-xs font-mono text-text-muted">or</span>
                  <button 
                    onClick={handleLoadSample}
                    className="px-4 py-2 border border-accent-gold bg-highlight/30 text-accent-gold font-mono text-xs font-bold hover:bg-accent-gold hover:text-bg-base tracking-wider uppercase flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Load Sample Document
                  </button>
                </div>
              </div>

              {/* Textarea Paste Toggler */}
              <div className="w-full mt-6 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-mono text-text-muted uppercase tracking-widest">
                    Paste Plain Contract Text
                  </label>
                  {inputText && (
                    <button 
                      onClick={() => setInputText('')}
                      className="text-[10px] font-mono text-accent-danger uppercase hover:underline"
                    >
                      Clear Text
                    </button>
                  )}
                </div>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste the full text of your legal agreement, offer letter, or privacy policy terms here..."
                  className="w-full h-64 bg-bg-surface border border-border-custom p-4 text-sm leading-relaxed text-text-primary focus:border-accent-gold outline-none resize-none font-body"
                />
              </div>

              {/* Error messages box */}
              {errorMessage && (
                <div className="w-full mt-4 p-3 bg-red-950/20 border border-accent-danger/30 text-xs font-mono text-accent-danger flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Big Action CTA Buttons */}
              <div className="w-full mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={startAnalysis}
                  disabled={agentStatus.extractor === 'running'}
                  className="flex-1 py-3 bg-accent-gold hover:bg-accent-gold/90 text-bg-base font-display font-black tracking-wider text-sm uppercase flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                >
                  <Play className="w-4 h-4 fill-current" />
                  ANALYZE CONTRACT (LIVE CLAUDE RUN)
                </button>
                <button
                  onClick={runSimulation}
                  disabled={agentStatus.extractor === 'running'}
                  className="px-6 py-3 border border-accent-caution bg-highlight text-accent-caution hover:bg-accent-gold hover:text-bg-base font-mono font-bold tracking-wider text-xs uppercase flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  Simulate Run (Free)
                </button>
              </div>

            </div>
          ) : (
            // ACTIVE RESULTS PANEL: Displays full dashboards
            <div className="flex-1 flex flex-col gap-6">
              
              {/* Executive Summary Top Callout (Section 7.3 Banner) */}
              {counsel && (
                <div className={`p-4 border flex flex-col md:flex-row items-center justify-between gap-4 ${getDangerColor(dangerRating)}`}>
                  <div className="flex items-center gap-3">
                    <AlertOctagon className="w-8 h-8 shrink-0 text-current" />
                    <div>
                      <h2 className="text-base font-display font-black tracking-tight uppercase leading-tight">
                        {dangerRating} ASSESSMENT — {clauses.filter(c => c.risk_score >= 7).length} HIGH-RISK CLAUSES SPOTTED
                      </h2>
                      <p className="text-xs font-mono text-text-primary/90 mt-0.5 leading-snug">
                        {counsel.danger_summary}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase bg-bg-base/40 border border-current px-2 py-0.5">
                      Power Balance: {counsel.overall_power_balance.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] font-mono uppercase bg-bg-base/40 border border-current px-2 py-0.5">
                      Action: {counsel.recommended_action.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              )}

              {/* Progress Panel Frame / Agent Progress Theater (Section 7.2) */}
              <div className="bg-bg-surface border border-border-custom p-4">
                <div className="flex justify-between items-center border-b border-border-custom pb-2 mb-3">
                  <h3 className="text-xs font-mono text-accent-gold uppercase font-bold tracking-widest flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-accent-gold animate-pulse" />
                    Multi-Agent Pipeline Theater
                  </h3>
                  <div className="flex gap-4 text-[10px] font-mono text-text-muted">
                    <span>CLAUSES: <strong className="text-text-primary font-bold">{clauses.length}</strong></span>
                    <span>CONTRADICTIONS: <strong className="text-text-primary font-bold">{contradictions.length}</strong></span>
                    <span>RISK RATING: <strong className="text-text-primary font-bold">{dangerRating || 'PENDING'}</strong></span>
                  </div>
                </div>

                {/* Status rows */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 font-mono text-xs">
                  {/* Extractor Status */}
                  <div className={`p-2 border ${agentStatus.extractor === 'done' ? 'border-emerald-500/20 bg-emerald-950/5' : agentStatus.extractor === 'running' ? 'border-accent-gold/30 bg-accent-gold/5' : 'border-border-custom/50'} flex flex-col justify-between`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">1. EXTRACTOR</span>
                      <span className={agentStatus.extractor === 'done' ? 'text-accent-safe font-bold' : agentStatus.extractor === 'running' ? 'text-accent-gold animate-pulse' : 'text-text-muted'}>
                        {agentStatus.extractor === 'done' ? '✓ DONE' : agentStatus.extractor === 'running' ? '⟳ ACTIVE' : '○ IDLE'}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-muted mt-1 leading-tight">Identifying & categorizing clauses</p>
                  </div>

                  {/* Analyst Status */}
                  <div className={`p-2 border ${agentStatus.analyst === 'done' ? 'border-emerald-500/20 bg-emerald-950/5' : agentStatus.analyst === 'running' ? 'border-accent-gold/30 bg-accent-gold/5' : 'border-border-custom/50'} flex flex-col justify-between`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">2. RISK ANALYST</span>
                      <span className={agentStatus.analyst === 'done' ? 'text-accent-safe font-bold' : agentStatus.analyst === 'running' ? 'text-accent-gold animate-pulse' : 'text-text-muted'}>
                        {agentStatus.analyst === 'done' ? '✓ DONE' : agentStatus.analyst === 'running' ? '⟳ ACTIVE' : '○ PENDING'}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-muted mt-1 leading-tight">Adversarial liability assessment</p>
                  </div>

                  {/* Contradiction Status */}
                  <div className={`p-2 border ${agentStatus.contradiction === 'done' ? 'border-emerald-500/20 bg-emerald-950/5' : agentStatus.contradiction === 'running' ? 'border-accent-gold/30 bg-accent-gold/5' : 'border-border-custom/50'} flex flex-col justify-between`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">3. AUDITOR</span>
                      <span className={agentStatus.contradiction === 'done' ? 'text-accent-safe font-bold' : agentStatus.contradiction === 'running' ? 'text-accent-gold animate-pulse' : 'text-text-muted'}>
                        {agentStatus.contradiction === 'done' ? '✓ DONE' : agentStatus.contradiction === 'running' ? '⟳ ACTIVE' : '○ PENDING'}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-muted mt-1 leading-tight">Benchmarking & inconsistency scan</p>
                  </div>

                  {/* Scenario Status */}
                  <div className={`p-2 border ${agentStatus.scenario === 'done' ? 'border-emerald-500/20 bg-emerald-950/5' : agentStatus.scenario === 'running' ? 'border-accent-gold/30 bg-accent-gold/5' : 'border-border-custom/50'} flex flex-col justify-between`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">4. SCENARIO</span>
                      <span className={agentStatus.scenario === 'done' ? 'text-accent-safe font-bold' : agentStatus.scenario === 'running' ? 'text-accent-gold animate-pulse' : 'text-text-muted'}>
                        {agentStatus.scenario === 'done' ? '✓ DONE' : agentStatus.scenario === 'running' ? '⟳ ACTIVE' : '○ PENDING'}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-muted mt-1 leading-tight">Simulating real-world hazards</p>
                  </div>

                  {/* Counsel Status */}
                  <div className={`p-2 border ${agentStatus.counsel === 'done' ? 'border-emerald-500/20 bg-emerald-950/5' : agentStatus.counsel === 'running' ? 'border-accent-gold/30 bg-accent-gold/5' : 'border-border-custom/50'} flex flex-col justify-between`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">5. ADVISOR</span>
                      <span className={agentStatus.counsel === 'done' ? 'text-accent-safe font-bold' : agentStatus.counsel === 'running' ? 'text-accent-gold animate-pulse' : 'text-text-muted'}>
                        {agentStatus.counsel === 'done' ? '✓ DONE' : agentStatus.counsel === 'running' ? '⟳ ACTIVE' : '○ PENDING'}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-muted mt-1 leading-tight">Negotiation synthesis & counseling</p>
                  </div>
                </div>

                {/* Sub-Logs Drawer (Realtime actions logs) */}
                {activeStepText && (
                  <div className="mt-3 p-2 bg-bg-base border border-border-custom rounded-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent-gold animate-ping"></span>
                    <p className="text-[11px] font-mono text-accent-gold truncate">
                      [LOG]: {activeStepText}
                    </p>
                  </div>
                )}
              </div>

              {/* ============================================================================
                  DASHBOARD SPLIT-GRID FRAME: Left Text vs Right Audits
                  ============================================================================ */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left Contract Viewer Pane (4 Cols) */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                  <div className="bg-bg-surface border border-border-custom p-4 flex flex-col h-[600px] overflow-hidden">
                    <h3 className="text-xs font-mono text-text-muted uppercase tracking-wider mb-2 flex items-center justify-between border-b border-border-custom pb-2">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-accent-gold" />
                        Original Contract Text
                      </span>
                      <button 
                        onClick={handleReset}
                        className="text-[10px] font-mono text-accent-danger hover:underline uppercase"
                      >
                        Upload Another
                      </button>
                    </h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar text-xs font-body leading-relaxed text-text-primary/80 pr-1 select-text space-y-4 whitespace-pre-wrap">
                      {inputText}
                    </div>
                  </div>
                </div>

                {/* Right Analysis Dashboard Panel (7 Cols) */}
                <div className="lg:col-span-7 flex flex-col gap-4">
                  
                  {/* Results Tabs Toggles */}
                  <div className="flex border-b border-border-custom bg-bg-surface p-1">
                    <button
                      onClick={() => setActiveView('clauses')}
                      className={`flex-1 py-2 font-mono text-xs font-bold tracking-wider uppercase text-center border-b-2 ${activeView === 'clauses' ? 'border-accent-gold text-accent-gold bg-highlight/30' : 'border-transparent text-text-muted hover:text-text-primary'}`}
                    >
                      Clause Intelligence ({processedClauses.length})
                    </button>
                    <button
                      onClick={() => setActiveView('contradictions')}
                      className={`flex-1 py-2 font-mono text-xs font-bold tracking-wider uppercase text-center border-b-2 ${activeView === 'contradictions' ? 'border-accent-gold text-accent-gold bg-highlight/30' : 'border-transparent text-text-muted hover:text-text-primary'}`}
                    >
                      Contradictions ({contradictions.length})
                    </button>
                    <button
                      onClick={() => setActiveView('summary')}
                      className={`flex-1 py-2 font-mono text-xs font-bold tracking-wider uppercase text-center border-b-2 ${activeView === 'summary' ? 'border-accent-gold text-accent-gold bg-highlight/30' : 'border-transparent text-text-muted hover:text-text-primary'}`}
                    >
                      Advisory Report
                    </button>
                  </div>

                  {/* ============================================================================
                      SUB-VIEW 1: CLAUSE INTELLIGENCE CARDS (Section 7.4 & 7.7)
                      ============================================================================ */}
                  {activeView === 'clauses' && (
                    <div className="flex flex-col gap-4">
                      
                      {/* Interactive Sorting, Filtering & Searching Bar */}
                      <div className="bg-bg-surface border border-border-custom p-3 flex flex-col md:flex-row gap-3 items-center justify-between">
                        
                        {/* Search Input */}
                        <div className="relative w-full md:w-48">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search clauses..."
                            className="w-full pl-8 pr-3 py-1.5 bg-bg-base border border-border-custom text-xs font-mono placeholder:text-text-muted/50 focus:border-accent-gold outline-none"
                          />
                        </div>

                        {/* Filter Select */}
                        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                          <span className="text-[10px] font-mono text-text-muted uppercase">Filter:</span>
                          <select
                            value={activeFilter}
                            onChange={(e) => setActiveFilter(e.target.value)}
                            className="bg-bg-base border border-border-custom text-[11px] font-mono py-1.5 px-2 text-text-primary focus:border-accent-gold outline-none"
                          >
                            <option value="all">All Clauses</option>
                            <option value="high_risk">High Risk (7+)</option>
                            <option value="aggressive">Aggressive</option>
                            <option value="ambiguous">Ambiguous</option>
                            <option value="privacy">Data / Privacy</option>
                            <option value="financial">Financial / Payments</option>
                            <option value="ip">IP / Ownership</option>
                            <option value="contradictions">Contradicted Clauses</option>
                          </select>

                          {/* Sort Select */}
                          <span className="text-[10px] font-mono text-text-muted uppercase ml-2">Sort:</span>
                          <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="bg-bg-base border border-border-custom text-[11px] font-mono py-1.5 px-2 text-text-primary focus:border-accent-gold outline-none"
                          >
                            <option value="risk_score">Risk Score ↓</option>
                            <option value="type">Clause Type</option>
                            <option value="doc_order">Contract Order</option>
                            <option value="benchmark">Benchmark Rank</option>
                          </select>
                        </div>

                      </div>

                      {/* Clauses grid list */}
                      {processedClauses.length === 0 ? (
                        <div className="bg-bg-surface border border-border-custom p-8 text-center text-xs font-mono text-text-muted">
                          No clauses matched your active filters or searches.
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          {processedClauses.map((clause) => {
                            const isExpanded = expandedClause === clause.id;
                            const currentScenarios = scenarios.find(s => s.clause_id === clause.id)?.scenarios || [];
                            
                            return (
                              <div 
                                key={clause.id}
                                className="bg-bg-card border border-border-custom relative hover:border-accent-gold/40 hover:shadow-lg transition-all"
                              >
                                {/* Segmented Risk Top Bar Indicator */}
                                <div className={`h-1 w-full ${clause.risk_score >= 8 ? 'bg-accent-danger' : clause.risk_score >= 5 ? 'bg-accent-warning' : 'bg-accent-safe'}`}></div>
                                
                                <div className="p-4 flex flex-col gap-3">
                                  {/* Header Info Line */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-custom/50 pb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-mono font-black text-text-primary uppercase bg-bg-base px-2 py-0.5 border border-border-custom">
                                        {clause.type}
                                      </span>
                                      <span className="text-xs font-mono text-text-muted uppercase">
                                        {clause.id.toUpperCase()} · {clause.location_hint || 'Contract Section'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[10px] font-mono px-2 py-0.5 border uppercase ${clause.benefits_party === 'DRAFTER' ? 'text-accent-danger border-accent-danger/20 bg-accent-danger/5' : 'text-accent-safe border-accent-safe/20 bg-accent-safe/5'}`}>
                                        Benefits: {clause.benefits_party}
                                      </span>
                                      <span className={`text-[10px] font-mono px-2 py-0.5 uppercase ${getBenchmarkBadgeColor(clause.classification)}`}>
                                        {clause.classification?.replace(/_/g, ' ')}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Plain English Translation Prominent block */}
                                  <div>
                                    <h4 className="text-[10px] font-mono text-accent-gold uppercase tracking-widest leading-none mb-1">
                                      Plain English Implication
                                    </h4>
                                    <p className="text-sm font-body font-medium leading-relaxed text-text-primary">
                                      {clause.plain_english_meaning || "No plain translation available."}
                                    </p>
                                  </div>

                                  {/* Score Gauges Block */}
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-bg-base/40 p-2.5 border border-border-custom/40">
                                    {/* Overall Score */}
                                    <div className="flex flex-col">
                                      <span className="text-[9px] font-mono text-text-muted uppercase leading-none mb-1">Risk Rating</span>
                                      <div className="flex items-center gap-2">
                                        <span className={`text-xs font-mono font-bold px-1.5 py-0.2 rounded-sm ${getRiskScoreBg(clause.risk_score)}`}>
                                          {clause.risk_score}/10
                                        </span>
                                        <div className="flex-1 h-1.5 bg-bg-surface overflow-hidden">
                                          <div className={`h-full ${clause.risk_score >= 8 ? 'bg-accent-danger' : clause.risk_score >= 5 ? 'bg-accent-warning' : 'bg-accent-safe'}`} style={{ width: `${clause.risk_score * 10}%` }}></div>
                                        </div>
                                      </div>
                                    </div>
                                    {/* Exploitation Score */}
                                    {clause.exploitation_score !== undefined && (
                                      <div className="flex flex-col">
                                        <span className="text-[9px] font-mono text-text-muted uppercase leading-none mb-1">Drafter Favor</span>
                                        <span className="text-xs font-mono text-text-primary font-bold">{clause.exploitation_score}/10</span>
                                      </div>
                                    )}
                                    {/* Ambiguity Score */}
                                    {clause.ambiguity_score !== undefined && (
                                      <div className="flex flex-col">
                                        <span className="text-[9px] font-mono text-text-muted uppercase leading-none mb-1 font-bold">Ambiguity</span>
                                        <span className="text-xs font-mono text-text-primary font-bold">{clause.ambiguity_score}/10</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Red Flags Tagger Bulleted List */}
                                  {clause.red_flags && clause.red_flags.length > 0 && (
                                    <div>
                                      <h5 className="text-[10px] font-mono text-accent-danger uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        Flagged Liabilities
                                      </h5>
                                      <ul className="text-xs font-mono text-text-muted space-y-1 pl-1">
                                        {clause.red_flags.map((flag, fi) => (
                                          <li key={fi} className="flex items-start gap-1.5 leading-snug">
                                            <span className="text-accent-danger mt-0.5">⚠️</span>
                                            <span>{flag}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Toggle accordions for Original Text / Scenarios / Negotiations */}
                                  <div className="flex flex-wrap items-center gap-2 border-t border-border-custom/40 pt-2">
                                    <button
                                      onClick={() => setExpandedClause(isExpanded ? null : clause.id)}
                                      className="flex items-center gap-1 text-[10px] font-mono uppercase text-accent-gold hover:underline"
                                    >
                                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                      <span>{isExpanded ? 'Hide Details' : 'Auditor Notes & Raw Clause'}</span>
                                    </button>
                                  </div>

                                  {/* EXPANDED ACCORDION CONTENT */}
                                  {isExpanded && (
                                    <div className="mt-2 border-t border-border-custom/30 pt-3 flex flex-col gap-4 animate-fade-in">
                                      
                                      {/* Original Legal Language Box */}
                                      <div>
                                        <h5 className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-1">
                                          Original Text (Raw Legalese)
                                        </h5>
                                        <pre className="text-[11px] font-mono leading-relaxed text-text-primary/70 bg-bg-base p-3 border border-border-custom/50 max-h-32 overflow-y-auto whitespace-pre-wrap select-all">
                                          {clause.original_text}
                                        </pre>
                                      </div>

                                      {/* Benchmark Industry standards citations */}
                                      {clause.industry_note && (
                                        <div className="bg-bg-base/30 p-2.5 border-l-2 border-accent-gold text-xs leading-relaxed text-text-muted">
                                          <strong className="text-accent-gold font-mono uppercase text-[9px] block mb-0.5">Industry Standard Comparison</strong>
                                          {clause.industry_note}
                                        </div>
                                      )}

                                      {/* Real-world Simulated Consequence accordion (Agent 4) */}
                                      {currentScenarios && currentScenarios.length > 0 && (
                                        <div>
                                          <h5 className="text-[10px] font-mono text-accent-warning uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                            <Activity className="w-3.5 h-3.5" />
                                            Real-world Liability Simulations
                                          </h5>
                                          <div className="flex flex-col gap-2 font-mono">
                                            {currentScenarios.map((sc, sci) => (
                                              <div key={sci} className="text-xs p-2.5 bg-amber-950/5 border border-amber-900/20 text-text-primary/95 leading-relaxed">
                                                <strong className="text-accent-warning text-[9px] block uppercase mb-1">Case Scenario {sci + 1}</strong>
                                                {sc}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Exact verbatim replacement clauses box (Agent 5) */}
                                      {clause.negotiation_language && (
                                        <div className="bg-bg-base border border-accent-gold/20 p-3 relative">
                                          <div className="flex justify-between items-center mb-1">
                                            <h5 className="text-[10px] font-mono text-accent-gold uppercase tracking-widest font-bold">
                                              Counter-Proposal Language
                                            </h5>
                                            <button
                                              onClick={() => {
                                                navigator.clipboard.writeText(clause.negotiation_language);
                                                alert("Replacement language copied to clipboard.");
                                              }}
                                              className="text-[9px] font-mono text-accent-gold hover:underline flex items-center gap-1"
                                            >
                                              <Copy className="w-3 h-3" />
                                              Copy Language
                                            </button>
                                          </div>
                                          <p className="text-xs font-mono leading-relaxed text-text-primary italic p-2 bg-highlight/30 border border-border-custom select-all">
                                            "{clause.negotiation_language}"
                                          </p>
                                        </div>
                                      )}

                                    </div>
                                  )}

                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                    </div>
                  )}

                  {/* ============================================================================
                      SUB-VIEW 2: CONTRADICTIONS PANEL (Section 7.5)
                      ============================================================================ */}
                  {activeView === 'contradictions' && (
                    <div className="flex flex-col gap-4">
                      <div className="bg-bg-surface border border-border-custom p-4">
                        <h3 className="text-sm font-mono text-accent-gold uppercase font-bold tracking-wider mb-2 flex items-center gap-2">
                          <Scale className="w-4 h-4 text-accent-gold animate-pulse" />
                          Intra-Document Consistency Audit
                        </h3>
                        <p className="text-xs leading-relaxed text-text-muted">
                          Adversarial checks comparing terms against each other. Circular or conflicting clauses are frequently exploited to favor the drafter.
                        </p>
                      </div>

                      {contradictions.length === 0 ? (
                        <div className="bg-bg-surface border border-border-custom p-8 text-center text-xs font-mono text-accent-safe flex flex-col items-center gap-2">
                          <CheckCircle2 className="w-8 h-8" />
                          <span>No internal contradictions or circular obligations detected. Document exhibits standard visual structural integrity.</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          {contradictions.map((con, ci) => (
                            <div key={ci} className="bg-bg-card border border-accent-danger/30 p-4 flex flex-col gap-3">
                              <div className="flex items-center justify-between border-b border-border-custom/50 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-red-950 text-accent-danger border border-accent-danger/30 text-[10px] font-mono font-bold tracking-wider uppercase">
                                    SEVERITY: {con.severity}
                                  </span>
                                  <span className="text-xs font-mono text-text-muted">
                                    CONFLICT: {con.clause_ids.join(' ↔ ').toUpperCase()}
                                  </span>
                                </div>
                                <span className="text-accent-danger font-mono text-xs">⚠️ CRITICAL CONFLICT</span>
                              </div>
                              <p className="text-sm font-body leading-relaxed text-text-primary/95">
                                {con.description}
                              </p>
                              <div className="bg-bg-base/40 p-2.5 border border-border-custom text-xs font-mono leading-relaxed text-text-muted">
                                <strong className="text-accent-gold text-[9px] block uppercase mb-0.5">Auditor Safe Guideline</strong>
                                You must request a single consolidated definition. Counterparties often use Section 3 to override specific Section 4 allowances in court.
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  )}

                  {/* ============================================================================
                      SUB-VIEW 3: EXECUTIVE SUMMARY REPORT (Section 7.6)
                      ============================================================================ */}
                  {activeView === 'summary' && counsel && (
                    <div className="flex flex-col gap-4 animate-fade-in">
                      
                      {/* Big action panel */}
                      <div className="bg-bg-surface border border-border-custom p-4 flex justify-between items-center gap-3">
                        <div>
                          <h3 className="text-sm font-mono text-accent-gold uppercase font-bold tracking-wider">
                            Executive Advisory Dossier
                          </h3>
                          <span className="text-[10px] font-mono text-text-muted">
                            Adversarial evaluation finalized · Exportable text report below
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleCopyReport}
                            className="px-3 py-1.5 border border-border-custom bg-bg-card text-xs font-mono font-bold hover:border-accent-gold hover:text-accent-gold flex items-center gap-1.5 uppercase"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                          </button>
                          <button
                            onClick={handleDownloadReport}
                            className="px-3 py-1.5 border border-accent-gold bg-highlight text-accent-gold text-xs font-mono font-bold hover:bg-accent-gold hover:text-bg-base flex items-center gap-1.5 uppercase"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download TXT
                          </button>
                        </div>
                      </div>

                      {/* What you are agreeing to (2-3 paragraphs) */}
                      <div className="bg-bg-card border border-border-custom p-5 flex flex-col gap-3">
                        <h4 className="text-xs font-mono text-accent-gold uppercase tracking-widest font-bold border-b border-border-custom pb-2">
                          What You Are Actually Agreeing To (Plain Language Audit)
                        </h4>
                        <div className="text-sm font-body text-text-primary/90 leading-relaxed space-y-4">
                          {counsel.executive_summary.split('\n\n').map((paragraph, pi) => (
                            <p key={pi}>{paragraph}</p>
                          ))}
                        </div>
                      </div>

                      {/* Strategic Concerns Rankings (Top 5 Ranked) */}
                      <div className="bg-bg-card border border-border-custom p-5 flex flex-col gap-4">
                        <h4 className="text-xs font-mono text-accent-gold uppercase tracking-widest font-bold border-b border-border-custom pb-2">
                          Top Negotiable Concerns (Priority Audit)
                        </h4>
                        <div className="flex flex-col gap-5">
                          {counsel.top_concerns && counsel.top_concerns.map((concern, ci) => (
                            <div key={ci} className="flex gap-4 items-start border-b border-border-custom/30 pb-4 last:border-b-0 last:pb-0">
                              <span className="w-6 h-6 shrink-0 bg-bg-base border border-accent-gold text-accent-gold text-xs font-mono flex items-center justify-center font-bold">
                                {concern.rank || ci + 1}
                              </span>
                              <div className="flex-1 flex flex-col gap-2">
                                <div className="flex justify-between items-start">
                                  <span className="text-xs font-mono text-accent-gold uppercase tracking-wider">
                                    Ref: Clause {concern.clause_id.toUpperCase()}
                                  </span>
                                  {concern.walk_away_threshold && (
                                    <span className="px-2 py-0.2 bg-red-950 text-accent-danger border border-accent-danger/20 text-[9px] font-mono font-bold tracking-wider uppercase">
                                      WALK-AWAY ISSUE
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm leading-relaxed text-text-primary">
                                  {concern.concern}
                                </p>
                                <div className="bg-bg-base/70 p-2.5 border border-border-custom font-mono text-xs leading-relaxed italic text-text-primary/90">
                                  <strong className="text-accent-gold text-[9px] block uppercase mb-1 font-bold not-italic">Verbatim Counter-Proposal Language</strong>
                                  "{concern.negotiation_language}"
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Compliance & Regulatory Flags */}
                      {counsel.privacy_compliance_flags && counsel.privacy_compliance_flags.length > 0 && (
                        <div className="bg-bg-card border border-border-custom p-5 flex flex-col gap-3">
                          <h4 className="text-xs font-mono text-accent-gold uppercase tracking-widest font-bold border-b border-border-custom pb-2 flex items-center gap-1.5">
                            <Shield className="w-4 h-4 text-accent-gold" />
                            Regulatory & Compliance Exposure
                          </h4>
                          <ul className="text-xs font-mono text-text-muted space-y-2">
                            {counsel.privacy_compliance_flags.map((flag, fi) => (
                              <li key={fi} className="flex items-start gap-2">
                                <span className="text-accent-gold">▪</span>
                                <span className="leading-relaxed">{flag}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Questions to Ask */}
                      {counsel.questions_to_ask && counsel.questions_to_ask.length > 0 && (
                        <div className="bg-bg-card border border-border-custom p-5 flex flex-col gap-3">
                          <h4 className="text-xs font-mono text-accent-gold uppercase tracking-widest font-bold border-b border-border-custom pb-2 flex items-center gap-1.5">
                            <HelpCircle className="w-4 h-4 text-accent-gold" />
                            Negotiation Questions (Copy-Paste Scripts)
                          </h4>
                          <div className="flex flex-col gap-2">
                            {counsel.questions_to_ask.map((q, qi) => (
                              <div key={qi} className="text-xs font-mono bg-bg-base border border-border-custom p-2.5 relative flex items-start gap-3">
                                <span className="text-accent-gold leading-none font-bold">Q{qi + 1}:</span>
                                <p className="text-text-primary/90 flex-1 leading-relaxed select-all">
                                  {q}
                                </p>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(q);
                                    alert("Question copied.");
                                  }}
                                  className="text-text-muted hover:text-accent-gold self-center"
                                  title="Copy Question"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}

                </div>

              </div>

            </div>
          )}

        </main>

      </div>

    </div>
  );
}
