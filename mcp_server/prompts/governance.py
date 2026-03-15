"""Governance and incident-response prompts."""
from __future__ import annotations


def register_governance_prompts(mcp) -> None:
    @mcp.prompt()
    async def red_team_bias_prompt(content: str) -> str:
        """Prompt template for adversarial bias and framing checks."""
        return f"""Perform a red-team review of potential bias, manipulation, and framing risks.

Evaluate:
- Loaded language
- Omitted context
- Single-source claims
- Polarizing narrative patterns
- Suggested neutral rewrites

Content:
{content}

Bias Review:"""

    @mcp.prompt()
    async def incident_triage_prompt(incident: str, severity: str = "medium") -> str:
        """Prompt template for triaging production incidents in the MCP pipeline."""
        return f"""Create an incident triage note for a {severity} severity issue.

Incident details:
{incident}

Include:
1. Immediate containment steps
2. Suspected blast radius
3. Root-cause hypotheses
4. Verification plan
5. Owner handoff checklist"""
