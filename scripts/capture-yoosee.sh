#!/usr/bin/env bash
# Capture traffic to/from a Yoosee / ONVIF camera on the LAN.
#
# Usage:
#   sudo ./scripts/capture-yoosee.sh [camera_ip] [interface]
#
# This records traffic involving THIS PC and the camera (good for
# For Yoosee/iCSee on a phone or Windows PC, use:
#   sudo ./scripts/capture-lan-mitm.sh <client_ip> [camera_ip] [interface]
#   sudo ./scripts/capture-lan-mitm.sh 192.168.1.39 192.168.1.34 eth0
#
# While capture runs, use the Yoosee app:
#   - pan, tilt, zoom in, zoom out (each a few times)
# Then press Ctrl+C and run analyze-capture.sh on the pcap.

set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "tcpdump needs root. Re-run with sudo:" >&2
  echo "  sudo $0 $*" >&2
  exit 1
fi

CAMERA_IP="${1:-192.168.1.34}"
IFACE="${2:-eth0}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/captures"
PCAP="${OUT_DIR}/yoosee-${CAMERA_IP}-${STAMP}.pcap"

mkdir -p "$OUT_DIR"

FILTER="host ${CAMERA_IP} and (
  port 5000 or port 554 or port 34567 or port 50000 or port 8899 or
  port 8000 or port 8080 or port 37777 or port 6611 or
  udp port 34569 or udp port 34571
)"

echo "Camera:     ${CAMERA_IP}"
echo "Interface:  ${IFACE}"
echo "Output:     ${PCAP}"
echo "Filter:     ${FILTER}"
echo ""
echo "Starting capture. Use the Yoosee app now, then Ctrl+C to stop."
echo ""

exec tcpdump -i "$IFACE" -s 0 -w "$PCAP" $FILTER
