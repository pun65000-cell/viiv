# Blue/Green Upstream Switching Plan

Target upstreams:

- BLUE → api:8080
- GREEN → api-green:8082

Switch procedure:

1. Prepare green stack and verify health on 8082.
2. Update reverse proxy upstream to point to GREEN.
3. Reload proxy configuration with zero downtime.
4. Monitor health and errors; if issues arise, revert to BLUE.

Rollback:

- Switch upstream back to api:8080 and reload configuration.

Notes:

- Keep both stacks on the same network for name resolution.
- Do not modify the existing Caddyfile until the cutover step.
