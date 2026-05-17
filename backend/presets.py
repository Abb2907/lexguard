# High-Fidelity presets for LEXGUARD Simulation Mode and Demo Contract

NEXUS_OFFER_LETTER = """NEXUS DYNAMICS GROUP — STRICTLY CONFIDENTIAL
EMPLOYMENT AGREEMENT & OFFER OF EMPLOYMENT

Date: October 14, 2026
To: Alex Mercer
Position: Lead Software Architect

Dear Alex,

We are thrilled to offer you the position of Lead Software Architect at Nexus Dynamics Group (the "Company"). This letter outlines the comprehensive terms of your employment.

1. SCOPE OF SERVICES & AT-WILL TERMINATION
Your employment with the Company is strictly 'at-will.' This means that either you or the Company can terminate this employment relationship at any time, for any reason or no reason, immediately upon verbal or written notice. Upon termination, you shall immediately forfeit all rights to unvested options and transition all company files. You shall receive no severance pay except as strictly mandated by minimal state guidelines. Additionally, you agree not to make any disparaging remarks about the Company, its clients, or executives post-termination under any circumstances.

2. INTELLECTUAL PROPERTY OWNERSHIP
The Employee hereby assigns and transfers to the Company all right, title, and interest in and to all intellectual property, inventions, concepts, improvements, designs, software codes, patents, and copyrights, whether or not registrable, conceived, created, or reduced to practice by the Employee during the entire term of their employment with the Company. This transfer applies globally, at all times of the day, and regardless of whether such inventions were created on Company-owned devices or personal equipment, and whether or not they directly relate to the current or anticipated business of the Company. (Note: Employees retain rights to works created entirely on personal time and personal equipment, provided they are completely unrelated to Company activities).

3. MANDATORY BINDING ARBITRATION & CLASS ACTION WAIVER
In the event of any dispute, claim, or controversy arising out of or relating to your employment, this Agreement, or its breach, both you and the Company agree to resolve such dispute exclusively through binding individual arbitration administered by JAMS. You hereby explicitly waive your right to a trial by jury or to participate in any class, collective, or representative action in court or arbitration. The venue for arbitration shall be exclusively in Wilmington, Delaware, and both parties shall bear their own legal costs and half of the arbitration fees, regardless of the final ruling.

4. COVENANT NOT TO COMPETE (NON-COMPETE)
To protect the Company's proprietary information, the Employee agrees that during their employment and for a period of twenty-four (24) months following the termination of employment for any reason, they will not, directly or indirectly, engage in, perform services for, consult with, or be employed by any business entity globally that operates in the software engineering, cloud architecture, legal technology, or general artificial intelligence fields, or any field that competes with the current or anticipated business operations of Nexus Dynamics Group.

5. UNILATERAL AMENDMENT RIGHTS
The Company reserves the absolute right to amend, modify, delete, or add to any of the terms, policies, benefits, or covenants outlined in this Agreement or in the Employee Handbook at any time, with or without prior notice or the Employee's explicit consent. Continued employment post-modification constitutes binding acceptance.

Please sign and return this offer to indicate your agreement to these terms.

Sincerely,
Marcus Vance, Chief Executive Officer
Nexus Dynamics Group
"""

