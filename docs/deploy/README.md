# Private environment — runbook

How to stand up and operate the private deployed environment described in
[ADR 0024](../adr/0024-environnement-prive-deploye.md): one OVH VPS in France, the
stack from `docker-compose.prod.yml` behind Caddy, an HTTP password in front of
everything, fictional data only.

Everything here is done by hand, in order. Steps marked **🖥 Mac** run on your
laptop, **☁ VPS** on the server, **🌐 Web** in a browser.

> **Rule (ADR 0024 §8):** no real student's personal data is ever entered on this
> environment. Every account, class and message is fictional.

---

## 1. Choose the VPS offer 🌐

Go to OVHcloud → *Bare Metal & VPS* → *VPS* and compare the offers against these
criteria (ADR 0024 §1). Read prices on the order page itself; they change.

| Criterion | What to look for |
|---|---|
| RAM | **≥ 4 GB required, 8 GB recommended.** Images are built on the server, next to the running stack: Maven and the Next.js build are the memory peaks. `deploy.sh` builds the two images one after the other and `bootstrap.sh` adds 4 GB of swap, so 4 GB works (the plan chosen on 2026-09-28 is OVH VPS-1); more makes deploys faster. |
| Disk | ≥ 40 GB. Docker images and build cache take ~10 GB; dumps and logs the rest. |
| Location | A **French** datacenter (Gravelines, Roubaix or Strasbourg). The location is chosen during the order — check it before paying. |
| Image | **Ubuntu 24.04 LTS** (the scripts are written for it). |
| Backup | The **automated backup** option (*Sauvegarde automatisée*) must be offered for the plan. It is the off-server copy (ADR 0024 §7). |
| Price | OVH shows prices excl. VAT by default: compare **incl. VAT**, **plus** the backup option, for the commitment period you pick (a 12-month commitment is usually cheaper per month than no commitment). Target ≈ 5 €/month for the VPS. |

vCPU count matters less: 2 is enough, more makes deploys faster.

## 2. Order the VPS 🌐

1. Choose the offer, the French location and **Ubuntu 24.04**.
2. Tick the **automated backup** option.
3. When asked for an SSH key, paste your **public** key (🖥 `cat ~/.ssh/id_ed25519.pub`;
   if you have none: `ssh-keygen -t ed25519`). OVH puts it on the `ubuntu` user.
   Check the image is exactly **Ubuntu 24.04** (not a newer release) and the key
   field is really filled: without a key, the `ubuntu` user only has a password
   sent by e-mail. If either went wrong, *Reinstall* the VPS from the control panel
   (same IPs, nothing lost at this stage).
4. Once delivered, note the VPS's name (`vps-xxxxxxxx.vps.ovh.net`) and its
   **IPv4** and **IPv6** addresses: the VPS page in the control panel (*Home* tab),
   or 🖥 `dig +short A vps-xxxxxxxx.vps.ovh.net` and `dig +short AAAA …`.

## 3. Buy the domain 🌐

Any registrar works; buying it at OVH keeps one account and one bill. A `.fr`
requires the holder to live in the EU. For an individual, the registrar hides
the holder's personal details in the public WHOIS by default — check this is on.

Decide the hostname: the domain itself (`brio-exemple.fr`) or a subdomain
(`prive.brio-exemple.fr`), which leaves the bare domain free for a future
production. The rest of this page calls it `<domain>`.

## 4. Point the DNS at the VPS 🌐

DNS maps the name to the VPS's addresses: an `A` record for IPv4, an `AAAA` record
for IPv6. At OVH: *Web Cloud* → *Domain names* → the domain → *DNS zone*.

A new OVH domain already points at a parking page ("site en construction"). For
the chosen name, **every** `A` and `AAAA` record must end up pointing at the VPS —
one leftover parking record is enough to send part of the traffic (and Let's
Encrypt) elsewhere:

| Type | Sub-domain | Value | Action |
|---|---|---|---|
| `A` | `@` for the bare domain, `prive` for a subdomain | the VPS IPv4 | **modify** the existing parking record (`213.186.33.5`) |
| `AAAA` | same | the VPS IPv6 | modify the parking record if there is one (`2001:41d0:301::…`), otherwise add |

OVH's form requires the sub-domain field: `@` means the bare domain. Also delete
`www`'s parking `A` and its `TXT "3|welcome"` if you serve the bare domain (the
environment serves one name only). Leave `NS`, `MX` and `SPF` alone.

Check against OVH's own DNS server, which answers immediately (the zone's `NS`
records name it, e.g. `ns111.ovh.net`), then against your usual resolver:

