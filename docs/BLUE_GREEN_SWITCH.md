# BLUE / GREEN Switch Plan

Roles:

- BLUE: production
- GREEN: development

Upstreams:

- BLUE → api:8080
- GREEN → api-green:8082

Switch Steps:

1. Validate GREEN health endpoints.
2. Update reverse proxy upstream to GREEN.
3. Reload proxy with zero downtime.
4. Monitor metrics and errors.
5. If needed, revert upstream back to BLUE and reload.

Notes:

- Keep both stacks on same network for DNS resolution.
- No config changes are applied until an explicit switch is requested.
