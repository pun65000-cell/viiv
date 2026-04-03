VIIV SYSTEM RULES (MANDATORY)

🔴 CORE PRINCIPLE

NEVER BREAK EXISTING WORKING FEATURES

---

🚫 FORBIDDEN ACTIONS

- DO NOT rewrite entire files
- DO NOT rename files or folders
- DO NOT move files unless explicitly ordered
- DO NOT change API endpoints without verification
- DO NOT mix roles (owner/admin)
- DO NOT assume structure

---

✅ REQUIRED BEHAVIOR

- ALWAYS scan existing files before editing
- ALWAYS modify only minimal lines
- ALWAYS preserve existing logic
- ALWAYS confirm file existence before writing
- ALWAYS log what is being changed

---

🧱 FRONTEND RULE

- HTML = structure ONLY
- JS = logic ONLY
- NO inline script rewriting full page

---

🔌 API RULE

- Use ONLY existing endpoints
- If endpoint fails → LOG, DO NOT REWRITE

---

🎯 SCOPE CONTROL

Every task MUST define:

- target file
- target function
- exact change

If not → DO NOTHING

---

🛑 FAILSAFE

If risk detected:

→ STOP immediately
→ DO NOT write code

---

📢 LOG FORMAT

Every change must output:

{
"file": "...",
"change": "...",
"risk": "low/medium/high"
}

---

🔐 PRIORITY

1. Stability
2. Existing system
3. New feature

NEVER reverse this order

---

🧠 FINAL RULE

IF NOT SURE → DO NOT TOUCH