```sh
dig +short A <domain> @ns111.ovh.net      # 🖥 exactly one line: the VPS IPv4
dig +short AAAA <domain> @ns111.ovh.net   # 🖥 exactly one line: the VPS IPv6
dig +short A <domain>
```

A browser that opened the domain earlier may keep showing the parking page for up
to an hour (its own DNS cache): use a private window.

Do not start the stack before this is true: Caddy would fail Let's Encrypt's
validation, which rate-limits repeated failures.

## 5. First connection and repository clone 🖥 → ☁

On the Mac, add to `~/.ssh/config`:

```
Host brio
  HostName <domain>
  User ubuntu
  # Keeps idle sessions alive through home routers and NAT64 gateways.
  ServerAliveInterval 30
  ServerAliveCountMax 4
```

Then `ssh brio`, and answer `yes` to the host fingerprint question.

- **It asks for `ubuntu@<domain>'s password`**: the VPS does not have your key.
  `Ctrl+C` — do not type your Mac password — and reinstall with the key (step 2).
- **"You are required to change your password"**: OVH expires the `ubuntu`
  password on first login. Connect with a plain `ssh brio` (not `ssh brio 'cmd'`,
  which has no terminal to prompt in), choose a new password — `sudo` asks for it
  later — and reconnect after it closes the session.
- After a reinstall, SSH refuses with "REMOTE HOST IDENTIFICATION HAS CHANGED":
  `ssh-keygen -R <domain>`, then connect again.

The prompt shows where a command runs: `ubuntu@vps-…:~$` is the VPS, your Mac's
prompt is the Mac. Everything below marked ☁ runs on the VPS. There, give it
read-only access to the repository with a **deploy key**:

```sh
ssh-keygen -t ed25519 -f ~/.ssh/brio_deploy -N "" -C "brio-vps deploy key"
cat ~/.ssh/brio_deploy.pub
```

🌐 GitHub → `BrioOrg/brio` → *Settings* → *Deploy keys* → *Add deploy key*: paste
it, title `brio-vps`, **leave "Allow write access" unticked**.

☁ Back on the VPS:

```sh
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/brio_deploy
  IdentitiesOnly yes
EOF
git clone -b develop git@github.com:BrioOrg/brio.git ~/brio
```

GitHub's fingerprint is `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU`.

## 6. Harden the server ☁

```sh
sudo ~/brio/scripts/env/bootstrap.sh ubuntu
```

It sets the time zone, installs security updates (and turns on automatic ones),
switches SSH to key-only with no root login, enables the firewall (22, 80, 443),
installs Docker with bounded logs, adds 4 GB of swap, creates `/var/backups/brio`
and the nightly snapshot timer. It refuses to run if `ubuntu` has no SSH key, so
it cannot lock you out.

Keep a **second** `ssh brio` session open while it runs. **Before closing
anything**, check from a new terminal that `ssh brio` still works. Then log out and
back in (the `docker` group applies to new sessions) and check:

```sh
docker ps                                   # an empty table, no "permission denied"
sudo ufw status                             # active: 22, 80, 443, 443/udp
swapon --show                               # /swapfile, 4G
systemctl list-timers brio-snapshot.timer   # next run at 03:00
```

If the login banner says `*** System restart required ***`, run `sudo reboot` now,
while nothing is running yet.

## 7. Anthropic key with a spending cap 🌐

In the Anthropic Console:

1. Create a **workspace** dedicated to this environment (e.g. `brio-vps`).
2. Set a **monthly spend limit** on that workspace (a few euros is enough for
   two people testing).
3. Create an **API key in that workspace**. It is separate from your development
   key: it can be revoked or capped without touching your dev setup.

Note the date the limit was set; it is recorded with the restore in step 11.

## 8. Configure the environment ☁

```sh
cd ~/brio
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
nano deploy/.env
```

Fill in every value (the comments in the file explain each one):

- `BRIO_DOMAIN=<domain>`
- `CADDY_USER_1` / `CADDY_HASH_1` and `CADDY_USER_2` / `CADDY_HASH_2`: one account
  each for Pierce and Gabrielle. Each person picks their own password and generates
  its hash with `docker run --rm -it caddy:2.10-alpine caddy hash-password` (it
  prompts twice; the password never lands in the shell history). The hash is not
  tied to a name: `CADDY_HASH_1` goes with `CADDY_USER_1`, and so on. A hash cannot
  be reversed, so Gabrielle can send hers over any channel. Keep each hash in single
  quotes.
