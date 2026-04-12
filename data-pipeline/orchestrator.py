"""
Pipeline Orchestrator
Coordinates the execution of all data agents in the correct order.

This is the main entry point for the data pipeline. It runs each agent
sequentially (collection agents first, then processing, then intelligence)
and reports on the results.

Usage:
    python orchestrator.py              # Run all agents
    python orchestrator.py enrollment   # Run specific agent
"""

import json
import logging
import sys
import time
from datetime import datetime

from agents.enrollment_agent import EnrollmentAgent
from agents.expenditure_agent import ExpenditureAgent
from agents.quality_agent import QualityAgent
from agents.managed_care_agent import ManagedCareAgent
from agents.signals_agent import SignalsAgent
from agents.intelligence_agent import IntelligenceAgent

logger = logging.getLogger("orchestrator")


# ─── Agent Registry ──────────────────────────────────────────────────
# Each agent is registered here with its dependencies.
# The orchestrator runs them in dependency order.

AGENT_REGISTRY = {
    "enrollment": {
        "class": EnrollmentAgent,
        "description": "Fetch monthly enrollment data from data.medicaid.gov",
        "depends_on": [],  # No dependencies - runs first
        "layer": "collection",
    },
    "expenditure": {
        "class": ExpenditureAgent,
        "description": "Fetch state expenditure data from CMS-64 (MBES/CBES)",
        "depends_on": [],
        "layer": "collection",
    },
    "quality": {
        "class": QualityAgent,
        "description": "Fetch Core Set quality measures from CMS",
        "depends_on": [],
        "layer": "collection",
    },
    "managed_care": {
        "class": ManagedCareAgent,
        "description": "Fetch managed care enrollment summary and compute penetration",
        # Depends on enrollment for states where the MC dataset doesn't include totals
        "depends_on": ["enrollment"],
        "layer": "collection",
    },
    "signals": {
        "class": SignalsAgent,
        "description": "Aggregate Federal Register, OIG, Congress, and state procurement signals",
        "depends_on": [],
        "layer": "collection",
    },
    "intelligence": {
        "class": IntelligenceAgent,
        "description": "Generate AI briefings, executive insights, and risk/opportunity matrix",
        "depends_on": ["enrollment", "expenditure", "quality", "managed_care", "signals"],
        "layer": "intelligence",
    },
}


def get_execution_order(agent_names: list[str] | None = None) -> list[str]:
    """
    Determine agent execution order based on dependencies.
    If agent_names is None, run all agents.
    """
    if agent_names is None:
        agent_names = list(AGENT_REGISTRY.keys())

    # Simple topological sort for dependency resolution
    ordered = []
    visited = set()

    def visit(name: str):
        if name in visited:
            return
        visited.add(name)
        agent_info = AGENT_REGISTRY.get(name)
        if agent_info:
            for dep in agent_info["depends_on"]:
                if dep in AGENT_REGISTRY:
                    visit(dep)
            ordered.append(name)

    for name in agent_names:
        visit(name)

    return ordered


def run_pipeline(agent_names: list[str] | None = None) -> dict:
    """
    Run the data pipeline, executing agents in dependency order.
    Returns a summary of all agent results.
    """
    execution_order = get_execution_order(agent_names)

    logger.info("=" * 70)
    logger.info("MEDICAID DATA PIPELINE - Starting")
    logger.info(f"Agents to run: {execution_order}")
    logger.info(f"Timestamp: {datetime.now().isoformat()}")
    logger.info("=" * 70)

    pipeline_start = time.time()
    results = {}

    for agent_name in execution_order:
        agent_info = AGENT_REGISTRY[agent_name]
        logger.info(f"\n--- Running agent: {agent_name} ({agent_info['layer']}) ---")
        logger.info(f"    {agent_info['description']}")

        try:
            agent_instance = agent_info["class"]()
            result = agent_instance.run()
            results[agent_name] = result

            status = result.get("status", "unknown")
            if status == "success":
                logger.info(f"    Agent {agent_name}: SUCCESS")
            else:
                logger.warning(f"    Agent {agent_name}: {status}")

        except Exception as e:
            logger.error(f"    Agent {agent_name} FAILED: {e}")
            results[agent_name] = {"status": "error", "error": str(e)}

    pipeline_elapsed = time.time() - pipeline_start

    summary = {
        "pipeline_run": datetime.now().isoformat(),
        "total_elapsed_seconds": round(pipeline_elapsed, 1),
        "agents_run": len(execution_order),
        "results": results,
    }

    logger.info("\n" + "=" * 70)
    logger.info("PIPELINE COMPLETE")
    logger.info(f"Total time: {pipeline_elapsed:.1f}s")
    logger.info(f"Results: {json.dumps(results, indent=2)}")
    logger.info("=" * 70)

    return summary


# ─── CLI ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    # Parse optional agent names from command line
    requested_agents = sys.argv[1:] if len(sys.argv) > 1 else None

    if requested_agents:
        # Validate requested agents exist
        for name in requested_agents:
            if name not in AGENT_REGISTRY:
                print(f"Error: Unknown agent '{name}'")
                print(f"Available agents: {list(AGENT_REGISTRY.keys())}")
                sys.exit(1)

    summary = run_pipeline(requested_agents)
    print(f"\nPipeline Summary:\n{json.dumps(summary, indent=2)}")
