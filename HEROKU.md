# Heroku deployment preparation

Prepared for https://github.com/hasan-tec/Trading-bot . No Heroku app has been published and no paid resources provisioned.

## What hosting changes

An always-on server can watch prices while your PC and browser are off. Each wallet is simulated; no Binance private account or real orders are involved. Use one non-sleeping web dyno. Eco web dynos can sleep and are unsuitable for a continuous observation experiment.

Budget approximately US$12/month at the prices checked on 17 October 2026: Basic web dyno US$7 and Essential-0 Postgres US$5, before credits/taxes or other usage. Verify account pricing before enabling resources:

- https://www.heroku.com/pricing/
- https://help.heroku.com/FMZU2CVT/information-on-heroku-s-pricing-and-usage
- https://devcenter.heroku.com/articles/usage-and-billing

## Files ready for a private repository

- Procfile: one Node.js web process, using Heroku's assigned PORT and binding to 0.0.0.0.
- app.json: Basic web dyno, one instance, Essential-0 Postgres, generated dashboard password.
- package.json and package-lock.json: Node 22 and the pg PostgreSQL client. pg-mem is development-only.
- .gitignore and .slugignore: exclude state, browser profiles/screenshots, logs, dependencies and environment secrets.
- .env.example: documents configuration variable names, with no real credentials.

The supplied GitHub repository is public. Upload only project source; do not upload node_modules, state, real .env files, or private passwords. The ignore files exclude these local artifacts. A repository is convenient for Heroku's GitHub deployment integration but is not required for local use.

## Future deployment steps

These steps create billable services. Review the selected plans before proceeding.

1. Create the Heroku app and attach Essential-0 Postgres. Choose the Basic web dyno, quantity 1; disable autoscaling and Preboot. Never run a second copy against the same experiment database.
2. Add Config Vars: NODE_ENV=production, APP_ORIGIN=the exact HTTPS app origin (no additional path), and a private random DASHBOARD_PASSWORD of at least 20 characters. Heroku Postgres supplies DATABASE_URL. Do not send passwords or database URLs through chat or commit them.
3. Connect the repository through Heroku Deploy and deploy the desired branch. The Procfile starts the server. app.json can describe a reviewable setup; deploying it provisions the plans it lists.
4. Open the HTTPS app. Browser login username is paper; the password is the DASHBOARD_PASSWORD Config Var. All dashboard, research and API routes require that login. HTTP is redirected to the configured HTTPS origin. Mutations require the exact browser origin.
5. Verify the public Binance feed actually works from the hosting environment. An access restriction or connection failure must leave the app offline; no proxy or restriction bypass is included.
6. Check all three wallets, next decisions, activity and monitoring status. Restart the dyno and confirm that the started time and benchmark purchase remain unchanged. Confirm there is exactly one benchmark buy.

## Durable storage and operations

Heroku's filesystem is ephemeral: https://help.heroku.com/K1PPS2WM/why-are-my-file-uploads-missing-deleted-from-the-application . Hosted mode refuses to start without DATABASE_URL and a private dashboard password. It saves state in a Postgres table rather than dyno-local JSON files. The table is created automatically with a primary key and parameterized reads/upserts. A dedicated PostgreSQL advisory-lock connection prevents two hosted writers; loss of that connection stops the process. Keep the formation at one instance.

Postgres uses TLS. Heroku documents accepting its self-signed certificate with rejectUnauthorized:false: https://devcenter.heroku.com/articles/connecting-heroku-postgres . Supplying PG_CA_CERT enables explicit certificate verification. Local Postgres connections use no TLS; configure production only with the intended Heroku database.

Cloud wallets start as a separate new experiment unless local state is intentionally migrated later. Nothing is automatically copied from this PC. Keep local and cloud test results separate. No migration or reset endpoint is exposed. Keep regular database backups according to your plan's capabilities; do not assume dyno files are backups.

Dyno restarts and market outages can still create gaps. The bot records gaps longer than 90 seconds, skips missed historical buys, and evaluates protective trend exits at the current quote after reconnection. Any existing BTC position can lose value during an outage. There is no real-time stop-loss guarantee. Buy & hold is a one-time 20% purchase; the two trend strategies decide at completed 4-hour or UTC daily candle boundaries.

## Verification limits

Local automated tests cover PostgreSQL schema and JSON upsert/reload through a PostgreSQL emulator, private-access configuration and credentials, and duplicate-writer rejection. The local file-backed wallets and real Binance connection were exercised in the actual app. Desktop/mobile browser tests check wallet selection, chart switching and pause/resume.

A real Heroku Postgres connection, TLS session, deployment-region feed access, and dyno restart must still be verified during deployment. No production deployment is claimed.
