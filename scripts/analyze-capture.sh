#!/usr/bin/env bash
# Summarize a pcap from capture-yoosee.sh (or PCAPdroid export).
#
# Usage:
#   ./scripts/analyze-capture.sh <file.pcap> [camera_ip] [client_ip]

set -euo pipefail

PCAP="${1:?Usage: analyze-capture.sh <file.pcap> [camera_ip] [client_ip]}"
CAM="${2:-192.168.1.34}"
CLIENT="${3:-192.168.1.39}"
if [[ ! -f "$PCAP" ]]; then
  echo "File not found: $PCAP" >&2
  exit 1
fi

echo "=== File ==="
ls -lh "$PCAP"
echo ""

echo "=== Packet count by protocol/port ==="
tcpdump -nn -r "$PCAP" 2>/dev/null | awk '
  {
    if (match($0, / ([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\.([0-9]+) > ([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\.([0-9]+)/, m)) {
      key = m[2] " -> " m[4]
      c[key]++
    }
  }
  END { for (k in c) print c[k], k }
' | sort -rn | head -30
echo ""

echo "=== HTTP / SOAP on port 5000 (ONVIF) ==="
tcpdump -nn -A -s 0 -r "$PCAP" 'tcp port 5000' 2>/dev/null \
  | grep -E 'POST |ContinuousMove|Stop|Move |Zoom|Focus|imaging|ptz|SOAP|ProfileToken|action=' \
  | head -80 || echo "(none)"
echo ""

echo "=== TCP port 34567 (DVRIP / Sofia, common on Xiongmai/Yoosee) ==="
COUNT_34567=$(tcpdump -nn -r "$PCAP" 'tcp port 34567' 2>/dev/null | wc -l)
echo "Packets: ${COUNT_34567}"
if [[ "$COUNT_34567" -gt 0 ]]; then
  tcpdump -nn -X -s 256 -r "$PCAP" 'tcp port 34567' 2>/dev/null | head -40
fi
echo ""

echo "=== UDP direction (camera vs client) ==="
if [[ -z "$CAM" ]]; then
  CAM=$(tcpdump -nn -r "$PCAP" 2>/dev/null | awk '/IP/ {print $3}' | head -1 | cut -d. -f1-4)
fi
if [[ -n "$CAM" && "$CAM" != "ARP," ]]; then
  TO_CAM=$(tcpdump -nn -r "$PCAP" "dst host $CAM and udp" 2>/dev/null | wc -l)
  FROM_CAM=$(tcpdump -nn -r "$PCAP" "src host $CAM and udp" 2>/dev/null | wc -l)
  echo "Camera IP (guessed): $CAM"
  echo "UDP -> camera:  $TO_CAM"
  echo "UDP <- camera:  $FROM_CAM"
  if [[ "$TO_CAM" -eq 0 && "$FROM_CAM" -gt 0 ]]; then
    echo ""
    echo "NOTE: Only camera->client UDP seen. Client->camera control packets missing."
    echo "      Run capture-lan-mitm.sh on 192.168.1.81 (not the client)."
    echo "      Phone apps may use cloud relay; Windows .39 usually uses LAN TCP."
  fi
  if [[ -n "$CLIENT" ]]; then
    TO_CLIENT=$(tcpdump -nn -r "$PCAP" "src host $CAM and dst host $CLIENT and udp" 2>/dev/null | wc -l)
    FROM_CLIENT=$(tcpdump -nn -r "$PCAP" "src host $CLIENT and dst host $CAM and udp" 2>/dev/null | wc -l)
    echo "Client ${CLIENT}: UDP -> camera ${FROM_CLIENT}  <- camera ${TO_CLIENT}"
    TO_CAM_TCP=$(tcpdump -nn -r "$PCAP" "src host $CLIENT and dst host $CAM and tcp" 2>/dev/null | wc -l)
    FROM_CAM_TCP=$(tcpdump -nn -r "$PCAP" "src host $CAM and dst host $CLIENT and tcp" 2>/dev/null | wc -l)
    echo "Client ${CLIENT}: TCP -> camera ${TO_CAM_TCP}  <- camera ${FROM_CAM_TCP}"
  fi
fi
echo ""

echo "=== Yoosee P2P UDP channels (typical) ==="
for entry in "36832:video" "8900:keepalive-dst" "49431:keepalive-src"; do
  port="${entry%%:*}"
  label="${entry##*:}"
  n=$(tcpdump -nn -r "$PCAP" "port $port" 2>/dev/null | wc -l)
  echo "port $port ($label): $n packets"
done
echo ""

echo "=== P2P keepalive sample (port 8900 / 49431, 102 bytes) ==="
tcpdump -nn -X -s 96 -r "$PCAP" 'udp and length 102' 2>/dev/null | head -20 || echo "(none)"
echo ""

echo "=== Video stream header sample (port 36832) ==="
tcpdump -nn -X -s 48 -r "$PCAP" 'port 36832' 2>/dev/null | head -12 || echo "(none)"
echo ""

echo "=== Full conversation list (first 50) ==="
tcpdump -nn -r "$PCAP" 2>/dev/null | head -50
