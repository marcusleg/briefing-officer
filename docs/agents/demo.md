# Demo instance

How to leave a running instance of a branch for the user to try.

1. Set up the worktree as described under **Checks** in `AGENTS.md`. The
   `.env` needs a working AI provider key.
2. Pick a free port (`ss -ltn`); other sessions may already hold 3000 or 3100.
   Give the demo its own database under the gitignored `.tmp/`:

   ```bash
   export DATABASE_URL=file:./.tmp/demo.sqlite BASE_URL=http://localhost:3100
   npx prisma migrate deploy
   npm run dev -- -p 3100 > .tmp/dev.log 2>&1   # run in the background
   ```

   `BASE_URL` must match the port, or sign-in redirects break.

3. Create the account: the first user who signs up becomes admin.

   ```bash
   curl -c .tmp/cookies -H 'Content-Type: application/json' \
     -d '{"name":"Demo","email":"demo@example.org","password":"password"}' \
     http://localhost:3100/api/auth/sign-up/email
   curl -c .tmp/cookies -H 'Content-Type: application/json' \
     -d '{"email":"demo@example.org","password":"password"}' \
     http://localhost:3100/api/auth/sign-in/email
   ```

   Hand over the credentials only after the sign-in call succeeds.

4. For feed content that costs no AI calls, serve an RSS file from `.tmp/` with
   `python3 -m http.server` and subscribe to it. A feed with articles triggers
   lead generation through the configured provider.