# Pre-compiled high-fidelity 5-agent pipeline result for the Nexus Dynamics Offer Letter
SIMULATION_ANALYSIS_RESULT = {
  "clauses": [
    {
      "id": "c1",
      "type": "TERMINATION",
      "original_text": "Your employment with the Company is strictly 'at-will.' This means that either you or the Company can terminate this employment relationship at any time, for any reason or no reason, immediately upon verbal or written notice. Upon termination, you shall immediately forfeit all rights to unvested options and transition all company files. You shall receive no severance pay except as strictly mandated by minimal state guidelines.",
      "benefits_party": "DRAFTER",
      "location_hint": "Section 1",
      "risk_score": 8,
      "exploitation_score": 9,
      "ambiguity_score": 3,
      "risk_type": "TERMINATION",
      "enforceability_concern": False,
      "enforceability_note": "",
      "hidden_liabilities": [
        "Immediate loss of income with zero transition buffer",
        "Total forfeiture of unvested equity options regardless of tenure"
      ],
      "red_flags": [
        "No notice period for the employer (immediate termination)",
        "Severe equity forfeiture penalty upon exit",
        "No contractual severance safety net"
      ],
      "plain_english_meaning": "The company can fire you at any second for no reason, give you $0 severance, and take away all your unvested stock options instantly."
    },
    {
      "id": "c2",
      "type": "OTHER",
      "original_text": "Additionally, you agree not to make any disparaging remarks about the Company, its clients, or executives post-termination under any circumstances.",
      "benefits_party": "DRAFTER",
      "location_hint": "Section 1",
      "risk_score": 7,
      "exploitation_score": 8,
      "ambiguity_score": 5,
      "risk_type": "NON_DISPARAGEMENT",
      "enforceability_concern": True,
      "enforceability_note": "Broad, perpetual post-employment non-disparagement covenants without reciprocal protection are increasingly restricted by regulatory bodies (e.g., NLRB).",
      "hidden_liabilities": [
        "Inability to publicly discuss negative experiences or report workplace misconduct",
        "Risk of defamation/disparagement lawsuits if sharing casual feedback"
      ],
      "red_flags": [
        "One-sided obligation (company can disparage you, but you can't disparage them)",
        "No expiration date (perpetual restriction)",
        "Applies 'under any circumstances'"
      ],
      "plain_english_meaning": "You can never say anything negative about the company, its clients, or managers, even if it's completely true, forever."
    },
    {
      "id": "c3",
      "type": "IP_OWNERSHIP",
      "original_text": "The Employee hereby assigns and transfers to the Company all right, title, and interest in and to all intellectual property, inventions, concepts, improvements, designs, software codes, patents, and copyrights... during the entire term of their employment... regardless of whether such inventions were created on Company-owned devices or personal equipment, and whether or not they directly relate to the current or anticipated business of the Company.",
      "benefits_party": "DRAFTER",
      "location_hint": "Section 2",
      "risk_score": 9,
      "exploitation_score": 9,
      "ambiguity_score": 6,
      "risk_type": "IP_OWNERSHIP",
      "enforceability_concern": True,
      "enforceability_note": "Many states (e.g., California Labor Code 2870) outlaw employer claims on inventions created on personal time with personal resources.",
      "hidden_liabilities": [
        "Loss of ownership over weekend side-projects and personal applications",
        "Risk of legal dispute if launching any product post-employment"
      ],
      "red_flags": [
        "Applies 24/7, even outside standard working hours",
        "Covers personal equipment and unrelated technologies",
        "Extremely broad definition of 'anticipated business'"
      ],
      "plain_english_meaning": "The company owns every single line of code, patent, or idea you generate, even if you make it in your bed at 3 AM on Sunday on your own laptop."
    },
    {
      "id": "c4",
      "type": "IP_OWNERSHIP",
      "original_text": "(Note: Employees retain rights to works created entirely on personal time and personal equipment, provided they are completely unrelated to Company activities).",
      "benefits_party": "SIGNER",
      "location_hint": "Section 2",
      "risk_score": 3,
      "exploitation_score": 2,
      "ambiguity_score": 8,
      "risk_type": "IP_OWNERSHIP",
      "enforceability_concern": False,
      "enforceability_note": "",
      "hidden_liabilities": [
        "Proving a project is 'completely unrelated' to a broad tech company is legally difficult"
      ],
      "red_flags": [
        "Directly contradicts the main broad assignment text in Section 2",
        "Creates extreme ambiguity as to which clause takes priority"
      ],
      "plain_english_meaning": "A small footnote notes you keep personal works, but it directly clashes with the previous paragraph that says they own everything."
    },
    {
      "id": "c5",
      "type": "ARBITRATION",
      "original_text": "In the event of any dispute, claim, or controversy arising out of or relating to your employment... both you and the Company agree to resolve such dispute exclusively through binding individual arbitration administered by JAMS. You hereby explicitly waive your right to a trial by jury or to participate in any class, collective, or representative action in court or arbitration. The venue for arbitration shall be exclusively in Wilmington, Delaware, and both parties shall bear their own legal costs and half of the arbitration fees, regardless of the final ruling.",
      "benefits_party": "DRAFTER",
      "location_hint": "Section 3",
      "risk_score": 8,
      "exploitation_score": 9,
      "ambiguity_score": 4,
      "risk_type": "ARBITRATION",
      "enforceability_concern": True,
      "enforceability_note": "Splitting JAMS fees and selecting Delaware as an exclusive venue for out-of-state workers may be struck down as substantively unconscionable.",
      "hidden_liabilities": [
        "Signer must pay thousands of dollars in JAMS filing fees just to file a claim",
        "Signer must travel to Wilmington, Delaware to arbitrate any workplace issues"
      ],
      "red_flags": [
        "Forced arbitration strips standard constitutional court rights",
        "Class action waiver prevents pooling resources with other employees",
        "One-sided venue and fee split (extremely expensive for individuals)"
      ],
      "plain_english_meaning": "You can't sue the company in court. Instead, you must pay thousands to arbitrate in Delaware individually, covering half the cost even if you win."
    },
    {
      "id": "c6",
      "type": "NON_COMPETE",
      "original_text": "Employee agrees that during their employment and for a period of twenty-four (24) months following the termination of employment... they will not, directly or indirectly, engage in, perform services for, consult with, or be employed by any business entity globally that operates in the software engineering, cloud architecture, legal technology, or general artificial intelligence fields...",
      "benefits_party": "DRAFTER",
      "location_hint": "Section 4",
      "risk_score": 9,
      "exploitation_score": 10,
      "ambiguity_score": 4,
      "risk_type": "NON_COMPETE",
      "enforceability_concern": True,
      "enforceability_note": "A 24-month global non-compete for a software role is highly overbroad and unenforceable in jurisdictions like California, and severely restricted elsewhere.",
      "hidden_liabilities": [
        "Inability to work in your profession for two full years after leaving",
        "Severe career interruption risk if fired or laid off"
      ],
      "red_flags": [
        "Predatory 24-month duration (industry standard is 0-6 months max)",
        "Global geographic restriction (highly aggressive)",
        "Vague, expansive scope covering the entire tech industry"
      ],
      "plain_english_meaning": "If you leave, you are contractually banned from working in software, cloud, legal tech, or AI anywhere in the world for two years."
    },
    {
      "id": "c7",
      "type": "AMENDMENT",
      "original_text": "The Company reserves the absolute right to amend, modify, delete, or add to any of the terms, policies, benefits, or covenants outlined in this Agreement or in the Employee Handbook at any time, with or without prior notice or the Employee's explicit consent.",
      "benefits_party": "DRAFTER",
      "location_hint": "Section 5",
      "risk_score": 9,
      "exploitation_score": 10,
      "ambiguity_score": 3,
      "risk_type": "AMENDMENT",
      "enforceability_concern": True,
      "enforceability_note": "Unilateral amendment of material employment agreements without consent is often deemed illusory and void by courts.",
      "hidden_liabilities": [
        "The company could slash your commission rates, bonus structures, or benefits unilaterally at any moment"
      ],
      "red_flags": [
        "Unilateral modification right (highly predatory)",
        "Zero notice required before terms change",
        "Assumes binding acceptance by merely continuing to work"
      ],
      "plain_english_meaning": "The company can change this contract, cut your pay, or strip your benefits at any time without asking you or even telling you."
    }
  ],
  "contradictions": [
    {
      "clause_ids": ["c3", "c4"],
      "description": "Clause c3 assigns all IP created globally 24/7 on personal equipment. Clause c4 states employees retain rights to works created on personal time and equipment.",
      "severity": "HIGH",
      "implication": "The employer retains maximum leverage. If you make a side-project, they can invoke c3 to claim ownership, while you are forced to fight an uphill battle citing the conflicting c4 footnote."
    }
  ],
  "benchmark_comparisons": [
    {
      "clause_id": "c1",
      "classification": "AGGRESSIVE",
      "industry_standard": "At-will termination is standard, but professional employment contracts typically incorporate a 2-4 week notice period or equivalent severance pay.",
      "industry_note": "Immediate termination without notice or transition severance is highly drafter-leaning."
    },
    {
      "clause_id": "c3",
      "classification": "POTENTIALLY_UNENFORCEABLE",
      "industry_standard": "Standard IP assignments apply strictly to company resources, working hours, and the direct business line, containing explicit exclusions for personal developments.",
      "industry_note": "Enforcing 24/7 personal time IP transfers violates California Labor Code 2870 and similar statutes in many other states."
    },
    {
      "clause_id": "c5",
      "classification": "AGGRESSIVE",
      "industry_standard": "Forced arbitration is common, but fair terms specify local venue, and the employer covers JAMS filing fees and administrative costs to prevent pricing out claimants.",
      "industry_note": "Forcing travel to Delaware and a 50/50 fee split effectively blocks employees from pursuing legal rights due to massive upfront costs."
    },
    {
      "clause_id": "c6",
      "classification": "POTENTIALLY_UNENFORCEABLE",
      "industry_standard": "Non-competes are increasingly banned by the FTC. Where allowed, standard baselines limit duration to 3-6 months, narrow competitors, and are local.",
      "industry_note": "A 24-month global non-compete is a career-ending restriction that courts regularly throw out as unreasonable."
    },
    {
      "clause_id": "c7",
      "classification": "UNUSUAL",
      "industry_standard": "Modifications to core employment terms require mutual written consent via signed addendums.",
      "industry_note": "Giving one party the unilateral power to rewrite the entire employment agreement without notice is an illusory promise."
    }
  ],
  "scenarios": [
    {
      "clause_id": "c3",
      "scenarios": [
        "You build a fitness tracking mobile app on your own laptop during weekends. Two years after you leave Nexus Dynamics, the app goes viral. Nexus sues you, claiming full ownership of the patent and code citing Section 2.",
        "You help a close friend build a small real estate website on Saturday. Nexus Dynamics invokes the IP clause to assert a partial ownership stake in your friend's venture, locking up their funding."
      ]
    },
    {
      "clause_id": "c5",
      "scenarios": [
        "Nexus Dynamics fails to pay your earned quarterly bonus of $8,000. To sue them, you are forced to travel to Delaware and pay JAMS $3,500 in filing and arbitrator fees. Realizing travel and fees exceed the claim, you drop the dispute."
      ]
    },
    {
      "clause_id": "c6",
      "scenarios": [
        "You are laid off due to corporate downsizing. A competitor offers you a software engineering job. Nexus Dynamics sends a cease-and-desist to the competitor citing your 24-month global non-compete, causing the competitor to withdraw the offer."
      ]
    }
  ],
  "counsel": {
    "danger_rating": "DANGEROUS",
    "danger_summary": "Contains multiple extremely predatory clauses, including a 24-month global non-compete, total 24/7 personal IP ownership assignment, and forced arbitration in Delaware with severe fee splits.",
    "overall_power_balance": "HEAVILY_ONE_SIDED",
    "recommended_action": "DO_NOT_SIGN",
    "executive_summary": "This contract represents an exceptionally aggressive, one-sided agreement that stripped your fundamental rights as an employee. If signed as-is, you will give up ownership of all personal coding projects built on weekends, forfeit your right to resolve workplace disputes in court, and legally commit to a massive two-year global ban on working in any tech field if your employment ends.\n\nThe document contains severe contradictions designed to confuse, and grants unilateral powers to the employer to slash your benefits or rewrite terms at any point without your notice or consent. Do not sign this document without major revisions or consulting a qualified employment attorney.",
    "dashboard_scores": {
      "overall_risk": 92,
      "fairness_score": 14,
      "privacy_risk": 48,
      "financial_exposure": 78,
      "ambiguity_score": 68,
      "exploitability_index": 95
    },
    "top_concerns": [
      {
        "rank": 1,
        "clause_id": "c6",
        "concern": "The 24-month global tech-wide non-compete completely bars you from earning a living in software development anywhere in the world for two full years after leaving.",
        "negotiation_language": "Strike Section 4 entirely, or replace with: 'Employee agrees not to engage in competitive services for direct named competitors within a 20-mile radius of the office for a period of up to three (3) months post-employment, subject to a paid gardening leave compensation matching base salary.'",
        "walk_away_threshold": True
      },
      {
        "rank": 2,
        "clause_id": "c3",
        "concern": "The IP transfer clause claims all work you do 24/7, including weekend side-projects built on your own devices completely unrelated to your job.",
        "negotiation_language": "Replace Section 2 with: 'Employee hereby assigns to the Company all right, title, and interest in inventions made during standard working hours using Company equipment that relate directly to the Company's business. All work created on personal time, personal equipment, and unrelated to the Company's actual products is explicitly excluded from this assignment.'",
        "walk_away_threshold": True
      },
      {
        "rank": 3,
        "clause_id": "c5",
        "concern": "Forced individual arbitration in Delaware with JAMS fee splitting will cost you thousands of dollars up front, effectively preventing you from pursuing legal claims.",
        "negotiation_language": "Replace Section 3 with: 'Any disputes arising under this agreement shall be settled through non-binding mediation locally. In the event of arbitration, the Employer shall cover 100% of the filing, JAMS administration, and arbitrator fees, and the venue shall be the Employee's home state.'",
        "walk_away_threshold": False
      },
      {
        "rank": 4,
        "clause_id": "c7",
        "concern": "Unilateral amendment rights let the company change your pay structure, commission rates, or benefits whenever they want without notice or consent.",
        "negotiation_language": "Replace Section 5 with: 'Any amendments or modifications to this Agreement shall be valid only if made in a written addendum signed by authorized representatives of both the Employer and the Employee.'",
        "walk_away_threshold": True
      }
    ],
    "privacy_compliance_flags": [
      "No clear data retention periods or security standards specified for personal files or metadata collected on company devices.",
      "Perpetual non-disparagement restricts legal rights to whistleblow or report workplace safety violations."
    ],
    "questions_to_ask": [
      "Can we strike the global non-compete entirely, or limit it to direct named competitors for a maximum of 3 months?",
      "Can we add a clear, explicit personal-project carve-out to the intellectual property assignment clause to safeguard my side-projects?",
      "Will the company agree to cover all arbitration fees and locate arbitration in our local city rather than Wilmington, Delaware?",
      "Can we require mutual written consent for any future modifications to this employment agreement?"
    ]
  }
}
