# Running a Dash Core nightly on a masternode (Linux, dashd)

A crash fix is already merged into Dash Core's development branch but is not in
v23.1.8 yet. If this crash affects your masternode and you don't want to wait for
the v24 release, you can run a **nightly build** in the meantime. This is
optional. If your node runs fine on v23.1.8, stay on it.

> **Nightlies are pre-release software.** Automation builds them each day from
> the `develop` branch and signs them with an automation key, not the release
> signing keys. Upgrade one node first and watch it before you upgrade the rest.
> Switch to the official v24 release once it ships.

Running dashmate (evonodes, or any dashmate-managed node)? Use the
[dashmate guide](dash-nightly-masternode-dashmate.md) instead.

## Is this safe for mainnet?

- **Consensus stays the same.** The v24 hard fork can't activate on mainnet from
  these builds, so your node follows the same network rules as v23.1.8.
- **Rolling back is possible but not free.** Some on-disk data is migrated on
  first start, so back up before you upgrade (step 3).

## 1. Pick a build

Builds are here: <https://github.com/dashpay/dash-dev-branches/releases>

Use the newest `v24.0.0-nightly.YYYY.MM.DD` release dated **2026.09.24 or later**.
Each release says which `develop` commit it was built from. In the commands
below, set `V` to the release name **without** the leading `v`.

## 2. Download and verify

```bash
V=24.0.0-nightly.2026.09.24     # the release you picked
ARCH=x86_64                     # or aarch64 for ARM servers

BASE=https://github.com/dashpay/dash-dev-branches/releases/download/v$V
wget "$BASE/dashcore-$V-$ARCH-linux-gnu.tar.gz" "$BASE/dashcore-$V-$ARCH-linux-gnu.tar.gz.asc"

# Import the nightly signing key
wget https://pastapastapasta.github.io/agent-pages/dash-nightly-signing-key.asc
gpg --import dash-nightly-signing-key.asc
gpg --fingerprint 1C625BD088FF4CDE2E33210935CDE8170FE187BB
#   must show: 1C62 5BD0 88FF 4CDE 2E33  2109 35CD E817 0FE1 87BB
#              Dash Core Dev Builds (guix-automation)

gpg --verify "dashcore-$V-$ARCH-linux-gnu.tar.gz.asc" "dashcore-$V-$ARCH-linux-gnu.tar.gz"
#   must say: Good signature from "Dash Core Dev Builds (guix-automation)"
```

The warning "This key is not certified with a trusted signature" is normal.
**Stop if you don't see "Good signature".**

## 3. Stop the node and back up

```bash
dash-cli stop
while pgrep -x dashd >/dev/null; do sleep 2; done   # wait until it has fully exited
# (or: sudo systemctl stop dashd, if you run it as a service)

which dashd                    # note where your current binaries live
cp "$(which dashd)" ~/dashd-23.1.8.bak
cp "$(which dash-cli)" ~/dash-cli-23.1.8.bak
```

**Strongly recommended:** copy your data directory (usually `~/.dashcore`) as
well, especially if you use `addressindex`, `spentindex` or `timestampindex`.
You'll need that copy to go back to v23.1.8 quickly.

## 4. Check your `dash.conf`

- **Remove `minsporkkeys=...`** if you set it. That option no longer exists.
- If any **monitoring scripts or tools** read the `service` field from
  `masternode status`, `protx diff` or `protx listdiff`, read `address` from
  `masternode list`, or read `softforks` from `getblockchaininfo`, add:
  ```
  deprecatedrpc=service
  deprecatedrpc=softforks
  ```
  A plain masternode with no extra tooling doesn't need these lines.

## 5. Install and start

```bash
tar xzf "dashcore-$V-$ARCH-linux-gnu.tar.gz"
sudo cp "dashcore-$V/bin/dashd" "dashcore-$V/bin/dash-cli" "$(dirname "$(which dashd)")/"

dashd -daemon                  # or: sudo systemctl start dashd
```

**If you use `addressindex`, `spentindex` or `timestampindex`:** on the first
start, the node moves these indexes into a new format. That can take 20–40
minutes or more depending on hardware, and progress appears in `debug.log`.
The node is not hung, so don't kill it.

## 6. Check it's working

```bash
dash-cli -version                    # should report v24.0.0-nightly...
dash-cli getblockchaininfo | grep -E '"blocks"|"headers"'
dash-cli mnsync status               # wait for "IsSynced": true
dash-cli masternode status           # should show "Ready"
```

## Going back to v23.1.8

```bash
dash-cli stop; while pgrep -x dashd >/dev/null; do sleep 2; done
sudo cp ~/dashd-23.1.8.bak   "$(which dashd)"
sudo cp ~/dash-cli-23.1.8.bak "$(which dash-cli)"
```

- **If you used address, spent or timestamp indexes:** restore your data
  directory backup, or start once with `dashd -reindex`, because v24 migrated
  those indexes.
- **If v23.1.8 won't start on the data directory:** restore the backup or
  reindex.

## When v24 is released

Upgrade to the official release as usual. You can remove any `deprecatedrpc=`
lines you added once your tools support the new fields.