- `POSTGRES_PASSWORD`: `openssl rand -base64 32`.
- `BRIO_IA_API_KEY`: the key from step 7.
- Leave the SMTP values (Mailpit) and `BRIO_RESET_ALLOWED=true` as they are.

## 9. First deploy ☁

```sh
scripts/env/deploy.sh
docker compose -f docker-compose.prod.yml --env-file deploy/.env --profile ingest run --rm ingest
```

The first build takes several minutes. `deploy.sh` ends with
`✓ Deployed <commit> on https://<domain>`; the ingestion ends with
`created=… failed=0`.

## 10. Check "done" (issue #154) 🌐

- [ ] `https://<domain>` asks for the password; the browser shows a **valid
      certificate** (padlock, issued by Let's Encrypt). Both accounts log in.
- [ ] `https://<domain>/mailpit` shows the Mailpit inbox (same password).
- [ ] **Complete student signup**: create a student account (level, password, a
      fictional parent address such as `parent@example.test`). The consent e-mail
      appears in `/mailpit`; follow its link and give consent; the student logs in.
- [ ] **Restore**: step 11.
- [ ] **Reset**: `scripts/env/reset.sh` → the student account no longer exists,
      the catalogue is back, `/mailpit` is empty.

## 11. The dated restore ☁

ADR 0024 §7: a backup is only proven by a restore. After the student signup of
step 10:

```sh
scripts/env/snapshot.sh avant-restauration   # the state to get back
# change something visible: e.g. create a second student account
scripts/env/restore.sh avant-restauration-<timestamp>.dump
```

Check the second account is gone and the first one still logs in. Then record it in
[`restaurations.md`](restaurations.md) (date, snapshot, what was checked, result)
and in a comment on issue #154.

---

## Day-to-day operations ☁

All commands run from `~/brio`.

| Task | Command |
|---|---|
| Deploy the latest `develop` | `scripts/env/deploy.sh` |
| Reload the catalogue after content changes | `docker compose -f docker-compose.prod.yml --env-file deploy/.env --profile ingest run --rm ingest` |
| Named snapshot before a risky test | `scripts/env/snapshot.sh <name>` |
| List snapshots | `scripts/env/snapshot.sh --list` |
| Restore one | `scripts/env/restore.sh <file>` |
| Blank database (catalogue only, no account, Mailpit empty) | `scripts/env/reset.sh` |
| Logs | `docker compose -f docker-compose.prod.yml --env-file deploy/.env logs -f backend` |
| Nightly snapshot status | `systemctl list-timers brio-snapshot.timer` · `journalctl -u brio-snapshot` |

- `restore.sh` and `reset.sh` snapshot the current database first (`pre-restore-…`,
  `pre-reset-…`), ask you to type the domain back, and refuse unless
  `BRIO_RESET_ALLOWED=true` is in `deploy/.env`.
- Nightly snapshots (03:00) keep the last 7. Named snapshots are never deleted
  automatically: remove old ones from `/var/backups/brio` yourself.
- Dumps live on the VPS. Losing the VPS loses them; only OVH's automated backup
  survives that, and restoring it rolls back the **whole** machine.

## Accounts and roles

Teacher and student accounts come from the real signup flows. Nothing creates an
**`admin_brio`** account outside the `local` profile, and creating an établissement
or a class requires one. Until an admin flow exists, promote a fictional account by
hand, in a `psql` session:

```sh
docker compose -f docker-compose.prod.yml --env-file deploy/.env exec postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

```sql
UPDATE identite.comptes SET role = 'admin_brio' WHERE email = '<address>';
```

## Troubleshooting

- **Certificate warning / Caddy logs "challenge failed".** DNS does not point at
  the VPS yet, or ports 80/443 are blocked. Check step 4, then
  `docker compose … logs caddy`. Caddy retries on its own.
- **`deploy.sh`: "The clone has local changes".** Something was edited on the
  server. Changes belong in a PR; inspect them with `git status` / `git diff`, then
  discard them with `git checkout -- .`.
- **Build killed / very slow.** Out of memory: check `free -h`. Stop the stack
  during the build (`docker compose … stop web backend`) or move to a plan with
  more RAM.
- **Disk full.** `df -h`, `docker system df`. `deploy.sh` prunes images and build
  cache older than 7 days; old named dumps in `/var/backups/brio` are yours to
  delete.
- **Locked out of SSH.** Use the KVM console in the OVH control panel.

## At publication (F1b)

Not now — for the record (ADR 0024 §9): remove `BRIO_RESET_ALLOWED` from
`deploy/.env`, remove `basic_auth` from the Caddyfile, point the SMTP variables at
an EU provider.
