#!/usr/bin/env bash
#
# One-time preparation of a fresh Ubuntu 24.04 LTS VPS for the private environment
# (ADR 0024 §1, §3, §7). Run as root from the repository clone:
#
#   sudo scripts/env/bootstrap.sh <user>
#
# <user> is the account that runs the stack and owns the clone (OVH's `ubuntu`). It
# must already log in with an SSH key: password login is switched off here.
# Idempotent — safe to run again after editing it.

set -euo pipefail

die() {
  echo "✗ $*" >&2
  exit 1
}

info() {
  echo "→ $*"
}

user=${1:-}
[ -n "$user" ] || die "Usage: sudo scripts/env/bootstrap.sh <user>"
[ "$(id -u)" -eq 0 ] || die "Run as root (sudo)."
id "$user" >/dev/null 2>&1 || die "No such user: $user"
grep -q '^ID=ubuntu$' /etc/os-release || die "Written for Ubuntu (24.04 LTS)."

home=$(getent passwd "$user" | cut -d: -f6)
# Refuse to lock ourselves out: the key must be in place before passwords go.
[ -s "$home/.ssh/authorized_keys" ] || die "$home/.ssh/authorized_keys is empty — add your SSH key first."

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
snapshot_dir=/var/backups/brio

export DEBIAN_FRONTEND=noninteractive

info "Time zone: Europe/Paris (snapshot names and the nightly timer use local time)"
timedatectl set-timezone Europe/Paris

info "System packages and automatic security updates"
apt-get update -q
apt-get upgrade -y -q
apt-get install -y -q ca-certificates curl git ufw unattended-upgrades
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

info "SSH: key authentication only, no root login"
# sshd keeps the first value it reads and includes these files in lexical order, so
# this must sort before cloud-init's 50-cloud-init.conf (which may allow passwords).
cat >/etc/ssh/sshd_config.d/00-brio.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
sshd -t || die "sshd rejected the configuration — not restarting it."
systemctl restart ssh

info "Firewall: inbound 22, 80, 443 only"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp # HTTP/3, published by Caddy
ufw --force enable
# Docker writes its own iptables rules for published ports, ahead of ufw. Only Caddy
# publishes any (80, 443), so the two agree; publishing another port in
# docker-compose.prod.yml would expose it despite ufw.

if ! command -v docker >/dev/null 2>&1; then
  info "Docker Engine and the compose plugin (Docker's apt repository)"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  codename=$(. /etc/os-release && echo "$VERSION_CODENAME")
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $codename stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

info "Docker: bounded container logs"
# The default json-file driver never rotates: logs would eventually fill the disk.
cat >/etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF
systemctl restart docker
usermod -aG docker "$user"

if ! swapon --show=NAME --noheadings | grep -qx /swapfile; then
  info "Swap: 4 GB (images are built on this machine, next to the running stack)"
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi

info "Snapshot directory: $snapshot_dir"
install -d -o "$user" -g "$user" -m 700 "$snapshot_dir"

info "Nightly snapshot at 03:00 (systemd timer)"
# Generated here, not committed: the units carry this clone's actual path.
cat >/etc/systemd/system/brio-snapshot.service <<EOF
[Unit]
Description=Brio nightly database snapshot
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
User=$user
WorkingDirectory=$repo
ExecStart=$repo/scripts/env/snapshot.sh --nightly
EOF
cat >/etc/systemd/system/brio-snapshot.timer <<'EOF'
[Unit]
Description=Brio nightly database snapshot

[Timer]
OnCalendar=*-*-* 03:00:00
# Run at next boot if the machine was off at 03:00.
Persistent=true

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now brio-snapshot.timer

echo "✓ Server ready. Log out and back in as $user (docker group), then follow docs/deploy/README.md."
