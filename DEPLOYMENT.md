# GoGames.XYZ deployment

The production site is `https://gogames.xyz`. The GitHub Actions workflow deploys
each successful `main` update to an immutable VPS release and atomically moves
`/srv/www/gogames.xyz/current` to the new commit.

## GitHub Actions configuration

In `george-shepov/gogames.xyz` → Settings → Secrets and variables → Actions,
configure these repository secrets:

| Secret | Value |
| --- | --- |
| `GOGAMES_VPS_HOST` | VPS host name or IP |
| `GOGAMES_VPS_USER` | SSH deployment user |
| `GOGAMES_VPS_PORT` | SSH port, normally `22` |
| `GOGAMES_VPS_PATH` | `/srv/www/gogames.xyz` |
| `GOGAMES_VPS_SSH_KEY` | Private key for the deployment user |
| `GOGAMES_VPS_KNOWN_HOSTS` | Reviewed `ssh-keyscan -H <host>` output |
| `GOGAMES_SERVER_ENV` | Complete contents of the production `server/.env` |

Set these repository variables:

| Variable | Value |
| --- | --- |
| `GOGAMES_DEPLOY_ENABLED` | `true` |
| `GOGAMES_PUBLIC_URL` | `https://gogames.xyz` |

`GOGAMES_SERVER_ENV` is written to the VPS at
`/srv/www/gogames.xyz/shared/server.env`; it is never included in a release
archive or committed to git. The workflow installs production Node dependencies,
restarts the `gogames` PM2 process, and verifies `gogames-release.json` after the
symlink swap.

The VPS Nginx configuration must serve `/srv/www/gogames.xyz/current` and proxy
`/api/` and `/ws` to the GoGames server on port `3000`.
