#!/usr/bin/env bash
# Capture client <-> camera traffic on a switched LAN (no dsniff required).
#
# Run on the CAPTURE HOST (not the client). Example topology:
#   capture host  192.168.1.81  08:00:27:5f:6a:0c
#   Windows PC    192.168.1.39  c8:a3:62:b7:c6:c1  (iCSee / Yoosee CMS)
#   phone         192.168.1.38  40:b6:07:27:97:e7  (often cloud/P2P only)
#   camera        192.168.1.34  ONVIF :5000, RTSP :554, Yoosee :50000
#
# Uses Python 3 ARP spoof (scripts/arp-spoof.py, stdlib only) + tcpdump.
#
# Usage:
#   sudo ./scripts/capture-lan-mitm.sh [client_ip] [camera_ip] [interface]
#
# Examples:
#   sudo ./scripts/capture-lan-mitm.sh 192.168.1.39 192.168.1.34 eth0
#   sudo ./scripts/capture-lan-mitm.sh 192.168.1.38 192.168.1.34 eth0
#
# While capture runs, use iCSee/Yoosee on the client (pan, tilt, zoom). Ctrl+C to stop.
# Then: ./scripts/analyze-capture.sh captures/lan-....pcap 192.168.1.34 192.168.1.39
#
# Windows on the same LAN usually talks TCP (ONVIF/RTSP) — passive tcpdump on .81
# often works without MITM. Phone apps may relay via cloud; prefer .39 for capture.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ARP_SPOOF="${SCRIPT_DIR}/arp-spoof.py"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Re-run with sudo: sudo $0 $*" >&2
  exit 1
fi

CLIENT_IP="${1:-192.168.1.39}"
CAMERA_IP="${2:-192.168.1.34}"
IFACE="${3:-eth0}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)/captures"
PCAP="${OUT_DIR}/lan-${CLIENT_IP}-to-${CAMERA_IP}-${STAMP}.pcap"

if ! command -v tcpdump >/dev/null 2>&1; then
  echo "tcpdump not found (install from Slackware or slackbuilds.org)" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found" >&2
  exit 1
fi

if [[ ! -f "$ARP_SPOOF" ]]; then
  echo "Missing ${ARP_SPOOF}" >&2
  exit 1
fi

CAPTURE_IP="$(python3 -c "
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.connect(('${CAMERA_IP}', 9))
print(s.getsockname()[0])
s.close()
" 2>/dev/null || true)"

if [[ -z "$CAPTURE_IP" ]]; then
  CAPTURE_IP="(unknown)"
fi

if [[ "$CAPTURE_IP" == "$CLIENT_IP" ]]; then
  echo "ERROR: This machine (${CAPTURE_IP}) is the same IP as the client." >&2
  echo "Run capture-lan-mitm.sh on a different host (e.g. 192.168.1.81)." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

SPOOF_CAM=""
SPOOF_PHONE=""
TCPDUMP_PID=""
IPTABLES_ADDED=0

cleanup() {
  echo ""
  echo "Stopping..."
  [[ -n "$SPOOF_CAM" ]] && kill "$SPOOF_CAM" 2>/dev/null || true
  [[ -n "$SPOOF_PHONE" ]] && kill "$SPOOF_PHONE" 2>/dev/null || true
  [[ -n "$TCPDUMP_PID" ]] && kill "$TCPDUMP_PID" 2>/dev/null || true
  if [[ "$IPTABLES_ADDED" -eq 1 ]] && command -v iptables >/dev/null 2>&1; then
    iptables -D FORWARD -s "$CLIENT_IP" -d "$CAMERA_IP" -j ACCEPT 2>/dev/null || true
    iptables -D FORWARD -s "$CAMERA_IP" -d "$CLIENT_IP" -j ACCEPT 2>/dev/null || true
  fi
  echo 0 > /proc/sys/net/ipv4/ip_forward 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Capture host: ${CAPTURE_IP} (this machine — must not be the client)"
echo "Client:       ${CLIENT_IP}"
echo "Camera:       ${CAMERA_IP}"
echo "Interface:    ${IFACE}"
echo "Output:       ${PCAP}"
echo ""
echo "Enabling IP forwarding..."
echo 1 > /proc/sys/net/ipv4/ip_forward
echo 0 > /proc/sys/net/ipv4/conf/all/rp_filter 2>/dev/null || true
echo 0 > /proc/sys/net/ipv4/conf/all/send_redirects 2>/dev/null || true
echo 0 > /proc/sys/net/ipv4/conf/default/send_redirects 2>/dev/null || true

if command -v iptables >/dev/null 2>&1; then
  iptables -A FORWARD -s "$CLIENT_IP" -d "$CAMERA_IP" -j ACCEPT
  iptables -A FORWARD -s "$CAMERA_IP" -d "$CLIENT_IP" -j ACCEPT
  IPTABLES_ADDED=1
  echo "iptables FORWARD rules added for client <-> camera"
else
  echo "WARN: iptables not found — MITM may not forward client replies"
fi

echo "Starting ARP spoof (python3)..."
python3 "$ARP_SPOOF" -i "$IFACE" -t "$CAMERA_IP" "$CLIENT_IP" &
SPOOF_CAM=$!
python3 "$ARP_SPOOF" -i "$IFACE" -t "$CLIENT_IP" "$CAMERA_IP" &
SPOOF_PHONE=$!

sleep 2

FILTER="host ${CAMERA_IP} and host ${CLIENT_IP}"
echo ""
echo "Capture running on ${IFACE}. Use iCSee/Yoosee on ${CLIENT_IP} (pan, tilt, zoom)."
echo "Success = analyze shows traffic both directions. Ctrl+C to stop."
echo ""

tcpdump -i "$IFACE" -s 0 -w "$PCAP" $FILTER &
TCPDUMP_PID=$!
wait "$TCPDUMP_PID"

echo "Saved: ${PCAP}"
