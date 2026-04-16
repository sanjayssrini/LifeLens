from typing import Dict, List

from app.services.schemas import ActionResult


class ActionEngine:
    def book_hospital(self, patient_name: str = "User", urgency: str = "high") -> ActionResult:
        return ActionResult(
            action="book_hospital",
            status="success",
            details=f"Emergency intake reserved for {patient_name}. Priority={urgency}.",
        )

    def apply_financial_aid(self, user_id: str, reason: str = "hardship") -> ActionResult:
        return ActionResult(
            action="apply_financial_aid",
            status="success",
            details=f"Aid pre-screen submitted for user={user_id} with reason={reason}.",
        )

    def suggest_jobs(self, user_id: str, profile: str = "general") -> ActionResult:
        return ActionResult(
            action="suggest_jobs",
            status="success",
            details=f"Ranked job leads generated for user={user_id} and profile={profile}.",
        )

    def execute(self, tool_name: str, args: Dict) -> ActionResult:
        handlers = {
            "book_hospital": lambda: self.book_hospital(
                patient_name=args.get("patient_name", "User"),
                urgency=args.get("urgency", "high"),
            ),
            "apply_financial_aid": lambda: self.apply_financial_aid(
                user_id=args.get("user_id", "anonymous"),
                reason=args.get("reason", "hardship"),
            ),
            "suggest_jobs": lambda: self.suggest_jobs(
                user_id=args.get("user_id", "anonymous"),
                profile=args.get("profile", "general"),
            ),
        }

        handler = handlers.get(tool_name)
        if handler is None:
            return ActionResult(action=tool_name, status="failed", details="Unknown tool requested.")
        return handler()

    def derive_actions(self, primary_intent: str, derived_intents: List[str], user_id: str) -> List[ActionResult]:
        actions: List[ActionResult] = []
        labels = {primary_intent, *derived_intents}

        if "health_emergency" in labels or "health_issue" in labels:
            actions.append(self.book_hospital(patient_name=user_id, urgency="high"))

        if "financial_support" in labels or "job_loss" in labels:
            actions.append(self.apply_financial_aid(user_id=user_id, reason=primary_intent))

        if "job_search" in labels or "career_transition" in labels:
            actions.append(self.suggest_jobs(user_id=user_id, profile="reskilling"))

        return actions
